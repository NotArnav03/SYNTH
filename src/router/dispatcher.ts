// Agent registry + dependency-aware dispatcher.
// Every invocation calls the agent's /invoke via `fetchWithPayment`, which
// automatically satisfies the x402 402 response with a real USDC payment.

import {
  AgentCapability,
  AgentInvocation,
  AgentRegistration,
  AgentRequest,
  AgentResponse,
  PaymentRecord,
  Subtask,
} from "../shared/types.js";
import { config } from "../shared/config.js";
import { getFetchWithPayment, decodePaymentHeader, activeNetwork } from "./x402-client.js";

type InvocationCallback = (
  inv: AgentInvocation,
  payment: PaymentRecord | null,
) => void | Promise<void>;

// Optional injection point so tests can run the dispatcher against mocked
// fetch/signing without touching real x402 plumbing.
export interface DispatcherDeps {
  fetcher?: typeof globalThis.fetch;
  network?: string;
}

export class AgentRegistry {
  private agents = new Map<string, AgentRegistration>();

  register(agent: AgentRegistration): void {
    this.agents.set(agent.agentId, agent);
    console.log(
      `[registry] + ${agent.name} (${agent.capability}) @ $${agent.priceUsd.toFixed(4)}/call -> ${agent.endpoint}`,
    );
  }

  unregister(agentId: string): void {
    const removed = this.agents.get(agentId);
    this.agents.delete(agentId);
    if (removed) console.log(`[registry] - ${removed.name} (${agentId})`);
  }

  findByCapability(cap: AgentCapability): AgentRegistration[] {
    return [...this.agents.values()].filter((a) => a.capability === cap);
  }

  selectBest(cap: AgentCapability): AgentRegistration | undefined {
    const candidates = this.findByCapability(cap);
    candidates.sort((a, b) => a.priceUsd - b.priceUsd);
    return candidates[0];
  }

  listAll(): AgentRegistration[] {
    return [...this.agents.values()];
  }

  clear(): void {
    this.agents.clear();
  }
}

export const registry = new AgentRegistry();

export function topologicalLayers(subtasks: Subtask[]): Subtask[][] {
  const byId = new Map(subtasks.map((s) => [s.subtaskId, s]));
  const resolved = new Set<string>();
  const remaining = new Set(subtasks.map((s) => s.subtaskId));
  const layers: Subtask[][] = [];

  while (remaining.size > 0) {
    const layerIds = [...remaining].filter((id) =>
      (byId.get(id)!.dependsOn).every((d) => resolved.has(d)),
    );
    if (layerIds.length === 0) {
      throw new Error(
        `Circular dependency detected in subtasks: ${[...remaining].join(", ")}`,
      );
    }
    layers.push(layerIds.map((id) => byId.get(id)!));
    for (const id of layerIds) {
      resolved.add(id);
      remaining.delete(id);
    }
  }
  return layers;
}

export async function invokeAgent(
  agent: AgentRegistration,
  subtask: Subtask,
  context: Record<string, string>,
  deps: DispatcherDeps = {},
): Promise<{ invocation: AgentInvocation; output: string; payment: PaymentRecord | null }> {
  const invocation: AgentInvocation = {
    invocationId: crypto.randomUUID().slice(0, 8),
    subtaskId: subtask.subtaskId,
    agentId: agent.agentId,
    agentName: agent.name,
    capability: agent.capability,
    inputData: subtask.inputData,
    priceUsd: agent.priceUsd,
    status: "running",
    startedAt: new Date().toISOString(),
  };

  const fetcher = deps.fetcher ?? getFetchWithPayment();
  const net = deps.network ?? activeNetwork();

  const requestBody: AgentRequest = {
    invocationId: invocation.invocationId,
    inputData: subtask.inputData,
    context,
  };

  let payment: PaymentRecord | null = null;

  try {
    const res = await fetcher(`${agent.endpoint.replace(/\/$/, "")}/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "<no body>");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as AgentResponse;
    invocation.outputData = data.outputData;
    invocation.status = "completed";
    invocation.completedAt = new Date().toISOString();

    // Pull the x402 payment receipt from response headers.
    const xPayResp = res.headers.get("X-PAYMENT-RESPONSE") ?? res.headers.get("x-payment-response");
    const decoded = decodePaymentHeader(xPayResp);
    if (decoded) {
      // The exact shape of the decoded object depends on x402 version; we
      // defensively read common fields.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = decoded as any;
      invocation.x402PaymentResponse = d;
      invocation.paymentTxHash = d.transaction ?? d.txHash ?? d.tx_hash ?? "";
      payment = {
        txHash: invocation.paymentTxHash ?? "",
        fromWallet: config.routerWalletAddress,
        toWallet: agent.walletAddress,
        amountUsd: agent.priceUsd,
        agentId: agent.agentId,
        invocationId: invocation.invocationId,
        settledAt: new Date().toISOString(),
        chain: net,
        currency: "USDC",
        x402Scheme: "exact",
      };
      console.log(
        `[settle] $${agent.priceUsd.toFixed(4)} USDC -> ${agent.name} ` +
          `(${payment.txHash.slice(0, 14)}…) on ${net}`,
      );
    } else {
      // This should not happen once x402 is wired. If it does, surface it.
      console.warn(
        `[settle] WARNING: no X-PAYMENT-RESPONSE from ${agent.name}. ` +
          `Agent may not be x402-gated, or facilitator did not settle.`,
      );
    }

    return { invocation, output: invocation.outputData ?? "", payment };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    invocation.status = "failed";
    invocation.completedAt = new Date().toISOString();
    invocation.outputData = `[error] ${message}`;
    return { invocation, output: invocation.outputData, payment: null };
  }
}

export async function dispatchSubtasks(
  subtasks: Subtask[],
  onInvocationComplete?: InvocationCallback,
  deps: DispatcherDeps = {},
): Promise<{ invocations: AgentInvocation[]; payments: PaymentRecord[] }> {
  const invocations: AgentInvocation[] = [];
  const payments: PaymentRecord[] = [];
  const outputsBySubtask = new Map<string, string>();
  const layers = topologicalLayers(subtasks);

  for (const layer of layers) {
    const promises = layer.map(async (subtask) => {
      const agent = registry.selectBest(subtask.requiredCapability);
      if (!agent) {
        const inv: AgentInvocation = {
          invocationId: crypto.randomUUID().slice(0, 8),
          subtaskId: subtask.subtaskId,
          agentId: "none",
          agentName: "<unavailable>",
          capability: subtask.requiredCapability,
          inputData: subtask.inputData,
          priceUsd: 0,
          status: "failed",
          outputData: `No agent registered for capability ${subtask.requiredCapability}`,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        };
        invocations.push(inv);
        outputsBySubtask.set(subtask.subtaskId, inv.outputData ?? "");
        if (onInvocationComplete) await onInvocationComplete(inv, null);
        return;
      }

      const context: Record<string, string> = {};
      for (const dep of subtask.dependsOn) {
        context[dep] = outputsBySubtask.get(dep) ?? "";
      }

      const { invocation, output, payment } = await invokeAgent(agent, subtask, context, deps);
      invocations.push(invocation);
      outputsBySubtask.set(subtask.subtaskId, output);
      if (payment) payments.push(payment);
      if (onInvocationComplete) await onInvocationComplete(invocation, payment);
    });
    await Promise.all(promises);
  }

  return { invocations, payments };
}

// SYNTH router: REST + SSE orchestration server.
// POST /tasks/execute runs the full pipeline synchronously.
// GET  /tasks/stream streams every lifecycle event over SSE.
// Every agent call triggers a real x402 USDC payment on the configured network.

import express, { Request, Response } from "express";
import {
  AgentInvocation,
  AgentRegistration,
  PaymentRecord,
  StreamEvent,
  TaskDecomposition,
  TaskResult,
  shortId,
} from "../shared/types.js";
import { config } from "../shared/config.js";
import { decomposeTask } from "./decomposer.js";
import { dispatchSubtasks, registry } from "./dispatcher.js";
import { activeNetwork } from "./x402-client.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

// --- Simple global stats used by the dashboard counter ----------------------
const stats = {
  totalTasks: 0,
  totalInvocations: 0,
  onchainTxCount: 0,
  totalUsdSettled: 0,
  startedAt: new Date().toISOString(),
};

// --- SSE broadcaster --------------------------------------------------------
type SseClient = { id: string; res: Response };
const sseClients: SseClient[] = [];

function broadcast(event: StreamEvent): void {
  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
  for (const c of sseClients) {
    try {
      c.res.write(payload);
    } catch {
      // drop silently; cleanup happens on close
    }
  }
}

// --- Agent registry endpoints ----------------------------------------------
app.post("/agents/register", (req: Request, res: Response) => {
  const body = req.body as Partial<AgentRegistration>;
  if (
    !body.agentId ||
    !body.name ||
    !body.capability ||
    !body.endpoint ||
    !body.walletAddress ||
    typeof body.priceUsd !== "number" ||
    typeof body.port !== "number"
  ) {
    res.status(400).json({ error: "Invalid registration payload" });
    return;
  }
  registry.register(body as AgentRegistration);
  res.json({ ok: true });
});

app.delete("/agents/:id", (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  registry.unregister(id);
  res.json({ ok: true });
});

app.get("/agents", (_req: Request, res: Response) => {
  res.json({ agents: registry.listAll() });
});

// --- Health / stats ---------------------------------------------------------
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    network: activeNetwork(),
    facilitator: config.facilitatorUrl,
    agents: registry.listAll().length,
    uptimeSec: Math.round((Date.now() - new Date(stats.startedAt).getTime()) / 1000),
  });
});

app.get("/stats", (_req: Request, res: Response) => {
  res.json({
    ...stats,
    network: activeNetwork(),
    registeredAgents: registry.listAll().length,
  });
});

// --- SSE stream -------------------------------------------------------------
app.get("/tasks/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const client: SseClient = { id: shortId(), res };
  sseClients.push(client);

  const ping = setInterval(() => {
    try {
      res.write(`event: ping\ndata: {}\n\n`);
    } catch {
      /* ignore */
    }
  }, 15_000);

  req.on("close", () => {
    clearInterval(ping);
    const idx = sseClients.findIndex((c) => c.id === client.id);
    if (idx >= 0) sseClients.splice(idx, 1);
  });
});

// --- Core task execution ----------------------------------------------------
async function executeTask(query: string): Promise<TaskResult> {
  const taskId = shortId();
  const t0 = Date.now();

  const decomposition: TaskDecomposition = await decomposeTask(query);
  broadcast({ type: "decomposition", data: decomposition });

  const invocations: AgentInvocation[] = [];
  const payments: PaymentRecord[] = [];

  const { invocations: invs, payments: pays } = await dispatchSubtasks(
    decomposition.subtasks,
    async (inv, pay) => {
      invocations.push(inv);
      broadcast({ type: "invocation", data: inv });
      if (pay) {
        payments.push(pay);
        broadcast({ type: "payment", data: pay });
      }
    },
  );

  // dispatchSubtasks already accumulates its own arrays; we trust those as
  // the source of truth in case the callback missed anything.
  const finalInvocations = invs.length >= invocations.length ? invs : invocations;
  const finalPayments = pays.length >= payments.length ? pays : payments;

  // Final result = output of the last subtask in the DAG (synthesis if present).
  const last = finalInvocations[finalInvocations.length - 1];
  const finalResult = last?.outputData ?? "[no output]";

  const totalCostUsd = finalInvocations.reduce((s, i) => s + (i.priceUsd ?? 0), 0);
  const routerMarginUsd = +(totalCostUsd * config.routerMarginPercent).toFixed(6);
  const userChargedUsd = +(totalCostUsd + routerMarginUsd).toFixed(6);

  const result: TaskResult = {
    taskId,
    originalQuery: query,
    decomposition,
    invocations: finalInvocations,
    payments: finalPayments,
    finalResult,
    totalCostUsd: +totalCostUsd.toFixed(6),
    routerMarginUsd,
    userChargedUsd,
    totalLatencyMs: Date.now() - t0,
    onchainTxCount: finalPayments.length,
  };

  stats.totalTasks += 1;
  stats.totalInvocations += finalInvocations.length;
  stats.onchainTxCount += finalPayments.length;
  stats.totalUsdSettled = +(stats.totalUsdSettled + totalCostUsd).toFixed(6);

  broadcast({ type: "complete", data: result });
  return result;
}

app.post("/tasks/execute", async (req: Request, res: Response) => {
  const query = (req.body?.query ?? "").toString().trim();
  if (!query) {
    res.status(400).json({ error: "Missing 'query' in request body" });
    return;
  }
  try {
    const result = await executeTask(query);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[router] executeTask failed:", message);
    res.status(500).json({ error: message });
  }
});

// --- Boot -------------------------------------------------------------------
const port = config.routerPort;
app.listen(port, () => {
  console.log(`[router] listening on :${port}`);
  console.log(`[router] x402 network: ${activeNetwork()}`);
  console.log(`[router] facilitator: ${config.facilitatorUrl}`);
});

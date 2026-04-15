import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AgentRegistry,
  topologicalLayers,
  dispatchSubtasks,
  registry,
} from "../src/router/dispatcher.js";
import { AgentCapability, AgentRegistration, Subtask } from "../src/shared/types.js";

const agent = (cap: AgentCapability, price: number, port: number, id: string): AgentRegistration => ({
  agentId: id,
  name: `agent-${id}`,
  capability: cap,
  description: "",
  priceUsd: price,
  endpoint: `http://localhost:${port}`,
  walletAddress: `0x${id.padEnd(40, "0")}`,
  port,
});

describe("AgentRegistry", () => {
  it("registers, lists, and finds by capability", () => {
    const r = new AgentRegistry();
    r.register(agent(AgentCapability.WEB_RESEARCH, 0.003, 3001, "wr"));
    r.register(agent(AgentCapability.SYNTHESIS, 0.002, 3004, "sy"));
    expect(r.listAll()).toHaveLength(2);
    expect(r.findByCapability(AgentCapability.WEB_RESEARCH)).toHaveLength(1);
  });

  it("selectBest picks the cheapest agent for a capability", () => {
    const r = new AgentRegistry();
    r.register(agent(AgentCapability.WEB_RESEARCH, 0.005, 3001, "a"));
    r.register(agent(AgentCapability.WEB_RESEARCH, 0.001, 3011, "b"));
    expect(r.selectBest(AgentCapability.WEB_RESEARCH)?.agentId).toBe("b");
  });
});

describe("topologicalLayers", () => {
  it("groups independent tasks into one layer and dependents into the next", () => {
    const tasks: Subtask[] = [
      { subtaskId: "a", description: "", requiredCapability: AgentCapability.WEB_RESEARCH, inputData: "", dependsOn: [] },
      { subtaskId: "b", description: "", requiredCapability: AgentCapability.DOCUMENT_ANALYSIS, inputData: "", dependsOn: [] },
      { subtaskId: "c", description: "", requiredCapability: AgentCapability.SYNTHESIS, inputData: "", dependsOn: ["a", "b"] },
    ];
    const layers = topologicalLayers(tasks);
    expect(layers).toHaveLength(2);
    expect(layers[0].map((s) => s.subtaskId).sort()).toEqual(["a", "b"]);
    expect(layers[1][0].subtaskId).toBe("c");
  });

  it("throws on circular dependencies", () => {
    const tasks: Subtask[] = [
      { subtaskId: "a", description: "", requiredCapability: AgentCapability.WEB_RESEARCH, inputData: "", dependsOn: ["b"] },
      { subtaskId: "b", description: "", requiredCapability: AgentCapability.WEB_RESEARCH, inputData: "", dependsOn: ["a"] },
    ];
    expect(() => topologicalLayers(tasks)).toThrow(/Circular/);
  });
});

describe("dispatchSubtasks", () => {
  beforeEach(() => {
    registry.clear();
  });

  it("invokes each subtask via the injected fetcher and threads context", async () => {
    registry.register(agent(AgentCapability.WEB_RESEARCH, 0.003, 3001, "wr"));
    registry.register(agent(AgentCapability.SYNTHESIS, 0.002, 3004, "sy"));

    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const outputData = url.includes(":3001") ? "research-output" : `synth(${body.context?.s1 ?? ""})`;
      return new Response(
        JSON.stringify({ invocationId: body.invocationId, outputData }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-PAYMENT-RESPONSE": "eyJ0cmFuc2FjdGlvbiI6IjB4ZGVhZGJlZWYifQ==",
          },
        },
      );
    }) as unknown as typeof fetch;

    const subtasks: Subtask[] = [
      { subtaskId: "s1", description: "", requiredCapability: AgentCapability.WEB_RESEARCH, inputData: "ask", dependsOn: [] },
      { subtaskId: "s2", description: "", requiredCapability: AgentCapability.SYNTHESIS, inputData: "combine", dependsOn: ["s1"] },
    ];

    const { invocations, payments } = await dispatchSubtasks(subtasks, undefined, { fetcher, network: "base-sepolia" });
    expect(invocations).toHaveLength(2);
    expect(invocations.every((i) => i.status === "completed")).toBe(true);
    expect(payments).toHaveLength(2);

    const synthCall = fetcher.mock.calls.find((c) => (c[0] as string).includes(":3004"));
    const synthBody = JSON.parse((synthCall![1] as RequestInit).body as string);
    expect(synthBody.context.s1).toBe("research-output");
  });

  it("marks invocations failed when no agent is registered", async () => {
    const subtasks: Subtask[] = [
      { subtaskId: "s1", description: "", requiredCapability: AgentCapability.CODE_REVIEW, inputData: "x", dependsOn: [] },
    ];
    const { invocations, payments } = await dispatchSubtasks(subtasks);
    expect(invocations[0].status).toBe("failed");
    expect(payments).toHaveLength(0);
  });
});

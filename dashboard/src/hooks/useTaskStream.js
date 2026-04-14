import { useCallback, useEffect, useRef, useState } from "react";

const ROUTER_URL = import.meta.env.VITE_ROUTER_URL || "http://localhost:8000";
const MOCK_MODE =
  String(import.meta.env.VITE_MOCK_MODE ?? "true").toLowerCase() !== "false";

const CAPABILITY_COLOR = {
  web_research: "var(--cyan)",
  document_analysis: "var(--violet)",
  code_review: "var(--pink)",
  synthesis: "var(--emerald)",
};

const CAPABILITY_ICON = {
  web_research: "🔎",
  document_analysis: "📄",
  code_review: "🧪",
  synthesis: "✨",
};

const REGISTRY_SEED = [
  {
    agent_id: "wr-01",
    name: "WebResearch",
    capability: "web_research",
    description: "Searches the web and returns structured findings.",
    price_usd: 0.003,
    avg_latency_ms: 900,
    wallet_address: "arc:0x7a9f4b2c1e8d3f5a6b9c8d4e2f1a3b5c7d9e0f2a",
    endpoint: "http://localhost:8001",
  },
  {
    agent_id: "da-01",
    name: "DocAnalysis",
    capability: "document_analysis",
    description: "Extracts entities and key clauses from documents.",
    price_usd: 0.005,
    avg_latency_ms: 1100,
    wallet_address: "arc:0x3e1a7b9c5d2f4a8b6c1e9d7f3b5a2c4e8d1f6a9b",
    endpoint: "http://localhost:8002",
  },
  {
    agent_id: "cr-01",
    name: "CodeReview",
    capability: "code_review",
    description: "Finds bugs, security issues, and style problems.",
    price_usd: 0.004,
    avg_latency_ms: 800,
    wallet_address: "arc:0x9f2e8d1c7b3a5f6d4e2c9b8a1d3f5e7c6b9a4d2f",
    endpoint: "http://localhost:8003",
  },
  {
    agent_id: "sy-01",
    name: "Synthesis",
    capability: "synthesis",
    description: "Combines upstream outputs into a unified answer.",
    price_usd: 0.002,
    avg_latency_ms: 600,
    wallet_address: "arc:0x1c5e3a9b7d2f4c8a6e1d9b3f5c7a2e4d8b1f6c9e",
    endpoint: "http://localhost:8004",
  },
];

function mockDecompose(query) {
  const q = query.toLowerCase();
  const subtasks = [];
  const includes = (terms) => terms.some((t) => q.includes(t));
  const codey = includes([
    "code",
    "audit",
    "api endpoint",
    "review this",
    "script",
    "owasp",
    "security",
  ]);
  const research = includes([
    "find",
    "research",
    "comparable",
    "standards",
    "best practices",
    "recent",
    "market",
    "style guide",
  ]);
  const doc = includes([
    "contract",
    "analyze",
    "document",
    "clause",
    "extract",
    "summari",
  ]);

  if (codey) {
    subtasks.push({
      subtask_id: "t1",
      description: "Review code for issues",
      required_capability: "code_review",
      input_data: query,
      depends_on: [],
    });
  }
  if (doc) {
    subtasks.push({
      subtask_id: `t${subtasks.length + 1}`,
      description: "Analyze document",
      required_capability: "document_analysis",
      input_data: query,
      depends_on: [],
    });
  }
  if (research) {
    subtasks.push({
      subtask_id: `t${subtasks.length + 1}`,
      description: "Research related material",
      required_capability: "web_research",
      input_data: query,
      depends_on: [],
    });
  }
  if (subtasks.length === 0) {
    subtasks.push({
      subtask_id: "t1",
      description: "Research query",
      required_capability: "web_research",
      input_data: query,
      depends_on: [],
    });
  }
  if (subtasks.length >= 2) {
    subtasks.push({
      subtask_id: `t${subtasks.length + 1}`,
      description: "Synthesize final answer",
      required_capability: "synthesis",
      input_data: "Synthesize the upstream results into one coherent answer.",
      depends_on: subtasks.map((s) => s.subtask_id),
    });
  }
  return {
    original_query: query,
    subtasks,
    execution_plan:
      `Decomposed into ${subtasks.length} subtask${subtasks.length === 1 ? "" : "s"}, ` +
      `dispatched to the cheapest qualifying agents, settled per-invocation in USDC.`,
  };
}

function agentForCapability(cap) {
  return REGISTRY_SEED.find((a) => a.capability === cap);
}

function txHash() {
  const chars = "0123456789abcdef";
  let h = "0x";
  for (let i = 0; i < 64; i++) h += chars[Math.floor(Math.random() * 16)];
  return h;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function useTaskStream() {
  const [phase, setPhase] = useState("idle");
  const [decomposition, setDecomposition] = useState(null);
  const [activeSubtasks, setActiveSubtasks] = useState(new Set());
  const [completedSubtasks, setCompletedSubtasks] = useState(new Set());
  const [invocations, setInvocations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [result, setResult] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [agents] = useState(REGISTRY_SEED);
  const [activeAgents, setActiveAgents] = useState(new Set());
  const [settledByAgent, setSettledByAgent] = useState({});
  const cancelledRef = useRef(false);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setPhase("idle");
    setDecomposition(null);
    setActiveSubtasks(new Set());
    setCompletedSubtasks(new Set());
    setInvocations([]);
    setPayments([]);
    setResult(null);
    setStartedAt(null);
    setActiveAgents(new Set());
    setSettledByAgent({});
  }, []);

  const runMock = useCallback(async (query) => {
    cancelledRef.current = false;
    setPhase("decomposing");
    setInvocations([]);
    setPayments([]);
    setResult(null);
    setActiveSubtasks(new Set());
    setCompletedSubtasks(new Set());
    setActiveAgents(new Set());
    setSettledByAgent({});
    const t0 = performance.now();
    setStartedAt(t0);

    await delay(600);
    if (cancelledRef.current) return;

    const decomp = mockDecompose(query);
    setDecomposition(decomp);
    setPhase("executing");

    const byId = Object.fromEntries(decomp.subtasks.map((s) => [s.subtask_id, s]));
    const resolved = new Set();
    const remaining = new Set(decomp.subtasks.map((s) => s.subtask_id));

    while (remaining.size > 0) {
      const layerIds = [...remaining].filter((id) =>
        byId[id].depends_on.every((d) => resolved.has(d)),
      );
      await Promise.all(
        layerIds.map(async (id) => {
          const subtask = byId[id];
          const agent = agentForCapability(subtask.required_capability);
          setActiveSubtasks((s) => new Set(s).add(id));
          setActiveAgents((s) => new Set(s).add(agent.capability));
          const lat = 600 + Math.random() * 800;
          await delay(lat);
          if (cancelledRef.current) return;
          const inv = {
            invocation_id: `inv-${id}`,
            subtask_id: id,
            agent_id: agent.agent_id,
            agent_name: agent.name,
            capability: agent.capability,
            price_usd: agent.price_usd,
            status: "completed",
            output_data: `Mock output for ${subtask.description}`,
          };
          setInvocations((arr) => [...arr, inv]);
          const pay = {
            tx_hash: txHash(),
            from_wallet: "arc:0xrouter_wallet_placeholder_0000000000000000",
            to_wallet: agent.wallet_address,
            amount_usd: agent.price_usd,
            agent_id: agent.agent_id,
            agent_name: agent.name,
            capability: agent.capability,
            invocation_id: inv.invocation_id,
            settled_at: new Date().toISOString(),
            chain: "arc",
            currency: "USDC",
          };
          setPayments((arr) => [...arr, pay]);
          setSettledByAgent((m) => ({
            ...m,
            [agent.capability]: (m[agent.capability] || 0) + agent.price_usd,
          }));
          setActiveSubtasks((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
          setActiveAgents((s) => {
            const n = new Set(s);
            n.delete(agent.capability);
            return n;
          });
          setCompletedSubtasks((s) => new Set(s).add(id));
          resolved.add(id);
        }),
      );
      layerIds.forEach((id) => remaining.delete(id));
      if (cancelledRef.current) return;
    }

    const agentCost = decomp.subtasks.reduce(
      (a, s) => a + agentForCapability(s.required_capability).price_usd,
      0,
    );
    const margin = +(agentCost * 0.1).toFixed(6);
    const userCharged = +(agentCost + margin).toFixed(6);
    const marginPay = {
      tx_hash: txHash(),
      from_wallet: "arc:0xuser_wallet_placeholder_0000000000000000",
      to_wallet: "arc:0xrouter_wallet_placeholder_0000000000000000",
      amount_usd: margin,
      agent_id: "router",
      agent_name: "Router Margin",
      capability: "router",
      invocation_id: "margin",
      settled_at: new Date().toISOString(),
      chain: "arc",
      currency: "USDC",
    };
    setPayments((arr) => [...arr, marginPay]);

    const totalLatency = Math.round(performance.now() - t0);
    setResult({
      original_query: query,
      total_cost_usd: +agentCost.toFixed(6),
      router_margin_usd: margin,
      user_charged_usd: userCharged,
      total_latency_ms: totalLatency,
      final_result: `Mock synthesis: executed ${decomp.subtasks.length} subtask${
        decomp.subtasks.length === 1 ? "" : "s"
      } for query "${query}". Every call settled on Arc in USDC.`,
    });
    setPhase("complete");
  }, []);

  const runLive = useCallback(async (query) => {
    cancelledRef.current = false;
    setPhase("decomposing");
    setInvocations([]);
    setPayments([]);
    setResult(null);
    setActiveSubtasks(new Set());
    setCompletedSubtasks(new Set());
    setActiveAgents(new Set());
    setSettledByAgent({});
    const t0 = performance.now();
    setStartedAt(t0);

    try {
      const res = await fetch(`${ROUTER_URL}/tasks/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, user_wallet: "user-wallet-default" }),
      });
      if (!res.body) throw new Error("no stream body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          const evt = JSON.parse(raw);
          handleLiveEvent(evt);
        }
      }
    } catch (e) {
      console.warn("Live stream failed, falling back to mock:", e);
      await runMock(query);
    }

    function handleLiveEvent(evt) {
      if (evt.type === "decomposition") {
        setDecomposition(evt.data);
        setPhase("executing");
      } else if (evt.type === "invocation") {
        const inv = evt.data;
        setInvocations((arr) => [...arr, inv]);
        if (inv.status === "completed" || inv.status === "failed") {
          setCompletedSubtasks((s) => new Set(s).add(inv.subtask_id));
          setActiveSubtasks((s) => {
            const n = new Set(s);
            n.delete(inv.subtask_id);
            return n;
          });
          setActiveAgents((s) => {
            const n = new Set(s);
            n.delete(inv.capability);
            return n;
          });
        } else {
          setActiveSubtasks((s) => new Set(s).add(inv.subtask_id));
          setActiveAgents((s) => new Set(s).add(inv.capability));
        }
      } else if (evt.type === "payment") {
        setPayments((arr) => [...arr, evt.data]);
        if (evt.data.agent_id && evt.data.agent_id !== "router") {
          setSettledByAgent((m) => ({
            ...m,
            [evt.data.agent_id]: (m[evt.data.agent_id] || 0) + evt.data.amount_usd,
          }));
        }
      } else if (evt.type === "complete") {
        const r = evt.data;
        setResult({
          original_query: r.original_query,
          total_cost_usd: r.total_cost_usd,
          router_margin_usd: r.router_margin_usd,
          user_charged_usd: r.user_charged_usd,
          total_latency_ms: r.total_latency_ms,
          final_result: r.final_result,
        });
        setPhase("complete");
      }
    }
  }, [runMock]);

  const runTask = useCallback(
    async (query) => {
      if (MOCK_MODE) await runMock(query);
      else await runLive(query);
    },
    [runLive, runMock],
  );

  useEffect(() => () => { cancelledRef.current = true; }, []);

  return {
    phase,
    decomposition,
    invocations,
    payments,
    result,
    agents,
    activeSubtasks,
    completedSubtasks,
    activeAgents,
    settledByAgent,
    startedAt,
    runTask,
    reset,
    isBusy: phase === "decomposing" || phase === "executing",
  };
}

export { CAPABILITY_COLOR, CAPABILITY_ICON };

import { useEffect, useState } from "react";
import { useStream } from "./hooks/useStream";
import { TransactionCounter } from "./components/TransactionCounter";
import { AgentRegistry } from "./components/AgentRegistry";
import { QueryInput } from "./components/QueryInput";
import { TaskFlowGraph } from "./components/TaskFlowGraph";
import { PaymentStream } from "./components/PaymentStream";
import { CostSummary } from "./components/CostSummary";
import { TaskResult } from "./types";

interface Stats {
  onchainTxCount: number;
  totalInvocations: number;
  totalTasks: number;
  totalUsdSettled: number;
  network: string;
  registeredAgents: number;
}

export function App() {
  const stream = useStream();
  const [stats, setStats] = useState<Stats | null>(null);
  const [lastResult, setLastResult] = useState<TaskResult | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/stats");
        setStats(await r.json());
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, []);

  const txCount = stats?.onchainTxCount ?? stream.payments.length;

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>SYNTH</h1>
          <div className="subtitle">
            Sub-cent Yield Network · {stats?.network ?? "—"} ·{" "}
            {stream.connected ? "live" : "reconnecting…"}
          </div>
        </div>
        <TransactionCounter count={txCount} target={50} />
      </header>

      <CostSummary payments={stream.payments} completed={stream.completed} />

      <div className="grid">
        <QueryInput onResult={setLastResult} />
        <AgentRegistry />
        <TaskFlowGraph invocations={stream.invocations} />
        <PaymentStream payments={stream.payments} />
      </div>

      {lastResult && (
        <section className="panel result">
          <h2>Last result</h2>
          <div className="mono muted">
            task {lastResult.taskId} · {lastResult.onchainTxCount} tx · $
            {lastResult.totalCostUsd.toFixed(6)} paid · charged $
            {lastResult.userChargedUsd.toFixed(6)} · {lastResult.totalLatencyMs}ms
          </div>
          <pre className="result__body">{lastResult.finalResult}</pre>
        </section>
      )}

      <footer className="footer">
        x402 · Circle Nanopayments · Arc-ready · USDC-settled · sole author Arnav
      </footer>
    </div>
  );
}

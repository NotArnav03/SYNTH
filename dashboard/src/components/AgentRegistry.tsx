import { useEffect, useState } from "react";
import { AgentRegistration } from "../types";

export function AgentRegistry() {
  const [agents, setAgents] = useState<AgentRegistration[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/agents");
        const j = await r.json();
        setAgents(j.agents ?? []);
      } catch (e) {
        setErr((e as Error).message);
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="panel">
      <h2>Registered agents</h2>
      {err && <div className="error">{err}</div>}
      <table className="agents">
        <thead>
          <tr>
            <th>Name</th>
            <th>Capability</th>
            <th>Price</th>
            <th>Endpoint</th>
            <th>Wallet</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => (
            <tr key={a.agentId}>
              <td>{a.name}</td>
              <td>{a.capability}</td>
              <td>${a.priceUsd.toFixed(4)}</td>
              <td className="mono">{a.endpoint}</td>
              <td className="mono">{a.walletAddress.slice(0, 10)}…</td>
            </tr>
          ))}
          {agents.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">No agents registered yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

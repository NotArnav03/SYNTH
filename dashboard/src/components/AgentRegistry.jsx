import React from "react";
import { CAPABILITY_COLOR, CAPABILITY_ICON } from "../hooks/useTaskStream.js";

const shortWallet = (addr) => {
  if (!addr) return "";
  const raw = addr.replace("arc:", "");
  return `arc:${raw.slice(0, 8)}…${raw.slice(-6)}`;
};

const fmt = (n) => `$${Number(n).toFixed(4)}`;

export default function AgentRegistry({ agents, activeAgents, settledByAgent }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Agent Registry</span>
        <span className="card-subtle">{agents.length} online</span>
      </div>
      <div className="agent-list">
        {agents.map((a) => {
          const active = activeAgents.has(a.capability);
          const settled = settledByAgent[a.agent_id] || settledByAgent[a.capability] || 0;
          const color = CAPABILITY_COLOR[a.capability] || "var(--cyan)";
          return (
            <div
              key={a.agent_id}
              className="agent-card"
              data-active={active ? "true" : "false"}
              style={{ "--agent-color": color }}
            >
              <div className="agent-row-top">
                <div className="agent-name">
                  <span className="agent-icon">{CAPABILITY_ICON[a.capability] || "🤖"}</span>
                  <span>{a.name}</span>
                </div>
                <div className="agent-status">
                  <span className="dot" />
                  online
                </div>
              </div>
              <div className="agent-meta">
                <span>price</span>
                <strong>{fmt(a.price_usd)}/call</strong>
                <span>latency</span>
                <strong>~{a.avg_latency_ms}ms</strong>
              </div>
              <div className="agent-wallet">{shortWallet(a.wallet_address)}</div>
              {settled > 0 && (
                <div className="agent-settled">✓ Settled ${settled.toFixed(4)} USDC</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

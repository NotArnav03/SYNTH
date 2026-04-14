import React from "react";

const fmt = (n) => `$${Number(n).toFixed(4)}`;

export default function CostSummary({ result, paymentCount }) {
  if (!result) return null;

  const latency = (result.total_latency_ms / 1000).toFixed(2);
  const settlements = paymentCount;
  const agentSettlements = Math.max(0, settlements - 1);

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Settlement Summary</span>
        <span className="card-subtle">signed · final · paid</span>
      </div>
      <div className="summary">
        <div className="summary-grid">
          <div className="stat" style={{ "--stat-color": "var(--cyan)" }}>
            <div className="stat-value">{fmt(result.total_cost_usd)}</div>
            <div className="stat-label">Agent Costs</div>
          </div>
          <div className="stat" style={{ "--stat-color": "var(--violet)" }}>
            <div className="stat-value">{fmt(result.router_margin_usd)}</div>
            <div className="stat-label">Router Margin (10%)</div>
          </div>
          <div className="stat" style={{ "--stat-color": "var(--pink)" }}>
            <div className="stat-value">{fmt(result.user_charged_usd)}</div>
            <div className="stat-label">Total Charged</div>
          </div>
          <div className="stat" style={{ "--stat-color": "var(--emerald)" }}>
            <div className="stat-value">{latency}s</div>
            <div className="stat-label">Latency</div>
          </div>
        </div>
        <div className="summary-foot">
          {agentSettlements} nanopayment{agentSettlements === 1 ? "" : "s"} settled on Arc in {latency}s · Zero gas overhead · All agents paid in USDC
        </div>
      </div>
    </div>
  );
}

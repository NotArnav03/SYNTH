import React, { useEffect, useRef } from "react";
import { CAPABILITY_COLOR } from "../hooks/useTaskStream.js";

const short = (s, n = 8) => (s && s.length > n * 2 ? `${s.slice(0, n)}…${s.slice(-n)}` : s);

export default function PaymentStream({ payments, isActive }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [payments.length]);

  return (
    <div className="card">
      <div className="card-header">
        <div className="stream-header">
          <span className="stream-dot" data-idle={isActive ? "false" : "true"} />
          <span className="card-title">Arc Settlement Feed</span>
        </div>
        <span className="card-subtle">{payments.length} settlements</span>
      </div>
      <div className="stream" ref={ref}>
        {payments.length === 0 ? (
          <div className="stream-empty">
            awaiting settlements · USDC payments stream here in real time
          </div>
        ) : (
          payments.map((p, i) => {
            const capColor = CAPABILITY_COLOR[p.capability] || "var(--text-secondary)";
            const label =
              p.agent_id === "router"
                ? "Router Margin"
                : (p.agent_name || p.capability || "agent");
            return (
              <div
                key={i}
                className="pay-row"
                style={{ "--agent-color": capColor }}
              >
                <span className="pay-amount">${p.amount_usd.toFixed(4)}</span>
                <span className="pay-arrow">→</span>
                <span className="pay-target">{label}</span>
                <span className="pay-tx">{short(p.tx_hash, 6)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

import { AgentInvocation } from "../types";

interface Props {
  invocations: AgentInvocation[];
}

const CAP_COLOR: Record<string, string> = {
  web_research: "#4cc9f0",
  document_analysis: "#f3722c",
  code_review: "#f94144",
  synthesis: "#90be6d",
};

export function TaskFlowGraph({ invocations }: Props) {
  const recent = invocations.slice(-12).reverse();
  return (
    <section className="panel">
      <h2>Live invocations</h2>
      <div className="flow">
        {recent.length === 0 && <div className="muted">waiting for tasks…</div>}
        {recent.map((inv) => (
          <div
            key={inv.invocationId}
            className={`flow__node flow__node--${inv.status}`}
            style={{ borderColor: CAP_COLOR[inv.capability] ?? "#888" }}
          >
            <div className="flow__head">
              <span className="flow__agent">{inv.agentName}</span>
              <span className="flow__status">{inv.status}</span>
            </div>
            <div className="flow__cap">{inv.capability}</div>
            <div className="flow__price">${inv.priceUsd.toFixed(4)}</div>
            {inv.paymentTxHash && (
              <div className="mono flow__tx">{inv.paymentTxHash.slice(0, 18)}…</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

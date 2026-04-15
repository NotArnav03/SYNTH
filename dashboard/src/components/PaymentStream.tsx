import { PaymentRecord } from "../types";

interface Props {
  payments: PaymentRecord[];
}

export function PaymentStream({ payments }: Props) {
  const recent = [...payments].reverse().slice(0, 30);
  return (
    <section className="panel">
      <h2>Payment stream</h2>
      <ul className="payments">
        {recent.length === 0 && <li className="muted">no settlements yet</li>}
        {recent.map((p) => (
          <li key={`${p.txHash}-${p.invocationId}`}>
            <span className="mono tx">{p.txHash.slice(0, 14)}…</span>
            <span className="amount">${p.amountUsd.toFixed(4)}</span>
            <span className="chain">{p.chain}</span>
            <span className="mono to">→ {p.toWallet.slice(0, 10)}…</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

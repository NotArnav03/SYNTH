import { PaymentRecord, TaskResult } from "../types";

interface Props {
  payments: PaymentRecord[];
  completed: TaskResult[];
}

export function CostSummary({ payments, completed }: Props) {
  const totalSettled = payments.reduce((s, p) => s + p.amountUsd, 0);
  const totalCharged = completed.reduce((s, r) => s + r.userChargedUsd, 0);
  const margin = completed.reduce((s, r) => s + r.routerMarginUsd, 0);

  return (
    <section className="panel costs">
      <div>
        <div className="cost__label">agents paid</div>
        <div className="cost__value">${totalSettled.toFixed(6)}</div>
      </div>
      <div>
        <div className="cost__label">users charged</div>
        <div className="cost__value">${totalCharged.toFixed(6)}</div>
      </div>
      <div>
        <div className="cost__label">router margin</div>
        <div className="cost__value">${margin.toFixed(6)}</div>
      </div>
      <div>
        <div className="cost__label">tasks complete</div>
        <div className="cost__value">{completed.length}</div>
      </div>
    </section>
  );
}

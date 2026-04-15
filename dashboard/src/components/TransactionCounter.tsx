import { useEffect, useRef, useState } from "react";

interface Props {
  count: number;
  target?: number;
}

export function TransactionCounter({ count, target = 50 }: Props) {
  const [displayed, setDisplayed] = useState(count);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = displayed;
    const delta = count - start;
    if (delta === 0) return;
    const duration = 600;
    const t0 = performance.now();

    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(start + delta * ease));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const hit = count >= target;
  return (
    <div className={`tx-counter ${hit ? "tx-counter--hit" : ""}`}>
      <div className="tx-counter__label">onchain x402 transactions</div>
      <div className="tx-counter__value">{displayed}</div>
      <div className="tx-counter__target">
        target: {target}+ {hit ? "✓" : ""}
      </div>
    </div>
  );
}

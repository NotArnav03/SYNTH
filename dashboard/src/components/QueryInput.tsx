import { useState } from "react";
import { TaskResult } from "../types";

interface Props {
  onResult: (r: TaskResult) => void;
}

export function QueryInput({ onResult }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/tasks/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      const j = (await r.json()) as TaskResult;
      onResult(j);
      setQuery("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <h2>Ask SYNTH</h2>
      <form onSubmit={submit}>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Compare gas on Arc vs Base vs Solana for a $0.001 USDC transfer"
          rows={3}
        />
        <button type="submit" disabled={loading || !query.trim()}>
          {loading ? "Running…" : "Execute"}
        </button>
      </form>
      {err && <div className="error">{err}</div>}
    </section>
  );
}

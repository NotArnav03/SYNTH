import React, { useState } from "react";

const SCENARIOS = [
  "Review this Python script and find best practices from recent style guides",
  "Analyze this contract and find comparable deals in the market",
  "Audit this API endpoint code and check if it follows OWASP security standards",
];

export default function QueryInput({ onRun, phase }) {
  const [value, setValue] = useState("");
  const busy = phase === "decomposing" || phase === "executing";
  const label =
    phase === "decomposing" ? "Decomposing…" :
    phase === "executing" ? "Running…" :
    "Execute";

  const submit = () => {
    const q = value.trim();
    if (!q || busy) return;
    onRun(q);
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Query</span>
        <span className="card-subtle">compose · decompose · dispatch · settle</span>
      </div>
      <div className="query-wrap">
        <div className="query-bar">
          <input
            className="query-input"
            placeholder="Ask SYNTH something — e.g. audit this code, analyze this contract, research this topic…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            disabled={busy}
          />
          <button className="query-btn" onClick={submit} disabled={busy || !value.trim()}>
            {label}
          </button>
        </div>
        <div className="scenarios">
          {SCENARIOS.map((s, i) => (
            <button
              key={i}
              className="scenario"
              onClick={() => { setValue(s); onRun(s); }}
              disabled={busy}
            >
              ▸ {s.length > 60 ? s.slice(0, 60) + "…" : s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

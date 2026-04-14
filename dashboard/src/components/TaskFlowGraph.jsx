import React from "react";
import { CAPABILITY_COLOR, CAPABILITY_ICON } from "../hooks/useTaskStream.js";

function layerize(subtasks) {
  const byId = Object.fromEntries(subtasks.map((s) => [s.subtask_id, s]));
  const resolved = new Set();
  const remaining = new Set(subtasks.map((s) => s.subtask_id));
  const layers = [];
  while (remaining.size > 0) {
    const layer = [...remaining].filter((id) =>
      byId[id].depends_on.every((d) => resolved.has(d)),
    );
    if (layer.length === 0) break;
    layers.push(layer.map((id) => byId[id]));
    layer.forEach((id) => {
      resolved.add(id);
      remaining.delete(id);
    });
  }
  return layers;
}

export default function TaskFlowGraph({ decomposition, activeSubtasks, completedSubtasks }) {
  if (!decomposition || !decomposition.subtasks?.length) {
    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title">Task Flow Graph</span>
          <span className="card-subtle">dependency DAG</span>
        </div>
        <div className="graph">
          <div className="graph-empty">
            waiting for query · decomposition will appear here
          </div>
        </div>
      </div>
    );
  }

  const layers = layerize(decomposition.subtasks);

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Task Flow Graph</span>
        <span className="card-subtle">{decomposition.subtasks.length} subtasks · {layers.length} layers</span>
      </div>
      <div className="graph">
        <div className="graph-inner">
          {layers.map((layer, li) => (
            <React.Fragment key={li}>
              <div className="graph-layer">
                {layer.map((s) => {
                  const state = completedSubtasks.has(s.subtask_id)
                    ? "completed"
                    : activeSubtasks.has(s.subtask_id)
                    ? "active"
                    : "pending";
                  const color = CAPABILITY_COLOR[s.required_capability] || "var(--cyan)";
                  return (
                    <div
                      key={s.subtask_id}
                      className="node"
                      data-state={state}
                      style={{ "--node-color": color }}
                    >
                      <div className="node-head">
                        <span>{CAPABILITY_ICON[s.required_capability]} {s.subtask_id}</span>
                        {state === "completed" && <span className="node-check">✓</span>}
                      </div>
                      <div className="node-title">{s.description}</div>
                    </div>
                  );
                })}
              </div>
              {li < layers.length - 1 && <div className="graph-layer-sep" />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

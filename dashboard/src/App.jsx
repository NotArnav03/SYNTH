import React from "react";
import QueryInput from "./components/QueryInput.jsx";
import AgentRegistry from "./components/AgentRegistry.jsx";
import TaskFlowGraph from "./components/TaskFlowGraph.jsx";
import PaymentStream from "./components/PaymentStream.jsx";
import CostSummary from "./components/CostSummary.jsx";
import { useTaskStream } from "./hooks/useTaskStream.js";

export default function App() {
  const {
    phase,
    decomposition,
    payments,
    result,
    agents,
    activeSubtasks,
    completedSubtasks,
    activeAgents,
    settledByAgent,
    runTask,
    isBusy,
  } = useTaskStream();

  const statusText =
    phase === "idle" ? "idle" :
    phase === "decomposing" ? "decomposing" :
    phase === "executing" ? "executing" :
    "complete";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">SYNTH</span>
          <span className="brand-tag">sub-cent yield network for transactional hierarchies</span>
        </div>
        <div className="topbar-meta">
          <span>Arc × Circle</span>
          <span className="topbar-chip">{statusText}</span>
        </div>
      </header>

      <main className="main">
        <div className="col">
          <AgentRegistry
            agents={agents}
            activeAgents={activeAgents}
            settledByAgent={settledByAgent}
          />
        </div>

        <div className="col">
          <QueryInput onRun={runTask} phase={phase} />
          <TaskFlowGraph
            decomposition={decomposition}
            activeSubtasks={activeSubtasks}
            completedSubtasks={completedSubtasks}
          />
          {result && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Final Result</span>
                <span className="card-subtle">synthesized output</span>
              </div>
              <div className="output">{result.final_result}</div>
            </div>
          )}
          <CostSummary result={result} paymentCount={payments.length} />
        </div>

        <div className="col">
          <PaymentStream payments={payments} isActive={isBusy} />
        </div>
      </main>
    </div>
  );
}

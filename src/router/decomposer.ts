// Claude-powered task decomposer.
// Returns a subtask DAG annotated with required capabilities and dependencies.

import Anthropic from "@anthropic-ai/sdk";
import {
  AgentCapability,
  Subtask,
  TaskDecomposition,
  shortId,
} from "../shared/types.js";
import { config } from "../shared/config.js";

const DECOMPOSITION_PROMPT = `You are a task decomposition engine for an AI agent marketplace called SYNTH.

Your job: take a user's natural language query and break it into a minimal dependency-aware graph of subtasks that can be paid-per-call to specialist agents.

Available capabilities:
- web_research: Search-the-web style research. Produces factual findings, sources, data points.
- document_analysis: Analyzes provided text/documents — extracts entities, key clauses, structural summaries.
- code_review: Reviews code for bugs, security issues, performance problems, style improvements.
- synthesis: Combines outputs from multiple upstream agents into a single coherent answer for the user.

Rules:
1. Use the MINIMUM number of subtasks needed. Do not invent work.
2. If the query needs only one capability, emit exactly ONE subtask and no synthesis step.
3. If two or more capabilities are invoked, the FINAL subtask must be synthesis and must depend on all upstream subtasks.
4. Each subtask must have exactly ONE required_capability from the list above.
5. Declare dependencies explicitly via subtask_id references in depends_on.
6. input_data must be the full, self-contained prompt that the specialist agent will receive.

Respond with ONLY valid JSON (no prose, no markdown fences). Shape:
{
  "subtasks": [
    {
      "subtask_id": "<short-id>",
      "description": "<short human description>",
      "required_capability": "<web_research|document_analysis|code_review|synthesis>",
      "input_data": "<prompt for the agent>",
      "depends_on": ["<subtask_id>", ...]
    }
  ],
  "execution_plan": "<one-paragraph human-readable explanation of the plan>"
}`;

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey || "unset" });

function stripFences(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return (m ? m[1] : trimmed).trim();
}

interface RawSubtask {
  subtask_id?: string;
  description: string;
  required_capability: string;
  input_data: string;
  depends_on?: string[];
}

interface RawDecomposition {
  subtasks: RawSubtask[];
  execution_plan?: string;
}

export async function decomposeTask(query: string): Promise<TaskDecomposition> {
  const msg = await anthropic.messages.create({
    model: config.decompositionModel,
    max_tokens: 1024,
    system: DECOMPOSITION_PROMPT,
    messages: [{ role: "user", content: query }],
  });

  const first = msg.content.find((c) => c.type === "text");
  const raw = stripFences(first && first.type === "text" ? first.text : "");

  let parsed: RawDecomposition;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Decomposer returned invalid JSON: ${(err as Error).message}. ` +
        `Raw output: ${raw.slice(0, 500)}`,
    );
  }

  const subtasks: Subtask[] = (parsed.subtasks ?? []).map((s) => {
    const cap = s.required_capability as AgentCapability;
    if (!Object.values(AgentCapability).includes(cap)) {
      throw new Error(`Unknown capability "${s.required_capability}" in subtask ${s.subtask_id}`);
    }
    return {
      subtaskId: s.subtask_id || shortId(),
      description: s.description,
      requiredCapability: cap,
      inputData: s.input_data,
      dependsOn: s.depends_on ?? [],
    };
  });

  // Validate dependency ids.
  const ids = new Set(subtasks.map((s) => s.subtaskId));
  for (const s of subtasks) {
    for (const dep of s.dependsOn) {
      if (!ids.has(dep)) {
        throw new Error(
          `Subtask ${s.subtaskId} depends on unknown subtask ${dep}`,
        );
      }
    }
  }

  return {
    originalQuery: query,
    subtasks,
    executionPlan: parsed.execution_plan ?? "",
  };
}

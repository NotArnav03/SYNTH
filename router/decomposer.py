"""Claude-powered task decomposition engine."""
from __future__ import annotations

import json
import re

from anthropic import Anthropic

from shared.config import ANTHROPIC_API_KEY, DECOMPOSITION_MODEL
from shared.models import AgentCapability, Subtask, TaskDecomposition

client = Anthropic(api_key=ANTHROPIC_API_KEY)

DECOMPOSITION_PROMPT = """You are a task decomposition engine for an AI agent marketplace called SYNTH.

Your job: take a user's natural language query and break it into a minimal dependency-aware graph of subtasks that can be auctioned to specialist agents.

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
5. Declare dependencies explicitly via subtask_id references in `depends_on`.
6. `input_data` must be the full, self-contained prompt that the specialist agent will receive.

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
}
"""


def _strip_fences(text: str) -> str:
    text = text.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    if fence:
        return fence.group(1).strip()
    return text


async def decompose_task(query: str) -> TaskDecomposition:
    """Decompose a natural-language query into a Subtask DAG using Claude."""
    response = client.messages.create(
        model=DECOMPOSITION_MODEL,
        max_tokens=1024,
        system=DECOMPOSITION_PROMPT,
        messages=[{"role": "user", "content": query}],
    )
    raw = response.content[0].text if response.content else ""
    raw = _strip_fences(raw)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"Decomposer returned invalid JSON: {e}. Raw output: {raw[:500]}"
        ) from e

    subtasks_data = data.get("subtasks", [])
    subtasks: list[Subtask] = []
    for item in subtasks_data:
        capability = AgentCapability(item["required_capability"])
        subtasks.append(
            Subtask(
                subtask_id=item.get("subtask_id") or Subtask().subtask_id,
                description=item["description"],
                required_capability=capability,
                input_data=item["input_data"],
                depends_on=item.get("depends_on", []),
            )
        )

    return TaskDecomposition(
        original_query=query,
        subtasks=subtasks,
        execution_plan=data.get("execution_plan", ""),
    )

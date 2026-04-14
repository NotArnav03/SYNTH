"""Tests for router.decomposer."""
from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from router import decomposer
from shared.models import AgentCapability, TaskDecomposition


def _fake_response(payload: dict) -> SimpleNamespace:
    return SimpleNamespace(content=[SimpleNamespace(text=json.dumps(payload))])


@pytest.mark.asyncio
async def test_single_capability_produces_one_subtask() -> None:
    payload = {
        "subtasks": [
            {
                "subtask_id": "t1",
                "description": "Review code",
                "required_capability": "code_review",
                "input_data": "def foo(): pass",
                "depends_on": [],
            }
        ],
        "execution_plan": "Single code review, no synthesis needed.",
    }
    with patch.object(
        decomposer.client.messages, "create", return_value=_fake_response(payload)
    ):
        out = await decomposer.decompose_task("Review this code: def foo(): pass")

    assert isinstance(out, TaskDecomposition)
    assert len(out.subtasks) == 1
    assert out.subtasks[0].required_capability == AgentCapability.CODE_REVIEW


@pytest.mark.asyncio
async def test_multi_capability_with_synthesis() -> None:
    payload = {
        "subtasks": [
            {
                "subtask_id": "t1",
                "description": "Research X",
                "required_capability": "web_research",
                "input_data": "What is X?",
                "depends_on": [],
            },
            {
                "subtask_id": "t2",
                "description": "Analyze Y",
                "required_capability": "document_analysis",
                "input_data": "Analyze Y",
                "depends_on": [],
            },
            {
                "subtask_id": "t3",
                "description": "Combine",
                "required_capability": "synthesis",
                "input_data": "Combine upstream",
                "depends_on": ["t1", "t2"],
            },
        ],
        "execution_plan": "Parallel research + analysis, synthesize at the end.",
    }
    with patch.object(
        decomposer.client.messages, "create", return_value=_fake_response(payload)
    ):
        out = await decomposer.decompose_task("Research X and analyze Y")

    assert len(out.subtasks) == 3
    ids = {s.subtask_id for s in out.subtasks}
    for s in out.subtasks:
        for dep in s.depends_on:
            assert dep in ids
    assert out.subtasks[-1].required_capability == AgentCapability.SYNTHESIS
    for s in out.subtasks:
        assert isinstance(s.required_capability, AgentCapability)


@pytest.mark.asyncio
async def test_strips_markdown_fences() -> None:
    payload = {
        "subtasks": [
            {
                "subtask_id": "t1",
                "description": "r",
                "required_capability": "web_research",
                "input_data": "x",
                "depends_on": [],
            }
        ],
        "execution_plan": "plan",
    }
    fenced = f"```json\n{json.dumps(payload)}\n```"
    with patch.object(
        decomposer.client.messages,
        "create",
        return_value=SimpleNamespace(content=[SimpleNamespace(text=fenced)]),
    ):
        out = await decomposer.decompose_task("query")
    assert len(out.subtasks) == 1


@pytest.mark.asyncio
async def test_invalid_json_raises() -> None:
    with patch.object(
        decomposer.client.messages,
        "create",
        return_value=SimpleNamespace(content=[SimpleNamespace(text="not json {")]),
    ):
        with pytest.raises(RuntimeError, match="invalid JSON"):
            await decomposer.decompose_task("query")

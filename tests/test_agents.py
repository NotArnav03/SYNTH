"""Integration tests for specialist agents."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from agents.code_review.main import agent as code_review_agent
from agents.doc_analysis.main import agent as doc_analysis_agent
from agents.synthesis.main import agent as synthesis_agent
from agents.web_research.main import agent as web_research_agent

AGENTS = [
    web_research_agent,
    doc_analysis_agent,
    code_review_agent,
    synthesis_agent,
]


def _fake_claude(text: str):
    return SimpleNamespace(content=[SimpleNamespace(text=text)])


@pytest.mark.asyncio
@pytest.mark.parametrize("agent", AGENTS, ids=lambda a: a.name)
async def test_agent_process_returns_string(agent) -> None:
    with patch.object(
        agent.client.messages, "create", return_value=_fake_claude("OK")
    ):
        out = await agent.process("hello", {})
    assert isinstance(out, str)
    assert out == "OK"


@pytest.mark.parametrize("agent", AGENTS, ids=lambda a: a.name)
def test_agent_health_endpoint(agent) -> None:
    client = TestClient(agent.app)
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "healthy"
    assert body["agent"] == agent.name


def test_agent_invoke_endpoint() -> None:
    agent = web_research_agent
    with patch.object(
        agent.client.messages,
        "create",
        return_value=_fake_claude("research findings"),
    ):
        client = TestClient(agent.app)
        r = client.post(
            "/invoke",
            json={
                "invocation_id": "inv1",
                "input_data": "hello",
                "context": {},
            },
        )
    assert r.status_code == 200
    body = r.json()
    assert body["invocation_id"] == "inv1"
    assert body["output_data"] == "research findings"

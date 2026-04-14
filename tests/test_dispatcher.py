"""Tests for router.dispatcher."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from router import dispatcher
from router.dispatcher import AgentRegistry, _topological_layers
from shared.models import (
    AgentCapability,
    AgentInvocation,
    AgentRegistration,
    Subtask,
)


def _mk_agent(name: str, cap: AgentCapability, price: float, latency: int = 500):
    return AgentRegistration(
        name=name,
        capability=cap,
        description=name,
        price_usd=price,
        endpoint=f"http://localhost:9999/{name}",
        wallet_address=f"arc:0x{name.ljust(40, '0')}",
        avg_latency_ms=latency,
    )


def test_register_and_list() -> None:
    reg = AgentRegistry()
    a = _mk_agent("A", AgentCapability.WEB_RESEARCH, 0.003)
    reg.register(a)
    assert reg.list_all() == [a]


def test_select_best_cheapest() -> None:
    reg = AgentRegistry()
    a = _mk_agent("A", AgentCapability.CODE_REVIEW, 0.01)
    b = _mk_agent("B", AgentCapability.CODE_REVIEW, 0.005)
    c = _mk_agent("C", AgentCapability.CODE_REVIEW, 0.005, latency=100)
    reg.register(a)
    reg.register(b)
    reg.register(c)
    best = reg.select_best(AgentCapability.CODE_REVIEW)
    assert best is not None
    assert best.name == "C"


def test_select_best_none_when_no_match() -> None:
    reg = AgentRegistry()
    reg.register(_mk_agent("A", AgentCapability.WEB_RESEARCH, 0.003))
    assert reg.select_best(AgentCapability.SYNTHESIS) is None


def test_topological_layers_dependency_order() -> None:
    t1 = Subtask(
        subtask_id="t1",
        description="d",
        required_capability=AgentCapability.WEB_RESEARCH,
        input_data="x",
    )
    t2 = Subtask(
        subtask_id="t2",
        description="d",
        required_capability=AgentCapability.DOCUMENT_ANALYSIS,
        input_data="x",
    )
    t3 = Subtask(
        subtask_id="t3",
        description="d",
        required_capability=AgentCapability.SYNTHESIS,
        input_data="x",
        depends_on=["t1", "t2"],
    )
    layers = _topological_layers([t1, t2, t3])
    assert len(layers) == 2
    layer0_ids = {s.subtask_id for s in layers[0]}
    assert layer0_ids == {"t1", "t2"}
    assert [s.subtask_id for s in layers[1]] == ["t3"]


def test_topological_layers_detects_cycles() -> None:
    t1 = Subtask(
        subtask_id="t1",
        description="d",
        required_capability=AgentCapability.WEB_RESEARCH,
        input_data="x",
        depends_on=["t2"],
    )
    t2 = Subtask(
        subtask_id="t2",
        description="d",
        required_capability=AgentCapability.SYNTHESIS,
        input_data="x",
        depends_on=["t1"],
    )
    with pytest.raises(RuntimeError, match="Circular"):
        _topological_layers([t1, t2])


@pytest.mark.asyncio
async def test_dispatch_respects_dependencies() -> None:
    reg = dispatcher.registry
    reg._agents.clear()
    reg.register(_mk_agent("WR", AgentCapability.WEB_RESEARCH, 0.003))
    reg.register(_mk_agent("DA", AgentCapability.DOCUMENT_ANALYSIS, 0.005))
    reg.register(_mk_agent("SY", AgentCapability.SYNTHESIS, 0.002))

    order: list[str] = []

    async def fake_invoke(agent, subtask, context):
        order.append(subtask.subtask_id)
        inv = AgentInvocation(
            subtask_id=subtask.subtask_id,
            agent_id=agent.agent_id,
            agent_name=agent.name,
            capability=agent.capability,
            input_data=subtask.input_data,
            price_usd=agent.price_usd,
            status="completed",
            output_data=f"out-{subtask.subtask_id}",
        )
        return inv, inv.output_data

    async def fake_settle(*args, **kwargs):
        from datetime import datetime, timezone
        from shared.models import PaymentRecord
        return PaymentRecord(
            tx_hash="0x" + "a" * 64,
            from_wallet=kwargs.get("from_wallet", "a"),
            to_wallet=kwargs.get("to_wallet", "b"),
            amount_usd=kwargs.get("amount_usd", 0.0),
            agent_id=kwargs.get("agent_id", "x"),
            invocation_id=kwargs.get("invocation_id", "y"),
            settled_at=datetime.now(timezone.utc),
        )

    t1 = Subtask(
        subtask_id="t1",
        description="d",
        required_capability=AgentCapability.WEB_RESEARCH,
        input_data="x",
    )
    t2 = Subtask(
        subtask_id="t2",
        description="d",
        required_capability=AgentCapability.DOCUMENT_ANALYSIS,
        input_data="x",
    )
    t3 = Subtask(
        subtask_id="t3",
        description="d",
        required_capability=AgentCapability.SYNTHESIS,
        input_data="x",
        depends_on=["t1", "t2"],
    )

    with patch.object(dispatcher, "invoke_agent", side_effect=fake_invoke), \
         patch.object(dispatcher, "settle_agent_payment", side_effect=fake_settle):
        invocations, payments = await dispatcher.dispatch_subtasks(
            [t1, t2, t3], "user-wallet"
        )

    assert order.index("t3") > order.index("t1")
    assert order.index("t3") > order.index("t2")
    assert len(invocations) == 3
    assert len(payments) == 3

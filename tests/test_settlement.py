"""Tests for router.settlement."""
from __future__ import annotations

import pytest

from router.settlement import (
    NanopaymentClient,
    collect_router_margin,
    settle_agent_payment,
)
from shared.models import PaymentRecord


@pytest.mark.asyncio
async def test_settle_agent_payment_returns_valid_record() -> None:
    record = await settle_agent_payment(
        from_wallet="arc:0xrouter",
        to_wallet="arc:0xagent",
        amount_usd=0.003,
        agent_id="a1",
        invocation_id="i1",
    )
    assert isinstance(record, PaymentRecord)
    assert record.tx_hash.startswith("0x")
    assert len(record.tx_hash) == 66
    assert record.amount_usd == 0.003
    assert record.from_wallet == "arc:0xrouter"
    assert record.to_wallet == "arc:0xagent"
    assert record.agent_id == "a1"
    assert record.invocation_id == "i1"
    assert record.chain == "arc"
    assert record.currency == "USDC"
    assert record.settled_at is not None


@pytest.mark.asyncio
async def test_collect_router_margin_math() -> None:
    record = await collect_router_margin(
        user_wallet="arc:0xuser",
        total_agent_cost=0.020,
        margin_percent=0.10,
    )
    assert record.amount_usd == pytest.approx(0.002, rel=1e-6)
    assert record.from_wallet == "arc:0xuser"
    assert record.agent_id == "router"
    assert record.invocation_id == "margin"


@pytest.mark.asyncio
async def test_nanopayment_client_creates_wallet_and_transfers() -> None:
    client = NanopaymentClient(api_key="test")
    w1 = await client.create_wallet("alice")
    w2 = await client.create_wallet("bob")
    assert w1.startswith("arc:0x")
    assert w2.startswith("arc:0x")
    assert w1 != w2

    balance = await client.get_balance(w1)
    assert balance > 0

    tx = await client.transfer(w1, w2, 0.5)
    assert tx.startswith("0x")
    assert len(tx) == 66

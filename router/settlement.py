"""Circle Nanopayments settlement layer.

Mock implementation — real Circle SDK calls slot into the same method signatures.
Swap in the real client by replacing method bodies only; the interface is stable.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone

from shared.config import ARC_RPC_URL, CIRCLE_API_KEY, ROUTER_MARGIN_PERCENT
from shared.models import PaymentRecord


def _short_wallet(addr: str, n: int = 6) -> str:
    if len(addr) <= 2 * n + 3:
        return addr
    return f"{addr[:n]}…{addr[-n:]}"


class NanopaymentClient:
    """Thin wrapper over Circle Nanopayments. Mocked for local dev."""

    def __init__(self, api_key: str, chain: str = "arc") -> None:
        self.api_key = api_key
        self.chain = chain
        self._balances: dict[str, float] = {}

    async def create_wallet(self, label: str) -> str:
        # TODO: Replace with real Circle Nanopayments SDK call
        # e.g. wallet = await circle.wallets.create(chain="arc", label=label)
        #      return wallet.address
        addr = f"arc:0x{secrets.token_hex(20)}"
        self._balances[addr] = 1_000.0
        print(f"[settlement] created wallet '{label}' -> {_short_wallet(addr)}")
        return addr

    async def get_balance(self, wallet_address: str) -> float:
        # TODO: Replace with real Circle Nanopayments SDK call
        # e.g. return await circle.balances.get(wallet_address, currency="USDC")
        return self._balances.get(wallet_address, 1_000.0)

    async def transfer(
        self, from_wallet: str, to_wallet: str, amount_usd: float
    ) -> str:
        # TODO: Replace with real Circle Nanopayments SDK call
        # e.g. tx = await circle.nanopayments.transfer(
        #          from_wallet=from_wallet,
        #          to_wallet=to_wallet,
        #          amount=amount_usd,
        #          currency="USDC",
        #          chain=self.chain,
        #      )
        #      return tx.hash
        tx_hash = f"0x{secrets.token_hex(32)}"
        self._balances[from_wallet] = (
            self._balances.get(from_wallet, 1_000.0) - amount_usd
        )
        self._balances[to_wallet] = (
            self._balances.get(to_wallet, 0.0) + amount_usd
        )
        print(
            f"[settlement] ${amount_usd:.4f} USDC  "
            f"{_short_wallet(from_wallet)} -> {_short_wallet(to_wallet)}  "
            f"tx={tx_hash[:18]}…"
        )
        return tx_hash


_client = NanopaymentClient(api_key=CIRCLE_API_KEY, chain="arc")


async def settle_agent_payment(
    from_wallet: str,
    to_wallet: str,
    amount_usd: float,
    agent_id: str,
    invocation_id: str,
) -> PaymentRecord:
    """Settle a single agent invocation payment on Arc in USDC."""
    tx_hash = await _client.transfer(from_wallet, to_wallet, amount_usd)
    return PaymentRecord(
        tx_hash=tx_hash,
        from_wallet=from_wallet,
        to_wallet=to_wallet,
        amount_usd=amount_usd,
        agent_id=agent_id,
        invocation_id=invocation_id,
        settled_at=datetime.now(timezone.utc),
    )


async def collect_router_margin(
    user_wallet: str,
    total_agent_cost: float,
    margin_percent: float = ROUTER_MARGIN_PERCENT,
) -> PaymentRecord:
    """Collect the router's margin from the user's wallet."""
    from shared.config import ROUTER_WALLET

    margin = round(total_agent_cost * margin_percent, 6)
    tx_hash = await _client.transfer(user_wallet, ROUTER_WALLET, margin)
    return PaymentRecord(
        tx_hash=tx_hash,
        from_wallet=user_wallet,
        to_wallet=ROUTER_WALLET,
        amount_usd=margin,
        agent_id="router",
        invocation_id="margin",
        settled_at=datetime.now(timezone.utc),
    )


__all__ = [
    "NanopaymentClient",
    "settle_agent_payment",
    "collect_router_margin",
    "ARC_RPC_URL",
]

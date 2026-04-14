"""One-time setup: create Arc USDC wallets for the router and each agent.

In production this would call the real Circle SDK; for now it uses the mock
NanopaymentClient and prints the addresses so you can paste them into .env.
"""
from __future__ import annotations

import asyncio

from router.settlement import NanopaymentClient
from shared.config import CIRCLE_API_KEY


async def main() -> None:
    client = NanopaymentClient(api_key=CIRCLE_API_KEY)
    labels = ["router", "web_research", "doc_analysis", "code_review", "synthesis"]
    print("Creating Arc USDC wallets...\n")
    for label in labels:
        address = await client.create_wallet(label)
        print(f"  {label:<14} -> {address}")
    print("\nPaste the router address into .env as ROUTER_WALLET.")


if __name__ == "__main__":
    asyncio.run(main())

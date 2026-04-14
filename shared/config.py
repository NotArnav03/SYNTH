"""Environment configuration and constants for SYNTH."""
from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
CIRCLE_API_KEY: str = os.getenv("CIRCLE_API_KEY", "")
ARC_RPC_URL: str = os.getenv("ARC_RPC_URL", "https://rpc.arc.network")
ROUTER_WALLET: str = os.getenv("ROUTER_WALLET", "arc:0xROUTER_DEFAULT_WALLET")
ROUTER_HOST: str = os.getenv("ROUTER_HOST", "0.0.0.0")
ROUTER_PORT: int = int(os.getenv("ROUTER_PORT", "8000"))

ROUTER_MARGIN_PERCENT: float = 0.10
DECOMPOSITION_MODEL: str = "claude-sonnet-4-20250514"

AGENT_PORTS: dict[str, int] = {
    "web_research": 8001,
    "doc_analysis": 8002,
    "code_review": 8003,
    "synthesis": 8004,
}

"""Synthesis specialist agent."""
from __future__ import annotations

from anthropic import Anthropic

from agents.base import BaseAgent, default_wallet
from shared.config import ANTHROPIC_API_KEY, AGENT_PORTS, DECOMPOSITION_MODEL
from shared.models import AgentCapability

SYSTEM_PROMPT = (
    "You are a synthesis agent for the SYNTH protocol. You receive outputs "
    "from multiple specialist agents and must combine them into a single, "
    "coherent, well-structured response for the end user. Remove redundancy, "
    "resolve conflicts between sources, and present a unified answer. Be "
    "concise."
)


class SynthesisAgent(BaseAgent):
    def __init__(self) -> None:
        super().__init__(
            name="Synthesis",
            capability=AgentCapability.SYNTHESIS,
            description="Combines upstream agent outputs into one coherent answer.",
            price_usd=0.002,
            port=AGENT_PORTS["synthesis"],
            wallet_address=default_wallet("synthesis"),
        )
        self.client = Anthropic(api_key=ANTHROPIC_API_KEY)

    async def process(self, input_data: str, context: dict) -> str:
        blocks = []
        for k, v in (context or {}).items():
            blocks.append(f"--- upstream:{k} ---\n{v}")
        upstream = "\n\n".join(blocks)
        user_text = (
            f"Original instruction:\n{input_data}\n\n"
            f"Upstream agent outputs to synthesize:\n{upstream}"
            if upstream
            else input_data
        )
        response = self.client.messages.create(
            model=DECOMPOSITION_MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_text}],
        )
        return response.content[0].text if response.content else ""


agent = SynthesisAgent()

if __name__ == "__main__":
    agent.run()

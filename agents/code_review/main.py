"""CodeReview specialist agent."""
from __future__ import annotations

from anthropic import Anthropic

from agents.base import BaseAgent, default_wallet
from shared.config import ANTHROPIC_API_KEY, AGENT_PORTS, DECOMPOSITION_MODEL
from shared.models import AgentCapability

SYSTEM_PROMPT = (
    "You are a code review agent for the SYNTH protocol. Analyze the provided "
    "code and identify: 1) Bugs or logical errors, 2) Security "
    "vulnerabilities, 3) Performance issues, 4) Style and readability "
    "improvements. Be specific with line references and provide fixed code "
    "snippets."
)


class CodeReviewAgent(BaseAgent):
    def __init__(self) -> None:
        super().__init__(
            name="CodeReview",
            capability=AgentCapability.CODE_REVIEW,
            description="Reviews code for bugs, vulnerabilities, performance, and style.",
            price_usd=0.004,
            port=AGENT_PORTS["code_review"],
            wallet_address=default_wallet("code_review"),
        )
        self.client = Anthropic(api_key=ANTHROPIC_API_KEY)

    async def process(self, input_data: str, context: dict) -> str:
        upstream = "\n\n".join(
            f"[context:{k}]\n{v}" for k, v in (context or {}).items()
        )
        user_text = f"{input_data}\n\n{upstream}" if upstream else input_data
        response = self.client.messages.create(
            model=DECOMPOSITION_MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_text}],
        )
        return response.content[0].text if response.content else ""


agent = CodeReviewAgent()

if __name__ == "__main__":
    agent.run()

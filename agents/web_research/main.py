"""WebResearch specialist agent."""
from __future__ import annotations

from anthropic import Anthropic

from agents.base import BaseAgent, default_wallet
from shared.config import ANTHROPIC_API_KEY, AGENT_PORTS, DECOMPOSITION_MODEL
from shared.models import AgentCapability

SYSTEM_PROMPT = (
    "You are a web research agent for the SYNTH protocol. Given a research "
    "query, provide well-structured findings as if you had searched the web. "
    "Include specific data points, sources, and key takeaways. Be concise and "
    "factual."
)


class WebResearchAgent(BaseAgent):
    def __init__(self) -> None:
        super().__init__(
            name="WebResearch",
            capability=AgentCapability.WEB_RESEARCH,
            description="Searches the web and returns structured findings.",
            price_usd=0.003,
            port=AGENT_PORTS["web_research"],
            wallet_address=default_wallet("web_research"),
        )
        self.client = Anthropic(api_key=ANTHROPIC_API_KEY)

    async def process(self, input_data: str, context: dict) -> str:
        # NOTE: Production would hit Tavily/Serper/Brave. Claude simulates here.
        response = self.client.messages.create(
            model=DECOMPOSITION_MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": input_data}],
        )
        return response.content[0].text if response.content else ""


agent = WebResearchAgent()

if __name__ == "__main__":
    agent.run()

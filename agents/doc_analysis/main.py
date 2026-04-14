"""DocAnalysis specialist agent."""
from __future__ import annotations

from anthropic import Anthropic

from agents.base import BaseAgent, default_wallet
from shared.config import ANTHROPIC_API_KEY, AGENT_PORTS, DECOMPOSITION_MODEL
from shared.models import AgentCapability

SYSTEM_PROMPT = (
    "You are a document analysis agent for the SYNTH protocol. Analyze the "
    "provided text and extract key entities, structural elements, important "
    "clauses or points, and provide a structured summary. Use clear "
    "organization for readability."
)


class DocAnalysisAgent(BaseAgent):
    def __init__(self) -> None:
        super().__init__(
            name="DocAnalysis",
            capability=AgentCapability.DOCUMENT_ANALYSIS,
            description="Extracts entities, clauses, and structured summaries from text.",
            price_usd=0.005,
            port=AGENT_PORTS["doc_analysis"],
            wallet_address=default_wallet("doc_analysis"),
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


agent = DocAnalysisAgent()

if __name__ == "__main__":
    agent.run()

import { BaseAgent } from "./base-agent.js";
import { AgentCapability } from "../shared/types.js";
import { config } from "../shared/config.js";

const SYSTEM_PROMPT = `You are a web research agent for the SYNTH protocol. Given a research query, provide well-structured findings as if you had searched the web. Include specific data points, sources (plausible ones), and key takeaways. Be concise and factual. Respond in markdown.`;

export class WebResearchAgent extends BaseAgent {
  constructor() {
    super(
      "WebResearch",
      AgentCapability.WEB_RESEARCH,
      "Searches the web and returns structured findings.",
      0.003,
      config.agentPorts.web_research,
      config.agentWallets.web_research,
    );
  }

  async process(inputData: string, _context: Record<string, string>): Promise<string> {
    // NOTE: Production would call a real search API (Tavily/Serper/Brave).
    // For the hackathon we let Claude simulate the research.
    return this.claude(SYSTEM_PROMPT, inputData);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("web-research.ts")) {
  new WebResearchAgent().start().catch((e) => {
    console.error("[WebResearch] failed to start:", e);
    process.exit(1);
  });
}

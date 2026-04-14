import { BaseAgent } from "./base-agent.js";
import { AgentCapability } from "../shared/types.js";
import { config } from "../shared/config.js";

const SYSTEM_PROMPT = `You are a synthesis agent for the SYNTH protocol. You receive outputs from multiple specialist agents and must combine them into a single, coherent, well-structured response for the end user. Remove redundancy, resolve conflicts between sources, and present a unified answer. Be concise and use markdown.`;

function weaveContext(inputData: string, context: Record<string, string>): string {
  const blocks = Object.entries(context).map(
    ([k, v]) => `--- upstream output (${k}) ---\n${v}`,
  );
  if (blocks.length === 0) return inputData;
  return `Original instruction:\n${inputData}\n\nUpstream agent outputs to synthesize:\n${blocks.join("\n\n")}`;
}

export class SynthesisAgent extends BaseAgent {
  constructor() {
    super(
      "Synthesis",
      AgentCapability.SYNTHESIS,
      "Combines upstream agent outputs into one coherent answer.",
      0.002,
      config.agentPorts.synthesis,
      config.agentWallets.synthesis,
    );
  }

  async process(inputData: string, context: Record<string, string>): Promise<string> {
    return this.claude(SYSTEM_PROMPT, weaveContext(inputData, context));
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("synthesis.ts")) {
  new SynthesisAgent().start().catch((e) => {
    console.error("[Synthesis] failed to start:", e);
    process.exit(1);
  });
}

import { BaseAgent } from "./base-agent.js";
import { AgentCapability } from "../shared/types.js";
import { config } from "../shared/config.js";

const SYSTEM_PROMPT = `You are a document analysis agent for the SYNTH protocol. Analyze the provided text and extract key entities, structural elements, important clauses or points, and provide a structured summary. Use clear markdown organization for readability.`;

function weaveContext(inputData: string, context: Record<string, string>): string {
  const blocks = Object.entries(context).map(
    ([k, v]) => `<upstream:${k}>\n${v}\n</upstream:${k}>`,
  );
  return blocks.length === 0 ? inputData : `${inputData}\n\n${blocks.join("\n\n")}`;
}

export class DocAnalysisAgent extends BaseAgent {
  constructor() {
    super(
      "DocAnalysis",
      AgentCapability.DOCUMENT_ANALYSIS,
      "Extracts entities, clauses, and structured summaries from text.",
      0.005,
      config.agentPorts.doc_analysis,
      config.agentWallets.doc_analysis,
    );
  }

  async process(inputData: string, context: Record<string, string>): Promise<string> {
    return this.claude(SYSTEM_PROMPT, weaveContext(inputData, context));
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("doc-analysis.ts")) {
  new DocAnalysisAgent().start().catch((e) => {
    console.error("[DocAnalysis] failed to start:", e);
    process.exit(1);
  });
}

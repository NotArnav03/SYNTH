import { BaseAgent } from "./base-agent.js";
import { AgentCapability } from "../shared/types.js";
import { config } from "../shared/config.js";

const SYSTEM_PROMPT = `You are a code review agent for the SYNTH protocol. Analyze the provided code and identify: 1) Bugs or logical errors, 2) Security vulnerabilities, 3) Performance issues, 4) Style and readability improvements. Be specific with line references and provide fixed code snippets in markdown.`;

function weaveContext(inputData: string, context: Record<string, string>): string {
  const blocks = Object.entries(context).map(
    ([k, v]) => `<upstream:${k}>\n${v}\n</upstream:${k}>`,
  );
  return blocks.length === 0 ? inputData : `${inputData}\n\n${blocks.join("\n\n")}`;
}

export class CodeReviewAgent extends BaseAgent {
  constructor() {
    super(
      "CodeReview",
      AgentCapability.CODE_REVIEW,
      "Reviews code for bugs, vulnerabilities, performance, and style.",
      0.004,
      config.agentPorts.code_review,
      config.agentWallets.code_review,
    );
  }

  async process(inputData: string, context: Record<string, string>): Promise<string> {
    return this.claude(SYSTEM_PROMPT, weaveContext(inputData, context));
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("code-review.ts")) {
  new CodeReviewAgent().start().catch((e) => {
    console.error("[CodeReview] failed to start:", e);
    process.exit(1);
  });
}

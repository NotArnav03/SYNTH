import dotenv from "dotenv";
dotenv.config();

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    // We intentionally do not throw at import time — many commands (tests,
    // dashboards) only need a subset of env vars. Runtime code that needs a
    // value calls `requireEnv(name)` below and throws there.
    return "";
  }
  return v;
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required env var: ${name}. See .env.example for the full list.`,
    );
  }
  return v;
}

export const config = {
  // Claude API
  anthropicApiKey: req("ANTHROPIC_API_KEY"),
  decompositionModel: "claude-sonnet-4-20250514",

  // Circle
  circleApiKey: req("CIRCLE_API_KEY"),
  circleWalletSetId: req("CIRCLE_WALLET_SET_ID"),

  // x402
  facilitatorUrl: req("FACILITATOR_URL", "https://x402.org/facilitator"),
  // x402 v1.1 supports: base-sepolia, base, avalanche-fuji, avalanche,
  // polygon, polygon-amoy, abstract, abstract-testnet, sei, sei-testnet,
  // iotex, story, educhain, solana, solana-devnet, peaq, skale-base-sepolia.
  // Arc testnet support is pending in x402 SDKs; default to base-sepolia.
  x402Network: req("X402_NETWORK", "base-sepolia"),

  // Router wallet (EOA used for signing x402 payments)
  routerPrivateKey: req("ROUTER_PRIVATE_KEY"),
  routerWalletAddress: req("ROUTER_WALLET_ADDRESS"),

  // Router
  routerPort: parseInt(req("ROUTER_PORT", "3000"), 10),
  routerUrl: req("ROUTER_URL", "http://localhost:3000"),
  routerMarginPercent: 0.10,

  // Agent wallet addresses
  agentWallets: {
    web_research: req("AGENT_WALLET_WEB_RESEARCH"),
    doc_analysis: req("AGENT_WALLET_DOC_ANALYSIS"),
    code_review: req("AGENT_WALLET_CODE_REVIEW"),
    synthesis: req("AGENT_WALLET_SYNTHESIS"),
  } as const,

  agentPorts: {
    web_research: 3001,
    doc_analysis: 3002,
    code_review: 3003,
    synthesis: 3004,
  } as const,
} as const;

export type AgentKey = keyof typeof config.agentPorts;

// Single source of truth for all SYNTH types.

export enum AgentCapability {
  WEB_RESEARCH = "web_research",
  DOCUMENT_ANALYSIS = "document_analysis",
  CODE_REVIEW = "code_review",
  SYNTHESIS = "synthesis",
}

export interface AgentRegistration {
  agentId: string;
  name: string;
  capability: AgentCapability;
  description: string;
  priceUsd: number;
  endpoint: string;
  walletAddress: string;
  port: number;
}

export interface Subtask {
  subtaskId: string;
  description: string;
  requiredCapability: AgentCapability;
  inputData: string;
  dependsOn: string[];
}

export interface TaskDecomposition {
  originalQuery: string;
  subtasks: Subtask[];
  executionPlan: string;
}

export interface AgentInvocation {
  invocationId: string;
  subtaskId: string;
  agentId: string;
  agentName: string;
  capability: AgentCapability;
  inputData: string;
  outputData?: string;
  priceUsd: number;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  paymentTxHash?: string;
  x402PaymentResponse?: unknown;
}

export interface PaymentRecord {
  txHash: string;
  fromWallet: string;
  toWallet: string;
  amountUsd: number;
  agentId: string;
  invocationId: string;
  settledAt: string;
  chain: string;
  currency: "USDC";
  x402Scheme: "exact";
}

export interface TaskResult {
  taskId: string;
  originalQuery: string;
  decomposition: TaskDecomposition;
  invocations: AgentInvocation[];
  payments: PaymentRecord[];
  finalResult: string;
  totalCostUsd: number;
  routerMarginUsd: number;
  userChargedUsd: number;
  totalLatencyMs: number;
  onchainTxCount: number;
}

export interface AgentRequest {
  invocationId: string;
  inputData: string;
  context?: Record<string, string>;
}

export interface AgentResponse {
  invocationId: string;
  outputData: string;
  confidence?: number;
}

export type StreamEvent =
  | { type: "decomposition"; data: TaskDecomposition }
  | { type: "invocation"; data: AgentInvocation }
  | { type: "payment"; data: PaymentRecord }
  | { type: "complete"; data: TaskResult };

export function shortId(): string {
  // Browser and recent Node both have crypto.randomUUID
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rnd: () => string = (globalThis as any).crypto?.randomUUID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? () => (globalThis as any).crypto.randomUUID()
    : () => Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
  return rnd().replace(/-/g, "").slice(0, 8);
}

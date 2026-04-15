// Mirrors the subset of shared types the dashboard needs.
// Kept local so the dashboard has no build-time dep on the router.

export type AgentCapability =
  | "web_research"
  | "document_analysis"
  | "code_review"
  | "synthesis";

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

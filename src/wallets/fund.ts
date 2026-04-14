// Prints faucet URLs and current USDC balances for every SYNTH wallet.
// On base-sepolia we use the Circle USDC testnet faucet; on arc-testnet we'll
// use the Arc faucet when x402 adds support. No on-chain writes happen here.

import { createPublicClient, http, formatUnits, Address } from "viem";
import { baseSepolia } from "viem/chains";
import { config } from "../shared/config.js";

// USDC (base-sepolia): official Circle testnet contract.
const USDC_BY_NETWORK: Record<string, Address> = {
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

const FAUCETS: Record<string, string[]> = {
  "base-sepolia": [
    "https://faucet.circle.com/  (select Base Sepolia, paste the address, request USDC)",
    "https://www.alchemy.com/faucets/base-sepolia  (for ETH gas if you ever need it)",
  ],
  "arc-testnet": [
    "https://faucet.arc.com/  (pending x402 SDK support)",
  ],
};

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function balance(client: any, token: Address, owner: Address): Promise<string> {
  try {
    const raw = (await client.readContract({
      address: token,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [owner],
    })) as bigint;
    return formatUnits(raw, 6);
  } catch (err) {
    return `? (${(err as Error).message.slice(0, 60)})`;
  }
}

async function main() {
  const network = config.x402Network;
  const faucets = FAUCETS[network] ?? [
    `No canned faucet list for ${network}; check the chain's docs.`,
  ];

  const wallets: { label: string; address: string | undefined }[] = [
    { label: "Router", address: config.routerWalletAddress },
    { label: "WebResearch", address: config.agentWallets.web_research },
    { label: "DocAnalysis", address: config.agentWallets.doc_analysis },
    { label: "CodeReview", address: config.agentWallets.code_review },
    { label: "Synthesis", address: config.agentWallets.synthesis },
  ];

  console.log(`\n[fund] network: ${network}`);
  console.log(`[fund] faucets:`);
  for (const f of faucets) console.log(`  - ${f}`);
  console.log("");

  const token = USDC_BY_NETWORK[network];
  if (!token) {
    console.log(`[fund] No USDC address mapped for ${network}; skipping balance check.`);
    for (const w of wallets) console.log(`  ${w.label.padEnd(14)} ${w.address ?? "<unset>"}`);
    return;
  }

  // Balance check is best-effort and only configured for base-sepolia.
  const client = createPublicClient({ chain: baseSepolia, transport: http() });
  console.log(`[fund] USDC (${token}) balances:`);
  for (const w of wallets) {
    if (!w.address) {
      console.log(`  ${w.label.padEnd(14)} <unset — run setup:wallets first>`);
      continue;
    }
    const bal = await balance(client, token, w.address as Address);
    console.log(`  ${w.label.padEnd(14)} ${w.address}  ${bal} USDC`);
  }

  console.log("");
  console.log("[fund] fund the Router address with ~10 USDC for the demo.");
  console.log("[fund] agent wallets do not need pre-funding — they RECEIVE payments.");
}

main().catch((e) => {
  console.error("[fund] failed:", e);
  process.exit(1);
});

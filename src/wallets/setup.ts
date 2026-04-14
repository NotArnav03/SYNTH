// Generates 5 EOAs (router + 4 agents) and prints .env lines for copy/paste.
// We use viem-generated private keys because x402 EIP-3009 signing requires a
// raw EOA key. Circle Developer-Controlled Wallets would be the production
// choice, but they don't expose raw keys to the client; a hackathon demo needs
// signing happening in-process, so we stick with local EOAs here.

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

interface Wallet {
  label: string;
  envPrefix: string;
  privateKey: `0x${string}`;
  address: `0x${string}`;
}

function mint(label: string, envPrefix: string): Wallet {
  const pk = generatePrivateKey();
  const addr = privateKeyToAccount(pk).address;
  return { label, envPrefix, privateKey: pk, address: addr };
}

function main() {
  const wallets: Wallet[] = [
    mint("Router", "ROUTER"),
    mint("WebResearch", "AGENT_WALLET_WEB_RESEARCH"),
    mint("DocAnalysis", "AGENT_WALLET_DOC_ANALYSIS"),
    mint("CodeReview", "AGENT_WALLET_CODE_REVIEW"),
    mint("Synthesis", "AGENT_WALLET_SYNTHESIS"),
  ];

  console.log("\n# ---------- SYNTH wallet setup ----------");
  console.log("# Copy the block below into your .env file.\n");

  for (const w of wallets) {
    if (w.envPrefix === "ROUTER") {
      console.log(`# ${w.label}`);
      console.log(`ROUTER_PRIVATE_KEY=${w.privateKey}`);
      console.log(`ROUTER_WALLET_ADDRESS=${w.address}`);
    } else {
      console.log(`# ${w.label}`);
      console.log(`${w.envPrefix}=${w.address}`);
    }
    console.log("");
  }

  console.log("# ---------- next steps ----------");
  console.log("# 1. Save the router address — it needs USDC on base-sepolia.");
  console.log("# 2. Run `npm run fund:wallets` to print faucet URLs.");
  console.log("# 3. After funding, run `npm run start:all`.");

  // Also emit a JSON blob so tooling (e.g. CI) can parse it.
  const json = {
    wallets: wallets.map((w) => ({
      label: w.label,
      envPrefix: w.envPrefix,
      address: w.address,
    })),
  };
  console.log("\n# JSON (addresses only, keys are only printed above):");
  console.log(`# ${JSON.stringify(json)}`);
}

main();

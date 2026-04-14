// Router-side x402 client: wraps native fetch so that a 402 Payment Required
// response is automatically satisfied by signing a USDC EIP-3009 authorization
// using the router's EOA, then retrying.
//
// Every successful round-trip through `fetchWithPayment` is a real on-chain
// x402 settlement (via the x402 facilitator + Circle Nanopayments).

import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";
import type { Hex } from "viem";
import { requireEnv } from "../shared/config.js";

function loadSigner() {
  const pk = requireEnv("ROUTER_PRIVATE_KEY") as Hex;
  return privateKeyToAccount(pk);
}

// Lazy-init so tests and dashboards that never pay don't need a real key.
let _fetchWithPayment: ReturnType<typeof wrapFetchWithPayment> | null = null;

export function getFetchWithPayment(): ReturnType<typeof wrapFetchWithPayment> {
  if (_fetchWithPayment) return _fetchWithPayment;
  const signer = loadSigner();
  // maxValue defaults to 0.10 USDC per call — plenty of headroom for our
  // <= $0.01 agent prices while keeping accidental overpayment bounded.
  _fetchWithPayment = wrapFetchWithPayment(globalThis.fetch, signer);
  return _fetchWithPayment;
}

export function decodePaymentHeader(header: string | null) {
  if (!header) return null;
  try {
    return decodeXPaymentResponse(header);
  } catch {
    return null;
  }
}

// Exposed for the demo + router stats so we can report the exact network we
// actually settled on (e.g. "base-sepolia" today, "arc-testnet" once x402
// adds it and X402_NETWORK is flipped).
export function activeNetwork(): string {
  return process.env.X402_NETWORK ?? "base-sepolia";
}

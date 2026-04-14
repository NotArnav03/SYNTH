# SYNTH Protocol — Claude Code Instructions

## Project
SYNTH (Sub-cent Yield Network for Transactional Hierarchies) — a multi-agent orchestration network where agent-to-agent calls are paywalled with the **x402 protocol** and settled in **USDC** on **Arc** (via **Circle Nanopayments**).

## Architecture
- TypeScript / Node.js monorepo (not Python — the x402 SDK ecosystem is TS-first).
- Each specialist agent is an Express server using `x402-express` `paymentMiddleware` on `POST /invoke`.
- Router uses `x402-fetch`'s `wrapFetchWithPayment` with a viem signer built from the router's EOA private key.
- Every `/invoke` call from router to agent is a real x402 USDC payment — no mocks.
- Claude API (`claude-sonnet-4-20250514`) decomposes tasks and drives each agent's processing.

## Network
- x402 v1.1.0 supports base-sepolia, base, avalanche, polygon, etc. — **not** arc-testnet yet.
- We default to `base-sepolia` via `X402_NETWORK`. Switch to `arc-testnet` by changing the env var once x402 adds Arc support (no code changes required).

## Key rules
- ALL types live in `src/shared/types.ts` — nowhere else.
- Agents auto-register with the router on startup (`POST /agents/register`).
- Never mock x402 payments in production code paths. Mocks live only under `tests/`.
- Router signer is built via `privateKeyToAccount(ROUTER_PRIVATE_KEY)` from viem.
- Each agent's `walletAddress` comes from `AGENT_WALLET_*` env vars set up by `npm run setup:wallets`.

## Git
- Conventional commits only (feat/fix/refactor/docs/chore/test).
- NO Claude attribution — settings are configured at user and project level.
- Sole author: Arnav.

## Running
- First-time setup: `npm run setup:wallets` → paste output into `.env` → `npm run fund:wallets`.
- Boot: `npm run start:all` (agents first, then router).
- Demo (must produce 50+ tx): `npm run demo`.
- Dashboard: `cd dashboard && npm install && npm run dev`.
- Tests: `npm test`.

## Critical outputs for hackathon submission
- `npm run demo` must log 50+ tx hashes to stdout and to `demo-results/<timestamp>.json`.
- README must include the margin-economics section comparing Arc vs Ethereum vs Solana gas.
- README must include the product-feedback section (Arc / Circle Nanopayments / x402 / Circle Wallets).

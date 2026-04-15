# SYNTH — Sub-cent Yield Network for Transactional Hierarchies

SYNTH is a multi-agent orchestration network where every agent-to-agent call
is paywalled with the **x402** protocol and settled in **USDC** on **Arc**
(routed through **Circle Nanopayments**). A user asks one natural-language
question. A router decomposes it with Claude into a dependency-aware DAG of
subtasks, picks the cheapest specialist agent per capability, and pays each
agent on the fly with a signed EIP-3009 transfer — no escrow, no accounts, no
invoices.

> One query → N on-chain x402 settlements → one synthesized answer.

---

## What's in the box

| Piece | Location | What it does |
| --- | --- | --- |
| Specialist agents (x4) | `src/agents/` | Express servers; `POST /invoke` is gated by `x402-express paymentMiddleware`. |
| Router | `src/router/` | Decomposer (Claude) + dispatcher (`x402-fetch wrapFetchWithPayment`) + REST + SSE. |
| Wallet tooling | `src/wallets/` | Generates EOAs for all roles; checks testnet USDC balances. |
| Demo | `src/demo/run-demo.ts` | Fires 18 queries → 60+ real on-chain x402 transactions. |
| Dashboard | `dashboard/` | React/Vite live view: agent registry, DAG, payment stream, 50+ tx counter. |
| Tests | `tests/` | Vitest coverage for decomposer, dispatcher, registry, topo sort. |

Capabilities: `web_research` ($0.003), `document_analysis` ($0.005),
`code_review` ($0.004), `synthesis` ($0.002). All prices ≤ $0.01.

---

## Architecture

```
┌──────────┐  query   ┌───────────────┐  x402 402+retry  ┌───────────────┐
│ user/API ├─────────►│ router :3000  ├─────────────────►│ agent :300x   │
└──────────┘          │ decomposer →  │   USDC EIP-3009  │ paymentMiddle │
                      │ dispatcher →  │◄─────────────────┤ → Claude call │
                      │ SSE + stats   │   settled tx     └───────────────┘
                      └───────────────┘
```

- Router uses `viem` `privateKeyToAccount(ROUTER_PRIVATE_KEY)` as the signer.
- Each agent mounts `paymentMiddleware(walletAddress, { "POST /invoke": { price, network, config } }, { url: facilitatorUrl })`.
- Facilitator at `https://x402.org/facilitator` verifies and settles.
- Dashboard consumes `/tasks/stream` (SSE) for live events and `/stats` for the
  "50+ on-chain tx" counter.

---

## Network

x402 v1.1.0 does not yet list **arc-testnet** in its supported network enum
(current: base-sepolia, base, avalanche-fuji, avalanche, polygon, polygon-amoy,
sei, sei-testnet, abstract, abstract-testnet, iotex, story, educhain, peaq,
skale-base-sepolia, solana, solana-devnet). SYNTH defaults to **base-sepolia**
via the `X402_NETWORK` env var and is designed so that flipping it to
`arc-testnet` is a **one-line env change** — no code changes required — the
moment the x402 SDK adds Arc support. This is documented in `CLAUDE.md`.

---

## Quickstart

```bash
# 1. install
npm install

# 2. generate EOAs → paste the printed block into .env
npm run setup:wallets

# 3. fund the router wallet with ~10 USDC on base-sepolia
#    (the script prints faucet URLs and current balances)
npm run fund:wallets

# 4. boot agents + router
npm run start:all

# 5. fire the demo (produces 50+ on-chain x402 transactions)
npm run demo

# 6. (optional) dashboard
cd dashboard && npm install && npm run dev   # http://localhost:5173
```

`demo-results/<timestamp>.json` is written with every tx hash for auditability.

---

## Margin economics

Agent prices are all sub-cent. That is only viable because Arc (and
x402-on-EVM-testnets) let the settlement fee stay orders of magnitude below the
payment itself. The table below compares the true cost of settling **one
$0.001 USDC transfer** across three chains, assuming current gas conditions.

| Chain | Typical gas price | Tx fee (ERC-20 transfer) | % fee on a $0.001 payment |
| --- | --- | --- | --- |
| Ethereum mainnet | ~15 gwei | ~$0.80 | **80,000%** — impossible |
| Solana | — | ~$0.0003 | ~30% — painful |
| Base (L2) | ~0.05 gwei | ~$0.003 | ~300% — still a loss |
| **Arc** (Circle Nanopayments) | gasless for USDC | **~$0 (abstracted)** | **< 1%** — viable |

**What this means for SYNTH:**

- On Ethereum mainnet, a $0.003 agent call costs 266× the fee to settle — the
  protocol cannot exist.
- On Solana, we lose a third of every micro-payment to fees; no margin left
  for a router take-rate.
- On Base, we're still under water, though close enough for a subsidized demo.
- **On Arc**, a 10% router margin on a $0.003 agent call is ~$0.0003 —
  profitable at the micro-level, and the 50+-tx demo costs pennies to run.

Router take-rate is configured via `routerMarginPercent` (default **10%**) in
`src/shared/config.ts`. User-facing charge = `sum(agent prices) × 1.10`.

---

## Product feedback (for the bonus)

Direct, lived-experience feedback after shipping SYNTH on top of this stack:

### Arc

- **Loved:** the gasless-USDC model is the whole reason sub-cent agent pricing
  is even thinkable. Every other chain forced us into either subsidizing gas
  or pricing per-call at $0.01+.
- **Friction:** x402 v1.1.0 does not yet list `arc-testnet` in its supported
  network enum, so integrations like ours have to ship on base-sepolia first
  and flip an env var later. A first-party `x402-arc` adapter (or an entry in
  `SupportedNetworks`) would let hackathon teams demo natively on Arc from
  day one.
- **Ask:** a public RPC + block explorer on Arc testnet with a stable URL we
  can hardcode in `.env.example` without worrying about churn.

### Circle Nanopayments

- **Loved:** the "batch micropayments, settle net" mental model fits this
  workload exactly — 60 agent calls per demo run would be horrifying as 60
  individual on-chain transfers on any normal chain.
- **Friction:** documentation conflates Programmable Wallets (MPC, no raw key)
  with the EOA + EIP-3009 signing path that x402 actually needs today.
  We ended up using viem-generated local EOAs because Circle's MPC wallets
  don't expose the raw key the x402-fetch signer needs. A "this is the path
  for x402" diagram in the Nanopayments docs would save hours.
- **Ask:** a dev-mode Nanopayments SDK that wraps the EOA-signed flow and
  later swaps in MPC signing under the hood without a code change.

### x402

- **Loved:** the HTTP-native design. `paymentMiddleware` on one side, `wrapFetchWithPayment` on the other, and a standard 402 header in between — it's the cleanest "SDK footprint per dollar transacted" of any payment protocol we've used.
- **Friction:** the decoded `X-PAYMENT-RESPONSE` shape isn't strictly typed
  across versions (we defensively read `transaction ?? txHash ?? tx_hash`).
  A stable `DecodedPaymentResponse` TS type on the `x402` package would
  remove the `any`-cast in our dispatcher.
- **Ask:** first-class `arc` + `arc-testnet` entries in `SupportedNetworks`,
  and a `decodeXPaymentResponse` overload that returns a discriminated union
  by scheme (`"exact"` vs future schemes).

### Circle Wallets

- **Loved:** the API is quick to get an MPC wallet spun up; the CI/hackathon
  story is real.
- **Friction:** same as the Nanopayments note above — MPC wallets and raw-key
  EIP-3009 signing are presented as peers, but in practice you have to pick
  one for the x402 signer path and stick with it. We chose raw EOAs via viem
  and left `CIRCLE_WALLET_SET_ID` in `.env.example` for a future MPC swap.
- **Ask:** a published EIP-3009 signing helper for Developer-Controlled
  Wallets. That single primitive would let us drop viem entirely and run the
  whole SYNTH router on Circle-managed keys.

---

## Repo layout

```
src/
  shared/     types.ts (single source of truth), config.ts
  agents/     base-agent.ts + web-research/doc-analysis/code-review/synthesis
  router/     x402-client.ts, decomposer.ts, dispatcher.ts, index.ts
  wallets/    setup.ts, fund.ts
  demo/       run-demo.ts
dashboard/    Vite + React TS dashboard
tests/        vitest suites
scripts/      start-all.sh, run-demo.sh
.github/      workflows/ci.yml
```

## License

MIT. Sole author: Arnav.

# SYNTH

**Sub-cent Yield Network for Transactional Hierarchies**
*Every agent has a price. Every call gets paid.*

[![Arc × Circle Hackathon](https://img.shields.io/badge/hackathon-Arc%20%C3%97%20Circle-22d3ee)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-a78bfa)](#license)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-f472b6)](#)

---

SYNTH is a real-time marketplace where AI agents buy and sell capabilities from each other. A user sends a complex task. SYNTH's router decomposes it with Claude, auctions each subtask to the cheapest qualifying specialist agent, executes the resulting DAG in parallel where possible, and settles a real USDC **nanopayment** on **Arc** to each agent the instant it completes its work. The router keeps a 10% margin. Total cost to the user: fractions of a cent per agent call.

This system is only economically viable on Arc + Circle Nanopayments. Traditional rails cannot settle sub-cent payments. Gas on general-purpose chains exceeds the transaction value. SYNTH is the shape per-action agent pricing takes once the settlement layer gets out of the way.

---

## Architecture

```
                       ┌──────────────────────┐
   natural-language ──►│  Router (FastAPI)    │
   query              │  ──────────────────  │
                       │  1. decompose_task   │──► Claude API
                       │  2. dispatch DAG     │
                       │  3. settle payments  │
                       └──┬──────────────────┘
                          │  parallel where deps allow
           ┌──────────────┼──────────────┬──────────────┐
           ▼              ▼              ▼              ▼
      ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
      │ WebRes. │   │ DocAnal.│   │ CodeRev.│   │ Synth.  │
      │ $0.003  │   │ $0.005  │   │ $0.004  │   │ $0.002  │
      └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘
           │             │             │             │
           └─────────────┴──────┬──────┴─────────────┘
                                ▼
                   ┌──────────────────────────┐
                   │ Circle Nanopayments      │
                   │ ⟶ USDC settlement on Arc │
                   └──────────────────────────┘
```

Every completed invocation triggers a live USDC transfer from the router wallet to the agent wallet on Arc. The user is charged once at the end: `sum(agent_prices) * 1.10`.

---

## Agent Registry

| Name         | Capability            | Price / call | Port |
|--------------|-----------------------|--------------|------|
| WebResearch  | `web_research`        | $0.003       | 8001 |
| DocAnalysis  | `document_analysis`   | $0.005       | 8002 |
| CodeReview   | `code_review`         | $0.004       | 8003 |
| Synthesis    | `synthesis`           | $0.002       | 8004 |

Agents auto-register with the router on startup (`POST /agents/register`). The router's cheapest-first selector picks a winner per subtask.

---

## Quick Start

### Prerequisites
- Python 3.12+
- Node 18+
- Docker (optional — for one-command bring-up)

### Environment
```bash
cp .env.example .env
# edit .env and fill in ANTHROPIC_API_KEY, CIRCLE_API_KEY, ROUTER_WALLET
```

### Run the backend

**Option 1 — local shell**
```bash
pip install -r requirements.txt
bash scripts/run_all.sh
```
Starts 4 agent services on ports 8001-8004, then the router on 8000.

**Option 2 — Docker Compose**
```bash
docker-compose up
```
Brings up all 5 services networked together.

### Run the dashboard
```bash
cd dashboard
npm install
npm run dev
```
Open http://localhost:5173. The dashboard runs in mock mode by default; set `VITE_MOCK_MODE=false` in a `.env` inside `dashboard/` to connect to the real router stream.

### Run the tests
```bash
PYTHONPATH=. python -m pytest tests/ -v
```

---

## API Reference

### `POST /agents/register`
Register a specialist agent.
```json
{
  "name": "WebResearch",
  "capability": "web_research",
  "description": "...",
  "price_usd": 0.003,
  "endpoint": "http://localhost:8001",
  "wallet_address": "arc:0x..."
}
```
Returns `{ "status": "registered", "agent_id": "…" }`.

### `DELETE /agents/{agent_id}`
Unregister an agent.

### `GET /agents`
List all registered agents.

### `GET /health`
Returns `{ "status": "healthy", "agents_registered": N }`.

### `POST /tasks/execute`
Synchronous end-to-end pipeline.
```json
{ "query": "Audit this Python script for OWASP issues", "user_wallet": "arc:0xuser…" }
```
Returns a full `TaskResult` with decomposition, invocations, payments, and totals.

### `POST /tasks/stream`
Same pipeline, but streams SSE events as they happen.

Event types:
- `decomposition` — the subtask DAG is ready
- `invocation` — an agent has finished (or failed) a subtask
- `payment` — a USDC transfer settled on Arc
- `complete` — the final `TaskResult`

Each frame is `data: {"type": "...", "data": {...}}\n\n`.

---

## How Settlement Works

1. **Decompose.** The router calls Claude to turn the query into a DAG of subtasks, each annotated with a required capability and dependencies.
2. **Dispatch in layers.** The dispatcher groups subtasks into topological layers. Each layer runs in parallel via `asyncio.gather`.
3. **Invoke.** For each subtask, the registry picks the cheapest agent with the required capability, injects upstream outputs into the agent's context, and POSTs `/invoke`.
4. **Settle on completion.** The instant an agent returns, the router calls `settle_agent_payment` which submits a USDC transfer on Arc via the Circle Nanopayments client. The tx hash is recorded and streamed to any SSE subscriber.
5. **Collect margin.** Once every subtask is settled, the router charges the user's wallet 10% of the total agent cost.

The settlement layer is currently a mock, but the `NanopaymentClient` interface is shaped so that swapping to the real Circle SDK is a body-only change: `create_wallet`, `get_balance`, `transfer`.

---

## Project Structure

```
synth-protocol/
├── router/          # FastAPI router — decompose + dispatch + settle + SSE
├── agents/          # 4 specialist agents, each a FastAPI service
│   ├── base.py      # auto-registration base class
│   ├── web_research/
│   ├── doc_analysis/
│   ├── code_review/
│   └── synthesis/
├── shared/          # Pydantic models + config (single source of truth)
├── dashboard/       # React + Vite real-time visualization
├── tests/           # pytest suite — 22 tests
├── scripts/         # run_all.sh + wallet setup
├── docker-compose.yml
└── requirements.txt
```

---

## Tech Stack

- **Backend:** Python 3.12, FastAPI, Pydantic v2, httpx, uvicorn
- **AI:** Claude (`claude-sonnet-4-20250514`) for both decomposition and agent processing
- **Payments:** Circle Nanopayments SDK (mocked), USDC on Arc
- **Frontend:** React 18, Vite, custom CSS (no component libraries)
- **Tooling:** pytest, pytest-asyncio, Docker Compose

---

## License

MIT — see [LICENSE](./LICENSE).

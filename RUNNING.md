# Running SYNTH — Step-by-Step Guide

This is the full walkthrough for getting SYNTH running locally, from a fresh clone to a live demo with the dashboard streaming real-time settlements.

---

## 1. Prerequisites

| Tool    | Version  | Check                |
|---------|----------|----------------------|
| Python  | 3.12+    | `python --version`   |
| Node.js | 18+      | `node --version`     |
| npm     | 9+       | `npm --version`      |
| git     | any      | `git --version`      |
| Docker  | optional | `docker --version`   |

You'll also want an **Anthropic API key** (for the Claude-powered decomposer and agents). Circle/Arc credentials are optional — the settlement layer ships as a mock.

---

## 2. Clone the repo

```bash
git clone https://github.com/NotArnav03/SYNTH.git
cd SYNTH
```

---

## 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in the values:

```
ANTHROPIC_API_KEY=sk-ant-...          # required for real Claude calls
CIRCLE_API_KEY=test-dummy             # optional — mock works without it
ARC_RPC_URL=https://rpc.arc.network   # optional
ROUTER_WALLET=arc:0xROUTER_WALLET     # any string works in mock mode
```

> **Mock mode note.** If you leave `ANTHROPIC_API_KEY` blank the agents will fail at runtime (they hit Claude). For a pure-frontend demo you can skip the backend entirely and rely on the dashboard's built-in mock mode (see §7).

---

## 4. Install backend dependencies

```bash
pip install -r requirements.txt
```

This pulls in FastAPI, uvicorn, httpx, anthropic, pydantic, python-dotenv, pytest, and pytest-asyncio.

---

## 5. Run the backend

You have two options.

### Option A — Shell script (recommended for local dev)

```bash
bash scripts/run_all.sh
```

This boots:

- `WebResearch` agent on port **8001**
- `DocAnalysis` agent on port **8002**
- `CodeReview` agent on port **8003**
- `Synthesis` agent on port **8004**
- Router on port **8000** (after a 2s delay so the agents come up first)

Each agent auto-registers with the router via `POST /agents/register`. You'll see log lines like:

```
[WebResearch] registered with router at http://localhost:8000 (agent_id=…)
[registry] + WebResearch (web_research) @ $0.0030/call -> http://localhost:8001
```

> **Windows users:** run the same commands inside Git Bash or WSL, or launch each process manually:
> ```bash
> set PYTHONPATH=.
> start /B python -m agents.web_research.main
> start /B python -m agents.doc_analysis.main
> start /B python -m agents.code_review.main
> start /B python -m agents.synthesis.main
> timeout /t 2
> python -m router.main
> ```

### Option B — Docker Compose (one command, isolated)

```bash
docker-compose up --build
```

All 5 services come up on the same ports as Option A and talk to each other over the compose network.

---

## 6. Smoke-test the API

With the backend running, hit the router:

```bash
# health
curl http://localhost:8000/health

# list registered agents
curl http://localhost:8000/agents

# execute a task end-to-end
curl -X POST http://localhost:8000/tasks/execute \
  -H "Content-Type: application/json" \
  -d '{"query":"Audit this Python script for security issues","user_wallet":"arc:0xuser"}'
```

You should get back a `TaskResult` with a decomposition, per-agent invocations, settled USDC payments, and totals.

Stream the same pipeline as SSE:

```bash
curl -N -X POST http://localhost:8000/tasks/stream \
  -H "Content-Type: application/json" \
  -d '{"query":"Research and summarize the state of AI agents in 2026"}'
```

You'll see `decomposition`, `invocation`, `payment`, and `complete` events as they happen.

---

## 7. Run the dashboard

In a **second terminal**:

```bash
cd dashboard
npm install
npm run dev
```

Open http://localhost:5173.

### Mock mode vs live mode

The dashboard defaults to **mock mode** — it simulates the full decompose → dispatch → settle flow in the browser, with realistic 600–1400 ms per agent. This lets you demo the UI with no backend running.

To connect to the real router stream, create `dashboard/.env`:

```
VITE_MOCK_MODE=false
VITE_ROUTER_URL=http://localhost:8000
```

Restart `npm run dev` after changing env.

---

## 8. Run the tests

```bash
PYTHONPATH=. python -m pytest tests/ -v
```

22 tests across `test_decomposer.py`, `test_dispatcher.py`, `test_settlement.py`, and `test_agents.py`. All use mocked Claude responses so they don't need a real API key — the dummy key in `tests/conftest.py` is enough.

---

## 9. Try a demo scenario

In the dashboard, click one of the three scenario pills under the query bar:

1. *Review this Python script and find best practices from recent style guides* — runs CodeReview + WebResearch in parallel, then Synthesis.
2. *Analyze this contract and find comparable deals in the market* — DocAnalysis + WebResearch → Synthesis.
3. *Audit this API endpoint code and check if it follows OWASP security standards* — CodeReview + WebResearch → Synthesis.

Watch:

- **Left column** — agent cards light up with their capability color as work is dispatched to them.
- **Middle column** — the task-flow DAG animates: nodes pulse while active, turn green with a ✓ when completed.
- **Right column** — the Arc Settlement Feed scrolls in real time, each row showing USDC amount, recipient, and tx hash.
- **Bottom middle** — the Final Result and Cost Summary appear when the task completes.

---

## 10. Project structure cheat-sheet

```
SYNTH/
├── router/           # FastAPI: decompose + dispatch + settle + SSE
├── agents/           # 4 specialist agents (base.py + 4 subpackages)
├── shared/           # Pydantic models + config (single source of truth)
├── dashboard/        # React + Vite frontend
├── tests/            # pytest suite (22 tests)
├── scripts/
│   ├── run_all.sh        # start all 5 services
│   └── setup_wallets.py  # create Arc USDC wallets (mock)
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── CLAUDE.md         # Claude Code project instructions
├── README.md         # project overview + architecture
└── RUNNING.md        # you are here
```

---

## 11. Troubleshooting

| Symptom                                                   | Fix                                                                                          |
|-----------------------------------------------------------|----------------------------------------------------------------------------------------------|
| `ModuleNotFoundError: No module named 'router'`           | Set `PYTHONPATH=.` (or `export PYTHONPATH=$(pwd)`) before running Python commands.           |
| `pytest: command not found`                               | Use `python -m pytest tests/ -v` instead.                                                    |
| Agents can't reach the router                             | Make sure the router is on port 8000 and `ROUTER_URL` env var points to it (default ok).     |
| Dashboard shows blank / 404                               | Check port 5173 isn't blocked; run `npm install` again if `node_modules` looks incomplete.   |
| Real API calls failing with 401 / auth error              | Your `ANTHROPIC_API_KEY` is missing or invalid; refresh it in `.env` and restart services.   |
| Port already in use                                       | Something's on 8000-8004/5173 — kill it (`lsof -i:8000` on macOS/Linux, `netstat -ano` on Windows). |
| Dashboard live mode fails                                 | It falls back to mock automatically; check router logs and CORS (already enabled wildcard).  |

---

## 12. Shutting down

- Shell mode: `Ctrl+C` once in the terminal running `run_all.sh`. The background agent processes receive SIGINT too and unregister cleanly.
- Docker: `docker-compose down`.
- Dashboard: `Ctrl+C` in the `npm run dev` terminal.

That's it — you're running SYNTH.

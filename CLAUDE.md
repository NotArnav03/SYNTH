# SYNTH Protocol — Claude Code Instructions

## Project
SYNTH (Sub-cent Yield Network for Transactional Hierarchies) — multi-agent orchestration with sub-cent USDC settlement on Arc via Circle Nanopayments.

## Structure
- `router/` — FastAPI router: task decomposition, agent dispatch, payment settlement
- `agents/` — 4 specialist FastAPI agents (web_research, doc_analysis, code_review, synthesis)
- `shared/` — Pydantic models + config (single source of truth)
- `dashboard/` — React + Vite frontend
- `tests/` — pytest test suite

## Key Rules
- ALL data models live in `shared/models.py` — nowhere else
- Agents auto-register with the router on startup via POST /agents/register
- Settlement module (`router/settlement.py`) has mock implementation — real Circle SDK calls go in the same method signatures
- Router decomposes tasks using Claude API (`claude-sonnet-4-20250514`)
- Each agent also uses Claude for processing (same model)
- PYTHONPATH must include project root for imports to work

## Git
- Conventional commits only (feat/fix/refactor/docs/chore/test)
- NO Claude attribution in commits — settings already configured
- Sole author: Arnav

## Running
- Backend: `bash scripts/run_all.sh` or `docker-compose up`
- Dashboard: `cd dashboard && npm install && npm run dev`
- Tests: `pytest tests/ -v`

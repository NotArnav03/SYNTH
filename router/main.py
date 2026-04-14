"""SYNTH Router — FastAPI app exposing REST + SSE endpoints."""
from __future__ import annotations

import asyncio
import json
import time
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from router.decomposer import decompose_task
from router.dispatcher import dispatch_subtasks, registry
from router.settlement import collect_router_margin
from shared.config import (
    ROUTER_HOST,
    ROUTER_MARGIN_PERCENT,
    ROUTER_PORT,
)
from shared.models import (
    AgentInvocation,
    AgentRegistration,
    PaymentRecord,
    TaskResult,
)


class TaskRequest(BaseModel):
    query: str
    user_wallet: str = "user-wallet-default"


@asynccontextmanager
async def lifespan(_: FastAPI):
    print(f"[router] SYNTH starting on {ROUTER_HOST}:{ROUTER_PORT}")
    yield
    print("[router] SYNTH shutting down")


app = FastAPI(
    title="SYNTH - The Agent Settlement Protocol",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/agents/register")
async def register_agent(agent: AgentRegistration) -> dict:
    registry.register(agent)
    return {"status": "registered", "agent_id": agent.agent_id}


@app.delete("/agents/{agent_id}")
async def unregister_agent(agent_id: str) -> dict:
    registry.unregister(agent_id)
    return {"status": "unregistered", "agent_id": agent_id}


@app.get("/agents")
async def list_agents() -> list[AgentRegistration]:
    return registry.list_all()


@app.get("/health")
async def health() -> dict:
    return {
        "status": "healthy",
        "service": "synth-router",
        "agents_registered": len(registry.list_all()),
    }


def _final_result(invocations: list[AgentInvocation]) -> str:
    """Return the synthesis output if present, else concatenate outputs."""
    synthesis = [
        i for i in invocations
        if i.capability.value == "synthesis" and i.status == "completed"
    ]
    if synthesis:
        return synthesis[-1].output_data or ""
    completed = [i for i in invocations if i.status == "completed"]
    return "\n\n".join(
        f"## {i.agent_name}\n{i.output_data or ''}" for i in completed
    )


def _totals(
    invocations: list[AgentInvocation],
    payments: list[PaymentRecord],
    started_ms: float,
) -> tuple[float, float, float, int]:
    agent_cost = sum(p.amount_usd for p in payments)
    margin = round(agent_cost * ROUTER_MARGIN_PERCENT, 6)
    user_charged = round(agent_cost + margin, 6)
    latency_ms = int((time.time() - started_ms) * 1000)
    return agent_cost, margin, user_charged, latency_ms


@app.post("/tasks/execute")
async def execute_task(req: TaskRequest) -> TaskResult:
    """Synchronous end-to-end pipeline: decompose -> dispatch -> settle."""
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="query is required")

    started_ms = time.time()

    decomposition = await decompose_task(req.query)
    invocations, payments = await dispatch_subtasks(
        decomposition.subtasks, req.user_wallet
    )

    agent_cost, margin, user_charged, latency_ms = _totals(
        invocations, payments, started_ms
    )

    if agent_cost > 0:
        margin_payment = await collect_router_margin(
            req.user_wallet, agent_cost, ROUTER_MARGIN_PERCENT
        )
        payments.append(margin_payment)

    return TaskResult(
        original_query=req.query,
        decomposition=decomposition,
        invocations=invocations,
        payments=payments,
        final_result=_final_result(invocations),
        total_cost_usd=round(agent_cost, 6),
        router_margin_usd=margin,
        user_charged_usd=user_charged,
        total_latency_ms=latency_ms,
    )


def _sse(event_type: str, data: dict) -> str:
    return f"data: {json.dumps({'type': event_type, 'data': data})}\n\n"


@app.post("/tasks/stream")
async def stream_task(req: TaskRequest):
    """SSE stream that emits events as decomposition/invocation/payment happen."""
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="query is required")

    async def event_gen():
        started_ms = time.time()
        queue: asyncio.Queue[Optional[str]] = asyncio.Queue()

        decomposition = await decompose_task(req.query)
        await queue.put(_sse("decomposition", decomposition.model_dump(mode="json")))

        async def on_complete(
            invocation: AgentInvocation, payment: Optional[PaymentRecord]
        ) -> None:
            await queue.put(_sse("invocation", invocation.model_dump(mode="json")))
            if payment is not None:
                await queue.put(_sse("payment", payment.model_dump(mode="json")))

        async def run_pipeline() -> None:
            invocations, payments = await dispatch_subtasks(
                decomposition.subtasks, req.user_wallet, on_complete
            )
            agent_cost, margin, user_charged, latency_ms = _totals(
                invocations, payments, started_ms
            )
            if agent_cost > 0:
                margin_payment = await collect_router_margin(
                    req.user_wallet, agent_cost, ROUTER_MARGIN_PERCENT
                )
                payments.append(margin_payment)
                await queue.put(
                    _sse("payment", margin_payment.model_dump(mode="json"))
                )

            result = TaskResult(
                original_query=req.query,
                decomposition=decomposition,
                invocations=invocations,
                payments=payments,
                final_result=_final_result(invocations),
                total_cost_usd=round(agent_cost, 6),
                router_margin_usd=margin,
                user_charged_usd=user_charged,
                total_latency_ms=latency_ms,
            )
            await queue.put(_sse("complete", result.model_dump(mode="json")))
            await queue.put(None)

        pipeline = asyncio.create_task(run_pipeline())

        while True:
            item = await queue.get()
            if item is None:
                break
            yield item

        await pipeline

    return StreamingResponse(event_gen(), media_type="text/event-stream")


if __name__ == "__main__":
    uvicorn.run(app, host=ROUTER_HOST, port=ROUTER_PORT)

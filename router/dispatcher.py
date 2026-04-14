"""Agent registry + DAG execution engine."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Awaitable, Callable, Optional

import httpx

from router.settlement import settle_agent_payment
from shared.config import ROUTER_WALLET
from shared.models import (
    AgentCapability,
    AgentInvocation,
    AgentRegistration,
    AgentRequest,
    PaymentRecord,
    Subtask,
)


class AgentRegistry:
    def __init__(self) -> None:
        self._agents: dict[str, AgentRegistration] = {}

    def register(self, agent: AgentRegistration) -> None:
        self._agents[agent.agent_id] = agent
        print(
            f"[registry] + {agent.name} ({agent.capability.value}) "
            f"@ ${agent.price_usd:.4f}/call -> {agent.endpoint}"
        )

    def unregister(self, agent_id: str) -> None:
        removed = self._agents.pop(agent_id, None)
        if removed:
            print(f"[registry] - {removed.name} ({agent_id})")

    def find_by_capability(
        self, capability: AgentCapability
    ) -> list[AgentRegistration]:
        return [a for a in self._agents.values() if a.capability == capability]

    def select_best(
        self, capability: AgentCapability
    ) -> Optional[AgentRegistration]:
        candidates = self.find_by_capability(capability)
        if not candidates:
            return None
        candidates.sort(key=lambda a: (a.price_usd, a.avg_latency_ms))
        return candidates[0]

    def list_all(self) -> list[AgentRegistration]:
        return list(self._agents.values())


registry = AgentRegistry()


async def invoke_agent(
    agent: AgentRegistration,
    subtask: Subtask,
    context: dict,
) -> tuple[AgentInvocation, str]:
    """POST an AgentRequest to the agent and return (invocation, output)."""
    invocation = AgentInvocation(
        subtask_id=subtask.subtask_id,
        agent_id=agent.agent_id,
        agent_name=agent.name,
        capability=agent.capability,
        input_data=subtask.input_data,
        price_usd=agent.price_usd,
        status="running",
        started_at=datetime.now(timezone.utc),
    )

    request = AgentRequest(
        invocation_id=invocation.invocation_id,
        input_data=subtask.input_data,
        context=context,
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as http:
            r = await http.post(
                f"{agent.endpoint.rstrip('/')}/invoke",
                json=request.model_dump(),
            )
            r.raise_for_status()
            payload = r.json()
            output = payload.get("output_data", "")
        invocation.output_data = output
        invocation.status = "completed"
    except Exception as e:
        output = f"[error] {type(e).__name__}: {e}"
        invocation.output_data = output
        invocation.status = "failed"
    finally:
        invocation.completed_at = datetime.now(timezone.utc)

    return invocation, output


def _topological_layers(subtasks: list[Subtask]) -> list[list[Subtask]]:
    """Group subtasks into parallel layers honoring `depends_on`."""
    by_id = {s.subtask_id: s for s in subtasks}
    remaining = set(by_id.keys())
    resolved: set[str] = set()
    layers: list[list[Subtask]] = []

    while remaining:
        layer_ids = [
            sid for sid in remaining
            if all(dep in resolved for dep in by_id[sid].depends_on)
        ]
        if not layer_ids:
            raise RuntimeError(
                f"Circular dependency detected in subtasks: {remaining}"
            )
        layer = [by_id[sid] for sid in layer_ids]
        layers.append(layer)
        resolved.update(layer_ids)
        remaining.difference_update(layer_ids)

    return layers


async def dispatch_subtasks(
    subtasks: list[Subtask],
    user_wallet: str,
    on_invocation_complete: Optional[
        Callable[[AgentInvocation, Optional[PaymentRecord]], Awaitable[None]]
    ] = None,
) -> tuple[list[AgentInvocation], list[PaymentRecord]]:
    """Execute a subtask DAG in topological layers, settling payments live."""
    all_invocations: list[AgentInvocation] = []
    all_payments: list[PaymentRecord] = []
    outputs_by_subtask: dict[str, str] = {}

    layers = _topological_layers(subtasks)

    for layer in layers:
        async def run_one(subtask: Subtask) -> None:
            agent = registry.select_best(subtask.required_capability)
            if agent is None:
                invocation = AgentInvocation(
                    subtask_id=subtask.subtask_id,
                    agent_id="none",
                    agent_name="<unavailable>",
                    capability=subtask.required_capability,
                    input_data=subtask.input_data,
                    price_usd=0.0,
                    status="failed",
                    output_data=(
                        f"No agent registered for capability "
                        f"{subtask.required_capability.value}"
                    ),
                    started_at=datetime.now(timezone.utc),
                    completed_at=datetime.now(timezone.utc),
                )
                all_invocations.append(invocation)
                outputs_by_subtask[subtask.subtask_id] = invocation.output_data or ""
                if on_invocation_complete:
                    await on_invocation_complete(invocation, None)
                return

            context = {
                dep_id: outputs_by_subtask.get(dep_id, "")
                for dep_id in subtask.depends_on
            }

            invocation, output = await invoke_agent(agent, subtask, context)
            outputs_by_subtask[subtask.subtask_id] = output

            payment: Optional[PaymentRecord] = None
            if invocation.status == "completed":
                payment = await settle_agent_payment(
                    from_wallet=ROUTER_WALLET,
                    to_wallet=agent.wallet_address,
                    amount_usd=agent.price_usd,
                    agent_id=agent.agent_id,
                    invocation_id=invocation.invocation_id,
                )
                invocation.payment_tx_hash = payment.tx_hash
                all_payments.append(payment)

            all_invocations.append(invocation)

            if on_invocation_complete:
                await on_invocation_complete(invocation, payment)

        await asyncio.gather(*(run_one(s) for s in layer))

    return all_invocations, all_payments

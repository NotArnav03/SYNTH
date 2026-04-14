"""All data models for SYNTH — single source of truth."""
from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


def _short_id() -> str:
    return uuid.uuid4().hex[:8]


class AgentCapability(str, Enum):
    WEB_RESEARCH = "web_research"
    DOCUMENT_ANALYSIS = "document_analysis"
    CODE_REVIEW = "code_review"
    SYNTHESIS = "synthesis"


class AgentRegistration(BaseModel):
    agent_id: str = Field(default_factory=_short_id)
    name: str
    capability: AgentCapability
    description: str
    price_usd: float
    endpoint: str
    wallet_address: str
    max_concurrent: int = 5
    avg_latency_ms: int = 500


class AgentHealth(BaseModel):
    agent_id: str
    status: str
    current_load: int
    avg_latency_ms: int
    uptime_seconds: float


class Subtask(BaseModel):
    subtask_id: str = Field(default_factory=_short_id)
    description: str
    required_capability: AgentCapability
    input_data: str
    depends_on: list[str] = Field(default_factory=list)


class TaskDecomposition(BaseModel):
    original_query: str
    subtasks: list[Subtask]
    execution_plan: str


class AgentInvocation(BaseModel):
    invocation_id: str = Field(default_factory=_short_id)
    subtask_id: str
    agent_id: str
    agent_name: str
    capability: AgentCapability
    input_data: str
    output_data: Optional[str] = None
    price_usd: float
    status: str = "pending"
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    payment_tx_hash: Optional[str] = None


class PaymentRecord(BaseModel):
    tx_hash: str
    from_wallet: str
    to_wallet: str
    amount_usd: float
    agent_id: str
    invocation_id: str
    settled_at: datetime
    chain: str = "arc"
    currency: str = "USDC"


class TaskResult(BaseModel):
    task_id: str = Field(default_factory=_short_id)
    original_query: str
    decomposition: TaskDecomposition
    invocations: list[AgentInvocation]
    payments: list[PaymentRecord]
    final_result: str
    total_cost_usd: float
    router_margin_usd: float
    user_charged_usd: float
    total_latency_ms: int


class AgentRequest(BaseModel):
    invocation_id: str
    input_data: str
    context: dict = Field(default_factory=dict)


class AgentResponse(BaseModel):
    invocation_id: str
    output_data: str
    confidence: float = 1.0
    metadata: dict = Field(default_factory=dict)

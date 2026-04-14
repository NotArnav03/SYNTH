"""Abstract base class for SYNTH specialist agents."""
from __future__ import annotations

import os
import secrets
from abc import ABC, abstractmethod
from contextlib import asynccontextmanager

import httpx
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.models import (
    AgentCapability,
    AgentRegistration,
    AgentRequest,
    AgentResponse,
)


class BaseAgent(ABC):
    def __init__(
        self,
        name: str,
        capability: AgentCapability,
        description: str,
        price_usd: float,
        port: int,
        wallet_address: str,
        router_url: str = "http://localhost:8000",
    ) -> None:
        self.name = name
        self.capability = capability
        self.description = description
        self.price_usd = price_usd
        self.port = port
        self.wallet_address = wallet_address
        self.router_url = os.getenv("ROUTER_URL", router_url)
        self.agent_host = os.getenv("AGENT_HOST", "localhost")
        self.endpoint = f"http://{self.agent_host}:{port}"
        self.registration = AgentRegistration(
            name=name,
            capability=capability,
            description=description,
            price_usd=price_usd,
            endpoint=self.endpoint,
            wallet_address=wallet_address,
        )
        self.app = self._build_app()

    def _build_app(self) -> FastAPI:
        @asynccontextmanager
        async def lifespan(_: FastAPI):
            await self._register_with_router()
            yield
            await self._unregister_from_router()

        app = FastAPI(title=self.name, lifespan=lifespan)
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        @app.post("/invoke", response_model=AgentResponse)
        async def invoke(req: AgentRequest) -> AgentResponse:
            try:
                output = await self.process(req.input_data, req.context)
            except Exception as e:
                output = f"[agent-error] {type(e).__name__}: {e}"
            return AgentResponse(
                invocation_id=req.invocation_id,
                output_data=output,
            )

        @app.get("/health")
        async def health() -> dict:
            return {"status": "healthy", "agent": self.name}

        return app

    async def _register_with_router(self) -> None:
        try:
            async with httpx.AsyncClient(timeout=5.0) as http:
                r = await http.post(
                    f"{self.router_url.rstrip('/')}/agents/register",
                    json=self.registration.model_dump(mode="json"),
                )
                r.raise_for_status()
            print(
                f"[{self.name}] registered with router at {self.router_url} "
                f"(agent_id={self.registration.agent_id})"
            )
        except Exception as e:
            print(
                f"[{self.name}] WARNING: failed to register with router "
                f"({type(e).__name__}: {e}). Continuing anyway."
            )

    async def _unregister_from_router(self) -> None:
        try:
            async with httpx.AsyncClient(timeout=5.0) as http:
                await http.delete(
                    f"{self.router_url.rstrip('/')}/agents/"
                    f"{self.registration.agent_id}"
                )
            print(f"[{self.name}] unregistered from router")
        except Exception:
            pass

    @abstractmethod
    async def process(self, input_data: str, context: dict) -> str:
        ...

    def run(self) -> None:
        uvicorn.run(self.app, host="0.0.0.0", port=self.port)


def default_wallet(label: str) -> str:
    """Deterministic-looking dev wallet address for a given label."""
    seed = secrets.token_hex(20)
    return f"arc:0x{seed}"

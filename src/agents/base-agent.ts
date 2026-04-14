// Abstract base class for SYNTH specialist agents.
//
// Every agent is an Express server with x402 `paymentMiddleware` guarding
// `POST /invoke`. Any request without an `X-PAYMENT` header receives a real
// 402 Payment Required response containing the x402 payment requirements
// (scheme=exact, price, network, payTo). The x402-fetch client on the router
// automatically satisfies that challenge and retries.

import express, { type Request, type Response } from "express";
import { paymentMiddleware } from "x402-express";
import type { Network } from "x402/types";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import axios from "axios";
import {
  AgentCapability,
  AgentRegistration,
  AgentRequest,
  AgentResponse,
} from "../shared/types.js";
import { config } from "../shared/config.js";

export abstract class BaseAgent {
  public app: express.Application;
  public registration: AgentRegistration;
  protected anthropic: Anthropic;

  constructor(
    public name: string,
    public capability: AgentCapability,
    public description: string,
    public priceUsd: number,
    public port: number,
    public walletAddress: string,
  ) {
    if (priceUsd > 0.01) {
      throw new Error(
        `Hackathon rule: agent prices must be <= $0.01. ${name} is $${priceUsd}.`,
      );
    }
    this.app = express();
    this.app.use(express.json());

    this.registration = {
      agentId: randomUUID().slice(0, 8),
      name,
      capability,
      description,
      priceUsd,
      endpoint: `http://localhost:${port}`,
      walletAddress,
      port,
    };

    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey || "unset",
    });

    this.setupHealth();
    this.setupX402();
    this.setupInvoke();
  }

  private setupHealth() {
    // health is public and unpaywalled so the router + dashboard can probe.
    this.app.get("/health", (_req: Request, res: Response) => {
      res.json({
        status: "healthy",
        agent: this.name,
        capability: this.capability,
        price_usd: this.priceUsd,
        walletAddress: this.walletAddress,
        network: config.x402Network,
      });
    });
  }

  private setupX402() {
    if (!this.walletAddress || !this.walletAddress.startsWith("0x")) {
      console.warn(
        `[${this.name}] WARNING: walletAddress is not set. ` +
          `x402 middleware will still mount but payments will fail. ` +
          `Run \`npm run setup:wallets\` and populate .env.`,
      );
    }

    // Route-scoped paywall: only `/invoke` requires payment.
    this.app.use(
      paymentMiddleware(
        this.walletAddress as `0x${string}`,
        {
          "POST /invoke": {
            price: `$${this.priceUsd}`,
            network: config.x402Network as Network,
            config: {
              description: `${this.name} — ${this.description}`,
              mimeType: "application/json",
            },
          },
        },
        {
          url: config.facilitatorUrl as `${string}://${string}`,
        },
      ),
    );
  }

  private setupInvoke() {
    this.app.post("/invoke", async (req: Request, res: Response) => {
      const body = req.body as AgentRequest;
      try {
        const output = await this.process(body.inputData, body.context ?? {});
        const response: AgentResponse = {
          invocationId: body.invocationId,
          outputData: output,
          confidence: 1.0,
        };
        res.json(response);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({
          invocationId: body?.invocationId,
          error: `[${this.name}] ${message}`,
        });
      }
    });
  }

  abstract process(
    inputData: string,
    context: Record<string, string>,
  ): Promise<string>;

  async start(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.app.listen(this.port, () => {
        console.log(
          `[${this.name}] listening on ${this.port} — $${this.priceUsd}/call — ` +
            `x402 paywalled on ${config.x402Network}`,
        );
        resolve();
      });
    });

    // Auto-register with router (best-effort; don't crash if router is slow).
    try {
      await axios.post(
        `${config.routerUrl}/agents/register`,
        this.registration,
        { timeout: 3000 },
      );
      console.log(`[${this.name}] registered with router @ ${config.routerUrl}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[${this.name}] could not register with router: ${message}. ` +
          `The router can also pull /health later.`,
      );
    }
  }

  protected async claude(systemPrompt: string, userText: string): Promise<string> {
    const msg = await this.anthropic.messages.create({
      model: config.decompositionModel,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userText }],
    });
    const part = msg.content.find((c) => c.type === "text");
    return part && part.type === "text" ? part.text : "";
  }
}

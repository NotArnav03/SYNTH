import { describe, it, expect, vi, beforeEach } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class {
      messages = { create: createMock };
    },
  };
});

import { decomposeTask } from "../src/router/decomposer.js";
import { AgentCapability } from "../src/shared/types.js";

function claudeResponse(json: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(json) }] };
}

beforeEach(() => {
  createMock.mockReset();
});

describe("decomposeTask", () => {
  it("parses a single-capability decomposition", async () => {
    createMock.mockResolvedValueOnce(
      claudeResponse({
        subtasks: [
          {
            subtask_id: "s1",
            description: "research",
            required_capability: "web_research",
            input_data: "what is x402",
            depends_on: [],
          },
        ],
        execution_plan: "one-step plan",
      }),
    );

    const out = await decomposeTask("what is x402");
    expect(out.subtasks).toHaveLength(1);
    expect(out.subtasks[0].requiredCapability).toBe(AgentCapability.WEB_RESEARCH);
    expect(out.executionPlan).toBe("one-step plan");
  });

  it("strips markdown fences before parsing", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: "```json\n" + JSON.stringify({
            subtasks: [
              { subtask_id: "s1", description: "d", required_capability: "synthesis", input_data: "x", depends_on: [] },
            ],
          }) + "\n```",
        },
      ],
    });
    const out = await decomposeTask("x");
    expect(out.subtasks[0].requiredCapability).toBe(AgentCapability.SYNTHESIS);
  });

  it("rejects unknown capabilities", async () => {
    createMock.mockResolvedValueOnce(
      claudeResponse({
        subtasks: [
          { subtask_id: "s1", description: "", required_capability: "frobnicate", input_data: "", depends_on: [] },
        ],
      }),
    );
    await expect(decomposeTask("x")).rejects.toThrow(/Unknown capability/);
  });

  it("rejects references to unknown subtask ids", async () => {
    createMock.mockResolvedValueOnce(
      claudeResponse({
        subtasks: [
          { subtask_id: "s1", description: "", required_capability: "web_research", input_data: "", depends_on: ["ghost"] },
        ],
      }),
    );
    await expect(decomposeTask("x")).rejects.toThrow(/unknown subtask/);
  });
});

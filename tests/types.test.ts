import { describe, it, expect } from "vitest";
import { shortId, AgentCapability } from "../src/shared/types.js";

describe("shared types", () => {
  it("shortId is 8 chars and unique across calls", () => {
    const a = shortId();
    const b = shortId();
    expect(a).toHaveLength(8);
    expect(b).toHaveLength(8);
    expect(a).not.toBe(b);
  });

  it("AgentCapability has the four expected values", () => {
    expect(Object.values(AgentCapability).sort()).toEqual(
      ["code_review", "document_analysis", "synthesis", "web_research"],
    );
  });
});

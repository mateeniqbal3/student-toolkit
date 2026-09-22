import { describe, expect, it } from "vitest";

import { AI_MODELS, DEFAULT_MODEL, resolveModel, thinkingBudgetFor } from "./models";

describe("models", () => {
  it("falls back to the default when a stored choice is no longer offered", () => {
    expect(resolveModel("gemini-2.5-flash")).toBe(DEFAULT_MODEL);
    expect(resolveModel("")).toBe(DEFAULT_MODEL);
    expect(resolveModel("gemini-3.8-flash")).toBe("gemini-3.8-flash");
  });

  it("offers the default as one of the choices", () => {
    expect(AI_MODELS.map((model) => model.id)).toContain(DEFAULT_MODEL);
  });

  it("raises the thinking budget to the least a model will accept", () => {
    // Asking gemini-3.5-flash-lite for no thinking is refused outright.
    expect(thinkingBudgetFor("gemini-3.5-flash-lite", 0)).toBe(128);
    expect(thinkingBudgetFor("gemini-3.5-flash-lite", 2048)).toBe(2048);
    expect(thinkingBudgetFor("gemini-3.6-flash", 0)).toBe(0);
    expect(thinkingBudgetFor("something-new", 0)).toBe(0);
  });
});

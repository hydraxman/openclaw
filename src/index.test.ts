import { describe, expect, it } from "vitest";
import { normalizeE164 } from "./index.js";

describe("normalizeE164", () => {
  it("strips formatting and whitespace", () => {
    expect(normalizeE164("+1 555 555 0123")).toBe("+15555550123");
  });

  it("adds plus when missing", () => {
    expect(normalizeE164("1555123")).toBe("+1555123");
  });
});

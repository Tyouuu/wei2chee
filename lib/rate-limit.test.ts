import { describe, it, expect, vi } from "vitest";
import { evaluateRateLimit } from "./rate-limit";

describe("evaluateRateLimit", () => {
  it("allows the request when under the limit", () => {
    const now = Date.now();
    const recentEvents = [now - 1000, now - 2000]; // 2 events
    const result = evaluateRateLimit(recentEvents, now, { limit: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks the request when at the limit", () => {
    const now = Date.now();
    const recentEvents = Array.from({ length: 5 }, (_, i) => now - i * 1000);
    const result = evaluateRateLimit(recentEvents, now, { limit: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("ignores events outside the window", () => {
    const now = Date.now();
    const recentEvents = [now - 120_000]; // 2 minutes ago, outside a 60s window
    const result = evaluateRateLimit(recentEvents, now, { limit: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
  });
});

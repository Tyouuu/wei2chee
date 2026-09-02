import { describe, it, expect } from "vitest";
import { roomForAnother, CEILING_MS } from "./retry-budget";

/**
 * 还有没有时间再打一次。
 *
 * The questionnaire is the slowest call this product makes, and it runs on the
 * landing page in front of a stranger who has just spent two minutes describing
 * his business. Measured 2026-08-31 by walking the real route
 * (`npm run check:analyze`): one attempt took 47.5s, against an eval:analysis
 * median of 28.6s.
 *
 * The failure this guards is specific: a slow first attempt fails, a blind
 * retry starts anyway, and the visitor is held for a second one of those when a
 * deterministic fallback could have answered him.
 *
 * ⚠️ THE CEILING IS ABOUT HIM, NOT ABOUT THE PLATFORM — and the first version of
 * this file got that wrong. It used 57s, derived from a maxDuration of 60 that
 * we had written ourselves and that I reported to the founder as the host's
 * rule. Vercel's limit is 300s on the free plan. Reading our own number as a law
 * of nature cost the retry its entire useful range: at the ordinary speed of
 * this call, two attempts did not fit inside a ceiling that did not exist.
 */
describe("whether there is room for a second attempt", () => {
  it("retries after a quick failure, which is the kind a retry fixes", () => {
    expect(roomForAnother(2_000, 2_000)).toBe(true);
  });

  it("retries after a median-length one, which the old ceiling wrongly forbade", () => {
    // 28.6s is the measured median. Two of those is 57.2s — under the old
    // self-imposed 57s ceiling this returned false, so the retry was dead for
    // every normal-speed failure.
    expect(roomForAnother(28_600, 28_600)).toBe(true);
  });

  it("does NOT retry after the slow tail that was actually observed", () => {
    // The 47.5s call. A second one of those ends near 95s, and the fallback
    // answers him sooner than that without spending anything.
    expect(roomForAnother(47_500, 47_500)).toBe(false);
  });

  it("leaves room for the response and the ledger row, not just the call", () => {
    // The row is written in a `finally` after the model returns, and the reply
    // still has to be serialised. Exactly at the ceiling is not enough.
    expect(roomForAnother(CEILING_MS / 2, CEILING_MS / 2)).toBe(false);
  });

  it("judges by the attempt that just failed, not by a fixed cutoff", () => {
    // Same elapsed time, two different first attempts. A constant cutoff cannot
    // tell these apart; the cost of the next try is what decides.
    expect(roomForAnother(60_000, 5_000)).toBe(true);
    expect(roomForAnother(60_000, 40_000)).toBe(false);
  });
});

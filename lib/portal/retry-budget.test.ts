import { describe, it, expect } from "vitest";
import { roomForAnother, CEILING_MS } from "@/lib/portal/retry-budget";

/**
 * 还有没有时间再打一次。
 *
 * The questionnaire is the slowest call this product makes and it runs on the
 * landing page, in front of a stranger, before he has an account. Measured
 * 2026-08-31 by walking the real line (`npm run check:analyze`): one attempt
 * took 47.5s, against an eval:analysis median of 28.6s. The route's ceiling is
 * 60s.
 *
 * So the failure this guards is specific: a slow first attempt fails the
 * schema, a blind retry starts anyway, the platform hangs up mid-call, and the
 * visitor watches a full minute and receives NOTHING -- while a deterministic
 * fallback was available the whole time.
 */
describe("whether there is room for a second attempt", () => {
  it("retries after a quick failure, which is the kind a retry fixes", () => {
    expect(roomForAnother(2_000, 2_000)).toBe(true);
  });

  /*
    THE FINDING THIS TEST WAS WRITTEN EXPECTING THE OPPOSITE OF.

    28.6s is the measured MEDIAN. Two of those is 57.2s against a 60s ceiling,
    so at the ordinary speed of this call there is no room for a second one --
    and there never was. The blind retry that shipped before today was, for any
    failure that arrived at a normal speed, a second billed call that the
    platform was always going to cut off.

    So the retry is real only for FAST failures: a refused connection, a 429, a
    reply that comes back malformed early. Everything else goes to the
    deterministic fallback, which is the answer the visitor can actually be
    given inside the minute.
  */
  it("does NOT retry after a median-length attempt, because two do not fit", () => {
    expect(roomForAnother(28_600, 28_600)).toBe(false);
  });

  it("does NOT retry after the slow tail that was actually observed", () => {
    // The 47.5s call. A second one of those ends at 95s against a 60s ceiling.
    expect(roomForAnother(47_500, 47_500)).toBe(false);
  });

  it("leaves room for the response and the ledger row, not just the call", () => {
    // Exactly at the ceiling is not enough: the row is written in a `finally`
    // after the model returns, and the reply still has to be serialised.
    expect(roomForAnother(CEILING_MS / 2, CEILING_MS / 2)).toBe(false);
  });

  it("judges by the attempt that just failed, not by a fixed number", () => {
    // The same elapsed time, two different first attempts: one leaves room,
    // one does not. A constant cutoff cannot tell these apart.
    expect(roomForAnother(20_000, 1_000)).toBe(true);
    expect(roomForAnother(20_000, 40_000)).toBe(false);
  });
});

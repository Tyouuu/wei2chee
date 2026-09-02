/**
 * ...BUT ONLY IF THERE IS TIME LEFT TO SPEND ON IT.
 *
 * This route declares maxDuration = 60. Measured 2026-08-31 by walking the real
 * line end to end (`npm run check:analyze`): ONE attempt took 47.5s, against an
 * eval:analysis median of 28.6s and p95 of 34.1s. The tail on this call is long.
 *
 * A blind retry after a slow failure is the worst outcome available: the second
 * call is billed, the platform cuts the request off before it returns, and the
 * visitor watches the whole minute and receives nothing — when a deterministic
 * fallback was sitting right there.
 *
 * So the budget is self-calibrating rather than a guessed constant: a second
 * attempt costs about what the first one cost, so retry only while there is
 * room for another one of those plus the couple of seconds the response and the
 * ledger row need. A fast failure — the kind a retry actually fixes — always
 * clears this. A slow one goes to the fallback, on time.
 */
export const CEILING_MS = 57_000;
export const roomForAnother = (spentSoFar: number, lastAttemptMs: number) =>
  spentSoFar + lastAttemptMs + 3_000 < CEILING_MS;

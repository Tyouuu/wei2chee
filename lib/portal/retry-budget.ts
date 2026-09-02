/**
 * ...BUT ONLY IF THERE IS TIME LEFT TO SPEND ON IT.
 *
 * Measured 2026-08-31 by walking the real
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
/**
 * HOW LONG WE ARE WILLING TO MAKE HIM WAIT — not when the platform gives up.
 *
 * The first version of this was 57s, derived from a maxDuration of 60 that we
 * had written ourselves and that I had reported to the founder as the host's
 * rule. The host's rule is 300s. Reading a self-imposed number as a law of
 * nature and then designing around it is worse than having no limit at all.
 *
 * So the real constraint is the visitor, and it deserves to be named as one.
 * 90s is a judgement, not a measurement — I have no data on what a Malaysian
 * contractor will sit through on a landing page — and it is set where it is
 * because the observed slow attempt was 47.5s: a retry after a FAST failure
 * still fits comfortably, a retry after a slow one does not, and the
 * deterministic fallback answers that case inside the minute instead.
 *
 * If we ever measure how long people actually wait before leaving, this is the
 * one number to move.
 */
export const CEILING_MS = 90_000;
export const roomForAnother = (spentSoFar: number, lastAttemptMs: number) =>
  spentSoFar + lastAttemptMs + 3_000 < CEILING_MS;

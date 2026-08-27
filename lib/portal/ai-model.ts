/**
 * Which model, and how hard it thinks. One place.
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * This string was written out in eight places: both routes, both evals, the
 * spec page, the price table, the cost script. That is the failure this repo
 * keeps having in other forms -- a fact stated in several places outlives the
 * thing it describes, and the copies drift without anybody noticing.
 *
 * Here it costs something specific. The evals exist to say whether the
 * assistant still understands people; an eval left pointing at the old model
 * after the routes moved would keep printing a confident score for something
 * no customer is talking to. And a model gets retired on somebody else's
 * schedule, not ours.
 *
 * ── CHANGING IT ───────────────────────────────────────────────────────────
 *
 * Change it here, then:
 *   1. add its price to PRICE_PER_MTOK in ai-usage.ts -- a test fails until
 *      you do, because a missing price makes check:ai-cost print 「价格未知」
 *      quietly and the bill stops being answerable
 *   2. `npm run eval:editor -- --n 2` and `npm run eval:analysis`. A model
 *      change is a behaviour change; the rulers are the only thing that says
 *      by how much
 *   3. re-read the latency line at the bottom of the eval. maxDuration on both
 *      routes is set against a measured number, and a slower model moves it
 */
export const AI_MODEL = "gpt-5.6-luna";

/**
 * WHY "high", AND WHAT IT COSTS.
 *
 * Reasoning tokens are billed as output and never appear in the reply --
 * measured at ~185 of ~307 output tokens per edit, so most of what we pay for
 * on the output side is thinking nobody reads. It buys the operation being
 * right: this model emits a structured edit against a customer's real page,
 * where a wrong id or a wrong operation is a change he did not ask for.
 *
 * Whether "medium" would score the same for less is an open question and the
 * eval can answer it -- change this line, run `eval:editor -- --n 2`, compare
 * 听得懂 / 改到了 / 每次一样 and the latency line. Nobody has run that yet.
 */
export const AI_REASONING_EFFORT = "high" as const;

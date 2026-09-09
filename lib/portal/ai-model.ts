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
 * 🔴 把他讲的话变成字的那一支。跟上面那一支是两回事。
 *
 * ── 为什么要有它（2026-09-09）─────────────────────────
 *
 * Gartner：**2026 年 75%** 的外勤公司会用语音；ServiceTitan《2026 行业
 * AI 报告》：**12% 已经在用、34% 在试**。而这个仓库量出来是
 * **零个语音输入**。一个戴着手套、手上带油的师傅，打不了字。
 *
 * ── 🔴 为什么不用浏览器自己那一支（免费的）──────────────
 *
 * `webkitSpeechRecognition` 不用钱，而它**一次只听得懂一种话**。
 * 我们卖的这个市场讲的是一句里混三种：「陈太太 deposit 三千」。
 * 锁死一种语言的引擎在那一句上会吐出垃圾，而垃圾会被当成指令。
 * （而且 Chrome 那一支会把声音送到 Google —— 那是他生意上的事。）
 *
 * ⚠️ **它的价钱没有进 `PRICE_PER_MTOK`** —— 那张表算的是 token，
 * 而转录计价的单位跟它不同。我**没有查到可靠的单价**（[重点 15]：
 * 查不到就写查不到，不要编一个）。用量照样记进 `ai_usage`，
 * 而 `check:ai-cost` 会对它印「价格未知」—— 那是实话。
 */
export const AI_HEAR_MODEL = "gpt-4o-mini-transcribe";

/**
 * WHY "high", AND WHAT IT COSTS.
 *
 * Reasoning tokens are billed as output and never appear in the reply --
 * measured at ~185 of ~307 output tokens per edit, so most of what we pay for
 * on the output side is thinking nobody reads. It buys the operation being
 * right: this model emits a structured edit against a customer's real page,
 * where a wrong id or a wrong operation is a change he did not ask for.
 *
 * ── MEASURED 2026-08-27, AND THE ANSWER IS NOT ABOUT THE MONEY ────────────
 *
 * 100 real calls at each setting (`npm run eval:editor -- --n 2 --effort medium`):
 *
 *                 听得懂   改到了   每次一样   中位    p95    输出 tok
 *   high           100%    100%     100%     3.7s   7.2s    311
 *   medium          98%     99%      98%     2.8s   5.7s    231
 *
 * Medium is a second faster and 80 output tokens cheaper -- which at this
 * volume is fractions of a cent, so the money was never the argument.
 *
 * WHAT IT LOSES IS THE PRODUCT. The case medium failed 0 out of 2 is:
 *
 *     「客人一直打电话问进度，我每次都要翻 WhatsApp」
 *
 * That is not an instruction, it is a contractor describing his day. The right
 * answer is a 进度 column on the jobs table he already has; medium answered by
 * REARRANGING THE PAGE. Understanding an owner who describes a problem instead
 * of specifying a change is the whole reason this feature exists -- it is what
 * a page builder cannot do -- and it is precisely what the cheaper setting
 * stops doing.
 *
 * So: high, and this is settled unless somebody re-measures. Re-run the two
 * lines above before reopening it; do not reason about it from the prices.
 */
export const AI_REASONING_EFFORT = "high" as const;

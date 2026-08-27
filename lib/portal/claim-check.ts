/**
 * 它宣称的事，到底有没有发生。
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * Eleven times in this repository the assistant has told a customer it changed
 * something and the page has not moved. 换排法 written to a column the browser
 * never read. A 表格 that travelled to the bottom while the reply said 「已移到
 * 上面」. A `set_text` onto a field the component does not declare, reported as
 * 「改了 1 处」. Each was found separately, and each was fixed by connecting one
 * more wire.
 *
 *   十一次同一种病，不是十一个 bug，是一个缺失的机制。
 *
 * The mechanism that is missing is this: THE SENTENCE IS WRITTEN BEFORE THE
 * WORK IS DONE. The model composes its explanation while emitting operations;
 * `applyLayoutOps` runs afterwards and knows exactly what landed and what it
 * refused; the browser then applies design changes and knows which RPCs
 * succeeded. All of that is known -- and the reply is shown verbatim anyway.
 *
 * So this is the check between the two: the assistant may only keep its
 * sentence if something it attempted actually happened.
 *
 * ── WHAT THIS IS NOT ──────────────────────────────────────────────────────
 *
 * NOT a substitute for wiring things up correctly. It cannot see a field that
 * is written successfully and simply never rendered, because from here that is
 * indistinguishable from a real edit. It is a net under the seam where all
 * eleven fell, not a proof that the page moved.
 *
 * NOT a reason to loosen anything upstream. Every one of those eleven should
 * still be fixed at its cause; this exists so the twelfth is caught the day it
 * ships instead of the day the founder happens to look.
 */

export type ClaimInputs = {
  /** Operations that landed, from applyLayoutOps. */
  applied: number;
  /** Operations the schema or the applier turned away. */
  skipped: number;
  /** 风格 / 配色 / 排法 RPCs the browser decided to make. */
  designPlanned: number;
  /** Whether any of those RPCs came back without an error. */
  designLanded: boolean;
};

/**
 * May the assistant's own sentence stand?
 *
 * The distinction is between an answer that ATTEMPTED a change and one that
 * did not. A refusal, a question, and an offer all attempt nothing -- their
 * sentence is the whole answer and is true regardless. An answer that emitted
 * operations or a design change is making a claim about the page, and that
 * claim is only true if something landed.
 */
export function claimStands({ applied, skipped, designPlanned, designLanded }: ClaimInputs): boolean {
  const attempted = applied > 0 || skipped > 0 || designPlanned > 0;
  // 「我做不到」「你是指哪一个」「我可以帮你加一页」-- nothing was attempted, so
  // there is nothing to contradict.
  if (!attempted) return true;
  return applied > 0 || designLanded;
}

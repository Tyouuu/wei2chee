import { REGISTERED_COMPONENTS } from "@/lib/portal/layout-ops";

/**
 * Rules about a block that its name and its fields do not say.
 *
 * ── WHERE THIS CAME FROM ──────────────────────────────────────────────────
 *
 * Puck's own AI reference declares these on the config: "always the first
 * component on a page", "one per page", "at most ~8 words or it wraps". We had
 * none, and the honest first step was to find out whether we needed any.
 *
 * MEASURED BEFORE WRITING ANY. What the model WRITES is already short --
 * 「收款进度」, 「本月收款」 -- so the word-count half of that idea buys us
 * nothing and is not here. Placement and cardinality had never been measured,
 * so they were, with two cases at n=2:
 *
 *   「帮我加一个工程进到哪一步的流程」  the page already has a WorkflowStrip
 *                                    -> set_workflow both times. Correct
 *                                       without being told. No rule needed.
 *   「上面再加一个标题」               -> add_component PageHeader once,
 *                                       「好，在现有标题上面加了一个标题栏。」
 *
 * So there is exactly one rule in this file, and that is the point. Puck's
 * reference warns against inventing constraints you have no evidence for, and
 * a rule that fires on nothing is paid for on every single generation while
 * teaching the model nothing.
 *
 * ── WHY NOT ON THE COMPONENT ──────────────────────────────────────────────
 *
 * Puck puts these on the config, beside the component, which is the better
 * home: the constraint travels with the thing it constrains. At one rule that
 * would be a field system serving a single value, so it lives here until there
 * is a second and a third. `blockRulesTargetRealComponents` is what stops this
 * file from rotting the way a hand-written list always does -- a rule naming a
 * block that has been cut fails the build instead of teaching the model about
 * something that no longer exists.
 */
export const BLOCK_RULES: Record<string, string> = {
  /*
    A page has one title. A second PageHeader is not a heading -- it is two
    pages stacked, and it reads as the system being broken rather than as the
    section break the owner had in mind. There is no section-heading block to
    send him to instead, so the honest answer is to change the title he has or
    ask what he actually wants up there.
  */
  PageHeader: "一页只有一个页面标题。已经有一个的时候，改它的字，不要再加一个。",
};

/** The rules as prompt lines, or "" when there are none that apply. */
export function renderBlockRules(): string {
  const lines = Object.entries(BLOCK_RULES).map(([name, rule]) => `- ${name}: ${rule}`);
  return lines.join("\n");
}

/**
 * Every rule names a block that exists.
 *
 * The fourth guard of this shape in the repo, and every one of them was added
 * after a hand-written list quietly outlived what it described: 9 variant
 * preferences pointing at variants that had been renamed, a register list three
 * days stale, 45 style preferences that `defaultProps` had been silently
 * beating. A rule about 「玻璃」 costs tokens on every call and describes a block
 * that was cut in August.
 */
export function blockRulesTargetRealComponents(): string[] {
  return Object.keys(BLOCK_RULES).filter((name) => !REGISTERED_COMPONENTS.includes(name));
}

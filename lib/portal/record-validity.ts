/**
 * 一张单的日子 —— 有效期、期限、预计到货，跟「这个日子过了没有」。
 *
 * ── 为什么这个档案存在 ────────────────────────────────────────────────────
 *
 * `pipeline_records.due_on` 从建表那天（20260830040000）就在，`add_pipeline_record`
 * 跟 `update_pipeline_record` 两支都收 `in_due_on` —— 而 2026-09-03 全 app grep
 * 下来 **零个 TypeScript 读它或写它**。这是这个仓库第十六次「能力有、线没接」：
 * 栏位在、函式收、没有人传。
 *
 * 所以「报价有效期」不需要新栏位，它需要这条线。
 *
 * ── 抄的是谁 ──────────────────────────────────────────────────────────────
 *
 * ERPNext 的 Quotation（读的是 doctype 原文，不是首页）：`valid_till: Date`，
 * 而 status 那一栏的选项里有 `Expired`。他们跑一支每天的排程去把 Open 翻成
 * Expired。
 *
 * ⚠️ 我们不抄那一半，而且要讲清楚为什么：
 *
 *   **过期是算出来的，不是存起来的。**
 *
 * 一个存起来的旗子，在排程没跑的那一天就在说谎；一个算出来的，永远不会。
 * 这跟这个仓库已经做对两次的判断是同一条 —— 库存的总数是流水加起来的
 * （20260901070000），工程的完成度是算出来的不是人手填的（任务 61）。
 * 而且它省掉一整支排程：没有排程就没有「排程挂了而没有人知道」。
 *
 * ── 它不是什么 ────────────────────────────────────────────────────────────
 *
 * 过期 **不会动 stage**。stage 是老板自己流程里的那一格，是他的判断；
 * 过期是日历的事实。一个把他的单从「等回覆」偷偷搬到「过期」的系统，
 * 是在替他做一个他没有做的决定。
 */

/** 这一个模块的日子叫什么。三种意思，同一栏。 */
export type ValidityKind =
  /** 报价单：过了这天，这个价钱不算数了 */
  | "validTill"
  /** 订单 · 工程 · 任务：答应人家的日子 */
  | "deadline"
  /** 进货单：货预计什么时候到 */
  | "expected";

/**
 * 同一栏 `due_on`，在三种单上是三件事，所以字不一样。
 *
 * ⚠️ 用模块的 key 判，不是用 shape 判：五个模块都是 pipeline，
 * 而一张报价单的「有效期」跟一张进货单的「预计到货」不是同一句话。
 */
export function validityKindOf(moduleKey: string | null | undefined): ValidityKind | null {
  switch ((moduleKey ?? "").trim()) {
    case "quotations":
      return "validTill";
    case "orders":
    case "projects":
    case "tasks":
      return "deadline";
    case "purchases":
      return "expected";
    default:
      return null;
  }
}

/**
 * 报价单预设 +30 天 —— 那是 ERPNext 的预设，也是这一行的惯例。
 *
 * ⚠️ 只有报价单有预设。一张工程单的期限是老板跟客人谈出来的日子，
 * 替他猜一个填进去，比留白更糟：留白他会去填，一个猜的他会以为是真的
 * （跟他自己 vibe-dealer 0044 写下的那条理由一模一样 ——
 * 「a placeholder cannot be told from the real thing」）。
 */
export const DEFAULT_VALID_DAYS = 30;

export function defaultDueOn(
  kind: ValidityKind | null,
  issuedOn: string,
  days: number = DEFAULT_VALID_DAYS,
): string | undefined {
  if (kind !== "validTill") return undefined;
  const t = Date.parse(`${issuedOn}T00:00:00Z`);
  if (!Number.isFinite(t)) return undefined;
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}

/**
 * 马来西亚的今天，不是伺服器的。伺服器跑 UTC，而半夜十二点到早上八点之间
 * 那两个日子不一样 —— 一张今天到期的单会在他还在用的时候提早一天变红。
 *
 * 资料库那一边已经有 `public.today_myt()`（20260831030000）。这是它在
 * 浏览器这一边的同一件事。
 */
export function todayMYT(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export type PastDueInput = {
  dueOn: string | null | undefined;
  /** 这一单现在在哪一格 */
  stage?: string | null;
  /** 这门生意自己的流程。最后一格代表「done」。 */
  workflow?: readonly string[];
  archivedAt?: string | null;
  today?: string;
};

/**
 * 这个日子过了没有 —— 而且这一单还开着。
 *
 * 三种不算：
 *   · 没有日子（大部分单本来就没有）
 *   · 已经收起来了
 *   · 已经走到流程最后一格 —— 一张成交的报价单不会过期
 *
 * ⚠️ 流程是空的时候不猜。那时候只有「收起来」能排除它，
 * 而那是诚实的：我们真的不知道哪一格算结束。
 */
export function isPastDue(input: PastDueInput): boolean {
  const due = (input.dueOn ?? "").trim();
  if (!due) return false;
  if (input.archivedAt) return false;

  const flow = (input.workflow ?? []).map((s) => s.trim()).filter(Boolean);
  const stage = (input.stage ?? "").trim();
  if (flow.length && stage && stage === flow[flow.length - 1]) return false;

  return due < (input.today ?? todayMYT());
}

/**
 * 还剩几天。负数是过了几天。
 * 拿来讲「还有 3 天」跟「过了 12 天」—— 一个日期他要自己算，一个天数不用。
 */
export function daysLeft(dueOn: string | null | undefined, today?: string): number | null {
  const due = (dueOn ?? "").trim();
  if (!due) return null;
  const a = Date.parse(`${due}T00:00:00Z`);
  const b = Date.parse(`${today ?? todayMYT()}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((a - b) / 86400000);
}

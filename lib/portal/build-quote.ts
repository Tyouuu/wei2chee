import { MODULE_CATALOG, type ModuleShape } from "./module-catalog";

/**
 * 开发费怎么算 —— 按**形状**算，不按模块算。
 *
 * ── 为什么存在 ──────────────────────────────────────────────────────────────
 * 老板 2026-09-01：`Rm500的开发费太低了吧 我们每一个模版的开发收多少钱`。
 *
 * 先纠正那句话里的一个混淆（他也接受了）：**RM 500 是规格书的钱，不是开发费**。
 * 开发费是另一笔，规格书上写着「每一块的价钱写在里面」——
 * 而在这个档案之前，**十八个模块一个价钱都没有**，那句话是一个填不出来的承诺，
 * 每一单靠 `console_set_fees` 手打一个数字。
 *
 * ── 为什么按形状，这是数出来的不是想出来的 ──────────────────────────────────
 * 十八个模块塌缩成十个形状，而前三个吃掉一半：
 *
 *     走单 pipeline   报价单 · 订单 · 工程 · 任务 · 进货单   5 个
 *     记帐 ledger     收款 · 开销 · 佣金                     3 个
 *     名册 directory  客户 · 供应商 · 员工                   3 个
 *
 * **做订单的时候，报价单那套底子已经在了。** 按模块一口价收，
 * 等於把自己省下来的工时送给客户；而按形状收，价目表自己反映
 * [任务 41](../../docs/founder-tasks.md) 讲的那件事 —— 第二个同形状的模块是拼的，不是写的。
 *
 * ⚠️ **三个数字是从老板自己以前开的 RM 5,000 倒推的，不是从市场量的。**
 * [任务 22](../../docs/founder-tasks.md) 记着：本地开发公司的报价页读不到，
 * 所以「一套手工系统市价多少」**没有数字**。这里给的是一个**结构**；
 * 数字改一行就换掉，而结构不用动。
 *
 * ⚠️ **价钱不写进 MODULE_CATALOG 的每一条。** 那会变成十八个各自漂移的数字，
 * 而它们本来就只由「形状」跟「第几个」决定 —— 一个事实一个来源
 * （这个仓库因为「同一件事写在两个地方」栽过五次）。
 */

/** 起底：登入 · 权限 · 外壳 · 官网。每一单都要，跟挑了几个模块无关。 */
export const BUILD_BASE_MYR = 1500;
/** 一个形状的**第一个**模块：那套底子要从零做。 */
export const SHAPE_FIRST_MYR = 800;
/** 同一个形状**再加一个**：拼的，不是写的。 */
export const SHAPE_REPEAT_MYR = 300;
/** 规格书的钱，付了之后从开发费里扣掉。 */
export const SPEC_FEE_MYR = 500;

export type QuoteLine = {
  moduleKey: string;
  shape: ModuleShape;
  /** 这是这个形状的第几个（1 起算）。 */
  nth: number;
  amountMyr: number;
};

export type BuildQuote = {
  baseMyr: number;
  lines: QuoteLine[];
  /** 起底 + 每一行。**还没扣规格书。** */
  subtotalMyr: number;
  /** 规格书抵扣（老板 2026-09-01 拍板要抵）。永远是 0 或 SPEC_FEE_MYR。 */
  specCreditMyr: number;
  /** 客户真正要付的开发费。 */
  totalMyr: number;
};

/**
 * 算一单的开发费。
 *
 * @param moduleKeys 这个客户系统里有哪几个模块（`project_pages.page_key`）。
 * @param specPaid   规格书付过没有。付过就从开发费里扣掉那 RM 500。
 *
 * ⚠️ **认不得的 key 直接跳过，不猜。** 一个不在目录里的模块通常是旧页面或打错，
 * 而**在报价上多算一笔客户没有的东西，比少算一笔严重得多**。
 */
export function buildQuote(moduleKeys: readonly string[], specPaid = false): BuildQuote {
  const shapeOf = new Map(MODULE_CATALOG.map((m) => [m.key, m.shape]));
  const seen = new Map<ModuleShape, number>();
  const lines: QuoteLine[] = [];

  for (const key of moduleKeys) {
    const shape = shapeOf.get(key);
    if (!shape) continue;
    const nth = (seen.get(shape) ?? 0) + 1;
    seen.set(shape, nth);
    lines.push({
      moduleKey: key,
      shape,
      nth,
      amountMyr: nth === 1 ? SHAPE_FIRST_MYR : SHAPE_REPEAT_MYR,
    });
  }

  const subtotalMyr = BUILD_BASE_MYR + lines.reduce((n, l) => n + l.amountMyr, 0);
  const specCreditMyr = specPaid ? SPEC_FEE_MYR : 0;
  return {
    baseMyr: BUILD_BASE_MYR,
    lines,
    subtotalMyr,
    specCreditMyr,
    totalMyr: subtotalMyr - specCreditMyr,
  };
}

/** 一个模块在文件里该叫什么。规格书是给人读的，`quotations` 不是一个词。
 *  ⚠️ 走 MODULE_CATALOG 自己的 label —— 不要在这里再手写一份对照表。 */
export function moduleLabelFor(key: string, lang: "zh" | "en"): string {
  const m = MODULE_CATALOG.find((x) => x.key === key);
  if (!m) return key;
  return lang === "en" ? m.labelEn || m.label : m.label;
}

/** `RM 5,800`。规格书跟报价单都印这个格式。 */
export function formatMyr(amount: number): string {
  return `RM ${amount.toLocaleString("en-MY")}`;
}

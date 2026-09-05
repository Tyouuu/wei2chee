/**
 * 哪几种单发得给客人看，哪几种他答得了。
 *
 * ── 为什么这一份存在 ──────────────────────────────────────────────────────
 *
 * 资料库那一边有两支 immutable 函式（`is_shareable_module` ·
 * `is_answerable_module`，20260905230000），而画面要在**画那颗按钮之前**
 * 就知道答案 —— 不然就是画一颗按下去会被拒绝的按钮。
 *
 * 🔴 **所以这里必然是第二份。** 而这个仓库栽在「第二份手写清单」上
 * 至少八次（`PIPELINE_MODULES` 一天里被抄成两份 · 三份同样的 key 清单 ·
 * 九份同一行小标题…）。分开写没关系，**分开漂就有关系** ——
 * 所以 `shared-record.test.ts` 直接去读那支 migration 的原文来对，
 * 哪一天资料库那一边多一种单而这里没跟上，它会红。
 */

/** 发得给客人看的（`is_shareable_module`）。 */
export const SHAREABLE_MODULES = ["quotations", "orders", "projects"] as const;

/** 他答得了的（`is_answerable_module`）。
 *  ⚠️ 一张已经在做的工程没有「同意」这个动作 —— 那一页是拿来看进度的。 */
export const ANSWERABLE_MODULES = ["quotations", "orders"] as const;

export const isShareableModule = (k: string): boolean =>
  (SHAREABLE_MODULES as readonly string[]).includes(k);

export const isAnswerableModule = (k: string): boolean =>
  (ANSWERABLE_MODULES as readonly string[]).includes(k);

import type { StyleName } from "@/app/[locale]/style-picker/style-column";

/**
 * 系统只有一套样子。
 *
 * 老板 2026-09-04：`其他风格不是不用了吗 我现在只需要你一个UI风格for 我的system only`
 * · `做好一套就可以了`。
 *
 * ── 这个档案在分哪两件事 ──────────────────────────────────────────────────
 *
 * `projects.style` 从今天起只管**一个**画面：客户的官网 `/s/<slug>`。
 * 那一层的多样性是我们卖的东西本身 —— 两家装修公司的官网不可以长一样，
 * 而四家对手一家都不给官网（[重点 9c](../../docs/founder-points.md)）。
 *
 * **工作台不是那件事。** 一个老板一个礼拜之后就不看后台的漆了，
 * 而每加一个零件我们要做六次。所以后台收敛成一套，而那一套是他自己挑的：
 * `arhamkhnz/next-shadcn-admin-dashboard`（MIT · 同一个栈 · 有源代码）,
 * 逐项复刻在 [任务 120](../../docs/founder-tasks.md)。
 *
 * ── 为什么是一个常数，不是「把六套的后台层调成一样」 ────────────────────
 *
 * 因为那会写出六份同样的真相。而且做不到：site 组件读 `var(--color-*)`
 * **230 次**，那些 `--color-*` 就住在每一套 register 的档案里 ——
 * 把 hearth.css 的 `--color-*` 改成 swiss 的，会把 hearth 的**官网**一起重漆。
 * 两个画面共用一份 token 档，所以要分的是**读它的人**，不是档案。
 *
 * ⚠️ **键名还叫 `swiss`，而它已经不是「瑞士」那一套的意思了。**
 * 改名要动 token 档、`style-scope.module.css`、`STYLE_ORDER`、
 * 资料库那条 check 约束跟每一个客户已经存着的值 —— 那是一次迁移，不是一次改名。
 * 在那之前，这里的注解就是那个名字的解释。
 */
export const SYSTEM_REGISTER: StyleName = "swiss";

/** 官网那一页 —— 全系统唯一一个陌生人打得开的画面，也是唯一还跟着客户挑的
 *  风格走的画面。其余每一页都是工作台，一律 `SYSTEM_REGISTER`。 */
export const SITE_PAGE_KEY = "website";

/**
 * 这一块画布该穿哪一套。
 *
 * 编辑器同一支组件同时画工作台跟官网（`pageKey === "website"` 这个判断在
 * `editor-client.tsx` 里已经用了十几处），所以分界线就长在那里，不是新发明的。
 *
 * @param pageKey  这一页是哪一页
 * @param siteStyle  客户自己挑的那一套（`projects.style`）—— 只有官网读它
 */
export function canvasRegister(
  pageKey: string,
  siteStyle: StyleName | null | undefined,
): StyleName {
  if (pageKey === SITE_PAGE_KEY) return siteStyle ?? SYSTEM_REGISTER;
  return SYSTEM_REGISTER;
}

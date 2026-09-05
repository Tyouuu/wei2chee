/**
 * 他的工作台上的零件 —— **产品那一边，不是平台那一边**。
 *
 * ── 为什么这一份跟 `kit.tsx` 分开（2026-09-06）──────────────────────────
 *
 * 老板那一天讲了两句，而两句是同一件事：
 *
 *   「不是這個黑色的那個白色的啊 我們的system的Ui啊」
 *   「你要分清楚我们的产品 跟我们的平台 是两个事情来的」
 *
 * **平台**是 Formae 自己的建造工具：首页 · 素材库 · 编辑器 · 风格 · 帐号。
 * 深色壳，永远只有一个样子，零件在 `kit.tsx`。
 *
 * **产品**是他每天拿来跑生意的那一套：帐 · 薪水 · 税 · 保养 · 车牌 ·
 * 效期 · 借出去的 · 谁欠我钱 · 要跟的 · 分店。浅色，**穿他自己选的那一套**。
 *
 * 两边的 token **名字一样**（`--color-ink-900` 是面、`--color-paper` 是字），
 * 所以 class 长得很像 —— 而它们解析出来是两套颜色，这正是为什么
 * 两份不可以合成一份：`kit.tsx` 的焦点色是 Formae 的 `--color-brand`（青），
 * 而他的工作台上那个青不属於任何一套风格。
 *
 * ── 🔴 一屏只有一颗主要按钮 ────────────────────────────────────────────
 *
 * 他挑的那一套参考（arhamkhnz）整页只有一颗近黑的按钮，其余全是描边。
 * 而我第一版把每一颗都做成描边 —— 於是「开一次薪水」跟「保存」看起来
 * 一样重，一屏上没有任何东西告诉他下一步按哪一颗。
 *
 * ⚠️ `--color-primary` 在工作台上被 `globals.css` 盖成近黑 `#18181b`
 * （`[data-surface="desk"].ds-ground`），所以这里不写死颜色 ——
 * 写死就等於把那一段盖写复制第二份。
 */

/** 一个打字的格子。高度 44px：手机上拇指按得稳的下限。 */
export const deskField =
  "min-h-11 w-full [background-color:var(--color-ink-900)] [border-radius:var(--radius-control)] " +
  "[border:var(--hairline)_solid_var(--color-ink-800)] [color:var(--color-paper)] " +
  "[font-size:var(--text-sm)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)] " +
  "outline-none focus-visible:[border-color:var(--color-primary)]";

/**
 * 三种按钮。
 *
 *   primary  这一段的下一步。**一段只有一颗**
 *   quiet    其余每一颗
 *   danger   会拿掉东西的那一颗（收起来 · 丢掉 · 冲正）
 */
export function deskBtn(kind: "primary" | "quiet" | "danger" = "quiet") {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap " +
    "[border-radius:var(--radius-control)] [font-size:var(--text-sm)] " +
    "[padding-inline:calc(var(--pad-control-x)*1.2)] transition-colors disabled:opacity-50";
  if (kind === "primary")
    return (
      `${base} [background-color:var(--color-primary)] [color:var(--color-on-primary)] ` +
      "[font-weight:var(--fw-semibold)] enabled:hover:[background-color:var(--color-primary-deep)]"
    );
  if (kind === "danger")
    return (
      `${base} [border:var(--hairline)_solid_var(--color-ink-800)] [color:var(--color-clay-bright)] ` +
      "enabled:hover:[border-color:var(--color-clay-bright)]"
    );
  return (
    `${base} [border:var(--hairline)_solid_var(--color-ink-800)] [background-color:var(--color-ink-900)] ` +
    "[color:var(--color-paper)] enabled:hover:[border-color:var(--color-primary)]"
  );
}

/** 一段说明字。整个工作台只有一种。 */
export const deskDim =
  "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";

/**
 * 一张卡。
 *
 * ── 为什么工作台上要有卡，而平台那一边没有（2026-09-06）─────────────────
 *
 * 老板：**「我不要一直都是相同的组件」**。而量出来他是对的 ——
 * 我那十页全部是同一根骨架：眉标 · 一条细线 · 一串行。
 *
 * 他挑的那一套参考不是这样排的：**它把一页切成几张白卡浮在浅灰的地上**，
 * 而每一张卡自己带一个头（标题在左、这一张自己的动作在右）。
 * `Section` 那条细线是**平台**的语气，卡片是**产品**的语气。
 *
 * `.ds-card` 是这一套 token 本来就有的面，只是工作台这一边从来没有人用。
 */
export function DeskCard({
  title,
  action,
  children,
  className = "",
  titleWideOnly = false,
}: {
  title?: string;
  /** 这一张卡自己的动作，右对齐在卡头上。 */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /**
   * 🔴 窄的时候不画这个抬头 —— **左边那一列已经是它了**。
   *
   * 一页分成「左边挑一段 · 右边画那一段」的时候，宽萤幕上那两个抬头
   * 是并排的（分页签 → 那一段）；**到了 390 它们上下叠在一起**，
   * 变成同一句话连印两次。而「同一屏印两次同一件事」正是这个仓库
   * 砍掉过一整套风格的理由。
   */
  titleWideOnly?: boolean;
}) {
  return (
    <section
      className={`ds-card [border-radius:var(--radius-lg)] ${className}`}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 [border-color:var(--color-ink-800)]">
          {title && (
            <h2
              className={
                "[font-size:var(--text-base)] [font-weight:var(--fw-semibold)] [color:var(--color-paper)] " +
                (titleWideOnly ? "max-lg:hidden" : "")
              }
            >
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/** 一张**印出来的纸**，浮在一块灰垫子上。
 *
 *  参考页把预览做成这个样子，而那不是装饰：一张纸跟一张表单摆在一起的时候，
 *  垫子是唯一告诉他「右边这个是要拿给别人的东西」的东西。 */
export function DeskSheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="[background-color:var(--color-ink-950)] [border-radius:var(--radius-md)] p-4 sm:p-6">
      <div className="[background-color:var(--color-ink-900)] [border-radius:var(--radius-sm)] [box-shadow:var(--shadow-card,0_1px_2px_rgba(0,0,0,0.06))] p-5 sm:p-7">
        {children}
      </div>
    </div>
  );
}

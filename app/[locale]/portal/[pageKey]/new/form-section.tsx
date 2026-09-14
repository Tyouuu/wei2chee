"use client";

/**
 * 表单卡里的一段 —— 一条细线、一个小标题、右边一颗这一段自己的动作。
 *
 * ── 为什么它存在 ─────────────────────────────────────────────────────────
 *
 * 老板 2026-09-04：`一定要统一设计`。
 *
 * 而他挑的那一套（arhamkhnz 的 `dashboard/invoice`）在填资料那张卡里，
 * **每一段都长同一个样子**：一条横过整张卡的细线 → 小标题在左 →
 * 那一段自己的动作在右（`Billed To ＋Add New Client` ·
 * `Invoice Items ＋Add Item` · `Adjustments`）。
 *
 * 我们本来是：小标题一个一个往下掉，中间没有线，而那一段的动作
 * （「＋ 加一行」「照这一行的惯例填」）画在那一段的**底下**，
 * 长得跟内容一样重。结果是一张卡上五六个小标题，读起来分不出
 * 哪一句是标题、哪一句是内容。
 *
 * ── 它顺手关掉的一件事 ───────────────────────────────────────────────────
 *
 * 那一行小标题的样式，2026-09-04 之前**被手抄了九份**
 * （照片 · 明细 · 分期 · 分摊 · 地址 · 改动 · 来过几次 · 他的单 · 盘点）。
 * 这个仓库栽在「第二份手写拷贝」上至少五次 —— 九份的下场是
 * 改一份、另外八份留在原地，而那正好就是他讲的「像两个人做的」。
 */

export function FormSection({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  /** 卡头的记号——一眼认得出这是哪一段（老板 2026-09-14 讲的）。
      没有就不画，不强求每一段都有。 */
  icon?: React.ReactNode;
  /** 这一段自己的动作，画在标题右边。没有就不画。 */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t [border-color:var(--color-ink-800)] pt-4">
      {/* ⚠️ `min-h-9`：右边那颗动作按钮在工地上要按得到。
          一行只有字的标题画出来 21px 高，而拇指按不准 21px ——
          shoot:commission 在 390 量到过同一件事。 */}
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {/* 🔴 `shrink-0` ＋ 整行 `flex-wrap`：看图才看到的 ——
            「分期付款表」右边有两颗按钮，其中一颗是一句话
            （「照这一行的惯例填」），把标题挤成两行「Payment / schedule」。
            一个被自己那一段的按钮挤断的标题，读起来是坏的。
            现在挤不下的时候**按钮掉到下一行**，标题永远是一行。 */}
        <span className="flex min-w-0 shrink-0 items-center gap-2 [font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {icon ? (
            <span aria-hidden className="shrink-0 text-[color:var(--color-on-canvas-dim)]">
              {icon}
            </span>
          ) : null}
          {title}
        </span>
        {action ? (
          <div className="flex flex-wrap items-center gap-3">{action}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** 一段里面的那种「加一个」——细边框、不抢主要按钮的眼睛。 */
export const sectionAdd =
  "inline-flex min-h-9 items-center [border-radius:var(--radius-md)] border border-dashed px-3 [font-size:var(--text-sm)] [border-color:var(--color-ink-800)] text-[color:var(--color-on-canvas-dim)] hover:[border-color:var(--color-primary)] hover:text-[color:var(--color-on-canvas)]";

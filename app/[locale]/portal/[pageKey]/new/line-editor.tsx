"use client";

import type { RecordFormCopy } from "../record-copy";
import { FormSection, sectionAdd } from "./form-section";

/**
 * 逐项明细 — the lines of one document, edited as a block.
 *
 * ── WHY IT EXISTS ────────────────────────────────────────────────────────
 *
 * A renovation quote is 拆除 RM 3,000 · 泥水 RM 12,000 · 油漆 RM 5,000, and
 * until 20260831150000 this product stored 「RM 20,000」. LHDN's MyInvois also
 * marks Description, Unit Price, Subtotal and Total Excluding Tax as required
 * AT LINE LEVEL, so a system that cannot hold a line cannot issue a legal
 * invoice in this country.
 *
 * ── WHY IT LOOKS LIKE THE FIELDS PANEL'S TABLE EDITOR ────────────────────
 *
 * Because that one already exists (design-system/editor/table-field.tsx) and
 * already answers the same questions: a vertical list of rows on a narrow
 * column, one 「＋」 at the bottom, one 「×」 per row. Inventing a second idiom
 * for the same job is how a product starts feeling like two products.
 *
 * ── THE ONE RULE ─────────────────────────────────────────────────────────
 *
 * 金额 is computed from 数量 × 单价 while both are present, and stays typeable.
 * It has to be both: a lump-sum line has no quantity (「防水工程 RM 4,500」),
 * and a discount agreed on the day is not qty × price. The database stores
 * what is agreed rather than what multiplies out, for exactly that reason.
 */

export type Line = {
  description: string;
  qty: string;
  unit: string;
  unitPrice: string;
  amount: string;
};

export const blankLine = (): Line => ({
  description: "",
  qty: "",
  unit: "",
  unitPrice: "",
  amount: "",
});

/** RM 48,500 · 48500.50 -> sen. Same reading as the form's own senFrom. */
export function senOf(text: string): number | undefined {
  const m = (text ?? "").replace(/[, ]/g, "").match(/-?\d+(\.\d{1,2})?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) ? Math.round(n * 100) : undefined;
}

export function totalOf(lines: Line[]): number {
  return lines.reduce((n, l) => n + (senOf(l.amount) ?? 0), 0);
}

/** 「RM 20,000」 the way a contractor writes it -- no decimals when there are
 *  none. Mirrors ringgit() in live-rows.ts; kept here rather than imported so
 *  this file carries nothing from the server bundle. */
export function ringgitOf(cents: number): string {
  const whole = cents / 100;
  return `RM ${whole.toLocaleString("en-MY", {
    minimumFractionDigits: whole % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** 每一格上面那个小名字。参考页上它是一行灰色小字，不是大写字母。 */
const cell =
  "[font-size:var(--text-xs)] text-[color:var(--color-on-canvas-dim)]";

const control =
  "ds-control h-10 w-full min-w-0 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]";

export function LineEditor({
  lines,
  onChange,
  copy,
}: {
  lines: Line[];
  onChange: (lines: Line[]) => void;
  copy: RecordFormCopy;
}) {
  const set = (i: number, patch: Partial<Line>) => {
    const next = lines.map((l, j) => (j === i ? { ...l, ...patch } : l));
    /* The multiplication happens HERE and not on render, so that a figure he
       typed himself is never overwritten by one we worked out. */
    if (patch.qty !== undefined || patch.unitPrice !== undefined) {
      const l = next[i];
      const q = Number((l.qty ?? "").replace(/,/g, ""));
      const p = senOf(l.unitPrice);
      if (Number.isFinite(q) && q > 0 && p !== undefined) {
        next[i] = { ...l, amount: ringgitOf(Math.round(q * p)) };
      }
    }
    onChange(next);
  };

  const total = totalOf(lines);

  return (
    <FormSection
      title={copy.lines}
      /* 「＋ 加一行」搬到标题右边（2026-09-04，照 arhamkhnz 的
         `Invoice Items ＋Add Item`）。它本来画在明细底下，跟内容一样重 ——
         一段的动作跟一段的内容长得一样，读起来就是分不出哪一句是标题。 */
      action={
        <button type="button" onClick={() => onChange([...lines, blankLine()])} className={sectionAdd}>
          ＋ {copy.lineAdd}
        </button>
      }
    >
      {lines.map((line, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 [border-radius:var(--radius-md)] border p-3 [border-color:var(--color-ink-800)]"
        >
          {/* 🔴 每一格的名字画在框**外面**，不是当提示字画在框里面。
              提示字一打字就不见了 —— 所以一张填好的单，五个框一个名字都没有，
              而那正是参考页上那一行 Description / Units / Unit cost / Line Total
              在回答的事。

              ⚠️ 参考页是**一行一列、上面一条共用的表头**，我们做不到：
              量过，这张卡的内容宽只有 ~470px（1080 的版面对半再扣内距），
              而我们比他们多一个「单位」栏（他们的 Units 是数量，我们的
              「单位」是包/箱）。五栏挤进 470px，最长的那一栏只剩 90px。
              所以名字跟着框走，一行明细就是一小张表。 */}
          <div className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className={cell}>{copy.lineWhat}</span>
              <input
                aria-label={copy.lineWhat}
                value={line.description}
                onChange={(e) => set(i, { description: e.target.value })}
                className={control}
              />
            </label>
            <button
              type="button"
              aria-label={copy.lineRemove}
              onClick={() => onChange(lines.filter((_, j) => j !== i))}
              className="grid h-10 w-9 shrink-0 place-items-center [border-radius:var(--radius-md)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)] hover:[color:var(--color-clay-bright)]"
            >
              ×
            </button>
          </div>
          {/* 🔴 手机上排成两排两个，不是四个挤在一行。
              **那一行本来是故意的**（「四个窄框读起来就是一行报价」），
              而看图看到它的代价：390 的时候「lot」被切成「lo」、
              「RM 3,000」被切成「RM 3,00」——**一个被切断的金额，
              读起来是一个错的数字**，比多占一排严重得多。
              宽的时候还是一行，那一句原话在那个宽度上是对的。 */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
            <label className="flex min-w-0 flex-col gap-1 sm:basis-[18%]">
              <span className={cell}>{copy.lineQty}</span>
              <input
                aria-label={copy.lineQty}
                inputMode="decimal"
                value={line.qty}
                onChange={(e) => set(i, { qty: e.target.value })}
                className={control}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 sm:basis-[18%]">
              <span className={cell}>{copy.lineUnit}</span>
              <input
                aria-label={copy.lineUnit}
                value={line.unit}
                onChange={(e) => set(i, { unit: e.target.value })}
                className={control}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 sm:basis-[30%]">
              <span className={cell}>{copy.linePrice}</span>
              <input
                aria-label={copy.linePrice}
                inputMode="decimal"
                value={line.unitPrice}
                onChange={(e) => set(i, { unitPrice: e.target.value })}
                className={control}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 sm:basis-[34%]">
              <span className={cell}>{copy.lineAmount}</span>
              <input
                aria-label={copy.lineAmount}
                inputMode="decimal"
                value={line.amount}
                onChange={(e) => set(i, { amount: e.target.value })}
                className={control}
              />
            </label>
          </div>
        </div>
      ))}

      {lines.length ? (
        <span className="self-end [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)] tabular-nums">
          {copy.lineTotal} {ringgitOf(total)}
        </span>
      ) : null}
    </FormSection>
  );
}

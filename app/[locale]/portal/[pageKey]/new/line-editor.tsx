"use client";

import type { RecordFormCopy } from "../record-copy";

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
    <div className="flex flex-col gap-3">
      <span className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
        {copy.lines}
      </span>

      {lines.map((line, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 [border-radius:var(--radius-md)] border p-3 [border-color:var(--color-ink-800)]"
        >
          <div className="flex items-start gap-2">
            <input
              aria-label={copy.lineWhat}
              placeholder={copy.lineWhat}
              value={line.description}
              onChange={(e) => set(i, { description: e.target.value })}
              className={control}
            />
            <button
              type="button"
              aria-label={copy.lineRemove}
              onClick={() => onChange(lines.filter((_, j) => j !== i))}
              className="grid h-10 w-9 shrink-0 place-items-center [border-radius:var(--radius-md)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)] hover:[color:var(--color-clay-bright)]"
            >
              ×
            </button>
          </div>
          {/* 数量 · 单位 · 单价 · 金额 on one row at 390px too: four narrow
              boxes read as one line of a quotation, which is what they are. */}
          <div className="flex items-center gap-2">
            <input
              aria-label={copy.lineQty}
              placeholder={copy.lineQty}
              inputMode="decimal"
              value={line.qty}
              onChange={(e) => set(i, { qty: e.target.value })}
              className={`${control} basis-[18%]`}
            />
            <input
              aria-label={copy.lineUnit}
              placeholder={copy.lineUnit}
              value={line.unit}
              onChange={(e) => set(i, { unit: e.target.value })}
              className={`${control} basis-[18%]`}
            />
            <input
              aria-label={copy.linePrice}
              placeholder={copy.linePrice}
              inputMode="decimal"
              value={line.unitPrice}
              onChange={(e) => set(i, { unitPrice: e.target.value })}
              className={`${control} basis-[30%]`}
            />
            <input
              aria-label={copy.lineAmount}
              placeholder={copy.lineAmount}
              inputMode="decimal"
              value={line.amount}
              onChange={(e) => set(i, { amount: e.target.value })}
              className={`${control} basis-[34%]`}
            />
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange([...lines, blankLine()])}
          className="[border-radius:var(--radius-md)] border border-dashed px-3 py-2 [font-size:var(--text-sm)] [border-color:var(--color-ink-800)] text-[color:var(--color-on-canvas-dim)] hover:[border-color:var(--color-primary)] hover:text-[color:var(--color-on-canvas)]"
        >
          ＋ {copy.lineAdd}
        </button>
        {lines.length ? (
          <span className="ml-auto [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)] tabular-nums">
            {copy.lineTotal} {ringgitOf(total)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

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

/**
 * 整张明细他还一个字都没碰过。
 *
 * 🔴 「照上次那一张」只在这个时候给 —— 不然按下去会把他刚打的东西盖掉，
 *    而那是这个仓库最不能出的一种错（他不会知道少了什么）。
 */
export function linesBlank(lines: Line[]): boolean {
  return lines.every(
    (l) =>
      !l.description.trim() &&
      !l.qty.trim() &&
      !l.unit.trim() &&
      !l.unitPrice.trim() &&
      !l.amount.trim(),
  );
}

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

/**
 * 他自己以前的东西 —— 货架 · 单位 · 上次那一张（[任务 150]）。
 *
 * ⚠️ 型别写在这里而不是从 `line-suggest` 汇入，因为**那一支已经汇入这里**
 *    （它要 `Line` 跟 `blankLine`）。两个档案互相汇入，打包的时候是一个圈。
 */
export type LineSuggest = {
  /** 他自己的货架。null = 还没抓完 */
  items: { name: string; unit: string; priceCents: number | null; onHand: number | null }[] | null;
  /** 他打过的单位，用得最多的排前面 */
  units: string[];
  /** 上次卖给这个客人那几行。null = 没有上一张 */
  lastLines: Line[] | null;
  lastFrom: { docNo: string; on: string } | null;
  /** 挑了一件货 → 填**空的**那几格。回 undefined = 不是货架上的东西 */
  fill: (line: Line) => Partial<Line> | undefined;
};

/** 每一格上面那个小名字。参考页上它是一行灰色小字，不是大写字母。 */
const cell =
  "[font-size:var(--text-xs)] text-[color:var(--color-on-canvas-dim)]";

const control =
  "ds-control h-10 w-full min-w-0 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]";

export function LineEditor({
  lines,
  onChange,
  copy,
  suggest,
}: {
  lines: Line[];
  onChange: (lines: Line[]) => void;
  copy: RecordFormCopy;
  /**
   * 他自己的货架 · 他打过的单位 · 上次卖给这个客人那几行（[任务 150]）。
   * ⚠️ **可以不给** —— 收款那几页没有逐项，官网那一页更没有。
   *    不给就跟以前一模一样：每一格都是空的，他自己打。
   */
  suggest?: LineSuggest;
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

  /* 他挑了一件货架上的东西 → 单位跟单价补进**空的**那几格。
     🔴 已经打了字的一格不动 —— 目录上的价是他平常卖的价，
     这一单谈的价是这一单的（[任务 144]）。 */
  const describe = (i: number, description: string) => {
    const patch: Partial<Line> = { description };
    const extra = suggest?.fill({ ...lines[i], description });
    set(i, extra ? { ...patch, ...extra } : patch);
  };

  const shelfId = "ln-shelf";
  const unitId = "ln-units";
  const canUseLast = !!suggest?.lastLines?.length && linesBlank(lines);

  return (
    <FormSection
      title={copy.lines}
      /* 「＋ 加一行」搬到标题右边（2026-09-04，照 arhamkhnz 的
         `Invoice Items ＋Add Item`）。它本来画在明细底下，跟内容一样重 ——
         一段的动作跟一段的内容长得一样，读起来就是分不出哪一句是标题。 */
      action={
        <div className="flex items-center gap-3">
          {/* 🔴 「照上次那一张」—— 一张同样的单，改之前要打 42 个字，
              现在挑一次（[任务 150] 数过）。
              而它**只在整张还空着的时候出现**：按下去是整批换掉，
              出现在一张打了一半的单上就是一颗会吃掉他的字的按钮。 */}
          {canUseLast && suggest?.lastLines ? (
            <button
              type="button"
              onClick={() => onChange(suggest.lastLines as Line[])}
              className={sectionAdd}
              title={
                suggest.lastFrom
                  ? `${suggest.lastFrom.docNo} · ${suggest.lastFrom.on}`
                  : undefined
              }
            >
              {copy.lineUseLast}
            </button>
          ) : null}
          <button type="button" onClick={() => onChange([...lines, blankLine()])} className={sectionAdd}>
            ＋ {copy.lineAdd}
          </button>
        </div>
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
              {/* 🔴 用 datalist 不用下拉：**他自己打的一句话照样打得进去**。
                  「拆除旧厨房」不在任何人的货架上，而那是装修每一张单的第一行。
                  一个只准从清单里挑的框，会把这一整页对装修变成不能用。 */}
              <input
                aria-label={copy.lineWhat}
                list={suggest?.items?.length ? shelfId : undefined}
                value={line.description}
                onChange={(e) => describe(i, e.target.value)}
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
                list={suggest?.units.length ? unitId : undefined}
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

      {/* 🔴 看图才看到的：**画面上没有任何东西说那个货架在**。
          浏览器要等他打了字才把清单冒出来，所以一个不知道要打字的老板
          永远不会发现它 —— 而那跟没有接是同一件事。

          ⚠️ 只在他真的有货架的时候画。装修那一行开局没有库存那一页
          （`PAGES_FOR_INDUSTRY.renovation` 里没有 inventory），
          对他讲「打前几个字会有东西出来」是一句假话。 */}
      {suggest?.items?.length ? (
        <span className="[font-size:var(--text-xs)] text-[color:var(--color-on-canvas-dim)]">
          {copy.lineShelfHint}
        </span>
      ) : null}

      {/* 他自己的货架跟他自己打过的单位。
          🔴 架上没货的排在**后面**（[任务 150]）—— 一个卖完的排第一，
             是让他每一次都要滑过去。
          ⚠️ 只画名字，**不画价钱** —— 那一格里的字会被原样填进「是什么」，
             而「水泥 50kg · RM 18.50」不是一个货品名。 */}
      {suggest?.items?.length ? (
        <datalist id={shelfId}>
          {[...suggest.items]
            .sort((a, b) => Number((b.onHand ?? 0) > 0) - Number((a.onHand ?? 0) > 0))
            .map((it) => (
              <option key={it.name} value={it.name} />
            ))}
        </datalist>
      ) : null}
      {suggest?.units.length ? (
        <datalist id={unitId}>
          {suggest.units.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      ) : null}
    </FormSection>
  );
}

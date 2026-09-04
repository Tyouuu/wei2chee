"use client";

import type { RecordFormCopy } from "../record-copy";
import { FormSection, sectionAdd } from "./form-section";
import { priceSchedule, type PaymentTerm } from "@/lib/portal/payment-terms";
import { senOf, ringgitOf } from "./line-editor";

/**
 * 分期付款表 —— 订金 30% · 动工 40% · 完工 30%。
 *
 * ── 为什么它长得像逐项明细，但不是同一个东西 ────────────────────────────
 *
 * 一样的骨架（一列一行、底下一颗「＋」、每行一个「×」），因为发明第二种写法
 * 是一个产品开始像两个产品的方式。
 *
 * 但它们回答的是两个问题：**逐项明细讲「我卖你什么」，分期表讲「你什么时候
 * 付给我多少」。** 所以逐项明细的合计会写回那张单的总数（触发器做的），
 * 而分期表**一分钱都不会改那张单** —— 它只是把同一笔钱切开。
 *
 * ── 一行只能是比例，或者只能是金额 ──────────────────────────────────────
 *
 * 两个都存会打架：他写 30%，然后明细多一行，总数变了 —— 一个存起来的金额
 * 当场过期而画面上没有任何东西会讲。所以这里一格切换，资料库那边 check 挡着。
 *
 * ── 加不起来的时候，讲出来差多少 ────────────────────────────────────────
 *
 * 不偷偷把最后一期改大。客人手上那张纸要加得起来，而一个我们替他调过的
 * 数字，他不知道被调过。（唯一的例外是几分钱的除不尽，规矩写在
 * lib/portal/payment-terms.ts。）
 */

export type TermRow = {
  /** 已经存起来的那一期自己的 id。新加的一行没有 —— 它还不存在。
   *  只拿来对上「这一期收过钱没有」，不送回资料库（整批换会重发 id）。 */
  id?: string;
  description: string;
  /** 「30」或者空。跟 amount 只能有一个有值。 */
  portion: string;
  /** 「RM 5,000」或者空。 */
  amount: string;
  dueOn: string;
};

export const blankTerm = (): TermRow => ({ description: "", portion: "", amount: "", dueOn: "" });

/** 送进资料库的形状。空的那几行丢掉 —— 他开了一行没写，不是他要写的一期。 */
export function termsForDb(rows: TermRow[]) {
  return rows
    .filter((r) => r.description.trim())
    .map((r) => {
      const pct = r.portion.trim() ? Number(r.portion.replace(/[%\s,]/g, "")) : null;
      const amt = r.amount.trim() ? senOf(r.amount) ?? null : null;
      return {
        description: r.description.trim(),
        portion: pct != null && Number.isFinite(pct) ? pct : null,
        amount_cents: pct != null && Number.isFinite(pct) ? null : amt,
        due_on: r.dueOn || null,
      };
    })
    /* 两个都没有的那一行送出去会被资料库拒绝，而那句拒绝会挡住他整次保存。
       在这里丢掉比较诚实：一行只写了名字，是他还没写完，不是一个错误。 */
    .filter((t) => t.portion != null || t.amount_cents != null);
}

/** 给画面看的：每一期今天等於多少，加不加得起来。 */
export function priceRows(rows: TermRow[], totalCents: number | null) {
  const terms: PaymentTerm[] = termsForDb(rows);
  return priceSchedule(terms, totalCents);
}

const control =
  "ds-control h-10 w-full min-w-0 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]";

export function TermsEditor({
  rows,
  onChange,
  totalCents,
  suggested,
  paidByTerm,
  copy,
}: {
  rows: TermRow[];
  onChange: (rows: TermRow[]) => void;
  /** 这张单的总数，sen。null = 还不知道，那时候比例算不出金额。 */
  totalCents: number | null;
  /** 这一行的惯例，他按一下才填 —— 从来不自己写进去。 */
  suggested: readonly TermRow[] | null;
  /**
   * 哪一期收过钱了，key 是那一期自己的 id。
   *
   * 🔴 这一段是靠看图才补上的。`term_id` 从 20260903030000 起就存得进去，
   * 而分期表上**一个字都没有变** —— 老板指名「这笔是订金」，存进去了，
   * 然后打开那张单看到的还是三期都没收。存得进去而看不见，
   * 就是这个仓库最常犯的那个错。
   *
   * ⚠️ undefined = **没有问**（师傅看不到钱），不是「都没收」——
   * 所以那一整栏不画，而不是画一排「未收」。
   */
  paidByTerm?: Readonly<Record<string, { paidCents: number; settled: boolean }>>;
  copy: RecordFormCopy;
}) {
  const set = (i: number, patch: Partial<TermRow>) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    /* 一格有值，另一格就清掉。让两格同时有值，是让他写一个资料库会拒绝的东西
       然后在保存的时候才告诉他。 */
    if (patch.portion) next[i] = { ...next[i], amount: "" };
    if (patch.amount) next[i] = { ...next[i], portion: "" };
    onChange(next);
  };

  const priced = priceRows(rows, totalCents);

  return (
    <FormSection
      title={copy.terms}
      /* 「＋ 加一期」跟「照这一行的惯例填」搬到标题右边 —— 跟明细那一段
         同一个做法，因为在参考页上每一段都是同一个形状。 */
      action={
        <>
          <button type="button" onClick={() => onChange([...rows, blankTerm()])} className={sectionAdd}>
            ＋ {copy.termAdd}
          </button>
          {/* 这一行的惯例。⚠️ 是一颗他要按的按钮，不是一个预设 ——
              一份他没有同意过的付款办法印在客人手上那张纸上，比没有分期表严重。 */}
          {suggested && rows.length === 0 ? (
            <button
              type="button"
              onClick={() => onChange(suggested.map((t) => ({ ...t })))}
              className="inline-flex min-h-9 items-center [border-radius:var(--radius-md)] border px-3 [font-size:var(--text-sm)] [border-color:var(--color-ink-800)] text-[color:var(--color-on-canvas-dim)] hover:[border-color:var(--color-primary)] hover:text-[color:var(--color-on-canvas)]"
            >
              {copy.termSuggest}
            </button>
          ) : null}
        </>
      }
    >

      {rows.map((row, i) => {
        /* termsForDb 会丢掉写不完整的行，所以位置对不上 —— 用名字对回来。 */
        const shown = priced.terms.find((t) => t.description === row.description.trim());
        /* 这一期收过钱没有。只有存起来的那几期有 id —— 他刚加的一行还不存在，
           所以它永远不会印「已收」，那是对的。 */
        const paid = row.id && paidByTerm ? paidByTerm[row.id] : undefined;
        return (
          <div
            key={i}
            className="flex flex-col gap-2 [border-radius:var(--radius-md)] border p-3 [border-color:var(--color-ink-800)]"
          >
            <div className="flex items-start gap-2">
              <input
                aria-label={copy.termWhat}
                placeholder={copy.termWhat}
                value={row.description}
                onChange={(e) => set(i, { description: e.target.value })}
                className={control}
              />
              <button
                type="button"
                aria-label={copy.lineRemove}
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                className="grid h-10 w-9 shrink-0 place-items-center [border-radius:var(--radius-md)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)] hover:[color:var(--color-clay-bright)]"
              >
                ×
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                aria-label={copy.termPortion}
                placeholder={copy.termPortion}
                inputMode="decimal"
                value={row.portion}
                onChange={(e) => set(i, { portion: e.target.value })}
                className={`${control} basis-[22%]`}
              />
              <input
                aria-label={copy.termAmount}
                placeholder={copy.termAmount}
                inputMode="decimal"
                value={row.amount}
                onChange={(e) => set(i, { amount: e.target.value })}
                className={`${control} basis-[36%]`}
              />
              <input
                aria-label={copy.termWhen}
                type="date"
                value={row.dueOn}
                onChange={(e) => set(i, { dueOn: e.target.value })}
                className={`${control} basis-[42%]`}
              />
            </div>
            {/* 比例那几期，讲出来今天等於多少 —— 不然「30%」要他自己心算。
                ⚠️ 总数还不知道的时候什么都不印，不印 RM 0。
                收过钱的那一期，同一行把它讲出来。 */}
            <div className="flex items-baseline justify-between gap-3">
              {row.portion.trim() && shown && priced.documentCents != null ? (
                <span className="[font-size:var(--text-xs)] text-[color:var(--color-on-canvas-dim)] tabular-nums">
                  {ringgitOf(shown.cents)}
                </span>
              ) : (
                <span />
              )}
              {/* 🔴 只有真的收过才印。第一版三期都印了一行「Received RM 0」——
                  而 RM 0 是一个数字，它读起来像一个事实，
                  而事实是那两期还没有发生过任何事。
                  「一分都还没收」跟「收齐了」是两句不一样的话，
                  RM 0 是第三句，而且是错的那一句。 */}
              {paid && (paid.paidCents > 0 || paid.settled) ? (
                <span className="[font-size:var(--text-xs)] tabular-nums text-[color:var(--color-on-canvas)]">
                  {paid.settled ? copy.settledAll : `${copy.received} ${ringgitOf(paid.paidCents)}`}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}

      {priced.terms.length && priced.documentCents != null ? (
        <span className="self-end [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] tabular-nums text-[color:var(--color-on-canvas)]">
          {copy.lineTotal} {ringgitOf(priced.totalCents)}
        </span>
      ) : null}

      {/* 🔴 加不起来就讲出来。不偷偷补，也不挡他保存 —— 一张写到一半的
          分期表是常态（订金先谈好，余额下星期再算）。

          ⚠️ 但**一期都没写的时候什么都不讲**。看图才看到的：一张
          RM 12,000 的单，他一期都没写，底下一行红字写着
          「这几期加起来跟单上的总数差 RM 12,000」——
          **在骂他没做一件他根本没有开始做的事。**
          「还没写」跟「写错了」是两回事，而红色是留给后者的。 */}
      {priced.terms.length > 0 && priced.matches === false && priced.documentCents != null ? (
        <p className="[font-size:var(--text-xs)] text-[color:var(--color-clay-bright)]">
          {copy.termMismatch} {ringgitOf(Math.abs(priced.differenceCents ?? 0))}
        </p>
      ) : null}
    </FormSection>
  );
}

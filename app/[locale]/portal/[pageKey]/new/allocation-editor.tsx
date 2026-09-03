"use client";

import type { RecordFormCopy } from "../record-copy";
import type { OpenDocument } from "../record-context";
import { senOf, ringgitOf } from "./line-editor";

/**
 * 这笔钱付了哪几张单。
 *
 * ── 它回答的是老板每个月都要回答一次的那一句 ──────────────────────────────
 *
 * 客户转一笔 RM 20,000 过来，付的是三张单。在这一格出现之前他只有两条路：
 * 把那一笔拆成三笔假的收款去记，或者记一笔然后自己在脑袋里记住它是给谁的。
 *
 * ── 🔴 剩下的那一段不是错，是订金 ─────────────────────────────────────────
 *
 * 分摊不满是**常态**，不是一个要修的东西：装修的订金先进来，报价单下星期才出。
 * 所以底下那一行印的是「还有 RM 3,000 没分摊 —— 那是订金」，
 * 不是一句红字。任务 61 · 67 · 44 三天各要过一次的那个数字就是它。
 *
 * ── 为什么不自动帮他分 ────────────────────────────────────────────────────
 *
 * 「照最旧的单先扣」听起来很方便，而它会替他做一个他没有做的决定 ——
 * 而那个决定会印在客人手上那张对帐单上。他要分的时候有地方分。
 */

export type AllocationRowInput = {
  recordId: string;
  termId: string;
  /** 「1,200.00」，他打的字。 */
  amount: string;
};

export const blankAllocation = (): AllocationRowInput => ({ recordId: "", termId: "", amount: "" });

/** 送进资料库的形状。没挑单、或者没写金额的那几行丢掉。 */
export function allocationsForDb(rows: AllocationRowInput[]) {
  return rows
    .filter((r) => r.recordId && r.amount.trim())
    .map((r) => ({
      record_id: r.recordId,
      term_id: r.termId || null,
      amount_cents: senOf(r.amount) ?? 0,
    }))
    .filter((r) => r.amount_cents > 0);
}

const control =
  "ds-control h-10 w-full min-w-0 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]";

export function AllocationEditor({
  rows,
  onChange,
  documents,
  entryCents,
  copy,
}: {
  rows: AllocationRowInput[];
  onChange: (rows: AllocationRowInput[]) => void;
  documents: readonly OpenDocument[];
  /** 这笔钱多少，sen。null = 他还没打金额。 */
  entryCents: number | null;
  copy: RecordFormCopy;
}) {
  const byId = new Map(documents.map((d) => [d.id, d]));
  const allocated = rows.reduce((n, r) => n + (senOf(r.amount) ?? 0), 0);
  const left = entryCents == null ? null : entryCents - allocated;

  const set = (i: number, patch: Partial<AllocationRowInput>) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    /* 换了单，上一张单的那一期就不属於它了 —— 资料库会拒绝，
       而让他保存之后才知道，比现在清掉糟。 */
    if (patch.recordId !== undefined) next[i] = { ...next[i], termId: "" };
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
        {copy.allocations}
      </span>

      {/* 🔴 一张单都没有的时候，讲出来为什么，不要画一个空的下拉。
          「没有单可以分」跟「读不到」在画面上长得一模一样，而这一句分得开。 */}
      {documents.length === 0 ? (
        <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {copy.allocNoDocs}
        </p>
      ) : null}

      {documents.length
        ? rows.map((row, i) => {
            const doc = byId.get(row.recordId);
            const owed = doc ? Math.max(0, doc.amountCents - doc.paidCents) : null;
            return (
              <div
                key={i}
                className="flex flex-col gap-2 [border-radius:var(--radius-md)] border p-3 [border-color:var(--color-ink-800)]"
              >
                <div className="flex items-start gap-2">
                  <select
                    aria-label={copy.allocDocument}
                    value={row.recordId}
                    onChange={(e) => set(i, { recordId: e.target.value })}
                    className={control}
                  >
                    <option value="">{copy.allocDocument}</option>
                    {documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {[d.docNo, d.title, d.party].filter(Boolean).join(" · ")}
                      </option>
                    ))}
                  </select>
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
                    aria-label={copy.allocAmount}
                    placeholder={copy.allocAmount}
                    inputMode="decimal"
                    value={row.amount}
                    onChange={(e) => set(i, { amount: e.target.value })}
                    /* 🔴 打完就变成 RM 12,000。看图才看到的：他打的 12000 就
                       躺在一个印着「RM 48,500」的数字旁边，而 12000 跟 1200
                       在那个位置上一眼分不出来。旁边每一个金额都有 RM 跟逗号，
                       只有他自己打的那一个没有。 */
                    onBlur={(e) => {
                      const sen = senOf(e.target.value);
                      if (sen != null && sen > 0) set(i, { amount: ringgitOf(sen) ?? e.target.value });
                    }}
                    className={`${control} ${doc && doc.terms.length ? "basis-[40%]" : "basis-full"}`}
                  />
                  {/* 哪一期。只有那张单真的有分期表才出现 —— 一个永远只有
                      一个选项的下拉，是一个假的控件。 */}
                  {doc && doc.terms.length ? (
                    <select
                      aria-label={copy.allocTerm}
                      value={row.termId}
                      onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, termId: e.target.value } : r)))}
                      className={`${control} basis-[60%]`}
                    >
                      <option value="">{copy.allocWholeDoc}</option>
                      {doc.terms.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.description}
                          {t.dueCents ? ` · ${ringgitOf(t.dueCents)}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>

                {/* 那张单还欠多少 —— 他要打的数字通常就是这个。
                    🔴 而且**扣掉他这一行正在打的数字**。第一版印的是这笔钱
                    进来之前的欠款：他打了 12,000 进去，旁边还写着「还欠
                    RM 48,500」，读起来像他打的东西没有算进去。 */}
                {doc && owed != null ? (
                  <span className="[font-size:var(--text-xs)] tabular-nums text-[color:var(--color-on-canvas-dim)]">
                    {copy.allocOwed} {ringgitOf(Math.max(0, owed - (senOf(row.amount) ?? 0)))}
                  </span>
                ) : null}
              </div>
            );
          })
        : null}

      {documents.length ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onChange([...rows, blankAllocation()])}
            className="[border-radius:var(--radius-md)] border border-dashed px-3 py-2 [font-size:var(--text-sm)] [border-color:var(--color-ink-800)] text-[color:var(--color-on-canvas-dim)] hover:[border-color:var(--color-primary)] hover:text-[color:var(--color-on-canvas)]"
          >
            ＋ {copy.allocAdd}
          </button>

          {/* 🔴 剩下的那一段。红字只留给「分超过了」，因为那一件资料库会拒绝；
              「还有一段没分」是订金，是这门生意每天都在发生的事。 */}
          {left != null && rows.length ? (
            <span
              className={`ml-auto [font-size:var(--text-sm)] tabular-nums ${
                left < 0
                  ? "text-[color:var(--color-clay-bright)]"
                  : "text-[color:var(--color-on-canvas-dim)]"
              }`}
            >
              {left < 0
                ? `${copy.allocOver} ${ringgitOf(-left)}`
                : `${copy.allocDeposit} ${ringgitOf(left)}`}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

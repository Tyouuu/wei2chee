"use client";

import type { RecordFormCopy } from "../record-copy";
import { ringgitOf, senOf, totalOf, type Line } from "./line-editor";

/**
 * The paper, beside the form that is filling it in.
 *
 * ── WHY THIS IS THE FIFTH KIND OF PAGE ────────────────────────────────────
 *
 * Measured 2026-09-02: seventeen backstage modules produced fourteen skeletons
 * and sixteen were the same sentence -- a heading, a filter, the same table.
 * The founder sent two screenshots of next-shadcn-admin asking why theirs looks
 * so much better, and the one he sent twice was Create New Invoice: a form on
 * the left, the printed invoice redrawing itself on the right. It is not better
 * components. It is that the OUTPUT is on screen while you are making it.
 *
 * That matters more here than it does there. A quotation is the only thing this
 * system produces that somebody outside the business reads, and until now the
 * owner filled in five boxes and found out what they added up to after saving.
 *
 * ── WHAT IT IS NOT ────────────────────────────────────────────────────────
 *
 * Not a print view and not a PDF -- neither exists yet, and drawing a Print
 * button that opens nothing is the class of thing this product refuses (a page
 * may not say it can do something it cannot). It is a preview: it shows what
 * has been typed, and nothing that has not.
 *
 * ⚠️ NO DOCUMENT NUMBER ON A NEW ONE. The number is issued by next_doc_no()
 * inside the write, from a counter table, at the moment of saving -- so any
 * number shown here would be a guess, and a guess printed in the position where
 * the real one goes is the worst place in the system to be wrong. An existing
 * record passes its own.
 *
 * ⚠️ WHICH TOKEN IS A SURFACE AND WHICH IS INK -- READ, DO NOT GUESS FROM THE
 * NAME. The first version painted this card with `--color-paper` and wrote on
 * it with `--color-on-canvas`, on the reasonable-sounding reading that paper is
 * the sheet. Measured on 台账: `--color-paper` is **#14273d**, a deep navy, and
 * it is the INK -- the file says so in as many words ("Deep navy, not black"),
 * and `--color-on-canvas` is defined as `var(--color-paper)`. `--color-on-paper`
 * does not exist in any register. So the document rendered as a black rectangle
 * with black text in it, and six browser assertions passed, because innerText
 * contains every word whether or not a human can see one.
 *
 * 任务 36 recorded this trap from the other direction on 2026-08-27 --
 * `--color-ink-900` is a SURFACE despite its name -- and its note ends: list
 * which tokens are surfaces and which are text before touching either. This is
 * that list being ignored once more.
 *
 * The card is `.ds-card` now, which is the class the whole system already draws
 * cards with and is therefore right in every register without this file knowing
 * any of their values.
 *
 * ⚠️ EMPTY MEANS EMPTY. A field the owner has not filled draws a hairline and
 * nothing else, rather than a placeholder. A sample value in a preview of HIS
 * document is the same defect as sample rows on a page with real ones: two
 * things on one screen, one of them not true.
 */

export type PreviewValues = {
  primary?: string;
  secondary?: string;
  amount?: string;
  status?: string;
};

export function DocumentPreview({
  title,
  docNo,
  values,
  lines,
  labels,
  copy,
  dateLabel,
  today,
  validity,
}: {
  /** The module's own noun -- 报价单, 进货单, 订单 -- never a word of ours. */
  title: string;
  /** Only ever set for a record that already has one. */
  docNo?: string | null;
  values: PreviewValues;
  lines: Line[];
  /** The page's own column headings, so a master dealer's document says 经销商
   *  where a contractor's says 客户. Same rule the detail panel follows. */
  labels: { primary?: string; secondary?: string; amount?: string; status?: string };
  copy: RecordFormCopy;
  dateLabel: string;
  today: string;
  /** 有效期 / 期限 / 预计到货 —— 印出来那张纸上最要紧的一行之一。
   *  一张没有印有效期的报价单，是一个永远有效的价钱。 */
  validity?: { label: string; value: string } | null;
}) {
  const filled = lines.filter((l) => l.description.trim());
  const lineTotal = totalOf(filled);
  const typed = senOf(values.amount ?? "");
  /* The lines win when there are any -- that is already the rule the form
     states underneath the editor ("with line items, the amount above is their
     total"), and a preview that disagreed with the form would make the owner
     trust neither. */
  const total = filled.length ? lineTotal : typed;

  const row = "flex items-baseline justify-between gap-4 py-1.5";
  const key = "[font-size:var(--text-xs)] uppercase [letter-spacing:0.06em] text-[color:var(--color-on-canvas-dim)]";
  const val = "[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-paper)]";

  return (
    <aside
      aria-label={copy.previewLabel}
      /* `sticky` so the paper stays in view while the line editor grows. It is
         the thing being made; scrolling it off to add a fourth line is the
         behaviour that would make this decorative. */
      className="lg:sticky lg:top-10 self-start w-full"
    >
      <p className="mb-2 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
        {copy.previewLabel}
      </p>

      <div className="ds-card p-6">
        <div className="flex items-start justify-between gap-4">
          <span className="ds-display [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)] text-[color:var(--color-paper)]">
            {title}
          </span>
          {/* Only when it exists. See the note above about guessing. */}
          {docNo ? (
            <span className="[font-size:var(--text-sm)] [font-variant-numeric:tabular-nums] text-[color:var(--color-on-canvas-dim)]">
              {docNo}
            </span>
          ) : null}
        </div>

        <div className="mt-4 border-t border-[color:var(--color-ink-800)] pt-2">
          {(
            [
              [labels.secondary, values.secondary],
              [dateLabel, today],
              ...(validity ? ([[validity.label, validity.value]] as const) : []),
              [labels.status, values.status],
            ] as const
          ).map(([label, value], i) =>
            label ? (
              <div key={i} className={row}>
                <span className={key}>{label}</span>
                <span className={val}>{value?.trim() || "—"}</span>
              </div>
            ) : null,
          )}
        </div>

        {/* WHAT IT IS FOR, given the width of a heading rather than a row: on
            every one of these documents the first column is the thing being
            quoted, and it is what the person receiving it reads first. */}
        <p className="mt-4 [font-size:var(--text-base)] [font-weight:var(--fw-medium)] text-[color:var(--color-paper)]">
          {values.primary?.trim() || "—"}
        </p>

        {filled.length ? (
          <table className="mt-4 w-full border-collapse [font-size:var(--text-sm)]">
            <thead>
              <tr className="border-b border-[color:var(--color-ink-800)] text-left">
                <th className={`${key} py-1.5 font-normal`}>{copy.lineWhat}</th>
                <th className={`${key} py-1.5 text-right font-normal`}>{copy.lineQty}</th>
                <th className={`${key} py-1.5 text-right font-normal`}>{copy.lineAmount}</th>
              </tr>
            </thead>
            <tbody>
              {filled.map((l, i) => (
                <tr key={i} className="border-b border-[color:var(--color-ink-800)]">
                  <td className="py-1.5 pr-3 text-[color:var(--color-paper)]">
                    {l.description}
                    {l.unit.trim() ? (
                      <span className="text-[color:var(--color-on-canvas-dim)]"> · {l.unit}</span>
                    ) : null}
                  </td>
                  <td className="py-1.5 text-right [font-variant-numeric:tabular-nums] text-[color:var(--color-on-canvas-dim)]">
                    {l.qty.trim() || "—"}
                  </td>
                  <td className="py-1.5 text-right [font-variant-numeric:tabular-nums] text-[color:var(--color-paper)]">
                    {senOf(l.amount) != null ? ringgitOf(senOf(l.amount) as number) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-[color:var(--color-ink-800)] pt-3">
          <span className={key}>{labels.amount ?? copy.lineTotal}</span>
          <span className="ds-display [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)] [font-variant-numeric:tabular-nums] text-[color:var(--color-paper)]">
            {total ? ringgitOf(total) : "—"}
          </span>
        </div>
      </div>

      {/* Said once, under the paper, in the owner's own language. Without it a
          preview of a document with no number on it reads as a document that
          has lost its number. */}
      {docNo ? null : (
        <p className="mt-2 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {copy.previewNoNumber}
        </p>
      )}
    </aside>
  );
}

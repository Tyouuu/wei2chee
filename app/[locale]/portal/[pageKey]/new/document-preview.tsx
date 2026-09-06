"use client";

import type { RecordFormCopy } from "../record-copy";
import { ringgitOf, senOf, totalOf, type Line } from "./line-editor";

/** 没填的那一格。一个占位符比一个诚实的空白更糟 —— 见档头。 */
const EMPTY = "—";

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
  site,
  schedule,
  businessName,
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
  /** 他的公司名 —— 那张纸的抬头。
   *  🔴 2026-09-04 加的。一张只写着「Quotations」的纸，收到的人看不出是谁开的。
   *  ⚠️ 只有名字，没有地址税号：所以它画成**抬头**，不画成一栏寄件人资料 ——
   *  一栏只有一行的寄件人栏，看起来是一份填了一半的表。 */
  businessName?: string | null;
  /** 哪一个工地。🔴 印在那张纸上，因为它就是给对方看的那一句 ——
   *  一张讲不出去哪里的报价单，师傅拿着它开不出门。 */
  site?: { label: string; value: string } | null;
  /** 分期付款表，已经算好、已经排好版的一行一行。
   *  ⚠️ 这里不算术：算在 lib/portal/payment-terms.ts，那里有测试。 */
  schedule?: { description: string; portionText: string; amountText: string; due: string }[] | null;
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

  /* 2026-09-04 这张纸重排了一次，照 arhamkhnz 的 `dashboard/invoice`
     （老板挑的那一套，MIT，实拍在 .screenshots/admins/arham-invoice.jpg）。
     内容一个字都没有换 —— 换的是它长得像不像一张要递给别人的纸。

     逐项对着原尺寸比出来的五件：
       一 一张**白纸浮在灰垫子上**，不是一张贴着栏边的卡。那个垫子就是
          「这是一份文件」这句话本身；没有它，纸跟表单是同一个平面
       二 抬头**两边**：左边是他的公司名，右边是这张纸叫什么（大写、拉开字距）
       三 单号/日期那几项**并排成两栏**，不是标签左值右一行一行往下掉
       四 明细表头是**一条灰带**，不是一条细线
       五 合计**靠右缩成半栏**，上面一条线，最后一行加粗 —— 一整行拉满的合计
          读起来是表格的最后一行，不是这张纸的结论

     ⚠️ ~~没有 Print 那一颗~~ —— **2026-09-07 有了**。列印规则铺到
     `[data-print-sheet]` 上（globals.css 的 `@media print`），
     所以按下去印出来的只有这一张纸。
     ⚠️ **Download PDF 还是没有** —— 浏览器的列印对话框里就有「存成 PDF」，
     而我们自己产一份 PDF 要多装一个东西，印出来的样子还会跟画面上不一样。 */
  const label =
    "[font-size:var(--text-xs)] uppercase [letter-spacing:0.06em] text-[color:var(--color-on-canvas-dim)]";
  const value = "[font-size:var(--text-sm)] text-[color:var(--color-paper)]";
  const money =
    "[font-size:var(--text-sm)] [font-variant-numeric:tabular-nums] text-[color:var(--color-paper)]";

  /** 单号 . 日期 . 有效期 . 工地 —— 有什么印什么，没有的不占位子。 */
  const meta: readonly (readonly [string, string | undefined])[] = [
    ...(docNo ? ([[copy.previewNumber, docNo]] as const) : []),
    [dateLabel, today] as const,
    ...(validity ? ([[validity.label, validity.value]] as const) : []),
    ...(site ? ([[site.label, site.value]] as const) : []),
  ];

  return (
    <aside
      aria-label={copy.previewLabel}
      /* `sticky` so the paper stays in view while the line editor grows. It is
         the thing being made; scrolling it off to add a fourth line is the
         behaviour that would make this decorative. */
      className="lg:sticky lg:top-10 self-start w-full"
    >
      <div className="ds-card overflow-hidden p-0">
        {/* 抬头那一条 —— 参考页上它带着 Print / Download PDF；我们那两颗
            还不能按，所以这里只有它的名字。 */}
        <div className="flex items-center justify-between gap-4 border-b border-[color:var(--color-ink-800)] [padding:var(--pad-control-y)_var(--pad-card-lg)]">
          <span className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-paper)]">
            {copy.previewLabel}
          </span>
          {/* 🔴 那颗按钮 —— 2026-09-07。
              这一段原本写着「我们那两颗还不能按，所以这里只有它的名字」，
              而它不能按的理由是列印规则只认编辑器的画布。
              规则今天铺到 `[data-print-sheet]` 上了，所以那个理由没了。

              ⚠️ 它自己不会被印出来：那条规则会把**不在纸这条路上的**
              每一个兄弟拿掉，而这一条抬头正是其中一个。 */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-9 items-center [border:var(--hairline)_solid_var(--color-ink-800)] [border-radius:var(--radius-control)] [color:var(--color-paper)] [font-size:var(--text-sm)] [padding-inline:calc(var(--pad-control-x)*1.1)] hover:[border-color:var(--color-primary)]"
          >
            {copy.printIt}
          </button>
        </div>

        {/* 垫子。纸浮在上面。 */}
        <div className="[background:color-mix(in_oklab,var(--color-on-canvas)_5%,var(--card))] p-5">
          <div
            /* 印的时候只印这一块。**今天还没有那条规则** —— 这个属性先立在
               这里，等列印那一轮接上去。 */
            data-print-sheet
            className="[background-color:var(--card)] [border-radius:var(--radius-md)] [box-shadow:0_1px_2px_color-mix(in_oklab,var(--color-on-canvas)_14%,transparent)] [padding:28px]"
          >
            {/* 二 抬头两边：他的公司名 / 这张纸叫什么 */}
            <div className="flex items-start justify-between gap-6">
              <span className="ds-display [font-size:var(--text-base)] [font-weight:var(--fw-semibold)] text-[color:var(--color-paper)]">
                {businessName?.trim() || EMPTY}
              </span>
              <span className="ds-display [font-size:var(--text-lg)] uppercase [letter-spacing:0.14em] text-[color:var(--color-on-canvas-dim)]">
                {title}
              </span>
            </div>

            {/* 三 并排两栏 */}
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3">
              {meta.map(([l, v], i) => (
                <div key={i} className="flex flex-col gap-0.5">
                  <span className={label}>{l}</span>
                  <span className={value}>{v?.trim() || EMPTY}</span>
                </div>
              ))}
            </div>

            {/* 给谁 —— 用他自己那一栏的名字当抬头，不是我们发明的 BILL TO。
                ⚠️ 「他自己」那一半就是上面的公司名，不另外画一栏：
                我们只有名字，没有地址跟税号，画一个只有一行的寄件人栏
                看起来是一份填了一半的表。 */}
            {labels.secondary ? (
              <div className="mt-5 border-t border-[color:var(--color-ink-800)] pt-4">
                <span className={label}>{labels.secondary}</span>
                <p className="mt-1 [font-size:var(--text-base)] [font-weight:var(--fw-medium)] text-[color:var(--color-paper)]">
                  {values.secondary?.trim() || EMPTY}
                </p>
              </div>
            ) : null}

            {/* WHAT IT IS FOR, given the width of a heading rather than a row: on
                every one of these documents the first column is the thing being
                quoted, and it is what the person receiving it reads first. */}
            <p className="mt-5 [font-size:var(--text-base)] text-[color:var(--color-paper)]">
              {values.primary?.trim() || EMPTY}
            </p>

            {filled.length ? (
              <table className="mt-4 w-full border-collapse [font-size:var(--text-sm)]">
                <thead>
                  {/* 四 一条灰带，不是一条线 */}
                  <tr className="[background:color-mix(in_oklab,var(--color-on-canvas)_6%,var(--card))] text-left">
                    <th className={`${label} px-2 py-2 font-normal`}>{copy.lineWhat}</th>
                    <th className={`${label} px-2 py-2 text-right font-normal`}>{copy.lineQty}</th>
                    <th className={`${label} px-2 py-2 text-right font-normal`}>{copy.lineAmount}</th>
                  </tr>
                </thead>
                <tbody>
                  {filled.map((l, i) => (
                    <tr key={i} className="border-b border-[color:var(--color-ink-800)]">
                      <td className="px-2 py-2 text-[color:var(--color-paper)]">
                        {l.description}
                        {l.unit.trim() ? (
                          <span className="text-[color:var(--color-on-canvas-dim)]"> · {l.unit}</span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-right [font-variant-numeric:tabular-nums] text-[color:var(--color-on-canvas-dim)]">
                        {l.qty.trim() || EMPTY}
                      </td>
                      <td className={`px-2 py-2 text-right ${money}`}>
                        {senOf(l.amount) != null ? ringgitOf(senOf(l.amount) as number) : EMPTY}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {/* 五 合计靠右缩成半栏 */}
            <div className="mt-5 flex justify-end">
              <div className="w-full max-w-[62%]">
                <div className="flex items-baseline justify-between gap-4 border-t-2 border-[color:var(--color-paper)] pt-2.5">
                  <span className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] uppercase [letter-spacing:0.06em] text-[color:var(--color-paper)]">
                    {labels.amount ?? copy.lineTotal}
                  </span>
                  <span className="ds-display [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)] [font-variant-numeric:tabular-nums] text-[color:var(--color-paper)]">
                    {total ? ringgitOf(total) : EMPTY}
                  </span>
                </div>
              </div>
            </div>

            {/* 分期付款表印在总额底下 —— 那是客人看完金额之后立刻要问的一句
                「怎么付」，而在这一行那是合约条款不是附注。
                比例跟金额都印：「订金 30%」告诉他为什么是这个数，
                「RM 14,550」告诉他要转多少。 */}
            {schedule?.length ? (
              <div className="mt-5 border-t border-[color:var(--color-ink-800)] pt-3">
                <p className={`${label} mb-1.5`}>{copy.terms}</p>
                {schedule.map((s, i) => (
                  <div key={i} className={row}>
                    <span className="[font-size:var(--text-sm)] text-[color:var(--color-paper)]">
                      {s.description}
                      {s.portionText ? (
                        <span className="text-[color:var(--color-on-canvas-dim)]"> · {s.portionText}</span>
                      ) : null}
                      {s.due ? (
                        <span className="text-[color:var(--color-on-canvas-dim)]"> · {s.due}</span>
                      ) : null}
                    </span>
                    <span className={`${money} [font-weight:var(--fw-medium)]`}>{s.amountText}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
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

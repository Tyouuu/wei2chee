import Link from "next/link";
import type { RecordFormCopy } from "../record-copy";

/**
 * 这一单借出去的东西，回来了没有。
 *
 * ── 为什么它不是 `/rentals` 那一页的重复 ──────────────────────────────────
 *
 * `rentals_out`（那一页读的）只回**还没还的**（`returned_on is null`）。
 * 所以那一页答得了「今天谁欠我东西」，答不了「这一单借过什么、
 * 几时还的、迟了几天」——而那正是他**收尾这一单、准备开单**那一刻问的。
 *
 * `rentals_of` 从 20260905540000 起就在，画面上一个入口都没有。
 *
 * ── ⚠️ 只读，而且只在这一单真的借过东西的时候画 ──────────────────────────
 *
 * 「记一笔还回来」那颗按钮住在 `/rentals` —— 一件事两个地方按，
 * 就是两个地方要各自修一次。这里给一条连结。
 *
 * 而绝大多数单子从来没有借过东西，所以这一段绝大多数时候**整段不画** ——
 * 那一页已经 3080px 九段（[任务 273](../../../../../docs/founder-tasks.md#273)），
 * 一段永远说「没有」的区块，读起来是这一页没做完。
 *
 * ── 迟了几天是算出来的，不是存起来的 ────────────────────────────────────
 *
 * `days_over` 由资料库照**马来西亚的今天**算（20260905540000）。
 * 在这里拿浏览器的时钟再减一次，半夜到早上八点会差一天 ——
 * 而这个仓库为那八个钟头付过三次学费（任务 168 · 209 · 250）。
 */

export type JobRental = {
  id: string;
  descr: string;
  qty: string;
  outOn: string;
  dueBackOn: string | null;
  returnedOn: string | null;
  daysOver: number;
};

export function RentalsOnJob({
  rentals,
  rentalsHref,
  copy,
}: {
  rentals: readonly JobRental[];
  rentalsHref: string;
  copy: RecordFormCopy;
}) {
  /* 还没还的排最前面，迟最久的排最上面 —— 那是他要去要回来的顺序。 */
  const owing = rentals.filter((r) => !r.returnedOn);
  const back = rentals.filter((r) => r.returnedOn);

  return (
    <div data-rentals-on-job="" className="flex flex-col gap-4">
      <div>
        <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.lentHeading}
        </h2>
        <p className="mt-1 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {copy.lentLede}
        </p>
      </div>

      {owing.length ? (
        <ul className="flex flex-col gap-1">
          {owing.map((r) => (
            <li
              key={r.id}
              className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas)]"
            >
              {r.descr} · {r.qty}
              {r.dueBackOn ? ` · ${copy.lentDueBack} ${r.dueBackOn}` : ""}
              {/* 🔴 迟了几天是一句字，不是一个只上色的记号 ——
                灰阶跟列印上一个颜色讲不出话（1.4.1）。 */}
              {r.daysOver > 0 ? (
                <span className="[font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]">
                  {" · "}
                  {copy.lentOverdue.replace("{days}", String(r.daysOver))}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {/* 已经还回来的。⚠️ 一句一句列，而不是一个「3 件已还」的数字 ——
        他要对的是**哪一件**回来了。 */}
      {back.length ? (
        <ul className="flex flex-col gap-1">
          {back.map((r) => (
            <li
              key={r.id}
              className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]"
            >
              {r.descr} · {r.qty} · {copy.lentBackOn} {r.returnedOn}
              {r.daysOver > 0
                ? ` · ${copy.lentWasLate.replace("{days}", String(r.daysOver))}`
                : ""}
            </li>
          ))}
        </ul>
      ) : null}

      {/* 记一笔还回来住在 `/rentals` —— 一件事一个地方按。 */}
      <Link
        href={rentalsHref}
        className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas-dim)] underline"
      >
        {copy.lentGoBack}
      </Link>
    </div>
  );
}

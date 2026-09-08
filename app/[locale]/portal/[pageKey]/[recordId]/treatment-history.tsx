/* 她做过什么 —— 一个客人的一条线。
 *
 * ── 为什么它长在客户那一页上，而不是自己一页 ──────────────────────────
 *
 * 她站在客人面前，手上那一句是「上一次帮她打的是什么」。而客人那一页
 * 就是她那一刻会开的那一页 —— 再多一个入口，等於多一次她要想的事。
 *
 * ── 🔴 而它只在她真的记过一笔的时候才画 ────────────────────────────────
 *
 * 一间装修公司的客户页上，一段永远写着「还没有疗程记录」的东西，
 * 读起来是这一页没做完 —— 而这个仓库为同一件事判过好几次
 * （师傅那一页不画「他来过几次」，理由一字不差：
 *  一段永远说同一句话的段落，读起来是这一页没做完）。
 *
 * ⚠️ 所以判准是**这一家有没有记过**，不是「这一行是不是美容」——
 * 一间车厂真的开始记疗程（她们做美容镀膜），那一段自己会出现。
 *
 * ── 🔴 那一栏「可不可以给别人看」要印出来 ──────────────────────────────
 *
 * `may_show` 预设 false（20260909100000）。而一张不给看的照片跟一张
 * 给看的，在画面上必须**长得不一样** —— 不然她拿去做行销的时候，
 * 那一栏等於不存在。
 */
import type { RecordFormCopy } from "../record-copy";

export type TreatmentShot = {
  id: string;
  url: string | null;
  stage: string;
  caption: string;
  mayShow: boolean;
};

export type TreatmentVisit = {
  id: string;
  doneOn: string;
  what: string;
  area: string;
  note: string;
  staffName: string;
  archived: boolean;
  products: { id: string; item: string; qty: number; unit: string; batch: string }[];
  shots: TreatmentShot[];
};

export function TreatmentHistory({
  visits,
  copy,
}: {
  visits: TreatmentVisit[];
  copy: RecordFormCopy;
}) {
  /* 🔴 一笔都没有就整段不画 —— 见档头。 */
  if (visits.length === 0) return null;

  return (
    <section>
      <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
        {copy.treatHeading}
      </h2>
      <p className="mt-1 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
        {copy.treatLede}
      </p>

      <ol className="mt-4 flex flex-col gap-4">
        {visits.map((v) => (
          <li
            key={v.id}
            className="rounded-[var(--radius-md)] border p-4 [border-color:var(--color-ink-800)]"
            style={{ opacity: v.archived ? 0.55 : 1 }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="[font-size:var(--text-base)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
                {v.what}
                {v.area ? (
                  <span className="[font-weight:var(--fw-regular)] text-[color:var(--color-on-canvas-dim)]">
                    {" · "}
                    {v.area}
                  </span>
                ) : null}
              </span>
              <span className="[font-size:var(--text-sm)] tabular-nums text-[color:var(--color-on-canvas-dim)]">
                {v.doneOn}
                {v.staffName ? ` · ${copy.treatBy} ${v.staffName}` : ""}
              </span>
            </div>

            {/* 用了什么 —— 而**批号要印出来**：那是她被问「你用的是哪一批」
              时唯一答得出来的东西。 */}
            {v.products.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {v.products.map((p) => (
                  <li
                    key={p.id}
                    className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]"
                  >
                    {copy.treatUsed} {p.item} — {p.qty}
                    {p.unit ? ` ${p.unit}` : ""}
                    {p.batch ? ` · ${copy.treatBatch} ${p.batch}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}

            {v.note ? (
              <p className="mt-2 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                {v.note}
              </p>
            ) : null}

            {/* 之前 · 之后摆在一起 —— 那正是她要的那一件。 */}
            {v.shots.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-3">
                {v.shots.map((s) => (
                  <li key={s.id} className="w-[9rem]">
                    {s.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.url}
                        alt={s.caption || s.stage}
                        className="h-[9rem] w-[9rem] rounded-[var(--radius-sm)] object-cover"
                      />
                    ) : (
                      <div className="h-[9rem] w-[9rem] rounded-[var(--radius-sm)] border [border-color:var(--color-ink-800)]" />
                    )}
                    <div className="mt-1 [font-size:var(--text-xs)] text-[color:var(--color-on-canvas-dim)]">
                      {s.stage === "before"
                        ? copy.treatBefore
                        : s.stage === "after"
                          ? copy.treatAfter
                          : s.caption}
                    </div>
                    {/* 🔴 给看跟不给看必须长得不一样 —— 见档头。 */}
                    <div
                      className="[font-size:var(--text-xs)]"
                      style={{
                        color: s.mayShow
                          ? "var(--color-jade-bright)"
                          : "var(--color-on-canvas-dim)",
                      }}
                    >
                      {s.mayShow ? copy.treatMayShow : copy.treatMayNotShow}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

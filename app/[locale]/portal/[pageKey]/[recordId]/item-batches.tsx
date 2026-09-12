/* 这一件货的批号 —— 一件货自己的一条线，跟「她做过什么」同一条判断。
 *
 * ── 为什么它长在这一件货自己的页上，而不是效期那一页 ──────────────────────
 *
 * 效期那一页（`(app)/expiry`）答的是「全店什么快过期了」——一张跨所有货品
 * 的清单，柜台每天扫一遍。这一段答的是完全不同的问题：**站在这一件货面前**
 * 的时候，「它现在还有几批、哪一批先过期」。两个问题都真，两处都该在，
 * 不是重复——一个是全店的巡查，一个是这一件货自己的历史。
 *
 * ── 🔴 而它只在这一件货真的有批号的时候才画 ────────────────────────────
 *
 * 一间五金店的螺丝没有批号，这一段对它整个不存在——跟「她做过什么」
 * 那一段同一条纪律（treatment-history.tsx 档头）：一段永远说「没有批号」
 * 的东西，读起来是这一页没做完，不是没有批号。
 *
 * ── 进价只给看得到钱的人 ─────────────────────────────────────────────────
 *
 * `batches_of` 自己已经把 `unit_cost_cents` 对看不到钱的人改成 null
 * （`sees_money` 判断在资料库那一层），这里不用再问一次角色。
 */
import type { RecordFormCopy } from "../record-copy";
import { ringgit } from "@/lib/portal/live-rows";

export type ItemBatch = {
  batchId: string;
  code: string;
  onHand: number;
  unit: string;
  receivedOn: string | null;
  expiryOn: string | null;
  daysLeft: number | null;
  isExpired: boolean;
  unitCostCents: number | null;
};

export function ItemBatches({
  batches,
  copy,
}: {
  batches: ItemBatch[];
  copy: RecordFormCopy;
}) {
  /* 🔴 一批都没有就整段不画 —— 见档头。 */
  if (batches.length === 0) return null;

  return (
    <section>
      <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
        {copy.batchHeading}
      </h2>
      <p className="mt-1 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
        {copy.batchLede}
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {batches.map((b) => (
          <li
            key={b.batchId}
            className="rounded-[var(--radius-md)] border p-4 [border-color:var(--color-ink-800)]"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="[font-size:var(--text-base)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
                {b.code}
              </span>
              <span className="tabular-nums [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                {b.onHand} {b.unit}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 [font-size:var(--text-sm)]">
              {b.receivedOn ? (
                <span className="text-[color:var(--color-on-canvas-dim)]">
                  {copy.batchReceived} {b.receivedOn}
                </span>
              ) : null}

              {/* 🔴 两色，不是三色——[重点：过期只答「要不要多留意」这一句]。
                  红 = 已经过期；灰 = 还没到，不管还剩几天都同一个颜色。 */}
              {b.expiryOn ? (
                <span
                  className="inline-flex items-center gap-1.5"
                  style={{
                    color: b.isExpired
                      ? "var(--color-clay-bright)"
                      : "var(--color-on-canvas-dim)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: b.isExpired
                        ? "var(--color-clay-bright)"
                        : "var(--color-on-canvas-dim)",
                    }}
                  />
                  {b.isExpired ? copy.batchExpired : b.expiryOn}
                </span>
              ) : null}

              {b.unitCostCents != null ? (
                <span className="text-[color:var(--color-on-canvas-dim)]">
                  {copy.batchCost} {ringgit(b.unitCostCents)}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

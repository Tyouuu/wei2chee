"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { commissionOn, tierProblems, tierPhrase, type Tier } from "@/lib/portal/commission";
import { ringgit } from "@/lib/portal/live-rows";
import type { RecordFormCopy } from "../record-copy";

/**
 * 他的抽成，跟这个月他做了多少。
 *
 * ── 为什么它在师傅那一页，不在一张「佣金表」上 ────────────────────────────
 *
 * 佣金是**一个人身上的一件事**：Aida 头五千抽一成、Siti 一律一成半。
 * 一张全公司的佣金表读起来像薪资系统，而那是 SQL Account 跟 AutoCount
 * 各自卖的另一个产品（[任务 113]）。这里只回答「这个人怎么算」。
 *
 * ── 🔴 它不会自己写一笔佣金出去 ──────────────────────────────────────────
 *
 * 算出来是 RM 950，画面就写 RM 950，**而且明写「这只是算给你看的」**。
 * 替他记一笔他没有讲过要付的钱，是在他的帐上凭空多一笔支出 ——
 * 而他要到对帐的时候才会发现，那时候已经隔了一个月。
 *
 * 他真的要付的那天，去开销那一页记一笔 —— 走的是他手打一笔开销
 * 同一支函式（[重点 23] AI 平权的同一条：一件事一条路）。
 *
 * ── 数字一边打一边动 ──────────────────────────────────────────────────────
 *
 * 算钱的那一份在资料库（月底要一次算完一整家的人），这一份在浏览器，
 * 因为他改比例的时候要**当场**看到这个月会变成多少。
 * 两份算术就是两个真相，除非它们用同一批断言验 —— 而它们是
 * （lib/portal/commission.test.ts 跟 check:records ㉒ 用同一组数字）。
 */

export type CommissionTier = { id?: string; from: string; percent: string };

export function CommissionPanel({
  partyId,
  tiers: saved,
  earnedCents,
  copy,
}: {
  partyId: string;
  tiers: readonly CommissionTier[];
  /** 这个月算在他名下的收款。⚠️ **0 跟「没有」是同一件事** ——
   *  两个都表示这个月他名下没有钱，画面上讲同一句话。 */
  earnedCents: number;
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<CommissionTier[]>(saved.length ? [...saved] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  /* 他打到一半的东西也要算得出来 —— 一个只在保存后才更新的数字，
     他会以为是坏的。看不懂的那一行当零，不是整个不算。 */
  const parsed: Tier[] = useMemo(
    () =>
      rows.map((r) => ({
        fromCents: Math.round((Number(r.from.replace(/[^\d.]/g, "")) || 0) * 100),
        percent: Number(r.percent.replace(/[^\d.]/g, "")) || 0,
      })),
    [rows],
  );

  const problems = tierProblems(parsed, {
    duplicate: copy.tiersDuplicate,
    tooMany: copy.tiersTooMany,
    badPercent: copy.tiersBadPercent,
  });

  /* 🔴 **不是从伺服器传下来的一个函式** —— 那条线只过得了字串
     （record-copy.ts 的档头：一个函式让整页变成「Something broke here.」）。
     这里直接 import 产品自己那一支，所以格式跟表格上的每一个金额一样。 */
  const rm = (cents: number) => ringgit(cents) ?? "RM 0";

  const phrase = tierPhrase(parsed, rm, {
    first: copy.tiersFirst,
    then: copy.tiersThen,
    from: copy.tiersOnwards,
    join: copy.tiersJoin,
  });

  const commission = commissionOn(earnedCents, parsed);


  async function save() {
    if (problems.length) return;
    setError(null);
    setBusy(true);
    setJustSaved(false);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc("set_commission_tiers", {
        in_party_id: partyId,
        in_tiers: parsed.map((t) => ({ from_cents: t.fromCents, percent: t.percent })),
      });
      if (err) {
        setError(err.message);
        return;
      }
      setJustSaved(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const control =
    "ds-control h-10 w-full min-w-0 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]";
  const dim = "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";

  return (
    <div className="flex flex-col gap-4">
      {/* ⚠️ **一个标题，一个数字。**
          第一版这里有自己的「这个月」小标跟一格「他做了 RM 8,000」——
          而表单里那一格（模板自己就把那一栏叫「本月业绩」）现在也是
          同一个数字。一页上同一件事写两次不是错，是杂讯，
          而杂讯读起来就是这一页没做完。业绩留给上面那一格，
          这里只讲**抽多少**。 */}
      <div>
        <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.tiersHeading}
        </h2>
        <p className={`mt-1 ${dim}`}>{copy.tiersLede}</p>

        {/* 这个月抽多少。**只有写了档才画** —— 一个 RM 0 的抽成读起来像
            「这个月他一分佣金都没有」，而真相是他根本没有抽成。 */}
        {parsed.length ? (
          <div className="mt-4">
            <div className={dim}>{copy.earnedCommission}</div>
            <div className="mt-0.5 [font-size:var(--text-stat)] [font-weight:var(--fw-semibold)] tabular-nums text-[color:var(--color-primary)]">
              {rm(commission)}
            </div>
            <p className={`mt-1 ${dim}`}>
              {earnedCents > 0 ? copy.earnedNotPaid : copy.earnedNone}
            </p>
          </div>
        ) : null}

        {rows.length ? (
          <div className="mt-3 flex flex-col gap-2">
            {rows.map((r, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-24 flex-1 flex-col gap-1">
                  <span className={dim}>{copy.tiersFrom}</span>
                  <input
                    aria-label={`${copy.tiersFrom} ${i + 1}`}
                    inputMode="decimal"
                    value={r.from}
                    onChange={(e) =>
                      setRows(rows.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))
                    }
                    className={control}
                  />
                </label>
                <label className="flex w-24 flex-col gap-1">
                  <span className={dim}>{copy.tiersPercent}</span>
                  <input
                    aria-label={`${copy.tiersPercent} ${i + 1}`}
                    inputMode="decimal"
                    value={r.percent}
                    onChange={(e) =>
                      setRows(rows.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)))
                    }
                    className={control}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  className={`min-h-10 underline ${dim}`}
                >
                  {copy.tiersRemove}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className={`mt-3 ${dim}`}>{copy.tiersNone}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              setRows([
                ...rows,
                /* 第一档从 0 开始，之后每一档他自己写 —— 猜一个数字进去，
                   他会以为那是我们建议的抽成办法。 */
                { from: rows.length ? "" : "0", percent: "" },
              ])
            }
            className="inline-flex h-10 items-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)]"
          >
            {copy.tiersAdd}
          </button>
          <button
            type="button"
            disabled={busy || problems.length > 0}
            onClick={() => void save()}
            className="inline-flex h-10 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] disabled:opacity-60"
          >
            {busy ? copy.saving : copy.save}
          </button>
          {justSaved && !busy ? <span className={dim}>{copy.tiersSaved}</span> : null}
        </div>

        {/* 一句他读得懂的话。⚠️ `tierPhrase` 没有档的时候回 null，
            不是空字串 —— 空字串会画出一行空的说明。 */}
        {phrase && !problems.length ? <p className={`mt-3 ${dim}`}>{phrase}</p> : null}

        {problems.map((p) => (
          <p
            key={p}
            role="alert"
            className="mt-2 [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
          >
            {p}
          </p>
        ))}
        {error ? (
          <p
            role="alert"
            className="mt-2 [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

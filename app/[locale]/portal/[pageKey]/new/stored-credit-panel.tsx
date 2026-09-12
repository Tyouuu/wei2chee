"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecordFormCopy } from "../record-copy";

/**
 * 「充值」跟「用掉」两颗按钮——[任务 346] 留着没做的那半件。
 *
 * ── 为什么这两颗到今天才做（[任务 399] 收尾之后的下一件）─────────────────
 *
 * `grant_credit` · `use_credit`（20260909360000）从做出来那天起零个呼叫端，
 * 这一页只接了读的那一半（她卡里还剩多少）。这一支补写的那一半。
 *
 * ── 🔴 两颗按钮不是同一个人按的 ──────────────────────────────────────────
 *
 * 送一笔是老板的决定（`grant_credit` 挡 `sees_money`），用掉一笔是柜台
 * 交出已经答应过的东西（`use_credit` 只挡 `works_here`）——跟订金那次
 * 同一条纪律（[任务 333]）。⚠️ 而这一段今天整段只对 `ctx.role === "owner"`
 * 画出来（这一页读 `storedCredit` 的那个闸），所以两颗按钮实际上都只有
 * 老板按得到——柜台今天看不到这一段，是另一件事，登记在[任务 399] 收尾里，
 * 不在这里顺手改，因为它牵动的是这一页money这一整块的角色分界，不是
 * 一颗按钮的事。
 *
 * ── 用掉不给编钱包总额，只记这一笔 ───────────────────────────────────────
 *
 * `use_credit` 自己挡透支、自己讲得出「她只剩多少」——这里不猜、
 * 不自己算余额，錯误讯息原样显示（跟 `NoShowPanel` 同一个做法）。
 */
export function StoredCreditPanel({
  projectId,
  partyId,
  copy,
}: {
  projectId: string;
  partyId: string;
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [grantAmount, setGrantAmount] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [useAmount, setUseAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(name: string, args: Record<string, unknown>, tag: string) {
    setError(null);
    setBusy(tag);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(name, args);
      if (err) {
        setError(err.message);
        return;
      }
      if (tag === "grant") {
        setGrantAmount("");
        setGrantReason("");
      } else {
        setUseAmount("");
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const dim = "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";
  const control =
    "ds-control h-10 w-32 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none";
  const controlWide =
    "ds-control h-10 w-full min-w-0 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none";
  const ghost =
    "inline-flex h-10 items-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)] disabled:opacity-60";

  return (
    <div className="mt-4 flex flex-col gap-5 border-t pt-4 [border-color:var(--color-ink-800)]">
      <div className="flex flex-col gap-2">
        <h3 className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.storedCreditGrantHeading}
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className={dim}>{copy.storedCreditGrantAmount}</span>
            <div className="flex items-center gap-2">
              <span className={dim}>RM</span>
              <input
                type="number"
                min="0"
                step="1"
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                className={control}
              />
            </div>
          </label>
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
            <span className={dim}>{copy.storedCreditGrantReason}</span>
            <input
              type="text"
              value={grantReason}
              onChange={(e) => setGrantReason(e.target.value)}
              className={controlWide}
            />
          </label>
          <button
            type="button"
            disabled={busy !== null || grantAmount.trim() === ""}
            onClick={() =>
              void call(
                "grant_credit",
                {
                  in_project_id: projectId,
                  in_party_id: partyId,
                  in_amount_cents: Math.round(Number(grantAmount) * 100),
                  in_reason: grantReason,
                },
                "grant",
              )
            }
            className={ghost}
          >
            {busy === "grant" ? copy.saving : copy.storedCreditGrantSave}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.storedCreditUseHeading}
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className={dim}>{copy.storedCreditUseAmount}</span>
            <div className="flex items-center gap-2">
              <span className={dim}>RM</span>
              <input
                type="number"
                min="0"
                step="1"
                value={useAmount}
                onChange={(e) => setUseAmount(e.target.value)}
                className={control}
              />
            </div>
          </label>
          <button
            type="button"
            disabled={busy !== null || useAmount.trim() === ""}
            onClick={() =>
              void call(
                "use_credit",
                {
                  in_project_id: projectId,
                  in_party_id: partyId,
                  in_amount_cents: Math.round(Number(useAmount) * 100),
                },
                "use",
              )
            }
            className={ghost}
          >
            {busy === "use" ? copy.saving : copy.storedCreditUseSave}
          </button>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

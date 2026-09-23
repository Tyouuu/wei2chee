"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ringgit } from "@/lib/portal/live-rows";
import type { RecordFormCopy } from "../record-copy";

/**
 * 上下班打卡——跟墙上那张签到表同一个骨架（[任务 375](../../../../../docs/founder-tasks.md#375)）。
 *
 * ── 为什么这一段今天才接（[任务 401]，[任务 375] 收尾的那半件）─────────────
 *
 * `clock_in` · `clock_out` · `who_is_clocked_in` · `hours_worked_of`
 * （20260911240000）从做出来那天起，只有助手打得到（[任务 387]），
 * 画面上一个入口都没有——一个只能靠讲话才用得到的功能，跟不存在
 * 差不了多少（这个仓库自己犯过十九次的那个形状）。
 *
 * ── 一栏还没填，不是第五个状态 ────────────────────────────────────────────
 *
 * `clock_out_at` 是 null 就是还在上班，不是另一个要挑的选项——所以
 * 这里只有一颗按钮：还没打卡就给「打卡上班」，打了卡就换成「打卡下班」，
 * 不是两颗按钮并排给他选。
 *
 * ── 小费也在这里，不在一张全公司的排行上（`tips_of`，20260911190000）──────
 *
 * 跟 `commission-panel.tsx` 那句「一张全公司的佣金表读起来像薪资系统」
 * 同一个理由，换成小费更明显：把全店小费排成一张榜，读起来是在比
 * 「谁的客人比较大方」，没有人想看到自己排在最后一个。`tips_of` 本来就
 * 只挡 `works_here`（不是 `sees_money`）——他自己拿了多少，自己看得到，
 * 这一段跟打卡放在一起正合适：都是「关于我自己」的一件事，不是店里的钱。
 */
export function StaffShiftPanel({
  staffId,
  clockedInSince,
  hours,
  shifts,
  tipCents,
  tippedVisits,
  copy,
}: {
  staffId: string;
  clockedInSince: string | null;
  hours: number;
  shifts: number;
  /** 最近 30 天客人给的小费，`tips_of` 算的——不是营业额，是直接给做事
   *  那个人的钱，从来不经过老板的户口（20260911190000）。 */
  tipCents: number;
  tippedVisits: number;
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(name: string) {
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(name, {
        in_staff_id: staffId,
      });
      if (err) {
        setError(err.message);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const dim = "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";
  const solid =
    "inline-flex h-10 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] disabled:opacity-60";
  const ghost =
    "inline-flex h-10 items-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)] disabled:opacity-60";

  const since = clockedInSince
    ? new Date(clockedInSince).toLocaleTimeString("en-MY", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="flex flex-col gap-3">
      <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
        {copy.staffShiftHeading}
      </h2>

      <p className={dim}>
        {clockedInSince ? copy.staffShiftIn.replace("{time}", since) : copy.staffShiftOut}
      </p>

      <div>
        {clockedInSince ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void call("clock_out")}
            className={ghost}
          >
            {copy.staffShiftClockOut}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void call("clock_in")}
            className={solid}
          >
            {copy.staffShiftClockIn}
          </button>
        )}
      </div>

      <p className={dim}>
        {shifts > 0
          ? copy.staffShiftHours
              .replace("{hours}", String(hours))
              .replace("{shifts}", String(shifts))
          : copy.staffShiftHoursNone}
      </p>

      <p className={dim}>
        {tippedVisits > 0
          ? copy.staffShiftTips
              .replace("{amount}", ringgit(tipCents) ?? "RM 0")
              .replace("{visits}", String(tippedVisits))
          : copy.staffShiftTipsNone}
      </p>

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

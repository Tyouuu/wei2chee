"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ringgit } from "@/lib/portal/live-rows";
import type { RecordFormCopy } from "../record-copy";

/**
 * 这位客人每个月固定付一笔钱（`memberships` / `membership_payments`，
 * 20260912060000）。`add_membership` · `collect_membership_fee` ·
 * `set_membership_archived` 从做出来那天起零个 UI 呼叫端——地基搭好了，
 * 画面上一个入口都没有（这个仓库自己犯过二十次的那个形状）。
 *
 * ── 只有一份，不是套票那种一叠 ────────────────────────────────────────────
 *
 * `memberships` 表自己的注解写着「一个客人一份办法」——不是像套票那样
 * 可以同时买好几张不同的。所以这里不是 `packages-panel.tsx` 那种清单，
 * 是跟 `commission-panel.tsx` 同一种形状：一个人身上**一件事**，
 * 有就显示现状，没有就给一个开始的表单。
 *
 * ── 自动扣款那一半故意不做 ────────────────────────────────────────────────
 *
 * `next_due_on` 是老板自己按「这个月收了」才往后推一个月的一个事实，
 * 不是排程算出来的——因为真的自动扣款要串收款闸道，而闸道本身还没有
 * （migration 自己的注解）。这一支只接已经做好的那一半：记事实、算日期。
 */

export type MembershipInfo = {
  id: string;
  planName: string;
  monthlyFeeCents: number;
  nextDueOn: string;
  overdue: boolean;
  archived: boolean;
};

export function MembershipPanel({
  projectId,
  partyId,
  membership,
  copy,
}: {
  projectId: string;
  partyId: string;
  /** null = 这位客人从来没有开过会员费。 */
  membership: MembershipInfo | null;
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState("");
  const [fee, setFee] = useState("");

  const db = () => createBrowserSupabaseClient();

  async function run(work: () => PromiseLike<{ error: { message: string } | null }>) {
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await work();
      if (err) {
        setError(err.message);
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    const cents = Math.round((Number(fee.replace(/[^\d.]/g, "")) || 0) * 100);
    if (!plan.trim() || cents <= 0) return;
    const ok = await run(() =>
      db().rpc("add_membership", {
        in_project_id: projectId,
        in_party_id: partyId,
        in_plan_name: plan.trim(),
        in_monthly_fee_cents: cents,
      }),
    );
    if (ok) {
      setPlan("");
      setFee("");
      setOpen(false);
    }
  }

  const dim = "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";
  const control =
    "ds-control h-10 w-full min-w-0 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]";
  const quiet =
    "inline-flex min-h-11 items-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)] disabled:opacity-60";
  const solid =
    "inline-flex min-h-11 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] disabled:opacity-60";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.memberHeading}
        </h2>
        {!membership ? <p className={`mt-1 ${dim}`}>{copy.memberLede}</p> : null}
      </div>

      {membership ? (
        <div className="flex flex-col gap-2">
          <div className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
            {membership.planName} — {ringgit(membership.monthlyFeeCents)}/mo
          </div>
          {membership.archived ? (
            <p className={dim}>{copy.memberCancelled}</p>
          ) : (
            <p className={dim}>
              {copy.memberNextDue.replace("{date}", membership.nextDueOn)}
              {membership.overdue ? ` ${copy.memberOverdue}` : ""}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {membership.archived ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    db().rpc("set_membership_archived", {
                      in_id: membership.id,
                      in_archived: false,
                    }),
                  )
                }
                className={quiet}
              >
                {busy ? copy.memberRestarting : copy.memberRestart}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      db().rpc("collect_membership_fee", {
                        in_membership_id: membership.id,
                        in_idempotency_key: crypto.randomUUID(),
                      }),
                    )
                  }
                  className={solid}
                >
                  {busy ? copy.memberCollecting : copy.memberCollect}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      db().rpc("set_membership_archived", {
                        in_id: membership.id,
                        in_archived: true,
                      }),
                    )
                  }
                  className={`min-h-11 underline ${dim}`}
                >
                  {busy ? copy.memberCancelling : copy.memberCancel}
                </button>
              </>
            )}
          </div>
        </div>
      ) : open ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-40 flex-1 flex-col gap-1">
            <span className={dim}>{copy.memberPlan}</span>
            <input
              aria-label={copy.memberPlan}
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className={control}
            />
          </label>
          <label className="flex w-32 flex-col gap-1">
            <span className={dim}>{copy.memberFee}</span>
            <input
              aria-label={copy.memberFee}
              inputMode="decimal"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className={control}
            />
          </label>
          <button
            type="button"
            disabled={busy || !plan.trim() || !fee.trim()}
            onClick={() => void start()}
            className={solid}
          >
            {busy ? copy.memberStarting : copy.memberStart}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`self-start ${quiet}`}>
          {copy.memberStart}
        </button>
      )}

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

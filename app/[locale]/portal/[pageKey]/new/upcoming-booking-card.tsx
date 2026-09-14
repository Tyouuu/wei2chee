"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { IconCalendar } from "@/design-system/components/rail-icons";
import { ringgit } from "@/lib/portal/live-rows";
import type { RecordFormCopy } from "../record-copy";

/**
 * 客户详情页左栏——她下一次要来。
 *
 * ── 为什么这一张卡有自己的档案，不是留在 `[recordId]/page.tsx` 里当一段 JSX
 * （老板逐行比对参考稿之后，2026-09-14）───────────────────────────────────
 *
 * 参考稿这张卡底下是两颗真的按钮（Reschedule · Cancel），而
 * 「点一下就取消」要呼叫 `set_appointment_status`——跟这一笔预约自己
 * 详情页上「Not yet / Came / No show / Cancelled」那排分段钮，走的是
 * 同一支（[重点 23]：AI 平权那条纪律的人类版——同一件事只能有一条写入
 * 路径）。这里不重造一支「客户页专用」的取消，只是给它另一个更顺手的
 * 入口。一旦要呼叫资料库，这一段就必须是客户端组件，留在服务器组件的
 * `page.tsx` 里放不下这一颗按钮。
 *
 * ⚠️ 没有做「Reschedule」——挑一个新时段要先看这门生意还有哪些时段空着，
 * 那是另一件事（[任务 368] 记着的下一步），不是这一张卡现在答得了的。
 * 换成「View」：点得进那一笔自己的详情页，那里已经有改期／标到了的
 * 完整控制台，不重造第二套。
 */
export function UpcomingBookingCard({
  id,
  locale,
  service,
  day,
  startTime,
  endTime,
  staffName,
  priceCents,
  copy,
}: {
  id: string;
  locale: string;
  service: string;
  day: string;
  startTime: string;
  endTime: string;
  staffName: string | null;
  priceCents: number | null;
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  async function cancel() {
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(
        "set_appointment_status",
        { in_id: id, in_status: "cancelled" },
      );
      if (err) {
        setError(err.message);
        return;
      }
      setCancelled(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (cancelled) return null;

  const ghost =
    "inline-flex min-h-9 flex-1 items-center justify-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [font-size:var(--text-xs)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)] disabled:opacity-60";

  return (
    <div className="ds-card mt-6 p-6 [&>*:first-child]:border-t-0 [&>*:first-child]:pt-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 [font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          <IconCalendar className="h-[16px] w-[16px] text-[color:var(--color-on-canvas-dim)]" />
          {copy.upcomingHeading}
        </div>
        <span className="inline-flex min-h-6 items-center rounded-full border px-2.5 [font-size:var(--text-xs)] [font-weight:var(--fw-medium)] [border-color:var(--color-ink-800)] text-[color:var(--color-on-canvas-dim)]">
          {copy.upcomingConfirmed}
        </span>
      </div>

      {/* 🔴 内嵌小格——参考稿把这一段内容摆在一个浅色、独立的框里
        （`border rounded-xl bg-zinc-50/50`），不是卡里的裸内容。 */}
      <a
        href={`/${locale}/portal/bookings/${id}`}
        className="mt-3 block [border-radius:var(--radius-md)] border p-4 [background-color:var(--color-ink-850)] [border-color:var(--color-ink-800)]"
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
            {service}
          </div>
          {priceCents != null ? (
            <div className="shrink-0 tabular-nums [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)]">
              {ringgit(priceCents)}
            </div>
          ) : null}
        </div>
        <div className="mt-1 [font-size:var(--text-xs)] text-[color:var(--color-on-canvas-dim)]">
          {day} · {startTime}–{endTime}
          {staffName ? ` · ${copy.upcomingWith}: ${staffName}` : ""}
        </div>
      </a>

      <div className="mt-3 flex gap-2">
        <a href={`/${locale}/portal/bookings/${id}`} className={ghost}>
          {copy.upcomingView}
        </a>
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className={ghost}
        >
          {copy.upcomingCancel}
        </button>
      </div>
      {error ? (
        <p className="mt-2 [font-size:var(--text-xs)] text-[color:var(--color-clay-bright)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

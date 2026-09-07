"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecordFormCopy } from "../record-copy";

/**
 * 这一单的下一步。
 *
 * ── 为什么这一格值得存在 ──────────────────────────────────────────────────
 *
 * 2026-09-05 读了 Zoho CRM · Pipedrive · Zoho 库存 · Odoo · Linnworks 的
 * 功能页，然后逐条查我们自己的库。CRM · 库存 · 订单三类的骨干我们都有，
 * 而他们真正在卖的那一件我们是**整片空白**：
 * Pipedrive 整个产品就是 `Processes, pipeline and activities`。
 *
 * 一个承包商手上十二张报价单，今天没有任何地方写着**星期五要打给谁**。
 *
 * ── 🔴 一张单只有一个下一步 ───────────────────────────────────────────────
 *
 * 唯一索引挡着（20260905800000），不是靠这一格客气。
 * 「下一步」这三个字本身就是单数 —— 一张单上挂五件待办，那是一份专案计划，
 * 而一个五个人的装修公司不写专案计划。**做完一件，才写下一件。**
 *
 * ── 「做完」跟「不跟了」是两颗 ─────────────────────────────────────────────
 *
 * 只给他一颗「做完」，他会拿它去关掉一件其实没有做的事 ——
 * 而那本帐从此在说谎。
 */

export function FollowUpPanel({
  recordId,
  open,
  copy,
}: {
  recordId: string;
  /** 还没做完的那一个。null = 这一单现在没有下一步。 */
  open: { id: string; what: string; dueOn: string; daysLate: number } | null;
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [what, setWhat] = useState(open?.what ?? "");
  const [due, setDue] = useState(open?.dueOn ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(
    name: string,
    args: Record<string, unknown>,
    tag: string,
  ) {
    setError(null);
    setBusy(tag);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(
        name,
        args,
      );
      if (err) {
        setError(err.message);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const dim =
    "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";
  const control =
    "ds-control h-10 w-full min-w-0 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none";
  const ghost =
    "inline-flex h-10 items-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)] disabled:opacity-60";
  const solid =
    "inline-flex h-10 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] disabled:opacity-60";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.nextHeading}
        </h2>
        <p className={`mt-1 ${dim}`}>{copy.nextLede}</p>
      </div>

      {/* 已经有一个 —— 先把它讲出来，而且逾期了要看得出来。
          🔴 逾期不是一句提醒，那是他今天真正该做而没做的那一件。 */}
      {open ? (
        <div className="flex flex-col gap-2">
          <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas)]">
            {open.what}
          </p>
          <p
            className={
              open.daysLate > 0
                ? "[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
                : dim
            }
          >
            {open.daysLate > 0
              ? copy.nextLate
                  .replace("{n}", String(open.daysLate))
                  .replace("{date}", open.dueOn)
              : copy.nextOn.replace("{date}", open.dueOn)}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void call("finish_follow_up", { in_id: open.id }, "done")
              }
              className={ghost}
            >
              {busy === "done" ? copy.saving : copy.nextDone}
            </button>
            {/* 「不跟了」跟「做完了」分开 —— 见档头。 */}
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void call("drop_follow_up", { in_id: open.id }, "drop")
              }
              className={`min-h-10 underline ${dim}`}
            >
              {copy.nextDrop}
            </button>
          </div>
        </div>
      ) : null}

      {/* 写一个新的，或者改现在这一个 —— 同一支函式，因为他改主意是常态。 */}
      <div className="flex flex-col gap-3 border-t pt-4 [border-color:var(--color-ink-800)]">
        <label className="flex flex-col gap-1">
          <span className={dim}>{copy.nextWhat}</span>
          {/* 🔴 **不给选单。** 「打电话问决定了没有」跟「叫师傅去量尺寸」
              是两件完全不同的事，而一份下拉会把他真正要做的那件挤掉。 */}
          <input
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            placeholder={copy.nextPlaceholder}
            className={control}
          />
        </label>
        <label className="flex w-44 flex-col gap-1">
          <span className={dim}>{copy.nextWhen}</span>
          <input
            type="date"
            aria-label={copy.nextWhen}
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className={control}
          />
        </label>
        <div>
          <button
            type="button"
            disabled={busy !== null || !what.trim()}
            onClick={() =>
              void call(
                "set_follow_up",
                {
                  in_record_id: recordId,
                  in_what: what,
                  in_due_on: due || null,
                },
                "save",
              )
            }
            className={solid}
          >
            {busy === "save"
              ? copy.saving
              : open
                ? copy.nextChange
                : copy.nextSave}
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

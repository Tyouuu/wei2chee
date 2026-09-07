"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecordFormCopy } from "../record-copy";

/**
 * 对完了，把这个月关起来 —— 跟重开。
 *
 * ── 为什么这一颗是那道锁的「最后一寸」 ────────────────────────────────────
 *
 * `set_reconciliation_settled` 从 20260902020000 就在，而到 2026-09-05 为止
 * **全 app 零个呼叫**（grep 过）。也就是他**关不了一个月，也重开不了** ——
 * 於是 20260905740000 那道期间锁对他来说既看不见也碰不到：
 * 一道没有人按得到开关的锁，跟没有那道锁是同一件事。
 *
 * ── 🔴 关起来之后会发生什么，一定要在按下去之前讲 ──────────────────────
 *
 * 那是这四个洞里**唯一一个「收紧」**，而收紧最危险的地方不是它挡不住，
 * 是**它会挡到每一条写入路径，而画面上只看得到「存不了」**。
 * 所以这一段的字比这颗按钮重要：关了之后这个月**这一边**的钱改不了，
 * 而出路只有一条 —— **重开、改完、再关**（会计本来就是这样做的，
 * 抄他自己 vibe-dealer 0031 那一句：一次查得到的动作，
 * 而不是每一行挂一个例外旗子）。
 *
 * ⚠️ **故意不做「确定要关吗」那个跳出来的框。** 关错了按重开就好，
 * 而重开就在同一个地方 —— 一个退得回去的动作不需要拦一次。
 */
export function SettleMonth({
  id,
  settledAt,
  copy,
}: {
  id: string;
  /** 关起来那一天。null = 还没关。 */
  settledAt: string | null;
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function flip(next: boolean) {
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(
        "set_reconciliation_settled",
        { in_id: id, in_settled: next },
      );
      if (err) {
        setError(err.message);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const dim =
    "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.settleHeading}
        </h2>
        <p className={`mt-1 ${dim}`}>
          {settledAt
            ? copy.settleClosed.replace("{date}", settledAt.slice(0, 10))
            : copy.settleLede}
        </p>
      </div>

      <div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void flip(!settledAt)}
          className={
            settledAt
              ? "inline-flex h-10 items-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)] disabled:opacity-60"
              : "inline-flex h-10 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] disabled:opacity-60"
          }
        >
          {busy
            ? copy.saving
            : settledAt
              ? copy.settleReopen
              : copy.settleClose}
        </button>
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

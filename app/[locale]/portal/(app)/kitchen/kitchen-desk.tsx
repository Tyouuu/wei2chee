"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { deskBtn, deskDim } from "../desk-kit";

/**
 * 一行一碟没出的菜，等最久的排最前。
 *
 * ── 🔴 两颗按钮，而第一颗才是重点 ───────────────────────────────────────
 *
 * **出一碟** 跟 **全出** —— 三碟粿条一碟一碟端出去是这一行的常态，
 * 而一个只有「做好了」的勾答不了「还剩两碟」。
 *
 * ── 🔴 出多了不在这里挡 ─────────────────────────────────────────────────
 *
 * `serve_line` 自己会挡，而且**讲差多少**（「只剩 2 碟没出，一共 3 碟」）。
 * 在这里再写一次那条算术，就是同一个问题两个答案 ——
 * 这个仓库栽在那上面至少八次。这一页只负责把那句话原样印出来。
 */

export type QueueRow = {
  line_id: string;
  record_id: string;
  doc_no: string;
  table_name: string | null;
  description: string;
  ordered: number;
  served: number;
  still_due: number;
  unit: string | null;
  note: string | null;
  ordered_at: string;
  waiting_minutes: number;
};

/* 🔴 这一层自己拿字典，不吃上一层传下来的字串。
   理由是量出来的：一句带 {n} 的话，在服务端 t(key) 拿不到值就整个解析不出来，
   而画面上印的是**键名**（第一次跑那一屏上写着 portal.kitchen.stillDue）——
   一个只在有数字的时候才坏掉的翻译，静静地就上线了。 */
export function KitchenDesk({ rows }: { rows: readonly QueueRow[] }) {
  const t = useTranslations("portal.kitchen");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function serve(row: QueueRow, howMany: number) {
    setError(null);
    setBusy(row.line_id);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(
        "serve_line",
        { in_line_id: row.line_id, in_qty: howMany },
      );
      /* 🔴 那句拒绝原样印出来 —— 它自己讲得出还剩几碟。 */
      if (err) setError(err.message);
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const due = Number(row.still_due);
        return (
          <div
            key={row.line_id}
            data-kitchen-line={row.description}
            className="flex flex-col gap-2 [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] p-3 sm:flex-row sm:items-center sm:gap-x-3"
          >
            {/* 🔴 窄屏堆起来，不是挤在一行。
              第一版三样挤一行，而两颗按钮是 shrink-0 —— 390 上「Nasi lemak」
              折成两行、那一句说明折成**六行**。那是用眼睛看那张手机图才看到的
              （重点 24：判这一页的是那个在手机上的人，而厨房那块屏就在手机上）。 */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {/* 🔴 还剩几碟最大 —— 那是厨房看这一行唯一要看的数字。 */}
              <span className="[font-size:var(--text-hero)] [font-weight:var(--fw-semibold)] tabular-nums text-[color:var(--color-paper)]">
                {due}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="[font-weight:var(--fw-medium)] text-[color:var(--color-paper)]">
                  {row.description}
                </span>
                <span className={deskDim}>
                  {[
                    /* 🔴 「3 · 2 of 2 left」里那个 3 是桌号，而它读起来像一个数字 ——
                     用眼睛看那张图才看到的。加一个词就分得开了。 */
                    row.table_name
                      ? t("atTable", { t: row.table_name })
                      : t("takeaway"),
                    t("stillDue", { n: due, of: Number(row.ordered) }),
                    t("waiting", { n: row.waiting_minutes }),
                    row.note,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={busy === row.line_id}
                onClick={() => void serve(row, 1)}
                className={deskBtn("primary")}
              >
                {busy === row.line_id ? t("sending") : t("one")}
              </button>
              {due > 1 ? (
                <button
                  type="button"
                  disabled={busy === row.line_id}
                  onClick={() => void serve(row, due)}
                  className={deskBtn("quiet")}
                >
                  {t("all", { n: due })}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}

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

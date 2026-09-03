"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * 他的第二间店。
 *
 * ── 为什么这一页在 Formae 自己的壳里，不在客户系统的某一页 ────────────────
 *
 * 「我有几间店」不是他生意里的一笔记录，是**这套系统怎么设定的**——
 * 跟「谁在这里工作」同一层。放进他自己的模块页，等於在他的报价单旁边
 * 摆一个设定画面。
 *
 * ── 只有老板 ──────────────────────────────────────────────────────────────
 *
 * 多一间店在这个市场是多一份月费（[任务 67]：Tunai · Aoikumo · StoreHub
 * 三家都按店收）。所以开店是老板的决定，资料库那边也是 `sees_money`。
 *
 * ── 关掉，不删 ────────────────────────────────────────────────────────────
 *
 * 去年那一间店做过的每一单还挂在它身上。删掉它，那些单会指向一个
 * 没有名字的地方 —— 跟「收起来不是删掉」同一条。
 */

export type BranchRow = { id: string; name: string; active: boolean };

export function BranchesClient({
  projectId,
  rows,
  copy,
}: {
  projectId: string;
  rows: readonly BranchRow[];
  copy: {
    add: string;
    adding: string;
    name: string;
    off: string;
    on: string;
    offLabel: string;
    none: string;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!name.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc("add_branch", {
        in_project_id: projectId,
        in_name: name.trim(),
      });
      if (err) {
        setError(err.message);
        return;
      }
      setName("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: BranchRow) {
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc("set_branch_active", {
        in_id: row.id,
        in_active: !row.active,
      });
      if (err) setError(err.message);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {copy.none}
        </p>
      ) : (
        <div className="flex flex-col [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)]">
          {rows.map((r, i) => (
            <div
              key={r.id}
              className={`flex min-h-12 items-center gap-3 px-3 py-2 [font-size:var(--text-sm)] ${
                i ? "border-t [border-color:var(--color-ink-800)]" : ""
              }`}
            >
              <span
                className={
                  r.active
                    ? "flex-1 text-[color:var(--color-on-canvas)]"
                    : "flex-1 text-[color:var(--color-on-canvas-dim)] line-through"
                }
              >
                {r.name}
              </span>
              {!r.active ? (
                <span className="[font-size:var(--text-xs)] text-[color:var(--color-on-canvas-dim)]">
                  {copy.offLabel}
                </span>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggle(r)}
                className="min-h-11 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)] underline disabled:opacity-60"
              >
                {r.active ? copy.off : copy.on}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label={copy.name}
          placeholder={copy.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="ds-control h-11 min-w-0 flex-1 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]"
        />
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void add()}
          className="inline-flex h-11 shrink-0 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] transition-colors [transition-duration:var(--dur)] hover:[background-color:var(--color-primary-deep)] disabled:opacity-60"
        >
          {busy ? copy.adding : copy.add}
        </button>
      </div>

      {error ? (
        <p role="alert" className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

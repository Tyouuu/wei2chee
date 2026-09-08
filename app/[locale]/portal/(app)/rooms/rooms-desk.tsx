"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DeskCard, deskBtn, deskDim, deskField } from "../desk-kit";

/**
 * 她的房。
 *
 * ── 为什么一间 medi spa 要这一页，而一间沙龙不要 ──────────────────────────
 *
 * [任务 308] 量过一条规律：**平面图只在「那个位置本身会撞」的时候
 * 买得到东西**。沙龙三到六张椅子一眼数得完，而她真正问的是
 * 「Amy 三点还有没有空」—— 会撞的是师傅。
 * medi spa 反过来：一间做脸的房 60–90 分钟只能一个人，激光机只有一台 ——
 * 三个房五个美疗师，三点排满的是**房**。
 *
 * 而 Zenoti（那一档最大的那一家）自己的讲法是
 * 「每一张椅子、每一间房，都是一个订得到的位置」。
 *
 * ── 关掉，不删 ────────────────────────────────────────────────────────────
 *
 * `appointments.room_id` 是 `on delete restrict` —— 一间排过预约的房
 * 删不掉。而那是对的：去年在那一间做过的每一笔还挂着它。
 * 跟分店那一页同一条（「收起来不是删掉」）。
 *
 * ── 只有老板 ──────────────────────────────────────────────────────────────
 *
 * `add_room` / `set_room_active` 两支都是 `sees_money`，
 * 而 `rooms_of` 是 `works_here` —— 前台看得到今天哪一间空，
 * 开不了也关不了一间房。这一页整页只有老板打得开（见 page.tsx）。
 */

export type RoomRow = { id: string; name: string; active: boolean };

export function RoomsDesk({
  projectId,
  rows,
  copy,
}: {
  projectId: string;
  rows: readonly RoomRow[];
  copy: {
    title: string;
    lede: string;
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
      const { error: err } = await createBrowserSupabaseClient().rpc("add_room", {
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

  async function toggle(row: RoomRow) {
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(
        "set_room_active",
        { in_id: row.id, in_active: !row.active },
      );
      if (err) setError(err.message);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <DeskCard title={copy.title}>
      <div className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <p className={deskDim}>{copy.none}</p>
        ) : (
          /* 🔴 关掉的那几间**排到底下**，不是在同一串里划掉 ——
             她打开这一页问的是「我现在有哪几间」，而一条划掉的字
             混在里面，每一次都要她用眼睛滤一遍。跟分店那一页同一条。 */
          <div className="flex flex-col gap-4">
            {([true, false] as const).map((active) => {
              const some = rows.filter((r) => r.active === active);
              if (some.length === 0) return null;
              return (
                <div key={String(active)} className="flex flex-col gap-1.5">
                  {!active ? <p className={deskDim}>{copy.offLabel}</p> : null}
                  <div className="flex flex-col [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)]">
                    {some.map((r, i) => (
                      <div
                        key={r.id}
                        className={`flex min-h-12 items-center gap-3 px-3 py-2 [font-size:var(--text-sm)] ${
                          i ? "border-t [border-color:var(--color-ink-800)]" : ""
                        }`}
                      >
                        <span
                          className={
                            active
                              ? "flex-1 [font-weight:var(--fw-medium)] text-[color:var(--color-paper)]"
                              : "flex-1 text-[color:var(--color-on-canvas-dim)]"
                          }
                        >
                          {r.name}
                        </span>
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
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label={copy.name}
            placeholder={copy.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${deskField} min-w-0 flex-1`}
          />
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => void add()}
            className={`${deskBtn("primary")} shrink-0`}
          >
            {busy ? copy.adding : copy.add}
          </button>
        </div>

        <p className={deskDim}>{copy.lede}</p>

        {error ? (
          <p
            role="alert"
            className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
          >
            {error}
          </p>
        ) : null}
      </div>
    </DeskCard>
  );
}

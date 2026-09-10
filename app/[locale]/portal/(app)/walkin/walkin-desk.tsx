"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Avatar } from "@/design-system/components/avatar";
import { DeskCard, deskBtn, deskDim } from "../desk-kit";

export type StaffRow = {
  id: string;
  name: string;
  last_walkin_at: string | null;
  walkin_available: boolean;
};

type Words = Record<string, string>;

/**
 * 一张卡，一条清单，一颗按钮 —— 柜台的那面白板。
 *
 * ── 排序照资料库那支同一条规则（`nulls first, name`）─────────────────────
 *
 * `walkin_queue_of` 本来就是这个答案（20260910360000），这里不再叫它一次去
 * 核对同一件事 —— 这一页读的是**整份**名单（含步出轮子的），排序在这个档案
 * 自己重算一遍，跟资料库那支用的是同一条比较：谁没接过排第一，
 * 其余按上一次接的时间，最久没接的排前面。
 *
 * ── 🔴 步出轮子的没有消失，落到清单最下面 ────────────────────────────────
 *
 * `walkin_queue_of` 只回「在轮子里」那几位——而柜台要把去吃饭回来的那位叫
 * 回轮子，得先在画面上看得到她。所以「暂时不算」那一段跟「轮子里」同一张
 * 卡，只是排在下面、字比较淡，一按「回来」就跳回上面那一段。
 */
export function WalkinDesk({
  staff,
  words,
}: {
  staff: StaffRow[];
  words: Words;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState("");

  async function call(name: string, args: Record<string, unknown>, tag: string) {
    setFailed("");
    setBusy(tag);
    const { error } = await createBrowserSupabaseClient().rpc(name, args);
    setBusy(null);
    if (error) {
      setFailed(words.failed);
      return;
    }
    router.refresh();
  }

  const inRotation = staff
    .filter((s) => s.walkin_available)
    .sort((a, b) => {
      if (a.last_walkin_at === null && b.last_walkin_at !== null) return -1;
      if (a.last_walkin_at !== null && b.last_walkin_at === null) return 1;
      if (a.last_walkin_at !== b.last_walkin_at)
        return (a.last_walkin_at ?? "").localeCompare(b.last_walkin_at ?? "");
      return a.name.localeCompare(b.name);
    });
  const steppedOut = staff
    .filter((s) => !s.walkin_available)
    .sort((a, b) => a.name.localeCompare(b.name));

  function lastTurnLabel(when: string | null) {
    if (!when) return words.never;
    const time = new Date(when).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${words.lastTurn} ${time}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <DeskCard title={words.queueLabel}>
        {staff.length === 0 ? (
          <p className={deskDim}>{words.noStaff}</p>
        ) : inRotation.length === 0 ? (
          <p className={deskDim}>{words.empty}</p>
        ) : (
          <ol className="flex flex-col">
            {inRotation.map((s, i) => (
              <li
                key={s.id}
                className={`flex flex-wrap items-center gap-3 border-t py-3 first:border-t-0 [border-color:var(--color-ink-800)] ${
                  i === 0
                    ? "[background-color:var(--color-primary-soft)] rounded-[var(--radius-md)] px-3 first:border-t-0"
                    : ""
                }`}
              >
                <span
                  className={`w-5 shrink-0 text-right [font-size:var(--text-sm)] ${
                    i === 0
                      ? "[font-weight:var(--fw-semibold)] [color:var(--color-paper)]"
                      : deskDim
                  }`}
                >
                  {i + 1}
                </span>
                <Avatar name={s.name} size={32} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] [color:var(--color-paper)]">
                    {s.name}
                  </span>
                  <span className={deskDim}>{lastTurnLabel(s.last_walkin_at)}</span>
                </div>
                {i === 0 && (
                  <span className="[font-size:var(--text-xs)] [font-weight:var(--fw-semibold)] uppercase tracking-[var(--tracking-label)] [color:var(--color-primary-deep)]">
                    {words.upNext}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  {i === 0 && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void call("take_walkin_turn", { in_staff_id: s.id }, `take-${s.id}`)}
                      className={deskBtn("primary")}
                    >
                      {busy === `take-${s.id}` ? words.taking : words.take}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void call(
                        "set_walkin_available",
                        { in_staff_id: s.id, in_available: false },
                        `out-${s.id}`,
                      )
                    }
                    className={deskBtn("quiet")}
                  >
                    {words.stepOut}
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        {steppedOut.length > 0 && (
          <div className="mt-4 flex flex-col gap-1 border-t pt-4 [border-color:var(--color-ink-800)]">
            <span className={deskDim}>{words.outLabel}</span>
            <ul className="flex flex-col">
              {steppedOut.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-3 border-t py-3 first:border-t-0 [border-color:var(--color-ink-800)] opacity-70"
                >
                  <Avatar name={s.name} size={32} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] [color:var(--color-paper)]">
                      {s.name}
                    </span>
                    <span className={deskDim}>{lastTurnLabel(s.last_walkin_at)}</span>
                  </div>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void call(
                        "set_walkin_available",
                        { in_staff_id: s.id, in_available: true },
                        `in-${s.id}`,
                      )
                    }
                    className={deskBtn("quiet")}
                  >
                    {words.backIn}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {failed && (
          <p
            role="alert"
            className="mt-3 [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
          >
            {failed}
          </p>
        )}
      </DeskCard>
    </div>
  );
}

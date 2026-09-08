"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DeskCard, deskBtn, deskDim, deskField } from "../desk-kit";

/**
 * 一个礼拜的形状，打一次。
 *
 * ── 🔴 为什么是「每个礼拜几」，不是「哪一天」──────────────────────────
 *
 * 一张要他每个礼拜重排一次的班表，**比他现在的做法更花时间**
 * （[重点 29](../../../../../docs/founder-points.md)：量他要打几个字）。
 * 一个发型师的班是**一个礼拜的形状**：二到日 10:00–19:00，星期一休 ——
 * 六行，打一次，永远有效。请假那种例外走本来就有的「挡起来的时段」，
 * **不是第二张表**（20260906430000 自己写着这一条）。
 *
 * ── 🔴 一个人一次全部换掉 ──────────────────────────────────────────────
 *
 * `set_staff_hours` 是**整批换**（先删再插）。所以这里送的一定是
 * 那个人**七天完整的那一份** —— 只送改动的那一行，等於把其余六天删掉。
 */

type Shift = { staffId: string; weekday: number; from: string; to: string };
type Person = { id: string; name: string };
type Words = Record<string, string>;

export function RotaDesk({
  staff,
  shifts,
  words,
}: {
  staff: Person[];
  shifts: Shift[];
  words: Words;
}) {
  const router = useRouter();
  const [who, setWho] = useState(staff[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<"" | "ok" | "no">("");

  /* 星期几照 Postgres 的算法：0 是星期日。而**画出来从星期一开始** ——
     这个市场的一週是这样算的，跟出勤那一页的月历同一个开头。 */
  const order = [1, 2, 3, 4, 5, 6, 0];
  const name = (d: number) =>
    [
      words.sun,
      words.mon,
      words.tue,
      words.wed,
      words.thu,
      words.fri,
      words.sat,
    ][d];

  const mineFrom = (d: number) =>
    shifts.find((s) => s.staffId === who && s.weekday === d)?.from ?? "";
  const mineTo = (d: number) =>
    shifts.find((s) => s.staffId === who && s.weekday === d)?.to ?? "";

  const [draft, setDraft] = useState<
    Record<string, { from: string; to: string }>
  >({});
  const key = (d: number) => `${who}:${d}`;
  const valFrom = (d: number) => draft[key(d)]?.from ?? mineFrom(d);
  const valTo = (d: number) => draft[key(d)]?.to ?? mineTo(d);
  const set = (d: number, half: "from" | "to", v: string) =>
    setDraft((x) => ({
      ...x,
      [key(d)]: { from: valFrom(d), to: valTo(d), [half]: v },
    }));

  const save = async () => {
    if (!who || busy) return;
    setBusy(true);
    setSaid("");
    /* 七天一次送完 —— 见档头。两头都填了才算一个班。 */
    const rows = order
      .map((d) => ({ weekday: d, starts_at: valFrom(d), ends_at: valTo(d) }))
      .filter((r) => r.starts_at && r.ends_at);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc("set_staff_hours", {
      in_staff_id: who,
      in_hours: rows,
    });
    setBusy(false);
    if (error) {
      setSaid("no");
      return;
    }
    setSaid("ok");
    setDraft({});
    router.refresh();
  };

  if (!staff.length) return null;

  return (
    <DeskCard
      title={words.rosterTitle}
      action={
        staff.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {staff.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setWho(s.id);
                  setSaid("");
                }}
                aria-pressed={s.id === who}
                className={
                  "inline-flex min-h-11 items-center [border-radius:999px] px-4 [font-size:var(--text-sm)] " +
                  (s.id === who
                    ? "[background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)]"
                    : "[border:var(--hairline)_solid_var(--color-ink-800)] [color:var(--color-paper)]")
                }
              >
                {s.name}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <p className={deskDim}>{words.rosterLede}</p>

        <ul className="flex flex-col" data-rota="roster">
          {order.map((d) => (
            <li
              key={d}
              className="flex flex-wrap items-center gap-3 border-t py-3 [border-color:var(--color-ink-800)]"
            >
              <span className="w-24 shrink-0 [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
                {name(d)}
              </span>
              {/* 🔴 两头绑在一起 —— 看图才看到：390 上第二个格子掉到下一行，
                  一行班读起来变成两行。 */}
              <span className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
                <span className="min-w-0 flex-1 sm:w-32 sm:flex-none">
                  {/* 🔴 本来是 `${name(d)} ${words.save}` —— 「星期一 存这一週」，
                      一个框的名字讲的是隔壁那颗按钮在做的事；而右边那一个**根本没有名字**。
                      2026-09-08 `audit:product` 报「没有名字的框 14」，
                      十四个全部在这一页（七天 × 两头）。 */}
                  <input
                    type="time"
                    aria-label={`${name(d)} ${words.from}`}
                    value={valFrom(d)}
                    onChange={(e) => set(d, "from", e.target.value)}
                    className={deskField}
                  />
                </span>
                <span className={deskDim}>–</span>
                <span className="min-w-0 flex-1 sm:w-32 sm:flex-none">
                  <input
                    type="time"
                    aria-label={`${name(d)} ${words.to}`}
                    value={valTo(d)}
                    onChange={(e) => set(d, "to", e.target.value)}
                    className={deskField}
                  />
                </span>
              </span>
              {(valFrom(d) || valTo(d)) && (
                <button
                  type="button"
                  onClick={() => {
                    set(d, "from", "");
                    setDraft((x) => ({ ...x, [key(d)]: { from: "", to: "" } }));
                  }}
                  className={deskBtn("danger")}
                >
                  {words.clear}
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className={deskBtn("primary")}
          >
            {words.save}
          </button>
          {said === "ok" && <span className={deskDim}>{words.saved}</span>}
          {said === "no" && (
            <span className="[color:var(--color-clay-bright)] [font-size:var(--text-sm)]">
              {words.saveFailed}
            </span>
          )}
        </div>

        <p className={deskDim}>{words.note}</p>
      </div>
    </DeskCard>
  );
}

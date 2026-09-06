"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DeskCard, deskBtn, deskDim, deskField } from "../desk-kit";

/**
 * 一片格子，一格一天。
 *
 * ── 🔴 点一格不会当场改掉那一天 ────────────────────────────────────────
 *
 * 最省事的做法是「点一下轮到下一种」（做了 → 半天 → 没来）。
 * **那一版在工地上是坏的**：一次误触会静静改掉一个会变成钱的数字，
 * 而他要到发薪那天才发现。
 *
 * 所以点一格是**挑那一天**，答案是底下那三颗按钮 ——
 * 按下去才写，而且写完那一格自己就变了。
 *
 * ── 🔴 明天点不下去 ────────────────────────────────────────────────────
 *
 * `log_work_day` 自己会拒绝还没发生的日子。而**一颗按下去一定失败的按钮
 * 是这个仓库禁的第一条** —— 所以未来那几格根本不是按钮。
 */

type Mark = { kind: string; hours: number | null };
type Words = Record<string, string>;

export function AttendanceDesk({
  staffId,
  staffName,
  monthName,
  prevHref,
  nextHref,
  today,
  cells,
  marks,
  words,
}: {
  staffId: string;
  staffName: string;
  monthName: string;
  prevHref: string;
  nextHref: string;
  today: string;
  /** 42 格里的每一天；`null` 是上个月/下个月那几格。 */
  cells: (string | null)[];
  marks: Record<string, Mark>;
  words: Words;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [hours, setHours] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  /* 按下去当场变色，不等伺服器 —— 一颗按了两秒没反应的按钮，
     在工地上就是被按第二次的那一颗。而**写不进去就把画面放回去**：
     一颗看起来成功而资料库里没变的按钮，比一颗报错的糟得多。 */
  const [guess, setGuess] = useState<Record<string, Mark | null>>({});

  const markOf = (d: string): Mark | null =>
    d in guess ? guess[d] : (marks[d] ?? null);

  const write = async (kind: "full" | "half" | "absent") => {
    if (!picked || busy) return;
    const was = markOf(picked);
    setBusy(true);
    setFailed(false);
    setGuess((g) => ({
      ...g,
      [picked]: { kind, hours: hours ? Number(hours) : null },
    }));
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc("log_work_day", {
      in_staff_id: staffId,
      in_on_date: picked,
      in_kind: kind,
      in_hours: hours ? Number(hours) : null,
    });
    setBusy(false);
    if (error) {
      setGuess((g) => ({ ...g, [picked]: was }));
      setFailed(true);
      return;
    }
    setPicked(null);
    setHours("");
    router.refresh();
  };

  const week = [
    words.mon,
    words.tue,
    words.wed,
    words.thu,
    words.fri,
    words.sat,
    words.sun,
  ];

  /* 三种答案三个样子。
     ⚠️ **不靠颜色一种讯号** —— 印出来跟灰阶上都要讲得出话，
     所以「做了」是实心、「半天」是半边、「没来」是一个空心圈。 */
  const face = (m: Mark | null) => {
    if (!m) return null;
    if (m.kind === "full")
      return (
        <span
          aria-hidden="true"
          className="mt-1 block h-3 w-3 rounded-full [background-color:var(--color-primary)]"
        />
      );
    if (m.kind === "half")
      return (
        <span
          aria-hidden="true"
          className="mt-1 block h-3 w-3 rounded-full [background:linear-gradient(90deg,var(--color-primary)_50%,transparent_50%)] [border:1px_solid_var(--color-primary)]"
        />
      );
    return (
      <span
        aria-hidden="true"
        className="mt-1 block h-3 w-3 rounded-full [border:1.5px_solid_var(--color-clay-bright)]"
      />
    );
  };

  const label = (m: Mark | null) =>
    !m
      ? ""
      : m.kind === "full"
        ? words.full
        : m.kind === "half"
          ? words.half
          : words.absent;

  return (
    <DeskCard
      title={staffName}
      action={
        /* 换月份 ← `up-productivity` 那一张月历的头。 */
        <div className="flex items-center gap-1">
          <a
            href={prevHref}
            aria-label={words.prev}
            className="inline-flex h-11 w-11 items-center justify-center [border-radius:var(--radius-control)] [color:var(--color-paper)] hover:[background-color:var(--color-ink-950)]"
          >
            ‹
          </a>
          <span className="min-w-32 text-center [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
            {monthName}
          </span>
          <a
            href={nextHref}
            aria-label={words.next}
            className="inline-flex h-11 w-11 items-center justify-center [border-radius:var(--radius-control)] [color:var(--color-paper)] hover:[background-color:var(--color-ink-950)]"
          >
            ›
          </a>
        </div>
      }
    >
      {/* 🔴 两栏 ← `up-productivity` 那一张月历本来就住在一条窄栏里。
          第一版把它摊满整张卡：一格 150 × 68，那不是月历的形状，
          而右边一大片白读起来是这一页没做完。
          现在月历定宽在左，挑到的那一天在右 —— 挑一天不再让版面跳。 */}
      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-col gap-4">
          <p className="tabular-nums [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
            {words.summary}
          </p>

          {/* 🔴 一张摊满 1100px 的月历读起来是一页空的 ——
            参考那一张是窄栏里的一小片，格子接近正方。
            看图才看到：不封宽度，一格是 150 × 68，那不是月历的形状。 */}
          <div data-attendance="grid" className="w-[min(100%,26rem)]">
            <div className={`mb-1 grid grid-cols-7 gap-1 ${deskDim}`}>
              {week.map((w, i) => (
                <div key={i} className="py-1 text-center">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <div key={`x${i}`} />;
                const future = d > today;
                const m = markOf(d);
                const on = d === picked;
                const n = Number(d.slice(8));
                const inner = (
                  <>
                    <span className="tabular-nums [font-size:var(--text-sm)]">
                      {n}
                    </span>
                    {face(m)}
                  </>
                );
                /* 🔴 明天不是按钮 —— 见档头。 */
                if (future)
                  return (
                    <div
                      key={d}
                      data-attendance="day"
                      className={`flex aspect-square flex-col items-center justify-center [border-radius:var(--radius-sm)] ${deskDim}`}
                      title={words.notYet}
                    >
                      {inner}
                    </div>
                  );
                return (
                  <button
                    key={d}
                    data-attendance="day"
                    type="button"
                    onClick={() => {
                      setPicked(on ? null : d);
                      setHours("");
                      setFailed(false);
                    }}
                    aria-pressed={on}
                    aria-label={`${n}${label(m) ? ` · ${label(m)}` : ""}`}
                    className={
                      "flex aspect-square flex-col items-center justify-center [border-radius:var(--radius-sm)] " +
                      (on
                        ? "[border:var(--hairline)_solid_var(--color-primary)] [background-color:var(--color-ink-950)]"
                        : "[border:var(--hairline)_solid_transparent] hover:[background-color:var(--color-ink-950)]")
                    }
                  >
                    {inner}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右边那一栏：挑了一天才出现那三颗 —— 见档头。 */}
        <div className="flex flex-col gap-4 lg:border-l lg:pl-6 [border-color:var(--color-ink-800)]">
          {picked ? (
            <div className="flex flex-col gap-3 border-t pt-5 [border-color:var(--color-ink-800)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
                  {picked}
                </span>
                <span className={deskDim}>{label(markOf(picked))}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => write("full")}
                  className={deskBtn("primary")}
                >
                  {words.full}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => write("half")}
                  className={deskBtn()}
                >
                  {words.half}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => write("absent")}
                  className={deskBtn("danger")}
                >
                  {words.absent}
                </button>
                {/* 按钟点的那几个才用得上。空着就是没有记时数 —— 不是 0。 */}
                <span className="inline-flex items-center gap-2">
                  <span className={deskDim}>{words.hours}</span>
                  <span className="inline-block w-24">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      inputMode="decimal"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      className={deskField}
                    />
                  </span>
                </span>
              </div>
              {failed && (
                <p className="[color:var(--color-clay-bright)] [font-size:var(--text-sm)]">
                  {words.saveFailed}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className={deskDim}>{words.pickDay}</p>
              {/* 🔴 一张只有符号的月历要有一份对照 ——
                  三个记号是形状不是颜色（印出来跟灰阶上都要讲得出话），
                  而没有人天生看得懂一个空心圈是「没来」。 */}
              <ul className="flex flex-col gap-2">
                {(
                  [
                    ["full", words.full],
                    ["half", words.half],
                    ["absent", words.absent],
                  ] as const
                ).map(([k, w]) => (
                  <li key={k} className={`flex items-center gap-2 ${deskDim}`}>
                    {face({ kind: k, hours: null })}
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className={deskDim}>{words.note}</p>
        </div>
      </div>
    </DeskCard>
  );
}

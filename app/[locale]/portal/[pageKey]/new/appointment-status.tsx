"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecordFormCopy } from "../record-copy";
import { FormSection } from "./form-section";

/**
 * 他来了没有。
 *
 * ── 为什么这一段存在 ──────────────────────────────────────────────────────
 *
 * `appointments.status` 从 20260902030000 就在，清单上也**印得出来**
 * （`live-rows` 那一层读它）—— 而 `set_appointment_status`
 * **画面上一个入口都没有**。
 *
 * 所以今天一个沙龙老板看得到「陈太太 · 已订」，而客人来了、或者没来，
 * 他改不了那三个字。**一个印得出来而改不了的状态，是一个从第二天起就在说谎的字。**
 *
 * ── 🔴 它一分钱都不碰 ────────────────────────────────────────────────────
 *
 * [任务 100] 已经定过这一条：**客人没来要不要扣钱是他的决定，不是我们的。**
 * 「没来」在这里只是一个事实；自己发明一条收费规矩，
 * 是我们替他写了一条没有人同意过的条款。
 *
 * ⚠️ 而这一件[任务 44](#44) 点过名：签沙龙那一单之前要问清楚的四件，
 *    第三件就是「no-show 怎么处理」。**这一段记下事实，好让他答得出那一题。**
 *
 * ── 「取消了」留着，不删 ──────────────────────────────────────────────────
 *
 * `live-rows` 的注解白纸黑字：「Cancelled rows stay：『陈太太取消了』
 * 是一间沙龙读它这一天需要的资讯，藏起来会让那个空档没有解释。」
 * 所以取消是一个**状态**，不是一次删除 —— 删除是旁边那颗「收起来」。
 *
 * ── 🔴 时段照旧占着 ──────────────────────────────────────────────────────
 *
 * 20260902030000 的档头写着：那条不准撞的排他约束**认得 status** ——
 * 一个取消掉的预约不再占着那个时段，而一个「没来」的**还占着**
 * （那一个钟头是真的过去了）。所以这几颗按钮会改变「那个时段空不空」，
 * 而那正是它们该做的事。
 */

/** 资料库那四个值，一个字都不能多（`in_status not in (...)` 会挡）。 */
const STATES = ["booked", "done", "no_show", "cancelled"] as const;
export type AppointmentState = (typeof STATES)[number];

export function AppointmentStatus({
  id,
  status,
  who,
  copy,
}: {
  id: string;
  /** 现在是哪一个。⚠️ 资料库预设 'booked'。 */
  status: string;
  /**
   * 这一张是谁的。
   *
   * 🔴 页面标题写的是「Edit · Bookings」——**十八页都一样**，
   * 而客人的名字在表单卡里，要滑过四个格子才看得到。
   * 他在柜台上按这四颗的时候，人就站在面前：
   * **按之前要看得到这是哪一张。**
   *
   * ⚠️ 空的就不画 —— 一个挡起来的休息时段本来就没有客人，
   * 而印一个占位的名字比不印糟（[任务 115] 那条：a placeholder
   * cannot be told from the real thing）。
   */
  who?: string | null;
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* 按下去当场变色，不等伺服器回来 —— 一颗按了三秒没反应的按钮，
     在柜台上就是被按第二次的那一颗。 */
  const [shown, setShown] = useState(status);

  const label: Record<AppointmentState, string> = {
    booked: copy.apptBooked,
    done: copy.apptCame,
    no_show: copy.apptNoShow,
    cancelled: copy.apptCancelled,
  };

  async function set(next: AppointmentState) {
    if (next === shown) return;
    setError(null);
    setBusy(next);
    const before = shown;
    setShown(next);
    const { error: err } = await createBrowserSupabaseClient().rpc(
      "set_appointment_status",
      {
        in_id: id,
        in_status: next,
      },
    );
    if (err) {
      /* 🔴 改不了就把画面**放回去**。一颗看起来成功而资料库里没变的按钮，
         比一颗报错的按钮糟得多 —— 他会以为记下来了。 */
      setShown(before);
      setError(`${copy.failed}${err.message ? ` — ${err.message}` : ""}`);
      setBusy(null);
      return;
    }
    setBusy(null);
    router.refresh();
  }

  return (
    <FormSection title={copy.apptHeading}>
      {/* ⚠️ 比那一行小标题大一档。两行同样大、同样粗，读起来是两个标题——
          `form-section.tsx` 自己的注解就写着那个毛病。小标题是**标签**，
          这一行是**这一张预约本人**，而他在柜台上读的是后者。 */}
      {who ? (
        <span className="[font-size:var(--text-base)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {who}
        </span>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {STATES.map((s) => {
          const on = shown === s;
          return (
            <button
              key={s}
              type="button"
              disabled={!!busy}
              aria-pressed={on}
              onClick={() => void set(s)}
              className={
                "inline-flex min-h-11 items-center [border-radius:var(--radius-md)] border px-3 [font-size:var(--text-sm)] disabled:opacity-40 " +
                (on
                  ? "[border-color:var(--color-primary)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]"
                  : "[border-color:var(--color-ink-800)] text-[color:var(--color-on-canvas-dim)] hover:[border-color:var(--color-primary)] hover:text-[color:var(--color-on-canvas)]")
              }
            >
              {label[s]}
            </button>
          );
        })}
      </div>

      {/* ⚠️ 「没来」是一个事实，不是一笔钱。要不要扣是他的决定（[任务 100]）。 */}
      <span className="[font-size:var(--text-xs)] text-[color:var(--color-on-canvas-dim)]">
        {copy.apptLede}
      </span>

      {error ? (
        <span className="[font-size:var(--text-sm)] text-[color:var(--color-clay-bright)]">
          {error}
        </span>
      ) : null}
    </FormSection>
  );
}

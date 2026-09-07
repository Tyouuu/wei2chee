"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecordFormCopy } from "../record-copy";

/**
 * 「这个月你已经签过帐了」—— 在他打完字之前就讲。
 *
 * ── 为什么它非有不可 ────────────────────────────────────────────────────
 *
 * 月结锁（20260905740000 · [任务 188](../../../../../docs/founder-tasks.md#188)）
 * 是**收紧**：一个已经对完帐的月份，钱进不去也出不来。那一条是对的 ——
 * 少了它，八月补一笔忘了记的六月单，六月那个已核对的总数就动了，
 * 而 `reconciled` 还写着 true。
 *
 * 🔴 **而那一条自己的收尾就写着这一格**：
 * 「**画面上没有讲** —— `is_period_locked` 是为了让画面**在他打字之前**
 * 就讲…今天他只会在按下去之后读到那句英文。」
 *
 * 他月底坐下来处理一叠上个月的收据（那正是 `entry_on` 那一格存在的理由），
 * 填完八个格子按保存，读到的是一句资料库的英文。**这一格把那句话
 * 搬到他动手之前。**
 *
 * ── 🔴 只有「确定锁着」才挡 ──────────────────────────────────────────────
 *
 * 读不到（断网 · 那一支出错）回的是 `null`，而 `null` **不挡** ——
 * 一个因为读不到而挡住他记帐的画面，比一句迟来的英文糟得多。
 * 资料库那一层照旧会拒绝（20260905740000 的守卫在那里，31 条断言），
 * 所以这一格是**第二道**，不是唯一那一道。
 *
 * ⚠️ 而它只画在**新增**那一边：改一笔钱走的是 `update_ledger_words`，
 * 那一支只改字（注解 · 类别 · 谁做的 · 收据），**动不到那个月的总数**，
 * 所以 20260905740000 规矩 ③ 明写它照样过。
 *
 * ── 方向要跟着这一页走 ──────────────────────────────────────────────────
 *
 * 锁的粒度是「月 × 方向」（规矩 ②：他签的是 Celcom 的「进来多少」，
 * 就只锁「进」）。收款是进，开销跟佣金是出 —— 而这一页哪一种，
 * `spendsMoney` 已经答得出来。
 */
export function PeriodLock({
  projectId,
  /** 他填的那个日子。空的 = 今天，而今天照定义锁不了（规矩 ①）。 */
  on,
  direction,
  copy,
  onLocked,
}: {
  projectId: string;
  on: string;
  direction: "in" | "out";
  copy: RecordFormCopy;
  onLocked: (locked: boolean) => void;
}) {
  const [locked, setLocked] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    /* 空的 = 今天。资料库那一支自己会用今天，而今天永远不是
       「已经过完的月份」—— 所以那一趟问了也是白问。 */
    if (!on) {
      setLocked(null);
      onLocked(false);
      return;
    }
    const supabase = createBrowserSupabaseClient();
    supabase
      .rpc("is_period_locked", {
        in_project_id: projectId,
        in_on: on,
        in_direction: direction,
      })
      .then(({ data, error }) => {
        if (!alive) return;
        /* 🔴 读不到就是 null，不是 false —— 见档头。 */
        const answer = error ? null : data === true;
        setLocked(answer);
        onLocked(answer === true);
      });
    return () => {
      alive = false;
    };
  }, [projectId, on, direction, onLocked]);

  if (locked !== true) return null;

  return (
    <p
      data-period-locked=""
      role="status"
      /* 🔴 跟这张表上每一句拒绝**同一个颜色同一个字重**（`errorAt` 那两处）。
         第一版写的是 `--color-negative`，而那个 token 这套风格里**不存在** ——
         於是它安静地继承了旁边那句提示的颜色，图上看起来是「多一句提示」，
         而它讲的是「这一笔存不进去」。一个不解析的 token 不报错、不留痕迹
         （这个仓库栽过好几次），只有把图放大跟旁边那一句比才看得出来。 */
      className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] leading-relaxed text-[color:var(--color-clay-bright)]"
    >
      {copy.periodLocked}
    </p>
  );
}

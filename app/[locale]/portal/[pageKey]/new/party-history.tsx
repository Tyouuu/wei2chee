"use client";

import type { RecordFormCopy } from "../record-copy";
import { ringgitOf } from "./line-editor";

/**
 * 这个客人来过几次，一共多少，上一次什么时候。
 *
 * ── 🔴 为什么这里没有积分，也没有等级 ────────────────────────────────────
 *
 * ERPNext 的 `Loyalty Program` 有十五栏：收点规则的子表、换算率、过期天数、
 * 费用科目、成本中心。那是一整套接进会计的积分方案。
 *
 * **而他还没有一套积分方案。** 替他发明一套等级（银卡/金卡/白金），
 * 是在他自己的系统里宣布一件他从来没有讲过的事 —— 跟示例资料看起来
 * 像真的一样，只是更糟：这一个会印在客人面前。
 *
 * 所以这里做的是**每一套忠诚方案底下那一层，而且它今天就是真的**：
 * 「这位来过 12 次，一共 RM 8,400，上一次 8 月 12 号。」
 * 一个沙龙老板站在柜台后面要的就是这三句 —— 而「你来第十次了，这次算便宜一点」
 * 是他讲的，不是我们替他讲的。
 *
 * ⚠️ 哪一天他真的定了一套方案，这一段就是它的地基（次数跟金额都在这里）。
 *
 * ── 钱那一半只给看得到钱的人 ──────────────────────────────────────────────
 *
 * 「来过几次」「上一次什么时候」不是钱，师傅看得到 —— 他要知道这位是熟客。
 * 「一共多少」是钱。所以 `spentCents` 是 null 的时候**那半句不画**，
 * 不是画一个 RM 0。
 */

export function PartyHistory({
  visits,
  lastOn,
  spentCents,
  copy,
}: {
  /** 来过几次。含收起来的 —— 一次做完收档的工作，还是来过一次。 */
  visits: number;
  /** 上一次是哪一天。null = 一次都没有。 */
  lastOn: string | null;
  /** 一共多少。⚠️ null = **没有问**（他看不到钱），不是零。 */
  spentCents: number | null;
  copy: RecordFormCopy;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
        {copy.historyHeading}
      </span>
      {visits === 0 ? (
        <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {copy.historyNone}
        </span>
      ) : (
        <span className="[font-size:var(--text-sm)] tabular-nums text-[color:var(--color-on-canvas)]">
          {copy.historyVisits.replace("{n}", String(visits))}
          {spentCents != null ? (
            <span className="text-[color:var(--color-on-canvas-dim)]">
              {" · "}
              {copy.historySpent} {ringgitOf(spentCents)}
            </span>
          ) : null}
          {lastOn ? (
            <span className="text-[color:var(--color-on-canvas-dim)]">
              {" · "}
              {copy.historyLast} {lastOn}
            </span>
          ) : null}
        </span>
      )}
    </div>
  );
}

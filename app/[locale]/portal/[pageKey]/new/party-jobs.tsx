"use client";

import type { RecordFormCopy } from "../record-copy";
import { ringgitOf } from "./line-editor";

/**
 * 这个客户的单子，跟他还欠多少。
 *
 * ── 为什么这一段是「客户详情页」真正的内容 ────────────────────────────────
 *
 * [任务 81] 写着「点进去看一个客户 —— 没有这一页」。而点进去之后，
 * 一个只有姓名跟电话的表单**不是**一个客户页 —— 那是一张名片。
 *
 * 老板打开一个客户，要问的是两句：**他有几单在跑，他还欠我多少。**
 * 两句的答案都已经在资料库里，只是从来没有人在这一页问过。
 *
 * ── 🔴 「他还欠」只画给看得到钱的人 ──────────────────────────────────────
 *
 * `ledger_allocations` 是 sees_money。一个师傅问它拿回来的是空的，
 * 而空的会画成「他还欠 RM 48,500」—— 一个已经付清的客户，对他撒谎。
 * 所以 `owing` 是 null 的时候**整行不画**，不是画一个 RM 0。
 *
 * ── 只读 ──────────────────────────────────────────────────────────────────
 *
 * 这里一颗按钮都没有，每一行是一个连结。改一张单在那张单自己的页上 ——
 * 一个客户页上的「改这一单」会变成第二个入口，而两个入口迟早会不一样。
 */

export type PartyJob = {
  id: string;
  href: string;
  docNo: string;
  title: string;
  stage: string;
  amount: string;
  /** 那一页自己的名字（报价单 · 工程），因为他的单子横跨好几页。 */
  page: string;
};

export function PartyJobs({
  jobs,
  owing,
  copy,
}: {
  jobs: readonly PartyJob[];
  /** 他还欠多少，sen。⚠️ null = **没有问**（师傅看不到钱），不是零。 */
  owing: number | null;
  copy: RecordFormCopy;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
          {copy.theirJobs}
        </span>
        {owing != null && owing > 0 ? (
          <span className="[font-size:var(--text-sm)] tabular-nums text-[color:var(--color-on-canvas-dim)]">
            {copy.theirOwing}{" "}
            <span className="[font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
              {ringgitOf(owing)}
            </span>
          </span>
        ) : null}
      </div>

      {jobs.length === 0 ? (
        <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {copy.noJobsYet}
        </p>
      ) : (
        <div className="flex flex-col [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)]">
          {jobs.map((j, i) => (
            <a
              key={j.id}
              href={j.href}
              /* 一整行都按得到 —— 工地上戴着手套的拇指按不准一个单号。
                 min-h 44px 是同一个理由。 */
              className={`flex min-h-11 items-center gap-3 px-3 py-2 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)] hover:[background-color:var(--color-ink-900)] ${
                i ? "border-t [border-color:var(--color-ink-800)]" : ""
              }`}
            >
              <span className="shrink-0 [font-size:var(--text-xs)] tabular-nums text-[color:var(--color-on-canvas-dim)]">
                {j.docNo}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {j.title || j.page}
                {j.stage ? (
                  <span className="text-[color:var(--color-on-canvas-dim)]"> · {j.stage}</span>
                ) : null}
              </span>
              <span className="shrink-0 tabular-nums">{j.amount}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

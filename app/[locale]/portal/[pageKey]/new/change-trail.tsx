"use client";

import type { RecordFormCopy } from "../record-copy";
import { FormSection } from "./form-section";
import type { ShownChange } from "@/lib/portal/change-log";

/**
 * 这一张单被改过什么。
 *
 * ── 它回答的那一句 ────────────────────────────────────────────────────────
 *
 * 老板打开一张报价单看到 RM 38,000，记得自己写的是 48,000。
 * 员工帐号落地之前，那一句只有一个答案（他自己）；落地之后有第二个，
 * 而**今天没有任何地方答得出来**。
 *
 * ── 🔴 只画给看得到钱的人 ────────────────────────────────────────────────
 *
 * 这本帐存在的理由是老板看得到员工做了什么。给员工读它既没有用、也不对，
 * 而资料库那一条 policy 已经是 `sees_money` —— 所以师傅拿回来的是空的，
 * 而**空的会画成「这张单从来没有人改过」**，那是一句假话。
 * 所以 `rows` 是 null 的时候**整段不画**，不是画一句「没有记录」。
 *
 * ── 只读，而且只有这么多 ──────────────────────────────────────────────────
 *
 * 没有「还原」那颗按钮：还原一个改动会变成第二次改动，而它要写进同一本帐 ——
 * 那时候这一页会开始讲一个绕圈的故事。他要改回去，就自己改回去，
 * 那一行照样会被记下来。
 */

export function ChangeTrail({
  rows,
  copy,
}: {
  /** null = **没有问**（他看不到这本帐），不是「没有改过」。 */
  rows: readonly ShownChange[] | null;
  copy: RecordFormCopy;
}) {
  if (!rows) return null;

  return (
    <FormSection title={copy.changes}>
      {rows.length === 0 ? (
        <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {copy.changesNone}
        </p>
      ) : (
        <div className="flex flex-col [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)]">
          {rows.map((r, i) => (
            <div
              key={r.id}
              className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 px-3 py-2 [font-size:var(--text-sm)] ${
                i ? "border-t [border-color:var(--color-ink-800)]" : ""
              }`}
            >
              <span className="shrink-0 [font-size:var(--text-xs)] tabular-nums text-[color:var(--color-on-canvas-dim)]">
                {r.when}
              </span>
              <span className="text-[color:var(--color-on-canvas)]">
                {r.what}
              </span>
              {r.isDelete ? null : (
                <>
                  <span className="text-[color:var(--color-on-canvas-dim)] line-through">
                    {r.was}
                  </span>
                  <span className="text-[color:var(--color-on-canvas-dim)]">
                    →
                  </span>
                  <span className="[font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
                    {r.nowIs}
                  </span>
                </>
              )}
              {/* 谁。查不到名字就什么都不印 —— 一串 uuid 对他没有意义。 */}
              {r.who ? (
                <span className="ml-auto [font-size:var(--text-xs)] text-[color:var(--color-on-canvas-dim)]">
                  {r.who}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </FormSection>
  );
}

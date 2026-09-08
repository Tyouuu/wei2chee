"use client";

/* 打开一个客户，默认是**读**，不是一张摊开的表单。
 *
 * ── 为什么 ─────────────────────────────────────────────────────────────
 *
 * 他 2026-09-09 讲「太长了吧」，我改了三件（用掉宽度 · 缩两句说明 ·
 * 拿掉一句重复），他看完讲 **「我怎么覺得沒差」** —— 而他是对的：
 * 那三件里两件是小的，第三件只是把东西挪到右边，左边空掉一大片。
 *
 * 参考那一页（EspoCRM 真的客户记录页，`.screenshots/pagerefs/crm/`）
 * 短的真正原因是**它默认是读**：名字旁边一颗 Edit，底下一张
 * 两栏并排的 Overview 卡，一格一行字。
 *
 * 🔴 而它是量得出来的：一个输入框连标签 ~70px，一行字 ~24px。
 * 名册那一页顶上四个框 —— 三个是空的 —— 就占掉快三百像素，
 * 而它们讲的是「这里没有东西」。
 *
 * ── 三个判断 ───────────────────────────────────────────────────────────
 *
 * 🔴 **空的那几格照样列出来，写一个「—」。** 参考那一页也是
 * （`Birthday: None` · `Description: None`）—— 而理由不是整齐：
 * 一格看不到的栏位，等於他永远不知道那里可以填东西。
 * 一行字 24px，一个空的输入框 70px，两个都在，而一个便宜三倍。
 *
 * 🔴 **那几栏从 `columns` 来 —— 他自己加的栏自己会出现。**
 * 在这里手抄一份名单，就是这个仓库栽过八次的那件事。
 *
 * ⚠️ **按 Edit 之后，底下那一整套一个字都没变** —— 地址编辑器、
 * 「其余栏位」、改动那一本帐、收起来那一颗，全部原样在表单里。
 * 这一层只决定「先看到哪一个」，不拿走任何东西。
 */
import { useState, type ReactNode } from "react";

export type ReadField = { key: string; label: string; value: string };

export function ReadFirst({
  enabled,
  heading,
  fields,
  editLabel,
  children,
}: {
  /* 只有名册那几页。一张报价单他打开就是要改它 —— 在那里多一颗 Edit
     是多一次点击（[重点 29]）。 */
  enabled: boolean;
  /* 🔴 **那个人的名字**，不是「改这一个 · 客户」。
     参考那一页顶上是 `Contacts › Frederick Devine` —— 他点进来是要看**她**，
     而页面自己叫什么，面包屑上已经写着了。
     ⚠️ 按 Edit 之后标题换回表单自己那一句（那时候它讲的是「怎么存」）。 */
  heading: string;
  fields: ReadField[];
  editLabel: string;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  if (!enabled || editing) return <>{children}</>;

  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <h1 className="[font-size:var(--text-hero)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {heading}
        </h1>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-11 shrink-0 [border-radius:var(--radius-md)] border px-4 [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [border-color:var(--color-ink-800)] text-[color:var(--color-on-canvas)]"
        >
          {editLabel}
        </button>
      </div>

      <div className="mt-5 [border-radius:var(--radius-lg)] border p-6 [border-color:var(--color-ink-800)]">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className="min-w-0">
              <dt className="[font-size:var(--text-xs)] tracking-[var(--tracking-sm)] text-[color:var(--color-on-canvas-dim)]">
                {f.label}
              </dt>
              <dd className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas)]">
                {/* 🔴 空的写一个破折号，不是留白 —— 留白读起来像那一格
                  还没画出来，而破折号是一句话：这里是空的。 */}
                {f.value.trim() || (
                  <span className="text-[color:var(--color-on-canvas-dim)]">—</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

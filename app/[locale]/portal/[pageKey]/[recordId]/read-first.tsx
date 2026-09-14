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
 *
 * ── 🔴 `afterHeading`：不是每天都在改的，跟每天都要按的，是两件事（2026-09-12）──
 *
 * 预约那一页老板一句话点破的：**「展示的页面跟要填写资料的页面」**要分开——
 * 而「她来了没有」那一颗分段按钮，不是「填写资料」，是他站柜台一天要按
 * 好几次的动作。放进 Edit 后面的表单里，等於逼他先点一次 Edit 才按得到
 * 当天最常按的那一颗。所以它是一个独立的插槽，读的时候就在、
 * 改的时候也在（同一个节点，两边共用，不是两份）。
 *
 * ⚠️ 而它一开始**浮在那个边框外面**——他看了截图讲「还能更好」，量出来是
 * 这一件：`afterHeading`（`FormSection`，自己带一条 `border-t`）跟底下
 * 那个字段格子是两个各自有自己边界的东西，读起来是两种做法拼起来的。
 * 2026-09-04 那条「一定要统一设计」讲的就是这个——**一张卡，段跟段之间
 * 用内部的分隔线，不是两张卡叠起来**。现在两个都收进同一个框，
 * 而框内**第一段**的那条 `border-t` 拿掉（`[&>*:first-child]`同一招，
 * 这个档案自己在别处已经用过一次，见 `[recordId]/page.tsx`）——
 * 上面什么都没有的地方不需要再画一条线。
 *
 * ── 🔴 头像（老板要求的设计总检，2026-09-12）─────────────────────────────
 *
 * 他截图指出「每一页都是一个样式」，而真的去看 Boulevard／Mangomint 那几家
 * 的客户档案页（`.screenshots/featurepages/boulevard-1.png` ·
 * `mangomint5-1.png`）才发现：这两家的做法一模一样——名字旁边永远是一颗
 * 头像。**我们自己的名册清单那一行早就在用**（`design-system/components/
 * avatar.tsx`，[任务 342]：圆形、淡色底、深色字，十个色轮流分给不同名字）。
 * 清单那一行有头像，点进去那一页却没有——同一个人换了一个样子，
 * 这正是「看起来不像同一套」的一个真的原因，不是感觉。
 * ⚠️ 只在这一颗代表**一个人**的时候画（客户 · 师傅 · 供应商 · 预约，
 * 因为预约的抬头是客人的名字）——一件货的名字放一个头像没有意义，
 * 那是 `showAvatar` 交给呼叫端判断的原因。
 *
 * ── `extraActions`：Edit 不该是唯一一颗按钮（老板拿参考稿指出来，2026-09-14）──
 *
 * 参考稿的抬头右边是三颗按钮（WhatsApp · Edit · Book Appointment），
 * 我们只有一颗。跟 `headingBadges` 同一条分工：内容跟要不要显示是呼叫端的事
 * （WhatsApp 号码认不认得出来、这门生意有没有预约那一页），这里只给一个插槽，
 * 画在 Edit 左边——跟参考稿同一个顺序，Edit 一直贴着最右边。
 */
import { useState, type ReactNode } from "react";
import { Avatar } from "@/design-system/components/avatar";

export type ReadField = { key: string; label: string; value: string };

export function ReadFirst({
  enabled,
  heading,
  showAvatar,
  headingBadges,
  extraActions,
  primaryAction,
  fields,
  editLabel,
  afterHeading,
  children,
}: {
  /* 名册那几页 ＋ 预约那一页。一张报价单他打开就是要改它 —— 在那里多一颗
     Edit 是多一次点击（[重点 29]）。 */
  enabled: boolean;
  /* 🔴 **那个人的名字**，不是「改这一个 · 客户」。
     参考那一页顶上是 `Contacts › Frederick Devine` —— 他点进来是要看**她**，
     而页面自己叫什么，面包屑上已经写着了。
     ⚠️ 按 Edit 之后标题换回表单自己那一句（那时候它讲的是「怎么存」）。 */
  heading: string;
  /* 这一颗抬头讲的是**一个人**（客户 · 师傅 · 供应商 · 预约上的客人）——
     只有这几种给头像，一件货的名字放一个头像没有意义。 */
  showAvatar?: boolean;
  /* 名字旁边那排药丸——「19 visits」「Regular Client」那种。
     不是 ReadFirst 自己发明的：内容跟要不要显示是呼叫端的事
     （每种记录形状的「身份」不一样），这里只给一个插槽。 */
  headingBadges?: ReactNode;
  /* 抬头右边、Edit 左边的额外按钮——WhatsApp 那一类**次要**的真动作。
     内容跟要不要画是呼叫端的事，见上面档头。 */
  extraActions?: ReactNode;
  /* Edit **右边**——参考稿那颗实心的「Book Appointment」，这一页最想要
     他按的那一颗，所以排在最后（视觉终点）。跟 `extraActions` 分两个
     插槽，不是同一个数组，是为了让顺序固定成参考稿那一排
     （WhatsApp · Edit · Book Appointment），不用呼叫端自己排。 */
  primaryAction?: ReactNode;
  fields: ReadField[];
  editLabel: string;
  /* 天天要按的那个动作——不属於「填写资料」，读的时候也要看得到。 */
  afterHeading?: ReactNode;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  if (!enabled || editing) return <>{children}</>;

  return (
    <section>
      {/* 🔴 `flex-wrap` 在**外层**——两颗新按钮加进来才撞到的：`extraActions`
        那一排原本 `shrink-0`，一个左边窄栏（560px）塞不下「头像 + 名字 +
        药丸」跟三颗按钮的时候，浏览器把压缩全部让给了名字那一侧，
        「Mrs Chan」被挤断成两行。外层允许换行之后，装不下就让整排按钮
        掉到名字下面一行，名字自己永远保持它本来的宽度——不去挤它。 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {showAvatar && heading.trim() ? (
            <Avatar name={heading} size={64} fontSize="var(--text-title)" />
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="[font-size:var(--text-hero)] [font-weight:var(--fw-semibold)] whitespace-nowrap text-[color:var(--color-on-canvas)]">
              {heading}
            </h1>
            {headingBadges}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {extraActions}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-11 shrink-0 [border-radius:var(--radius-md)] border px-4 [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [border-color:var(--color-ink-800)] text-[color:var(--color-on-canvas)]"
          >
            {editLabel}
          </button>
          {primaryAction}
        </div>
      </div>

      <div className="ds-card mt-5 flex flex-col gap-5 p-6 [&>*:first-child]:mt-0 [&>*:first-child]:border-t-0 [&>*:first-child]:pt-0">
        {afterHeading}

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

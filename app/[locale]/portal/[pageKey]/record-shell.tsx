import { SystemShell } from "@/design-system/components/system-shell";
import { RailNav } from "@/design-system/components/rail-nav";
import { VARIANTS } from "@/design-system/editor/variants";
import { preferredVariants } from "@/lib/portal/design-doc";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { SystemLangProvider } from "@/design-system/system-lang-context";
import type { RecordPageContext } from "./record-context";

/**
 * 「加一单 · 改这一单 · 搬旧资料」三页的外壳。
 *
 * ── 为什么它存在 ──────────────────────────────────────────────────────────
 *
 * 老板 2026-09-04：
 *   `你一定要改得全部页面看起来就是一套我们的产品 不要这个又是另外的设计`
 *   `不要设计看起来是好像两个人做得一样 一定要统一设计`
 *
 * 而他讲的那件事在这三页上是量得出来的：**系统每一页都有侧栏跟顶栏，
 * 只有这三页没有。** 客户是从系统里点「加一单」进来的 —— 一进去导航整条
 * 不见了，唯一的出路是一颗「取消」。那不是「简洁」，那是掉出系统外面。
 *
 * 参考页（arhamkhnz 的 `dashboard/invoice`，老板挑的那一套）也是这样：
 * Create New Invoice **长在同一个外壳里**，侧栏顶栏一件不少。
 *
 * ── 三个「读，不要抄」 ────────────────────────────────────────────────────
 *
 *   侧栏那几行  ← `railNavNode()`，产生器自己那一支。手写一份导航清单，
 *                会在客户加一页的那天变成假的
 *   面包屑      ← `navGroup()` + `pageLabel()`，跟系统每一页同一个来源
 *   外壳的样子  ← 系统那一套风格自己挑的那个变体（今天是 `side-light-bar`：
 *                白底侧栏 + 一条 48px 的横梁）。**不写死** —— 换了偏好这里跟着换
 *
 * ⚠️ 这三页不是 Puck 画的，是普通的 React，所以它拿的是那个节点的 `props`，
 * 而不是那个节点本身。
 */

type RailProps = {
  brandLabel?: string;
  brandHref?: string;
  items?: { label: string; href: string; group: string; iconName?: string }[];
  utilityItems?: {
    label: string;
    href?: string;
    iconName?: string;
    showUnreadDot?: boolean;
  }[];
  userName?: string;
  userRoleLabel?: string;
  /** 侧栏顶上那颗主要动作。这三页**故意不给** —— 见下面。 */
  actionLabel?: string;
  actionHref?: string;
  variant?: string;
};

const shellProps = (() => {
  const want = preferredVariants(SYSTEM_REGISTER).SystemShell;
  const found = VARIANTS.SystemShell?.find((v) => v.id === want)?.props ?? {};
  return found as {
    nav?: "side" | "top" | "split";
    navTone?: "dark" | "light" | "deep";
    bar?: "inline" | "bleed";
  };
})();

export function RecordShell({
  ctx,
  children,
}: {
  ctx: RecordPageContext;
  children: React.ReactNode;
}) {
  const rail = ctx.rail as RailProps;
  return (
    /* 🔴 侧栏说哪一种话 —— 这一层本来没有，而 `check:reachable` 修完之后
       `check:en` 当场抓到：一个英文系统的侧栏底下写着「营运系统」。
       那个字本来就有英文版（system-words.ts 的 "Operations"），
       只是没有人告诉这一页系统讲哪一种话，所以它退回预设的中文。
       ⚠️ 这个洞**不是这一轮造成的** —— 每一个模块页的侧栏都读同一个字，
       只是那几页 `check:en` 没有走过。这一轮把它照出来了。 */
    <SystemLangProvider lang={ctx.lang}>
      <SystemShell
        nav={shellProps.nav ?? "side"}
        navTone={shellProps.navTone ?? "dark"}
        bar={shellProps.bar ?? "inline"}
        crumbs={ctx.crumbs}
        crumbMonogram={(ctx.businessName ?? "").slice(0, 2) || undefined}
        sidebar={
          /* 🔴 **手机上不画侧栏，而这是量出来才加的。**
           `npm run check:reachable` 在 390 报「4 个控件点不到」：
           侧栏在窄屏会摊成一条横的，而那一条**在编辑器外面从来没有被画过**
           （手机上的模块页走的是 `mobile-editor`，它根本不画侧栏）。
           实拍出来是：分组标签被切成「DAY TO」，通知/帐号那一叠竖着压在右上角，
           而四个页面连结被推到 x=276 以后，看不见也点不到。

           所以窄屏这里不画它 —— 这跟系统其他每一页在手机上的样子是一致的，
           而「一致」正是这一轮在做的事。回去的路还在：顶栏那条面包屑跟「取消」。
           ⚠️ 真正该修的是那条横的侧栏本身，记在任务档里，不在这一轮动它。 */
          <div className="hidden @3xl:contents">
            <RailNav
              variant={rail.variant as never}
              brand={{
                href: rail.brandHref ?? "#",
                label: rail.brandLabel ?? "",
              }}
              items={rail.items ?? []}
              utilityItems={rail.utilityItems}
              user={{
                name: rail.userName ?? "",
                roleLabel: rail.userRoleLabel,
              }}
              /* ⚠️ **侧栏那颗「加一单」在这三页上不给。**
             他已经站在加一单那一页上了；一颗把他送回他现在这一页的主要动作，
             不是导航，是一颗按了什么都不会发生的按钮 —— 而那是这个仓库
             明令禁止的那一类。 */
            />
          </div>
        }
        aside={null}
        main={children}
      />
    </SystemLangProvider>
  );
}

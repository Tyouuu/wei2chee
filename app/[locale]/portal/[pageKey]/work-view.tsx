"use client";

import { Render, type Data } from "@puckeditor/core";
import { registerAwarePuckConfig as puckConfig } from "@/design-system/editor/puck-config-client";
import { StyleScope } from "@/design-system/editor/style-scope";
import { cornerApply, cornerCapture } from "@/design-system/editor/corners";
import { SystemLangProvider } from "@/design-system/system-lang-context";
import type { SystemLang } from "@/lib/system-lang";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { deskSurface } from "@/lib/portal/system-register";

/**
 * 师傅看到的那一页 — the same page, without the editor around it.
 *
 * ── WHY A SUPERVISOR MUST NOT GET THE EDITOR ─────────────────────────────
 *
 * `/portal/<pageKey>` is Puck. Handing it to a staff member would offer him
 * every control the owner has -- drag a block, change a variant, publish the
 * public site -- and then refuse each one at the server, because
 * `save_project_page` asks for `account_id = auth.uid()` and always will.
 * Autosave fires 2.5 seconds after any change, so his first accidental click
 * would produce an error about a page he never meant to edit.
 *
 * A control that looks available and is not is the defect this repository has
 * shipped more often than any other. The honest answer is not to draw it.
 *
 * ── WHAT HE GETS INSTEAD, AND WHY IT IS NOT LESS ─────────────────────────
 *
 * The page itself, at full size, in the business's own style and language,
 * with its real rows -- the projection already ran on the server. Every row's
 * first cell is still a link to 改这一单, and 加一单 still sits in the table's
 * own header, because those are separate routes that check permission for
 * themselves and that he is allowed to use. Adding a job from the site is the
 * entire reason the role exists.
 *
 * ⚠️ THIS IS PRESENTATION, NOT ENFORCEMENT. Nothing here decides anything: the
 * money pages were already refused by the route, the rows he can read were
 * already decided by RLS, and a page he tried to save could not be saved
 * because `project_pages` has no write policy at all. Deleting this file would
 * make the product rude, not insecure -- which is the right way round.
 */
export function WorkView({
  data,
  pageKey,
  style,
  palette,
  corners,
  systemLang,
  fill,
}: {
  data: Data;
  /** 哪一页 —— 只用来问 `deskSurface()`。官网那一页穿客户自己的主色，
   *  其余每一页是工作台。见 lib/portal/system-register.ts。 */
  pageKey: string;
  style: StyleName;
  palette: string | null;
  /** The owner's radius setting is a MULTIPLIER of the register's own ladder,
   *  not a radius -- so his system looks to a supervisor exactly the way it
   *  looks to him. A page that renders differently for two people in one
   *  business is two systems. Two elements, because a variable may not read
   *  itself: see design-system/editor/corners.tsx. */
  corners: number;
  systemLang: SystemLang;
  /** 装在一个已经有高度的盒子里（手机上那一格），不是自己占一整屏。
   *
   *  🔴 **它修的不是好看，是一张被压扁的表。** 2026-09-04 在 390px 量到：
   *  底下那两段 `min-h-screen` 把内容那一栏撑到 844，而 `columns.tsx`
   *  的 `[&>*>*>*]:h-full` 会把多出来的高度**平均分给里面每一段** ——
   *  於是筛选、搜索、表格、页尾各拿 173px：**七行客户被塞进一个 174px
   *  的窗口里，自己另外滚**，中间三条加起来 321px 的空白。
   *  外面那一层已经有确定的高度（手机那一格是 `flex-1 overflow-y-auto`），
   *  所以这里只要不再要求一整屏，那一栏就回到内容的高度，表也就摊开了。
   *
   *  ⚠️ 底色留在外面那一层（`min-h-full`），不然内容短的时候底下会露出
   *  壳自己的颜色。 */
  fill?: boolean;
}) {
  return (
    <StyleScope
      /* 工作台自己的主要动作颜色。见 lib/portal/system-register.ts。 */
      data-surface={deskSurface(pageKey)}
      register={style}
      palette={palette}
      style={cornerCapture}
      className={`ds-ground [background-color:var(--color-canvas)] ${fill ? "min-h-full" : "min-h-screen"}`}
    >
      <SystemLangProvider lang={systemLang}>
        {/* ⚠️ A FLEX COLUMN, NOT `[&>*]:min-h-screen`. That was the first
            version and the screenshot showed what it does: the page ended at
            520px with bare canvas under it, dark rail included. `min-height`
            is not a definite height, so `SystemShell`'s own `h-full` resolved
            against nothing and collapsed -- the same failure page-preview.tsx
            documents, arrived at from the other side. `flex-1` in a column
            with a real minimum gives the child a height to be full OF.

            ⚠️ AND THAT WAS STILL NOT ENOUGH -- the second screenshot was
            identical to the first. Measured in the browser rather than guessed
            again: the flex child was 900px, and `SystemShell` under it asks for
            `min-height: 100%`, which resolves against the PARENT'S `height`
            property. That property is `auto`; 900 was a used size, not a
            declared one, so the percentage had nothing to resolve against and
            the shell fell back to its content -- 521px, rail included.

            So the shell is given a viewport minimum directly. `vh` needs
            nothing above it to be definite, which is the whole reason it works
            where two percentage chains did not.

            Both wrong answers are written down because both looked right in
            code and only the picture told them apart. */}
        <div
          className={
            fill
              ? "flex flex-col [&>*]:flex-1"
              : "flex min-h-screen flex-col [&>*]:flex-1 [&>*>*]:min-h-screen"
          }
          style={cornerApply(corners)}
        >
          <Render config={puckConfig} data={data} />
        </div>
      </SystemLangProvider>
    </StyleScope>
  );
}

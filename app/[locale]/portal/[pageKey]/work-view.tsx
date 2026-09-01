"use client";

import { Render, type Data } from "@puckeditor/core";
import { registerAwarePuckConfig as puckConfig } from "@/design-system/editor/puck-config-client";
import { StyleScope } from "@/design-system/editor/style-scope";
import { cornerApply, cornerCapture } from "@/design-system/editor/corners";
import { SystemLangProvider } from "@/design-system/system-lang-context";
import type { SystemLang } from "@/lib/system-lang";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

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
  style,
  palette,
  corners,
  systemLang,
}: {
  data: Data;
  style: StyleName;
  palette: string | null;
  /** The owner's radius setting is a MULTIPLIER of the register's own ladder,
   *  not a radius -- so his system looks to a supervisor exactly the way it
   *  looks to him. A page that renders differently for two people in one
   *  business is two systems. Two elements, because a variable may not read
   *  itself: see design-system/editor/corners.tsx. */
  corners: number;
  systemLang: SystemLang;
}) {
  return (
    <StyleScope
      register={style}
      palette={palette}
      style={cornerCapture}
      className="ds-ground min-h-screen [background-color:var(--color-canvas)]"
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
          className="flex min-h-screen flex-col [&>*]:flex-1 [&>*>*]:min-h-screen"
          style={cornerApply(corners)}
        >
          <Render config={puckConfig} data={data} />
        </div>
      </SystemLangProvider>
    </StyleScope>
  );
}

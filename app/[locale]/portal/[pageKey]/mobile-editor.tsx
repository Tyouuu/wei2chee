"use client";

import { Render, usePuck, type Data } from "@puckeditor/core";
import { useTranslations } from "next-intl";
// Renders through the register-aware config, so a block nobody has
// touched takes the shape THIS register prefers. See
// design-system/editor/puck-config-client.tsx.
import { registerAwarePuckConfig as puckConfig } from "@/design-system/editor/puck-config-client";

import { StyleScope } from "@/design-system/editor/style-scope";
import { AiAssistant, type Turn } from "./ai-assistant";
import chrome from "../chrome.module.css";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

/**
 * THE EDITOR ON A PHONE.
 *
 * Measured on 2026-08-21: editor-client.tsx and editor-chrome.tsx contained
 * ZERO responsive classes between them. Below about 1000px Puck's three
 * columns — palette, canvas, fields — do not fold; they compress, and a
 * five-column record table inside a 140px canvas is not a degraded experience,
 * it is a broken screen. For a product sold to Malaysian SME owners, most of
 * whom will open the link on the phone it was sent to, that is the difference
 * between a trial and a bounce.
 *
 * WHAT THIS IS NOT: a phone-sized drag-and-drop editor. Dragging a block into a
 * column with a thumb, on a canvas that has to be scaled to fit, is a worse
 * version of a thing that is already hard on a laptop, and pretending otherwise
 * would ship a screen nobody can use for its stated purpose.
 *
 * WHAT IT IS: the two things that DO work on a phone, given the whole surface.
 *
 *   1. Their system, rendered full width, scrolling. Not a thumbnail — the
 *      actual page, in their own register, on the same white mount it wears
 *      everywhere else. Most of what somebody does on a phone is look.
 *   2. The assistant, at half the screen. 「把客户改成屋主」 is a sentence, and
 *      a sentence is the one editing gesture a phone is genuinely better at
 *      than a mouse. The product's central claim is that you change your system
 *      by saying what you want; on a phone that stops being a convenience and
 *      becomes the entire interface.
 *
 * So the phone gets the AI editor and the desktop gets both. That is an honest
 * split rather than a fallback, and it is why this renders inside Puck's own
 * provider (through the `puck` override) rather than beside it: the assistant
 * reads and dispatches the same live canvas state either way, so an edit made
 * on a phone is the same edit, on the same undo stack.
 */
export function MobileEditor({
  pageKey,
  style,
  palette,
  locale,
  navPages,
  isGeneratedDraft,
}: {
  style: StyleName;
  palette: string | null;
  locale: string;
  navPages: { key: string; label: string }[];
  /** Straight through to the assistant, which sends it to the route: a table
   *  row on a pipeline module is a business record, not a layout row. */
  pageKey: string;
  /** Passed straight through to the assistant: 排法 only applies to a page that
   *  has never been saved, and the route has to be told which this is. */
  isGeneratedDraft: boolean;
}) {
  const t = useTranslations("portal.editor");
  // The live canvas, not a copy threaded down: this component renders inside
  // the provider, so an edit the assistant makes appears in the preview above
  // it on the same frame.
  const { appState } = usePuck();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="shrink-0 border-b px-4 py-2 [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
        {t("mobileHint")}
      </p>

      {/* Their page, full width and scrolling. `pointer-events-none` because
          this is a picture of a page: every link and control inside it belongs
          to a system that does not exist yet, and a tap that appears to do
          something and does not is worse than one that visibly cannot. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className={chrome.mount}>
          {/* THE SCROLLER IS A GRANDCHILD OF .mount, NOT ITS CHILD, and that
              nesting is the whole point of this div.

              chrome.module.css declares `.mount > * { overflow: hidden }` so the
              customer's system is clipped to the plinth's inner radius. That
              selector and Tailwind's `.overflow-x-auto` have the SAME
              specificity (0,1,0), so the one that wins is decided by source
              order -- and the CSS module lands after the utilities. The
              swipeable container below therefore computed to `overflow-x:
              hidden` and the swipe silently did nothing.

              Measured on a 390px iPhone viewport before this fix: scrollWidth
              900, clientWidth 354, and a drag moved scrollLeft by 0. A customer
              on a phone could see the left third of their own system and had no
              way to reach the rest of it -- while the comment directly below
              promised the opposite. Setting scrollLeft from script still
              worked, which is why nothing about it looked broken in code.

              Keeping the clip on this outer div preserves the rounded corners
              the mount exists for; the scroll moves one level in, where nothing
              overrides it. */}
          <StyleScope register={style} palette={palette} className="ds-ground [background-color:var(--color-canvas)]">
            <div className="h-full overflow-x-auto">
              {/* COMPOSED AT A DESKTOP WIDTH AND SWIPED, not reflowed and not
                  scaled. Reflowing puts a five-column table and a 180px rail
                  into 366px, which is not what their system looks like — the
                  first thing they would see is a version of their own page that
                  will never exist. Scaling it to fit makes it honest and
                  unreadable. Swiping keeps both the proportions and the type
                  size, which is how every phone preview of a desktop layout
                  works. */}
              <div className="pointer-events-none w-[900px]">
                <Render config={puckConfig} data={appState.data as Data} />
              </div>
            </div>
          </StyleScope>
        </div>
      </div>

      {/* Half the phone screen, and pinned: on a phone the assistant is not a
          panel beside the work — it IS the work, so it gets a fixed share
          rather than whatever is left over.

          A TABLET IS NOT A TALL PHONE, and this is where that stopped being
          true. Puck's own floor is 1024px, so everything from 768 to 1023 --
          every iPad in portrait, every Android tablet -- lands in this layout.
          Screenshotted at 768: the customer's page got the top 45% and the
          assistant got 55% of a 1024px-tall screen, most of it empty space
          under three example chips. Half a tablet, spent on nothing.

          So the share is now a range rather than a number. On a phone it stays
          at 52%; from 640px up the assistant takes a third and the page takes
          the rest, which on a 768x1024 screen is about 640px of the customer's
          own system instead of 440. The composer stays pinned to the bottom in
          both, because that is where every assistant a customer has used puts
          it. */}
      <div className="flex h-[52%] shrink-0 flex-col border-t [border-color:var(--color-ink-800)] sm:h-[38%] md:h-[32%]">
        <AiAssistant pageKey={pageKey} 
          pages={navPages}
          locale={locale}
          activeStyle={style}
          isGeneratedDraft={isGeneratedDraft}
          compact
        />
      </div>
    </div>
  );
}

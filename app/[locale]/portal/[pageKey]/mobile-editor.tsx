"use client";

import { Render, usePuck, type Data } from "@puckeditor/core";
import { useTranslations } from "next-intl";
import { puckConfig } from "@/design-system/editor/puck-config";
import { scopeClasses } from "@/lib/portal/palettes";
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
  style,
  palette,
  locale,
  navPages,
  turns,
  setTurns,
  instruction,
  setInstruction,
  aiBusy,
  setAiBusy,
}: {
  style: StyleName;
  palette: string | null;
  locale: string;
  navPages: { key: string; label: string }[];
  turns: Turn[];
  setTurns: React.Dispatch<React.SetStateAction<Turn[]>>;
  instruction: string;
  setInstruction: (v: string) => void;
  aiBusy: boolean;
  setAiBusy: (v: boolean) => void;
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
          <div className={`${scopeClasses(style, palette)} overflow-x-auto [background-color:var(--color-canvas)]`}>
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
        </div>
      </div>

      {/* Half the screen, and pinned. On a phone the assistant is not a panel
          beside the work — it IS the work, so it gets a fixed share rather than
          whatever is left over. */}
      <div className="flex h-[52%] shrink-0 flex-col border-t [border-color:var(--color-ink-800)]">
        <AiAssistant
          turns={turns}
          setTurns={setTurns}
          instruction={instruction}
          setInstruction={setInstruction}
          busy={aiBusy}
          setBusy={setAiBusy}
          pages={navPages}
          locale={locale}
          compact
        />
      </div>
    </div>
  );
}

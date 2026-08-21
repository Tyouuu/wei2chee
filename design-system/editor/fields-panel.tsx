"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePuck } from "@puckeditor/core";
import { VariantPicker } from "@/design-system/editor/variant-picker";
import { VARIANTS } from "@/design-system/editor/variants";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

/**
 * The right-hand column, split the way Durable splits it: 内容 and 设计.
 *
 * The founder sent two screenshots of Durable's panel to say 「durable 是这样的
 * 形式的」, and the form in them is specific. Two tabs. Design holds a row of
 * colour swatches and then the layout alternatives — each one FULL WIDTH,
 * stacked down the panel, each showing the real block with the customer's own
 * name in it. Content holds the switches and the fields.
 *
 * The split does real work beyond matching a reference. Before it, the picker
 * and the fields were fighting for one column: the picker was capped at 214px
 * so the fields could keep half, which forced the tiles into two narrow columns
 * and made every one of them too small to judge. Tabs mean neither has to be
 * small — whichever you are using gets the whole column. The two-column grid
 * was a symptom of the missing split, not a layout choice.
 *
 * WHICH TAB OPENS. 设计, whenever the block has alternatives. Content editing
 * is the more frequent task and by that logic should win the default, but the
 * frequent task is also the discoverable one — the fields are self-evidently
 * there and always have been. A design tab that opens closed is a design tab
 * nobody finds, which is the same failure the AI assistant had when it lived
 * behind a toolbar button (「把这个AI修改放在这里谁会去按啦」).
 */
export function FieldsPanel({
  style,
  palette,
  assistant,
  children,
}: {
  style: StyleName;
  palette: string | null;
  /** Rendered under both tabs. It edits the page by description, which is
   *  neither content nor design and is useful during both. */
  assistant: ReactNode;
  /** Puck's own fields for the selected block. */
  children: ReactNode;
}) {
  const { selectedItem } = usePuck();
  const type = selectedItem?.type;
  const hasVariants = !!(type && VARIANTS[type]?.length);
  const [tab, setTab] = useState<"content" | "design">("design");

  // Selecting a different KIND of block re-opens 设计, because that is a new
  // question ("what should this one look like"). Selecting a second block of
  // the same kind does not, because the customer has usually just answered it.
  useEffect(() => {
    setTab(hasVariants ? "design" : "content");
  }, [type, hasVariants]);

  return (
    <div className="flex h-full min-h-0 flex-col [background-color:var(--color-ink-900)]">
      {hasVariants && (
        <div
          role="tablist"
          className="flex shrink-0 gap-1 border-b [border-color:var(--color-ink-800)] px-3 py-2"
        >
          {(
            [
              ["design", "设计"],
              ["content", "内容"],
            ] as const
          ).map(([key, label]) => {
            const on = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(key)}
                className="rounded-[var(--radius-md)] px-3 py-1 [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] transition-colors"
                style={{
                  backgroundColor: on ? "var(--color-ink-800)" : "transparent",
                  color: on ? "var(--color-paper)" : "var(--color-paper-dim)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Whichever half is showing gets the room. `flex-[3]` against the
          assistant's `flex-[2]` is a 60/40 split that leaves the composer
          reachable without scrolling a properties panel to find it. */}
      <div className="min-h-0 flex-[3] overflow-y-auto">
        {hasVariants && tab === "design" ? (
          <VariantPicker style={style} palette={palette} />
        ) : (
          children
        )}
      </div>

      <div className="flex min-h-0 flex-[2] flex-col border-t [border-color:var(--color-ink-800)]">
        {assistant}
      </div>
    </div>
  );
}

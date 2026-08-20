import type { ReactNode } from "react";

/**
 * A miniature of what each block looks like, drawn beside its name in the
 * editor's component palette.
 *
 * WHY: the palette was a column of fifteen identical white rectangles
 * distinguished only by a Chinese noun. A business owner who has never used a
 * page builder cannot tell "记录表格" from "重点数字卡" from "业务流程" by
 * reading -- they recognise a table because it looks like a table. Browsing by
 * SIGHT rather than by reading is the whole reason component galleries like
 * 21st.dev put a live preview on every card, and it is the difference between a
 * palette a customer explores and one they avoid.
 *
 * These are schematic abstractions, not live renders of the real components.
 * That is deliberate:
 *   - the palette lives in the editor's own Ledger chrome scope, so a live
 *     render here would show the WRONG style for a customer who picked Hearth
 *     or Blueprint -- a preview that lies is worse than a diagram
 *   - several real components run hooks (RailNav reads usePathname and
 *     localStorage, the pickers own popover state); mounting fifteen of them in
 *     a scrolling drawer buys real cost for no extra clarity at 40px tall
 *   - at this size the recognisable thing IS the shape -- rows, a big number, a
 *     row of steps -- which is exactly what a schematic carries best
 */

// The three marks these diagrams are drawn with, and the contrast between them
// is the whole point. The first pass drew everything in --color-ink-800
// (#e4e9f0) on --color-ink-900 (#ffffff) -- a 1.11:1 difference. At 3px tall
// that is not a faint diagram, it is no diagram: every tile in the palette read
// as an empty grey rectangle, which made the column look like it had failed to
// load rather than like a gallery.
//
// STRUCTURE is the mark that carries the shape (a heading, a table's header
// rule, a figure) and is set in the ink itself. SUPPORT is everything the shape
// needs to be legible but which is not the shape (body rows, secondary bars).
// ACCENT marks the one element that is "current" or "active".
const STRUCTURE = "[background-color:var(--color-paper-dim)]";
const SUPPORT = "[background-color:var(--color-ink-700)]";
const BAR = SUPPORT;
const ACCENT = "[background-color:var(--color-primary)]";
const MUTED = STRUCTURE;

const Frame = ({ children }: { children: ReactNode }) => (
  <div
    aria-hidden
    className="flex h-9 w-12 shrink-0 flex-col justify-center gap-[3px] overflow-hidden rounded-[3px] border p-[5px] [background-color:var(--color-ink-900)] [border-color:var(--color-ink-700)]"
  >
    {children}
  </div>
);

const Row = ({ w, tone = BAR }: { w: string; tone?: string }) => (
  <span className={`block h-[3px] rounded-[1px] ${tone}`} style={{ width: w }} />
);

const PREVIEWS: Record<string, ReactNode> = {
  // A heading with a subtitle under it.
  PageHeader: (
    <Frame>
      <Row w="72%" tone={MUTED} />
      <Row w="46%" />
    </Frame>
  ),

  // One big figure -- the block is literally "a large number".
  HeroCard: (
    <Frame>
      <Row w="34%" />
      <span className={`block h-[9px] w-[80%] rounded-[1px] ${MUTED}`} />
    </Frame>
  ),

  // Header rule plus three data rows.
  RecordTable: (
    <Frame>
      <Row w="100%" tone={MUTED} />
      <Row w="100%" />
      <Row w="100%" />
      <Row w="100%" />
    </Frame>
  ),

  // Steps in a row, connected -- the pipeline shape.
  WorkflowStrip: (
    <Frame>
      <span className="flex items-center gap-[2px]">
        <span className={`block h-[8px] w-[9px] rounded-[1px] ${ACCENT}`} />
        <span className={`block h-[8px] w-[9px] rounded-[1px] ${BAR}`} />
        <span className={`block h-[8px] w-[9px] rounded-[1px] ${BAR}`} />
      </span>
    </Frame>
  ),

  // A dot beside a label.
  StatusDot: (
    <Frame>
      <span className="flex items-center gap-[3px]">
        <span className={`block h-[5px] w-[5px] rounded-full ${ACCENT}`} />
        <Row w="60%" />
      </span>
    </Frame>
  ),

  Avatar: (
    <Frame>
      <span className="flex items-center gap-[3px]">
        <span className={`block h-[11px] w-[11px] rounded-full ${MUTED}`} />
        <Row w="46%" />
      </span>
    </Frame>
  ),

  // Centred short lines -- the "nothing here yet" shape.
  EmptyState: (
    <Frame>
      <span className="flex flex-col items-center gap-[3px]">
        <Row w="40%" tone={MUTED} />
        <Row w="60%" />
      </span>
    </Frame>
  ),

  // A field box with a trailing marker (the calendar/chevron affordance).
  DatePicker: (
    <Frame>
      <span className="flex h-[11px] items-center justify-between rounded-[2px] border px-[3px] [border-color:var(--color-ink-800)]">
        <Row w="14px" />
        <span className={`block h-[4px] w-[4px] rounded-[1px] ${ACCENT}`} />
      </span>
    </Frame>
  ),

  // Removable pills.
  FilterChips: (
    <Frame>
      <span className="flex items-center gap-[3px]">
        <span className={`block h-[7px] w-[14px] rounded-full ${BAR}`} />
        <span className={`block h-[7px] w-[10px] rounded-full ${BAR}`} />
      </span>
    </Frame>
  ),

  // A field with an open list under it.
  Listbox: (
    <Frame>
      <span className="flex h-[9px] items-center justify-between rounded-[2px] border px-[3px] [border-color:var(--color-ink-800)]">
        <Row w="12px" />
        <span className={`block h-[3px] w-[3px] rotate-45 ${MUTED}`} />
      </span>
      <Row w="70%" />
    </Frame>
  ),

  // A dashed drop target.
  FileUploadField: (
    <Frame>
      <span className="flex h-[16px] items-center justify-center rounded-[2px] border border-dashed [border-color:var(--color-ink-700)]">
        <span className={`block h-[4px] w-[4px] rounded-[1px] ${ACCENT}`} />
      </span>
    </Frame>
  ),

  // A narrow column beside a wider one -- the page shell.
  SystemShell: (
    <Frame>
      <span className="flex h-[20px] items-stretch gap-[3px]">
        <span className={`block w-[9px] rounded-[1px] ${MUTED}`} />
        <span className={`block flex-1 rounded-[1px] ${BAR}`} />
      </span>
    </Frame>
  ),

  // Stacked nav items down a narrow rail.
  RailNav: (
    <Frame>
      <span className="flex h-[20px] w-[12px] flex-col justify-center gap-[3px]">
        <Row w="100%" tone={ACCENT} />
        <Row w="100%" />
        <Row w="100%" />
      </span>
    </Frame>
  ),
};

// Components whose preview is the same shape as one already drawn above.
PREVIEWS.MonthPicker = PREVIEWS.DatePicker;
PREVIEWS.Combobox = PREVIEWS.Listbox;
PREVIEWS.TextAutocomplete = PREVIEWS.Listbox;

/** Falls back to a plain frame rather than nothing, so a newly registered
 *  component still lines up with its neighbours instead of jumping left. */
export function ComponentPreview({ name }: { name: string }) {
  return (
    <>
      {PREVIEWS[name] ?? (
        <Frame>
          <Row w="70%" />
          <Row w="45%" />
        </Frame>
      )}
    </>
  );
}

"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Are this page's rows the business's own records, or a demonstration?
 *
 * ── THE DEFECT THIS EXISTS TO END ─────────────────────────────────────────
 *
 * The fields panel has a 「加一行」 button. It writes into the PAGE -- into the
 * Puck props -- which was the only place rows lived until 20260830040000.
 *
 * On 报价单 · 收款 · 客户 that is now the wrong place, and worse than wrong: the
 * live-rows projection replaces `table.rows` with the database's rows on every
 * server render, so a row typed there appears, survives the session, and is
 * gone the next time the page loads. And it looks perfectly fine until the
 * business writes its FIRST REAL RECORD -- before that there is nothing to
 * project, so the hand-typed rows stay and teach him to trust the button.
 *
 * ── WHY A CONTEXT AND NOT A PROP ──────────────────────────────────────────
 *
 * TableFieldEditor is a Puck custom field. Puck hands it `{ value, onChange }`
 * and nothing else -- it has no idea which page it is on. The panel is also a
 * SIBLING of the canvas, so a provider wrapped around the canvas does not
 * reach it; 选图器 learnt that the expensive way (see trade-context.tsx), and
 * this is mounted in the same place for the same reason.
 *
 * ⚠️ It reports what the PAGE is, not what the rows are. `table.live` only
 * appears once real rows have been projected, so trusting that would leave the
 * button armed for exactly the businesses that have not started yet -- the
 * ones it misleads.
 */

const RecordPageContext = createContext<boolean>(false);

export function RecordPageProvider({
  live,
  children,
}: {
  /** True when this page's rows come from the business's own tables. */
  live: boolean;
  children: ReactNode;
}) {
  return <RecordPageContext.Provider value={live}>{children}</RecordPageContext.Provider>;
}

/** True when a row on this page is a business record rather than a drawing. */
export function useRecordPage(): boolean {
  return useContext(RecordPageContext);
}

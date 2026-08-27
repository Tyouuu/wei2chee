"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Which trade the business in this subtree is in.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * 选图器 (photo-field.tsx) has taken a `trade` prop since the day it was
 * written, and it decides what the library is asked for -- TRADE_QUERY turns
 * 「renovation」 into 「renovation construction worker」, because a trade name is
 * not itself an image search.
 *
 * Nothing ever passed it. Screenshotted on 2026-08-27, an hour after the
 * founder handed over the Pixabay key: a renovation contractor opening 从图库找
 * was offered an aeroplane, a red sports car, two dogs and a florist. The
 * endpoint was fine. The wire was missing -- the eighth time this repo has
 * shipped a capability whose one caller never passed the argument.
 *
 * ── WHY A CONTEXT AND NOT A PROP ──────────────────────────────────────────
 *
 * The picker is registered inside Puck's field config, which is built by
 * `localisedPuckConfig(locale, systemLang)` and memoised on those two keys. A
 * third argument would have to thread through every caller AND join the cache
 * key, and a stale cache here means one customer's editor searching another
 * customer's trade. A context is read at render, so it cannot go stale.
 *
 * Empty string is the honest default: an unwrapped picker asks for the generic
 * query rather than guessing a trade, which is what it did before.
 */
const TradeContext = createContext<string>("");

export function TradeProvider({
  trade,
  children,
}: {
  trade?: string | null;
  children: ReactNode;
}) {
  return <TradeContext.Provider value={trade ?? ""}>{children}</TradeContext.Provider>;
}

export function useTrade(): string {
  return useContext(TradeContext);
}

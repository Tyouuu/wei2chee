"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SystemLang } from "@/lib/system-lang";
import { SYSTEM_WORDS, type SystemWords } from "@/design-system/system-words";

/**
 * Which language the components around this subtree speak.
 *
 * WHY THE DEFAULT IS `zh` AND NOT THE PRODUCT DEFAULT OF `en`
 *
 * These components render in two places that want opposite answers:
 *
 *   1. A CUSTOMER'S SYSTEM -- the portal, the editor canvas, the founder
 *      console's preview. English by default (`projects.system_language`,
 *      migration 20260822060000). Always wrapped, always explicit.
 *   2. FORMAE'S OWN CHROME -- the style picker's mini preview, the acquisition
 *      site's samples. Chinese, because the person reading those is the
 *      Malaysian-Chinese owner being sold to.
 *
 * An unwrapped component is by definition the second case, so the context
 * default is the second case's answer. Nothing that is not deliberately wired
 * changes appearance, which is the property that made this refactor safe to do
 * in one pass across twenty files.
 */
const SystemLangContext = createContext<SystemLang>("zh");

export function SystemLangProvider({
  lang,
  children,
}: {
  lang: SystemLang;
  children: ReactNode;
}) {
  return (
    <SystemLangContext.Provider value={lang}>
      {children}
    </SystemLangContext.Provider>
  );
}

export function useSystemLang(): SystemLang {
  return useContext(SystemLangContext);
}

/** What a component actually wants: the words, already resolved. */
export function useSystemWords(): SystemWords {
  return SYSTEM_WORDS[useContext(SystemLangContext)];
}

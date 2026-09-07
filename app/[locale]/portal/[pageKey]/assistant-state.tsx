"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Turn } from "./ai-assistant";

/**
 * THE ASSISTANT'S OWN STATE, HELD ABOVE <Puck> RATHER THAN INSIDE IT.
 *
 * ── THE BUG THIS EXISTS FOR ───────────────────────────────────────────────
 *
 * 用讲的改 accepted exactly one character. Measured in the browser on
 * 2026-08-23:
 *
 *     opened   textarea ""   submit button at (1337, 867) 47x30
 *     1 char   textarea "A"  submit button at (0,0) 0x0
 *              document.activeElement === BODY
 *     2 char   textarea "A"  -- the second keystroke went nowhere
 *
 * One keystroke, and focus was on <body> and the dock had collapsed. Clicking
 * back in did nothing, because the thing to click was zero pixels tall.
 *
 * ── WHY, AND WHY THE EXISTING FIX WAS NOT ENOUGH ──────────────────────────
 *
 * editor-client passes `overrides={{ ... }}` to Puck as an object literal, so
 * every render produces new override FUNCTIONS. React treats a new function as
 * a new component type and unmounts the old subtree -- and the `preview`
 * override is the whole canvas plus the assistant. So any editor-client state
 * change remounts them.
 *
 * ai-assistant.tsx already carries a comment about this, and the transcript and
 * draft were lifted into editor-client for exactly that reason. That saved the
 * VALUE and could not save anything else: setting state in editor-client is
 * what triggers the re-render, so each keystroke still remounted the textarea
 * (focus lost) and still reset AiDock's `manual` (dock collapsed).
 *
 * The fix is not to lift the state higher inside the same component. It is to
 * take it OUT of the component whose re-render is the problem. Typing now
 * re-renders this provider's consumers -- the assistant panel -- and never
 * editor-client, so `overrides` keeps its identity and nothing remounts.
 *
 * `dockOpen` lives here for the same reason: it used to be a useState inside
 * AiDock, which is inside the subtree that was being remounted, so it reset to
 * null on every keystroke and the dock closed itself.
 */

export type AssistantState = {
  turns: Turn[];
  setTurns: React.Dispatch<React.SetStateAction<Turn[]>>;
  instruction: string;
  setInstruction: (value: string) => void;
  busy: boolean;
  setBusy: (value: boolean) => void;
  /** The customer's manual open/close, or null to follow the selection.
   *  Null again whenever the selected block changes -- see AiDock. */
  dockOpen: boolean | null;
  setDockOpen: (value: boolean | null) => void;
};

const Ctx = createContext<AssistantState | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [dockOpen, setDockOpen] = useState<boolean | null>(null);

  const value = useMemo(
    () => ({
      turns,
      setTurns,
      instruction,
      setInstruction,
      busy,
      setBusy,
      dockOpen,
      setDockOpen,
    }),
    [turns, instruction, busy, dockOpen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Throws rather than returning a default: an assistant rendered outside the
 *  provider would silently get its own state back and reproduce the bug this
 *  file was written to end. */
export function useAssistant(): AssistantState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAssistant() outside <AssistantProvider>");
  return v;
}

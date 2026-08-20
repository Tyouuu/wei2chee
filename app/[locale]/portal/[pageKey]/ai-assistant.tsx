"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePuck, type Data } from "@puckeditor/core";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/** A page-level change the assistant offered and the customer can confirm.
 *  See lib/portal/layout-ops.ts's pageSuggestionSchema for why this is an offer
 *  with a button rather than another operation the route carries out. */
export type PageOffer = {
  action: "add_page" | "remove_page";
  pageKey: string | null;
  title: string;
  label: string;
};

export type Turn = {
  id: string;
  question: string;
  state: "thinking" | "done" | "failed";
  explanation?: string;
  applied?: number;
  skipped?: { op: string; reason: string }[];
  /** The layout as it stood BEFORE this turn ran. This is what makes a single
   *  turn revertible on its own, which the global undo stack cannot do once
   *  the customer has kept working past it. */
  before?: Data;
  reverted?: boolean;
  offer?: PageOffer;
  /** Set once the offer's button has been pressed, so the transcript records
   *  what the customer decided rather than silently swapping the button out. */
  offerResult?: { ok: boolean; href?: string };
  offerBusy?: boolean;
};

/**
 * The conversational half of the editor, as an actual assistant rather than a
 * text input.
 *
 * WHAT WAS WRONG WITH THE PREVIOUS SHAPE: one field in the toolbar, one line of
 * reply that the next request overwrote. For a product whose entire pitch is
 * that a non-technical owner can change their system by saying what they want,
 * that is the feature stated but not built. Three things were missing and each
 * of them is why people abandon an AI feature after two tries:
 *
 *   1. NO MEMORY OF WHAT IT DID. The reply vanished on the next request, so a
 *      customer could not check what changed, or explain to somebody else what
 *      they had done. A transcript is the record of their own work.
 *   2. NOTHING TO SAY. A blank box asking a business owner to phrase a request
 *      to an AI is the same blank-canvas problem this product has already been
 *      caught by once. The suggestions are the fix, and they are written as
 *      things an owner would actually want, not as demonstrations of syntax.
 *   3. NO WAY BACK FROM ONE SPECIFIC CHANGE. Global undo exists, but it walks
 *      back everything since — including drags the customer wants to keep. Each
 *      turn carries the layout from before it ran, so one edit can be dropped
 *      without losing the rest.
 *
 * The panel takes the right-hand column, which the fields panel vacates when
 * nothing is selected. They are mutually exclusive on purpose: two competing
 * panels in one column is how an editor starts feeling crowded and arbitrary.
 */
export function AiAssistant({
  turns,
  setTurns,
  instruction,
  setInstruction,
  busy,
  setBusy,
  onClose,
  pages,
  locale,
}: {
  /* The transcript and the draft message are owned by the EDITOR, not by this
   * component. Puck re-creates `overrides` render functions as the editor
   * re-renders, so anything held in state here would be lost the moment the
   * canvas changed -- which is every time the assistant successfully edits
   * something. Lifting it means a conversation survives its own results. */
  turns: Turn[];
  setTurns: React.Dispatch<React.SetStateAction<Turn[]>>;
  instruction: string;
  setInstruction: (value: string) => void;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onClose: () => void;
  /** The customer's own pages. Sent with each request so「把报价单删掉」can name
   *  a real page, and used to build the link after one is added. */
  pages: { key: string; label: string }[];
  locale: string;
}) {
  const t = useTranslations("portal.editor");
  // Read from Puck directly: this renders inside the `puck` override and
  // therefore inside the provider, so the layout it sends is always the live
  // canvas rather than a copy threaded down through props.
  const { appState, dispatch } = usePuck();
  const router = useRouter();
  const data = appState.data as Data;
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Follow the transcript as it grows, the way any chat surface does.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const id = `${Date.now()}`;
    const before = data;
    setTurns((prev) => [...prev, { id, question: trimmed, state: "thinking", before }]);
    setInstruction("");
    setBusy(true);

    const settle = (patch: Partial<Turn>) =>
      setTurns((prev) => prev.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)));

    try {
      const res = await fetch("/api/portal/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: before, instruction: trimmed, pages }),
      });

      if (!res.ok) {
        settle({ state: "failed", explanation: res.status === 429 ? t("aiRateLimited") : t("aiFailed") });
        return;
      }

      const result = (await res.json()) as {
        layout: Data;
        explanation: string;
        applied: number;
        skipped: { op: string; reason: string }[];
        suggestion: PageOffer | null;
      };

      if (result.applied > 0) {
        // `recordHistory` is what puts the edit on the undo stack. Without it
        // a customer who dislikes what the AI did has no way back, which makes
        // the feature something to be afraid of rather than something to try.
        dispatch({ type: "setData", data: result.layout, recordHistory: true });
      }
      settle({
        state: "done",
        explanation: result.explanation || t("aiNoChange"),
        applied: result.applied,
        skipped: result.skipped,
        offer: result.suggestion ?? undefined,
      });
    } catch {
      settle({ state: "failed", explanation: t("aiFailed") });
    } finally {
      setBusy(false);
    }
  }

  function revert(turn: Turn) {
    if (!turn.before) return;
    // Recorded as its own history step rather than silently rewinding, so the
    // revert is itself undoable.
    dispatch({ type: "setData", data: turn.before, recordHistory: true });
    setTurns((prev) => prev.map((x) => (x.id === turn.id ? { ...x, reverted: true } : x)));
  }

  /**
   * Carries out a page offer, with the customer's own credentials.
   *
   * This is the one thing the assistant does that touches the database, and it
   * happens on a press rather than on a sentence — see pageSuggestionSchema.
   * The RPCs resolve the project from `auth.uid()` and enforce their own rules
   * (the page cap, the un-removable dashboard), so this function does not need
   * to and deliberately does not restate them.
   */
  async function confirmOffer(turn: Turn) {
    const offer = turn.offer;
    if (!offer || turn.offerBusy || turn.offerResult) return;

    const patch = (p: Partial<Turn>) =>
      setTurns((prev) => prev.map((x) => (x.id === turn.id ? { ...x, ...p } : x)));

    patch({ offerBusy: true });
    const supabase = createBrowserSupabaseClient();

    if (offer.action === "add_page") {
      const { data, error } = await supabase.rpc("add_project_page", {
        requested_key: offer.pageKey,
        new_title: offer.pageKey ? "" : offer.title,
      });
      patch({
        offerBusy: false,
        offerResult: error
          ? { ok: false }
          : { ok: true, href: `/${locale}/portal/${String(data)}` },
      });
    } else {
      const { error } = await supabase.rpc("remove_project_page", {
        target_page_key: offer.pageKey,
      });
      patch({ offerBusy: false, offerResult: { ok: !error } });
    }

    // The page tabs, the rail and the home gallery are all server-rendered from
    // project_pages, so none of them know anything changed until the server
    // renders again.
    router.refresh();
  }

  const suggestions = [t("aiSuggest1"), t("aiSuggest2"), t("aiSuggest3")];

  return (
    <aside
      // A stable hook for end-to-end checks. The page ALSO contains the
      // customer's own RailNav, which is an <aside> with its own aria-label, so
      // selecting this panel by role or label alone matches two elements and
      // silently reads the wrong one -- which is exactly what happened the
      // first time this panel was verified.
      data-panel="ai"
      className="flex h-full w-[300px] shrink-0 flex-col border-l [border-color:var(--color-ink-800)] [background-color:var(--color-ink-900)]"
      aria-label={t("aiPanelTitle")}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3.5 py-2.5 [border-color:var(--color-ink-800)]">
        <span className="flex items-center gap-2 text-[13px] [color:var(--color-paper)] [font-weight:var(--fw-semibold)]">
          <span
            aria-hidden="true"
            className="grid h-5 w-5 place-items-center rounded-full text-[10px] [background-color:var(--color-primary-soft)] [color:var(--color-primary-deep)] [font-weight:var(--fw-semibold)]"
          >
            AI
          </span>
          {t("aiPanelTitle")}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("aiClose")}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[15px] [color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
        >
          ×
        </button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3.5 py-3.5">
        {turns.length === 0 ? (
          <div>
            <p className="text-[13px] leading-relaxed [color:var(--color-paper-dim)]">{t("aiEmptyBody")}</p>
            <p className="mt-4 text-[11px] uppercase tracking-[0.08em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
              {t("aiSuggestTitle")}
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {suggestions.map((sugg) => (
                <button
                  key={sugg}
                  type="button"
                  onClick={() => ask(sugg)}
                  className="rounded-md border px-3 py-2 text-left text-[12.5px] leading-snug transition-colors [border-color:var(--color-ink-800)] [color:var(--color-paper)] hover:[border-color:var(--color-primary)] hover:[background-color:var(--color-ink-850)]"
                >
                  {sugg}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {turns.map((turn) => (
              <li key={turn.id} className="flex flex-col gap-1.5">
                <p className="self-end rounded-lg rounded-br-sm px-2.5 py-1.5 text-[12.5px] leading-snug [background-color:var(--color-primary-soft)] [color:var(--color-primary-deep)]">
                  {turn.question}
                </p>

                {turn.state === "thinking" ? (
                  <p className="text-[12.5px] [color:var(--color-paper-dim)]">{t("aiThinking")}</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <p
                      className={`text-[12.5px] leading-snug ${
                        turn.state === "failed"
                          ? "[color:var(--color-clay-bright)]"
                          : "[color:var(--color-paper)]"
                      }`}
                    >
                      {turn.explanation}
                    </p>

                    {/* Counted, not just narrated. "改了 3 处" is checkable
                        against the canvas; a sentence alone is not. */}
                    {turn.state === "done" && (turn.applied ?? 0) > 0 && (
                      <p className="text-[11.5px] [color:var(--color-jade-bright)]">
                        {t("aiApplied", { count: turn.applied ?? 0 })}
                      </p>
                    )}

                    {/* Partial application is reported rather than swallowed:
                        four changes landing and one being dropped is a normal
                        outcome, and a customer who is not told assumes the
                        whole request was understood. */}
                    {turn.skipped?.length ? (
                      <ul className="flex flex-col gap-0.5">
                        {turn.skipped.map((s, i) => (
                          <li key={i} className="text-[11.5px] [color:var(--color-brass-bright)]">
                            · {s.reason}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {/* The offer. Where the assistant used to answer「现有操作
                        无法新增独立页面」and stop, it now proposes the page and
                        the customer presses once. The write is theirs, so the
                        paid gate and the undo model are both untouched. */}
                    {turn.offer && !turn.offerResult && (
                      <button
                        type="button"
                        onClick={() => confirmOffer(turn)}
                        disabled={turn.offerBusy}
                        className={`mt-0.5 self-start rounded-md px-3 py-1.5 text-[12px] transition-colors disabled:opacity-50 [font-weight:var(--fw-semibold)] ${
                          turn.offer.action === "remove_page"
                            ? "border [border-color:var(--color-clay-bright)] [color:var(--color-clay-bright)] enabled:hover:[background-color:var(--color-ink-850)]"
                            : "[background-color:var(--color-primary)] [color:var(--color-on-primary)] enabled:hover:[background-color:var(--color-primary-deep)]"
                        }`}
                      >
                        {turn.offerBusy
                          ? t("aiOfferWorking")
                          : turn.offer.action === "add_page"
                            ? `${t("aiOfferAdd")}：${turn.offer.label}`
                            : `${t("aiOfferRemove")}：${turn.offer.label}`}
                      </button>
                    )}

                    {turn.offerResult?.ok && turn.offerResult.href && (
                      <Link
                        href={turn.offerResult.href}
                        className="self-start text-[11.5px] underline [color:var(--color-jade-bright)]"
                      >
                        {t("aiPageAdded")}
                      </Link>
                    )}
                    {turn.offerResult?.ok && !turn.offerResult.href && (
                      <p className="text-[11.5px] [color:var(--color-jade-bright)]">
                        {t("aiPageRemoved")}
                      </p>
                    )}
                    {turn.offerResult && !turn.offerResult.ok && (
                      <p role="alert" className="text-[11.5px] [color:var(--color-clay-bright)]">
                        {t("aiOfferFailed")}
                      </p>
                    )}

                    {turn.state === "done" && (turn.applied ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => revert(turn)}
                        disabled={turn.reverted}
                        className="self-start text-[11.5px] underline disabled:no-underline disabled:opacity-60 [color:var(--color-paper-dim)] enabled:hover:[color:var(--color-paper)]"
                      >
                        {turn.reverted ? t("aiReverted") : t("aiRevert")}
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(instruction);
        }}
        className="shrink-0 border-t px-3.5 py-3 [border-color:var(--color-ink-800)]"
      >
        <textarea
          ref={inputRef}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          // Enter sends, Shift+Enter breaks the line — the convention every
          // messaging surface this customer already uses follows.
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(instruction);
            }
          }}
          rows={2}
          maxLength={500}
          disabled={busy}
          placeholder={t("aiPlaceholder")}
          aria-label={t("aiLabel")}
          className="w-full resize-none rounded-md border px-2.5 py-2 text-[12.5px] leading-snug outline-none disabled:opacity-60 [background-color:var(--color-ink-850)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] focus-visible:[border-color:var(--color-primary)]"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] [color:var(--color-paper-dim)]">{t("aiEnterHint")}</span>
          <button
            type="submit"
            disabled={busy || !instruction.trim()}
            className="rounded-md px-3 py-1.5 text-[12.5px] transition-colors disabled:opacity-40 [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)] enabled:hover:[background-color:var(--color-primary-deep)]"
          >
            {busy ? t("aiThinking") : t("aiSubmit")}
          </button>
        </div>
      </form>
    </aside>
  );
}

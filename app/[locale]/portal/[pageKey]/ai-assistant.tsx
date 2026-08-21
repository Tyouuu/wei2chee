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
 * WHERE IT LIVES, AND WHY THAT CHANGED (2026-08-21). It used to be a fourth
 * column that appeared beside Puck's entire layout when a toolbar button was
 * pressed, and the fields panel was hidden while it was open. The founder's
 * objection was the whole problem in one line: 「把这个AI修改放在这里谁会去按啦」.
 * A feature that is the product's central pitch cannot be behind a button most
 * customers never press.
 *
 * It is now permanently the lower half of Puck's existing right-hand column,
 * under the selected block's own fields. Still three columns; nothing to open.
 * The two halves are not rivals — one edits the page by describing it, the
 * other edits one block by hand, which is the same job at two levels of zoom.
 */
export function AiAssistant({
  turns,
  setTurns,
  instruction,
  setInstruction,
  busy,
  setBusy,
  pages,
  locale,
  compact = false,
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
  /** The customer's own pages. Sent with each request so「把报价单删掉」can name
   *  a real page, and used to build the link after one is added. */
  pages: { key: string; label: string }[];
  locale: string;
  /** The phone layout, where this panel is about half a small screen. Not a
   *  density preference — see the empty state below for what it changes and
   *  why the vertical version does not fit. */
  compact?: boolean;
}) {
  const t = useTranslations("portal.editor");
  // Read from Puck directly: this renders inside the `fields` override and
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

  // Follow the transcript as it grows, the way any chat surface does — but not
  // before there is one. On a phone the panel is 46% of the screen, the empty
  // state (an explanation plus three suggestions) is taller than that, and
  // scrolling it to the bottom on mount hid its own first line under the
  // header. Found by a hit-test sweep, which reported the first suggestion as
  // covered by the panel's own title bar.
  useEffect(() => {
    if (turns.length === 0) return;
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
      // FILLS ITS COLUMN RATHER THAN BEING ONE.
      //
      // This used to be `w-[300px] shrink-0 border-l`, because it WAS a column
      // -- a fourth one, appearing beside Puck's entire layout when a toolbar
      // button was pressed. That is why it could not simply default to open:
      // four fixed columns at 1440px leaves the canvas around 550px, below
      // what a five-column record table renders without clipping.
      //
      // It now lives inside the fields override, i.e. inside Puck's existing
      // right column, above the selected block's own fields. Same three
      // columns as before, and the assistant is always there. The width
      // belongs to the column now, so this element only has to fill it.
      className="flex h-full w-full min-h-0 flex-col [background-color:var(--color-ink-900)]"
      aria-label={t("aiPanelTitle")}
    >
      <div className="flex shrink-0 items-center gap-2 border-b px-3.5 py-2.5 [border-color:var(--color-ink-800)]">
        <span className="flex items-center gap-2 [font-size:var(--text-sm)] [color:var(--color-paper)] [font-weight:var(--fw-semibold)]">
          <span
            aria-hidden="true"
            className="grid h-5 w-5 place-items-center rounded-full [font-size:var(--text-micro)] [background-color:var(--color-primary-soft)] [color:var(--color-primary-deep)] [font-weight:var(--fw-semibold)]"
          >
            AI
          </span>
          {t("aiPanelTitle")}
        </span>
      </div>

      {/* `min-h-0` is load-bearing, not tidiness. A flex child defaults to
          `min-height: auto`, which means it refuses to shrink below its
          content — so on a phone, where this panel is 46% of the screen and
          the empty state is taller than that, the list grew past its container
          and the composer underneath it ended up ON TOP of the suggestions.
          Found by a hit-test sweep: three suggestion buttons reported as
          covered by the textarea. */}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
        {turns.length === 0 ? (
          /* THE EMPTY STATE IS THE ON-RAMP, so it has to be visible without
             scrolling — a blank box asking a business owner to phrase a
             request to an AI is the blank-canvas problem this product has
             already been caught by once.
             On a phone this panel is roughly 390px tall and the desktop
             version of this block is about 300px: the explanation and the
             three stacked suggestions pushed each other out of the scroll
             viewport, so a hit-test sweep reported all three suggestions as
             unreachable. Compact drops the explanation (the placeholder in
             the composer says the same thing) and lays the suggestions out as
             a swipeable row, which is ~110px instead of ~300px. */
          <div>
            {!compact && (
              <p className="[font-size:var(--text-sm)] leading-relaxed [color:var(--color-paper-dim)]">{t("aiEmptyBody")}</p>
            )}
            <p className={`[font-size:var(--text-micro)] uppercase tracking-[0.08em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)] ${compact ? "" : "mt-4"}`}>
              {t("aiSuggestTitle")}
            </p>
            <div
              className={
                compact
                  ? "-mx-3.5 mt-2 flex snap-x gap-2 overflow-x-auto px-3.5 pb-1"
                  : "mt-2 flex flex-col gap-1.5"
              }
            >
              {suggestions.map((sugg) => (
                <button
                  key={sugg}
                  type="button"
                  onClick={() => ask(sugg)}
                  className={`rounded-md border px-3 py-2 text-left [font-size:var(--text-xs)] leading-snug transition-colors [border-color:var(--color-ink-800)] [color:var(--color-paper)] hover:[border-color:var(--color-primary)] hover:[background-color:var(--color-ink-850)] ${
                    compact ? "w-[220px] shrink-0 snap-start" : ""
                  }`}
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
                <p className="self-end rounded-lg rounded-br-sm px-2.5 py-1.5 [font-size:var(--text-xs)] leading-snug [background-color:var(--color-primary-soft)] [color:var(--color-primary-deep)]">
                  {turn.question}
                </p>

                {turn.state === "thinking" ? (
                  <p className="[font-size:var(--text-xs)] [color:var(--color-paper-dim)]">{t("aiThinking")}</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <p
                      className={`[font-size:var(--text-xs)] leading-snug ${
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
                      <p className="[font-size:var(--text-xs)] [color:var(--color-jade-bright)]">
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
                          <li key={i} className="[font-size:var(--text-xs)] [color:var(--color-brass-bright)]">
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
                        className={`mt-0.5 self-start rounded-md px-3 py-1.5 [font-size:var(--text-xs)] transition-colors disabled:opacity-50 [font-weight:var(--fw-semibold)] ${
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
                        className="self-start [font-size:var(--text-xs)] underline [color:var(--color-jade-bright)]"
                      >
                        {t("aiPageAdded")}
                      </Link>
                    )}
                    {turn.offerResult?.ok && !turn.offerResult.href && (
                      <p className="[font-size:var(--text-xs)] [color:var(--color-jade-bright)]">
                        {t("aiPageRemoved")}
                      </p>
                    )}
                    {turn.offerResult && !turn.offerResult.ok && (
                      <p role="alert" className="[font-size:var(--text-xs)] [color:var(--color-clay-bright)]">
                        {t("aiOfferFailed")}
                      </p>
                    )}

                    {turn.state === "done" && (turn.applied ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => revert(turn)}
                        disabled={turn.reverted}
                        className="self-start [font-size:var(--text-xs)] underline disabled:no-underline disabled:opacity-60 [color:var(--color-paper-dim)] enabled:hover:[color:var(--color-paper)]"
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

      {/* A DIV, NOT A FORM, and this is not a style preference.
          Puck renders its fields panel inside a <form>, and this panel now
          lives in that panel (see the `fields` override in editor-client.tsx).
          A nested <form> is invalid HTML: React reports it, the server and
          client markup disagree, and the whole editor subtree gets thrown away
          and re-rendered on hydration. Caught in the browser console, not in
          review — tsc and the unit tests were both green.

          Nothing is lost. Enter already submitted via onKeyDown below, and the
          button calls the same function directly. */}
      <div className="shrink-0 border-t px-3.5 py-3 [border-color:var(--color-ink-800)]">
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
          // Three, not two. The placeholder is a full worked example and at
          // two rows it was visibly clipped mid-sentence in the column this
          // panel now lives in -- an instruction to the customer that they
          // cannot finish reading.
          rows={3}
          maxLength={500}
          disabled={busy}
          placeholder={t("aiPlaceholder")}
          aria-label={t("aiLabel")}
          className="w-full resize-none rounded-md border px-2.5 py-2 [font-size:var(--text-xs)] leading-snug outline-none disabled:opacity-60 [background-color:var(--color-ink-850)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] focus-visible:[border-color:var(--color-primary)]"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="[font-size:var(--text-micro)] [color:var(--color-paper-dim)]">{t("aiEnterHint")}</span>
          <button
            type="button"
            onClick={() => ask(instruction)}
            disabled={busy || !instruction.trim()}
            className="shrink-0 rounded-md px-3 py-1.5 [font-size:var(--text-xs)] transition-colors disabled:opacity-40 [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)] enabled:hover:[background-color:var(--color-primary-deep)]"
          >
            {busy ? t("aiThinking") : t("aiSubmit")}
          </button>
        </div>
      </div>
    </aside>
  );
}

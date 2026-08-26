"use client";

import { useEffect, useRef, useState } from "react";
import { useAssistant } from "./assistant-state";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePuck, type Data } from "@puckeditor/core";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { puckConfig } from "@/design-system/editor/puck-config";

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
  pages,
  locale,
  activeStyle,
  compact = false,
}: {
  /** The customer's own pages. Sent with each request so「把报价单删掉」can name
   *  a real page, and used to build the link after one is added. */
  pages: { key: string; label: string }[];
  locale: string;
  /** The register the system is on right now. Sent to `set_project_style` when
   *  the customer asked only for a palette change -- that RPC takes both, and
   *  passing the current one is how 「换个颜色」 leaves the register alone. */
  activeStyle: string;
  /** The phone layout, where this panel is about half a small screen. Not a
   *  density preference — see the empty state below for what it changes and
   *  why the vertical version does not fit. */
  compact?: boolean;
}) {
  /* The transcript and the draft message live in <AssistantProvider>, above
   * <Puck>. They used to be props from editor-client, which held them in its
   * own state -- and setting state there re-created Puck's `overrides`, which
   * remounted this panel on every keystroke. Reading them from a provider that
   * editor-client does not re-render is what makes typing possible at all.
   * See assistant-state.tsx for the measurement. */
  const { turns, setTurns, instruction, setInstruction, busy, setBusy } = useAssistant();

  /*
    A PICTURE THE OWNER POINTED AT.

    「可能客戶要我們去抄去借鑒別人的設計」. A shop owner explaining what he wants
    points at something -- a competitor's page, or the paper job sheet he has
    used for fifteen years, which is the most accurate description of his
    business anybody will ever hand us.

    Uploaded to our own bucket first, not sent as a data URL. A phone photo is
    3-5MB and base64 is a third larger again; and the route only forwards URLs
    on our own host, because a caller-supplied URL handed to OpenAI is a
    request forger's tool aimed at our own bill.
  */
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);

  async function attach(file: File) {
    setUploading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("account_id", auth.user.id)
        .single();
      if (!project) return;
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
      const path = `${project.id}/ask-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("site-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) return;
      setImage(supabase.storage.from("site-photos").getPublicUrl(path).data.publicUrl);
    } finally {
      setUploading(false);
    }
  }
  const t = useTranslations("portal.editor");
  // Read from Puck directly: this renders inside the `fields` override and
  // therefore inside the provider, so the layout it sends is always the live
  // canvas rather than a copy threaded down through props.
  const { appState, dispatch, selectedItem } = usePuck();
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
    // Cleared with the question it belonged to: a picture that stayed attached
    // would silently ride along on the next, unrelated request.
    setImage(null);
    setBusy(true);

    const settle = (patch: Partial<Turn>) =>
      setTurns((prev) => prev.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)));

    try {
      const res = await fetch("/api/portal/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: before, instruction: trimmed, pages, imageUrl: image }),
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
        /* 风格 / 配色 / 排法 -- not layout, so it is not in `result.layout`
           and is applied through the same RPC the style picker calls. */
        design: { style?: string; palette?: string | null; layout?: string } | null;
      };

      if (result.applied > 0) {
        // `recordHistory` is what puts the edit on the undo stack. Without it
        // a customer who dislikes what the AI did has no way back, which makes
        // the feature something to be afraid of rather than something to try.
        dispatch({ type: "setData", data: result.layout, recordHistory: true });
      }
      /*
        A DESIGN CHANGE GOES THROUGH THE SAME DOOR THE PICKER USES.

        `set_project_style` is the RPC /portal/styles calls, so this inherits
        its validation and its paid gate rather than opening a second way in.
        Then a refresh, because the register is read at render time -- the whole
        reason 换风格 is instant is that it is not baked into the saved layout.

        NOT on the undo stack, deliberately: Puck's history holds page trees,
        and a register is not one. Undoing an AI text edit must not silently
        change the customer's register back with it. Saying it in the reply is
        the honest affordance -- they change it back the same way they changed
        it, by saying so.
      */
      if (result.design) {
        const { error } = await createBrowserSupabaseClient().rpc("set_project_style", {
          new_style: result.design.style ?? activeStyle,
          new_palette: result.design.palette ?? null,
          clear_palette: result.design.palette === null,
        });
        if (!error) router.refresh();
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

  /**
   * ONE PRESS, ON THE THING THAT IS SELECTED — the part of Durable that this
   * product had copied the shape of and not the substance.
   *
   * Durable's assistant bar reads 「Ask Durable to re-write YOUR TEXT」 and
   * carries four buttons: Make Longer, Make Shorter, More casual, More
   * professional. Nothing is typed. This editor had a chat box and three
   * example sentences, which look similar in a screenshot and are not the same
   * thing at all: an example is still a sentence the customer has to decide to
   * send, and the blank composer underneath is still a blank composer. The
   * founder's 「你抄不到精髓」 is this gap — verbs versus a place to type.
   *
   * The bar is a renovation contractor in his fifties. "Press 短一点" and
   * "compose a request to an AI" are not the same task.
   *
   * Each verb becomes an instruction naming the block BY ID, because the model
   * sees ids in describeLayout()'s outline and a label alone would be ambiguous
   * the moment a page has two 重点数字卡. It then travels the identical path a
   * typed request does — same endpoint, same ops, same transcript entry, same
   * per-turn revert — so nothing here is a second way for the layout to change.
   */
  const blockId = typeof selectedItem?.props?.id === "string" ? selectedItem.props.id : null;
  const blockLabel = selectedItem
    ? ((puckConfig.components as Record<string, { label?: string }>)[selectedItem.type]?.label ??
      selectedItem.type)
    : null;
  const verbs: { label: string; verb: string }[] = [
    { label: t("aiVerbShorter"), verb: t("aiVerbShorter") },
    { label: t("aiVerbLonger"), verb: t("aiVerbLonger") },
    { label: t("aiVerbPlain"), verb: t("aiVerbPlain") },
    { label: t("aiVerbFormal"), verb: t("aiVerbFormal") },
  ];

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
      {/* Suppressed in the two places that already draw a header of their own:
          the floating dock at the foot of the canvas (ai-dock.tsx) and the
          phone layout. Rendering both put 「用讲的改」 directly above 「AI 助手」,
          two headings saying the same thing and 44px of the panel's height
          spent on the repetition. */}
      {!compact && (
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
      )}

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
          // WITH A BLOCK SELECTED, THE PAGE-LEVEL EXAMPLES GO AWAY. They are
          // about the whole page (「把流程改成…」) and the verb row below is
          // about the block in hand; showing both put two competing lists of
          // suggestions on top of each other, and made the customer choose
          // between a sentence to send and a button to press for what is
          // usually the same intent. Durable shows one row, and it is the
          // contextual one.
          <div style={blockId ? { display: "none" } : undefined}>
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
      {/* THE VERB ROW — always on while something is selected, not only on the
          empty state the way the page-level examples are. Durable's chips do
          not disappear once you have asked it something, and neither should
          these: 短一点 is the sort of thing pressed three times in a row while
          the customer watches the block shrink. */}
      {blockId ? (
        <div className="shrink-0 border-t px-3.5 pb-2 pt-2.5 [border-color:var(--color-ink-800)]">
          <p className="[font-size:var(--text-micro)] uppercase tracking-[0.08em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
            {t("aiBlockTitle")} · {blockLabel}
          </p>
          <div className="-mx-3.5 mt-2 flex snap-x gap-2 overflow-x-auto px-3.5 pb-0.5">
            {verbs.map((v) => (
              <button
                key={v.label}
                type="button"
                disabled={busy}
                onClick={() =>
                  ask(t("aiVerbPrompt", { id: blockId, block: blockLabel ?? "", verb: v.verb }))
                }
                // 44px on a phone, where mobile-editor.tsx makes this assistant the whole
                // interface and these four buttons are most of what it is for.
                className="min-h-11 shrink-0 snap-start rounded-full border px-3.5 py-1.5 [font-size:var(--text-xs)] transition-colors disabled:opacity-40 lg:min-h-9 [border-color:var(--color-ink-800)] [color:var(--color-paper)] enabled:hover:[border-color:var(--color-primary)] enabled:hover:[background-color:var(--color-ink-850)]"
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="shrink-0 border-t px-3.5 py-3 [border-color:var(--color-ink-800)]">
        {image ? (
          <div className="mb-2 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="h-10 w-14 rounded-[var(--radius-xs)] object-cover" />
            <button
              type="button"
              onClick={() => setImage(null)}
              className="[color:var(--color-paper-dim)] [font-size:var(--text-micro)] hover:[color:var(--color-paper)]"
            >
              {t("aiImageRemove")}
            </button>
          </div>
        ) : null}
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
          {/* A phone has no Shift+Enter, so this hint was instructing a
              keystroke that cannot be typed on the device showing it. Same
              1024px line as the rest of the editor's desktop/mobile split:
              below it, mobile-editor.tsx renders this assistant as the whole
              interface, and the send button beside it is the real affordance
              there. */}
          <span className="hidden [font-size:var(--text-micro)] [color:var(--color-paper-dim)] lg:inline">{t("aiEnterHint")}</span>
          <input
            ref={imageRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void attach(f);
              e.target.value = "";
            }}
          />
          {/* Beside the send button rather than inside the textarea: on a phone
              this assistant IS the whole editor (mobile-editor.tsx), and an
              icon tucked into a text field at that size is a target a thumb
              misses. */}
          <button
            type="button"
            onClick={() => imageRef.current?.click()}
            disabled={busy || uploading}
            title={t("aiImageAdd")}
            className="min-h-11 shrink-0 rounded-md px-3 [border:1px_solid_var(--color-ink-800)] [color:var(--color-paper-dim)] [font-size:var(--text-xs)] hover:[color:var(--color-paper)] disabled:opacity-40 lg:min-h-0 lg:py-1.5"
          >
            {uploading ? "…" : t("aiImageAdd")}
          </button>
          <button
            type="button"
            onClick={() => ask(instruction)}
            disabled={busy || !instruction.trim()}
            // Full width and 44px tall below 1024px, unchanged above it.
            // Measured at 30px on a 390px viewport, which is under the 44px a
            // thumb needs -- and this is the send button of the assistant that
            // mobile-editor.tsx makes the ENTIRE phone interface, so it is the
            // one control on that screen that cannot be fiddly. It also has the
            // row to itself down there now that the Enter hint beside it is
            // desktop-only, so widening costs nothing.
            className="min-h-11 w-full shrink-0 rounded-md px-3 py-1.5 [font-size:var(--text-xs)] transition-colors disabled:opacity-40 lg:min-h-0 lg:w-auto [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)] enabled:hover:[background-color:var(--color-primary-deep)]"
          >
            {busy ? t("aiThinking") : t("aiSubmit")}
          </button>
        </div>
      </div>
    </aside>
  );
}

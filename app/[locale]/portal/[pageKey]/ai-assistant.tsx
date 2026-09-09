"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAssistant } from "./assistant-state";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import type { Skip } from "@/lib/portal/skip-codes";
import { usePuck, type Data } from "@puckeditor/core";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { puckConfig } from "@/design-system/editor/puck-config";
import { LABELS_EN } from "@/design-system/editor/labels-en";
import { planDesignChange } from "@/lib/portal/design-change";
import { claimStands } from "@/lib/portal/claim-check";
import {
  suggestionsFor,
  ASSISTANT_LIMITS,
} from "@/lib/portal/trade-suggestions";
import { MODULE_BY_KEY } from "@/lib/portal/module-catalog";
import { useTrade } from "@/design-system/trade-context";
import { findSelector, type PuckLayout } from "@/lib/portal/layout-ops";
import { relayout } from "@/lib/portal/relayout";
import { useEditorUi } from "@/design-system/editor/editor-ui";

/*
  WHO ENDED THE WAIT.

  Both our own timer and the 「不等了」 button abort the same request, and the
  two deserve different sentences: 「等太久我先停了」 is a report, and saying it
  to somebody who just pressed stop himself is a small lie of the kind this
  route has been in trouble for before. `signal.reason` carries which it was.
*/
const TIMED_OUT = "timed-out";

/** A page-level change the assistant offered and the customer can confirm.
 *  See lib/portal/layout-ops.ts's pageSuggestionSchema for why this is an offer
 *  with a button rather than another operation the route carries out. */
export type PageOffer = {
  action: "add_page" | "remove_page" | "pick_photo";
  pageKey: string | null;
  title: string;
  label: string;
  /** `pick_photo` only: the block whose picture slot to open. */
  blockId?: string;
};

/**
 * 一件没做成的事，讲成他读得懂的那一句。
 *
 * 🔴 那几句 2026-09-07 之前是**写死的中文**（四十九处），而 portal 的 locale
 * 跟 `system_language` 预设都是 `en` —— 也就是多数情况下他读到的是中文。
 * 见 lib/portal/skip-codes.ts 的档头。
 *
 * ⚠️ 认不得的代号回代号本身，不回一句空的 —— 一个空白的解释，跟
 * 「什么都没发生」在他眼前长得一模一样。
 */
/** ⚠️ 导出去给他的系统那一页那块面板用（`work-assistant.tsx`）——
 *  **抄一份过去就是第五十句写死的话**。见这个档头上面那一段。 */
export function sayWhyNot(t: ReturnType<typeof useTranslations>, s: Skip): string {
  const key = `skipped.${s.reason}`;
  try {
    return t(key, (s.vars ?? {}) as never).trim();
  } catch {
    return s.reason;
  }
}

export type Turn = {
  id: string;
  question: string;
  state: "thinking" | "done" | "failed";
  explanation?: string;
  /** 做成了，而顺手还发生了一件事。跟 skipped 一样是代号。 */
  notes?: Skip[];
  applied?: number;
  skipped?: Skip[];
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
  pageKey,
  pages,
  locale,
  activeStyle,
  isGeneratedDraft,
  compact = false,
}: {
  /** The customer's own pages. Sent with each request so「把报价单删掉」can name
   *  a real page, and used to build the link after one is added. */
  pages: { key: string; label: string }[];
  /** Which module is open. The route uses it to decide whether 「加一单」 on
   *  this page writes a business record or a layout row -- founder-points 23. */
  pageKey: string | null;
  locale: string;
  /** The register the system is on right now. Sent to `set_project_style` when
   *  the customer asked only for a palette change -- that RPC takes both, and
   *  passing the current one is how 「换个颜色」 leaves the register alone. */
  activeStyle: string;
  /**
   * Has this page never been saved?
   *
   * 排法 re-generates the page, and page.tsx only generates while `layout_json`
   * is empty -- so after the first save 「表格放前面」 has to be answered by
   * moving the real block instead. The route needs to know before it writes
   * the prompt, or the assistant says it re-arranged a page it cannot touch.
   */
  isGeneratedDraft: boolean;
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
  const { turns, setTurns, instruction, setInstruction, busy, setBusy } =
    useAssistant();
  /* The dock's OWN open state, in editor-ui. Note that useAssistant()
     also carries a dockOpen/setDockOpen pair and NOTHING READS IT --
     two providers each claiming in a comment to be where this lives.
     The one AiDock consults is this one. */
  const { setDockOpen, openSheet } = useEditorUi();

  /*
    A PICTURE THE OWNER POINTED AT.

    「可能客戶要我們去抄去借鑒別人的設計」. A shop owner explaining what he wants
    points at something -- a competitor's page, or the paper job sheet he has
    used for fifteen years, which is the most accurate description of his
    business anybody will ever hand us.

    Uploaded to our own bucket first, not sent as a data URL. A phone photo is
    3-5MB and base64 is a third larger again, on a JSON request body, on a
    Malaysian mobile connection.

    🔴 而那个桶从 2026-09-09 起是 **private** 的（`ask-photos`,
    20260909160000），送给 route 的是**路径**不是网址 —— 这一段原本写着
    「route 只转发我们自己网域上的网址」，而那句话讲的是一个已经不存在的
    做法：他附上来的可能是他供应商开给他的发票。
  */
  /* 🔴 路径，不是网址 —— 而这一行是 2026-09-09 那个漏洞的补法本身。
     一条 `getPublicUrl()` 出来的东西是**永久、不用登入、任何人打得开**的，
     而他附上来的可能是他供应商开给他的发票。`preview` 是浏览器自己的
     `blob:` 网址（只在这个分页里存在，传不出去），所以画面上照样看得到
     那张图，而**没有任何一条指向它的网址离开过这台机器**。 */
  const [image, setImage] = useState<{ path: string; preview: string } | null>(
    null,
  );
  /* 收掉那条 blob，不然一次对话里换五张图就是五张留在记忆体里。 */
  const clearImage = useCallback(() => {
    setImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return null;
    });
  }, []);
  const [uploading, setUploading] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  /* The in-flight request, so both our own timer and the 「不等了」 button can
   * end the same wait. Null whenever nothing is in flight. */
  const abortRef = useRef<AbortController | null>(null);

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
      const ext = (file.name.split(".").pop() || "jpg")
        .toLowerCase()
        .slice(0, 5);
      const path = `${project.id}/ask-${crypto.randomUUID()}.${ext}`;
      /* 🔴 `ask-photos`，不是 `site-photos`。见 20260909160000 的档头。
         `site-photos` 的档头白纸黑字写着 PUBLIC READ，而那对**要贴到官网上
         的照片**是对的 —— 他附给助手的这一张不是那件事，它是一个**问题**。
         一个问题永远不需要一条公开的网址，而它可能是一张发票。 */
      const { error } = await supabase.storage
        .from("ask-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) return;
      setImage({ path, preview: URL.createObjectURL(file) });
    } finally {
      setUploading(false);
    }
  }
  const t = useTranslations("portal.editor");
  // Read from Puck directly: this renders inside the `fields` override and
  // therefore inside the provider, so the layout it sends is always the live
  // canvas rather than a copy threaded down through props.
  const { appState, dispatch, selectedItem } = usePuck();

  /*
    THE OFFER PROMISES A PICKER, SO A PICKER HAS TO OPEN.

    Selecting is not opening: the photo field lives in the block's content
    sheet, which the customer normally reaches from the toolbar. Pressing
    「去挑照片」 used to select the block and stop, which is an offer that
    describes an outcome and produces an outline.

    Opened HERE rather than beside the dispatch because editor-sheets closes
    any block sheet it sees while nothing is selected -- rightly; otherwise
    clicking the background leaves a panel editing a block that is gone. Asking
    for both in one tick loses that race. This waits until Puck reports the
    block actually selected.
  */
  const wantsPicker = useRef<string | null>(null);
  useEffect(() => {
    if (!wantsPicker.current) return;
    if (String(selectedItem?.props?.id ?? "") !== wantsPicker.current) return;
    wantsPicker.current = null;
    // The same sheet the toolbar's 改文字 opens -- the customer's own route.
    openSheet({ kind: "block", tab: "content" });
  }, [selectedItem, openSheet]);
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
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const id = `${Date.now()}`;
    const before = data;
    setTurns((prev) => [
      ...prev,
      { id, question: trimmed, state: "thinking", before },
    ]);
    setInstruction("");
    // Cleared with the question it belonged to: a picture that stayed attached
    // would silently ride along on the next, unrelated request.
    clearImage();
    setBusy(true);
    /*
      SENDING IS THE STRONGEST 「keep this open」 THERE IS.

      The dock opens by itself when a block is selected, and 修改 sits OUTSIDE
      the canvas -- so pressing it deselects, and the dock closed on its own
      while the request was still running. The reply, and the 撤销 button under
      it, arrived in a panel the customer could no longer see. Saying so
      explicitly here also survives the selection changing again when the new
      layout lands.
    */
    setDockOpen(true);

    const settle = (patch: Partial<Turn>) =>
      setTurns((prev) =>
        prev.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)),
      );

    /*
      NOTHING USED TO EVER STOP WAITING.

      The fetch had no timeout, so a request that stalled left the spinner
      running with no way out but reloading the editor -- which throws away
      every unsaved change on the page. Measured 2026-08-27 over 50 real calls:
      median 3.8s, p95 8.4s, slowest 13.6s (both slowest were picture requests).
      45s is three times the worst call ever measured, so no honest answer is
      ever cut off; anything past it is stuck, and he is told so instead of
      being left to guess.

      Held in a ref so the 「不等了」 button can reach it: a person who has been
      staring at 「思考中…」 for half a minute should be able to end it himself
      rather than wait for our timer to decide.
    */
    const abort = new AbortController();
    abortRef.current = abort;
    const timer = setTimeout(() => abort.abort(TIMED_OUT), 45_000);

    try {
      const res = await fetch("/api/portal/edit", {
        method: "POST",
        signal: abort.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layout: before,
          instruction: trimmed,
          pages,
          /* 🔴 路径，不是网址。route 那一端拿他自己的登入去下载，
             再把位元组送给模型 —— 跟 `/api/receipt` 同一条路。 */
          imagePath: image?.path ?? null,
          generated: isGeneratedDraft,
          /* Which module is open. The route needs it to know whether 「加一单」
             on THIS page is a business record or a layout row -- see
             lib/portal/record-ops.ts and founder-points 23. */
          pageKey,
          /*
            WHICH BLOCK HE HAS OPEN.

            The panel header已经 says 「改这一块 · 官网大标题」, so this component
            has always known -- and never sent it. That is the whole object of
            「短一点」「拿掉」「换一张」, which is how somebody talks when the thing
            is already in front of them and their thumb is on a phone.
          */
          selected: blockId,
          /*
            THE ASSISTANT COULD NOT REMEMBER THE LAST THING IT DID.

            Every call was stateless: the page, the sentence, nothing else. So
            「刚才那个不要了」 was answered with 「要改回去的是表格、流程，还是整页
            排法？」 -- a reasonable question from something with no memory, and
            a strange one from anything the owner would call an assistant. The
            same gap swallows 「再加一栏」, 「那个再大一点」, 「跟刚才那个一样」,
            which is most of how a second sentence gets said.

            Three turns, not the whole transcript: enough for 「刚才」 and 「再」,
            small enough that a long session does not quietly grow the prompt.
            `reverted` travels with them because a turn the owner took back is
            NOT on the page, and an assistant that talks about it as if it were
            is worse company than one that forgot.
          */
          history: turns
            .filter((h) => h.state === "done")
            .slice(-3)
            .map((h) => ({
              asked: h.question,
              did: h.explanation ?? "",
              reverted: h.reverted === true,
            })),
        }),
      });

      if (!res.ok) {
        /*
          WHOSE FAULT IT WAS DECIDES WHICH SENTENCE HE READS.

          Every failure used to say 「这次没听懂，换个说法再试一次」 -- which
          tells a contractor to rewrite a sentence that was fine, when what
          actually happened was our route failing or the platform hanging up.
          It is the same family of bug as an assistant claiming a change it did
          not make: the words do not match what happened. A 5xx is ours, and
          both messages end by saying his page is untouched, because that is
          the thing he is actually afraid of.
        */
        settle({
          state: "failed",
          explanation:
            res.status === 429
              ? t("aiRateLimited")
              : res.status >= 500
                ? t("aiBroke")
                : t("aiFailed"),
        });
        return;
      }

      const result = (await res.json()) as {
        layout: Data;
        explanation: string;
        applied: number;
        skipped: Skip[];
        notes?: Skip[];
        suggestion: PageOffer | null;
        /* 风格 / 配色 / 排法 -- not layout, so it is not in `result.layout`
           and is applied through the same RPC the style picker calls. */
        design: {
          style?: string;
          palette?: string | null;
          layout?: string;
        } | null;
        /* True when the route wrote real rows. They are in the database, not
           in `layout`, so the page has to be re-read for them to appear. */
        refetch?: boolean;
      };

      /*
        THE ROWS ARE NOT IN THE TREE WE JUST GOT BACK.

        A quotation the assistant wrote lives in `pipeline_records`, and the
        page picks it up through the live-rows projection on the server. So
        this is the one case where refreshing IS the fix -- unlike 排法, where
        a refresh cannot help because the layout lives in Puck's client state.
      */
      if (result.refetch) router.refresh();

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
      /*
        WHICH RPCS A DESIGN ANSWER BECOMES IS DECIDED IN design-change.ts.

        Not inline, because this handler is where 排法 was lost: the field was
        added to the prompt, the schema, validDesign and the database, and this
        one place was never updated, so the model answered 「表格放前面」
        correctly and the browser threw it away while the reply said it was
        done. The planner is a pure function with a test that walks every field
        the reply can carry, so the next field added cannot go unspent.
      */
      const calls = planDesignChange(result.design, activeStyle);
      /* Hoisted out of the block below so the honesty check at the end can see
         it -- whether a design change actually landed is half of 「did anything
         this reply claimed really happen」. */
      let designLanded = false;
      if (calls.length) {
        const supabase = createBrowserSupabaseClient();
        let landed = false;
        for (const call of calls) {
          const { error } = await supabase.rpc(call.rpc, call.args);
          if (!error) landed = true;
        }
        // Refresh if ANY of them landed: a failed palette must not hide a
        // register that did change, or the page shows a state matching neither.
        if (landed) router.refresh();
        designLanded = landed;

        /*
          THE COLUMN MOVED AND THE CANVAS DID NOT.

          Caught by `npm run eval:browser` on 2026-08-27 -- the tenth 「说了没做」
          in this repo and the first one found by a ruler instead of by the
          founder. 「我要一进来就先看到那个表格」 answered 「好，打开页面会先看到
          表格。」, `set_project_layout` wrote `table`, and the page in front of
          him did not move a pixel. Reload it and the new arrangement is there
          -- which is why every other check passed, and is no comfort at all to
          somebody staring at an unchanged screen with no reason to reload.

          `router.refresh()` cannot fix this. It re-renders the SERVER tree,
          and the arrangement lives in Puck's own client state, which the
          refresh does not replace.

          So the real blocks are moved here, with the pure function the click
          buttons already use. Not a regenerate: that would throw away every
          word, column and row the customer has edited -- the same wall the
          other session hit from the click side on the same day, and the same
          answer. It returns the identical array when nothing moved, so a page
          already in that arrangement costs one comparison and no re-render.
        */
        if (result.design?.layout) {
          const base = result.layout as unknown as PuckLayout;
          const moved = relayout(base, result.design.layout);
          if (moved !== base) {
            dispatch({
              type: "setData",
              data: moved as unknown as Data,
              recordHistory: true,
            });
          }
        }
      }

      /*
        IT DOES NOT GET TO SAY IT CHANGED SOMETHING IF NOTHING CHANGED.

        The model writes its sentence while emitting operations -- before any
        of them run. By this line we know exactly what landed and what was
        refused, and until now the sentence was shown verbatim regardless.
        Eleven times in this repo that produced a reply claiming a change over
        a page that had not moved, and every one of them was found separately
        and fixed by connecting one more wire.

        This is the net under that seam. See claim-check.ts for what it can and
        cannot see -- it is not a substitute for wiring things correctly, it is
        what catches the twelfth on the day it ships.
      */
      const honest = claimStands({
        applied: result.applied,
        skipped: result.skipped.length,
        designPlanned: calls.length,
        designLanded,
      });

      settle({
        state: "done",
        // The model's own words when they are true; ours when they are not.
        // Not both: a false sentence followed by a correction still reads as
        // 「it worked, but」, and what happened is that it did not work.
        /* 🔴 顺手发生的那几件接在后面 —— 那是我们做过才知道的事实，
           不是模型讲的话，所以它在这里翻译（词住在语言档里）。
           少了它，一次静静扣掉的套票他要到客人下次来才发现。 */
        explanation: [
          honest ? result.explanation || t("aiNoChange") : t("aiClaimedNothing"),
          ...(honest ? (result.notes ?? []).map((n) => sayWhyNot(t, n)) : []),
        ]
          .filter(Boolean)
          .join(" "),
        applied: result.applied,
        skipped: result.skipped,
        offer: result.suggestion ?? undefined,
      });
    } catch (err) {
      // An abort is not a failure to understand him. Told apart from a real
      // network error so the reply says which of the two happened.
      const stopped = err instanceof DOMException && err.name === "AbortError";
      settle({
        state: "failed",
        explanation: !stopped
          ? t("aiBroke")
          : abort.signal.reason === TIMED_OUT
            ? t("aiTookTooLong")
            : t("aiStopped"),
      });
    } finally {
      clearTimeout(timer);
      abortRef.current = null;
      setBusy(false);
    }
  }

  function revert(turn: Turn) {
    if (!turn.before) return;
    // Recorded as its own history step rather than silently rewinding, so the
    // revert is itself undoable.
    dispatch({ type: "setData", data: turn.before, recordHistory: true });
    setTurns((prev) =>
      prev.map((x) => (x.id === turn.id ? { ...x, reverted: true } : x)),
    );
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
      setTurns((prev) =>
        prev.map((x) => (x.id === turn.id ? { ...x, ...p } : x)),
      );

    /*
      OPENING A PICTURE SLOT IS NOT A WRITE.

      Every other offer here calls an RPC. This one selects a block, because
      the photo field lives in the fields panel and the panel shows whatever is
      selected -- so the whole action is 「put him in front of the picker」.
      Nothing is saved, nothing is spent, and the picture he ends up with is
      one he chose with his eyes.

      Read from the LIVE canvas rather than the layout that came back with the
      reply: he may have dragged something in the meantime, and a stale index
      would select the wrong block and open the wrong panel.
    */
    if (offer.action === "pick_photo") {
      const sel = offer.blockId
        ? findSelector(
            (appState.data as unknown as PuckLayout).content ?? [],
            offer.blockId,
          )
        : null;
      if (sel) {
        /*
          THE CLICK THAT ASKS FOR THE PICKER WAS UNDOING THE SELECTION.

          Measured on 2026-08-27, the first time anybody pressed this button in
          a browser: dispatching here selected the block and something cleared
          it again before the frame painted -- `selectedItem` read back null,
          the toolbar never appeared, and the picker had nothing to open onto.
          This offer button sits INSIDE the canvas (the dock is drawn over the
          customer's page), so the same click goes on to be handled as a click
          on the canvas, which deselects.

          One frame later the click is over and the selection sticks. Same
          reason inline-editing waits a frame before attaching its caret.
        */
        requestAnimationFrame(() => {
          dispatch({ type: "setUi", ui: { itemSelector: sel } });
          wantsPicker.current = offer.blockId ?? null;
        });
      }
      patch({ offerBusy: false, offerResult: { ok: Boolean(sel) } });
      return;
    }

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

  /*
    HIS TRADE, NOT A DENTIST'S.

    These were three fixed strings and the first was 「把「客户」改成「病人」」 --
    a dental example shown to every renovation contractor, aircon technician,
    kopitiam and tuition centre in the product. An example that is not about
    your business does not teach you what the box is for; it teaches you the
    box is for somebody else.

    The trade was on hand the whole time: TradeProvider, the same context the
    photo picker reads. Ninth time in this repo that a capability existed and
    the wire was never connected.
  */
  /* AND THE PAGE, not only the trade.

     A ledger has no stages, and the 官网 page has no table at all, so two of
     the three lines were impossible on the page they were shown on -- HAX
     Guideline 1 calls that a task mismatch and puts 「product abandonment」
     next to it. The shape decides which survive and what the first one is. */
  const panelLocale = useLocale();
  const suggestions = suggestionsFor(
    useTrade(),
    panelLocale,
    pageKey ? (MODULE_BY_KEY[pageKey]?.shape ?? null) : null,
  );
  const limits = ASSISTANT_LIMITS[panelLocale.startsWith("zh") ? "zh" : "en"];

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
  const blockId =
    typeof selectedItem?.props?.id === "string" ? selectedItem.props.id : null;
  /* 🔴 这一行2026-09-07 改了（老板自己点出来的）：
     `puckConfig` 里的名字是中文的 —— 中文是唯一真相，英文是它的投影
     （任务 8）。而这一格一直直接读原文，于是一个英文系统里的面板写着
     「CHANGE THIS BLOCK · 记录表格」—— 半句英文半句中文。
     ⚠️ 只借那份对照表，不借 `localisedPuckConfig`：
     我们要的只有名字，不要它整套包过的 render（跟 command-bar 同一条）。 */
  const blockLabel = selectedItem
    ? (() => {
        const raw =
          (puckConfig.components as Record<string, { label?: string }>)[
            selectedItem.type
          ]?.label ?? selectedItem.type;
        return panelLocale === "zh" ? raw : (LABELS_EN[raw] ?? raw);
      })()
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
      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5"
      >
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
              <p className="[font-size:var(--text-sm)] leading-relaxed [color:var(--color-paper-dim)]">
                {t("aiEmptyBody")}
              </p>
            )}
            <p
              className={`[font-size:var(--text-micro)] uppercase tracking-[0.08em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)] ${compact ? "" : "mt-4"}`}
            >
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
            {/* WHAT IT WILL NOT DO.

                PAIR's mental-models guidance is that onboarding has to say
                what a system can do AND what it cannot; this panel said only
                the first, which is how an owner asks for the same impossible
                thing three times and then decides the product is broken.

                ⚠️ The first version hid these behind `!compact`, copying the
                explanation above it. But the dock on a 1500px desktop IS
                compact -- it is a floating panel, not the full sidebar -- so
                the limits rendered nowhere a customer would ever be. A limit
                nobody sees is the same defect as no limit, written by the
                person fixing it. Found by opening the panel and looking.

                They stay, in both modes; compact lays them on one wrapping
                line instead of three, which measures ~2 lines rather than the
                explanation's ~180px. check:reachable is what says the chips
                above are still pressable at 390. */}
            <ul
              className={
                compact
                  ? "mt-3 flex flex-wrap gap-x-3 gap-y-0.5 [font-size:var(--text-micro)] [color:var(--color-paper-dim)]"
                  : "mt-4 flex flex-col gap-1 [font-size:var(--text-micro)] leading-relaxed [color:var(--color-paper-dim)]"
              }
            >
              {limits.map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {turns.map((turn) => (
              <li key={turn.id} className="flex flex-col gap-1.5">
                <p className="self-end rounded-lg rounded-br-sm px-2.5 py-1.5 [font-size:var(--text-xs)] leading-snug [background-color:var(--color-primary-soft)] [color:var(--color-primary-deep)]">
                  {turn.question}
                </p>

                {turn.state === "thinking" ? (
                  <p className="[font-size:var(--text-xs)] [color:var(--color-paper-dim)]">
                    {t("aiThinking")}
                  </p>
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
                          <li
                            key={i}
                            className="[font-size:var(--text-xs)] [color:var(--color-brass-bright)]"
                          >
                            · {sayWhyNot(t, s)}
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
                            : turn.offer.action === "pick_photo"
                              ? t("aiOfferPhoto")
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
                    {/*
                      ONLY A DELETED PAGE SAYS A PAGE WAS DELETED.

                      This branch was 「success with no link」, written when the
                      only two offers were add-a-page and remove-a-page. 照片
                      arrived as a third action and fell straight into it, so
                      pressing 「去挑照片」 answered 「已经删掉了。」 -- measured in a
                      browser on 2026-08-27, and about as alarming a sentence as
                      this panel could produce.
                    */}
                    {turn.offerResult?.ok &&
                      !turn.offerResult.href &&
                      turn.offer?.action === "remove_page" && (
                        <p className="[font-size:var(--text-xs)] [color:var(--color-jade-bright)]">
                          {t("aiPageRemoved")}
                        </p>
                      )}
                    {turn.offerResult && !turn.offerResult.ok && (
                      <p
                        role="alert"
                        className="[font-size:var(--text-xs)] [color:var(--color-clay-bright)]"
                      >
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
                  ask(
                    t("aiVerbPrompt", {
                      id: blockId,
                      block: blockLabel ?? "",
                      verb: v.verb,
                    }),
                  )
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
            <img
              src={image.preview}
              alt=""
              className="h-10 w-14 rounded-[var(--radius-xs)] object-cover"
            />
            <button
              type="button"
              onClick={clearImage}
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
          className="w-full resize-none rounded-md border px-2.5 py-2 [font-size:var(--text-xs)] leading-snug outline-none disabled:opacity-60 [background-color:var(--color-ink-850)] [border-color:var(--input)] [color:var(--color-paper)] focus-visible:[border-color:var(--color-primary)]"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          {/* A phone has no Shift+Enter, so this hint was instructing a
              keystroke that cannot be typed on the device showing it. Same
              1024px line as the rest of the editor's desktop/mobile split:
              below it, mobile-editor.tsx renders this assistant as the whole
              interface, and the send button beside it is the real affordance
              there. */}
          <span className="hidden [font-size:var(--text-micro)] [color:var(--color-paper-dim)] lg:inline">
            {t("aiEnterHint")}
          </span>
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
          {/* WHILE HE IS WAITING, THIS IS THE ONLY THING HE CAN DO.

              The attach button is disabled during a request anyway, so its slot
              is free -- and a person who has been watching 「思考中…」 for half a
              minute needs a way out that is not reloading the editor and losing
              every unsaved change. Our own 45s timer is a backstop, not an
              answer: he should not have to wait for it. */}
          {busy ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="min-h-11 shrink-0 rounded-md px-3 [border:1px_solid_var(--color-ink-800)] [color:var(--color-paper-dim)] [font-size:var(--text-xs)] hover:[color:var(--color-paper)] lg:min-h-0 lg:py-1.5"
            >
              {t("aiStop")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => imageRef.current?.click()}
              disabled={uploading}
              title={t("aiImageAdd")}
              className="min-h-11 shrink-0 rounded-md px-3 [border:1px_solid_var(--color-ink-800)] [color:var(--color-paper-dim)] [font-size:var(--text-xs)] hover:[color:var(--color-paper)] disabled:opacity-40 lg:min-h-0 lg:py-1.5"
            >
              {uploading ? "…" : t("aiImageAdd")}
            </button>
          )}
          <button
            type="button"
            onClick={() => ask(instruction)}
            disabled={busy || !instruction.trim()}
            /*
              44px tall and filling the rest of the row below 1024px, unchanged
              above it.

              ⚠️ `w-full` WAS WRONG HERE, AND THE COMMENT THAT REPLACED SAID SO
              CONFIDENTLY. It claimed this button "has the row to itself down
              there" -- it does not. The row still holds 「加图」 (or 「不等了」
              while busy), and in a flex row `w-full` does not mean "take the
              space that is left", it means "be as wide as the whole row" and
              then get pushed right by the sibling. Measured on the real editor
              at 390: the row is left=14 right=376, and this button was
              left=96 right=458 -- SIXTY-EIGHT PIXELS PAST THE SCREEN.

              So the send button of the assistant that mobile-editor.tsx makes
              the entire phone interface could not be pressed on a phone. 「用讲
              的改」 is the product's headline promise, and on the width this
              market was measured to be on, the sentence could be typed and
              never sent.

              `flex-1` is the class that means what the old comment meant.
            */
            className="min-h-11 flex-1 rounded-md px-3 py-1.5 [font-size:var(--text-xs)] transition-colors disabled:opacity-40 lg:min-h-0 lg:w-auto lg:flex-none [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)] enabled:hover:[background-color:var(--color-primary-deep)]"
          >
            {busy ? t("aiThinking") : t("aiSubmit")}
          </button>
        </div>
      </div>
    </aside>
  );
}

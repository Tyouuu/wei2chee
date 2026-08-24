// "use client" SINCE 2026-08-25, and it is the whole point of the change. This
// component's own header used to read WHY IT IS INERT HERE. Nothing submits --
// which was the honest thing to say while there was nowhere for an enquiry to
// go. There is now (migration 20260825040000), so the form posts, and a
// component that posts needs state.
"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useSystemWords } from "@/design-system/system-lang-context";

/**
 * 官网表格 → 系统出单. The one component in this product where the outside and
 * the inside of a business touch.
 *
 * The founder's own summary of what he wanted built next was 「官网表格 → 系统
 * 出单」, and then 「这个我一直不懂是什么来的」 — the sentence is easy and the
 * thing it names is not, because nothing on either side of the arrow shows it.
 * A form on a website looks like a form. A row in a table looks like a row. The
 * arrow between them is invisible, and an invisible arrow is a feature nobody
 * buys.
 *
 * So this component draws the arrow. Under the button, in the customer's own
 * page, it says where a submission LANDS: 「填完 → 你的系统会开一张『报价单』」.
 * That line is the product's central claim rendered as an object rather than
 * asserted in marketing copy, and it is the reason this is a purpose-built
 * component and not three Field blocks stacked in the palette.
 *
 * IT SUBMITS NOW, and only where submitting is honest. Until 2026-08-25 this
 * header said 「Nothing submits」 and was right to: there was no table for a
 * customer's enquiries, so a form that appeared to accept one and dropped it
 * would have been the worst possible thing to ship on a page a stranger reads.
 *
 * The table exists (migration 20260825040000), so the arrow is now a behaviour
 * rather than a sentence. The rule that replaced the old one: it posts ONLY
 * from a published page, where the slug is in the address bar. In the editor's
 * preview there is no slug and the form says so out loud —— 「这是预览，没有真的
 * 送出」 —— because a preview that pretends to accept an enquiry is the same
 * dishonesty in a different place.
 *
 * WHY EVERY FIELD HAS A REAL <label>. The contract's own rule, and it matters
 * more here than anywhere else in the system: the reader is a stranger on a
 * phone, and a placeholder that vanishes when they start typing is how a
 * half-filled form gets abandoned.
 */
export function EnquiryForm({
  heading,
  blurb,
  fields,
  submitLabel,
  landsIn,
  landsInBadge = "自动",
  landsInBefore = "填完送出 → 你的系统会开一张",
  landsInAfter = "，不用有人转抄。",
  note,
  look = "card",
}: {
  heading: ReactNode;
  blurb?: ReactNode;
  /** What the business asks for. Kept short on purpose — every extra field on
   *  a landing-page form costs replies. */
  fields?: {
    label: string;
    placeholder?: string;
    kind?: "text" | "phone" | "long";
  }[];
  submitLabel?: string;
  /** The page a submission becomes a record in, in the customer's own word for
   *  it: 报价单, 预约, 订单. This is the arrow. */
  landsIn?: string;
  /** The three pieces of the arrow line around `landsIn`. Props rather than a
   *  language context because this is a server component -- the page builder
   *  passes them in the system language (see landing-templates.ts). The
   *  defaults are Chinese so a 官网 saved before this existed still reads as
   *  it did. */
  landsInBadge?: string;
  landsInBefore?: string;
  landsInAfter?: string;
  /** One line under the button, e.g. opening hours or how fast they reply. */
  note?: ReactNode;
  /**
   *   card   boxed, the way a form is on most business sites.
   *   plain  no box: the form sits on the page itself, which reads quieter and
   *          suits a page that is already one card after another.
   *   split  the ask on the left, the fields on the right. The most
   *          website-looking of the three, and the one that stops a long page
   *          ending in a tall stack of inputs.
   */
  look?: "card" | "plain" | "split";
}) {
  const base = useId();
  const w = useSystemWords();
  const rows = fields && fields.length > 0 ? fields : DEFAULT_FIELDS;
  const split = look === "split";
  const boxed = look === "card";
  const [values, setValues] = useState<Record<number, string>>({});
  const [state, setState] = useState<"idle" | "sending" | string>("idle");

  /** The published address is the only thing that says which business this
   *  form belongs to, and it is already in the reader's address bar. Reading
   *  it here rather than threading a prop keeps the page builder out of a
   *  decision it cannot make -- the same layout is rendered in the editor,
   *  where there is no slug and there should be no submission. */
  const slugFromUrl = () => {
    if (typeof window === "undefined") return "";
    const m = /^\/s\/([^/?#]+)/.exec(window.location.pathname);
    return m ? decodeURIComponent(m[1]) : "";
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const slug = slugFromUrl();
    if (!slug) {
      setState(w.sendPreviewOnly);
      return;
    }
    // The first two fields are the name and the way to reach them in every
    // trade's question set -- the schema says so, and the analysis is told so.
    // Everything else is this trade's own and rides along as answers.
    const name = (values[0] ?? "").trim();
    const contact = (values[1] ?? "").trim();
    if (!name || !contact) {
      setState(w.sendIncomplete);
      return;
    }
    const answers: Record<string, string> = {};
    rows.forEach((f, i) => {
      if (i > 1 && (values[i] ?? "").trim()) answers[f.label] = values[i].trim();
    });

    setState("sending");
    try {
      const res = await fetch("/api/site/enquiry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, name, contact, answers, website: "" }),
      });
      const { result } = (await res.json()) as { result?: string };
      setState(
        result === "ok"
          ? w.sent
          : result === "too_many"
            ? w.sendTooMany
            : result === "incomplete"
              ? w.sendIncomplete
              : w.sendFailed,
      );
      if (result === "ok") setValues({});
    } catch {
      setState(w.sendFailed);
    }
  }

  return (
    <section className="[padding-block:var(--pad-card-lg)] [padding-inline:var(--pad-card-lg)]">
      <div
        className={[
          boxed
            ? "ds-card [padding:var(--pad-card-lg)]"
            : "",
          split ? "grid items-start gap-x-10 gap-y-6 md:grid-cols-2" : "",
        ].join(" ")}
      >
        {/* `contents` when not split, so the heading and blurb stay direct
            children of a plain block and nothing about their spacing changes.
            In split mode this becomes the left column. */}
        <div className={split ? "" : "contents"}>
          <h2 className="ds-display [color:var(--color-paper)] [font-size:var(--text-title)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-title)]">
            {heading}
          </h2>
          {blurb && (
            <p className="mt-2 max-w-[52ch] [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
              {blurb}
            </p>
          )}
        </div>

        {/* Capped at a readable measure rather than the page being capped --
            the contract's layout rule: cap fields, not pages. */}
        <form
          onSubmit={onSubmit}
          className={`${split ? "" : "mt-6 "}flex max-w-[34rem] flex-col [gap:var(--gap-stack)]`}
        >
          {/* Nobody sees this and nobody fills it. A bot fills every input it
              finds, which is what makes it the cheapest honest filter there
              is -- no puzzle for a real person to solve. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute h-0 w-0 overflow-hidden opacity-0"
          />
          {rows.map((f, i) => {
            const id = `${base}-${i}`;
            return (
              <div key={f.label}>
                <label
                  htmlFor={id}
                  className="mb-1.5 block [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]"
                >
                  {f.label}
                </label>
                {f.kind === "long" ? (
                  <textarea
                    id={id}
                    rows={3}
                    value={values[i] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [i]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full resize-y [background-color:var(--color-ink-950)] [border-radius:var(--radius-control)] [border:var(--hairline)_solid_var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-base)] [line-height:var(--leading-body)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)] placeholder:[color:var(--color-paper-dim)] focus-visible:[border-color:var(--color-primary)] focus-visible:outline-none"
                  />
                ) : (
                  <input
                    id={id}
                    type={f.kind === "phone" ? "tel" : "text"}
                    inputMode={f.kind === "phone" ? "tel" : undefined}
                    value={values[i] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [i]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="min-h-11 w-full [background-color:var(--color-ink-950)] [border-radius:var(--radius-control)] [border:var(--hairline)_solid_var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-base)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)] placeholder:[color:var(--color-paper-dim)] focus-visible:[border-color:var(--color-primary)] focus-visible:outline-none"
                  />
                )}
              </div>
            );
          })}

          <div className="mt-1 flex flex-wrap items-center [gap:var(--gap-inline)]">
            <button
              type="submit"
              disabled={state === "sending"}
              className="inline-flex min-h-11 items-center disabled:opacity-60 [background-color:var(--color-primary)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.6)] [transition-duration:var(--dur)] [transition-property:background-color] hover:[background-color:var(--color-primary-deep)]"
            >
              {submitLabel || "送出"}
            </button>
            {note && (
              <span className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
                {note}
              </span>
            )}
          </div>

          {/* One line, in the reader's own language, saying what happened.
              `aria-live` because a stranger who pressed a button and saw
              nothing change assumes it is broken. */}
          {state !== "idle" && state !== "sending" && (
            <p
              aria-live="polite"
              className="[color:var(--color-paper)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]"
            >
              {state}
            </p>
          )}
        </form>

        {/* THE ARROW. Not decoration and not an aside: this line is the only
            place on the page where the product's own claim is visible. */}
        {landsIn && (
          <p
            className={`${split ? "md:col-span-2 " : ""}mt-6 flex flex-wrap items-center [gap:var(--gap-inline)] [border-top:var(--hairline)_solid_var(--color-ink-800)] [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [padding-top:var(--pad-card)]`}
          >
            <span
              aria-hidden
              className="[background-color:var(--color-primary-soft)] [border-radius:var(--radius-pill)] [color:var(--color-primary)] [font-size:var(--text-micro)] [font-weight:var(--fw-semibold)] [padding-block:2px] [padding-inline:8px]"
            >
              {landsInBadge}
            </span>
            <span>
              {landsInBefore}
              <b className="[color:var(--color-paper)] [font-weight:var(--fw-medium)]">
                「{landsIn}」
              </b>
              {landsInAfter}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}

/** Name, phone, what they want. Three fields, because a fourth costs replies
 *  and a business that needs more asks for it in the chat that follows. */
const DEFAULT_FIELDS = [
  { label: "怎么称呼", placeholder: "陈先生", kind: "text" as const },
  {
    label: "电话 / WhatsApp",
    placeholder: "012-345 6789",
    kind: "phone" as const,
  },
  {
    label: "想做什么",
    placeholder: "三房翻新，想问大概多少",
    kind: "long" as const,
  },
];

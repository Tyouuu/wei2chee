// "use client" SINCE 2026-08-25, and it is the whole point of the change. This
// component's own header used to read WHY IT IS INERT HERE. Nothing submits --
// which was the honest thing to say while there was nowhere for an enquiry to
// go. There is now (migration 20260825040000), so the form posts, and a
// component that posts needs state.
"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useSystemWords } from "@/design-system/system-lang-context";
import type { SystemWords } from "@/design-system/system-words";

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
  /*
    NO CHINESE DEFAULTS HERE ANY MORE.

    These read 「自动」 / 「填完送出 → 你的系统会开一张」 / 「，不用有人转抄。」 as
    parameter defaults, so an English system printed them in Chinese on its own
    public page -- to a stranger, on the one screen that decides whether an
    enquiry ever arrives. SYSTEM_WORDS.enquiry has carried both languages since
    the words file was written, and this component already calls
    useSystemWords() eleven lines down. Another capability built with the wire
    never connected.

    A parameter default cannot read a hook, so the fallback moves into the body
    where `w` exists. `undefined` and not a string, so an explicitly-set prop
    still wins.
  */
  landsInBadge,
  landsInBefore,
  landsInAfter,
  note,
  look = "card",
  anchor,
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
  /** 这一块在资料里的 id。顶栏跟第一屏那几颗按钮指的是它。 */
  anchor?: string;
}) {
  const base = useId();
  const w = useSystemWords();
  const rows = fields && fields.length > 0 ? fields : defaultFields(w);
  // The arrow block only renders when `landsIn` is set, so the empty string
  // here is never read -- it exists so the tuple can be destructured once.
  const [arrowBefore, arrowAfter] = w.enquiry.arrow(landsIn ?? "");
  const badge = landsInBadge ?? w.enquiry.auto;
  const before = landsInBefore ?? arrowBefore;
  const after = landsInAfter ?? arrowAfter;
  const split = look === "split";
  const boxed = look === "card";
  const [values, setValues] = useState<Record<number, string>>({});
  const [state, setState] = useState<"idle" | "sending" | string>("idle");
  /* 🔴 那句话贴着**哪一格**（2026-09-07）。

     它本来印在整张表**最底下**，量出来离最近那个框 115px，
     而且要同时指两个框，所以只写得成「留个称呼和联络方式就可以」——
     一个陌生人在手机上刚滑到底，读完还要自己数回去是哪一格。
     Baymard（做过真人测试）：错误要**贴着那一格**，
     而且讲**要求**不讲**违规**。

     ⚠️ 后台那一边 2026-09-07 早上修的是同一件事（`74119c7`），
     形状照抄：贴着那一格 · 框自己讲得出它是坏的 · 光标跟着回去。
     **而这一页贵得多** —— 那是一个陌生人，一次，在手机上，
     而这一块是整个官网上唯一会把钱带进来的地方。

     ⚠️ 送不出去那几种（预览 · 太多 · 挂了 · 收到了）**贴不到任何一格**，
     所以它们照旧留在按钮旁边。两种混在一格里，就是今天这个样子。 */
  const [missAt, setMissAt] = useState<number | null>(null);

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
      /* 空的那一格是哪一个就指哪一个 —— 两个都空的时候指第一个，
         他填完那一个再按，第二句自己出现在第二格底下。 */
      const at = !name ? 0 : 1;
      setMissAt(at);
      setState("idle");
      requestAnimationFrame(() => {
        /* ⚠️ `?.()` —— 一个没有它的环境里这一句会抛，
           而抛在这里会把**那句话也一起吃掉**。 */
        const el = document.getElementById(`${base}-${at}`);
        el?.scrollIntoView?.({ block: "center", behavior: "smooth" });
        el?.focus?.();
      });
      return;
    }
    setMissAt(null);
    const answers: Record<string, string> = {};
    rows.forEach((f, i) => {
      if (i > 1 && (values[i] ?? "").trim())
        answers[f.label] = values[i].trim();
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
    /* id="ask" —— 页面上别处的按钮要有地方去。瑞士 那三张服务卡上的
       「View Details」如果不连到任何东西，就是一颗画出来的死按钮。 */
    <section
      id="ask"
      className="[padding-block:var(--pad-card-lg)] [padding-inline:var(--pad-card-lg)]"
    >
      {/* 🔴 这一块有**两个名字**，而在 2026-09-05 之前只画得出一个。
          组件里面四处「View Details」指的是写死的 `#ask`（上面那一行），
          而顶栏 · 页脚 · 第一屏那三颗按钮指的是它在资料里的 id
          （`website-form`）—— 於是那三颗从来没有落点。
          两个都画出来，两边都通。见 lib/portal/anchor-prune.ts。 */}
      {anchor && anchor !== "ask" ? <span id={anchor} aria-hidden /> : null}
      <div
        className={[
          boxed ? "ds-card [padding:var(--pad-card-lg)]" : "",
          split
            ? "grid items-stretch gap-0 md:grid-cols-2 [margin:var(--site-form-bleed,0)]"
            : "",
        ].join(" ")}
      >
        {/* `contents` when not split, so the heading and blurb stay direct
            children of a plain block and nothing about their spacing changes.
            In split mode this becomes the left column. */}
        <div
          className={
            split ? "[padding:calc(var(--pad-card-lg)*1.2)]" : "contents"
          }
        >
          <h2
            data-column-heading=""
            className="ds-display [color:var(--color-paper)] [font-size:var(--text-title)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-title)]"
          >
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
          /* ── 短的栏位并排 ────────────────────────────────────────────────
             老板 2026-08-30，看 台账 对 Newel 第6段：他们的 Contact Us 是
             **两栏**（First name / Last name 并排，Email 一整行），我们是一栏
             从上叠到下。尺子读出来「几栏 3 对 1」。

             短的（name / phone）各占一半，长的（要讲的事）一整行 —— 那是这一
             类表格的通用排法，也是他们那一段的排法。手机上照样一栏。 */
          className={`${split ? "[background:var(--site-form-panel,transparent)] [border-inline-start:var(--site-form-line,0)] [padding:calc(var(--pad-card-lg)*1.2)] " : "mt-6 "}grid [gap:var(--gap-stack)] ${split ? "" : "max-w-[34rem] "}@xl:grid-cols-2`}
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
              <div
                key={f.label}
                className={f.kind === "long" ? "@xl:col-span-2" : ""}
              >
                <label
                  htmlFor={id}
                  className="mb-1.5 block [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]"
                >
                  {f.label}
                </label>
                {f.kind === "long" ? (
                  <textarea
                    id={id}
                    aria-invalid={missAt === i || undefined}
                    aria-describedby={missAt === i ? `${id}-why` : undefined}
                    rows={3}
                    value={values[i] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [i]: e.target.value }))
                    }
                    placeholder={f.placeholder}
                    className="w-full resize-y [background-color:var(--site-field-bg,var(--color-ink-950))] [border-radius:var(--site-field-radius,var(--radius-control))] [border:var(--site-field-border,var(--hairline)_solid_var(--input))] [box-shadow:var(--site-field-line,none)] [color:var(--color-paper)] [font-size:var(--text-base)] [line-height:var(--leading-body)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)] placeholder:[color:var(--color-paper-dim)] focus-visible:[border-color:var(--color-primary)] focus-visible:outline-none"
                  />
                ) : (
                  <input
                    id={id}
                    aria-invalid={missAt === i || undefined}
                    aria-describedby={missAt === i ? `${id}-why` : undefined}
                    type={f.kind === "phone" ? "tel" : "text"}
                    inputMode={f.kind === "phone" ? "tel" : undefined}
                    value={values[i] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [i]: e.target.value }))
                    }
                    placeholder={f.placeholder}
                    className="min-h-11 w-full [background-color:var(--site-field-bg,var(--color-ink-950))] [border-radius:var(--site-field-radius,var(--radius-control))] [border:var(--site-field-border,var(--hairline)_solid_var(--input))] [box-shadow:var(--site-field-line,none)] [color:var(--color-paper)] [font-size:var(--text-base)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)] placeholder:[color:var(--color-paper-dim)] focus-visible:[border-color:var(--color-primary)] focus-visible:outline-none"
                  />
                )}
                {/* 🔴 贴着这一格的那句话 —— 见上面 `missAt`。
                    `role="alert"`，因为他按下按钮的时候多半正看着按钮。

                    ⚠️ **颜色不是红的，而那不是漏做。** 后台那一边用的是
                    `--color-clay-bright`，我第一版照抄了 —— 然后逐套量出来：
                    那个 token **官网这一层没有人替它重新指过**
                    （`.ds-ground[data-ground="ink"] .ds-site` 重新指了地、字、
                    线、卡、主色，就是没有指状态色），所以它在官网上带着
                    **工作台**的值，压在那一套自己的官网地上：

                      图纸 5.27 · 満図 5.92 · 瑞士 5.76
                      🔴 中台 3.91 · 招牌 2.59 · 台账 1.91

                    六套里三套读不到，而 招牌 的官网地本来就是深红
                    （#500014）—— 一句红字压在红地上，连色相都分不出来。

                    所以用 `--color-paper`：官网这一层它被重新指到
                    `--site-ink-fg`，而那一对**六套都在 9.58 以上**，
                    `site-colour-contrast.test.ts` 有一条常驻守卫盯着它。
                    重量交给字重跟 `role="alert"` —— 颜色本来就不可以是
                    唯一的讯号（WCAG 1.4.1），而这一格底下只有这一句话。 */}
                {missAt === i ? (
                  <span
                    id={`${id}-why`}
                    role="alert"
                    className="mt-1.5 block [border-inline-start:2px_solid_var(--border-strong)] [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] [line-height:var(--leading-body)] [padding-inline-start:calc(var(--pad-control-x)*0.6)]"
                  >
                    {w.fieldNeeded}
                  </span>
                ) : null}
              </div>
            );
          })}

          <div className="mt-1 flex flex-col items-stretch [gap:var(--gap-inline)] @xl:col-span-2">
            <button
              type="submit"
              disabled={state === "sending"}
              className="inline-flex min-h-11 items-center justify-center disabled:opacity-60 [flex-grow:var(--site-submit-grow,0)] [background-color:var(--site-submit-bg,var(--color-primary))] [border-radius:var(--radius-control)] [color:var(--site-submit-fg,var(--color-on-primary))] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.6)] [transition-duration:var(--dur)] [transition-property:background-color] hover:[background-color:var(--color-primary-deep)]"
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
              {badge}
            </span>
            <span>
              {before}
              <b className="[color:var(--color-paper)] [font-weight:var(--fw-medium)]">
                「{landsIn}」
              </b>
              {after}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Name, phone, what they want. Three fields, because a fourth costs replies
 * and a business that needs more asks for it in the chat that follows.
 *
 * A FUNCTION OF THE WORDS, not a constant. It was a module-level array of
 * Chinese literals, so an English system's public page asked a stranger
 * 「怎么称呼」. SYSTEM_WORDS.enquiry has held both languages all along.
 */
function defaultFields(w: SystemWords) {
  return [
    {
      label: w.enquiry.name.label,
      placeholder: w.enquiry.name.placeholder,
      kind: "text" as const,
    },
    {
      label: w.enquiry.phone.label,
      placeholder: w.enquiry.phone.placeholder,
      kind: "phone" as const,
    },
    {
      label: w.enquiry.detail.label,
      placeholder: w.enquiry.detail.placeholder,
      kind: "long" as const,
    },
  ];
}

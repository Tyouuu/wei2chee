import type { ReactNode } from "react"

/**
 * The first screen of the page a business's own CUSTOMERS see.
 *
 * Every other component in this system is read by the owner: a table of their
 * work, a ledger of their money. This one is read by a stranger deciding
 * whether to message a contractor they found on Facebook, and that changes the
 * rules rather than the styling.
 *
 * ONE CLAIM, ONE LINE, ONE ACTION. A landing page for a Malaysian SME is not a
 * brochure — the entire job is "say what you do and give me a way to ask".
 * Everything here serves that: the eyebrow places the business (地区 + 行业,
 * which is what people actually search), the headline is the claim, the line
 * under it is the proof, and the two buttons are the only two things anyone
 * does — message now, or look at the price first.
 *
 * WHATSAPP IS THE PRIMARY ACTION AND THAT IS NOT A STYLE CHOICE. In this market
 * a contact form that emails somewhere is a form nobody fills. The owner reads
 * WhatsApp; the customer already has it open. So the loud button is the one
 * that opens a chat, and the enquiry form below it exists for the case where
 * the business wants the answers written down (see enquiry-form.tsx, which is
 * the half that becomes a record in the system).
 *
 * FULL WIDTH, LEFT ALIGNED, like every other page in the contract. A centred
 * narrow hero is the single most common way a generated landing page announces
 * that nobody designed it.
 */
export function SiteHero({
  eyebrow,
  headline,
  sub,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  proof,
}: {
  /** Where and what, e.g. 「吉隆坡 · 住宅装修」. The line people search by. */
  eyebrow?: ReactNode
  /** ReactNode, not string, so the editor can make it editable in place. */
  headline: ReactNode
  sub?: ReactNode
  primaryLabel?: string
  primaryHref?: string
  secondaryLabel?: string
  secondaryHref?: string
  /** Three short facts under the buttons — years in business, jobs done, area
   *  covered. Numbers a stranger can check, not adjectives. */
  proof?: { value: string; label: string }[]
}) {
  return (
    <section className="[padding-block:calc(var(--pad-card-lg)*2)] [padding-inline:var(--pad-card-lg)]">
      {/* The headline and the line under it want DIFFERENT measures: a
          headline reads best short, running text at about 46 characters. One
          container capped at the headline's width broke the sub mid-phrase
          (「报价前先上门 / 看」), which is the kind of thing only a render
          shows. */}
      <div className="max-w-[62ch]">
        {eyebrow && (
          <p className="mb-3 [color:var(--color-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
            {eyebrow}
          </p>
        )}
        <h1 className="max-w-[24ch] [color:var(--color-paper)] [font-size:var(--text-hero)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-title)] [line-height:var(--leading-tight)] text-balance">
          {headline}
        </h1>
        {sub && (
          <p className="mt-4 max-w-[46ch] [color:var(--color-paper-dim)] [font-size:var(--text-lg)] [line-height:var(--leading-body)]">
            {sub}
          </p>
        )}
      </div>

      {(primaryLabel || secondaryLabel) && (
        <div className="mt-7 flex flex-wrap [gap:var(--gap-inline)]">
          {primaryLabel && (
            <a
              href={primaryHref || "#"}
              className="inline-flex min-h-11 items-center [background-color:var(--color-primary)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.6)] [transition-duration:var(--dur)] [transition-property:background-color] hover:[background-color:var(--color-primary-deep)]"
            >
              {primaryLabel}
            </a>
          )}
          {secondaryLabel && (
            <a
              href={secondaryHref || "#"}
              className="inline-flex min-h-11 items-center border [border-color:var(--color-ink-800)] [border-radius:var(--radius-control)] [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-medium)] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.6)] [transition-duration:var(--dur)] [transition-property:background-color] hover:[background-color:var(--color-ink-850)]"
            >
              {secondaryLabel}
            </a>
          )}
        </div>
      )}

      {proof && proof.length > 0 && (
        <dl className="mt-9 flex flex-wrap [gap:calc(var(--gap-stack)*2)]">
          {proof.map((p) => (
            <div key={p.label}>
              <dt className="[color:var(--color-paper)] [font-family:var(--font-numeric)] [font-size:var(--text-lg)] [font-variant-numeric:tabular-nums] [font-weight:var(--fw-semibold)]">
                {p.value}
              </dt>
              <dd className="mt-0.5 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
                {p.label}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

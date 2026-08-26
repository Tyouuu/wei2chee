import { MessageCircle } from "lucide-react"

/**
 * The WhatsApp button that follows you down the page.
 *
 * ── WHY IT EXISTS ────────────────────────────────────────────────────────
 *
 * Both Malaysian SME sites photographed on 2026-08-26 have one, bottom-right,
 * and so does roughly every local business site anyone in this market has
 * looked at. It is not a fashion: WhatsApp is how a customer here contacts a
 * shop, and a page that only offers it in the hero loses the visitor who
 * scrolled to the price list and decided halfway down.
 *
 * ── IT IS THE CUSTOMER'S NUMBER, NOT OURS ────────────────────────────────
 *
 * `lib/brand.ts`'s WHATSAPP_NUMBER is Formae's own and is still a placeholder
 * (founder-tasks 11). This has nothing to do with it. The number here belongs
 * to the business whose site this is, it comes from their own page data, and
 * the page never publishes with a placeholder in it -- see
 * publish-projection.ts, which is where that rule lives for every block.
 *
 * ── WHY IT IS A BLOCK AND NOT PAGE CHROME ────────────────────────────────
 *
 * Because the owner has to be able to delete it. A trade whose customers walk
 * in -- a kopitiam, a car wash -- does not want a chat button, and the whole
 * argument of `landsIn: null` in landing-templates.ts is that we already know
 * which trades those are. A block can be dragged out; chrome cannot.
 */
export function FloatingContact({
  number,
  label,
  message,
}: {
  /** As the owner writes it: 「012-345 6789」. */
  number: string
  /** The word on the button at wide sizes. On a phone only the icon shows --
   *  a pill wide enough for a word covers a price row on a 390px screen. */
  label?: string
  /** Pre-filled first message, so the owner is not opening a blank chat and
   *  guessing which page the person was on. */
  message?: string
}) {
  if (!number?.trim()) return null

  // wa.me wants digits only, and a Malaysian number written 012-345 6789 needs
  // the country code it never carries locally.
  const digits = number.replace(/[^\d]/g, "")
  const intl = digits.startsWith("60") ? digits : `60${digits.replace(/^0/, "")}`
  const href = `https://wa.me/${intl}${message ? `?text=${encodeURIComponent(message)}` : ""}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label || "WhatsApp"}
      /* `fixed`, and 24px in from the bottom-right on a phone rather than 16 --
         measured against the thumb rest, and against iOS Safari's own bottom
         bar, which eats the last 16px on scroll. */
      className="fixed right-5 bottom-6 z-40 inline-flex min-h-14 min-w-14 items-center justify-center gap-2 rounded-full [background-color:#25D366] [box-shadow:0_6px_20px_rgba(0,0,0,0.22)] [color:#fff] [padding-inline:1rem] [transition-duration:var(--dur)] [transition-property:transform] hover:scale-105"
    >
      <MessageCircle className="h-6 w-6 shrink-0" aria-hidden strokeWidth={2.2} />
      {/* THE ONE GREEN THIS PRODUCT DOES NOT LET THE PALETTE REPAINT.
          Every other colour on a customer's site is theirs. This one is
          WhatsApp's, and a WhatsApp button in somebody's brand colour stops
          being recognised as a WhatsApp button -- which is the entire reason
          it works. */}
      {label ? (
        <span className="hidden [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] @md:inline">
          {label}
        </span>
      ) : null}
    </a>
  )
}

import { WHATSAPP_NUMBER } from "@/lib/brand";
import { SampleContent } from "./sample-content";
import styles from "./style-scope.module.css";

export type StyleName = "ledger" | "hearth" | "blueprint";

const SCOPE_CLASS: Record<StyleName, string> = {
  ledger: styles.ledger,
  hearth: styles.hearth,
  blueprint: styles.blueprint,
};

/**
 * One column of the comparison: `<SampleContent />` wrapped in a container
 * scoped to exactly one of the three token sets (see style-scope.module.css
 * for why that scoping needs its own CSS Module rather than importing the
 * token files directly), plus a heading and the "pick this one" action.
 *
 * The selection action follows the identical `wa.me` deep-link pattern
 * `components/sections/conversion-cta.tsx` already uses on the main
 * acquisition page — same `WHATSAPP_NUMBER` constant (now shared via
 * `lib/brand`), same `https://wa.me/<number>?text=<encoded prefill>` shape.
 * No new selection mechanism was introduced for this page.
 */
export function StyleColumn({
  styleName,
  label,
  description,
  selectCta,
  whatsappPrefillText,
}: {
  styleName: StyleName;
  label: string;
  description: string;
  selectCta: string;
  /** Already-localized prefill text, e.g. "I'd like the Ledger style". */
  whatsappPrefillText: string;
}) {
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappPrefillText)}`;

  return (
    <div
      data-style={styleName}
      className={`${styles.scope} ${SCOPE_CLASS[styleName]} flex flex-col gap-6 rounded-2xl border p-5 [border-color:var(--color-ink-800)] sm:p-6`}
    >
      <div>
        <h2 className="text-[16px] tracking-[var(--tracking-title)] text-[color:var(--color-paper)] [font-weight:var(--fw-semibold)]">
          {label}
        </h2>
        <p className="mt-1 text-[13px] text-[color:var(--color-paper-dim)]">{description}</p>
      </div>

      <SampleContent />

      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={`style-picker-select-${styleName}`}
        className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-[13px] text-[color:var(--color-on-primary)] transition-colors [background-color:var(--color-primary)] [font-weight:var(--fw-semibold)] [transition-duration:var(--dur)] [transition-timing-function:var(--ease-out-quad)] hover:[background-color:var(--color-primary-deep)]"
      >
        {selectCta}
      </a>
    </div>
  );
}

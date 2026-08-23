import { WHATSAPP_NUMBER } from "@/lib/brand";
import { SampleContent } from "./sample-content";
import styles from "./style-scope.module.css";

export type StyleName =
  | "ledger"
  | "hearth"
  | "blueprint"
  | "bare"
  | "docket"
  // 2026-08-22. Three axes the first five do not use: type SCALE (大字),
  // header TREATMENT (印头), and a serif body (合约). See each token
  // file's own header for why it is a register and not another notch on
  // the density slider.
  | "large"
  | "stamp"
  | "contract"
  // 2026-08-22, and the first two that were not designed here: both are
  // uiprompt.site's own published briefs for Swiss Design and Soft UI,
  // rendered into the token layer. See each token file's header for the
  // brief's own words and for what makes it a register rather than a
  // repaint of one we already had.
  | "swiss"
  | "soft"
  // 2026-08-22, and the first one added because a MEASUREMENT said the set was
  // missing something rather than because a brief looked good. The ten
  // registers covered density, colour, radius and type and did not cover
  // WEIGHT: nothing had a border over 2px or a shadow visible from across the
  // room. See design-system/tokens/brut.css for the numbers.
  | "brut"
  // 墨 (Ink) -- the SPACE axis. Measured 2026-08-23: nothing in the set had a
  // pad-card above 24 or a row height above 56, so every register was a
  // normal-density business tool. This one is 40 and 76. It is also the only
  // register in the set drawn from a Chinese brief, for a product whose
  // customers are Chinese. See design-system/tokens/ink.css.
  | "ink"
  // The first register that is not a flat rectangle: translucent cards,
  // a real backdrop blur, and a ground with something to see through them.
  // See design-system/tokens/glass.css.
  | "glass"
  // The one that is not a white page. Canvas luminance across the other
  // thirteen ran 0.82-0.97 with nothing below it; a workshop, a studio or a
  // gym had no register that looked like them. See tokens/night.css.
  | "night"
  // The one you can feel. Thirteen registers were flat and 玻璃 was glass;
  // --surface-image had no register using it. See tokens/grain.css.
  | "grain"
  // Neither a white page nor a dark one. Luminance across the other fifteen
  // was 0.005 then a jump to 0.82 -- the whole middle was empty, and no
  // register had ever set --surface-border-style. See tokens/kraft.css.
  | "kraft"
  // The first register whose headings are set in a different face from its
  // body -- all sixteen before it declared one family for both. See
  // tokens/signboard.css.
  | "signboard"
  // The first register whose GROUND is a colour. Surface saturation across
  // the other seventeen ran 0.00-0.19 while accents ran 0.11-1.00: colour had
  // only ever been allowed on a button. See tokens/lacquer.css.
  | "lacquer"
  // Every character the same width. Nine body faces across the other
  // eighteen and all of them proportional. See tokens/code.css.
  | "code"
  // The first register whose ground is a repeating FIGURE rather than a
  // wash. --canvas-image had been set twice and both were gradients. See
  // tokens/tile.css.
  | "tile";

/**
 * Every register, in the order they are shown. THE list -- four separate copies
 * of it existed until 2026-08-22, and two of them were stale.
 *
 * The cost was not theoretical. `style-select`, the page a customer lands on
 * immediately after signing up to choose their register, offered eight. Swiss
 * and Soft had shipped, had token files, had a migration widening the database
 * constraint, appeared in the editor's own switcher and on the styles page --
 * and no new customer could pick either one, because this array was written out
 * by hand in five places and two of them were not updated. Found by looking at
 * the rendered picker, not by any test.
 *
 * `style-order.test.ts` now asserts this matches design-system/tokens/*.css on
 * disk, so a register whose file exists but which nobody can choose is a
 * failing test rather than a silent absence.
 */
export const STYLE_ORDER: StyleName[] = [
  "ledger",
  "hearth",
  "blueprint",
  "bare",
  "docket",
  "large",
  "stamp",
  "contract",
  "swiss",
  "soft",
  "brut",
  "ink",
  "glass",
  "night",
  "grain",
  "kraft",
  "signboard",
  "lacquer",
  "code",
  "tile",
];

const SCOPE_CLASS: Record<StyleName, string> = {
  ledger: styles.ledger,
  hearth: styles.hearth,
  blueprint: styles.blueprint,
  bare: styles.bare,
  docket: styles.docket,
  large: styles.large,
  stamp: styles.stamp,
  contract: styles.contract,
  swiss: styles.swiss,
  soft: styles.soft,
  brut: styles.brut,
  ink: styles.ink,
  glass: styles.glass,
  night: styles.night,
  grain: styles.grain,
  kraft: styles.kraft,
  signboard: styles.signboard,
  lacquer: styles.lacquer,
  code: styles.code,
  tile: styles.tile,
};

/**
 * One column of the comparison: `<SampleContent />` wrapped in a container
 * scoped to exactly one of the three token sets (see style-scope.module.css
 * for why that scoping needs its own CSS Module rather than importing the
 * token files directly), plus a heading and the "pick this one" action.
 *
 * The selection action has two modes, chosen by which prop the caller
 * passes:
 *
 * - No `onSelect`: the original public `/style-picker` page's behavior —
 *   a `wa.me` deep link, the identical pattern
 *   `components/sections/conversion-cta.tsx` uses on the main acquisition
 *   page (same `WHATSAPP_NUMBER` constant, shared via `lib/brand`, same
 *   `https://wa.me/<number>?text=<encoded prefill>` shape). Requires
 *   `whatsappPrefillText`.
 * - `onSelect` given: the portal's one-time style-selection step (Task 3)
 *   — a real `<button>` that calls it directly instead of a WhatsApp
 *   link. `whatsappPrefillText` isn't needed in this mode.
 */
/** The three 版式 as their designers paired them. This picker is on the
 *  acquisition site and exists to show what the three ARE; the 配色 layer is a
 *  choice a customer makes later, inside their own system, and offering thirty
 *  combinations to somebody who has not signed up yet is a longer decision, not
 *  a better one. */
const LAYOUT_CLASS: Record<StyleName, string> = {
  ledger: styles.ledger,
  hearth: styles.hearth,
  blueprint: styles.blueprint,
  bare: styles.bare,
  docket: styles.docket,
  large: styles.large,
  stamp: styles.stamp,
  contract: styles.contract,
  swiss: styles.swiss,
  soft: styles.soft,
  brut: styles.brut,
  ink: styles.ink,
  glass: styles.glass,
  night: styles.night,
  grain: styles.grain,
  kraft: styles.kraft,
  signboard: styles.signboard,
  lacquer: styles.lacquer,
  code: styles.code,
  tile: styles.tile,
};

export function StyleColumn({
  styleName,
  label,
  description,
  selectCta,
  whatsappPrefillText,
  onSelect,
  recommendedLabel,
}: {
  styleName: StyleName;
  label: string;
  description: string;
  selectCta: string;
  /** Already-localized prefill text, e.g. "I'd like the Ledger style". Required when onSelect is not given. */
  whatsappPrefillText?: string;
  /** When given, renders a real button calling this instead of a WhatsApp link -- used by the portal's style-selection step, not the public comparison page. */
  onSelect?: () => void;
  /** Already-localized badge text, shown only on the one column recommended for
   * this business (industries.style_recommendation). Omitted on the other two.
   * Before this the customer was asked to make an irreversible choice between
   * three unfamiliar names with no guidance at all -- the product already knew
   * which one suits their industry and simply never said so. */
  recommendedLabel?: string;
}) {
  const whatsappHref = whatsappPrefillText
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappPrefillText)}`
    : undefined;

  // Blueprint is the one style whose differentiation from Ledger depends on
  // texture, not just token values (see design-system/tokens/blueprint.css's
  // own file comment — canvas/primary/paper hue distance from Ledger tops
  // out under 9°, too small to carry the difference alone). The drafting
  // grid and sheet-marks corner ticks go on this column's own container
  // (the "sheet" itself); the annotation mono-label voice goes on the style
  // label below, which is style-column.tsx's own content — never on
  // <SampleContent />, which must render identically in all three columns.
  const isBlueprint = styleName === "blueprint";

  return (
    <div
      data-style={styleName}
      className={[
        styles.scope,
        LAYOUT_CLASS[styleName],
        isBlueprint ? `relative ${styles.blueprintGrid} ${styles.blueprintSheetMarks}` : null,
        "flex flex-col [gap:var(--gap-stack)] [border-radius:var(--radius-lg)] [border-width:var(--border-card-width)] [border-style:solid] [box-shadow:var(--shadow-card)] [padding:var(--pad-card-lg)] [border-color:var(--color-ink-800)] [background-color:var(--color-ink-900)]",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div>
        <h2
          className={
            isBlueprint
              ? styles.blueprintAnnotation
              : "[font-size:var(--text-lg)] tracking-[var(--tracking-title)] text-[color:var(--color-paper)] [font-weight:var(--fw-display)]"
          }
        >
          {label}
        </h2>
        {recommendedLabel ? (
          <span className="mt-2 inline-flex items-center [border-radius:var(--radius-pill)] [padding-inline:var(--pad-control-x)] [padding-block:calc(var(--pad-control-y)/2)] [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-size:var(--text-micro)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
            {recommendedLabel}
          </span>
        ) : null}
        <p className="mt-1 [font-size:var(--text-sm)] text-[color:var(--color-paper-dim)]">{description}</p>
      </div>

      <SampleContent />

      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          data-testid={`style-picker-select-${styleName}`}
          className="inline-flex items-center justify-center [border-radius:var(--radius-control)] [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [font-size:var(--text-sm)] text-[color:var(--color-on-primary)] transition-colors [background-color:var(--color-primary)] [font-weight:var(--fw-semibold)] [transition-duration:var(--dur)] [transition-timing-function:var(--ease-out-quad)] hover:[background-color:var(--color-primary-deep)]"
        >
          {selectCta}
        </button>
      ) : (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`style-picker-select-${styleName}`}
          className="inline-flex items-center justify-center [border-radius:var(--radius-control)] [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [font-size:var(--text-sm)] text-[color:var(--color-on-primary)] transition-colors [background-color:var(--color-primary)] [font-weight:var(--fw-semibold)] [transition-duration:var(--dur)] [transition-timing-function:var(--ease-out-quad)] hover:[background-color:var(--color-primary-deep)]"
        >
          {selectCta}
        </a>
      )}
    </div>
  );
}

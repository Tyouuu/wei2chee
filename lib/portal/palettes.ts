import styles from "@/app/[locale]/style-picker/style-scope.module.css";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { PALETTE_ROWS, type PaletteRow } from "./palettes.generated";

/**
 * The 配色 layer: a customer's colours, chosen separately from their 版式.
 *
 * WHY THE SPLIT EXISTS. A "style" was always two decisions wearing one name.
 * Measured across the three token files, 52 of ~125 tokens are STRUCTURE (type
 * scale, weights, tracking, radii, padding, row heights, shadows) and 75 are
 * COLOUR. Structure is what took the design work, which is why there were three
 * styles and not thirty. Colour is data.
 *
 * So Ledger / Hearth / Blueprint keep their meaning and become the 版式, and
 * this is the other half. Twenty-one layouts times twenty-five palettes is
 * five hundred and twenty-five looks; twenty-two of the twenty-five came from
 * tweakcn (Apache-2.0) via scripts/build-palettes.mjs and three are written in
 * that generator by hand, for hue bands their forty themes do not occupy.
 *
 * HOW IT WORKS, AND THE ONE THING THAT MAKES IT WORK. A palette class and a
 * layout class are both single class selectors, so they carry identical
 * specificity -- whichever appears LAST in the stylesheet wins the tokens they
 * both declare. scripts/build-style-scope.mjs emits palettes after layouts, so
 * a palette overrides the colours and touches nothing else. Verified in a
 * browser on the same element before any of this shipped:
 *
 *   ledger    + supabase   primary green   radius 3px   text 12px   row 32px
 *   blueprint + supabase   primary green   radius 8px   text 13px   row 42px
 *   blueprint + mocha      primary brown   radius 8px   text 13px   row 42px
 *
 * The shadcn contract each token file carries (`--background: var(--color-canvas)`)
 * is aliases rather than values, so it follows the palette automatically. That
 * bridge was built to let shadcn components IN; this is the same door used the
 * other way.
 */
/**
 * WHY THIS IS DERIVED AND NOT WRITTEN OUT.
 *
 * This union and the PALETTES array below used to be typed by hand: ten keys,
 * ten labels and forty swatch values, kept in step with a directory of
 * generated CSS by nothing but attention. When the set grew to twenty-five the
 * generator started emitting the list instead -- and the reason is not the
 * arithmetic, it is that two of the ten hand-written labels described the wrong
 * colour. tweakcn's `ocean-breeze` has a GREEN primary at hue 150 and shipped
 * here for months as 海蓝, sea blue; `clean-slate` is a saturated indigo at
 * chroma 0.204, not the 石板灰 it was called. No test could have caught either,
 * because the hand-written list was the only statement of what the colour was.
 *
 * Now the file that computes the colours writes the list, and the swatches are
 * read out of the palette rather than picked to resemble it.
 */
export type PaletteName = (typeof PALETTE_ROWS)[number]["key"];

export type Palette = PaletteRow;

/**
 * Mirrors the filenames in design-system/palettes/ and the check constraint in
 * migration 20260823120000. All three must agree: a name here with no CSS class
 * renders the layout's native colours and reports nothing, which is a silently
 * wrong system rather than a broken one. style-scope.sync.test.ts checks it.
 */
export const PALETTES: Palette[] = PALETTE_ROWS;

export const PALETTE_BY_KEY: Record<string, Palette> = Object.fromEntries(
  PALETTES.map((p) => [p.key, p]),
);

/** Layout class names, unchanged. */
const LAYOUT_CLASS: Record<StyleName, string> = {
  ledger: styles.ledger,
  hearth: styles.hearth,
  blueprint: styles.blueprint,
  stamp: styles.stamp,
  swiss: styles.swiss,
  soft: styles.soft,
  brut: styles.brut,
  glass: styles.glass,
  night: styles.night,
  signboard: styles.signboard,
  lacquer: styles.lacquer,
  code: styles.code,
  tile: styles.tile,
  pop: styles.pop,
  console: styles.console,
  counter: styles.counter,
};

/**
 * CSS Modules camel-cases hyphenated class names in the generated types, so a
 * palette file's `.paletteAmberMinimal` is reached as `styles.paletteAmberMinimal`
 * -- the generator writes the class camel for exactly this reason. Looking it
 * up from the kebab key here keeps the two spellings in one place instead of
 * spread across seven call sites.
 */
const paletteClass = (key: string | null | undefined): string => {
  if (!key) return "";
  const camel =
    "palette" + key.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
  return (styles as Record<string, string>)[camel] ?? "";
};

/**
 * The className a customer's system renders under: their 版式 and, when they
 * chose one, their 配色.
 *
 * Every surface that shows a customer's own pages calls this -- the editor, the
 * home gallery, the library, the templates, the styles page and the founder's
 * console. Seven call sites used to each keep their own `SCOPE_CLASS` map, and
 * seven copies of a mapping is seven chances for one of them to miss a layer
 * and quietly render somebody's system in the wrong colours.
 */
export function scopeClasses(style: StyleName, palette?: string | null): string {
  return [styles.scope, LAYOUT_CLASS[style], paletteClass(palette)].filter(Boolean).join(" ");
}

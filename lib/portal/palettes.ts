import styles from "@/app/[locale]/style-picker/style-scope.module.css";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

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
 * this is the other half. Three layouts times ten palettes is thirty looks, and
 * the ten came from tweakcn (Apache-2.0) via scripts/build-palettes.mjs rather
 * than from a designer.
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
export type PaletteName =
  | "supabase"
  | "vercel"
  | "claude"
  | "amber-minimal"
  | "nature"
  | "ocean-breeze"
  | "vintage-paper"
  | "clean-slate"
  | "mocha-mousse"
  | "graphite";

export type Palette = {
  key: PaletteName;
  /** What the customer sees. Their word, not tweakcn's. */
  label: string;
  blurb: string;
  /** Four values for the swatch row, in the order canvas / primary / a mid /
   *  a light. Hand-picked from the generated file so a card can show the
   *  palette without mounting a whole rendered sample -- which is what
   *  21st.dev's Themes grid does, and the only part of their approach that
   *  fits a page listing thirty options. */
  dots: [string, string, string, string];
};

/**
 * Mirrors the filenames in design-system/palettes/ and the check constraint in
 * migration 20260821050000. All three must agree: a name here with no CSS class
 * renders the layout's native colours and reports nothing, which is a silently
 * wrong system rather than a broken one. style-scope.sync.test.ts checks it.
 */
export const PALETTES: Palette[] = [
  { key: "supabase", label: "青绿", blurb: "干净的绿，像后台工具", dots: ["#fcfcfc", "#1c7c54", "#d9e5df", "#f0f4f2"] },
  { key: "vercel", label: "极简黑", blurb: "黑白灰，没有多余颜色", dots: ["#fcfcfc", "#000000", "#d4d4d4", "#efefef"] },
  { key: "claude", label: "陶土", blurb: "暖橙陶土，柔和不刺眼", dots: ["#faf9f7", "#a8532b", "#e0d5c8", "#f0e9e0"] },
  { key: "amber-minimal", label: "琥珀", blurb: "琥珀黄，账本和单据的感觉", dots: ["#fefefe", "#8a5a0b", "#e8d5a8", "#f5ecd8"] },
  { key: "nature", label: "森绿", blurb: "深绿配米白，沉稳", dots: ["#f8f7f2", "#3d5a3d", "#c8d4c0", "#e5ebe0"] },
  { key: "ocean-breeze", label: "海蓝", blurb: "浅海蓝，清爽", dots: ["#f7fafc", "#1a6b8a", "#c4dae5", "#e2eef4"] },
  { key: "vintage-paper", label: "旧纸", blurb: "泛黄纸张，老字号的味道", dots: ["#f5f0e4", "#8a6a3a", "#ddd0b8", "#ebe3d2"] },
  { key: "clean-slate", label: "石板灰", blurb: "冷灰蓝，中性专业", dots: ["#f8fafc", "#4a5568", "#cbd5e0", "#e2e8f0"] },
  { key: "mocha-mousse", label: "可可", blurb: "深棕奶咖，温暖厚重", dots: ["#f2e8e0", "#7a4a35", "#d6bfae", "#e6d5c8"] },
  { key: "graphite", label: "石墨", blurb: "纯灰阶，让数据自己说话", dots: ["#fafafa", "#3f3f3f", "#c9c9c9", "#e4e4e4"] },
];

export const PALETTE_BY_KEY: Record<string, Palette> = Object.fromEntries(
  PALETTES.map((p) => [p.key, p]),
);

/** Layout class names, unchanged. */
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

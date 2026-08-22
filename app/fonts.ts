/**
 * Every webfont this product declares, in one module.
 *
 * WHY IT IS NOT IN A LAYOUT. There are now TWO root layouts: `app/[locale]` for
 * everything Formae shows a business owner, and `app/s` for a customer's own
 * published website, which is read by strangers and must not carry our locale
 * prefix (see proxy.ts). Both need the same `--font-*` variables, because both
 * mount design-system components and every register binds its own face. Two
 * copies of this list is two places for a register's font to be missing from,
 * and the symptom -- one page silently falling back to the system sans -- is
 * exactly the class of bug this codebase keeps finding by eye rather than by
 * test.
 *
 * next/font requires module scope, which a module gives it.
 */
import {
  Archivo,
  Geist,
  Geist_Mono,
  IBM_Plex_Sans,
  Instrument_Serif,
  Bricolage_Grotesque,
  Manrope,
  Noto_Sans_SC,
  Noto_Serif_SC,
  Nunito,
  Plus_Jakarta_Sans,
  Public_Sans,
} from "next/font/google";

// Latin-only webfonts, composed with system CJK fallbacks in globals.css'
// --font-sans/--font-serif so Chinese text uses the OS's own (already good)
// CJK fonts instead of shipping a multi-MB CJK webfont subset.
//
// Instrument Serif is the display voice: very high stroke contrast, narrow,
// almost no tracking needed at large sizes — it reads as typeset rather than
// rendered, which is the whole difference at Hero scale. Single 400 weight by
// design (the face carries its weight through contrast, not mass).
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif-latin",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans-latin",
  display: "swap",
});

// The draughtsman's hand — margin annotations, section indices, workflow nodes.
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono-latin",
  display: "swap",
});

// Per-style display faces. Until 2026-08-20 all three design-system styles
// (design-system/tokens/{ledger,hearth,blueprint}.css) shared one font stack,
// which is a large part of why they were indistinguishable to a customer
// comparing them side by side -- see docs/formae-product-direction.md sec 9.
// Each style now binds its own --font-ui; these are the Latin halves, composed
// with the same system CJK fallbacks as --font-sans above.

// Ledger's voice: a slightly condensed grotesque that carries real weight at
// display sizes. Matches how construction/ops software actually looks
// (Procore's heavy condensed headings) rather than a neutral SaaS sans.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-industrial-latin",
  display: "swap",
});

// Hearth's voice: rounded terminals, geometric skeleton, tall x-height -- the
// friendly register beauty/salon/education software runs in (Fresha).
const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-rounded-latin",
  display: "swap",
});

// Bare's voice: geometric skeleton with humanist proportions and slightly
// quirky terminals. Chosen for a style that has taken every box away -- with
// no card, no border and no shadow doing any work, the typeface is the design,
// so a neutral grotesque would leave the page looking unfinished rather than
// spare.
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-bare-latin",
  display: "swap",
});

// Docket's voice: IBM Plex Sans was drawn for IBM's own business documents --
// forms, invoices, technical paperwork -- which is precisely the object this
// style is imitating. Its slab-ish terminals and squared bowls read as printed
// rather than rendered.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-docket-latin",
  display: "swap",
});

// Swiss's voice: a neo-grotesque in the Helvetica/Univers line, which is the
// face the International Typographic Style was actually set in. Public Sans is
// the closest one Google serves -- drawn for US government forms, so it is
// built for exactly the job this register does: dense factual information that
// has to be unambiguous. Deliberately not Inter, which is the face every
// generated design reaches for first.
const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-swiss-latin",
  display: "swap",
});

// Soft's voice: geometric with softened terminals and a tall x-height. Nunito
// is already Hearth's, and putting the two rounded registers on the same face
// would undo the only reason to have both.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-soft-latin",
  display: "swap",
});

// 粗野's voice. Bricolage Grotesque is the face this look is actually drawn in
// -- irregular widths, a slightly wrong-on-purpose skeleton, and real 800/900
// weights, which no other face here has. The other nine registers all top out
// at 700, and a 3px black stroke around 600-weight type reads as a mistake
// rather than as a decision.
//
// Deliberately not Space Grotesk, which is the face every generated "brutalist"
// page reaches for and would make this register look copied rather than
// chosen.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-brut-latin",
  display: "swap",
});

// CJK, and why this file's original "Latin-only webfonts" rule now has two
// exceptions.
//
// That rule was right about the cost and wrong about the consequence. Every
// style bound its own LATIN face -- Archivo, Nunito, Geist -- and none of them
// has a single Chinese glyph, so all three fell back to the same
// "PingFang SC", "Microsoft YaHei". A customer's system is about ninety per
// cent Chinese: 报价单, 客户, 金额, 已确认. The style layer was differentiating
// the ten per cent that is Latin and leaving the ninety identical, which is
// the whole reason Ledger and Blueprint were indistinguishable side by side.
//
// The cost is not what "multi-MB CJK webfont" suggests. Google serves these
// split by unicode-range into ~100 files; a browser downloads only the blocks
// whose characters are on the page, and caches them across the whole site.
// `preload: false` is essential -- with preloading on, Next injects a link tag
// for every block in the declared subset, which IS the multi-MB download the
// original rule feared.
//
// Only two, deliberately. Hearth stays on the system font because that is the
// coherent answer for the register it is in: 「宽松·温和、好读」 is best served
// by the face the customer's own machine already renders everything else in.
const notoSerifSC = Noto_Serif_SC({
  // No `subsets`. Next's generated types only name the Latin-script subsets for
  // these families, because Google delivers the CJK blocks through
  // unicode-range rather than as a named subset. `subsets` controls PRELOADING
  // only, and preloading is exactly what must not happen here.
  weight: ["400", "600"],
  variable: "--font-song-cjk",
  display: "swap",
  preload: false,
});

const notoSansSC = Noto_Sans_SC({
  weight: ["400", "500", "700"],
  variable: "--font-hei-cjk",
  display: "swap",
  preload: false,
});


/** Every font variable, ready for a root layout's <html className>. */
export const fontVariables = [
  instrumentSerif.variable,
  geist.variable,
  geistMono.variable,
  archivo.variable,
  nunito.variable,
  manrope.variable,
  plexSans.variable,
  publicSans.variable,
  jakarta.variable,
  bricolage.variable,
  notoSerifSC.variable,
  notoSansSC.variable,
].join(" ");

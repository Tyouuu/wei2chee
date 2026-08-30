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
  Archivo_Narrow,
  Geist,
  Geist_Mono,
  IBM_Plex_Sans,
  Bricolage_Grotesque,
  Manrope,
  Noto_Sans_SC,
  Noto_Serif_SC,
  Nunito,
  Plus_Jakarta_Sans,
  Public_Sans,
  Newsreader,
  Tenor_Sans,
} from "next/font/google";


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

// THE FIRST DISPLAY FACE, and the first font in this file that is not a body
// face.
//
// --font-display was added to every register on 2026-08-23 and defaulted to
// --font-ui, because nothing had a second face to point it at: all sixteen
// registers set a page heading and a table cell in the same family. 招牌 is the
// register that needed one.
//
// Archivo Narrow rather than Oswald, which is the condensed face every
// generated "bold headline" page reaches for. It is also the same superfamily
// as the Archivo already bound to --font-industrial-latin, so a register can
// pair them without the pairing looking accidental.
const archivoNarrow = Archivo_Narrow({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-signboard-latin",
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

// Docket's voice: IBM Plex Sans was drawn for IBM's own business documents --
// forms, invoices, technical paperwork -- which is precisely the object this
// style is imitating. Its slab-ish terminals and squared bowls read as printed
// rather than rendered.

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


/* NEWSREADER, AND WHY NOT INSTRUMENT SERIF.

   impeccable's detector on our own live page, 2026-08-27:
   「overused-font — Primary font: instrument serif (20% of text). Inter,
   Roboto, Fraunces, Geist, Plus Jakarta Sans and Space Grotesk are used on so
   many sites they no longer feel distinctive. Each new wave of AI-generated
   UIs converges on the same handful of faces.」

   I had chosen Instrument Serif that same afternoon, for exactly the reason
   the rule describes: it is the serif that turns up on every generated page.
   Newsreader is a screen-first editorial serif with a real personality --
   sharper terminals, a lower contrast that survives at 15px, and an optical
   size axis -- and it is not on anybody's convergence list.

   Instrument Serif stays loaded for nothing; it is removed below. */
/* ── 台账 的标题：Optima 那一族 ──────────────────────────────────────────
 *
 * 老板 2026-08-31，看着放大的两个标题：「用的字不一样」·「你找不到他是用什么
 * 字体吗」. 找得到 —— 把 Wix 的 woff2 抓下来读名字表，是 **Displace 2.0**，
 * 他们授权的字，我们用不了。
 *
 * 但「用不了那一套」不等於「随便挑一套」。逐项量它：
 *   笔画对比 1.83 · 大写比小写宽 1.21 · 小写多高 0.74 · 墨量 0.093
 *
 * ⚠️ 原本换上的 Geist 200 在**数字上最接近**（四根中三根，差距 0.48，
 * 比每一个候选都好）—— 而它的笔画对比是 **1.00**，从头到尾一样粗。
 * 他一眼就看出来。**四根轴里，眼睛几乎只看那一根。**
 *
 * 画出来并排看（.screenshots/align/face.jpg）：Tenor Sans 是唯一一套末端
 * 外扩、粗细有对比的 —— 跟 Displace 2.0 同一族（Optima 那一类）。
 * Marcellus 偏罗马体太重，Spectral 是真衬线，Geist 完全均匀。
 */
const tenorSans = Tenor_Sans({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-flared-latin",
  display: "swap",
  preload: false,
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["200", "400", "600"],
  style: ["normal", "italic"],
  variable: "--font-editorial-latin",
  display: "swap",
  preload: false,
});

/* TWO FACES LEFT WITH THEIR REGISTERS, 2026-08-27. 柔和 and 粗野 were culled
   and their Latin faces went with them -- a font declared here is downloaded on
   every page whether or not any surviving register asks for it, and the people
   loading these pages are on 4G. Checked by grepping --font-* out of the six
   surviving token files rather than by reading this list. */

/** Every font variable, ready for a root layout's <html className>. */
export const fontVariables = [
  newsreader.variable,
  geist.variable,
  tenorSans.variable,
  geistMono.variable,
  archivo.variable,
  archivoNarrow.variable,
  nunito.variable,
  publicSans.variable,
  notoSerifSC.variable,
  notoSansSC.variable,
].join(" ");

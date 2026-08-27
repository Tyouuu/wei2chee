/**
 * Pulls colour palettes from tweakcn and writes them as design-system palettes.
 *
 * WHY THIS EXISTS
 *
 * A customer could pick from three styles. Each is a complete look -- Ledger is
 * tight/sharp/rust, Hearth is loose/round/teal, Blueprint is precise/technical/
 * blue -- and each took real design work, which is why there were three and not
 * thirty. The founder has asked repeatedly how to get 21st.dev's sense of
 * variety without being a marketplace.
 *
 * The answer is that a "style" is two decisions wearing one name. Measured on
 * the three token files: 52 of the ~125 tokens are STRUCTURE (type scale,
 * weights, tracking, radii, padding, row heights, shadows) and 75 are COLOUR.
 * Structure is what took the design work. Colour is data.
 *
 * So the three stay exactly as they are and become the 版式 -- and a palette is
 * a file that overrides only the colour half. 3 layouts x N palettes.
 *
 * WHY IT ONLY HAS TO SET 28 TOKENS
 *
 * The shadcn contract added to each token file on 2026-08-21 (`--background:
 * var(--color-canvas)` and the rest) is aliases, not values. Both classes land
 * on the same element, so an alias declared in `.ledger` resolves against
 * whatever `--color-canvas` is at use time -- which is the palette's. Setting
 * the 28 colour tokens components actually read is therefore enough to carry
 * the entire contract with it. That bridge was built to let shadcn components
 * IN; this is the same door used in the other direction.
 *
 * WHY THE CONTRAST GATE IS NOT OPTIONAL
 *
 * tweakcn's palettes are designed against shadcn's own components. The roles
 * line up with ours, but nothing guarantees that a given theme's
 * muted-foreground clears AA on its own card, and a palette that ships an
 * unreadable table is worse than having three styles. Every candidate is
 * measured with the WCAG relative-luminance formula on all three of its own
 * surfaces and DROPPED if it fails. The report says which and why.
 *
 * Source: https://tweakcn.com/r/themes/{name}.json -- jnsahaj/tweakcn,
 * Apache-2.0. Values are copied, not derived; the attribution is written into
 * every generated file.
 *
 *   node scripts/build-palettes.mjs           # regenerate
 *   node scripts/build-palettes.mjs --check   # fail if the output is stale
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "design-system", "palettes");

/**
 * The palettes offered, and why each one earns a slot.
 *
 * WHY THERE ARE NOW TWENTY-SIX AND NOT TEN. The first ten were picked to be
 * far apart from each other, and by their own measure they were -- but the
 * measure was never taken. Run on 2026-08-23, the ten primaries land on these
 * oklch hues:
 *
 *     achromatic x2 · 39 · 44 · 65 · 70 · 144 · 149 · 160 · 277
 *
 * Eight chromatic palettes, six of them inside a 30-degree band of
 * orange-to-amber and a 16-degree band of green. NO RED. No pink. No cyan. One
 * blue-violet standing in for the entire cool half of the wheel. A customer
 * opening the picker saw ten cards that were, colorimetrically, four choices.
 *
 * RED IS THE ONE THAT MATTERS MOST HERE. It is on the signboard of most
 * Chinese-Malaysian businesses, on every CNY promotion, and on the shopfront of
 * the 茶餐室 and 中药行 and 婚宴 caterers this product is for. Having none was
 * not restraint, it was an oversight the set could not see because nothing
 * measured it.
 *
 * The sixteen added below are chosen by that gap map -- each one is the best
 * available occupant of a hue band the set did not have. tweakcn publishes
 * forty; the fourteen not taken are either within 15 degrees of something
 * already here at similar chroma (cosmic-night, bold-tech, violet-bloom and
 * claymorphism all sit on clean-slate's violet) or are a look no Malaysian SME
 * would put in front of a customer (doom-64, cyberpunk, retro-arcade).
 *
 * The pairwise hue spread is now reported by the generator, so the next person
 * adding one can see whether it is a new colour or a fifth orange. It earned
 * its keep on the first run: of the twenty-six candidates it flagged four that
 * were another palette in a different name, and they are not in this list --
 *
 *     sunset-horizon  H 35 C 0.164   against tangerine       H 36 C 0.172
 *     solar-dusk      H 49 C 0.145   against claude          H 39 C 0.138
 *     ocean-breeze    H150 C 0.192   against northern-lights H150 C 0.154
 *     midnight-bloom  H283 C 0.202   against clean-slate     H277 C 0.204
 *
 * and it caught two names that were simply false. tweakcn's `ocean-breeze` has
 * a GREEN primary at hue 150; it shipped here for months labelled 海蓝, sea
 * blue. `clean-slate` is a saturated indigo at C 0.204, not the 石板灰 it was
 * called. A customer choosing 海蓝 for a boat business got a green system.
 *
 * WHAT tweakcn CANNOT SUPPLY. After the pruning three bands are still empty --
 * around hue 180 (true teal), 90 (olive gold) and 320 (plum) -- and no theme in
 * their forty occupies any of them. Those three are written by hand in NATIVE
 * below and go through this same pipeline: same repairs, same gates, same
 * derived navigation. A public registry covers what a public registry covers;
 * the gaps are the part that has to be designed.
 */
/*
  EIGHT, NOT TWENTY-FIVE — AND THE MEASUREMENT THAT DECIDED IT.

  The founder, 2026-08-26: 「风格配色的部分我反而觉得不会有人会选很花哨的颜色 你看
  大多数的system都是白色跟黑色居多 不会出现红色啊 绿色啊 然后主题配色的选择也是要选
  几套多人会选的 就好了」.

  The rule that settles it is his own point 12: the library exists to SAVE HIM
  TIME. A palette nobody picks is not one more choice, it is one more thing to
  scroll past — twenty-five times, on the screen where an owner is deciding
  whether to pay.

  SO I WENT AND MEASURED WHAT REAL BUSINESS SOFTWARE ACTUALLY USES. Nine
  systems opened with a browser on 2026-08-26, ground and primary read off the
  live page (.screenshots/colours/):

    Linear         near-black ground   #5E6AD2  indigo   H~275
    Stripe         white               #533AFD  violet   H~285
    Xero           white               #1F65D6  blue     H~260
    Notion         white               #0075DE  blue     H~250
    monday         white               #6161FF  indigo   H~278
    SQL Account    white               #6632FF  violet   H~285   (Malaysia)
    AutoCount      white               #00A8E6  cyan     H~230   (Malaysia)
    FreshBooks     white               #038A06  green    H~145
    Zoho Books     white               #F5BA31  amber    H~85

  NINE OF NINE grounds are neutral — white, or Linear's near-black. Not one is
  tinted. He is exactly right about that, and our set already agrees: 24 of our
  25 grounds sit at oklch L 0.880–1.000, C 0.000–0.053.

  NINE OF NINE accents are a saturated colour. Not one is grey or black. So the
  half of his sentence that says 不会出现红色啊 绿色啊 is about the GROUND, not
  the accent — and I have to say so rather than quietly agree, because acting on
  the wrong half would produce twenty-five identical white rectangles.

  SEVEN OF NINE accents fall in hue 230–290, blue through violet — including
  BOTH Malaysian systems, which is the market this product sells into. Our 25
  spread evenly around the whole hue circle. That is a paint chart, not a set of
  system palettes, and it is the actual defect.

  WHAT SURVIVES, and the one reason each one does. Every dropped trade lands on
  a survivor; see the migration for the map.

    极简黑    the neutral default, and what 7 of 9 grounds plus a black accent
              already look like. This is the one most owners should end on.
    标准蓝    the single most common accent in real business software. Xero,
              Notion, monday and Linear all live within 25° of it.
    群青      the violet end of that same band — Stripe, monday, SQL Account.
    朱红      the one the market data does NOT explain and the market itself
              does: a Malaysian 老字号 signboard is red and gold. 中药行, 餐饮,
              婚宴 recognise it as theirs.
    橘        a trade signboard colour: 五金, 物流, 工程.
    森绿      FreshBooks is green; 环保, 健康, 农产 read it immediately.
    琥珀      Zoho Books is amber; 会计, 当铺, 金行.
    紫檀      the one soft-trade cluster that genuinely exists here — 美容,
              婚纱, 花艺. Kept as ONE entry rather than the four it was.

  WHAT GOES, AND WHY IT IS NOT A LOSS. 石墨 is a second neutral next to 极简黑.
  正红 sits 2° from 朱红. 陶土 sits 3° from 橘. 天蓝 and 靛 sit between 标准蓝 and
  群青. 松石 and 湖水 are 17° apart from each other. 桃粉, 胭脂, 紫晶 are three
  readings of one pink. Nobody choosing a system for a renovation company picks
  桃粉 — and every minute spent not picking it is a minute the library cost him.
*/
const WANTED = [
  // ── neutral: the default ────────────────────────────────────────────────
  ["vercel", "极简黑", "黑白灰,没有一点多余颜色", "任何行业·最稳的一套",
   "Ink", "Black, white, grey. Not one colour more.", "Any trade · the safe one"],

  // ── the band real business software actually occupies ───────────────────
  ["modern-minimal", "标准蓝", "最常见的软件蓝,不会出错", "一般服务·教育·中介·科技·水电冷气",
   "Standard Blue", "The blue most business software uses. Hard to get wrong.",
   "Services · education · agencies · tech · aircon & plumbing"],
  ["clean-slate", "群青", "饱和的蓝紫,现代", "顾问·工程·设计·活动·律师·会计",
   "Ultramarine", "Saturated blue-violet. Modern.",
   "Consulting · engineering · design · events · law · accounting"],

  // ── the signboard colours, which are this market and not Silicon Valley ─
  ["elegant-luxury", "朱红", "深红配奶油底,老字号的正式红", "餐饮·中药行·婚宴·礼品·零售",
   "Vermilion", "Deep red on cream. The formal red of an old shop.",
   "F&B · herbal medicine · weddings · gifts · retail"],
  ["tangerine", "橘", "饱和的橘色,看得远", "物流·搬运·五金·工程·装修",
   "Tangerine", "Saturated orange. Visible from far away.",
   "Logistics · movers · hardware · trades · renovation"],
  ["amber-minimal", "琥珀", "琥珀黄,账本和单据的感觉", "会计·当铺·金行·米粮·土产",
   "Amber", "Amber yellow. Ledgers and receipts.",
   "Accounting · pawnshops · goldsmiths · grain · local produce"],
  ["nature", "森绿", "深绿配米白,沉稳", "环保·林业·户外·农产·诊所·健康",
   "Forest", "Deep green on off-white. Steady.",
   "Environment · forestry · outdoors · farming · clinics · wellness"],
  ["rosewood", "紫檀", "沉的梅紫,不是粉红", "美容·婚纱·花艺·精品·养生",
   "Rosewood", "A deep plum. Not pink.",
   "Beauty · bridal · florists · boutiques · wellness"],

  /* ── 2026-08-27: three the founder asked for, chosen by LOOKING ──────────
     All 42 themes in tweakcn's registry rendered as swatches and looked at
     (.screenshots/themes42/sheet.jpg), then filtered by his two rules: the
     ground is neutral, and a Malaysian SME owner would actually pick it.

     Twenty were ruled out on sight as novelty -- doom-64, cyberpunk, candyland,
     bubblegum, neo-brutalism, claymorphism, retro-arcade and the rest. Of what
     remained, most duplicated a hue we already carry: solar-dusk and darkmatter
     are amber and tangerine again, northern-lights and ocean-breeze are 森绿
     again, mono and graphite are 极简黑 again.

     These three are the ones that add a hue the library did not have. */
  ["caffeine", "咖啡", "深咖啡色,烘焙和木头的颜色", "咖啡店·面包·茶行·家私·木工",
   "Coffee", "Deep coffee brown. Roasting and timber.",
   "Cafes · bakeries · tea · furniture · carpentry"],
  ["starry-night", "藏青", "沉的深蓝,不是亮蓝", "会计·律师·工程·验屋·保险",
   "Navy", "A deep, serious blue. Not a bright one.",
   "Accounting · law · engineering · surveying · insurance"],
  ["sage-garden", "艾绿", "带灰的柔绿,安静", "养生·spa·诊所·花艺·有机",
   "Sage", "A muted grey-green. Quiet.",
   "Wellness · spa · clinics · florists · organic"],

  /* The lightness axis. See NATIVE.midnight for the twelve measurements that
     say this was the hole -- every other palette is a near-white ground. */
  ["midnight", "深夜", "近黑的底,唯一一套深色的", "排班·监控·夜间营业·车厂·保安",
   "Midnight", "A near-black ground. The only dark one.",
   "Shift work · monitoring · late openings · workshops · security"],

  // ── the one the popularity data added; see NATIVE.zen for the numbers ───
  ["zen", "宣纸", "暖纸底配墨黑,唯一一套不是白底的", "茶行·药材·古董·手作·咖啡·民宿",
   "Rice Paper", "Ink on warm paper. The only one that is not white.",
   "Tea · herbs · antiques · craft · coffee · guesthouses"],
];


/**
 * THE THREE tweakcn HAS NO ANSWER FOR.
 *
 * After pruning, the hues that remain leave three real holes -- around 90
 * (olive gold), 186 (true teal) and 325 (plum). None of tweakcn's forty themes
 * occupies any of them: their set is built by and for people shipping developer
 * tools, and it is heavy on indigo and light on the colours a goldsmith, an
 * air-conditioning contractor or a bridal shop would recognise as theirs.
 *
 * These are written in the same shape a tweakcn theme arrives in, so they go
 * through the identical pipeline below -- same contrast repairs, same status
 * gate, same derived navigation. There is one code path, not two.
 *
 * Each one's chart ramp is chosen so the three statuses are FAR apart on
 * purpose, which is the thing a single-accent theme cannot do: positive stays
 * green, waiting stays amber, stopped stays red, whatever the accent is.
 */
const NATIVE = {
  /*
    宣纸 — THE ONE GAP THE POPULARITY DATA FOUND, and the only addition the
    cull down to eight did not already cover.

    tweakcn's community gallery publishes a real signal: Popular / All Time,
    with like counts. Read on 2026-08-26 (.screenshots/themes/):

      Claude +          300   terracotta on cream
      Light Green       243   lime
      Zen Inspired      231   NEAR-BLACK ON LINEN
      AstroVista        185   orange + navy
      Tiesen            180   blue
      qrafthive         172   orange + slate
      Minimal Neutral   170   black on white
      designbyte        164   mint
      claude blu 2      133   sky blue
      Sage Green        128   sage
      Whatsapp          123   green
      VTRON             118   blue + navy
      Porfolio          106   tan
      autoblog          102   orange-red
      Enterprise Mod 2  101   corporate blue
      Deep Purple        95   purple

    THIRTEEN OF THE SIXTEEN land on one of the eight we kept. That is the
    strongest thing this list says: the cull was right. The three that do not
    are Light Green and designbyte -- lime and mint, exactly the 花哨 the
    founder said nobody picks -- and Zen.

    ZEN IS THE GAP. Every one of our eight puts its accent on a WHITE ground;
    Zen puts a near-black accent on a warm linen one. Two independent galleries
    put it near the top: third by all-time likes here, and third card on
    21st.dev's own Themes page as 「Zen Linen」. It is also the closest thing in
    the whole list to what he actually asked for -- 「白色跟黑色居多」 -- just
    with the white warmed.

    WRITTEN BY HAND rather than pulled, like 金稻 / 松石 / 紫檀 before it: the
    community themes are not in tweakcn's registry, only its fourteen built-in
    presets are, and none of those fourteen occupies this corner. `notebook` and
    `mono` come closest and are not palettes at all -- their identity is a
    handwriting font and a zero radius, which is the 版式 layer's job.

    THE ACCENT CARRIES ALMOST NO CHROMA ON PURPOSE (C 0.008). The ground is the
    statement here; an accent with colour in it would fight the paper and turn
    this into a second 陶土.
  */
  /*
    深夜 — THE MISSING AXIS, AND IT IS LIGHTNESS.

    Measured 2026-08-27 across all twelve palettes, ground lightness in oklch:

      0.9380 zen        0.9755 starry-night  0.9842 clean-slate
      0.9383 tangerine  0.9761 sage-garden   0.9900 vercel
      0.9711 nature     0.9779 elegant-luxury 1.0000 modern-minimal
                        0.9790 rosewood       1.0000 amber-minimal
                        0.9821 caffeine

    TWELVE OUT OF TWELVE ARE NEAR-WHITE. 藏青 and 咖啡, added the same morning,
    are dark ACCENTS on white pages -- which is why the assistant answering
    「换成深色一点的」 with 「换成藏青配色，整体暗一点」 was describing a change the
    owner could not see. Found by the session working on the assistant, by
    measuring rather than by trusting the sentence.

    So the palette layer has had a hue axis and a chroma axis and no LIGHTNESS
    axis, and 任务 17 has said so since 2026-08-26. This is that axis.

    ── WHY IT MATTERS BEYOND DARK MODE ────────────────────────────────────

    夜 is a REGISTER today, and its own brief admits the problem: 「这一套的主张
    其实是「暗」，而暗是明度 —— 照重点 7c 它比较像一个配色而不是一套风格」. It was
    kept only because nothing else could make a page dark. Once this exists,
    夜 can be demoted and every OTHER register gains a dark mode -- fourteen
    registers x dark, instead of one register that is dark.

    ── THE COLOURS ─────────────────────────────────────────────────────────

    Ground oklch(0.1800 0.0080 265): near-black with a hint of blue, chroma
    0.008. Ten mature landing pages carry ground chroma 0.000 and five of them
    sit at #080808; a trace of hue is what separates a chosen neutral from a
    default one, and ground-neutral.test.ts allows up to 0.02.

    Accent oklch(0.7000 0.1300 250): a clear blue at the lightness a dark page
    needs. Nine real business systems measured on 2026-08-26 all carry a
    coloured primary; going grey here would have thrown the colour away rather
    than moved it, which is the failure the second half of that test guards.
  */
  "midnight": {
    background: "oklch(0.1800 0.0080 265)",
    card: "oklch(0.2200 0.0090 265)",
    muted: "oklch(0.2600 0.0100 265)",
    accent: "oklch(0.3000 0.0140 265)",
    border: "oklch(0.3200 0.0120 265)",
    input: "oklch(0.3200 0.0120 265)",
    foreground: "oklch(0.9400 0.0050 265)",
    "muted-foreground": "oklch(0.7200 0.0090 265)",
    primary: "oklch(0.7000 0.1300 250)",
    ring: "oklch(0.7000 0.1300 250)",
    "primary-foreground": "oklch(0.1800 0.0080 265)",
    "sidebar-foreground": "oklch(0.9400 0.0050 265)",
    destructive: "oklch(0.6400 0.1800 27)",
    "chart-1": "oklch(0.7000 0.1300 250)",
    "chart-2": "oklch(0.7000 0.1400 150)",
    "chart-3": "oklch(0.7800 0.1300 80)",
    "chart-4": "oklch(0.6800 0.1500 20)",
    "chart-5": "oklch(0.6600 0.0200 265)",
  },
  "zen": {
    background: "oklch(0.9380 0.0130 85)",
    card: "oklch(0.9660 0.0090 85)",
    muted: "oklch(0.9050 0.0150 85)",
    accent: "oklch(0.8720 0.0190 85)",
    border: "oklch(0.8400 0.0160 85)",
    input: "oklch(0.8400 0.0160 85)",
    foreground: "oklch(0.2200 0.0080 85)",
    "muted-foreground": "oklch(0.4500 0.0110 85)",
    primary: "oklch(0.2450 0.0080 85)",
    ring: "oklch(0.2450 0.0080 85)",
    "primary-foreground": "oklch(0.9660 0.0090 85)",
    "sidebar-foreground": "oklch(0.2200 0.0080 85)",
    destructive: "oklch(0.4900 0.1600 27)",
    "chart-1": "oklch(0.2450 0.0080 85)",
    "chart-2": "oklch(0.4600 0.0700 145)",
    "chart-3": "oklch(0.5600 0.1050 65)",
    "chart-4": "oklch(0.4600 0.0700 250)",
    "chart-5": "oklch(0.6200 0.0200 85)",
  },
  "gold-grain": {
    background: "oklch(0.9800 0.0120 95)",
    card: "oklch(0.9960 0.0050 95)",
    muted: "oklch(0.9450 0.0200 95)",
    accent: "oklch(0.9050 0.0420 95)",
    border: "oklch(0.8700 0.0300 95)",
    input: "oklch(0.8700 0.0300 95)",
    foreground: "oklch(0.2700 0.0280 80)",
    "muted-foreground": "oklch(0.4700 0.0300 85)",
    primary: "oklch(0.5100 0.0950 95)",
    ring: "oklch(0.4300 0.0850 95)",
    "primary-foreground": "oklch(1 0 0)",
    "sidebar-foreground": "oklch(0.2700 0.0280 80)",
    destructive: "oklch(0.5300 0.1900 27)",
    "chart-1": "oklch(0.5100 0.0950 95)",
    "chart-2": "oklch(0.5000 0.1200 155)",
    "chart-3": "oklch(0.5900 0.1350 65)",
    "chart-4": "oklch(0.4800 0.1000 250)",
    "chart-5": "oklch(0.4200 0.0200 90)",
  },
  "turquoise-stone": {
    background: "oklch(0.9820 0.0060 190)",
    card: "oklch(1 0 0)",
    muted: "oklch(0.9560 0.0090 190)",
    accent: "oklch(0.9200 0.0280 188)",
    border: "oklch(0.8900 0.0180 190)",
    input: "oklch(0.8900 0.0180 190)",
    foreground: "oklch(0.2600 0.0300 200)",
    "muted-foreground": "oklch(0.4900 0.0280 200)",
    primary: "oklch(0.5200 0.1050 186)",
    ring: "oklch(0.4400 0.0950 186)",
    "primary-foreground": "oklch(1 0 0)",
    "sidebar-foreground": "oklch(0.2600 0.0300 200)",
    destructive: "oklch(0.5300 0.1900 27)",
    "chart-1": "oklch(0.5200 0.1050 186)",
    "chart-2": "oklch(0.5300 0.1300 150)",
    "chart-3": "oklch(0.6100 0.1300 75)",
    "chart-4": "oklch(0.5000 0.0900 300)",
    "chart-5": "oklch(0.4200 0.0250 220)",
  },
  "rosewood": {
    background: "oklch(0.9790 0.0080 325)",
    card: "oklch(1 0 0)",
    muted: "oklch(0.9520 0.0140 325)",
    accent: "oklch(0.9150 0.0320 325)",
    border: "oklch(0.8850 0.0220 325)",
    input: "oklch(0.8850 0.0220 325)",
    foreground: "oklch(0.2500 0.0350 320)",
    "muted-foreground": "oklch(0.4700 0.0330 320)",
    primary: "oklch(0.4700 0.1350 325)",
    ring: "oklch(0.4000 0.1250 325)",
    "primary-foreground": "oklch(1 0 0)",
    "sidebar-foreground": "oklch(0.2500 0.0350 320)",
    destructive: "oklch(0.5300 0.1900 27)",
    "chart-1": "oklch(0.4700 0.1350 325)",
    "chart-2": "oklch(0.5100 0.1250 152)",
    "chart-3": "oklch(0.6000 0.1300 68)",
    "chart-4": "oklch(0.5000 0.1000 265)",
    "chart-5": "oklch(0.4200 0.0250 320)",
  },
};

/** How a tweakcn theme's shadcn variables become this design system's colour
 *  tokens. The inverse of the bridge in design-system/tokens/*.css -- read that
 *  file's "THE shadcn/ui CONTRACT" block alongside this. */
const MAP = {
  "--color-canvas": "background",
  // A LIST IS A FALLBACK CHAIN, first key present wins.
  //
  // --color-ink-850 USED TO MAP TO `accent`, AND THAT WAS WRONG. In this design
  // system the ink ramp is NEUTRAL: measured across the registers, ink-850 is
  // #eef1f4 on 清, #edf2fc on 素, #f2f6fb on 台账 -- a near-white subtle fill,
  // used for a hover surface and for alternating table rows. shadcn's `accent`
  // is not that; it is a COLOURED hover, and in several themes it is fully
  // saturated. So 桃粉's accent, a strong yellow, painted a yellow band across
  // the middle row of every table, and the 待回复 label on top of it became
  // unreadable. Seen in the palette cards the moment they showed a real table
  // instead of four dots.
  //
  // `muted` is the neutral one, and it is what ink-850 has always meant.
  "--color-ink-950": ["secondary", "muted"],
  "--color-ink-900": "card",
  "--color-ink-850": ["muted", "secondary"],
  "--color-ink-800": "border",
  "--color-ink-700": "input",

  "--color-paper": "foreground",
  "--color-paper-dim": "muted-foreground",

  "--color-primary": "primary",
  "--color-primary-deep": "ring",
  "--color-primary-soft": "accent",
  "--color-on-primary": "primary-foreground",
  "--color-on-dark": "sidebar-foreground",

  // The four status meanings keep their names and take this palette's chart
  // ramp, so "positive" is still one idea across every style even though it is
  // a different green in each.
  "--color-jade": "chart-2",
  "--color-jade-bright": "chart-2",
  "--color-jade-chart": "chart-2",
  "--color-brass": "chart-3",
  "--color-brass-bright": "chart-3",
  "--color-brass-chart": "chart-3",
  "--color-clay": "destructive",
  "--color-clay-bright": "destructive",
  "--color-clay-deep": "destructive",
  "--color-slate": "chart-5",
  "--color-slate-bright": "chart-5",
  "--color-info": "chart-1",
  "--color-info-bright": "chart-1",
  "--color-medal-gold": "chart-3",
  "--color-medal-silver": "chart-5",
  "--color-medal-bronze": "chart-4",

  // THE NAVIGATION IS NOT IN THIS MAP ANY MORE. See deriveNav below.
};

/**
 * THE NAVIGATION GROUND, DERIVED RATHER THAN COPIED.
 *
 * WHAT WAS MEASURED. All twenty-one registers set a dark navigation: oklch
 * lightness 0.00 to 0.04, and ledger.css says in so many words that the rail is
 * the one dark surface in every register. All ten palettes then overrode it
 * from tweakcn's `sidebar`, whose lightness across the ten is 0.89 to 0.99.
 *
 * So every palette silently repainted the one structural surface the registers
 * agreed on. Verified in a browser, not reasoned about: with 森绿 applied, the
 * rail's --color-nav-bg computed to L 92.7% and painted the same cream as the
 * page. The register said near-black. That is the palette layer overruling the
 * 版式 layer, which is exactly what it is not supposed to be able to do -- and
 * it is why twenty-one registers times eleven palettes still looked like one
 * light-sidebar app.
 *
 * WHY DERIVE INSTEAD OF DROP. Dropping the nav tokens would give every palette
 * the register's own dark rail, which is correct but identical twenty-six
 * times. Deriving keeps the register's VALUE (dark, because that is structure)
 * and takes the palette's HUE (because that is colour). 森绿 gets a dark green
 * rail, 靛 a near-black navy, 极简黑 a neutral graphite. The layer split holds
 * and the variety goes UP.
 *
 * An achromatic primary stays achromatic: chroma is scaled, never invented.
 */
function deriveNav(resolved) {
  const p = readOklch(resolved["--color-primary"]) ?? { L: 0.5, C: 0, H: 0 };
  const H = p.H;
  // A ground carries far less chroma than a foreground of the same hue, or it
  // reads as a coloured block rather than as a dark surface.
  const groundC = Math.min(p.C * 0.42, 0.055);
  const at = (L, C) => fmtOklch({ L, C, H });

  const bg = at(0.215, groundC);
  const nav = {
    "--color-nav-bg": bg,
    "--color-nav-bg-deep": at(0.145, groundC),
    "--color-nav-fg": at(0.962, Math.min(p.C * 0.1, 0.014)),
    "--color-nav-hover": at(0.295, groundC),
    "--color-nav-active": at(0.345, groundC),
    "--color-nav-border": at(0.325, groundC),
  };
  // The accent has to be READ on that ground, so it is the palette's own
  // primary walked up in lightness until it clears AA there -- the same repair
  // used everywhere else in this file, never a different colour.
  const lifted = fitContrast(resolved["--color-primary"], bg, 4.5);
  nav["--color-nav-accent"] = lifted?.value ?? at(0.78, Math.min(p.C, 0.14));
  nav["--color-nav-fg-dim"] =
    `color-mix(in oklab, ${nav["--color-nav-fg"]} 68%, ${bg})`;
  return nav;
}

/**
 * THE THREE STATUS COLOURS HAVE TO MEAN WHAT THEY SAY.
 *
 * A tweakcn theme is designed around ONE accent, and its chart ramp is a
 * decorative sequence rather than a set of meanings. Mapped onto 已确认 /
 * 待回复 / 停滞 it produces nonsense, and the first version of this gate --
 * "are the three at least 32 degrees apart?" -- let the nonsense through,
 * because being far apart is not the same as being right:
 *
 *     正红   已确认 at hue 110 (yellow-green), 待回复 at hue 261 (blue),
 *            停滞 pure black.       All three far apart. All three wrong.
 *     桃粉   已确认 at hue 212 (blue).
 *     咖啡   待回复 at chroma 0.000, which is a grey.
 *
 * Seen the moment the palette cards started showing a real table instead of
 * four dots: a row marked 已确认 in blue and one marked 待回复 in yellow, side
 * by side, in a product whose whole job is telling a business owner which
 * quotations still need chasing.
 *
 * So the gate is now about NEIGHBOURHOOD, not distance. Positive lands in the
 * greens, waiting in the ambers, stopped in the reds, or the palette does not
 * get to repaint them and the register's own three show through. That is the
 * right fallback and not a concession: 已确认 should look the same kind of
 * green in all twenty-five, because it means the same thing in all twenty-five.
 * A palette repaints the page; it does not get to redefine what finished means.
 *
 * The variety a palette provides is its ground, its ink and its accent -- which
 * is plenty, and is the half that is genuinely a matter of taste.
 */
const STATUS_TOKENS = [
  "--color-jade", "--color-jade-bright", "--color-jade-chart",
  "--color-brass", "--color-brass-bright", "--color-brass-chart",
  "--color-clay", "--color-clay-bright", "--color-clay-deep",
];

/** hue windows, inclusive, wrapping at 360. */
const MEANINGS = [
  ["--color-jade", "已确认", 120, 190],
  ["--color-brass", "待回复", 40, 105],
  ["--color-clay", "停滞", 340, 40],
];

function statusesMeanWhatTheySay(resolved) {
  const bad = [];
  for (const [token, what, lo, hi] of MEANINGS) {
    const c = readOklch(resolved[token]);
    if (!c) { bad.push(`${what} not expressible in oklch`); continue; }
    if (c.C < 0.05) { bad.push(`${what} is a grey (chroma ${c.C.toFixed(3)})`); continue; }
    const inWindow = lo <= hi ? c.H >= lo && c.H <= hi : c.H >= lo || c.H <= hi;
    if (!inWindow) bad.push(`${what} at hue ${Math.round(c.H)}, outside ${lo}-${hi}`);
  }
  return bad.length ? { ok: false, why: bad.join("; ") } : { ok: true };
}

/** Foregrounds that must be legible, and the surfaces they sit on. */
const CONTRAST_PAIRS = [
  ["--color-paper", "--color-canvas", 4.5],
  ["--color-paper", "--color-ink-900", 4.5],
  ["--color-paper-dim", "--color-canvas", 4.5],
  ["--color-paper-dim", "--color-ink-900", 4.5],
  ["--color-primary", "--color-ink-900", 3.0],
  ["--color-on-primary", "--color-primary", 4.5],
  // The navigation pair is checked against the DERIVED values, not these.
];

// --- colour maths ----------------------------------------------------------

/** oklch(L C H) / oklch(L C H / A) / hsl(...) / #hex -> {r,g,b} 0-255.
 *  tweakcn emits oklch almost everywhere, so that is the path that matters. */
function parseColor(css) {
  const s = String(css).trim();
  if (s.startsWith("#")) {
    const h = s.length === 4 ? s.slice(1).split("").map((c) => c + c).join("") : s.slice(1);
    const n = parseInt(h.slice(0, 6), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const ok = s.match(/^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/i);
  if (ok) {
    let L = Number.parseFloat(ok[1]);
    if (ok[1].endsWith("%")) L /= 100;
    return oklchToRgb(L, Number.parseFloat(ok[2]), Number.parseFloat(ok[3]));
  }
  const rgb = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3] };
  return null;
}

function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const bb = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bb;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bb;
  const s_ = L - 0.0894841775 * a - 1.291485548 * bb;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const enc = (c) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  };
  return { r: enc(lr), g: enc(lg), b: enc(lb) };
}

function luminance({ r, g, b }) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a, b) {
  const A = parseColor(a), B = parseColor(b);
  if (!A || !B) return null;
  const l1 = luminance(A), l2 = luminance(B);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** oklch string -> {L, C, H} so a value can be darkened without leaving its
 *  own hue. Returns null for anything not in oklch, which is the signal to
 *  stop rather than to guess. */
function readOklch(css) {
  const m = String(css).trim().match(/^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/i);
  if (!m) return null;
  let L = Number.parseFloat(m[1]);
  if (m[1].endsWith("%")) L /= 100;
  return { L, C: Number.parseFloat(m[2]), H: Number.parseFloat(m[3]) };
}

const fmtOklch = ({ L, C, H }) => `oklch(${L.toFixed(4)} ${C.toFixed(4)} ${H.toFixed(2)})`;

/**
 * Walks a colour's LIGHTNESS until it clears `min` against `bg`, holding chroma
 * and hue exactly.
 *
 * This is a repair, not an invention, and the distinction is the whole point:
 * Supabase green stays Supabase green, it just stops being 1.54:1 as body text.
 * The three hand-written styles already do this by hand -- ledger.css says in
 * so many words that its rust was picked at the lightness that clears its own
 * ground. Dropping a palette over one mechanical failure would throw away a
 * designer's colour choice to avoid doing arithmetic.
 *
 * Direction is chosen by which way the background sits, so it darkens on a
 * light ground and lightens on a dark one. Gives up after 60 steps rather than
 * looping, and returns null so the caller drops the palette honestly.
 */
function fitContrast(value, bg, min) {
  if (contrast(value, bg) >= min) return { value, changed: false };
  const c = readOklch(value);
  if (!c) return null;
  const bgLum = luminance(parseColor(bg));
  const step = bgLum > 0.35 ? -0.01 : 0.01;
  for (let i = 0; i < 60; i++) {
    c.L = Math.min(1, Math.max(0, c.L + step));
    const next = fmtOklch(c);
    if (contrast(next, bg) >= min) return { value: next, changed: true };
  }
  return null;
}

/** For a fill, the readable label is whichever of the palette's own two
 *  extremes wins -- never a hardcoded white, which is what produced 3.90:1
 *  labels in several of tweakcn's own themes. */
function bestOn(fill, candidates) {
  let best = null, bestRatio = 0;
  for (const c of candidates) {
    if (!c) continue;
    const r = contrast(c, fill);
    if (r > bestRatio) { bestRatio = r; best = c; }
  }
  return { value: best, ratio: bestRatio };
}

// --- generation ------------------------------------------------------------

async function fetchTheme(name) {
  if (NATIVE[name]) return NATIVE[name];
  const res = await fetch(`https://tweakcn.com/r/themes/${name}.json`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const json = await res.json();
  const light = json?.cssVars?.light;
  if (!light) throw new Error(`${name}: no light palette`);
  return light;
}

/** The class name a palette gets. CSS Modules camel-cases hyphenated class
 *  names in the generated .d.ts, so the source class is written camel too --
 *  otherwise `styles.paletteAmberMinimal` silently resolves to undefined and
 *  the palette applies nothing at all. */
function className(name) {
  return "palette" + name.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
}

function toCss(name, zh, blurb, who, resolved, nav, statusNote) {
  const lines = [];
  for (const token of Object.keys(MAP)) {
    const v = resolved[token];
    if (v) lines.push(`  ${token}: ${v};`);
  }
  lines.push("");
  lines.push("  /* Derived, not copied -- see deriveNav in the generator. */");
  for (const [token, v] of Object.entries(nav)) lines.push(`  ${token}: ${v};`);
  return `/* ${zh} (${name}) -- ${blurb}
 * 适合: ${who}
 *
 * GENERATED by scripts/build-palettes.mjs. Do not edit by hand.
 * Source: https://tweakcn.com/r/themes/${name}.json
 * jnsahaj/tweakcn, Apache-2.0. Values copied, roles remapped onto this design
 * system's token names -- see the MAP in the generator for the correspondence.
 *
 * Colour ONLY. Type scale, weights, radii, density and shadows all stay with
 * whichever 版式 class this is combined with, which is what makes 21 x N work.
 *
 * The navigation ground is DARK here, in this palette's own hue, because every
 * one of the twenty-one registers makes the rail its one dark surface -- and a
 * palette repaints colour, not structure. It is derived, not taken from
 * tweakcn's own sidebar value, which is near-white in all forty of their themes.
 *${statusNote}
 */
.${className(name)} {
${lines.join("\n")}
}
`;
}

async function main() {
  const check = process.argv.includes("--check");
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const kept = [], dropped = [], repaired = [];
  const flattened = [];
  for (const [name, zh, blurb, who, en, blurbEn, whoEn] of WANTED) {
    let vars;
    try {
      vars = await fetchTheme(name);
    } catch (err) {
      dropped.push([name, String(err.message)]);
      continue;
    }

    const resolved = {};
    for (const [token, key] of Object.entries(MAP)) {
      const from = Array.isArray(key) ? key.find((k) => vars[k]) : key;
      if (from && vars[from]) resolved[token] = vars[from];
    }

    // The navigation is derived from this palette rather than copied from the
    // theme's own near-white sidebar -- see deriveNav. Derived before the
    // repairs below because it reads --color-primary, which they may move.
    const nav = deriveNav(resolved);

    // REPAIR BEFORE JUDGING.
    // Three mechanical failures show up across tweakcn's set, and every one of
    // them is arithmetic rather than taste: an accent too light to read as
    // text, a muted-foreground a hair under AA, and a fill label they hardcoded
    // to white. Dropping a palette over any of those throws away a designer's
    // colour choice to avoid doing the sum. Hue and chroma are held exactly, so
    // Supabase green stays Supabase green -- it just stops being 1.54:1.
    const fixes = [];
    const repair = (token, bg, min, label) => {
      const got = fitContrast(resolved[token], resolved[bg], min);
      if (!got) return false;
      if (got.changed) {
        fixes.push(`${label} ${contrast(resolved[token], resolved[bg]).toFixed(2)}->${contrast(got.value, resolved[bg]).toFixed(2)}`);
        resolved[token] = got.value;
      }
      return true;
    };

    let repairable = true;
    // Read as text in eight components, so it answers to the text threshold.
    repairable &&= repair("--color-primary", "--color-ink-900", 4.5, "primary");
    repairable &&= repair("--color-primary-deep", "--color-ink-900", 4.5, "primary-deep");
    repairable &&= repair("--color-paper-dim", "--color-canvas", 4.5, "paper-dim/canvas");
    repairable &&= repair("--color-paper-dim", "--color-ink-900", 4.5, "paper-dim/card");
    // THE STATUS COLOURS ARE TEXT. 已确认 / 待回复 / 停滞 are rendered as a word
    // in the tone, not only as a dot, and nothing here had ever measured them:
    // 正红's 已确认 came out yellow-on-white and 桃粉's 待回复 was invisible.
    // A status that cannot be read is worse than no status, because the row
    // still looks answered.
    for (const t of ["--color-jade", "--color-brass", "--color-clay", "--color-info", "--color-slate"]) {
      if (resolved[t]) repairable &&= repair(t, "--color-ink-900", 4.5, t.replace("--color-", ""));
    }
    // The navigation is DERIVED (deriveNav), not copied, so it is not repaired
    // here -- it is constructed to clear AA and then checked below.

    // The fill label is CHOSEN from the palette's own extremes rather than
    // nudged, because a button label wants to be one of the two ends, not a
    // grey that happens to pass.
    if (repairable) {
      const on = bestOn(resolved["--color-primary"], [
        resolved["--color-on-primary"],
        resolved["--color-canvas"],
        resolved["--color-paper"],
        "#ffffff",
      ]);
      if (on.value && on.value !== resolved["--color-on-primary"]) {
        fixes.push(`on-primary ${contrast(resolved["--color-on-primary"], resolved["--color-primary"]).toFixed(2)}->${on.ratio.toFixed(2)}`);
        resolved["--color-on-primary"] = on.value;
      }
    }

    const fails = [];
    if (!repairable) fails.push("not expressible in oklch, cannot repair");
    for (const [fg, bg, min] of CONTRAST_PAIRS) {
      const r = contrast(resolved[fg], resolved[bg]);
      if (r === null) { fails.push(`${fg} on ${bg}: unparseable`); continue; }
      if (r < min) fails.push(`${fg} on ${bg}: ${r.toFixed(2)} < ${min}`);
    }
    const navRatio = contrast(nav["--color-nav-fg"], nav["--color-nav-bg"]);
    if (!(navRatio >= 4.5)) fails.push(`derived nav-fg on nav-bg: ${navRatio?.toFixed(2) ?? "?"} < 4.5`);
    const accentRatio = contrast(nav["--color-nav-accent"], nav["--color-nav-bg"]);
    if (!(accentRatio >= 4.5)) fails.push(`derived nav-accent on nav-bg: ${accentRatio?.toFixed(2) ?? "?"} < 4.5`);
    if (fails.length) { dropped.push([name, fails.join("; ")]); continue; }
    if (fixes.length) repaired.push([name, fixes.join(", ")]);


    // The three status colours only survive if they are still three colours.
    const sep = statusesMeanWhatTheySay(resolved);
    let statusNote;
    if (sep.ok) {
      statusNote = `\n * Status colours come from this palette: 已确认 / 待回复 / 停滞 each`
        + ` land in the right neighbourhood of the wheel.`;
    } else {
      for (const t of STATUS_TOKENS) delete resolved[t];
      flattened.push([name, sep.why]);
      statusNote = `\n * Status colours are NOT taken from this palette (${sep.why}), so`
        + ` 已确认 / 待回复 / 停滞 stay the register's own three. A status colour is the`
        + ` only thing on a row that says what to do next; it does not get to`
        + ` collapse into one accent.`;
    }
    if (fixes.length) statusNote += `\n *
 * CONTRAST REPAIRS (lightness only, hue and chroma held exactly):
 *   ${fixes.join("\n *   ")}`;

    const css = toCss(name, zh, blurb, who, resolved, nav, statusNote);
    const path = join(OUT_DIR, `${name}.css`);
    if (check) {
      const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
      if (existing !== css) {
        console.error(`STALE: ${name}.css differs from the generator's output.`);
        process.exit(1);
      }
    } else {
      writeFileSync(path, css);
    }
    kept.push([name, zh, blurb, who, en, blurbEn, whoEn, [resolved["--color-canvas"], resolved["--color-primary"], resolved["--color-ink-800"], resolved["--color-ink-850"]]]);
  }

  console.log(`kept ${kept.length}: ${kept.map(([n, z]) => `${z}(${n})`).join(", ")}`);

  // ── THE REGISTRY, EMITTED ────────────────────────────────────────────────
  //
  // lib/portal/palettes.ts used to carry this list by hand: twenty-five keys,
  // twenty-five labels and a hundred hand-picked swatch values, kept in step
  // with a directory of generated files by nothing but attention. Two of the
  // ten hand-written labels turned out to describe the wrong colour -- 海蓝
  // over a green and 石板灰 over a saturated indigo -- and neither could have
  // been caught by a test, because the list was the only statement of what the
  // colours were supposed to be.
  //
  // Now the file that computes the colours writes the list, and the swatches
  // are read out of the palette rather than chosen to look like it.
  const registry = kept.map(([n, zh, blurb, who, en, blurbEn, whoEn, dots]) =>
    `  { key: ${JSON.stringify(n)},
    label: ${JSON.stringify(zh)}, blurb: ${JSON.stringify(blurb)}, who: ${JSON.stringify(who)},
    labelEn: ${JSON.stringify(en)}, blurbEn: ${JSON.stringify(blurbEn)}, whoEn: ${JSON.stringify(whoEn)},
    dots: [${dots.map((d) => JSON.stringify(d)).join(", ")}] },`,
  ).join("\n");
  const ts = `// GENERATED by scripts/build-palettes.mjs. Do not edit by hand.
//
// The 配色 layer's contents. Mirrors design-system/palettes/*.css exactly,
// because the same run wrote both -- see the note above the emitter.

export type PaletteRow = {
  key: string;
  /** What the customer sees. Their word, not tweakcn's. */
  label: string;
  blurb: string;
  /** Which trades this one is for. Shown under the name in the picker. */
  who: string;
  /**
   * The same three, for the English portal.
   *
   * Written out rather than machine-translated: 「深红配奶油底,老字号的正式红」
   * is not 「dark red with cream base, the formal red of an old brand」, it is
   * 「Deep red on cream. The formal red of an old shop.」 -- and 老字号 has no
   * one-word English equivalent at all. A palette a business owner is choosing
   * by feel is exactly the wrong place for a translation that reads translated.
   */
  labelEn: string;
  blurbEn: string;
  whoEn: string;
  /** ground / accent / line / fill, read straight out of the palette. */
  dots: [string, string, string, string];
};

export const PALETTE_ROWS: PaletteRow[] = [
${registry}
];
`;
  const tsPath = join(HERE, "..", "lib", "portal", "palettes.generated.ts");
  if (check) {
    const existing = existsSync(tsPath) ? readFileSync(tsPath, "utf8") : "";
    if (existing !== ts) { console.error("STALE: lib/portal/palettes.generated.ts"); process.exit(1); }
  } else {
    writeFileSync(tsPath, ts);
  }

  // THE SPREAD REPORT. The first ten palettes were "chosen to be genuinely far
  // apart" and nothing ever checked. Six of the eight chromatic ones turned out
  // to sit inside two narrow bands. This prints the wheel so the next person
  // adding one can see at a glance whether it is a new colour or a fifth orange.
  const hues = kept.map(([n]) => {
    const css = readFileSync(join(OUT_DIR, `${n}.css`), "utf8");
    const m = css.match(/^  --color-primary:\s*([^;]+);/m);
    const c = m ? readOklch(m[1]) : null;
    return { n, H: c && c.C > 0.03 ? c.H : null, C: c ? c.C : 0 };
  });
  const chromatic = hues.filter((h) => h.H !== null).sort((a, b) => a.H - b.H);
  console.log(`\nhue spread (${chromatic.length} chromatic, ${hues.length - chromatic.length} achromatic):`);
  for (let i = 0; i < chromatic.length; i++) {
    const prev = chromatic[(i - 1 + chromatic.length) % chromatic.length];
    let gap = chromatic[i].H - prev.H;
    if (gap < 0) gap += 360;
    const flag = gap < 12 ? "   <-- within 12 deg of the one before it" : "";
    console.log(`  ${String(Math.round(chromatic[i].H)).padStart(3)}  ${chromatic[i].n.padEnd(16)} +${String(Math.round(gap)).padStart(3)}${flag}`);
  }
  if (flattened.length) {
    console.log(`\nstatus colours left to the register in ${flattened.length}:`);
    for (const [n, why] of flattened) console.log(`  ${n} -- ${why}`);
  }
  if (repaired.length) {
    console.log(`repaired ${repaired.length}:`);
    for (const [n, what] of repaired) console.log(`  ${n} -- ${what}`);
  }
  if (dropped.length) {
    console.log(`dropped ${dropped.length}:`);
    for (const [n, why] of dropped) console.log(`  ${n} -- ${why}`);
  }
  if (check) console.log("up to date");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

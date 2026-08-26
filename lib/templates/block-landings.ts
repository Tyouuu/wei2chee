import type { PuckNode } from "@/lib/templates/puck-node";
import type { LandingTemplate } from "@/lib/templates/landing-templates";
import { PAGE_TEMPLATES } from "@/components/blocks/templates/manifest";

/**
 * The pulled whole-page templates, dressed as 官网版面 so they land in the same
 * gallery as the six built ones.
 *
 * ── WHY THEY PLUG IN HERE RATHER THAN GETTING THEIR OWN SECTION ───────────
 *
 * 模板库 already has a shelf for "one SHAPE the website page can take", and
 * everything downstream of it — the preview card, the zoom, 「换成这个」, the
 * `?tpl=` handler in [pageKey]/page.tsx, LANDING_BY_KEY — speaks one language:
 * a key and a Puck layout. These are a key and a Puck layout. Adding a parallel
 * gallery would be a second way to do the one thing this page already does.
 *
 * ── HOW THEY DIFFER FROM THE SIX ──────────────────────────────────────────
 *
 * The six are built from the BUSINESS'S OWN WORDS: a contractor comparing
 * 上门报价 with 现货落单 is comparing two versions of his own site. These four
 * carry the words they were written with, because the founder drew that line —
 * 「模板是不可以改的 对不对 风格是可以改的」. What they bring instead is
 * LENGTH and SHAPE: eleven and thirteen sections with a logo wall, a bento
 * grid, a comparison table and a priced panel, which is more page than this
 * product could previously assemble at all.
 *
 * So `build()` ignores the content it is handed. That is not an oversight and
 * the signature keeps it only because LandingTemplate is one type.
 *
 * ── WHAT A CUSTOMER GETS ──────────────────────────────────────────────────
 *
 * One SiteBlock node per section, in the order the original page assembled
 * them. Each is a separate node in the editor, so it can be deleted, moved, or
 * swapped for another section — the furniture rearranges, the room stays.
 *
 * `dashboard` is deliberately NOT here. It is a logged-in app screen, not a
 * page for strangers, and 官网版面 is the shelf for pages a stranger reads.
 * Its sections are still reachable through 版段库.
 */

/** Titles and blurbs in the founder's own register: what the shape IS, and how
 *  much page it is, because length is the thing that distinguishes them. */
const ZH: Record<string, { label: string; blurb: string; labelEn: string; blurbEn: string }> = {
  startup: {
    label: "一页说清楚",
    blurb: "八段。大标题、数字、卖点、流程、客户评价、留邮箱、页尾。最短的一套，适合先上线再补。",
    labelEn: "Said in one page",
    blurbEn:
      "Eight sections. Headline, numbers, what you do, how it works, a review, an email box, footer. The shortest one — put it up now, fill it in later.",
  },
  "saas-landing": {
    label: "完整介绍",
    blurb: "十一段。多了合作标志墙、格子墙、价目表、常见问题——客人想问的都在页面上答完。",
    labelEn: "The full story",
    blurbEn:
      "Eleven sections. Adds logos, a bento wall, prices and FAQs — everything they would have asked is answered on the page.",
  },
  "saas-landing-2": {
    label: "边看边懂",
    blurb: "十三段。作品廊、分页卖点、流程步骤、对比表。最长的一套，东西多的时候用。",
    labelEn: "Show as you go",
    blurbEn:
      "Thirteen sections. A gallery, tabbed features, numbered steps, a comparison table. The longest one — use it when you have a lot to show.",
  },
};

export const BLOCK_LANDINGS: LandingTemplate[] = PAGE_TEMPLATES.filter(
  (t) => ZH[t.key],
).map((t) => ({
  // Prefixed so a pulled template can never collide with one of the six, and
  // so a stored `?tpl=` value says where it came from.
  key: `blk-${t.key}`,
  label: ZH[t.key].label,
  blurb: ZH[t.key].blurb,
  labelEn: ZH[t.key].labelEn,
  blurbEn: ZH[t.key].blurbEn,
  // No trade opens on one of these by default. They are a choice a customer
  // makes after seeing them, not an industry guess -- the six built from the
  // business's own words are the better default in every trade.
  trades: [],
  build: (): PuckNode[] =>
    t.sections.map((section, i) => ({
      type: "SiteBlock",
      props: { id: `blk-${t.key}-${i}`, block: section },
    })),
}));

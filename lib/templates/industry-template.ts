import type { PuckNode } from "@/lib/templates/puck-node";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { composeSite } from "@/lib/templates/site-composition";
import {
  landingTemplateFor,
  LANDING_BY_KEY,
  type LandingContent,
} from "@/lib/templates/landing-templates";
import type { Data } from "@puckeditor/core";
import type { TableColumn } from "@/lib/portal/table-model";
import {
  MODULE_BY_KEY,
  moduleLabel,
  MODULE_KEYS,
  defaultModulesForIndustry,
  type ModuleShape,
} from "@/lib/portal/module-catalog";
import { isLiveShape, PIPELINE_MODULES } from "@/lib/portal/shape-state";
import { DEFAULT_SYSTEM_LANG, type SystemLang } from "@/lib/system-lang";
import {
  chrome,
  type Chrome,
  moduleCopy,
  sampleFor,
  translateStage,
  pluralise,
  INDUSTRY_LABELS_EN,
  landingCopy,
  type IndustryLabels,
  type ModuleCopy,
  type StatusTone,
} from "@/lib/templates/copy";

/** Re-exported so callers keep importing the trade vocabulary from the module
 *  that builds pages with it, not from the copy tables underneath. */
export type { IndustryLabels };

/**
 * Turns a business's own context -- its industry, its questionnaire answers,
 * and the AI's analysis of them -- into the five Puck page layouts the
 * customer opens on their first visit to the editor.
 *
 * WHY THIS FILE EXISTS
 *
 * Until 2026-08-20 the customer journey broke in the middle, in the least
 * recoverable place. A visitor answered a questionnaire, an LLM analysed
 * their business, `/api/analyze` wrote a real `analysis_results` row -- and
 * then the account-provisioning trigger created five `project_pages` rows
 * with `layout_json = '{}'`. The customer signed up, picked a style, and
 * landed on a BLANK CANVAS. Everything the product had just demonstrated it
 * understood about their business was discarded at exactly the moment they
 * became a customer. See docs/formae-product-direction.md sections 2-4.
 *
 * This module is the repair. The analysis stops being a report the visitor
 * reads and walks away from, and becomes the first draft of their system --
 * something already built, already using their own words, that they edit
 * rather than assemble from nothing.
 *
 * WHY IT IS CODE AND NOT AN LLM CALL
 *
 * The layouts are BUILT here, deterministically, from data. The LLM is not
 * asked to emit Puck JSON. That is a deliberate architectural choice and it
 * is how B12 and Durable actually work under the "AI builds your site"
 * marketing: hand-designed templates, AI-driven selection and fill. An LLM
 * emitting layout JSON directly fails in ways this product cannot absorb --
 * a hallucinated component name or a malformed props object is not a
 * degraded layout, it is a blank editor for a paying customer. Here, the
 * worst case is a template with generic labels, which is still a working
 * system. See section 4.1 of the direction doc.
 *
 * The AI's real contribution is the CONTENT poured into the shape: the
 * business's own vocabulary (labels), its own workflow stages, and its own
 * summary line. That is what makes the first screen read as "it understood
 * my business" rather than "here is a demo".
 *
 * WHAT DEGRADES GRACEFULLY
 *
 * Every input is optional. No lead (someone who signed up directly, or the
 * demo account) still gets a complete, sensible system from the generic
 * defaults -- never a blank canvas, which is the whole point.
 */

/** The subset of a row from `public.industries` this module needs. */
export type IndustryContext = {
  slug: string;
  name_zh: string;
  labels: IndustryLabels;
  default_workflow: string[];
  suggested_modules: string[];
};

/** The subset of a row from `public.analysis_results` this module can use. */
export type AnalysisContext = {
  summary?: string | null;
  after_workflow?: string[] | null;
  /** The same workflow in English, for a system built in English while the
   *  owner reads their analysis in Chinese -- which is the DEFAULT pairing.
   *  Absent on every analysis written before migration 20260822060000. */
  after_workflow_en?: string[] | null;
  /** The AI's one-line summary in English, for the same reason. */
  summary_en?: string | null;
  bottlenecks?: { title: string; title_en?: string | null; description: string }[] | null;
  /**
   * What a website enquiry becomes for THIS business, decided by the analysis
   * rather than by the order of an array. `lands_in` is a module key this
   * business actually has, or "none" for a trade whose customers walk in.
   *
   * Absent on every analysis written before 2026-08-25 and on the fallback
   * path, which is why the resolver below still carries the old ordering as a
   * last resort -- no existing system changes shape on deploy. See migration
   * 20260825020000.
   */
  enquiry?: {
    lands_in?: string | null;
    fields?: { label: string; label_en: string; kind: string }[] | null;
  } | null;
};

/** `projects.business_name` / `projects.owner_name` (migration 20260820180000).
 *  Both optional forever: a customer who never opens settings still gets a
 *  complete system, just one labelled with a placeholder. */
export type BusinessIdentity = {
  business_name?: string | null;
  owner_name?: string | null;
};

export type BusinessContext = {
  industry?: IndustryContext | null;
  analysis?: AnalysisContext | null;
  identity?: BusinessIdentity | null;
  /**
   * The language the BUILT SYSTEM speaks -- `projects.system_language`,
   * default English. NOT the locale the owner reads Formae in; see
   * lib/system-lang.ts for why those are two different things.
   *
   * It rides on the context rather than on a seventh positional parameter
   * because every builder in this file already receives the context, and a
   * builder that forgot to pass the language down would produce a page half
   * in each language -- the one failure mode worse than the wrong language.
   */
  lang?: SystemLang;
};

/** Every builder reads the language through this, so a context assembled
 *  before `system_language` existed still produces a complete system. */
const langOf = (ctx: BusinessContext): SystemLang =>
  ctx.lang ?? DEFAULT_SYSTEM_LANG;

/** The language this business's system is built in. Exported so a page that
 *  only needs to LABEL something does not have to reach for `ctx.lang` and get
 *  the fallback wrong. */
export const systemLangOf = langOf;

/**
 * The trade's three nouns for this business, in the system's language, with the
 * customer's own page titles layered on top when the caller knows them.
 *
 * Exported because four separate pages were each keeping their own
 * `FALLBACK_LABELS = { customer: "客户", ... }` next to
 * `businessContext.industry?.labels` -- four copies of one rule, all of them
 * hard-wired to Chinese, and every one of them a place the rail could disagree
 * with the page under it. One function, and the language question is answered
 * in the module that knows the answer.
 */
export function tradeLabels(
  ctx: BusinessContext,
  pages?: PageRef[],
): IndustryLabels {
  const lang = langOf(ctx);
  const base = industryLabels(ctx.industry ?? fallbackIndustry(lang), lang);
  return pages ? labelsFromPages(base, pages) : base;
}

/**
 * Every page type the product knows how to build. A given business gets a
 * SUBSET of these, chosen by its trade -- see PAGES_FOR_INDUSTRY below and its
 * SQL twin `pages_for_industry()` (migration 20260820160000), which is what the
 * signup trigger actually provisions from.
 *
 * The two lists must agree. `industry-template.test.ts` asserts they do, since
 * a page the trigger creates but this module cannot build renders as an empty
 * canvas -- the exact bug this whole file exists to prevent.
 */
/**
 * Re-exported from the catalogue rather than re-listed here. Two hand-kept
 * lists of the same sixteen strings is two lists that drift, and the drift is
 * silent: a key the trigger writes and this module cannot build renders as a
 * blank canvas for a paying customer. One list, imported.
 */
export const PAGE_KEYS = MODULE_KEYS;
export type PageKey = string;

/**
 * Any page a customer's system can contain: one of the built-in types above,
 * or a custom page they added themselves (`custom_<hex>`, see migration
 * 20260820200000). Deliberately a plain string rather than a widened union --
 * the whole point of a custom page is that this module has never heard of it.
 */
export type PageId = string;

/** A page as the database holds it. `title` is the customer's own name and is
 *  null for built-in types, which take their label from the trade vocabulary. */
export type PageRef = {
  key: PageId;
  title?: string | null;
  /** The customer's own position, or null/undefined when they have never
   *  reordered. See migration 20260825080000 for why the two are different. */
  sortOrder?: number | null;
};

export function isBuiltInPage(key: PageId): key is PageKey {
  return (PAGE_KEYS as readonly string[]).includes(key);
}

/**
 * Which pages each trade gets. Mirrors `pages_for_industry()` in migration
 * 20260820160000 exactly.
 *
 * WHY THE SUBSET MATTERS: every account used to be provisioned with the same
 * five pages regardless of trade, so a salon owner was handed a 「报价单」page
 * they will never send and a 「项目」page for work they do not do, while
 * 「预约」-- the thing their entire business runs on -- did not exist. Applying
 * a customer's own vocabulary to someone else's structure is the most concrete
 * way to contradict the promise that the product understands their business.
 */
export const PAGES_FOR_INDUSTRY: Record<string, PageKey[]> = {
  beauty: defaultModulesForIndustry("beauty"),
  education: defaultModulesForIndustry("education"),
  fnb: defaultModulesForIndustry("fnb"),
  retail: defaultModulesForIndustry("retail"),
  wholesale: defaultModulesForIndustry("wholesale"),
  renovation: defaultModulesForIndustry("renovation"),
  services: defaultModulesForIndustry("services"),
  other: defaultModulesForIndustry("other"),
};

/** The set used for a direct signup, or a trade we have no mapping for. */
export const DEFAULT_PAGE_SET: PageKey[] = defaultModulesForIndustry(null);

/** Canonical display order for a set of page keys. Uses PAGE_KEYS' own order
 *  rather than a database column, so page ordering cannot depend on whether a
 *  migration has landed yet -- and so a page set is ordered identically
 *  wherever it is read. */
export function sortPageKeys(keys: PageKey[]): PageKey[] {
  return [...keys].sort((a, b) => PAGE_KEYS.indexOf(a) - PAGE_KEYS.indexOf(b));
}

/**
 * Orders a mixed set: built-in pages first in their canonical order, then the
 * customer's own pages in the order they added them.
 *
 * Custom pages go last rather than being interleaved because the built-in run
 * is a designed sequence -- overview, then who you serve, then what you sell
 * them, then the money -- and dropping a new page into the middle of it by
 * accident of creation time would break a reading order the customer never
 * chose. Their own additions accumulate after it, which is also where they
 * expect to find the thing they just made.
 */
export function sortPages(pages: PageRef[]): PageRef[] {
  // THE CUSTOMER'S ORDER WINS, WHOLE OR NOT AT ALL.
  //
  // If ANY page carries a sortOrder the customer has dragged something, and
  // from that moment the list is theirs -- mixing their numbers with the
  // designed rank would put a page they explicitly moved back where they moved
  // it from, which is the one outcome a drag must never have. Pages with no
  // number (one they added after reordering) fall to the end rather than to a
  // guessed position.
  const touched = pages.some((p) => typeof p.sortOrder === "number");
  if (touched) {
    return [...pages].sort(
      (a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER),
    );
  }
  const rank = (p: PageRef) =>
    isBuiltInPage(p.key) ? PAGE_KEYS.indexOf(p.key) : PAGE_KEYS.length;
  return [...pages].sort((a, b) => rank(a) - rank(b));
}

export function pagesForIndustry(slug?: string | null): PageKey[] {
  return (slug && PAGES_FOR_INDUSTRY[slug]) || DEFAULT_PAGE_SET;
}

/** The label for any page: the customer's own title when they set one (custom
 *  pages always have one), otherwise the trade's own noun for a built-in type. */
export function pageLabel(
  page: PageRef,
  labels: IndustryLabels,
  lang: SystemLang = DEFAULT_SYSTEM_LANG,
): string {
  const own = page.title?.trim();
  if (own) return own;
  return isBuiltInPage(page.key)
    ? pageNavLabel(page.key, labels, lang)
    : chrome(lang).newPage;
}

/**
 * The nav label for each page, in the business's own nouns where one applies.
 *
 * The three trade-vocabulary types answer from `labels` -- a salon's 客户 page
 * is headed 顾客, a tuition centre's 家长. Everything else takes the
 * catalogue's own default, which is the single place those words are written.
 */
export function pageNavLabel(
  key: PageKey,
  labels: IndustryLabels,
  lang: SystemLang = DEFAULT_SYSTEM_LANG,
): string {
  // Pluralised, because every one of these names a LIST. Chinese does not
  // inflect so this is a no-op there; in English a rail reading "Client" beside
  // a table of three clients is the kind of small wrongness that makes software
  // feel translated. See `pluralise` for why it is not just + "s".
  switch (key) {
    case "customers":
      return pluralise(labels.customer, lang);
    case "projects":
    case "orders":
      return pluralise(labels.order, lang);
    case "staff":
      return pluralise(labels.staff, lang);
    default: {
      const archetype = MODULE_BY_KEY[key];
      return archetype
        ? moduleLabel(archetype, lang)
        : chrome(lang).newPage;
    }
  }
}

/**
 * The name the rail carries before the customer renames it.
 *
 * It used to be the local part of their signup email -- "tianyou.demo" -- set
 * as both the system's name and the account chip, which is the single most
 * telling detail in a screenshot of somebody's own business system. `industries`
 * has no business-name column and the questionnaire never asks for one, so
 * there is nothing real to put here; inventing one ("陈氏装修") would be worse,
 * because a plausible fake name is one a customer might leave in place.
 *
 * A placeholder in their own trade's words is the honest middle: obviously not
 * their company, obviously about their company, and one click from being
 * corrected. The draft banner above the canvas already tells them everything
 * here is theirs to change.
 */
const brandFor = (slug: string, lang: SystemLang) => {
  const c = chrome(lang);
  return c.brand[slug] ?? c.brandFallback;
};

/** The name the system calls itself. The customer's own answer wins over every
 *  generated guess -- that is the entire point of asking for it. */
export function displayBusinessName(ctx: BusinessContext): string {
  const own = ctx.identity?.business_name?.trim();
  if (own) return own;
  return brandFor(ctx.industry?.slug ?? "other", langOf(ctx));
}

/** Who is signed in. Falls back to the caller-supplied label (today the email's
 *  local part) only until the customer tells us their name. */
export function displayOwnerName(
  ctx: BusinessContext,
  fallback: string,
): string {
  return ctx.identity?.owner_name?.trim() || fallback;
}

/** Used whenever a business has no lead, or its lead has no industry. The
 *  nouns come from the language table, so a fallback system is not the one
 *  place that stays Chinese when everything around it is English. */
const fallbackIndustry = (lang: SystemLang): IndustryContext => ({
  slug: "other",
  name_zh: chrome(lang).fallbackIndustryName,
  labels: chrome(lang).fallbackLabels,
  default_workflow: ["Customer", "Quotation", "Project", "Payment"],
  suggested_modules: ["Customer", "Project", "Payment"],
});

/**
 * The trade's three nouns, in the system's language.
 *
 * `industries.labels` is Chinese-only in the database, so an English system
 * takes its nouns from INDUSTRY_LABELS_EN keyed on the same slug. The
 * customer's own page titles still win over both -- see `labelsFromPages`,
 * which layers them on top of whatever this returns.
 */
/** The trade as it reads inside a sentence. `industries.name_zh` is right
 *  for Chinese; English needs its own noun, because "Renovation /
 *  Contractor runs on..." does not parse. */
function industryName(industry: IndustryContext, lang: SystemLang): string {
  if (lang === "zh") return industry.name_zh;
  const t = landingCopy("en");
  return t.tradeNoun[industry.slug] ?? t.tradeNounFallback;
}

/** The trade as a LABEL -- for the eyebrow over the website headline.
 *  Several trades are stored as 「装修/承包商」 and an eyebrow reading the
 *  whole field looks like a database column, not like a business. */
/**
 * The trade's name, in one language.
 *
 * Exported since 2026-08-26: the specification document needs it too, and was
 * printing `industry.name_zh` -- 「Trade: 装修/承包商」 sitting under an English
 * heading in the document a developer builds from.
 */
export function tradeLabel(industry: IndustryContext, lang: SystemLang): string {
  if (lang === "zh") return industry.name_zh.split("/")[0].trim();
  const t = landingCopy("en");
  return t.eyebrowTrade[industry.slug] ?? t.eyebrowTradeFallback;
}

function industryLabels(
  industry: IndustryContext,
  lang: SystemLang,
): IndustryLabels {
  if (lang === "zh") return industry.labels;
  return INDUSTRY_LABELS_EN[industry.slug] ?? chrome("en").fallbackLabels;
}

/**
 * The workflow the customer's board columns are built from. The AI's
 * `after_workflow` wins when present -- it is the recommended workflow for
 * THIS business, already in the customer's own language, and putting it on
 * screen is the single most direct way the analysis stops being a discarded
 * report. `default_workflow` is the industry fallback.
 *
 * Capped at six stages: past that the chip row wraps to a third line and
 * stops reading as a pipeline.
 */
/* Exported for lib/portal/live-rows.ts, which needs THIS business's stage
   list to decide a row's tone. A second copy of the same resolution would
   drift the first time the language fallback changed -- this repo has been
   bitten four times by a hand-written second list. */
/**
 * 进货单 does not go through the selling pipeline.
 *
 * ── WHAT THE PAGE SHOWED BEFORE THIS ──────────────────────────────────────
 *
 * 「Purchase orders workflow: Enquiry → Quote → Approved → Deposit → Build →
 * Progress」 -- the contractor's own SALES flow, on the page where he buys
 * cement. Every pipeline module read `workflowStages(ctx)`, which is the one
 * workflow the questionnaire asked about, and that question was about how he
 * sells.
 *
 * ── WHY THIS ONE IS FIXED AND THE OTHERS ARE NOT ──────────────────────────
 *
 * Selling is the trade's own vocabulary -- 报价 · 订金 · 施工 · 尾款 for a
 * contractor, 预约 · 到店 · 服务 for a salon -- and that vocabulary is the
 * product. Buying is not: everybody orders, waits, receives, and pays.
 * ERPNext agrees by construction: its Purchase Order status list is a fixed
 * Select, not a per-customer workflow.
 *
 * And the three are the two INDEPENDENT facts its statuses are built from --
 * 到货了没有 and 付了没有 -- laid out in the order they happen. A purchase
 * order spends most of its life at the middle one, which is exactly the state
 * a single sales-shaped pipeline could not express.
 */
const BUYING_STAGES = {
  zh: ["开了单", "到货了", "付清了"],
  en: ["Ordered", "Received", "Paid"],
} as const;

/** The stages for ONE module. Everything except 进货单 uses this business's
 *  own workflow -- see the note above. */
export function stagesForModule(ctx: BusinessContext, moduleKey?: string | null): string[] {
  if (moduleKey === "purchases") {
    return [...BUYING_STAGES[langOf(ctx) === "en" ? "en" : "zh"]];
  }
  return workflowStages(ctx);
}

export function workflowStages(ctx: BusinessContext): string[] {
  const lang = langOf(ctx);
  // The AI returns the tailored workflow in BOTH languages
  // (lib/openai/analysis-schema.ts), so an English system still gets THIS
  // business's pipeline rather than the generic one. `after_workflow_en` is
  // absent on every analysis written before that field existed, which is
  // exactly when the industry default below is the right answer.
  const fromAnalysis =
    lang === "en"
      ? ctx.analysis?.after_workflow_en
      : ctx.analysis?.after_workflow;
  if (fromAnalysis && fromAnalysis.length > 0) {
    return fromAnalysis
      .slice(0, 6)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const industry = ctx.industry ?? fallbackIndustry(lang);
  return industry.default_workflow
    .slice(0, 6)
    .map((st) => translateStage(st, lang));
}

// ---------------------------------------------------------------------------
// Puck node builders
//
// Puck's `Data` shape is `{ root, content }`, where every entry in `content`
// is `{ type, props }` and every props object needs its own `id` (Puck
// reserves that key internally -- this is why RecordTable's own id prop is
// named `gridId`). Ids are derived from the page key and a running index so
// a regenerated template is byte-identical for the same input, which keeps a
// customer's "unsaved changes" state honest across reloads.
// ---------------------------------------------------------------------------

const node = (
  type: string,
  id: string,
  props: Record<string, unknown>,
): PuckNode => ({
  type,
  props: { id, ...props },
});

// The sample rows and the per-module vocabulary moved to
// lib/templates/copy/ when the system gained a second language: one shape
// (copy/types.ts), one table per language, one dispatch (copy/index.ts).
// They were ~900 lines of Chinese string literals sitting in the middle of
// the layout logic, and doubling them in place would have buried it.

/**
 * The left rail. Identical across all five pages on purpose: it is the one
 * element that makes the five pages read as ONE system rather than five
 * disconnected canvases, which was a real complaint about the first version
 * of the editor. Labels use the business's own nouns.
 */
/**
 * 🔴 2026-09-04 export 出去了。
 *
 * 老板：`不要设计看起来是好像两个人做得一样 一定要统一设计`。
 * 「加一单 · 改这一单 · 搬旧资料」那三页**没有侧栏也没有顶栏** ——
 * 整个系统只有它们长这样，而客户是从系统里点进去的，一进去导航就不见了。
 *
 * 那三页不是 Puck 画的，是普通的 React。所以它们要的是**同一份侧栏的资料**，
 * 不是第二份手写的清单（这个仓库栽在第二份清单上至少六次）。
 * 这一支回传 Puck 节点，那几页读它的 `props` 直接喂给 `<RailNav />`。
 */
export function railNavNode(
  labels: IndustryLabels,
  brandLabel: string,
  businessName: string,
  activePage: PageId,
  locale: string,
  pages: PageRef[],
  lang: SystemLang,
): PuckNode {
  const c = chrome(lang);
  // RailNav derives its own active state from `usePathname()` and each item's
  // href -- there is no `active` prop. The hrefs therefore have to match the
  // real route shape INCLUDING next-intl's locale prefix (`/zh/portal/...`),
  // or every page renders with nothing highlighted, which makes the nav read
  // as decoration rather than as the customer's own system.
  //
  // The items come from the business's OWN page set, not a fixed five: a salon
  // whose account has no `quotations` page must not be shown a nav link to one.
  return node("RailNav", `${activePage}-rail`, {
    brandLabel: brandLabel,
    brandHref: `/${locale}/portal/dashboard`,
    // `group` is required by RailItem and drives RailNav's collapsible
    // sections. One empty-named group keeps every item in a single uncollapsed
    // list, which is right at this size -- grouping four or five things into
    // named sections is overhead, not organisation.
    // `iconName` is the page key itself: RAIL_ICONS (rail-icons.tsx) is keyed
    // by these exact names, so a rail item and its icon can never drift apart,
    // and a page type added here without an icon degrades to a text-only row
    // rather than crashing.
    // A custom page has no entry in RAIL_ICONS, so `railIcon` returns null and
    // the row renders text-only -- the degradation the icon registry was built
    // to have, now actually exercised.
    items: pages.map((page) => ({
      label: pageLabel(page, labels, lang),
      href: `/${locale}/portal/${page.key}`,
      group: navGroup(page.key, pages.length, c),
      iconName: page.key,
    })),
    // These two used to be `notificationsHref: "#"` / `accountHref: "#"` --
    // real links that went nowhere, and that the customer could neither rename
    // nor remove. They belong in the rail (the customer is looking at a preview
    // of the system they are designing, and a real one has notifications and
    // account settings), but as a LIST they own: a wholesaler who wants a 客服
    // row adds one, a one-person business who does not want notifications
    // deletes it. With no href, RailNav renders them as non-navigating rows
    // instead of dead links.
    utilityItems: [
      { label: c.rail.notifications, iconName: "notifications" },
      { label: c.rail.account, iconName: "account" },
    ],
    /*
      THE BUSINESS'S MAIN ACTION, WRITTEN INTO EVERY RAIL AND DRAWN BY ONE.

      Only the `action` variant renders it (工作室 -- see rail-nav.tsx), and it
      is written unconditionally anyway, for the same reason FilterChips' two
      labels are: a register is a choice about APPEARANCE, and switching to one
      that does not draw this button must not delete what the button said.
      Switch to 工作室, rename it, switch to 台账 and back -- the name is still
      there, because it was never the register's to hold.

      It is the SAME action PageHeader already offers, deliberately. Studio
      Admin's rail leads with 「Quick Create」 and their pages carry their own
      buttons too; the rail's copy is the standing offer, the page's is the one
      for the page you are on.
    */
    actionLabel: c.dashboard.primaryAction(
      pageLabel(
        pages.find((p) => ["quotations", "bookings", "orders", "projects"].includes(p.key)) ?? {
          key: "customers",
        },
        labels,
        lang,
      ),
    ),
    actionHref: `/${locale}/portal/${
      pages.find((p) => ["quotations", "bookings", "orders", "projects"].includes(p.key))?.key ??
      "customers"
    }`,
    // The account chip identifies the PERSON, so the email local part belongs
    // here and only here -- it is the one place in the system where "who am I
    // signed in as" is the question being answered.
    userName: businessName,
    userRoleLabel: c.rail.ownerRole,
  });
}

/**
 * Which section of the navigation a page belongs in.
 *
 * WHY THIS IS CONDITIONAL AND NOT ALWAYS ON. rail-nav.tsx's own note argued
 * that one unnamed group is right 「at this size -- grouping four or five things
 * into named sections is overhead, not organisation」, and that was correct for
 * a five-page system. It stopped being correct once the module catalogue let a
 * business have twelve. Eleven competitors' dashboards were photographed on
 * 2026-08-25 and every one of them sections its navigation; ours was a flat
 * list of six words, which was one of the six differences visible to the naked
 * eye between their first screen and ours.
 *
 * So both readings hold, on either side of a line: under six pages there is
 * nothing to organise and the sections would be three headings over one item
 * each; at six and above the headings are the only thing that stops the list
 * being scanned from the top every time.
 *
 * THE SECTIONS ARE THE OWNER'S DAY, not the data model. 报价单 sits with 客户 and
 * 收款 because that is one morning's work; 对账 and 佣金 sit together because
 * that is the end of the month; 官网 is alone because it is the only page whose
 * reader is a stranger.
 */
/* 记录页那三页也要同一条面包屑跟同一份分组词 —— 见 record-context.ts。 */
export function navGroup(key: string, pageCount: number, c: Chrome): string {
  if (pageCount < 6) return "";
  const g = c.rail.groups;
  switch (key) {
    case "dashboard":
    case "customers":
    case "quotations":
    case "bookings":
    case "orders":
    case "payments":
      return g.daily;
    case "projects":
    /* 任务 fell through to the default branch and therefore into 日常, beside
       a comment saying that branch exists for pages the AI named itself. It
       is a built-in, and a task belongs next to the 项目 it hangs off: one is
       the job, the other is a day of it. */
    case "tasks":
    case "inventory":
    case "suppliers":
    case "staff":
      return g.work;
    case "reconciliation":
    case "commission":
    case "expenses":
      return g.books;
    case "reports":
    case "ranking":
      return g.reports;
    case "website":
      return g.publicFacing;
    default:
      // A page the AI named itself. It belongs with the daily work rather than
      // in a section of its own -- a heading over one custom row reads as a
      // mistake, and this is the section an owner opens first anyway.
      return g.daily;
  }
}

function recordTable(
  id: string,
  caption: string,
  labels: {
    primary: string;
    secondary?: string;
    amount?: string;
    status?: string;
  },
  rows: {
    primary: string;
    secondary?: string;
    amount?: string;
    tone: StatusTone;
    status: string;
  }[],
  /** Segment labels above the table. Only the dashboard passes them: on a page
   *  whose whole content IS this table the segments duplicate the page's own
   *  filter row, and two filter controls that do not agree is worse than one. */
  filters?: string[],
  /** 这一张清单的第一栏是一个人／一家店，不是一件事。见 record-table.tsx。 */
  faces?: boolean,
  /** 上面那一排分段自己从行里算 —— 见 record-table.tsx 的 `segments`。 */
  segments?: boolean,
  /** 🔴 写进来就赢过风格，而这里是**故意的**（跟 `Columns` 的排法同一条，
   *  见 system-vocabulary.test.ts 的第二种例外）：
   *  「库存这一页画成一片格子」讲的是**这一页在问什么**，不是这一套风格
   *  长什么样。五金店老板扫的是「架上还有几包」——
   *  那是一个数字，不是四栏字。风格照旧决定颜色、圆角、字。 */
  look?: "cards",
): PuckNode {
  // Columns are an array, not four props -- see lib/portal/table-model.ts. The
  // built-in keys are deliberately the old prop names, so a generated table and
  // an upgraded saved one are the same object and nothing downstream has to
  // know which it is looking at.
  const columns: TableColumn[] = [
    { key: "primary", label: labels.primary, kind: "text" },
  ];
  if (labels.secondary)
    columns.push({ key: "secondary", label: labels.secondary, kind: "detail" });
  if (labels.amount)
    columns.push({ key: "amount", label: labels.amount, kind: "amount" });
  columns.push({
    key: "status",
    label: labels.status ?? "Status",
    kind: "status",
  });

  return node("RecordTable", id, {
    gridId: id,
    caption,
    ...(faces ? { faces: true } : {}),
    ...(segments ? { segments: true } : {}),
    ...(look ? { look } : {}),
    ...(filters?.length ? { filters: filters.map((label) => ({ label })) } : {}),
    table: {
      columns,
      rows: rows.map((r) => ({
        cells: {
          primary: r.primary,
          secondary: r.secondary ?? "",
          amount: r.amount ?? "",
          status: r.status,
        },
        tones: { status: r.tone },
      })),
    },
  });
}

/*
  🔴 `filterChips()` 被拿掉了（2026-09-05）。

  它产的每一颗 chip 都是 `removeHref: "#"`，`clearAllHref` 也是 `"#"`。
  所以那一行同时讲两句不是真的话 ——「已筛选：等回覆」，而底下那张表七行
  一行都没少；那颗 × 按下去什么都不会发生。**一个按不动的控件是缺陷，
  不是装饰**（任务 15 的假 ⌘K、任务 94 · 111 都记过同一件）。

  取代它的不是另一排刻死的分段，是那张表**自己从行里算出来的**那一排
  （`recordTable(..., segments)` → `record-table.tsx` 的 `autoSegments`）。
  差别是：刻在这一层的只看得到示例，而客户第一笔真记录一进来示例就整批
  消失；表自己算的那一排永远是他手上真的有的那几种状态。

  `FilterChips` 这个组件**没有删** —— 它本身是对的，只是要有人把网址接上
  才有资格出现。`layout-upgrade.ts` 会把已经存过的、每一颗都指着 "#" 的
  那一排拿掉；接过网址的那一种一个都不碰。
*/

/**
 * The bottleneck's name in the system's language, or nothing.
 *
 * The AI names the bottleneck in the language the owner answered the
 * questionnaire in, and that name is printed on the page whose job is to fix
 * it. Under an English system that produced 「Watch this: 报价追不动」 -- an
 * English prefix welded to a Chinese phrase, on the customer's own screen.
 *
 * Same rule as `summary_en` a few hundred lines up, and the same reason:
 * a generic English subtitle loses this business's own words; a Chinese
 * subtitle under an English heading loses the reader. The generic line wins,
 * so this returns null and the caller falls back to it.
 */
function focusTitle(ctx: BusinessContext, lang: SystemLang): string | null {
  const b = ctx.analysis?.bottlenecks?.[0];
  if (!b) return null;
  const own = lang === "en" ? b.title_en : b.title;
  return own?.trim() || null;
}

function workflowStrip(
  id: string,
  title: string,
  stages: string[],
  attentionAt = 0,
): PuckNode {
  return node("WorkflowStrip", id, {
    title,
    stages: stages.map((label, i) => ({
      label,
      // The stage the AI flagged as the bottleneck is marked, so the analysis
      // shows up as a highlighted step in the customer's own pipeline rather
      // than as prose they have to re-read.
      tone: i === attentionAt ? "attention" : "normal",
    })),
  });
}

// ---------------------------------------------------------------------------
// The five page templates
// ---------------------------------------------------------------------------

/**
 * 他自己那一句 —— 两分钟问卷问出来、AI 写下来的那一行。
 *
 * ⚠️ **没有跨语言凑合**，而这是第一次用英文渲染逼出来的更正：`summary_en`
 * 缺的时候退回中文的 `summary`，会在一个英文系统的第一屏放一句中文。
 * 拿不到就回 undefined，让呼叫的人自己决定要不要退回一句通用的话。
 *
 * 🔴 2026-09-04 抽出来。总览照 arhamkhnz 拿掉页面标题之后，这一句本来
 * **没有家了** —— 它是整个产品唯一一句证明「我们真的听了你讲那两分钟」的话，
 * 而一个算出来却到不了画面的值正是这个仓库犯过十七次的那件事。
 * 现在顶栏那一条右边也读它（`crumbNote`），所以它只能有一份。
 */
export function ownSummaryOf(ctx: BusinessContext, lang: SystemLang): string | undefined {
  return lang === "en"
    ? ctx.analysis?.summary_en?.trim()
    : ctx.analysis?.summary?.trim();
}

function buildDashboard(
  ctx: BusinessContext,
  name: string,
  locale: string,
  pages: PageRef[],
  /** The register this page will be rendered in. It decides which blocks the
   *  page is MADE OF -- see dashboardComposition below. Optional because two
   *  callers build a page without a customer attached (the spec document, the
   *  founder console); those get the neutral composition. */
  style?: string | null,
  /** projects.layout — a NAMED arrangement that overrides the register's own.
   *  Null follows the register, which is what most accounts do. */
  layout?: string | null,
): PuckNode[] {
  const lang = langOf(ctx);
  const c = chrome(lang);
  const industry = ctx.industry ?? fallbackIndustry(lang);
  const brand = displayBusinessName(ctx);
  const labels = labelsFromPages(industryLabels(industry, lang), pages);
  const sample = sampleFor(industry.slug, lang);

  // The AI's own one-line summary of this business, on the first screen the
  // customer sees after signing up. This single line is the clearest possible
  // signal that the questionnaire was not a form that went nowhere.
  // The AI writes the summary in both languages so an English system still
  // opens on THIS business rather than on a generic line about its trade.
  //
  // NO CROSS-LANGUAGE FALLBACK, and this is the correction the first English
  // render forced. Falling back to `summary` when `summary_en` was missing --
  // which it is on every analysis written before 2026-08-22 -- put one Chinese
  // sentence under an English heading, on the first screen of the system. A
  // generic English line loses this business's own words; a Chinese line in an
  // English page loses the reader. The generic line wins.
  const ownSummary = ownSummaryOf(ctx, lang);
  const subtitle = ownSummary || c.dashboard.subtitle(industryName(industry, lang));

  // WHY THE HERO CARD IS NO LONGER HERE, 2026-08-25.
  //
  // This page opened with one HeroCard carrying a headline figure, three
  // supporting numbers set as small text along its bottom edge, and a sparkline
  // thin enough to be invisible in a screenshot. Below it, a workflow strip and
  // a table. Three blocks, no chart, and on the wider registers a quarter of a
  // screen of empty ground underneath.
  //
  // Eleven competitors' dashboards were photographed at the same viewport on
  // the same day -- Tabler, AdminLTE, Ant Design Pro, Art Design Pro,
  // vue-element-admin, ngx-admin, shadcn-admin and the rest. Every one of them
  // opens with ten to fourteen blocks and two to four charts. The founder,
  // looking at the pair: 「我们的风格跟模板都比外面那些人自己创建的差很多」.
  //
  // The diagnosis was not the paint. Sixteen registers are tuned to a tenth of
  // a point and every one of them was rendering a page with nothing on it. And
  // it matters more here than anywhere else in the product, because this screen
  // IS the pitch -- 「先看到你的系统，再决定要不要做」 is answered by this exact
  // viewport, once, before any money changes hands.
  //
  // So the same numbers are now spent differently:
  //
  //   HeroCard        →  StatRow, four tiles with icons, deltas and a reading
  //                      (「好消息 / 要注意 / 坏消息」) instead of three lines of
  //                      grey text. The one-figure hierarchy HeroCard argued
  //                      for is not lost -- it is the `lead` variant, and 蓝图
  //                      and 夜 ask for it. HeroCard stays in the palette.
  //   its sparkline   →  TrendChart, a real chart with axes and a shape.
  //   nothing         →  ShelfList, the three things to act on today, built
  //                      from the same records the table below already shows,
  //                      so it costs no new invented data.
  const followHref = `/${locale}/portal/${pages.find((p) => p.key === "customers")?.key ?? "dashboard"}`;

  /**
   * EVERY BLOCK THIS PAGE KNOWS HOW TO BUILD, keyed by the JOB it does.
   *
   * A register picks a subset and an order (`compose`, below). Two registers
   * that both want "the headline figure" get a different OBJECT for it -- a
   * four-tile row, a single hero card, or two oversized numbers -- because they
   * are different designs, not one design in two colours.
   */
  const blocks: Record<string, () => PuckNode> = {
    /** Four tiles across. The console answer: everything visible at once. */
    stats4: () =>
      node("StatRow", "dashboard-stats", {
        tiles: [
          {
            label: sample.heroLabel,
            value: sample.heroValue,
            // THE NUMBER THE LABEL WAS ALREADY PROMISING. The tile said
            // 「vs last month」 and showed no change beside it -- a caption for
            // a figure that was not there. Every reference dashboard puts the
            // percentage next to the total (「+20.1% from last month」,
            // 「周同比 12% ▲」), and stat-row.tsx has drawn both a delta and a
            // 52px sparkline since the day it was written. Neither was ever
            // passed. Fourth time in this repo that a capability existed and
            // the wire to it did not.
            //
            // Derived from heroSpark rather than invented: it is the change
            // between the last two of the six periods the chart below is
            // already drawing, so the tile and the chart cannot disagree.
            delta: headlineDelta(sample.heroSpark),
            deltaLabel: sample.heroSuffix,
            /* 上一期的实数，跟上面那个百分比来自同一个阵列 —— 所以卡片上的
               三样（数字 · 涨跌 · 上个月）永远不会互相矛盾。
               ⚠️ 抄的是 Studio Admin 的招牌动作：他们四张卡每一张底下都有
               「$254,200 last month」。少了它，我们只讲了「涨了」，
               没有讲「从多少涨的」。 */
            previous: previousFigure(sample.heroSpark, sample.heroValue),
            spark: sample.heroSpark,
            tone: "good",
            iconName: "payments",
            href: `/${locale}/portal/payments`,
          },
          ...sample.heroStats.map((st, i) => ({
            label: st.label,
            value: st.value,
            deltaLabel: st.sub ?? "",
            // The sample files speak HeroCard's vocabulary ("caution"/"warn");
            // StatRow reads the FIGURE rather than the direction.
            tone: st.tone === "warn" ? "bad" : st.tone === "caution" ? "warn" : "normal",
            iconName: ["projects", "quotations", "reconciliation"][i] ?? "dashboard",
            href: `/${locale}/portal/payments`,
          })),
        ],
      }),

    /** Two tiles. For a register whose type is too large for four across --
     *  大字 at 17px base truncates every label at four. */
    stats2: () =>
      node("StatRow", "dashboard-stats", {
        tiles: [
          {
            label: sample.heroLabel,
            value: sample.heroValue,
            delta: headlineDelta(sample.heroSpark),
            deltaLabel: sample.heroSuffix,
            spark: sample.heroSpark,
            tone: "good",
            iconName: "payments",
            href: `/${locale}/portal/payments`,
          },
          {
            label: sample.heroStats[2]?.label ?? sample.heroStats[0].label,
            value: sample.heroStats[2]?.value ?? sample.heroStats[0].value,
            deltaLabel: sample.heroStats[2]?.sub ?? "",
            tone: "bad",
            iconName: "reconciliation",
            href: `/${locale}/portal/payments`,
          },
        ],
      }),

    /** ONE figure with its supporting numbers beneath it -- the argument
     *  hero-card.tsx makes in its own header, given to the registers that
     *  agree with it. A different object from a tile row, not a restyled one. */
    hero: () =>
      node("HeroCard", "dashboard-hero", {
        label: sample.heroLabel,
        value: sample.heroValue,
        href: `/${locale}/portal/payments`,
        /*
          THE CHANGE, WHICH WAS MISSING.

          StatRow has printed 「↑13.2% vs last month」 since headlineDelta was
          written; HeroCard passed only the suffix, so 招牌 and 柔和 -- the two
          registers whose whole dashboard leads with ONE number -- printed
          「RM 71,300  vs last month」 with nothing between. A comparison word
          with no comparison in it. Screenshotted on both, 2026-08-26.

          Same source as the stat tiles, so the two can never disagree about
          the same month.
        */
        chg: headlineDelta(sample.heroSpark),
        chgSuffix: sample.heroSuffix,
        stats: sample.heroStats.map((st) => ({
          ...st,
          href: `/${locale}/portal/payments`,
        })),
        spark: sample.heroSpark.map((n) => ({ n })),
        sparkLabel: c.dashboard.sparkLabel.replace("{n}", String(sample.heroSpark.length)),
      }),

    trend: () => {
      // THE AXIS SAYS WHICH MONTHS, NOT HOW MANY BACK.
      //
      // It used to read −5 −4 −3 −2 Last Now, from copy/chrome.ts. That is
      // defensible in the abstract -- the chart is a shape, and a generated
      // system has no real dates yet -- but put it beside Ant Design Pro's own
      // dashboard, whose axis reads 1月 2月 3月, and ours is the one that looks
      // like a placeholder somebody forgot to fill in. It is also less true:
      // the caption already promises the last six periods, and the last six
      // periods have names.
      //
      // Derived from today rather than stored, so it is right in December and
      // right next year, and it says the same thing the caption says.
      const now = new Date();
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return lang === "zh"
          ? `${d.getMonth() + 1}月`
          : d.toLocaleDateString("en-US", { month: "short" });
      });
      return node("TrendChart", "dashboard-trend", {
        title: c.dashboard.trendTitle,
        caption: c.dashboard.trendCaption.replace("{n}", String(sample.heroSpark.length)),
        /* 卡头上那个「看多久」。四个参考页的图表卡头都有一个控件，
           我们的一直是空的（[任务 24](../../docs/founder-tasks.md)）。
           **它是真的会换的** —— 按 6 就真的只画最近六根，
           而底下那句说明的数字跟着变，所以那句话永远是真的。
           `12` 那一格只在他真的有十二期的时候才出现。 */
        ranges: [6, 12],
        captionTemplate: c.dashboard.trendCaption,
        unit: "RM",
        points: sample.heroSpark.map((value, i) => ({
          label: months[i] ?? "",
          value,
        })),
      });
    },

    /** A year of activity as squares. No axis and no figures -- texture where
     *  another register wants a chart. */
    activity: () =>
      node("ActivitySquares", "dashboard-activity", {
        label: c.dashboard.trendCaption.replace("{n}", String(sample.heroSpark.length)),
      }),

    /** How far through the month the money is. One bar, one number. */
    progress: () =>
      node("Progress", "dashboard-progress", {
        label: sample.heroLabel,
        value: 68,
      }),

    todo: () =>
      node("ShelfList", "dashboard-today", {
        /* 同 ranking：标题搬到卡头。 */
        heading: "",
        items: sample.records.slice(0, 3).map((r) => ({
          title: r.primary,
          description: r.status,
          icon: "work",
          action: c.dashboard.todoAction,
          href: followHref,
        })),
      }),

    /** The same day as a BOARD rather than a list: columns by stage.
     *
     *  TaskBoard takes stages and cards as TWO flat arrays, not stages that
     *  contain their cards -- a card names its column by string. The first
     *  version nested them and the block rendered as nothing at all, which is
     *  the honest failure mode for a board with no columns but invisible in
     *  every test. Caught by looking at 粗野 and seeing an empty half-page. */
    board: () => {
      const stages = workflowStages(ctx).slice(0, 3);
      return node("TaskBoard", "dashboard-board", {
        stages: stages.map((name) => ({ name })),
        cards: sample.records.slice(0, 3).map((r, i) => ({
          title: r.primary,
          stage: stages[i % stages.length],
          note: [r.secondary, r.amount].filter(Boolean).join(" · "),
        })),
      });
    },

    /**
     * Who is worth the most.
     *
     * WAS A MarkList, WHICH WAS THE WRONG OBJECT. It drew one line of text per
     * name -- 「1. Mr Tan · RM 48,500」 -- and a column of figures joined to
     * their labels by a middle dot cannot be scanned. Both dashboards the
     * founder sent on 2026-08-25 flush the number to the right edge, because
     * that is what makes nine rows readable as a ranking rather than as nine
     * sentences. See design-system/components/rank-list.tsx.
     *
     * The shape is the register's to choose and this deliberately does not
     * name one: 台账 gets a numbered line, 仪表盘 a medal badge, 柔和 a person
     * with an avatar -- three different objects, which is the only kind of
     * difference a palette cannot flatten.
     */
    ranking: () =>
      node("RankList", "dashboard-ranking", {
        /* 标题搬到外面那张卡的头上去了（见 build 里的 CARD_HEAD），
           因为卡头右边要放「看全部」，而那一行只有卡头有。
           留在这里会**印两次标题**。 */
        heading: "",
        /* 🔴 **按金额从大排到小**（2026-09-03 放大两倍看到的）。
           在这之前它照记录本来的顺序印，於是画面上是
           「1 Mr Tan RM48,500 · 2 Mrs Lee RM22,800 · **3 Mr Wong RM96,000**」
           —— 一张写着「谁最值钱」的榜，第三名是最大的那个数字。
           编号本身就是在宣称「已经排过了」，那句宣称当时是假的。
           没有金额的排在后面，而且**保持他自己的顺序**（不是当成 0 往前塞）。 */
        rows: [...sample.records]
          .map((r) => ({
            name: r.secondary ?? r.primary,
            sub: r.secondary ? r.primary : r.status,
            amount: r.amount ?? "",
            href: followHref,
            _n: Number(String(r.amount ?? "").replace(/[^0-9.]/g, "")),
          }))
          .sort((a, b) => {
            const x = Number.isFinite(a._n) && a._n > 0 ? a._n : -1;
            const y = Number.isFinite(b._n) && b._n > 0 ? b._n : -1;
            return y - x;
          })
          .map(({ _n, ...row }) => row),
      }),

    /**
     * WHERE THE MONEY IS SITTING, by stage.
     *
     * A different question from `trend`, which is why it is a different block
     * rather than a fourth TrendChart kind: trend answers "how much, over
     * time"; this answers "how does the whole split up". Ant Design Pro runs
     * both on one screen for that reason.
     *
     * Derived from the same records the table below is already showing, so the
     * two can never disagree, and grouped by STATUS because that is the split
     * an owner acts on -- 「多少钱卡在报价阶段」 is a question with a next step
     * attached, unlike a split by month.
     *
     * Colours come from --chart-1..3, which every token file defines, so a
     * register with no jade in its palette still resolves to its own hues.
     */
    share: () => {
      const byStatus = new Map<string, number>();
      for (const r of sample.records) {
        // "RM 48,500" -> 48500. A record with no amount contributes nothing
        // rather than a zero slice, which would draw an empty wedge with a
        // label on it.
        const n = Number(String(r.amount ?? "").replace(/[^0-9.]/g, ""));
        if (!n) continue;
        const key = r.status || c.col.status;
        byStatus.set(key, (byStatus.get(key) ?? 0) + n);
      }
      /*
        ONE HUE IN STEPS, NOT FIVE HUES.

        This read `var(--chart-${i % 5 + 1})`, which is primary / jade / brass /
        clay / slate -- five different hues in one donut. The founder, looking
        at the gallery: 「还是有很花哨的颜色 不是说了 不要用这些颜色了吗」. He is
        right, and the reason is stronger than taste: these slices are not five
        different things. They are five STAGES OF ONE PIPELINE -- where the
        money is sitting -- and a categorical palette says they are unrelated.
        Parts of one whole take a sequential ramp, which is also what every
        reference does with a share.

        Mixed toward the card rather than toward black, so the ramp lands on
        the register's own surface: 夜's steps stay dark, 瓷's stay warm, and a
        register whose primary is already pale does not fade into its page.
      */
      const slices = [...byStatus.entries()].map(([label, value], i, all) => ({
        label,
        value,
        color: `color-mix(in oklab, var(--color-primary) ${Math.round(
          100 - (i / Math.max(1, all.length - 1)) * 62,
        )}%, var(--color-ink-850))`,
      }));
      return node("ShareChart", "dashboard-share", {
        title: c.dashboard.shareTitle,
        caption: "",
        unit: "RM",
        slices,
      });
    },

    /**
     * 目标卡 —— 一个半圆表，底下三个小数字。
     *
     * 老板 2026-09-03：`还是很多不一样的不是吗 总之找抄就是了`。
     * 卡住的不是力气，是**零件**：参考那几页由四种图组成，我们只画得出两种。
     * 这一块是数出来最常见的那一种 —— **TailAdmin 的 Monthly Target 是它，
     * Tabler 的 78% 那一格也是它**，而我们一个都没有。
     *
     * ⚠️ **它不是新组件，是一个新的拼法。** 半圆表（`gauge`）跟小数字排
     * 早就在库里，只是从来没有人把它们拼成一张卡 —— 这个仓库最常犯的错
     * 就是「零件都有、没有人接线」。
     *
     * ⚠️ 三个小数字**全部是算出来的**：这个月收到多少、几单在做、几张单在等回覆。
     * 没有编一条「目标」出来 —— 一条没有人维护的目标线，就是[任务 40](../../docs/founder-tasks.md)
     * 砍掉那个百分比换个位置回来。半圆表画的是**钱卡在哪一段**，那是真的。
     */
    target: () => {
      const byStatus = new Map<string, number>();
      for (const r of sample.records) {
        const n = Number(String(r.amount ?? "").replace(/[^0-9.]/g, ""));
        if (!n) continue;
        const key = r.status || c.col.status;
        byStatus.set(key, (byStatus.get(key) ?? 0) + n);
      }
      const slices = [...byStatus.entries()].map(([label, value], i, all) => ({
        label,
        value,
        color: `color-mix(in oklab, var(--color-primary) ${Math.round(
          100 - (i / Math.max(1, all.length - 1)) * 62,
        )}%, var(--color-ink-850))`,
      }));
      return node("Panel", "dashboard-target", {
        title: c.dashboard.shareTitle,
        description: "",
        body: [
          node("ShareChart", "dashboard-target-gauge", {
            title: "",
            caption: "",
            unit: "RM",
            shape: "gauge",
            slices,
          }),
          node("StatRow", "dashboard-target-figures", {
            tiles: [
              { label: sample.heroLabel, value: sample.heroValue, tone: "normal" },
              /* 🔴 三个变两个。TailAdmin 那张卡底下是三个（Target · Revenue ·
                 Today），而**他们的数字是「$20K」，我们的是「RM 71,300」** ——
                 同样的宽度，我们的字长一倍。1:1 的裁图上，
                 「RM 71,300」的最后一个 0 被卡片边切掉了。
                 抄的是「半圆表底下带几个小数字」这个形状，不是那个数量；
                 **为了凑三个而切掉客人的钱，是把抄变成了错。** */
              ...sample.heroStats.slice(0, 1).map((st) => ({
                label: st.label,
                value: st.value,
                tone: "normal" as const,
              })),
            ],
          }),
        ],
      });
    },

    /**
     * 一张卡，三个页签 —— 同一笔钱换三个角度看。
     *
     * 抄的是 TailAdmin 的 Statistics 卡跟 Ant 的图表卡：图表卡的头上带控件，
     * 不是一张光秃秃的图。老板 2026-09-03：`我都给你图 照着补零件啊`。
     *
     * ⚠️ **三个页签里必须是三件不同的事。** 三张一样的图配三个名字，
     * 是这个仓库禁掉过的那种谎（跟「画一颗接不到东西的按钮」同一类）。
     * 走势答「这半年怎么走」、占比答「钱卡在哪一段」、流程答「一单走到哪」——
     * 三个问题，三个真答案。
     *
     * ⚠️ 一样不用新组件：分页面板、走势图、占比图、流程条全部在库里，
     * 这里只是**第一次把它们装进同一张卡**。
     */
    tabbed: () =>
      node("TabbedPanel", "dashboard-tabbed", {
        oneLabel: c.dashboard.tabTrend,
        twoLabel: c.dashboard.tabShare,
        threeLabel: c.dashboard.tabFlow,
        one: [blocks.trend()],
        two: [blocks.share()],
        three: [
          workflowStrip(
            "dashboard-tabbed-flow",
            "",
            workflowStages(ctx),
          ),
        ],
      }),

    /**
     * 一排小格子 —— 三个不抢戏的数字并排。
     *
     * 抄的是 Tabler 仪表盘第三排那四个小 tile（132 Sales · 78 Orders …）：
     * 比指标卡小一号，一行放得下好几个，答的是「顺带看一眼」的问题。
     * 老板 2026-09-03：`我都给你图 照着补零件啊`。
     *
     * ⚠️ 三个不是四个。他们的字是「132 Sales」，我们的是「RM 71,300」——
     * 同样的宽度我们的字长一倍，凑到四个就会切字（目标卡刚刚栽过一次）。
     * 抄的是「一排小格子」这个形状，不是那个数量。
     */
    tiles: () => {
      /* 三个数字全部从同一份记录算出来，而三个都不是指标排上的那几个。
         算不出来的时候（没有金额）就印他自己那一栏的字，不印 0 ——
         「RM 0」跟「还没有」是两句不同的话，只有一句是真的。 */
      const amounts = sample.records
        .map((r) => Number(String(r.amount ?? "").replace(/[^0-9.]/g, "")))
        .filter((n) => Number.isFinite(n) && n > 0);
      const money = (n: number) => `RM ${Math.round(n).toLocaleString("en-MY")}`;
      const biggest = amounts.length ? money(Math.max(...amounts)) : "—";
      const average = amounts.length
        ? money(amounts.reduce((a, c) => a + c, 0) / amounts.length)
        : "—";
      /* 🔴 `delta: null` 要写出来，不可以省（2026-09-03 放大两倍看到的）。
         省掉的话 Puck 会拿 `SmallStat` 的 `defaultProps` 补上 `delta: 8`，
         而 `StatCard` 把它当成倍数 —— 画出来是 **「↑ +800% vs last month」，
         三张卡一模一样**。三个数字全部是从他这几笔记录当场算出来的，
         **没有上个月可以比**，所以没有涨跌才是真话。
         一个凭空冒出来的 800%，比少一行字贵得多。 */
      const tile = (id: string, label: string, value: string) =>
        node("SmallStat", id, { label, value, delta: null, period: null });
      return node("Columns", "dashboard-tiles", {
        layout: "thirds",
        a: [tile("dashboard-tile-a", c.dashboard.tileCount, String(sample.records.length))],
        b: [tile("dashboard-tile-b", c.dashboard.tileBiggest, biggest)],
        c: [tile("dashboard-tile-c", c.dashboard.tileAverage, average)],
      });
    },

    /**
     * 快捷入口 —— Ant 的工作台右边那张「快速开始 / 便捷导航」。
     *
     * ⚠️ 每一格都是**他自己已经有的那一页**，网址是真的。
     * 官网那一页不放进来（那是给陌生人看的，不是他每天要按的），
     * 总览自己也不放（他已经站在上面了）。
     * 最多六个 —— 侧栏负责列全部，这一块只放「今天最可能要按的」。
     */
    quick: () =>
      node("QuickLinks", "dashboard-quick", {
        heading: c.dashboard.quickTitle,
        links: pages
          .filter((pg) => pg.key !== "dashboard" && pg.key !== "website")
          .slice(0, 6)
          .map((pg) => ({
            label: pageLabel(pg, labels, lang),
            href: `/${locale}/portal/${pg.key}`,
            iconName: pg.key,
          })),
      }),

    /**
     * 问候带 —— 工作台那一页的开场。见 greet-band.tsx 的档头。
     *
     * ⚠️ **没有「早安」。** 那句话要看现在几点，而这一页是在伺服器上画的 ——
     * 伺服器的时间不是他的时间，而且同一张缩图每拍一次就换一句。
     * 换成他自己的招牌加一句今天的实况：两句都不会变，而且都是真的。
     */
    greet: () => {
      const amounts = sample.records
        .map((r) => Number(String(r.amount ?? "").replace(/[^0-9.]/g, "")))
        .filter((n) => Number.isFinite(n) && n > 0);
      const money = (n: number) => `RM ${Math.round(n).toLocaleString("en-MY")}`;
      const today = Math.min(3, sample.records.length);
      return node("GreetBand", "dashboard-greet", {
        monogram: name.slice(0, 2),
        line: name,
        sub: c.dashboard.greetSub.replace("{n}", String(today)),
        figures: [
          { label: c.dashboard.tileCount, value: String(sample.records.length) },
          { label: c.dashboard.tileBiggest, value: amounts.length ? money(Math.max(...amounts)) : "—" },
          /* 第三个。Ant 那一条是**三格**（项目数 / 团队内排名 / 项目访问），
             2026-09-03 放大并排才数清楚。三格是它右半边撑得住的原因 ——
             两格摆在同样的宽度里，右边会空一段。 */
          {
            label: c.dashboard.tileAverage,
            value: amounts.length
              ? money(amounts.reduce((a, b) => a + b, 0) / amounts.length)
              : "—",
          },
        ],
      });
    },

    flow: () =>
      workflowStrip(
        "dashboard-workflow",
        c.dashboard.workflowTitle,
        workflowStages(ctx),
      ),

    table: () =>
      recordTable(
        "dashboard-recent",
        c.dashboard.recent(labels.order),
        {
          primary: labels.order,
          secondary: labels.customer,
          amount: c.col.amount,
          status: c.col.status,
        },
        sample.records,
        c.dashboard.recentFilters,
      ),
  };

  /**
   * THE REGISTER PICKS THE PAGE, NOT JUST THE PAINT.
   *
   * The founder, on 2026-08-25, looking at eighteen registers side by side:
   * 「怎么全部看起来又一样呢？不是说要用不同的元件 去设计不同的风格吗 为什么每次
   * 都讲不听」. He was right, and the number that told me otherwise was worthless.
   * `check:registers` hashes structural CSS classes, so an 8px difference in
   * rail width made two identical pages "distinct" -- it answered "are any two
   * byte-identical", never "do these look like different designs".
   *
   * The cause was right here. buildDashboard returned ONE array for all
   * eighteen -- rail, header, StatRow, TrendChart, ShelfList, WorkflowStrip,
   * RecordTable -- and the entire variant layer could only change how each of
   * those seven was PAINTED. Three hundred preferences over one skeleton.
   *
   * A composition is the skeleton. 台账 opens on its table, because a ledger IS
   * a table. 墨 opens on one figure and a great deal of air. 仪表盘 puts four
   * tiles and a chart above the fold because that is what a console is. 大字
   * gets two oversized figures and no chart at all, because a chart at that
   * type size is unreadable to the person the register exists for.
   *
   * WHY IT COSTS NO MIGRATION: this function runs on READ. A generated page is
   * a read-side default until the customer's first save (see the note in
   * app/[locale]/portal/[pageKey]/page.tsx), so the style is known at the
   * moment the page is built, and changing register re-lays-out the page on the
   * same click that repaints it -- which is what 换风格 was always meant to do.
   */
  /**
   * WHICH BLOCKS NEED SOMETHING TO SIT IN.
   *
   * Measured, not guessed. Sampling reg-Console.png on 2026-08-25: the page
   * ground is #f1f5f9 and the stat tiles are #ffffff -- so the register's
   * card/ground step EXISTS and works. But the pixel under the ranking is
   * #f1f5f9 and so is the pixel under the workflow: those blocks were drawn
   * straight onto the ground with nothing around them. Half the page was
   * cards on slate and half was ink on slate.
   *
   * That is the honest answer to 「为什么我们的平台就做不到呢」. Ant Design Pro
   * is not better-looking block by block; every one of its blocks is a white
   * card on a grey ground, and ours were cards only where the block happened
   * to draw its own. The missing thing was never inside a block.
   *
   * WHY Panel AND NOT A CARD PROP ON EACH. Panel already has four looks --
   * card, tinted, ruled, plain -- and every register already declares which
   * one it wants (design-doc.ts). Until now the dashboard emitted no Panel at
   * all, so eighteen registers each had a section preference that reached
   * nothing. Wrapping here connects a wire that was already drawn: 玻璃 gets
   * translucent cards, 瑞士 gets a hairline over each section, 墨 gets nothing
   * at all -- which is 墨's entire argument and must stay possible.
   *
   * HEADERLESS ON PURPOSE. Each of these blocks already draws its own heading
   * -- RecordTable's has a row count and filter segments beside it -- so the
   * Panel is a surface, not a second title. Panel renders no header when it
   * has no title (puck-config.tsx).
   */
  const NEEDS_SECTION = new Set([
    "activity",
    "progress",
    "todo",
    "board",
    "ranking",
    "flow",
    "table",
    /* Ant 那张「快速开始」是**一张卡**，不是几颗药丸浮在地上。
       它自己的标题留在块里（CARD_HEAD 没有它 —— 那张卡没有「看全部」）。 */
    "quick",
  ]);

  /**
   * 哪几块的标题要搬到卡头上，而且卡头右边挂一个「看全部」。
   *
   * 老板 2026-09-03：`有改进 但是还有很多进步空间 用眼睛就能看得出`。
   * 原尺寸并排看，**六个参考页每一张卡的头上都有一个连结**
   * （Ant「全部项目」· Tabler「New view」· shadcn「View」），我们六套一个都没有。
   *
   * ⚠️ 只给「这张卡是另一页的摘要」那几块 —— 今天要跟的、最大的几个客户。
   * 一张走势图上挂「看全部」，那句话没有去处。
   * ⚠️ 连的是**真的存在的那一页**，不是 `#`。
   */
  const CARD_HEAD: Record<string, { title: string; href: string }> = {
    todo: { title: c.dashboard.todoTitle, href: followHref },
    ranking: { title: c.dashboard.rankingTitle, href: `/${locale}/portal/customers` },
  };

  let seq = 0;
  const build = (role: string): PuckNode | null => {
    const make = blocks[role];
    if (!make) return null;
    const inner = make();
    if (!NEEDS_SECTION.has(role)) return inner;
    const head = CARD_HEAD[role];
    // `look` is deliberately absent: puck-config-client fills it from the
    // register's preference, and a value here would out-rank the register.
    return node("Panel", `dashboard-section-${role}-${(seq += 1)}`, {
      title: head?.title ?? "",
      description: "",
      body: [inner],
      ...(head ? { actionLabel: c.dashboard.seeAll, actionHref: head.href } : {}),
    });
  };

  /**
   * 排法 -- the axis above composition.
   *
   * A composition entry is either one role ("table"), or two side by side
   * ("trend|ranking"), with an optional proportion ("todo|stats2@half").
   * Everything used to be one column stacked downwards no matter which
   * register it was, which is why eighteen genuinely different compositions
   * still produced eighteen pages of the same SHAPE. A console puts its
   * ranking beside its chart; a ledger does not. That is a layout decision and
   * it belongs to the register, like the composition itself.
   *
   * Below `md` Columns collapses to one column on its own, so a split costs
   * nothing on a phone.
   */
  const compose = (entry: string): PuckNode | null => {
    const [roles, proportion] = entry.split("@");
    const parts = roles.split("|");

    if (parts.length === 1) return build(parts[0]);

    // THREE PARTS IS A BENTO: the first gets the room, the other two sit
    // beside it, and the three cells are cut from ONE rectangle so the tall
    // one is exactly as tall as the two short ones plus the gap. Two parts is
    // still a plain split -- see the note on 排法 above.
    if (parts.length >= 3) {
      const cells = parts.slice(0, 3).map(build);
      // A bento missing a cell is not a bento. Falling back to whatever was
      // built beats rendering a grid with a hole in it.
      const made = cells.filter((n): n is PuckNode => Boolean(n));
      if (made.length < 3) return made[0] ?? null;
      return node("Bento", `dashboard-bento-${parts.slice(0, 3).join("-")}`, {
        lead: [made[0]],
        a: [made[1]],
        b: [made[2]],
      });
    }

    const a = build(parts[0]);
    const b = build(parts[1]);
    // A split whose other half could not be built is a split of one. Falling
    // back to the single block beats rendering an empty column beside it.
    if (!a || !b) return a ?? b;

    return node("Columns", `dashboard-split-${parts.join("-")}`, {
      layout: proportion || "wide-left",
      a: [a],
      b: [b],
      c: [],
    });
  };

  const plan = dashboardComposition(layout);

  /* 🔴 总览这一页要不要页面标题 —— 这是**风格的决定**，2026-09-04 加的。
     老板挑了 arhamkhnz 当我们系统唯一的样子，而它的 `page.tsx` 全档就三行：
       <MetricCards /> <PerformanceOverview /> <SubscriberOverview />
     **一个标题都没有。** 打开就是四张卡。
     它的面包屑在顶栏，主要动作是侧栏顶上那颗黑色的 Quick Create。

     而我们本来在每一页顶上放「Overview + 一句说明 + 一颗按钮」，
     所以尺子报「顺序：参考 数字→数字→数字，我们 其他→其他→图」——
     **差的不是尺寸，是我们比他们多一整块。**

     ⚠️ **这一条跟侧栏那颗按钮是绑在一起的，不可以只做一半。**
     标题那一块装着这门生意的主要动作（「加一张报价单」）；拿掉标题而不给
     那颗按钮一个新家，就是把产品唯一的主要动作删掉 —— 那比不像更糟。
     所以下面那条守卫盯着：**声明了不要标题，就必须用 `action` 那个侧栏。**
     （`RailNav` 的 `action` 变体本来就是 8-26 照他们那颗 Quick Create 做的，
     注解白纸黑字写着，而**在这之前六套没有一套在用它** —— 这个仓库
     第十七次「能力有、线没接」。） */
  const headless = HEADLESS_DASHBOARD.has(SYSTEM_REGISTER);

  return layerFirst([
    railNavNode(labels, brand, name, "dashboard", locale, pages, lang),
    ...(headless ? [] : [node("PageHeader", "dashboard-header", {
      title: c.dashboard.title,
      subtitle,
      // WHY A BUTTON AND NOT A TOP BAR: three of the four things a competitor's
      // top bar carries are already in the rail, and the fourth is a search box
      // that finds nothing until the system is really built. What their top bar
      // actually contributes at this width is a PRIMARY ACTION.
      actionLabel: c.dashboard.primaryAction(
        pageLabel(
          pages.find((p) =>
            ["quotations", "bookings", "orders", "projects"].includes(p.key),
          ) ?? { key: "customers" },
          labels,
          lang,
        ),
      ),
      actionHref: `/${locale}/portal/${
        pages.find((p) =>
          ["quotations", "bookings", "orders", "projects"].includes(p.key),
        )?.key ?? "customers"
      }`,
    })]),
    // An unknown role is skipped rather than thrown: a composition naming a
    // block this page cannot build should cost that block, not the page.
    ...plan.map(compose).filter((n): n is PuckNode => Boolean(n)),
  ], plan);
}

/**
 * 层叠 — the page's heading on a band, with the first block riding on its edge.
 *
 * WHY IT IS APPLIED HERE AND NOT INSIDE compose(). The band has to contain the
 * PageHeader, and the header is not part of the composition -- it is emitted
 * before the plan, on every page, whatever the register. compose() can only
 * see the roles.
 *
 * WHY ONLY THE FIRST BLOCK. A band halfway down a page is a stripe. This is
 * the top of the page or it is nothing.
 */
function layerFirst(nodes: PuckNode[], plan: string[]): PuckNode[] {
  if (!plan[0]?.endsWith("@over")) return nodes;
  // [rail, header, first, ...rest] -- the rail stays outside, it is the shell's
  // sidebar and has no business inside a band.
  const [rail, header, first, ...rest] = nodes;
  if (!header || !first) return nodes;
  return [
    rail,
    node("Overlap", "dashboard-overlap", { band: [header], body: [first] }),
    ...rest,
  ];
}

/**
 * Which blocks each register's dashboard is made of, and in what order.
 *
 * WHY IT LIVES HERE AND NOT IN design-doc.ts. That file holds the register's
 * BRIEF -- its mood, its measurements, and which variant of each component it
 * prefers. This is a different kind of statement: it names blocks that only
 * this builder can build, and putting it there would make design-doc.ts import
 * a vocabulary it has no other use for. The brief says how a register looks;
 * this says what its dashboard IS.
 *
 * Every composition below was chosen from the register's own argument, not
 * shuffled for variety:
 */
/**
 * The change between the last two periods, as a percentage.
 *
 * Returns null rather than a number in the two cases where a percentage would
 * be a lie: fewer than two periods to compare, and a previous period of zero
 * (every increase from nothing is infinite, and printing 「↑ 100%」 for a
 * business's first month of takings is worse than printing nothing).
 */
/**
 * 上一期那个数字，照**这一期怎么写的**去写。
 *
 * Studio Admin 每一张 KPI 底下都有一行「$254,200 last month」，而我们只有一个
 * 百分比 —— 讲了「涨了」，没讲「从多少涨的」。
 *
 * ⚠️ 格式是**从 `value` 那串字上抄下来的**，不是假设的：前缀（「RM 」、「$」，
 * 或者什么都没有）原样拿过来，数字照同一种千分位排。这个产品哪天卖到用别的
 * 货币的地方，这一行不用改。
 *
 * ⚠️ 拿不到就回 undefined。上一期是零、只有一期、或者 `value` 根本不是一个
 * 数字（「4 单」那种）—— 三种都不给，因为「RM 0 上个月」是一句读起来像事实
 * 的假话。
 */
function previousFigure(spark: number[] | undefined, value: string): string | undefined {
  if (!spark || spark.length < 2) return undefined;
  const prev = spark[spark.length - 2];
  if (!prev) return undefined;
  const m = value.match(/^([^\d]*)([\d.,]+)/);
  if (!m) return undefined;
  return `${m[1]}${Math.round(prev).toLocaleString("en-US")}`;
}

function headlineDelta(spark: number[] | undefined): number | null {
  if (!spark || spark.length < 2) return null;
  const prev = spark[spark.length - 2];
  const curr = spark[spark.length - 1];
  if (!prev) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

/**
 * 哪几套风格的**总览**不画页面标题 —— 因为它抄的那一页没有。
 *
 * 只有一套，而这是结论不是占位（[任务 32](../../docs/founder-tasks.md) 那一条：
 * 一个字段系统服务一个值就是过度工程）。arhamkhnz 的门面页整档三行，
 * 没有标题；shadcn 的 Tasks、Tabler、Ant、TailAdmin 每一页都有标题。
 *
 * ⚠️ **进这份名单的风格，`RailNav` 必须是 `action`。**
 * 标题那一块装着主要动作；拿掉标题就要给那颗按钮一个新家，而 `action` 那个
 * 侧栏顶上正好有一个 —— 那本来就是照同一个参考做的。
 * `headless-needs-rail-action.test.ts` 盯着这一条，故意弄坏看过它红。
 */
/* 🔴 2026-09-04：系统只有一套样子了，所以这份名单只有一个成员，而且永远
   只会有一个。留着它而不是写成 `true`，是为了让 `headless-needs-rail-action`
   那条守卫还量得到「这一套的侧栏必须是 action」—— 拿掉标题就要给那颗
   主要动作一个新家，而那条绑定跟风格有几套无关。 */
export const HEADLESS_DASHBOARD = new Set([SYSTEM_REGISTER]);

/**
 * 工作台的**排法** —— 哪几块，什么顺序。
 *
 * 🔴 2026-09-04 这张表换了钥匙：以前一行是一套**风格**，现在一行是一种**排法**。
 * 老板：`我现在只需要你一个UI风格for 我的system only` · `做好一套就可以了`。
 *
 * 系统只有一套样子了（`SYSTEM_REGISTER`），所以「你是哪一套风格」不再是一个问题。
 * 还留着的那个问题是「你想一进来先看到什么」—— 而那本来就是编辑器里那三颗
 * 「排法」按钮问的事（`LAYOUT_SETS`）。它们从今天起指的是这里的键，
 * 不再指别的风格的名字。
 *
 * ⚠️ **砍掉的是 blueprint 跟 counter 那两行。** 它们只被自己那一套风格用，
 * 而那个用途没有了；台账 / 招牌 / 炉 那三行留着，**因为它们是那三颗按钮的落点**，
 * 不是因为那三套风格还在管工作台。
 *
 * ⚠️ **「表格先行」那一行摊平了。** 它本来靠 `SPLIT_REGISTERS` 的侧栏吃掉开头
 * 两块窄的（`todo` · `ranking`）；系统那一套不是分栏的壳，所以那两块直接写在
 * 后面 —— 跟 `relayout` 以前在执行时替它做的重排一模一样，只是现在写在纸上。
 */
export const SYSTEM_COMPOSITION = ["stats4", "trend", "table"];

export const DASHBOARD_COMPOSITION: Record<string, string[]> = {
  /* 跟着系统走 —— arhamkhnz 门面页的 `page.tsx` 全档三行：
       <MetricCards /> <PerformanceOverview /> <SubscriberOverview />
     四张数字卡 → 一张整页宽的图表卡 → 一张带抬头的表。就这三块。 */
  follow: SYSTEM_COMPOSITION,
  /* 表格先行 —— 一天读四十行的人要的是行，数字排在它后面。
     两块窄的（今天要跟的 · 排行）压在最底，那是它们本来在侧栏里的位置。 */
  table: ["table", "stats4", "trend", "flow", "todo", "ranking"],
  /* 一个大数字 —— 数字跟它的目标开场，其余都小、都在底下。 */
  hero: ["stats4", "trend|target@wide-left", "progress", "table"],
  /* 今天要做什么 —— 开系统的那一刻店里有客人，他要的是「等一下谁来」，
     不是本月收了多少。钱退到下面一整行，两张卡都够宽。 */
  today: ["greet", "todo|quick@wide-left", "stats2", "table"],
};


/**
 * EVERY ROLE NAME A COMPOSITION MAY USE.
 *
 * `compose()` skips a role it does not recognise, silently -- which is the
 * right runtime behaviour (a typo must not blank a customer's page) and a trap
 * at authoring time. Caught the hard way on 2026-08-26: 台账 and 中台 were given
 * a lead block called 「today」, the builder is called 「todo」, and the two
 * registers rendered with an EMPTY second column. The screenshot showed it; no
 * error did.
 *
 * industry-template.test.ts asserts every entry in DASHBOARD_COMPOSITION is in
 * here. Same class as design-doc.test.ts, which found nine dead variant
 * preferences the day it was written.
 */
export const COMPOSITION_ROLES = new Set([
  "table", "stats4", "stats2", "trend", "todo", "ranking", "share",
  "flow", "activity", "progress", "board", "hero", "target", "tabbed", "tiles", "greet",
  "quick",
]);

/** The neutral composition, for a register with no entry and for the paths that
 *  build a page without knowing the style (the spec document, the founder
 *  console). Deliberately 蓝图's -- the register whose whole argument is that it
 *  is safe for any trade. */
/**
 * THE FIVE ARRANGEMENTS, NAMED BY WHAT THEY ARE.
 *
 * There is one composition per register above, but they are not seventeen
 * different ideas — they are five, each held by three or four registers. Naming
 * the five is what makes 排法 a choice a business owner can make: 「表格先行」 is
 * a sentence about his own day, 「用台账的排法」 is a question about a register he
 * may never have looked at.
 *
 * Each one points at an existing composition rather than defining a new array,
 * so a change to 仪表盘's page is a change to the 四格 arrangement and the two
 * can never drift into disagreeing about the same shape.
 */
export const LAYOUT_SETS = {
  /* 🔴 2026-09-04：这三个值以前指的是**别的风格的名字**（table -> ledger）。
     系统收成一套之后那三套风格不再管工作台，所以它们改成指
     `DASHBOARD_COMPOSITION` 自己的键 —— 一颗按钮指的是一种排法，
     不是一套客人从来没打开过的风格。 */
  /** A ledger is a table, and a person who reads forty rows a day wants rows. */
  table: "table",
  /** One figure and a great deal of air, then the work. */
  hero: "hero",
  /** What is happening today first, the money after it. */
  today: "today",
  /* 看板 IS GONE, and deliberately rather than by omission.
     It named 粗野's shape -- the day as columns rather than as a list -- and
     粗野 was culled on 2026-08-27. Pointing it at a survivor would have left a
     button labelled 看板 that produces 图纸's layout, which is the same lying
     control this repo has spent the week removing. A 排法 is a promise about
     what the page will look like; when the shape behind it stops existing, the
     promise has to go with it. */
} as const;

export type LayoutSet = keyof typeof LAYOUT_SETS;

/**
 * Which blocks this page is made of, in order.
 *
 * `layout` wins over `style` when the customer has named one — that is the
 * whole point of the axis: 「我要这一套的样子，但照台账那样排」. NULL means follow
 * the register, which is what every account had before 2026-08-25 and what
 * most should keep.
 */
export function dashboardComposition(layout?: string | null): string[] {
  const named = layout && LAYOUT_SETS[layout as LayoutSet];
  return (named && DASHBOARD_COMPOSITION[named]) || SYSTEM_COMPOSITION;
}

/**
 * 官网 — the only page in the system whose reader is a stranger.
 *
 * WHY IT IS PART OF THE SYSTEM AND NOT A SEPARATE PRODUCT.
 *
 * The founder's own next step was 「官网表格 → 系统出单」, and his own reaction
 * to the phrase was 「这个我一直不懂是什么来的」 -- which is the correct reaction,
 * because nothing on either side of that arrow shows it. A form is a form and a
 * row is a row; the arrow is invisible.
 *
 * Building the website as one more page of the same system, in the same editor,
 * in the same eight registers, is what makes the arrow visible: the customer
 * changes a heading on their website with the same press they use on their
 * dashboard, and the enquiry block says out loud which of THEIR pages a
 * submission becomes a record in.
 *
 * NO RAIL, AND THAT IS THE WHOLE DIFFERENCE IN THE LAYOUT. Every other page is
 * a SystemShell with a navigation column, because the reader is the owner
 * moving around their own system. Nobody navigates a small business's website
 * with a sidebar of internal modules -- 收款 and 对账 are not things a customer
 * should ever see. So this shape returns a flat stack and buildPageLayout skips
 * the shell for it.
 *
 * FIVE BLOCKS, IN THE ORDER A STRANGER READS.
 *   1. What you do and how to reach you       (SiteHero)
 *   2. What you actually sell                 (InfoRows)
 *   3. What happens after they message         (WorkflowStrip -- their own
 *      workflow, which the analysis already produced, so the website and the
 *      系统 describe one business rather than two)
 *   4. The form that becomes a record          (EnquiryForm)
 *   5. How to find you                         (InfoRows)
 *
 * It is short on purpose. A landing page for a Malaysian SME competes with a
 * Facebook page, and the thing that wins is answering "what do you do, and how
 * do I ask you" above the fold.
 */
/**
 * Everything the 官网 templates need, resolved from one business.
 *
 * Exported because two callers need the same values: buildWebsite, which picks
 * the trade's opening template, and the editor's own page, which applies a
 * DIFFERENT template when the customer chooses one in 模板库. Deriving it twice
 * would be two places for the pitch to drift.
 */
export function landingContentFor(
  ctx: BusinessContext,
  pages: PageRef[],
): LandingContent {
  const lang = langOf(ctx);
  const industry = ctx.industry ?? fallbackIndustry(lang);
  const labels = labelsFromPages(industryLabels(industry, lang), pages);
  const brand = displayBusinessName(ctx);

  // Which of THEIR pages an enquiry becomes. The sell-side page the business
  // actually has, in the business's own word for it -- a salon's enquiry is a
  // 预约, a wholesaler's is a 订单, a contractor's is a 报价单. Falls back to
  // the customer list, which every system has, rather than to a page the
  // business does not own.
  // 2026-08-25: the ANALYSIS decides this now, not the order of the array
  // below. The founder: 「你应该想到更多方面就是可能别的行业是不用这个报价单的
  // 呢？我不是只做一个行业呢？」 — and a wholesaler, who has both quotations and
  // orders, always landed in quotations purely because that string came first.
  //
  // The array survives as the LAST resort, for every analysis written before
  // that date and for the fallback path, so no existing system changes shape on
  // deploy. See migration 20260825020000 and lib/openai/analysis-schema.ts,
  // which corrects the model's answer against the modules this business has.
  const decided = ctx.analysis?.enquiry?.lands_in?.trim();
  const sellSide =
    decided === "none"
      ? null
      : decided && pages.some((p) => p.key === decided)
        ? decided
        : (["quotations", "bookings", "orders", "projects"].find((k) =>
            pages.some((p) => p.key === k),
          ) ?? null);

  const landsIn =
    decided === "none"
      ? null
      : sellSide
        ? pageLabel(
            pages.find((p) => p.key === sellSide) ?? { key: sellSide },
            labels,
            lang,
          )
        : labels.customer;

  // The questions this trade actually needs answered. The model writes both
  // languages; the system's own language picks one, with no cross-language
  // fallback -- a Chinese question under an English heading on a page a
  // stranger reads is worse than a generic English one.
  const enquiryFields = (ctx.analysis?.enquiry?.fields ?? [])
    .map((f) => ({
      label: (lang === "en" ? f.label_en : f.label)?.trim() ?? "",
      kind: f.kind,
    }))
    .filter((f) => f.label);

  // NOT ctx.analysis.summary, and this is the one thing about this page that
  // is easy to get wrong. That line is the AI's diagnosis of what is BROKEN in
  // the business -- 「你的报价发出去之后没人跟，钱卡在确认这一步」 -- which is
  // exactly right on the dashboard and a disaster on a page strangers read. The
  // first draft shipped it to the public page; caught by looking at the render,
  // not by any test, because it was correct code carrying the wrong audience's
  // words.
  //
  // What a stranger needs instead is what the business SELLS, so the pitch is
  // built from the same three services listed below it, plus one line of the
  // trade's own promise. Every word of it is meant to be retyped by the owner.
  const t = landingCopy(lang);
  const services = t.services[industry.slug] ?? t.services.other;
  const promise = t.promise[industry.slug] ?? t.promise.other;
  const pitch =
    lang === "zh"
      ? `${t.joinServices(services.map((x) => x.label))}。${promise}`
      : `${t.joinServices(services.map((x) => x.label))}. ${promise}`;

  /*
    THE HEADLINE IS WHAT THEY DO, NOT WHO THEY ARE.

    It was `c.brand` -- the company name, set at 68px across the first screen.
    Twelve current landing pages photographed on 2026-08-27 (arc, clerk,
    cursor, dub, framer, linear, polar, raycast, resend, rive, spline, vercel):
    TWELVE OUT OF TWELVE put the company name in the top bar, and NONE of them
    makes it the headline. The headline is short and says what the thing does --
    「Turn clicks into revenue」, 「Email for developers」, 「Make anything 3D」.

    A stranger who has landed here already saw the name in the bar. What they
    do not know is whether this business does the job they need, in the place
    they live. Trade plus area answers both in six words, and it is what they
    typed into Google to get here.

    The name is not lost: it is in the bar, in the foot, and on the drawn
    figure. It is simply no longer the largest words on the page.
  */
  const headline =
    lang === "zh"
      ? `${t.page.sections.areas.list[0]}的${t.tradeNoun[industry.slug] ?? t.tradeNounFallback}`
      : `${tradeLabel(industry, lang)} in ${t.page.sections.areas.list[0]}`;

  return {
    brand,
    headline,
    // The trade name only, no slash: several of them are stored as
    // 「装修/承包商」 and an eyebrow reading 「马来西亚 · 装修/承包商」 reads like
    // a database field, not like a business.
    eyebrow: `${t.eyebrowPrefix} · ${tradeLabel(industry, lang)}`,
    pitch,
    services,
    stages: workflowStages(ctx),
    landsIn,
    enquiryFields,
    proof: t.proof,
    contact: t.contact,
    words: t.page,
  };
}

/**
 * 官网 — the only page in the system whose reader is a stranger.
 *
 * WHY IT IS PART OF THE SYSTEM AND NOT A SEPARATE PRODUCT: the founder's own
 * next step was 「官网表格 → 系统出单」, and his own reaction to the phrase was
 * 「这个我一直不懂是什么来的」 -- which is the correct reaction, because nothing
 * on either side of that arrow shows it. Building the website as one more page
 * of the same system, in the same editor, in the same eight registers, is what
 * makes the arrow visible.
 *
 * NO RAIL, and that is the whole difference in the layout: nobody navigates a
 * small business's website with a sidebar of internal modules. buildPageLayout
 * skips the shell for this one shape.
 *
 * WHICH SHAPE: the trade picks the opening template -- a salon opens on 预约
 * 时段, a shop on 现货落单 -- and the customer can swap to any of the six in
 * 模板库 afterwards. Keyed on how the business CLOSES A SALE rather than on its
 * industry; see landing-templates.ts for why that is the right axis.
 */
function buildWebsite(
  ctx: BusinessContext,
  name: string,
  locale: string,
  pages: PageRef[],
  /** projects.style. The 风格 chooses the website's SKELETON here exactly as it
   *  chooses the dashboard's -- see site-composition.ts. Before 2026-08-27 this
   *  builder ignored it entirely, so fourteen registers reached a customer's
   *  website as fourteen coats of paint on one page. */
  style?: string | null,
  /** projects.layout — 换排法不换风格, the same override the dashboard takes. */
  layout?: string | null,
): PuckNode[] {
  const industry = ctx.industry ?? fallbackIndustry(langOf(ctx));
  const content = landingContentFor(ctx, pages);

  // A TRADE WHOSE CUSTOMERS WALK IN GETS NO FORM, 2026-08-25.
  //
  // 「你应该想到更多方面就是可能别的行业是不用这个报价单的呢？」 -- and past the
  // question of WHICH page an enquiry becomes lies the one this product had
  // never asked: whether this business takes enquiries at all. A kopitiam, a
  // grocery, a car wash do not. Handing them a form promises an inbox that
  // stays empty for a month, and an empty inbox does not read as "nobody has
  // written yet" -- it reads as software that does not work.
  //
  // 一页名片 is already exactly the right page for them and was already built:
  // who you are, what you do, how to find you, no form. It simply had no way
  // of being chosen, because the trade slug picked the template and no slug
  // means "walk-in". The analysis answers that now.
  const template =
    content.landsIn === null
      ? LANDING_BY_KEY.card
      : landingTemplateFor(industry.slug);

  /*
    THE TEMPLATE SAYS WHICH SECTIONS; THE REGISTER SAYS WHAT IT OPENS ON.

    `layout` wins over `style` for the same reason it does on the dashboard --
    「我要这一套的样子，但照台账那样排」 -- and LAYOUT_SETS maps a named 排法 back
    onto the register whose skeleton it is.
  */
  const composed = composeSite(
    template.build(content),
    (layout && LAYOUT_SETS[layout as LayoutSet]) || style,
  );

  /*
    THE OBJECT IS NOT THEIR DASHBOARD, AND THAT WAS A REAL MISTAKE.

    For about an hour this handed the hero a miniature of the business's own
    admin dashboard, reasoning that linear puts its own application on its
    first screen. The founder: 「谁会放自己的system 就是后台出去给人看啊」.

    He is right and the error is a category one. Linear's application IS the
    product it sells, so showing it is showing the goods. A renovation
    contractor sells RENOVATION. Their dashboard is the tool they run the
    business with -- a homeowner has no use for it, and putting an internal
    tool on a public page shows a stranger something that was never theirs to
    see.

    What belongs there is what this market already showed us: 14 of 19 trading
    Malaysian SME sites give the first screen to a PHOTOGRAPH of the work. The
    photo slot is built and the picker is wired; what is missing is asking the
    owner for one, which is 任务 21. Until then the drawn figure -- their own
    services and their own pipeline, no invented numbers -- is the honest
    fallback, and it is a better one than somebody else's kitchen.

    SystemMini survives because it is right for ONE page: Formae's own landing
    page, where the system IS what we sell. Recorded in founder-tasks.md so it
    is used rather than left to rot.
  */
  return composed;
}

function buildCustomers(
  ctx: BusinessContext,
  name: string,
  locale: string,
  pages: PageRef[],
): PuckNode[] {
  const lang = langOf(ctx);
  const c = chrome(lang);
  const industry = ctx.industry ?? fallbackIndustry(lang);
  const brand = displayBusinessName(ctx);
  const labels = labelsFromPages(industryLabels(industry, lang), pages);
  const sample = sampleFor(industry.slug, lang);

  return [
    railNavNode(labels, brand, name, "customers", locale, pages, lang),
    node("PageHeader", "customers-header", {
      title: c.customers.title(labels.customer),
      subtitle: c.customers.subtitle(labels.customer),
      /* 新增客户 -- the trade's own noun, not the page's title: that reads
         「客户名单」, and 「新增客户名单」 is a button that offers to make a
         second list. Same link-not-control reason as the quotations header. */
      actionLabel: c.dashboard.primaryAction(labels.customer),
      actionHref: `/${locale}/portal/customers/new`,
    }),
    /* 🔴 这里本来有一个「Search client name or phone」的搜索框，2026-09-03 拿掉了。
       放大两倍看客户那一页，同一屏上**两个搜索框**：这一个在上面（大、显眼），
       表格自己的「Filter these rows…」在下面。
       而**上面那个不会筛任何东西** —— 它只是一个带建议清单的输入框，
       打完字按 enter 什么都不会发生；真的会筛的是下面那个小的。
       两个一样的控件摆在一起，其中大的那个是假的 —— 这正是这个仓库禁的那种
       「画一颗按不动的按钮」，只是它长得像搜索框。
       参考那一页（shadcn Tasks）也只有一个，而且它是真的会筛的那一个。 */
    /* 🔴 整页一张表，不再是「左清单右详情」（2026-09-05）。

       那个排法本来的理由写在这里：「A NAME LIST EXISTS SO SOMEBODY CAN BE
       OPENED… this is not that page, and it is the half of it that can be
       honest today」—— 也就是**客户详情页还不存在**，所以先在旁边放一格。
       **那一页 2026-09-03 上线了**（[任务 119](../../docs/founder-tasks.md)：
       他有几单在跑 · 他还欠我多少），而表格第一格从 8-31 起就是连到它的连结。

       於是那一格变成两件事：它把一个已经存在的页面画了半个，而且它只画
       **第一行**那一个人 —— 一个老板打开客户名单，右边那一整条讲的是一个
       他没有挑过的人，底下留一大片空。`align:pages` 量出来「缝是他们的
       12.3 倍」，那一片空就是它。

       ⚠️ **左清单右详情没有被推翻**，供应商跟师傅还是那个排法（照他们的
       Logistics 那一页）。换掉的只有客户 —— 而客户对上的本来就是他们的
       **Users**，一张整页宽、能筛能搜的名册。 */
    recordTable(
      "customers-list",
      c.customers.caption(labels.customer),
      {
        primary: labels.customer,
        secondary: c.col.contact,
        status: c.col.status,
      },
      sample.customers,
      /* 明确的那一排留空 —— 见下面那个 `true`。 */
      undefined,
      /* 第一栏是一个人。 */
      true,
      /* 🔴 分面筛选，而且**是那张表自己从行里算出来的**，不是这里刻进去的。

         刻进去的那一种会说谎：这一层只看得到**示例资料**，而客户第一笔真
         记录一进来示例就整批消失 —— 那一排照示例刻的分段，会在他自己的
         客户名单上一格都筛不到，而它长得跟一排会筛的一模一样。
         `live-rows.ts` 从来不碰 `filters`，所以没有人会去更新它。

         参考那一页在标题底下有一整排（Role / Team / Status / Workspace）。
         我们只有一根轴能诚实地筛：状态。三个假的下拉不是三倍的功能。

         ⚠️ `recordTable` 上面写着「Only the dashboard passes them: 在一张
         整页就是这张表的页上，分段会跟页面自己的筛选条重复」—— 客户这一页
         **没有筛选条**（那一排 FilterChips 从来没有画在这里），所以那句话
         讲的情况在这里不成立。 */
      true,
    ),
  ];
}



function buildQuotations(
  ctx: BusinessContext,
  name: string,
  locale: string,
  pages: PageRef[],
): PuckNode[] {
  const lang = langOf(ctx);
  const c = chrome(lang);
  const industry = ctx.industry ?? fallbackIndustry(lang);
  const brand = displayBusinessName(ctx);
  const labels = labelsFromPages(industryLabels(industry, lang), pages);
  const sample = sampleFor(industry.slug, lang);

  return [
    railNavNode(labels, brand, name, "quotations", locale, pages, lang),
    node("PageHeader", "quotations-header", {
      title: c.quotations.title,
      subtitle: c.quotations.subtitle(labels.customer),
      // 加一单 — the ONE action this page is for. A link and not a control,
      // because this header is drawn in the style gallery, in hundreds of
      // thumbnails and on paper, where there is no session to write with.
      // The writing happens at /new; see that page for why.
      actionLabel: c.dashboard.primaryAction(c.quotations.title),
      actionHref: `/${locale}/portal/quotations/new`,
    }),
    /* 🔴 那一条工具条整个拿掉了（2026-09-05）。它两半都是空的：
       左边是一颗按不动的筛选 chip，右边是一个没有接到任何东西的日期选择器
       —— 选一个日期，表格一行都不会变。

       而 2026-09-03 那一轮想要的东西（shadcn 那一页的**一行**工具条：
       一个会筛的框 · 两个分面）本来就在那张表自己身上：`tools: "search"`
       是这一套风格自己的偏好，配上底下那个 `segments` 就是同一条工具条，
       而且两半都真的会筛。 */
    /* A quotation is not a list that happens to have a document -- it IS the
       document. Showing the paper beside the list is the arrangement the
       founder pointed at, and it is the one page in the system whose output
       somebody outside the business reads. */
    besideNode(
      "quotations",
      [
        recordTable(
          "quotations-list",
          c.quotations.caption,
          {
            primary: c.quotations.itemColumn,
            secondary: labels.customer,
            amount: c.quotations.amountColumn,
            status: c.col.status,
          },
          sample.records,
          /* 明确的那一排留空，第一栏不是人 —— 见下面那个 `true`。 */
          undefined,
          undefined,
          /* 会筛的那一排，那张表自己从行里算。见 `customers-list` 上面那一段。 */
          true,
        ),
      ],
      [
        documentNode(
          "quotations",
          c.quotations.title,
          {
            primary: c.quotations.itemColumn,
            secondary: labels.customer,
            amount: c.quotations.amountColumn,
            status: c.col.status,
          },
          sample.records[0],
          c,
        ),
      ],
    ),
  ];
}

function buildProjects(
  ctx: BusinessContext,
  name: string,
  locale: string,
  pages: PageRef[],
): PuckNode[] {
  const lang = langOf(ctx);
  const c = chrome(lang);
  const industry = ctx.industry ?? fallbackIndustry(lang);
  const brand = displayBusinessName(ctx);
  const labels = labelsFromPages(industryLabels(industry, lang), pages);
  const sample = sampleFor(industry.slug, lang);

  return [
    railNavNode(labels, brand, name, "projects", locale, pages, lang),
    node("PageHeader", "projects-header", {
      title: c.projects.title(labels.order),
      // The bottleneck the AI actually identified, named on the page whose job
      // is to fix it -- so the analysis shows up as working software rather
      // than as a paragraph the visitor read once and closed.
      subtitle: (() => {
        const focus = focusTitle(ctx, lang);
        return focus ? c.projects.focus(focus) : c.projects.subtitle(labels.order);
      })(),
      // 加一单 — the ONE action this page is for. A link and not a control,
      // because this header is drawn in the style gallery, in hundreds of
      // thumbnails and on paper, where there is no session to write with.
      // The writing happens at /new; see that page for why.
      actionLabel: c.dashboard.primaryAction(c.projects.title(labels.order)),
      actionHref: `/${locale}/portal/projects/new`,
    }),
    /* WHERE EACH JOB ACTUALLY IS, as columns rather than as a strip over a
       table. The strip drew the same five words on every pipeline page and said
       nothing about which job was where; the board is the answer to the only
       question anybody opens this page with.

       Live rows land in the column their own status names -- live-rows.ts has
       filled TaskBoard since it was written, and until today no page used it. */
    /* 🔴 板就是这一页，底下那张表拿掉了（2026-09-05）。

       在这之前这一页是**看板加一张一模一样的表**：同一批七笔画两次，
       上面一次下面一次。参考那一页（Studio Admin 的 Kanban）只有板 ——
       而「同一行印两次同一个数字」正是[印那一套风格被砍掉](../../docs/founder-tasks.md)
       的理由。

       ⚠️ 拿掉那张表要先补上它唯一不可替代的东西：**第一格是连结**。
       卡片从今天起点得进那一单（`board-blocks.tsx`），示例照旧点不动。

       ⚠️ **诚实讲丢掉了什么**：表格上面那个搜索框。七笔不用搜，七十笔要 ——
       那时候要的是参考那一页顶上那条工具条（Board／List／Table ＋ 搜索），
       不是把这张表装回来。

       🔴 那个「All crew」的下拉也一起拿掉了，理由不一样：**它什么都不筛**。
       一张走单记录上没有师傅那一栏，所以它连筛的对象都没有；而它的选项
       「师傅 A」「师傅 B」是**编出来的两个人名**。一个筛不了东西的筛子，
       就是这个仓库一直在禁的那种死掉的控件。 */
    boardNode("projects", ctx, sample.records),
  ];
}

function buildPayments(
  ctx: BusinessContext,
  name: string,
  locale: string,
  pages: PageRef[],
): PuckNode[] {
  const lang = langOf(ctx);
  const c = chrome(lang);
  const industry = ctx.industry ?? fallbackIndustry(lang);
  const brand = displayBusinessName(ctx);
  const labels = labelsFromPages(industryLabels(industry, lang), pages);
  const sample = sampleFor(industry.slug, lang);

  return [
    railNavNode(labels, brand, name, "payments", locale, pages, lang),
    node("PageHeader", "payments-header", {
      title: c.payments.title,
      subtitle: c.payments.subtitle(labels.customer),
      // 加一单 — the ONE action this page is for. A link and not a control,
      // because this header is drawn in the style gallery, in hundreds of
      // thumbnails and on paper, where there is no session to write with.
      // The writing happens at /new; see that page for why.
      actionLabel: c.dashboard.primaryAction(c.payments.title),
      actionHref: `/${locale}/portal/payments/new`,
    }),
    node("MonthPicker", "payments-month", {
      name: "payment-month",
      placeholder: c.payments.monthPlaceholder,
      allowClear: true,
    }),
    ...moneyNodes({
      id: "payments",
      /* 两格，不是四格 —— `buildLedgerHeadline` 今天回两个事实
         （这个月收到多少 · 几笔），而给四格只填得了两格，就是一个
         「他记下第一笔之后自己少两格」的画面。
         ⚠️ 还有两个事实是**算得出来而还没算的**：还没用完的订金、最大的一笔。
         那在算钱那一层（`live-months.ts`），不是这里。 */
      tiles: [
        {
          label: sample.heroLabel,
          value: sample.heroValue,
          deltaLabel: sample.heroSuffix,
          iconName: "payments",
        },
        {
          label: sample.heroStats[0]?.label ?? c.col.status,
          value: sample.heroStats[0]?.value ?? "",
          deltaLabel: sample.heroStats[0]?.sub ?? "",
          iconName: "reconciliation",
        },
      ],
      trend: {
        title: c.money.trendTitle,
        caption: c.money.trendCaption,
        unit: "RM",
        /* 🔴 最后六个月，不是十二个。真资料那边（`buildLedgerHeadline`）
           就是六个月，而示例给十二个的时候，同一张图在「还没有资料」跟
           「有资料」两种状态下是两个不同的东西。 */
        points: sample.heroSpark.slice(-6).map((value, i, all) => {
          /* 最近几个月的名字，跟总览那张图同一个算法。 */
          const d = new Date();
          d.setDate(1);
          d.setMonth(d.getMonth() - (all.length - 1 - i));
          return {
            label:
              lang === "zh"
                ? `${d.getMonth() + 1}月`
                : d.toLocaleDateString("en-US", { month: "short" }),
            value,
          };
        }),
      },
      rankHeading: c.money.topPaid,
      rows: sample.records,
      captionTemplate: c.dashboard.trendCaption,
    }),
    recordTable(
      "payments-list",
      c.payments.caption,
      {
        primary: c.payments.itemColumn,
        secondary: labels.customer,
        amount: c.col.amount,
        status: c.col.status,
      },
      sample.records,
    ),
    // Receipt upload is the single most-requested thing from Malaysian SMEs
    // that currently run payment tracking through WhatsApp screenshots.
    node("FileUploadField", "payments-receipt", {
      label: c.payments.uploadLabel,
      hint: c.payments.uploadHint,
      name: "receipt",
      accept: "image/*,application/pdf",
    }),
  ];
}

/**
 * The appointment book. Beauty and education businesses run their whole day off
 * this page, and neither of them has a quotation to send -- which is why they
 * get this page instead of `quotations`, not as well as it.
 */
function buildBookings(
  ctx: BusinessContext,
  name: string,
  locale: string,
  pages: PageRef[],
): PuckNode[] {
  const lang = langOf(ctx);
  const c = chrome(lang);
  const industry = ctx.industry ?? fallbackIndustry(lang);
  const brand = displayBusinessName(ctx);
  const labels = labelsFromPages(industryLabels(industry, lang), pages);
  const sample = sampleFor(industry.slug, lang);

  return [
    railNavNode(labels, brand, name, "bookings", locale, pages, lang),
    node("PageHeader", "bookings-header", {
      title: c.bookings.title,
      subtitle: c.bookings.subtitle(labels.staff),
    }),
    /* THE ONE MODULE WHOSE AXIS IS TIME. A salon owner does not read their day
       as four rows with a date filter above them; the week and the day ARE the
       page. The staff filter stays underneath with the table, where filtering
       belongs.

       ⚠️ Still a drawing: `calendar` has no table behind it (SHAPE_STATE), so
       none of this becomes real yet. What changed is the shape. */
    ...dayNodes("bookings", sample.records, c),
    node("Listbox", "bookings-staff", {
      name: "booking-staff",
      placeholder: c.bookings.staffPlaceholder(labels.staff),
      options: [
        { label: c.bookings.allStaff(labels.staff), value: "all" },
        { label: `${labels.staff} A`, value: "a" },
        { label: `${labels.staff} B`, value: "b" },
      ],
    }),
    recordTable(
      "bookings-list",
      c.bookings.caption,
      {
        primary: c.bookings.serviceColumn,
        secondary: c.bookings.whenColumn(labels.staff),
        amount: c.bookings.priceColumn,
        status: c.col.status,
      },
      sample.records,
    ),
  ];
}

/**
 * The order list. Retail, F&B and wholesale all run on many small transactions
 * rather than quoted jobs, so this replaces `projects` for them (and sits
 * alongside `quotations` for wholesale, which quotes first and then fulfils).
 */
function buildOrders(
  ctx: BusinessContext,
  name: string,
  locale: string,
  pages: PageRef[],
): PuckNode[] {
  const lang = langOf(ctx);
  const c = chrome(lang);
  const industry = ctx.industry ?? fallbackIndustry(lang);
  const brand = displayBusinessName(ctx);
  const labels = labelsFromPages(industryLabels(industry, lang), pages);
  const sample = sampleFor(industry.slug, lang);

  return [
    railNavNode(labels, brand, name, "orders", locale, pages, lang),
    node("PageHeader", "orders-header", {
      title: c.orders.title(labels.order),
      subtitle: (() => {
        const focus = focusTitle(ctx, lang);
        return focus ? c.orders.focus(focus) : c.orders.subtitle(labels.order);
      })(),
      // 加一单 — the ONE action this page is for. A link and not a control,
      // because this header is drawn in the style gallery, in hundreds of
      // thumbnails and on paper, where there is no session to write with.
      // The writing happens at /new; see that page for why.
      actionLabel: c.dashboard.primaryAction(c.orders.title(labels.order)),
      actionHref: `/${locale}/portal/orders/new`,
    }),
    workflowStrip(
      "orders-workflow",
      c.orders.workflow(labels.order),
      workflowStages(ctx),
      1,
    ),
    recordTable(
      "orders-list",
      c.orders.caption(labels.order),
      {
        primary: labels.order,
        secondary: labels.customer,
        amount: c.col.amount,
        status: c.col.status,
      },
      sample.records,
      undefined,
      undefined,
      /* 换掉那一行按不动的筛选 chip —— 见档案上面 `filterChips` 那一段。 */
      true,
    ),
  ];
}

// ---------------------------------------------------------------------------
// The shape builders
// ---------------------------------------------------------------------------
//
// The seven templates above were written one per page type, back when there
// were seven page types. The catalogue is sixteen now
// (lib/portal/module-catalog.ts), and 对账 and 佣金 are different modules to a
// business owner and the same layout to a renderer: a month picker, a headline
// figure, a table. Nine more hand-written builders would be nine more places
// for the same bug.
//
// So the new archetypes are carried by SHAPE, and what differs between two
// modules sharing a shape is their vocabulary -- which is also the honest
// description of what actually makes them different. The seven originals are
// left exactly as they were: they are the pages every customer sees first, they
// have per-trade sample data the generic path cannot reproduce, and rewriting
// working templates to prove a point is how a refactor breaks a product.

function heroNode(id: string, locale: string, copy: ModuleCopy): PuckNode[] {
  if (!copy.hero) return [];
  return [
    node("HeroCard", `${id}-hero`, {
      label: copy.hero.label,
      value: copy.hero.value,
      href: `/${locale}/portal/dashboard`,
      /* 🔴 这里本来写着 `chgSuffix: copy.hero.suffix`，2026-09-03 拿掉了。
         `ModuleCopy.hero` 里**没有涨跌这个东西** —— 只有标签、数字、
         一句后缀跟几个小数字。所以开销 · 佣金 · 对帐 · 报表四页印出来是
         「RM 71,300　vs last month」，中间什么都没有。
         `hero-card.tsx` 现在也不肯单独画那半句了（那是守形状的那一层），
         这里是不再写出来（这是守来源的那一层）。
         ⚠️ 哪一天 `ModuleCopy.hero` 真的带了涨跌，两半一起加回来。 */
      stats: copy.hero.stats.map((st) => ({
        ...st,
        href: `/${locale}/portal/dashboard`,
      })),
      // No sparkline: HeroCard draws an all-zero series as nothing, and these
      // modules carry their trend in a real chart below rather than as a shape
      // behind the number.
      spark: [],
      sparkLabel: "",
    }),
  ];
}

/* ──────────────────────────────────────────────────────────────────────────
   钱那三页的骨架 —— 收款 · 开销 · 佣金。一份，两条路共用。

   ── 为什么要有这一支（2026-09-05）────────────────────────────────────────

   十七页里六页长得一模一样（月份 → 一个大数字 → 一张表），而钱那三页是其中
   最像的一组。老板 9-05 指着它讲了两次：`我不要一直都是同个组件` ·
   `这一点很重要`。

   ⚠️ 而它们其实是**两条不同的代码路径**画出同一张脸：收款有自己的
   `buildPayments`，开销跟佣金走 `buildFromShape` 的 `ledger`。
   所以骨架抽成这一支 —— 不抽的话就是第二份手抄，而这个仓库栽在那上面
   至少八次（489 个区块名、九份小标题、九个 uuid…）。

   ── 抄的是 arhamkhnz 的 `finance` 那一页，而且只抄拿得到资料的那三样 ────

   | 参考那一页有的 | 我们 |
   |---|---|
   | **一个矩形切成格**的数字区 | ✅ `StatRow` 的 `quad` |
   | 带**比例条**的三栏（Income sources） | ✅ `RankList` 的 `bars` |
   | 折线图 ＋ **卡头上的期间开关** | ✅ 而且那份资料**早就算好、从来没画过** |
   | 分页签（Dashboard/Accounts/Transactions） | ❌ 我们这三页没有第二个视图可以切 —— 画一排切不了东西的分页签就是死控件 |
   | 带按钮的提示卡（Credit score updated） | ❌ 没有一个真的动作可以放在那颗按钮上 |
   | 圆环 ＋ 图例 | ❌ 这三页的行只有一种状态，画出来是**一整片扇形** |
   | 底下三张小卡（钱包 · 待缴 · 转账） | ❌ 没有资料 |

   🔴 那张图是这一轮最大的一件，而且它不是新做的：`buildLedgerHeadline`
   从写出来那天就在算**六个月的走势**，而这三页从来没有画过它 ——
   算好了、投影送过来了、然后丢掉。这个仓库第二十一次「能力有、线没接」。
────────────────────────────────────────────────────────────────────────── */
function moneyNodes(opts: {
  id: string;
  /** 那两格数字。**只给真的填得满的格数** —— `buildLedgerHeadline` 今天
   *  回两个事实（这个月多少 · 几笔），而 `withLiveStats` 是
   *  `tiles.slice(0, 这里的格数)`。给四格、只填得了两格，就是一个
   *  「他记下第一笔之后自己少两格」的画面。 */
  tiles: { label: string; value: string; deltaLabel?: string; iconName?: string }[];
  trend?: { title: string; caption: string; unit?: string; points: { label: string; value: number }[] };
  /** 比例条那一栏的标题：谁付得最多 · 钱给了谁 · 谁抽得最多。 */
  rankHeading: string;
  rows: {
    primary: string;
    secondary?: string;
    amount?: string;
    tone: StatusTone;
    status: string;
  }[];
  captionTemplate: string;
}): PuckNode[] {
  const { id, tiles, trend, rankHeading, rows, captionTemplate } = opts;

  const stats = node("StatRow", `${id}-stats`, {
    tiles,
    /* 写进 props 就赢过风格 —— 而这里是**故意的**，跟货架那一片格子同一条：
       「一个矩形切成格」是**这几页**照参考做的决定，不是这一套风格的口味。
       见任务 134。 */
    layout: "quad",
  });

  const chart = trend
    ? [
        node("TrendChart", `${id}-trend`, {
          title: trend.title,
          caption: trend.caption.replace("{n}", String(trend.points.length)),
          kind: "bar",
          unit: trend.unit,
          /* 卡头上那个「看多久」。**它是真的会换的** —— 按 3 就真的只画
             最近三根，底下那句说明的数字跟着变。一个按了没反应的下拉，
             正是这个仓库禁的那种东西。

             🔴 **最大的那一格一定要等於全部**：那个开关的预设是最大的一格，
             所以写 `[3, 6]` 配十二个点，一进来就只画最后六根 ——
             一张默默丢掉一半资料的图，而画面上没有任何东西会讲。
             （看图才看到的：说明写「Last 12 periods」，图上六根。） */
          ranges: [3, 6, trend.points.length],
          captionTemplate,
          points: trend.points,
        }),
      ]
    : [];

  /* 比例条读的是**这一页自己的行**（`live-rows.ts` 的 RankList 就是这样填的：
     按金额排、取前五、`name` 用 secondary 再退回 primary）。这里照它排一次，
     所以「还没有资料的样子」跟「有资料的样子」不会是两个不同的东西。 */
  const rank = node("RankList", `${id}-top`, {
    /* 标题在外面那张卡上 —— 参考那一页两块都是卡，一边有卡一边没有，
       读起来像其中一块还没做完。 */
    heading: "",
    shape: "bars",
    rows: [...rows]
      .slice(0, 5)
      .map((r) => ({
        name: r.secondary || r.primary,
        sub: r.secondary ? r.primary : r.status,
        amount: r.amount ?? "",
      })),
  });

  const rankCard = node("Panel", `${id}-top-card`, {
    title: rankHeading,
    description: "",
    look: "card",
    body: [rank],
  });

  /* 图在左、比例条在右 —— 参考那一页第二排就是这个比例。
     没有图的时候不画那一栏（一个只有右边的两栏，是一栏加一个空位）。 */
  const middle = trend
    ? [node("Columns", `${id}-money-split`, { layout: "wide-left", a: chart, b: [rankCard], c: [] })]
    : [rankCard];

  return [stats, ...middle];
}

/* ──────────────────────────────────────────────────────────────────────────
   一条 KPI 带 —— 报表 · 排行。出处 arhamkhnz 的 `analytics` 跟 `crm`。

   钱那三页是**一个矩形切成格**（`quad`），这两页是**几张分开的卡排成一条**
   （`chip`：一道从下往上的淡渐层 ＋ 一圈 1px 的环 ＋ 涨跌做成药丸）——
   那是参考自己的分法，不是我们挑的漆：
   `finance` 的四个数字装在同一个框里，`analytics` 的五个是五张卡。

   🔴 **格数只给这份资料填得满的那么多。** `withLiveStats` 是
   `stats.tiles.slice(0, 这里的格数)` —— 报表最多四个事实
   （收到 · 几笔 · 花掉 · 赚），排行两个（有来往的 · 退步中）。
   多给一格，他记下第一笔之后那一格就自己消失。
────────────────────────────────────────────────────────────────────────── */
function kpiStrip(id: string, copy: ModuleCopy, room: number): PuckNode[] {
  if (!copy.hero) return [];
  const tiles = [
    {
      label: copy.hero.label,
      value: copy.hero.value,
      deltaLabel: copy.hero.suffix,
      iconName: "payments",
    },
    ...copy.hero.stats.map((st, i) => ({
      label: st.label,
      value: st.value,
      deltaLabel: st.sub ?? "",
      iconName: ["reconciliation", "expenses", "reports"][i] ?? "dashboard",
    })),
  ].slice(0, room);
  return [
    node("StatRow", `${id}-stats`, {
      tiles,
      /* 写进 props 就赢过风格 —— 跟货架那一片格子、钱那一个矩形同一条：
         这是**这几页**照参考做的决定，不是这一套风格的口味。见任务 134。 */
      layout: "chip",
    }),
  ];
}

/** 报表跟排行那张图。报表用「图 + 结论」，排行用柱状 —— 见上面那一段。 */
function reportChart(
  id: string,
  copy: ModuleCopy,
  c: ReturnType<typeof chrome>,
): PuckNode[] {
  if (!copy.trend) return [];
  return [
    node("TrendChart", `${id}-trend`, {
      title: copy.trend.title,
      caption: copy.trend.caption,
      /* 结论那一栏那一句 —— **跟卡头那句是两句话**。不给就不画，
         重印一次比空白糟（实拍：同一张卡上「一根就是一个月。」出现两次）。 */
      summary: copy.trend.summary,
      kind: id === "reports" ? "sum" : "bar",
      unit: copy.trend.unit,
      /* 最大的那一格一定要等於全部 —— 那个开关的预设是最大的一格，
         写小了就是一张默默丢掉资料的图（钱那三页踩过一次）。 */
      ranges: [3, 6, copy.trend.points.length],
      captionTemplate: c.dashboard.trendCaption,
      points: copy.trend.points,
    }),
  ];
}

function trendNode(id: string, copy: ModuleCopy): PuckNode[] {
  if (!copy.trend) return [];
  return [
    node("TrendChart", `${id}-trend`, {
      title: copy.trend.title,
      caption: copy.trend.caption,
      kind: "bar",
      unit: copy.trend.unit,
      points: copy.trend.points,
    }),
  ];
}

/**
 * Builds any archetype the seven originals do not cover.
 *
 * The shape decides the furniture around the table; `moduleCopy` decides every
 * word in it. A module whose shape needs a piece of furniture its copy does not
 * fill in simply does not get that piece -- 佣金 has no upload field, because
 * commission is calculated rather than evidenced, and an empty upload box on
 * that page would be furniture pretending to be a feature.
 */
/* ──────────────────────────────────────────────────────────────────────────
   FOUR KINDS OF PAGE, BECAUSE THERE USED TO BE ONE.

   Measured 2026-09-02 by running buildPageLayout over all seventeen backstage
   modules and walking into the shell's slots: fourteen distinct skeletons, and
   sixteen of them were the same sentence -- a heading, one or two filter
   controls, and the same RecordTable. Only 总览 differed. Fourteen registers
   could repaint that and not one of them could change it, which is 重点 7a
   exactly: 每一个design都是用不同的组件去完成的.

   The reference the founder sent (arhamkhnz/next-shadcn-admin, MIT, already
   the first entry in upstream.json and screenshotted here since 2026-08-26) is
   not better because its components are better -- ours draw the same deltas
   and the same grouped rail. It is better because it has KINDS OF PAGE we did
   not have: a form beside a live document, a list beside the one thing
   selected, a board, a diary.

   So none of this adds a component. All four are arrangements of blocks that
   were already in the library, and two of them (TaskBoard, Columns) already
   had a wire into the live projection that no page was using.

   ── WHAT DECIDES WHICH PAGE GETS WHICH ────────────────────────────────────

   The QUESTION the page answers, not its shape. All five pipeline modules
   share a shape and do not share a question: 工程 asks 「这一单走到哪」, which is
   a board; 报价单 asks 「那张纸长什么样」, which is a document. Keying this off
   `shape` would have made all five boards and put us straight back where we
   started -- one arrangement in five coats.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * 看板 — the page whose only question is where each job actually is.
 *
 * ⚠️ THE SAMPLE CARDS ARE SPREAD ACROSS THE STAGES ON PURPOSE, and only while
 * they are samples. A sample row's `status` comes from the sample table while
 * the columns come from THIS business's analysed workflow, so the two rarely
 * agree -- placing samples by their own status draws an empty board for most
 * trades, which teaches the owner that the block is broken. Live rows land by
 * their real status, because live-rows.ts filters them against these same
 * `stages`; see fill() there.
 */
function boardNode(
  pageKey: PageId,
  ctx: BusinessContext,
  rows: KindRow[],
): PuckNode {
  /* Every stage the business declared, not the dashboard's first three: on the
     page whose whole subject is where the work is, a hidden column is a hidden
     part of the business. The table underneath still carries everything. */
  const stages = stagesForModule(ctx, pageKey);
  return node("TaskBoard", `${pageKey}-board`, {
    stages: stages.map((name) => ({ name })),
    cards: rows.slice(0, 9).map((r, i) => ({
      title: r.primary,
      stage: stages[i % Math.max(stages.length, 1)] ?? "",
      /* 对方一行、金额自己一行靠右 —— 跟表格那两栏同一条。 */
      note: r.secondary ?? "",
      amount: r.amount ?? "",
    })),
  });
}

/** The label/value pairs one row makes, in the module's own nouns.
 *
 *  ⚠️ THE LABELS ARE THE TABLE'S OWN COLUMN HEADINGS, not a second set of
 *  words. The AI renames 客户 to 经销商 for a master dealer, and a panel
 *  carrying its own nouns would disagree with the table beside it inside one
 *  screen. Reading `copy.columns` means there is one vocabulary per module and
 *  this file never has to know what it is. */
/** Which column of the record a detail row is showing. Read by live-rows.ts. */
type KindField = "primary" | "secondary" | "amount" | "status";
type KindCols = { primary: string; secondary?: string; amount?: string; status?: string };
type KindRow = { primary: string; secondary?: string; amount?: string; status?: string };

/**
 * ⚠️ EACH PAIR CARRIES THE NAME OF THE FIELD IT CAME FROM, and that is not
 * decoration. The live projection has to replace these values with the
 * customer's own record, and its first version matched them BY POSITION -- so
 * a directory row whose status was empty shifted everything up one and the
 * page printed 「Contact / notes: Ang Chee Keong」. Labels and values that do
 * not correspond are worse than samples: a sample announces itself and this
 * does not. Seen in the picture; every assertion had passed.
 */
function rowPairs(
  cols: KindCols,
  first: KindRow | undefined,
  withPrimary: boolean,
): { label: string; value: string; icon: string; field: KindField }[] {
  const out: { label: string; value: string; icon: string; field: KindField }[] = [];
  const add = (
    label: string | undefined,
    value: string | undefined,
    icon: string,
    field: KindField,
  ) => {
    if (label && value) out.push({ label, value, icon, field });
  };
  if (withPrimary) add(cols.primary, first?.primary, "file", "primary");
  add(cols.secondary, first?.secondary, "person", "secondary");
  add(cols.amount, first?.amount, "money", "amount");
  add(cols.status, first?.status, "tag", "status");
  return out;
}

/**
 * 左清单右详情 — a name list exists so that somebody can be opened.
 *
 * ⚠️ THE ID IS THE MARKER, and live-rows.ts keys the detail panel off it
 * rather than off the type. InfoRows is also how a published website prints
 * the business's own phone number and address; filling every InfoRows in the
 * tree with record data would overwrite that with a customer's name on a page
 * strangers read.
 */
function detailNode(
  pageKey: PageId,
  cols: KindCols,
  first: KindRow | undefined,
  c: Chrome,
): PuckNode {
  const pairs = rowPairs(cols, first, false);
  return node("InfoRows", `${pageKey}-detail`, {
    heading: first?.primary || c.pageKind.detailFallback,
    rows: pairs.length
      ? pairs
      : [{ label: c.pageKind.detailFallback, value: "—", icon: "file" }],
  });
}

/**
 * 单据 — the page whose answer is a piece of paper somebody else will read.
 *
 * 报价单 and 进货单 are not lists that happen to have a document; they are
 * documents that happen to be listed. The founder's reference puts the form on
 * the left and the printed thing on the right, and the reason that reads as
 * better is that it shows the OUTPUT while you are still making it.
 *
 * ⚠️ NO PriceTable HERE, though it exists and looks the part. PriceTable is a
 * sales price list -- packages, features, a button -- and putting one on a
 * quotation would print an offer nobody made.
 */
function documentNode(
  pageKey: PageId,
  title: string,
  cols: KindCols,
  first: KindRow | undefined,
  c: Chrome,
): PuckNode {
  return node("Panel", `${pageKey}-doc`, {
    title: c.pageKind.documentHeading(title),
    description: "",
    body: [
      node("InfoRows", `${pageKey}-detail`, {
        heading: first?.primary || title,
        rows: rowPairs(cols, first, true),
      }),
      node("TermsBlock", `${pageKey}-terms`, {
        heading: c.pageKind.documentTermsHeading,
        body: c.pageKind.documentTerms,
        signLabel: c.pageKind.documentSign,
        dateLabel: c.pageKind.documentDate,
      }),
    ],
  });
}

/**
 * 日历 — 预约 is the one module whose primary axis is time rather than a row.
 *
 * ⚠️ THIS PAGE IS STILL A DRAWING, and saying so is part of shipping it. The
 * `calendar` shape has no table behind it (see SHAPE_STATE), so nothing here
 * ever becomes real. What changes today is that the page finally has the shape
 * of a diary instead of the shape of every other page -- and a salon owner
 * recognising their own week is what the first screen is for.
 */
function dayNodes(pageKey: PageId, rows: KindRow[], c: Chrome): PuckNode[] {
  return [
    node("WeekStrip", `${pageKey}-week`, { days: 5 }),
    node("DaySchedule", `${pageKey}-day`, {
      heading: c.pageKind.dayHeading,
      rows: rows.slice(0, 4).map((r, i) => ({
        /* Spread through a working day rather than all at 09:00. Three
           appointments stacked on one hour is a diary nobody has ever used,
           and this is the block a salon owner judges the product by. */
        time: ["09:30", "11:00", "14:30", "16:00"][i] ?? "09:00",
        title: r.primary,
        description: [r.secondary, r.status].filter(Boolean).join(" · "),
      })),
    }),
  ];
}

/** 分栏 — the list on the left, the one thing on the right.
 *
 *  wide-left, because the list IS the page and the panel is an answer to it.
 *  Half and half would say they matter equally, and a table squeezed into half
 *  a screen drops the column carrying the money. */
function besideNode(pageKey: PageId, left: PuckNode[], right: PuckNode[]): PuckNode {
  return node("Columns", `${pageKey}-split`, {
    layout: "wide-left",
    a: left,
    b: right,
    c: [],
  });
}

function buildFromShape(
  shape: ModuleShape,
  pageKey: PageId,
  ctx: BusinessContext,
  name: string,
  locale: string,
  pages: PageRef[],
  ownTitle?: string | null,
): PuckNode[] {
  const lang = langOf(ctx);
  const c = chrome(lang);
  const industry = ctx.industry ?? fallbackIndustry(lang);
  const labels = labelsFromPages(industryLabels(industry, lang), pages);
  const brand = displayBusinessName(ctx);
  const generic = moduleCopy(pageKey, labels, lang);
  /*
    THE STOCK PAGE GETS THIS TRADE'S SHELF, NOT A GENERIC ONE.

    `moduleCopy` knows the trade's NOUNS -- it renames 客户 to 经销商 for a master
    dealer -- but it has never seen the trade's sample rows, so every module
    outside the main table fell back to its own generic set. On the Stock page
    that read 「Item A · Store 1 · carton」 while the Bookings page one click away
    correctly read 「Colour + treatment · Today 4:30 PM · Jasmine」. A salon owner
    being shown their own system notices that on the page whose entire subject is
    the thing they buy every month.

    Only `inventory` for now, and deliberately: it is the one module whose rows
    are about objects rather than about the trade's core transaction, which is
    what `records` already covers everywhere else.
  */
  const copy =
    pageKey === "inventory"
      ? { ...generic, rows: sampleFor(industry.slug, lang).stock }
      : generic;
  // The customer's own noun wins over the archetype's default: the AI renames
  // `customers` to 经销商 for a master dealer, and the page heading has to agree
  // with the rail or the system reads as two products bolted together.
  const title = ownTitle?.trim() || copy.title;

  const head: PuckNode[] = [
    railNavNode(labels, brand, name, pageKey, locale, pages, lang),
    node("PageHeader", `${pageKey}-header`, {
      title,
      subtitle: copy.subtitle,
      /* The one action this page is for, on every shape that has a table
         behind it -- and on no other. Read from SHAPE_STATE rather than from a
         list of page keys, so a shape going live gets its button in the same
         edit that opens /new for it, and a shape that is still a drawing
         cannot be given a button that writes nowhere.

         `title` is already this business's own noun for the module (供应商,
         经销商, 师傅), so the label is his word and not ours. */
      ...(isLiveShape(shape)
        ? {
            actionLabel: c.dashboard.primaryAction(title),
            actionHref: `/${locale}/portal/${pageKey}/new`,
          }
        : {}),
    }),
  ];

  const search = copy.searchPlaceholder
    ? [
        node("Combobox", `${pageKey}-search`, {
          name: `${pageKey}-search`,
          value: "",
          placeholder: copy.searchPlaceholder,
          options: copy.rows.map((r, i) => ({
            label: r.primary,
            value: `row-${i}`,
          })),
        }),
      ]
    : [];

  const month = [
    node("MonthPicker", `${pageKey}-month`, {
      name: `${pageKey}-month`,
      placeholder: c.shape.monthPlaceholder,
      allowClear: true,
    }),
  ];

  /* 🔴 货架画成一片格子，不是一张表 —— 见 `recordTable` 的 `look`。 */
  const shelf = [
    recordTable(`${pageKey}-table`, title, copy.columns, copy.rows, undefined, undefined, true, "cards"),
  ];

  const table = [
    /* 最后那个 `true` 换掉了那一行按不动的筛选 chip —— 见档案上面
       `filterChips` 那一段。那张表自己从行里算它真的有的那几种状态；
       算不出来（没有状态栏 · 只有一种 · 每一种都只有一行）就不画。 */
    recordTable(`${pageKey}-table`, title, copy.columns, copy.rows, undefined, undefined, true),
  ];

  /* 名册那一种的同一张表，第一栏带一颗头像 —— 那一栏是一个人／一家店。
     供应商跟师傅照旧是「左清单右详情」（他们的 Logistics 那一页），
     换掉排法的只有客户。 */
  const dirTable = [
    recordTable(`${pageKey}-table`, title, copy.columns, copy.rows, undefined, true),
  ];

  const upload = copy.upload
    ? [
        node("FileUploadField", `${pageKey}-upload`, {
          label: copy.upload.label,
          hint: copy.upload.hint,
          name: `${pageKey}-file`,
          accept: "image/*,application/pdf",
        }),
      ]
    : [];

  switch (shape) {
    /* A NAME LIST EXISTS SO SOMEBODY CAN BE OPENED, so it is the list beside
       the one selected rather than a table on its own. 供应商 and 师傅 arrive
       here; 客户 has its own builder and gets the same arrangement there. */
    case "directory":
      return [
        ...head,
        ...search,
        besideNode(pageKey, dirTable, [detailNode(pageKey, copy.columns, copy.rows[0], c)]),
      ];

    case "catalog":
      /* 🔴 上面那个「按名字或编号找」拿掉了（2026-09-05）。
         在真的浏览器里按过：**点开 0 个选项，选完画面一个字都没变**
         —— 而它就压在那张表自己那个会筛的框上面。
         **一页两个搜索框，而上面那个是假的。**
         剩下的那一个是真的（打字行数就变少，`check:table-search` 在守）。
         ⚠️ 名册那三页（客户 · 供应商 · 师傅）也是同一个 Combobox，
         那三页还没动 —— 见任务档。 */
      return [...head, ...shelf];

    case "pipeline":
      /* THE FIVE PIPELINE MODULES DO NOT SHARE A QUESTION.

         进货单 is a document -- a piece of paper a supplier reads -- and 任务 is
         a board, because 「这一件走到哪」 is the only thing anybody opens it for.
         Keying the arrangement off `shape` alone is what produced sixteen
         copies of one page; keying it off what the page is FOR is the repair.
         报价单, 订单 and 工程 have their own builders below. */
      /* 任务也是板，而且同样**只有板** —— 见 buildProjects 里那一段。 */
      if (pageKey === "tasks") {
        return [...head, boardNode(pageKey, ctx, copy.rows)];
      }
      if (pageKey === "purchases") {
        return [
          ...head,
          besideNode(pageKey, table, [
            documentNode(pageKey, copy.title, copy.columns, copy.rows[0], c),
          ]),
        ];
      }
      return [
        ...head,
        workflowStrip(
          `${pageKey}-workflow`,
          c.shape.workflow(title),
          /* Not the business's own workflow on every pipeline page: 进货单 buys,
             and buying is 开了单 → 到货了 → 付清了 everywhere. See
             stagesForModule. The page it used to draw said 「Enquiry → Quote →
             Deposit → Build」 over a list of cement orders. */
          stagesForModule(ctx, pageKey),
          1,
        ),
        ...table,
      ];

    /* 开销 · 佣金 —— 跟收款同一个骨架，同一支 `moneyNodes`。
       它们本来是两条路画出同一张脸（收款有自己的 `buildPayments`），
       而那张脸就是老板指着讲「不要一直都是同个组件」的那一张。 */
    case "ledger":
      return [
        ...head,
        ...month,
        ...moneyNodes({
          id: pageKey,
          tiles: [
            {
              label: copy.hero?.label ?? title,
              value: copy.hero?.value ?? "",
              deltaLabel: copy.hero?.suffix ?? "",
              iconName: "payments",
            },
            {
              label: copy.hero?.stats?.[0]?.label ?? c.col.status,
              value: copy.hero?.stats?.[0]?.value ?? "",
              deltaLabel: copy.hero?.stats?.[0]?.sub ?? "",
              iconName: "reconciliation",
            },
          ],
          trend: copy.trend,
          rankHeading: pageKey === "commission" ? c.money.topEarned : c.money.topSpent,
          rows: copy.rows,
          captionTemplate: c.dashboard.trendCaption,
        }),
        ...table,
        ...upload,
      ];

    /* 报表 —— 照 `analytics` 那一张：一条 KPI 带（五张卡各带涨跌跟
       「上个月是多少」），底下一张大图。而那张图用 `crm` 的
       **图在左、结论在右**：结论那一栏的总数 · 最后一期 · 占比，
       全部是那几个点自己算出来的，没有新资料也没有编出来的目标。
       ⚠️ 只有钱看得懂那个总数 —— 排行那一页的点是**人数**，
       六个月的人数加起来不是一件事，所以那一页不用它。 */
    case "report":
      return [
        ...head,
        ...month,
        ...kpiStrip(pageKey, copy, 4),
        ...reportChart(pageKey, copy, c),
        ...table,
      ];

    /* 排行 —— 同一条 KPI 带（这一页只有两个事实：有来往的 · 退步中），
       而图是普通的柱状加一个「看多久」的开关：它数的是**人**，
       把六个月的人数加起来不是一件事。 */
    case "leaderboard":
      return [...head, ...kpiStrip(pageKey, copy, 2), ...reportChart(pageKey, copy, c), ...table];

    case "reconcile":
      return [
        ...head,
        ...month,
        ...heroNode(pageKey, locale, copy),
        // The variance statement is an Alert rather than a paragraph because
        // 「对得上 / 对不上」 is a STATE, and a state the owner checks once a
        // month should be readable without being read. It is the one place in
        // the system where the answer IS the whole page.
        ...(copy.variance
          ? [
              node("Alert", `${pageKey}-variance`, {
                variant: "default",
                title: copy.variance.title,
                description: copy.variance.description,
              }),
            ]
          : []),
        ...table,
      ];

    /* 预约 is the one module whose primary axis is time rather than a row, and
       it had been rendering as a table like everything else. ⚠️ Still a
       drawing: `calendar` has no table behind it (SHAPE_STATE), so nothing
       here becomes real -- what changed is that it now has the shape of a
       diary. */
    case "calendar":
      return [...head, ...dayNodes(pageKey, copy.rows, c), ...table];

    default:
      return [...head, ...table];
  }
}

/**
 * The seven originals, each hand-written against its trade's own sample data.
 * Everything else in the catalogue is carried by `buildFromShape` above.
 *
 * Deliberately a partial map rather than a complete one: a key being absent
 * here is the signal that it is shape-built, so adding a module to the
 * catalogue needs no edit in this file at all -- only a `moduleCopy` arm.
 */
const BUILDERS: Record<
  string,
  (
    ctx: BusinessContext,
    name: string,
    locale: string,
    pages: PageRef[],
    style?: string | null,
    /** Only the dashboard reads it -- it is the only page whose composition is
     *  a choice. The others take it and ignore it so the map stays one shape. */
    layout?: string | null,
  ) => PuckNode[]
> = {
  dashboard: buildDashboard,
  customers: buildCustomers,
  quotations: buildQuotations,
  projects: buildProjects,
  payments: buildPayments,
  bookings: buildBookings,
  orders: buildOrders,
  website: buildWebsite,
};

/** Pages that are NOT wrapped in the app shell. Today that is exactly one: the
 *  page a business's own customers read. See buildWebsite for why. */
const SHELL_LESS = new Set(["website"]);

/**
 * The one entry point. Returns a complete Puck `Data` for one page of one
 * business's system.
 *
 * `businessName` is only ever cosmetic (the rail's brand label and the account
 * chip), so an account with nothing better to use falls back to a neutral word
 * rather than showing a raw email address in the customer's own product.
 */
/**
 * A page the customer invented.
 *
 * It gets a real starting point rather than an empty canvas, for exactly the
 * reason this whole file exists: a blank page handed to a business owner who
 * was promised a system is the failure this module was written to repair, and
 * it does not stop being that failure because THEY asked for the page.
 *
 * What it cannot do is guess the business meaning of "员工排班" -- so it lays
 * out the shape every operational page in this product shares (a heading, a
 * record table with four generic columns, three sample rows) using their own
 * title, and leaves the naming to them or to the assistant. That is a page
 * they edit, which is the whole workflow.
 */
function buildCustomPage(
  title: string,
  ctx: BusinessContext,
  name: string,
  locale: string,
  pages: PageRef[],
  pageId: PageId,
): PuckNode[] {
  const lang = langOf(ctx);
  const c = chrome(lang);
  const industry = ctx.industry ?? fallbackIndustry(lang);
  const labels = labelsFromPages(industryLabels(industry, lang), pages);
  const brand = displayBusinessName(ctx);

  return [
    railNavNode(labels, brand, name, pageId, locale, pages, lang),
    node("PageHeader", `${pageId}-header`, {
      title,
      subtitle: c.custom.subtitle,
    }),
    recordTable(
      `${pageId}-table`,
      title,
      c.custom.columns,
      c.custom.rows.map((row, i) => ({
        ...row,
        amount: "RM 0",
        tone: (["positive", "warning", "neutral"] as const)[i] ?? "neutral",
      })),
    ),
  ];
}

/**
 * The trade's three nouns, overridden by what THIS business calls them.
 *
 * The AI now returns a label per module (lib/portal/module-catalog.ts) and the
 * signup trigger stores it as `project_pages.title`, so a SIM-card master
 * dealer's customers page is titled 经销商. Without this, that rename reached
 * the rail and the page heading and stopped there: the ranking table two pages
 * over was still headed 客户, because `moduleCopy` read the industry row.
 *
 * Caught in a real browser rather than reasoned about -- the rail said 经销商
 * and the table under it said 客户 A / 客户 B, in the same screenshot. A system
 * that calls the same thing two names in two places is one a business owner
 * stops trusting, and it is the exact failure the trade-vocabulary work exists
 * to prevent.
 *
 * Only the three nouns that ARE vocabulary get overridden. 对账 and 佣金 are
 * page names, not nouns other pages refer to, so a rename there changes that
 * page's heading and nothing else -- which is right.
 */
function labelsFromPages(
  base: IndustryLabels,
  refs: PageRef[],
): IndustryLabels {
  const titleOf = (key: string) =>
    refs.find((p) => p.key === key)?.title?.trim() || undefined;
  return {
    customer: titleOf("customers") ?? base.customer,
    staff: titleOf("staff") ?? base.staff,
    // Whichever of the two order-shaped pages this business actually has. A
    // wholesaler has both; `orders` wins because it is the one their day runs on.
    order: titleOf("orders") ?? titleOf("projects") ?? base.order,
  };
}

/**
 * Which module the 总览 page's 「最近的<工程>」 table is actually about.
 *
 * ⚠️ It has to agree with labelsFromPages above, and that is the whole reason
 * it lives here rather than beside the projection that uses it: the caption
 * says 「最近的订单」 because `order` resolved to the 订单 page, so filling that
 * table from 报价单 would put quotations under a heading that says orders.
 *
 * The third branch is not in labelsFromPages because a LABEL can fall back to
 * the trade's generic noun and a TABLE cannot fall back to a module that does
 * not exist. A business with only 报价单 gets its quotations there, under a
 * caption using the trade's word -- which is the honest reading of a page that
 * says 「最近的工程」 to a contractor whose only pipeline is quotes.
 */
export function dashboardRecordModule(refs: PageRef[]): string | null {
  const has = (key: string) => refs.some((p) => p.key === key);
  if (has("orders")) return "orders";
  if (has("projects")) return "projects";
  return refs.map((p) => p.key).find((k) => PIPELINE_MODULES.has(k)) ?? null;
}

export function buildPageLayout(
  pageKey: PageId,
  ctx: BusinessContext,
  /** Who is signed in, for the account chip. Defaults to a placeholder in
   *  the SYSTEM language, not the site language. */
  businessName = chrome(ctx.lang ?? DEFAULT_SYSTEM_LANG).defaultBusinessName,
  locale = "zh",
  /** The business's actual page set, so the rail links only to pages it has.
   *  Defaults to the trade's standard set when the caller does not know it. */
  pages?: PageRef[],
  /** projects.style. Passed through to the dashboard builder, which uses it to
   *  choose the page's BLOCKS -- not only their paint. Safe to omit: an unknown
   *  register gets 蓝图's composition, the one whose argument is that it suits
   *  any trade. */
  style?: string | null,
  /** projects.layout — 换排法不换风格. See dashboardComposition(). */
  layout?: string | null,
): Data {
  const lang = langOf(ctx);
  const refs: PageRef[] =
    pages ?? pagesForIndustry(ctx.industry?.slug).map((key) => ({ key }));
  const labels = labelsFromPages(
    industryLabels(ctx.industry ?? fallbackIndustry(lang), lang),
    refs,
  );
  const self = refs.find((p) => p.key === pageKey);

  // Three ways a page gets built, in order of how much is known about it:
  // one of the seven hand-written templates, a catalogue archetype rendered by
  // its shape, or -- for a page the customer invented -- the generic starting
  // point. None of them is a blank canvas, which is the whole point of the
  // file.
  const archetype = MODULE_BY_KEY[pageKey];
  const [rail, ...rest] = BUILDERS[pageKey]
    ? BUILDERS[pageKey](ctx, businessName, locale, refs, style, layout)
    : archetype
      ? buildFromShape(
          archetype.shape as ModuleShape,
          pageKey,
          ctx,
          businessName,
          locale,
          refs,
          self?.title,
        )
      : buildCustomPage(
          pageLabel(self ?? { key: pageKey }, labels, lang),
          ctx,
          businessName,
          locale,
          refs,
          pageKey,
        );

  // 官网 is not a shell page. `buildWebsite` returns no rail at all, so what
  // came back as `rail` above is its first real block -- putting that in a
  // sidebar slot would file the hero into a 240px navigation column. A
  // business's website does not have 收款 and 对账 down the side of it.
  if (SHELL_LESS.has(pageKey)) {
    return { root: {}, content: [rail, ...rest] } as unknown as Data;
  }

  // The page is ONE SystemShell holding two slots, not a flat stack. Puck's
  // canvas stacks its `content` vertically, so a flat list put the full-height
  // RailNav above everything else and pushed the actual page a screen below
  // the fold -- confirmed in a real browser, not reasoned about (see
  // system-shell.tsx for the measurements). Both slots stay editable: a
  // customer can still drag blocks into either column.
  /*
    THE SPLIT SHELL FILLS ITS SECOND COLUMN FROM THE PAGE'S OWN BLOCKS.

    A register on `nav: "split"` (see SPLIT_REGISTERS) gets a persistent column
    between the rail and the page. Nothing new is invented to put in it -- the
    first one or two blocks of the page move there, which is exactly the move
    Attio and Linear make: the thing you scan is pinned on the left and the
    thing you work on fills the right.

    Blocks that must NOT go there are the ones that need width: a record table
    in a 19rem column is a record table with one visible column. So the split
    takes from the front of the stack only while the block is a narrow one.
  */
  /* 系统那一套的壳，不是客户挑的那一套 —— 见 SYSTEM_REGISTER。
     今天它解出来是 false（swiss 不分栏），而这一段留着不是死码：
     哪天系统那一套改成分栏的壳，它就是现成的。 */
  const split = SPLIT_REGISTERS.has(SYSTEM_REGISTER);
  let aside: unknown[] = [];
  let body = rest;
  if (split) {
    /*
      PageHeader IS NOT IN HERE, and the first screenshot is why. It is the
      first block on every page, so it was the first thing taken -- and the
      page's own title ended up in a 19rem column with the table beside it
      unlabelled. Attio pins the LIST on the left and keeps the record's name
      over the record. The heading belongs to the thing being worked on.

      StatRow is out for the opposite reason: four figures across is what it
      is, and four figures stacked in a 19rem column is a different component.
    */
    const NARROW = new Set(["ShelfList", "RankList", "ShareChart"]);
    /*
      WHAT A BLOCK ACTUALLY IS, through its wrapper.

      Every composed block arrives inside a `Panel` -- that is what gives a
      section its surface and its heading -- so a check against the top-level
      type matched nothing and the second column rendered EMPTY. Printed the
      tree to find it: `main: [PageHeader, Panel, Panel, Panel, StatRow,
      Columns]`. The screenshot showed an empty column; nothing failed.

      Only one level down, and only through Panel: a Columns or an Overlap is a
      LAYOUT decision the composition already made, and reaching inside those
      to move half of one into a 19rem column would take the arrangement apart.
    */
    const inner = (n: unknown): string => {
      const t = (n as { type?: string })?.type ?? "";
      if (t !== "Panel") return t;
      const kids = ((n as { props?: { body?: unknown[] } })?.props?.body ?? []) as unknown[];
      return (kids[0] as { type?: string })?.type ?? "";
    };

    const take: unknown[] = [];
    // Start past the heading, which always leads and always stays.
    let i = body.length && ((body[0] as { type?: string })?.type === "PageHeader") ? 1 : 0;
    const head = body.slice(0, i);
    while (i < body.length && take.length < 3) {
      if (!NARROW.has(inner(body[i]))) break;
      take.push(body[i]);
      i += 1;
    }
    // Never leave the main column with nothing: a split shell whose page moved
    // wholesale into the aside is a 19rem system with a hole beside it.
    if (take.length && i < body.length) {
      aside = take;
      body = [...head, ...body.slice(i)];
    }
  }

  /* 顶栏 —— 只给 STRIP_REGISTERS 那两套。见 system-bar.tsx 为什么它存在，
     跟 STRIP_REGISTERS 为什么不是六套都给。
     ⚠️ 面包屑用的是**侧栏自己的分组词** —— 不是另外写一份。侧栏分组只在页数
     够多的时候才出现（navGroup 自己会回空字串），所以页少的生意拿到的是
     一层面包屑而不是一条假的路径。 */
  const crumbs = STRIP_REGISTERS.has(style ?? "")
    ? [
        navGroup(pageKey, refs.length, chrome(lang)),
        pageLabel(self ?? { key: pageKey }, labels, lang),
      ]
        .filter(Boolean)
        .map((text) => ({ text }))
    : [];

  return {
    root: {},
    content: [
      node("SystemShell", `${pageKey}-shell`, {
        crumbs,
        /* 🔴 只有总览给这一句（2026-09-04）。其余每一页的页面标题底下本来就有
           自己的说明，两个都画就是同一屏讲两次。见 system-bar.tsx 的 `note`。
           ⚠️ 拿不到他自己那一句就**什么都不画** —— 这一条横梁上放一句通用的
           「装修/承包商 的系统」是杂讯，不是资讯。 */
        crumbNote: pageKey === "dashboard" ? ownSummaryOf(ctx, lang) : undefined,
        /* 顶上那一条右边的圆头像 —— 六个参考页每一页都有，我们六套一个都没有。
           用他自己的名字，不是一张图库照片。 */
        crumbMonogram: businessName.slice(0, 2),
        sidebar: [rail],
        aside,
        main: body,
        /* 🔴 一条 267px 宽、整页高的**空白**，在台账的每一个没有窄块的页面上。
           台账的外壳偏好是「分两栏」，而这一页没有东西可以放进第二栏
           （上面那一段自己已经写成 `aside = []`）——**外壳照样把位子留出来**。

           ⚠️ 我第一次修在外壳里问「插槽里有没有东西」，**修不好**：
           在编辑器里 Puck 把插槽当成一个组件传下来，所以不管里面有没有块，
           数出来永远是一个。真正知道有没有东西的是**这里**，因为这里就是
           装它的人。

           `nav` 由这里给的时候会**赢过**风格的偏好（客人的属性 > 风格的偏好），
           而风格自己那个深浅的属性照旧生效 —— 换掉的只有「分不分栏」。 */
        ...(split && aside.length === 0 ? { nav: "side" } : {}),
      }),
    ],
  } as unknown as Data;
}

/**
 * 哪几套风格有顶栏。
 *
 * 老板 2026-09-02:「复刻不到他们的设计吗 就是全部复刻」。二十八个实拍的后台
 * 二十八个都有一条顶栏 —— 那是我们跟 Studio Admin 并排之后剩下最大的一个
 * 结构差。但**六套都加就是六套又变成同一套**（[重点 7a](../../docs/founder-points.md)），
 * 所以它跟其他每一根轴一样，是一个选择：
 *
 *   台账   ✅  它抄的就是 Studio Admin，而那一页的顶栏是它形状的一部分
 *   图纸   ✅  最中规中矩的那一套，最普通的安排就是它的主张
 *   中台   ❌  全库最密。一条顶栏吃掉一行，而它的主张就是一屏最多行
 *   瑞士   ❌  它是印出来的那一套，纸上没有 chrome
 *   炉     ❌  宽松、在客人面前打开，少一条线就少一条线
 *   招牌   ❌  它的导航本来就在顶上，再加一条就是两条横线叠在一起
 */
/* 🔴 两套 → 全部（2026-09-03）。尺子加了组件清单之后报出来：
   **六个参考页里五个有面包屑，我们六套只有两套。**
   面包屑本来就建好了（`SystemBar`），只是当初只给了两套 ——
   这个仓库最老的那个毛病：东西建好了，线只接一半。

   ⚠️ 第一版我把六个名字列出来，`style-order.test.ts` 当场红：
   **那是这个仓库的风格名单的第二份手抄本**，而这个仓库栽在那件事上至少五次。
   现在它不是一份名单，是一句话：每一套都有。 */
export const STRIP_REGISTERS = { has: (_style: string) => true };

/**
 * THE REGISTERS BUILT ON THE THIRD SHELL.
 *
 * Researched 2026-08-26 on shipped products rather than templates. Tailwind
 * Plus publishes three application shells -- Stacked, Sidebar, Multi-Column --
 * and Attio, Linear and Superhuman all run the third. Measured against ours the
 * same day: twelve of seventeen registers had a side rail and five had a top
 * bar, and that was the whole structural range. side-deep against side-dark is
 * HOW DARK, which the palette layer owns.
 *
 * Two to start, both of which already wanted it and could not say so:
 *
 *   台账 ledger   a ledger is a list you scan and a record you open. It was
 *                 the densest table in the set with nothing beside it.
 * 🔴 中台 CAME OFF THIS LIST ON 2026-09-02, and the reason is the founder's:
 * 「还是不够明显 就是每一套都是有特点的」. Two registers on the same shell is
 * one shell, and the split -- a scan list pinned left, the record on the right
 * -- is 台账's whole argument. 中台's own brief never mentions a second column;
 * it says 「开系统就是在里面做事，不是在里面看事」 and 「全库最密」, and what
 * makes a page dense is more ROWS, not another column taking a third of them.
 *
 * ⚠️ It was also a SECOND SOURCE OF TRUTH: this Set said 中台 is split while
 * its own `SystemShell` preference said `side-dark`. The set now agrees with
 * what each register declares about itself.
 */
/* 🔴 2026-09-04 清空了，而且是被守卫逼的（industry-template.test.ts）。
   `ledger` 在这里写了两个星期，而系统收成一套之后它对工作台一点作用都没有
   —— 一份读起来像还在生效的名单。分栏的壳还在（buildDashboard 那一段），
   哪天系统那一套要用它，把 SYSTEM_REGISTER 放进来就是。 */
export const SPLIT_REGISTERS = new Set<string>();

/**
 * True when a `project_pages.layout_json` has never been written to -- the
 * signup trigger creates all five rows as `'{}'`, and a customer who has saved
 * a page has a `content` array (possibly empty, if they deleted everything --
 * which is why this checks for the KEY, not for a non-empty array. Treating a
 * deliberately-emptied page as "never generated" would resurrect the template
 * every time they reloaded, silently undoing their deletion).
 */
export function isUngeneratedLayout(layout: unknown): boolean {
  if (!layout || typeof layout !== "object") return true;
  return !("content" in (layout as Record<string, unknown>));
}

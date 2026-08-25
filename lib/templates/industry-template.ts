import type { PuckNode } from "@/lib/templates/puck-node";
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
  bottlenecks?: { title: string; description: string }[] | null;
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
function tradeLabel(industry: IndustryContext, lang: SystemLang): string {
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
function workflowStages(ctx: BusinessContext): string[] {
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
function railNav(
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
function navGroup(key: string, pageCount: number, c: Chrome): string {
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

function filterChips(
  id: string,
  kind: string,
  values: string[],
  lang: SystemLang,
): PuckNode {
  // FilterChip is {label, value, removeHref}: it shows what is CURRENTLY
  // narrowing a list, each chip removable. That is a different thing from a
  // pipeline -- workflow stages go to WorkflowStrip below, not here, because
  // six stages rendered as six removable chips read as six applied filters.
  // FilterChips is a server component and cannot read the language context, so
  // its two chrome strings are passed rather than defaulted. They land in the
  // saved layout, which also makes them editable -- a customer who wants
  // 「已套用」 instead of 「筛选条件」 changes it like any other text.
  const c = chrome(lang);
  return node("FilterChips", id, {
    chips: values.map((value) => ({ label: kind, value, removeHref: "#" })),
    clearAllHref: "#",
    filteredByLabel: c.filter.filteredBy,
    clearAllLabel: c.filter.clearAll,
  });
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
  const ownSummary =
    lang === "en"
      ? ctx.analysis?.summary_en?.trim()
      : ctx.analysis?.summary?.trim();
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
        chgSuffix: sample.heroSuffix,
        stats: sample.heroStats.map((st) => ({
          ...st,
          href: `/${locale}/portal/payments`,
        })),
        spark: sample.heroSpark.map((n) => ({ n })),
        sparkLabel: c.dashboard.sparkLabel,
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
        caption: c.dashboard.trendCaption,
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
        label: c.dashboard.trendCaption,
      }),

    /** How far through the month the money is. One bar, one number. */
    progress: () =>
      node("Progress", "dashboard-progress", {
        label: sample.heroLabel,
        value: 68,
      }),

    todo: () =>
      node("ShelfList", "dashboard-today", {
        heading: c.dashboard.todoTitle,
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
        heading: c.dashboard.rankingTitle,
        rows: sample.records.map((r) => ({
          name: r.secondary ?? r.primary,
          sub: r.secondary ? r.primary : r.status,
          amount: r.amount ?? "",
          href: followHref,
        })),
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
      const slices = [...byStatus.entries()].map(([label, value], i) => ({
        label,
        value,
        color: `var(--chart-${(i % 5) + 1})`,
      }));
      return node("ShareChart", "dashboard-share", {
        title: c.dashboard.shareTitle,
        caption: "",
        unit: "RM",
        slices,
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
  ]);

  let seq = 0;
  const build = (role: string): PuckNode | null => {
    const make = blocks[role];
    if (!make) return null;
    const inner = make();
    if (!NEEDS_SECTION.has(role)) return inner;
    // `look` is deliberately absent: puck-config-client fills it from the
    // register's preference, and a value here would out-rank the register.
    return node("Panel", `dashboard-section-${role}-${(seq += 1)}`, {
      title: "",
      description: "",
      body: [inner],
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

  const plan = dashboardComposition(style, layout);

  return layerFirst([
    railNav(labels, brand, name, "dashboard", locale, pages, lang),
    node("PageHeader", "dashboard-header", {
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
    }),
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
function headlineDelta(spark: number[] | undefined): number | null {
  if (!spark || spark.length < 2) return null;
  const prev = spark[spark.length - 2];
  const curr = spark[spark.length - 1];
  if (!prev) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export const DASHBOARD_COMPOSITION: Record<string, string[]> = {
  // A ledger is a table. It opens on one, and the figures come after -- which
  // is the order a person who reads forty rows a day actually wants. The split
  // is at the BOTTOM, where two small things belong beside each other rather
  // than as two more full-width bands under a table that is already long.
  /*
    THE TWO SPLIT REGISTERS LEAD WITH A NARROW BLOCK, and that is not
    decoration -- it is what fills the second column. See SPLIT_REGISTERS and
    the shell note in system-shell.tsx: the aside takes narrow blocks off the
    front of the stack, so a composition with none of them renders as an
    ordinary side shell and the third skeleton quietly never appears.

    台账: the list you scan pinned left, the ledger itself on the right.
  */
  ledger: ["todo", "ranking", "table", "stats4", "activity|flow@half"],
  // A shopfront: what is happening today, with the money beside it rather than
  // under it -- the owner glances right, not down.
  hearth: ["todo|stats2", "trend", "table"],
  // The neutral one, and the only one that should read as "a bit of
  // everything". Chart left, the day's list beside it: the most ordinary
  // arrangement there is, which is the point of this register.
  blueprint: ["stats4", "trend|todo", "share|flow@wide-right", "table"],
  // For an owner who cannot read the others. Two figures at 17px base, no
  // chart -- and NO SPLIT: half of 1400 at this type size is four words a
  // line. Single column is the register's whole argument.
  large: ["stats2", "todo", "table"],
  // Looks like the POS they already run: the filled table head is the object,
  // so the table leads, then the month's progress with the figures beside it.
  stamp: ["table", "progress|stats4@wide-right", "share|flow@half"],
  // Black, white and one red on a PRINTED SHEET. A printed sheet is one
  // column. No split -- this is the register where restraint is the design.
  swiss: ["stats4", "trend|share@wide-left", "table", "flow"],
  // Friendly and rounded. One figure with its own supporting numbers, the
  // day's list beside it, then the money.
  soft: ["hero|todo@half", "trend|share@wide-left", "table"],
  // Weight. Two enormous figures and the work, in slabs. No chart, no split --
  // a slab that is half a page wide stops being a slab.
  brut: ["stats2", "board", "table"],
  // Translucent panels want something behind them to see through, and two
  // panels side by side show more edges than one.
  glass: ["stats4", "trend|share|ranking", "board", "table"],
  // Lights off. An ops console: the figure and its chart side by side at the
  // top, then the queue.
  night: ["hero@over", "trend|table@wide-right", "share|todo@half"],
  // A shop sign. The name and the number are the sign; the rest is small and
  // under it. A sign does not have two halves.
  signboard: ["hero@over", "table", "flow"],
  // A coloured ground with ivory panels floating on it -- panels want to be
  // few and LARGE, so one figure beside one chart, then one table.
  lacquer: ["hero@over", "trend|share@wide-left", "table"],
  // Every character the same width. Squares and a ranking are both grids of
  // fixed cells, so they sit beside each other without either one reflowing.
  code: ["stats4", "activity|ranking", "table"],
  // A patterned floor wants flat cards above it, in a rhythm -- and a rhythm
  // needs a row of two, not a column of one.
  tile: ["stats4", "trend|todo|share", "table"],
  // The sticker. Big, playful, board-shaped, with the chart squeezed beside it.
  pop: ["stats4", "board|trend@wide-left", "share|table@wide-right"],
  // Tabler / AdminLTE, and now actually shaped like them: four tiles, then the
  // chart with the ranking BESIDE it -- which is the arrangement every one of
  // those templates uses and the one we did not have.
  console: ["stats4", "trend|ranking|share", "table", "todo"],
  // Ant Design Pro: the list is the day, so the table is first-class and
  // early. Then the same chart-and-ranking pair their own dashboard opens on.
  // 中台: Ant Design Pro's list pages all carry a second column. Share first,
  // because 「钱卡在哪一段」 is the question this register is opened with.
  counter: ["share", "todo", "stats4", "table", "trend|flow@wide-right"],
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
  "flow", "activity", "progress", "board", "hero",
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
  /** A ledger is a table, and a person who reads forty rows a day wants rows. */
  table: "ledger",
  /** Tabler / AdminLTE: four figures and a chart above the fold. */
  console: "console",
  /** One figure and a great deal of air, then the work. */
  hero: "signboard",
  /** What is happening today first, the money after it. */
  today: "hearth",
  /** The day as columns rather than as a list. */
  board: "pop",
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
export function dashboardComposition(
  style?: string | null,
  layout?: string | null,
): string[] {
  const named = layout && LAYOUT_SETS[layout as LayoutSet];
  const key = named || style;
  return (key && DASHBOARD_COMPOSITION[key]) || DASHBOARD_COMPOSITION.blueprint;
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

  return {
    brand,
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

  return template.build(content);
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
    railNav(labels, brand, name, "customers", locale, pages, lang),
    node("PageHeader", "customers-header", {
      title: c.customers.title(labels.customer),
      subtitle: c.customers.subtitle(labels.customer),
    }),
    node("TextAutocomplete", "customers-search", {
      name: "customer-search",
      placeholder: c.customers.search(labels.customer),
      suggestions: sample.customers.map((row) => ({ value: row.primary })),
    }),
    recordTable(
      "customers-list",
      c.customers.caption(labels.customer),
      {
        primary: labels.customer,
        secondary: c.col.contact,
        status: c.col.status,
      },
      sample.customers,
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
    railNav(labels, brand, name, "quotations", locale, pages, lang),
    node("PageHeader", "quotations-header", {
      title: c.quotations.title,
      subtitle: c.quotations.subtitle(labels.customer),
    }),
    filterChips(
      "quotations-filters",
      c.quotations.filterKind,
      [c.quotations.filterValue],
      lang,
    ),
    node("DatePicker", "quotations-date", {
      name: "quotation-date",
      placeholder: c.quotations.datePlaceholder,
      allowClear: true,
    }),
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
    railNav(labels, brand, name, "projects", locale, pages, lang),
    node("PageHeader", "projects-header", {
      title: c.projects.title(labels.order),
      // The bottleneck the AI actually identified, named on the page whose job
      // is to fix it -- so the analysis shows up as working software rather
      // than as a paragraph the visitor read once and closed.
      subtitle: ctx.analysis?.bottlenecks?.[0]?.title
        ? c.projects.focus(ctx.analysis.bottlenecks[0].title)
        : c.projects.subtitle(labels.order),
    }),
    workflowStrip(
      "projects-workflow",
      c.projects.workflow(labels.order),
      workflowStages(ctx),
      1,
    ),
    node("Listbox", "projects-staff", {
      name: "assigned-staff",
      placeholder: c.projects.staffPlaceholder(labels.staff),
      options: [
        { label: c.projects.allStaff(labels.staff), value: "all" },
        { label: `${labels.staff} A`, value: "a" },
        { label: `${labels.staff} B`, value: "b" },
      ],
    }),
    recordTable(
      "projects-list",
      c.projects.caption(labels.order),
      {
        primary: labels.order,
        secondary: labels.customer,
        amount: c.col.amount,
        status: c.col.progress,
      },
      sample.records,
    ),
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
    railNav(labels, brand, name, "payments", locale, pages, lang),
    node("PageHeader", "payments-header", {
      title: c.payments.title,
      subtitle: c.payments.subtitle(labels.customer),
    }),
    node("MonthPicker", "payments-month", {
      name: "payment-month",
      placeholder: c.payments.monthPlaceholder,
      allowClear: true,
    }),
    node("HeroCard", "payments-hero", {
      label: sample.heroLabel,
      value: sample.heroValue,
      href: `/${locale}/portal/payments`,
      chgSuffix: sample.heroSuffix,
      // Every supporting stat links back into the system rather than nowhere:
      // the number a business owner reacts to ("RM 31,200 已做未收") should be
      // the thing that takes them to the page where they act on it.
      stats: sample.heroStats.map((st) => ({
        ...st,
        href: `/${locale}/portal/payments`,
      })),
      spark: sample.heroSpark.map((n) => ({ n })),
      sparkLabel: c.dashboard.sparkLabel,
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
    railNav(labels, brand, name, "bookings", locale, pages, lang),
    node("PageHeader", "bookings-header", {
      title: c.bookings.title,
      subtitle: c.bookings.subtitle(labels.staff),
    }),
    node("DatePicker", "bookings-date", {
      name: "booking-date",
      placeholder: c.bookings.datePlaceholder,
      allowClear: true,
    }),
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
    railNav(labels, brand, name, "orders", locale, pages, lang),
    node("PageHeader", "orders-header", {
      title: c.orders.title(labels.order),
      subtitle: ctx.analysis?.bottlenecks?.[0]?.title
        ? c.orders.focus(ctx.analysis.bottlenecks[0].title)
        : c.orders.subtitle(labels.order),
    }),
    workflowStrip(
      "orders-workflow",
      c.orders.workflow(labels.order),
      workflowStages(ctx),
      1,
    ),
    filterChips("orders-filters", c.orders.filterKind, [c.orders.filterValue], lang),
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
      chgSuffix: copy.hero.suffix,
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
  const copy = moduleCopy(pageKey, labels, lang);
  // The customer's own noun wins over the archetype's default: the AI renames
  // `customers` to 经销商 for a master dealer, and the page heading has to agree
  // with the rail or the system reads as two products bolted together.
  const title = ownTitle?.trim() || copy.title;

  const head: PuckNode[] = [
    railNav(labels, brand, name, pageKey, locale, pages, lang),
    node("PageHeader", `${pageKey}-header`, { title, subtitle: copy.subtitle }),
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

  const filter = copy.filter
    ? [
        filterChips(
          `${pageKey}-filters`,
          copy.filter.kind,
          [copy.filter.value],
          lang,
        ),
      ]
    : [];

  const month = [
    node("MonthPicker", `${pageKey}-month`, {
      name: `${pageKey}-month`,
      placeholder: c.shape.monthPlaceholder,
      allowClear: true,
    }),
  ];

  const table = [
    recordTable(`${pageKey}-table`, title, copy.columns, copy.rows),
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
    case "directory":
      return [...head, ...search, ...table];

    case "catalog":
      return [...head, ...search, ...filter, ...table];

    case "pipeline":
      return [
        ...head,
        workflowStrip(
          `${pageKey}-workflow`,
          c.shape.workflow(title),
          workflowStages(ctx),
          1,
        ),
        ...filter,
        ...table,
      ];

    case "ledger":
      return [
        ...head,
        ...month,
        ...heroNode(pageKey, locale, copy),
        ...table,
        ...upload,
      ];

    case "report":
      return [
        ...head,
        ...month,
        ...heroNode(pageKey, locale, copy),
        ...trendNode(pageKey, copy),
        ...table,
      ];

    case "leaderboard":
      return [...head, ...filter, ...trendNode(pageKey, copy), ...table];

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
    railNav(labels, brand, name, pageId, locale, pages, lang),
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
  const split = SPLIT_REGISTERS.has(style ?? "");
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

  return {
    root: {},
    content: [
      node("SystemShell", `${pageKey}-shell`, {
        sidebar: [rail],
        aside,
        main: body,
      }),
    ],
  } as unknown as Data;
}

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
 *   中台 counter  the Ant-Design-Pro lineage this was measured from ships a
 *                 second column in every one of its list pages.
 */
export const SPLIT_REGISTERS = new Set(["ledger", "counter"]);

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

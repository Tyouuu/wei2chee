import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PAGE_KEYS,
  PAGES_FOR_INDUSTRY,
  buildPageLayout,
  isUngeneratedLayout,
  pagesForIndustry,
  type BusinessContext,
  type PageKey,
  DASHBOARD_COMPOSITION,
  COMPOSITION_ROLES,
  SPLIT_REGISTERS,
} from "./industry-template";
import { puckConfig } from "@/design-system/editor/puck-config";
import { walkNodes, type PuckNode } from "@/lib/portal/layout-ops";
import { MOVABLE } from "@/lib/templates/site-composition";

const renovation: BusinessContext = {
  industry: {
    slug: "renovation",
    name_zh: "装修/承包商",
    labels: { customer: "客户", order: "项目", staff: "师傅" },
    default_workflow: ["Customer", "Quotation", "Approval", "Deposit", "Project", "Final Payment"],
    suggested_modules: ["Customer", "Quotation", "Project", "Payment"],
  },
  analysis: {
    summary: "你的报价到收订金之间拖太久了。",
    summary_en: "Too long a gap between your quote and the deposit.",
    after_workflow: ["客户", "报价", "订金", "施工", "尾款"],
    after_workflow_en: ["Client", "Quote", "Deposit", "Build", "Balance"],
    bottlenecks: [{ title: "报价追不动", description: "发出去就没下文" }],
  },
};

/** The same business with its system built in Chinese. English is the
 *  default (lib/system-lang.ts), so every assertion about Chinese output
 *  has to ask for it explicitly -- which is the point of asserting both. */
const renovationZh: BusinessContext = { ...renovation, lang: "zh" };

type Node = { type: string; props: Record<string, unknown> };

/** A page is one SystemShell wrapping two slots, and since 2026-08-25 the
 *  blocks inside `main` are themselves nested -- in a `Panel` that gives the
 *  section a surface, or in a `Columns` that puts two of them side by side.
 *  These assertions are about what the customer ends up LOOKING AT, so they
 *  have to reach all the way down.
 *
 *  WHY IT BORROWS walkNodes RATHER THAN LISTING SLOTS AGAIN. This helper used
 *  to carry its own `["sidebar", "main"]`, a second copy of the list in
 *  layout-ops.ts, and when the dashboard started nesting, both copies were
 *  wrong in the same way on the same day. That one derives its slot names from
 *  the Puck config now; this uses that one. */
const flatten = (nodes: Node[]): Node[] =>
  walkNodes(nodes as unknown as PuckNode[]) as unknown as Node[];

const layoutOf = (ctx: BusinessContext, key: (typeof PAGE_KEYS)[number], locale?: string) =>
  buildPageLayout(key, ctx, "我的生意", locale) as unknown as { content: Node[] };

const contentOf = (ctx: BusinessContext, key: (typeof PAGE_KEYS)[number], locale?: string) =>
  flatten(layoutOf(ctx, key, locale).content);

/**
 * The pages the OWNER works in -- everything except 官网.
 *
 * 官网 is the page a business's own customers read, so three of the guarantees
 * below deliberately do not hold for it: it has no navigation rail (nobody
 * browses a shop's website by its internal modules), it is not wrapped in the
 * app shell, and it has no RecordTable (a stranger is not shown the ledger).
 * Kept as an explicit exception list rather than softening the assertions, so
 * a SECOND page that quietly stopped having a rail would still fail here.
 */
const SHELL_PAGES = PAGE_KEYS.filter((k) => k !== "website");

describe("buildPageLayout", () => {
  it("builds every one of the pages with real content", () => {
    for (const key of PAGE_KEYS) {
      const content = contentOf(renovation, key);
      expect(content.length, `${key} should not be empty`).toBeGreaterThan(2);
    }
  });

  // The single most important guarantee in this file. A template that names a
  // component the editor does not have renders as a blank slot for a paying
  // customer -- and because the templates are built in code rather than
  // returned by a model, that failure is entirely preventable HERE.
  it("only ever emits components the Puck editor actually has registered", () => {
    const registered = new Set(Object.keys(puckConfig.components));
    for (const key of PAGE_KEYS) {
      for (const node of contentOf(renovation, key)) {
        expect(registered, `${key} uses unregistered component ${node.type}`).toContain(node.type);
      }
    }
  });

  // Puck reserves `id` on every component's props and uses it for selection,
  // drag targets and undo history. Two nodes sharing one id makes the editor
  // select the wrong thing.
  it("gives every component a unique id within its page", () => {
    for (const key of PAGE_KEYS) {
      const ids = contentOf(renovation, key).map((n) => n.props.id);
      expect(new Set(ids).size, `${key} has duplicate ids`).toBe(ids.length);
    }
  });

  it("uses the business's own vocabulary rather than generic nouns", () => {
    // "项目" and "师傅" are this industry's words for order and staff; a
    // template still saying "订单"/"员工" here would mean labels never reached
    // the layout at all.
    const zh = JSON.stringify(contentOf(renovationZh, "projects"));
    expect(zh).toContain("项目");
    expect(zh).toContain("师傅");

    // The same guarantee in the DEFAULT language. A contractor's order is a
    // Project and their people are the Crew -- not the catalogue's generic
    // Order and Staff, which is what a missing INDUSTRY_LABELS_EN row would
    // silently produce.
    const en = JSON.stringify(contentOf(renovation, "projects"));
    expect(en).toContain("Project");
    expect(en).toContain("Crew");
    expect(en).not.toContain("项目");
  });

  it("puts the AI's own summary on the first screen the customer sees", () => {
    const zh = contentOf(renovationZh, "dashboard").find((n) => n.type === "PageHeader");
    expect(zh?.props.subtitle).toBe("你的报价到收订金之间拖太久了。");

    // The default pairing: the owner read their analysis in Chinese and the
    // system is built in English, so the summary has to come from the
    // model's English field rather than being dropped for a generic line.
    const en = contentOf(renovation, "dashboard").find((n) => n.type === "PageHeader");
    expect(en?.props.subtitle).toBe(
      "Too long a gap between your quote and the deposit.",
    );
  });

  it("puts the AI's recommended workflow into the pipeline component", () => {
    const stagesOf = (ctx: BusinessContext) => {
      const strip = contentOf(ctx, "dashboard").find((n) => n.type === "WorkflowStrip");
      return (strip?.props.stages as { label: string }[]).map((s) => s.label);
    };
    expect(stagesOf(renovationZh)).toEqual(["客户", "报价", "订金", "施工", "尾款"]);

    // Not a translation of the line above -- the model returns a tailored
    // workflow per language, and an English system that fell back to the
    // industry default here would silently throw away the analysis.
    expect(stagesOf(renovation)).toEqual([
      "Client",
      "Quote",
      "Deposit",
      "Build",
      "Balance",
    ]);
  });

  it("falls back to the industry's own workflow, translated, with no analysis", () => {
    const stagesOf = (ctx: BusinessContext) => {
      const strip = contentOf(ctx, "dashboard").find((n) => n.type === "WorkflowStrip");
      return (strip?.props.stages as { label: string }[]).map((s) => s.label);
    };
    expect(
      stagesOf({ industry: renovation.industry, analysis: null, lang: "zh" }),
    ).toEqual(["客户", "报价", "确认", "订金", "施工", "尾款"]);

    // `industries.default_workflow` is stored in English, but it is the
    // FOUNDER'S English -- the vocabulary shared with reference_cases and the
    // analysis prompt. Passing it through untranslated printed "Customer" as
    // the first thing that happens after a stranger calls a contractor, which
    // reads as a database enum because it is one. Both languages now map it to
    // the words the person on the other side would use.
    expect(stagesOf({ industry: renovation.industry, analysis: null })).toEqual([
      "Enquiry",
      "Quote",
      "Approved",
      "Deposit",
      "Build",
      "Balance",
    ]);
  });

  // The case that matters most for not repeating the original bug: someone who
  // signed up without ever answering the questionnaire must still get a
  // working system, never a blank canvas.
  it("still produces a complete system with no context at all", () => {
    for (const key of SHELL_PAGES) {
      const content = contentOf({}, key);
      expect(content.length, `${key} should not be empty`).toBeGreaterThan(2);
      expect(content.some((n) => n.type === "RecordTable")).toBe(true);
    }
  });

  // 官网 with nothing known about the business still has to be a real page.
  //
  // It got considerably longer on 2026-08-25, and the reason is the founder's
  // own list of what a Malaysian SME page was missing: 「缺的是口碑、价目、覆盖
  // 范围、常见问题、营业时间、保证」. Every one of those is a question a stranger
  // asks before messaging, and a page that does not answer them sends the
  // stranger to WhatsApp to ask -- which is one more reason not to bother.
  it("builds a website out of nothing but the fallback trade", () => {
    const content = contentOf({}, "website");
    expect(content.map((n) => n.type)).toEqual([
      // The bar and the foot arrived 2026-08-27: a website has both and a
      // dashboard has neither, which is why the page built out of dashboard
      // blocks had neither either. See site-chrome.tsx.
      "SiteBar",
      "SiteHero",
      /* 一句话占一屏, 2026-08-27, from lapa.ninja. Present on every register and
         carrying a sentence on three of them -- 瑞士, 柔和, 工作室 -- because it
         MOVES the hero's supporting line rather than adding one. On the other
         eleven it is empty and renders nothing, which is deliberate: the block
         is left in place because a register that deletes a block is a register
         that could delete the owner's own prices. See statementFor(). */
      "SiteStatement",
      /*
        THE MIDDLE IS IN 图纸's ORDER, NOT THE TEMPLATE'S, SINCE 2026-08-27.

        A website with no register named falls to 蓝图 exactly as a dashboard
        does, and 蓝图's website skeleton is the most ordinary order there is:
        what we do, what it looks like, what happens next. The order itself is
        asserted against SITE_COMPOSITION in site-composition.test.ts rather
        than spelled twice; what this list is still for is the CONTENTS -- the
        founder's own list of what a Malaysian SME page was missing:
        「缺的是口碑、价目、覆盖范围、常见问题、营业时间、保证」.
      */
      // Cards, not rows: what a business SELLS is a card grid on every
      // reference, and rows are for what it merely lists. 2026-08-27.
      "SiteFeatures",      // what we do
      // 作品墙. Was a Columns of three PhotoFrames locked to thirds; it owns
      // its own shapes now (三张一样大 / 一大两小 / 横着滑), taken from tailark's
      // bento and carousel blocks, and the register picks one. 2026-08-27.
      "SiteGallery",
      // 一段话配一张照片 -- the only section written in the owner's own voice,
      // and therefore the only one that ships EMPTY. See publish-projection.
      "SiteStory",
      // 师傅团队 -- composition taken from the pulled library's team-1, data
      // model replaced. Ships empty; publish-projection drops it until the
      // owner names somebody. 2026-08-27.
      "SiteTeam",
      "SiteSteps", // what happens after you call
      "InfoRows",      // a price guide, never a price
      // A review has a rating, the words and a face -- not the dashboard's
      // 「title, description, action」 shelf row.
      /* 四点两栏配照片, 2026-08-27 -- the largest section on Wix's Home
         Remodeling page (1068px of 4742) and the one we had no equivalent
         for: four claims in two columns with the photographs woven among
         them. See SiteWoven. */
      "SiteWoven",
      "SiteTestimonials",
      // The middle ask. No template had one; every reference does.
      // 别人给的证明 -- a licence, a brand, a review score. Taken from the one
      // section kind every landing kit has and this product had no block for
      // (npm run shoot:kits, 2026-08-27). It is here in the EDITOR and never on
      // the published page until the owner fills it; see publish-projection.
      // 蓝图 puts it straight under what customers said: both are somebody
      // else vouching, and they read as one argument.
      "SiteCreds",
      /* 一条满边的照片, 2026-08-27. Wix's two templates in this market run 6 and
         14 photographs a page with two of them edge to edge between sections;
         ours ran 2-5, every one inside the measure. Ships empty and
         publish-projection drops it until the owner puts a photo in. */
      "SiteBand",
      "SiteCta",
      "FoldSection",   // questions we get
      "InfoRows",      // where we cover
      /* 图纸 declines 保证 on 2026-08-27 -- the flow already makes that
         promise, and this section repeated it. See `omit` in
         site-composition.ts. */      // what you get from us
      "EnquiryForm",
      "InfoRows",      // how to reach us
      "SiteFoot",
      // The floating WhatsApp button, last so its fixed position has nothing
      // after it to fight. Added 2026-08-26; see floating-contact.tsx.
      "FloatingContact",
    ]);
  });

  // 换风格 changes the page's SKELETON, not its paint -- the same thing the
  // dashboard's composition does, wired to the website on 2026-08-27. This
  // asserts the wire from the outside; site-composition.test.ts covers the
  // table itself.
  it("gives two registers two different websites", () => {
    const sectionsOf = (style: string) =>
      (
        buildPageLayout("website", renovation, "我的生意", "zh", undefined, style) as unknown as {
          content: Node[];
        }
      ).content.map((n) => String(n.props.id));
    expect(sectionsOf("ledger")).not.toEqual(sectionsOf("hearth"));
    /* 台账 opens on the price list, 炉 opens on the photographs.
       「Opens」 means the first section a register is free to move, which is
       not the same as the third block: the head is pinned (bar, hero, and
       since 2026-08-27 the 一句话 band, which no register reorders). Indexing
       past the head by hand is how this assertion broke when the band was
       added -- it now finds the first movable block instead. */
    const opensOn = (style: string) =>
      sectionsOf(style).find((id) => MOVABLE.some((k) => id === `website-${k}`));
    /* 台账 opened on 价目表 until 2026-08-27, when it was rebuilt to copy Wix's
       `wh-newel` end to end. Two reasons, and the second is the one that
       matters: their page has no price list at all, AND 任务 26 measured 19
       Malaysian trade sites still trading with 0 OF 19 putting prices on the
       first screen. A contractor leads with who they are and what they built.
       The price list is still in the library; it stopped being the opening. */
    expect(opensOn("ledger")).toBe("website-story");
    /* 满图 opened on 作品墙 until 2026-08-27, when it was rebuilt to copy Wix's
       Home Remodeling page END TO END rather than one section at a time. That
       page has no gallery: its photographs live inside the argument, two of
       them woven through 「Why Choose Us?」 and one full-bleed between
       sections. So 满图 declines 作品墙 and opens on what it does — which is
       the register genuinely differing, not the assertion drifting.

       Then, still on 2026-08-27, both pages were read out of the DOM section by
       section and lined up against each other. Ours ran 8 sections to their 8,
       but 服务 sat where their SECOND section is, so everything below it was one
       slot out of step the whole way down, and 満図 was moved to open on 流程.

       ⚠️ CHANGED BACK 2026-08-28, and the reason is that the sentence above was
       written about a DIFFERENT PAGE. 満図's reference moved from Wix's Home
       Remodeling to `a-reynolds`, and nobody re-read the second section
       afterwards. Read at native size on 2026-08-28, A. Reynolds' second
       section is 「Our Expertise」: FIVE CARDS, three then two, each on a
       #f1f1ee panel with an icon. Not a heading with three text items — that
       was the old page. Their fourth section is three more cards
       (「Our Specializations」), so the shape their page opens on is SERVICES,
       twice, and the process is not on it at all.

       So 満図 opens on 服务 and keeps 流程 in the fourth slot wearing the same
       card skin with the step number as its mark — which is how the reference
       itself separates its two rows of cards. */
    expect(opensOn("hearth")).toBe("website-services");
  });

  // The arrow the whole page exists to draw. An enquiry has to say which of
  // THIS business's pages it becomes -- and it has to be a page they own.
  it("points the enquiry form at a page the business actually has", () => {
    const landsIn = (ctx: BusinessContext) =>
      contentOf(ctx, "website").find((n) => n.type === "EnquiryForm")!.props
        .landsIn;
    expect(landsIn(renovationZh)).toBe("报价单");

    // The arrow has to survive the language change: an English website
    // promising a record in 「报价单」 names a page that system does not
    // have under that name.
    expect(landsIn(renovation)).toBe("Quotations");
  });

  // 2026-08-25. 「你应该想到更多方面就是可能别的行业是不用这个报价单的呢？我不是
  // 只做一个行业呢？」 -- three separate ways the old hard-coded array got this
  // wrong for a business that is not a renovation contractor.
  describe("the enquiry follows the trade, not an array's order", () => {
    const websiteBlocks = (ctx: BusinessContext) =>
      contentOf(ctx, "website").map((n) => n.type);
    const formOf = (ctx: BusinessContext) =>
      contentOf(ctx, "website").find((n) => n.type === "EnquiryForm");

    it("lands where the ANALYSIS says, not where the array says first", () => {
      // A wholesaler has quotations AND orders. The array put quotations
      // first, so every wholesaler landed there -- but one taking repeat
      // business off its own site is taking ORDERS.
      const wholesaler: BusinessContext = {
        ...renovationZh,
        industry: {
          ...renovationZh.industry!,
          slug: "wholesale",
          // Its own nouns, so the assertion below is about WHERE the enquiry
          // landed and not about which word the renovation fixture happens to
          // use for an order.
          labels: { customer: "经销商", order: "订单", staff: "员工" },
        },
        analysis: {
          ...renovationZh.analysis!,
          enquiry: { lands_in: "orders", fields: [] },
        },
      };
      expect(formOf(wholesaler)!.props.landsIn).toBe("订单");
    });

    it("gives a walk-in trade no form at all rather than an inbox that never fills", () => {
      const kopitiam: BusinessContext = {
        ...renovationZh,
        industry: { ...renovationZh.industry!, slug: "fnb" },
        analysis: {
          ...renovationZh.analysis!,
          enquiry: { lands_in: "none", fields: [] },
        },
      };
      expect(websiteBlocks(kopitiam)).not.toContain("EnquiryForm");
      // Still a real page: who you are, what you do, how to find you.
      expect(websiteBlocks(kopitiam)).toContain("InfoRows");
    });

    it("asks the questions this trade needs, not the renovation ones", () => {
      const workshop: BusinessContext = {
        ...renovationZh,
        analysis: {
          ...renovationZh.analysis!,
          enquiry: {
            lands_in: "quotations",
            fields: [
              { label: "称呼", label_en: "Your name", kind: "text" },
              { label: "车型", label_en: "Car model", kind: "text" },
              { label: "什么问题", label_en: "What is wrong?", kind: "long" },
            ],
          },
        },
      };
      const asked = (formOf(workshop)!.props.fields as { label: string }[]).map(
        (f) => f.label,
      );
      expect(asked).toEqual(["称呼", "车型", "什么问题"]);
    });

    it("still builds a form the old way for an analysis written before this existed", () => {
      // renovationZh has no `enquiry` at all -- every system provisioned
      // before 2026-08-25 is in this state, and none of them may change shape.
      expect(formOf(renovationZh)!.props.landsIn).toBe("报价单");
    });
  });

  it("gives every page the same navigation, so the five read as one system", () => {
    for (const key of SHELL_PAGES) {
      const rail = contentOf(renovation, key).find((n) => n.type === "RailNav");
      expect(rail, `${key} has no RailNav`).toBeDefined();
      // One entry per page the business actually has, rather than a magic
      // number: the set grew from five to six the day 官网 was added, and a
      // hardcoded count fails for the right reason but says the wrong thing.
      expect((rail!.props.items as unknown[]).length, key).toBe(
        PAGES_FOR_INDUSTRY.renovation.length,
      );
    }
  });

  // RailNav has no `active` prop -- it matches `usePathname()` against each
  // item's href, so a template emitting unprefixed hrefs highlights nothing.
  it("emits locale-prefixed hrefs so the current page highlights", () => {
    const rail = contentOf(renovation, "dashboard", "en").find((n) => n.type === "RailNav");
    const hrefs = (rail!.props.items as { href: string }[]).map((i) => i.href);
    expect(hrefs).toContain("/en/portal/customers");
  });

  // The regression this shell exists to prevent: a full-height RailNav sitting
  // in the same vertical stack as the page content pushes that content a whole
  // screen below the fold.
  it("wraps every page in one shell, with the nav in the sidebar slot", () => {
    for (const key of SHELL_PAGES) {
      const top = layoutOf(renovation, key).content;
      expect(top, key).toHaveLength(1);
      expect(top[0].type).toBe("SystemShell");
      const sidebar = top[0].props.sidebar as Node[];
      expect(sidebar.map((n) => n.type), key).toEqual(["RailNav"]);
      expect((top[0].props.main as Node[]).some((n) => n.type === "RailNav")).toBe(false);
    }
  });

  // ...and 官网 is the one page that is NOT wrapped, which is the whole
  // difference between a page the owner works in and a page a stranger reads.
  it("leaves the website out of the shell, with no rail anywhere in it", () => {
    const top = layoutOf(renovation, "website").content;
    expect(top.some((n) => n.type === "SystemShell")).toBe(false);
    expect(contentOf(renovation, "website").some((n) => n.type === "RailNav")).toBe(false);
  });
});

describe("isUngeneratedLayout", () => {
  it("treats the trigger's empty default as never generated", () => {
    expect(isUngeneratedLayout({})).toBe(true);
    expect(isUngeneratedLayout(null)).toBe(true);
  });

  // A customer who deliberately deleted every block has a page with an EMPTY
  // content array. Regenerating the template over that would silently undo
  // their deletion on every reload.
  it("treats a deliberately emptied page as already generated", () => {
    expect(isUngeneratedLayout({ root: {}, content: [] })).toBe(false);
  });
});

/**
 * Pages are provisioned per industry by a SQL function the signup trigger calls
 * (`pages_for_industry`, migration 20260820160000), while this module builds
 * their CONTENT from a TypeScript copy of the same mapping. Two copies of one
 * decision, in two languages, that nothing forces to agree.
 *
 * The failure is silent and bad: a page the trigger creates but this module
 * cannot build renders as an empty canvas for a paying customer -- the exact
 * bug the whole templates module exists to prevent. So the SQL is parsed and
 * compared here.
 */
describe("per-industry page sets", () => {
  // The NEWEST migration that declares the function, not a pinned filename.
  // `pages_for_industry` has been re-declared twice now (20260820160000, then
  // 20260821040000 when the module catalogue replaced the fixed seven page
  // types), and a test pinned to the first one compares the app against SQL
  // that Postgres has already replaced -- which is worse than no test, because
  // it passes while the real mapping drifts.
  const migrationsDir = join(process.cwd(), "supabase", "migrations");
  const declaringFile = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .reverse()
    .find((f) =>
      readFileSync(join(migrationsDir, f), "utf8").includes(
        "function public.pages_for_industry",
      ),
    );
  const sql = readFileSync(join(migrationsDir, declaringFile!), "utf8");

  /** Pulls `when 'slug' then array['a','b']` pairs out of the SQL function. */
  function sqlMapping(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    const re = /when\s+'([a-z]+)'\s+then\s+array\[([^\]]+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) {
      out[m[1]] = m[2].split(",").map((v) => v.trim().replace(/'/g, ""));
    }
    return out;
  }

  it("extracts a non-trivial mapping from the migration", () => {
    // Guards the regex itself: if it ever stopped matching, the comparison
    // below would pass vacuously against an empty object.
    expect(Object.keys(sqlMapping()).length).toBeGreaterThanOrEqual(5);
  });

  it("agrees with the SQL function the signup trigger actually uses", () => {
    for (const [slug, keys] of Object.entries(sqlMapping())) {
      expect(PAGES_FOR_INDUSTRY[slug], `mapping for ${slug}`).toEqual(keys);
    }
  });

  it("falls back to the general set for an unknown or missing industry", () => {
    expect(pagesForIndustry("no-such-trade")).toEqual(pagesForIndustry(null));
    expect(pagesForIndustry(undefined)).toContain("dashboard");
  });

  it("can build every page it claims a trade should have", () => {
    for (const [slug, keys] of Object.entries(PAGES_FOR_INDUSTRY)) {
      for (const key of keys) {
        expect(PAGE_KEYS, `${slug} wants unbuildable page ${key}`).toContain(key);
        const built = buildPageLayout(key, { industry: { ...renovation.industry!, slug } });
        const content = (built as unknown as { content: Node[] }).content;
        expect(content.length, `${slug}/${key}`).toBeGreaterThan(0);
      }
    }
  });

  // A salon shown a link to a 报价单 page its account does not have is a 404
  // waiting to happen, and reads as the product not knowing its own shape.
  it("never links the nav to a page the business does not have", () => {
    for (const [slug, keys] of Object.entries(PAGES_FOR_INDUSTRY)) {
      const ctx: BusinessContext = { industry: { ...renovation.industry!, slug } };
      const rail = contentOf(ctx, keys[0]).find((n) => n.type === "RailNav");
      const linked = (rail!.props.items as { href: string }[]).map(
        (i) => i.href.split("/").pop() as PageKey,
      );
      expect(linked.sort(), slug).toEqual([...keys].sort());
    }
  });

  it("gives appointment-led trades a bookings page and no quotations page", () => {
    for (const slug of ["beauty", "education"]) {
      expect(PAGES_FOR_INDUSTRY[slug]).toContain("bookings");
      expect(PAGES_FOR_INDUSTRY[slug]).not.toContain("quotations");
      expect(PAGES_FOR_INDUSTRY[slug]).not.toContain("projects");
    }
  });

  it("gives transaction-led trades an orders page and no projects page", () => {
    for (const slug of ["retail", "fnb"]) {
      expect(PAGES_FOR_INDUSTRY[slug]).toContain("orders");
      expect(PAGES_FOR_INDUSTRY[slug]).not.toContain("projects");
    }
  });
});

describe("DASHBOARD_COMPOSITION", () => {
  /*
    THE TEST THAT WOULD HAVE CAUGHT IT.

    compose() ignores a role it does not know, which is correct at runtime -- a
    typo must never blank a customer's page -- and invisible at authoring time.
    On 2026-08-26 台账 and 中台 were written with a lead block called "today"
    when the builder is called "todo", and both rendered with an empty second
    column. Nothing failed; a screenshot found it.

    Third time this repo has been bitten by a Record<string, string> that
    TypeScript cannot check: design-doc.test.ts was written for the same reason
    and found nine dead variant preferences on its first run.
  */
  it("every role in every register's composition is a real one", () => {
    const bad: string[] = [];
    for (const [style, entries] of Object.entries(DASHBOARD_COMPOSITION)) {
      for (const entry of entries) {
        // "a|b@wide-left" -> ["a", "b"]; "role@over" -> ["role"]
        for (const role of entry.split("@")[0].split("|")) {
          if (!COMPOSITION_ROLES.has(role)) bad.push(`${style}: ${role}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("every split register leads with a block the aside can actually take", () => {
    // A split shell whose composition has no narrow block renders as an
    // ordinary side shell, and the third skeleton silently never appears.
    const NARROW_ROLES = new Set(["todo", "ranking", "share"]);
    for (const style of SPLIT_REGISTERS) {
      const entries = DASHBOARD_COMPOSITION[style] ?? [];
      const roles = entries.flatMap((e) => e.split("@")[0].split("|"));
      expect(
        roles.some((r) => NARROW_ROLES.has(r)),
        `${style} is on the split shell with nothing narrow to put in the second column`,
      ).toBe(true);
    }
  });
});

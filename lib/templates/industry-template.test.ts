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
  SYSTEM_COMPOSITION,
} from "./industry-template";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
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
    /* 🔴 「师傅」搬到它真的出现的那一页（2026-09-05）。
       在这之前它出现在工程页上，而唯一说出它的是一个「All crew」的下拉 ——
       **那个下拉什么都不筛**（一张走单记录上没有师傅那一栏），
       而它的选项「师傅 A」「师傅 B」是编出来的两个人名。
       这一条要守的是「这一行自己的词有没有到得了版面」，不是
       「那个词有没有被印在某个地方」—— 所以它现在问的是师傅自己那一页。 */
    expect(JSON.stringify(contentOf(renovationZh, "staff"))).toContain("师傅");

    // The same guarantee in the DEFAULT language. A contractor's order is a
    // Project and their people are the Crew -- not the catalogue's generic
    // Order and Staff, which is what a missing INDUSTRY_LABELS_EN row would
    // silently produce.
    const en = JSON.stringify(contentOf(renovation, "projects"));
    expect(en).toContain("Project");
    expect(JSON.stringify(contentOf(renovation, "staff"))).toContain("Crew");
    expect(en).not.toContain("项目");
  });

  it("puts the AI's own summary on the first screen the customer sees", () => {
    /* 🔴 2026-09-04 换了地方，没有换事实。总览照 arhamkhnz 拿掉了页面标题，
       而那一句本来住在标题底下。它现在画在顶上那一条横梁的右边
       （`SystemShell.crumbNote` → `SystemBar.note`）——
       **不是消失了**，那会是这个仓库第十八次「算出来却到不了画面」。 */
    const noteOf = (ctx: BusinessContext) =>
      (buildPageLayout("dashboard", ctx, "兴发装修", "zh") as unknown as
        { content: PuckNode[] }).content[0]?.props?.crumbNote;

    expect(noteOf(renovationZh)).toBe("你的报价到收订金之间拖太久了。");

    // The default pairing: the owner read their analysis in Chinese and the
    // system is built in English, so the summary has to come from the
    // model's English field rather than being dropped for a generic line.
    expect(noteOf(renovation)).toBe(
      "Too long a gap between your quote and the deposit.",
    );
  });

  it("puts the AI's recommended workflow into the pipeline component", () => {
      /* 🔴 2026-09-04：从总览搬到订单那一页。总览照 arhamkhnz 收成三块
         （四张数字卡 → 图表卡 → 表），流程条不在上面了 —— 而它本来就该在
         订单那一页：那是客户一天里真的在推动一张单的地方。 */
    const stagesOf = (ctx: BusinessContext) => {
      const strip = contentOf(ctx, "orders").find((n) => n.type === "WorkflowStrip");
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
      /* 🔴 2026-09-04：从总览搬到订单那一页。总览照 arhamkhnz 收成三块
         （四张数字卡 → 图表卡 → 表），流程条不在上面了 —— 而它本来就该在
         订单那一页：那是客户一天里真的在推动一张单的地方。 */
    const stagesOf = (ctx: BusinessContext) => {
      const strip = contentOf(ctx, "orders").find((n) => n.type === "WorkflowStrip");
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
      /* 🔴 「有一张表」换成「他的记录看得到」（2026-09-05）。
         原本这一条写死 RecordTable，而那等於写死「每一页都是一张表」——
         正是 2026-09-02 起在拆的那件事（看板 · 单据 · 行事历 · 左清单右详情）。
         工程跟任务从今天起**只有板**，理由是它们本来是同一批记录画两次。
         要守的那句话没有变：一个没填过问卷的人，打开每一页都要看得到东西。 */
      const SHOWS_RECORDS = new Set(["RecordTable", "TaskBoard", "DaySchedule"]);
      const shows = (nodes: { type: string; props: Record<string, unknown> }[]): boolean =>
        nodes.some(
          (n) =>
            SHOWS_RECORDS.has(n.type) ||
            /* 左清单右详情 · 单据：那张表装在 Columns 的插槽里。 */
            Object.values(n.props ?? {}).some(
              (v) => Array.isArray(v) && shows(v as { type: string; props: Record<string, unknown> }[]),
            ),
        );
      expect(shows(content), `${key} 上看不到他的任何一笔记录`).toBe(true);
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
    /*
      ⚠️ THE MIDDLE IS THE TEMPLATE'S OWN ORDER AGAIN, SINCE 2026-08-28.

      It was 图纸's between 08-27 and 08-28. That was harmless while every
      register carried the whole section list in some order, and it stopped
      being harmless the moment registers began DECLINING sections in order to
      copy their references: 图纸 now omits ten of them, so a page with no
      register named lost two thirds of itself. siteSkeleton falls to
      NEUTRAL_SKELETON now, which orders nothing.

      What this list is still for is the CONTENTS — the founder's own list of
      what a Malaysian SME page was missing: 「缺的是口碑、价目、覆盖范围、常见
      问题、营业时间、保证」. Every one of them is here.
    */
    expect(content.map((n) => n.type)).toEqual([
      // A website has a bar and a foot; a dashboard has neither, which is why
      // the page built out of dashboard blocks had neither either.
      "SiteBar",
      "SiteHero",
      /* 一句话占一屏, from lapa.ninja. Empty on most registers and rendering
         nothing, deliberately: a register that deletes a block is a register
         that could delete the owner's own prices. */
      "SiteStatement",
      "SiteFeatures",      // what we do
      "SiteGallery",       // 作品墙
      "SiteStory",         // the only section in the owner's own voice
      "SiteTeam",
      "InfoRows",          // 价目
      "SiteSteps",         // 接下来会怎样
      "SiteTestimonials",  // 口碑
      "SiteCreds",         // 别人给的证明
      "SiteBand",
      "SiteWoven",         // 保证
      "SiteCta",
      "InfoRows",          // 覆盖范围
      "FoldSection",       // 常见问题
      "MarkList",
      "EnquiryForm",
      "InfoRows",          // 营业时间
      "SiteFoot",
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

  /**
   * 🔴 那个 `else` 分支从来没有被比过。
   *
   * 上面那个正则只吃 `when '<slug>' then array[...]`，而 SQL 那一支的
   * 最后一行是 `else array[...]` —— 它服务**三个行业**（装修 · 服务 · 其他），
   * 其中装修是量出来最大的那一群。2026-09-09 实测：把 `else` 那一行改旧、
   * TypeScript 那一份留新，**这一整档照样三十条全过**。
   *
   * 一条只比一半的镜子，跟一条没有的镜子，在报告里长得一模一样。
   */
  function sqlFallback(): string[] {
    const m = /else\s+array\[([^\]]+)\]/.exec(sql);
    if (!m) throw new Error("SQL 那一支没有 else 那一行 —— 正则坏了还是函式换形状了");
    return m[1].split(",").map((v) => v.trim().replace(/'/g, ""));
  }

  it("extracts the else branch too, which three trades land on", () => {
    expect(sqlFallback().length).toBeGreaterThanOrEqual(4);
  });

  it("agrees with the SQL function the signup trigger actually uses", () => {
    const named = sqlMapping();
    for (const [slug, keys] of Object.entries(named)) {
      expect(PAGES_FOR_INDUSTRY[slug], `mapping for ${slug}`).toEqual(keys);
    }
    /* 名字不在 SQL 那份 case 里的，触发器给的是 else 那一份 —— 而
       TypeScript 这一边给的是它自己那一行。两个不一样，就是触发器开了
       一页而这个模组画不出来（或者反过来），而画面上是一张空的画布。 */
    for (const [slug, keys] of Object.entries(PAGES_FOR_INDUSTRY)) {
      if (named[slug]) continue;
      expect(keys, `${slug} 落在 SQL 的 else 那一份上`).toEqual(sqlFallback());
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

  it("分栏的壳，只有系统那一套说得上话", () => {
    /* 🔴 2026-09-04 换了问题，而不是把它删掉。
       本来问的是「每一套分栏的风格，它的排法有没有窄块可以塞进侧栏」——
       那时候一套风格就是一行排法。现在工作台只有一套样子
       （见 lib/portal/system-register.ts），排法不再跟风格绑在一起。

       还成立的那一半是这个：**`SPLIT_REGISTERS` 现在只对系统那一套有意义**。
       它写着别的风格的名字不会有任何后果，但那是一份读起来像还在生效的名单
       —— 而这个仓库栽在「活得比它描述的东西久的名单」上至少五次。 */
    const claimed = [...SPLIT_REGISTERS].filter((s) => s !== SYSTEM_REGISTER);
    expect(
      claimed,
      `SPLIT_REGISTERS 里的 ${claimed.join(" · ")} 已经不管工作台了 —— ` +
        `分栏的壳只有 SYSTEM_REGISTER 用得上，其余的名字要嘛拿掉、要嘛写下为什么留着。`,
    ).toEqual([]);

    /* 而如果哪天系统那一套真的搬上分栏的壳，开场那一块必须是窄的 ——
       不然侧栏那一栏是空的，而外壳会静静地退回成一般的侧栏。 */
    if (SPLIT_REGISTERS.has(SYSTEM_REGISTER)) {
      const NARROW_ROLES = new Set(["todo", "ranking", "share"]);
      const roles = SYSTEM_COMPOSITION.flatMap((e) => e.split("@")[0].split("|"));
      expect(roles.some((r) => NARROW_ROLES.has(r))).toBe(true);
    }
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import type { Data } from "@puckeditor/core";
import {
  ALWAYS_MODULES,
  DEFAULT_MODULES_FOR_INDUSTRY,
  recordsMoneyOut,
  MAX_MODULES,
  MODULE_BY_KEY,
  MODULE_CATALOG,
  MODULE_KEYS,
  catalogForPrompt,
  defaultModulesForIndustry,
  defaultRecommendations,
  normalizeModules,
} from "./module-catalog";
import { buildPageLayout } from "@/lib/templates/industry-template";
import { SHAPE_STATE } from "./shape-state";

const content = (data: Data) => (data as unknown as { content: unknown[] }).content;

describe("the catalogue itself", () => {
  it("has no duplicate keys", () => {
    expect(new Set(MODULE_KEYS).size).toBe(MODULE_KEYS.length);
  });

  it("gives every module a label, a blurb and a shape", () => {
    for (const m of MODULE_CATALOG) {
      expect(m.label.length, m.key).toBeGreaterThan(0);
      expect(m.blurb.length, m.key).toBeGreaterThan(10);
      expect(m.shape.length, m.key).toBeGreaterThan(0);
    }
  });

  /**
   * The one that matters most. A key the provisioning trigger can write but
   * nothing can build renders as a blank canvas for a paying customer -- the
   * single failure the whole templates module exists to prevent. Catching it
   * here rather than in production is the entire reason this file exists.
   */
  it("can build a real page for every key in the catalogue", () => {
    for (const key of MODULE_KEYS) {
      for (const lang of ["en", "zh"] as const) {
        const built = buildPageLayout(key, { lang }, "我的生意", "zh", [{ key }]);
        expect(
          content(built).length,
          `${key} built nothing in ${lang}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("builds pages that are not all the same generic table", () => {
    // Two different money modules must not produce identical layouts -- if they
    // do, `moduleCopy` is missing an arm and the shape is showing through.
    // Checked in BOTH languages: a copy table that gained an arm on one side
    // and not the other is exactly the drift the split into
    // module-copy.en.ts / module-copy.zh.ts makes possible.
    const built = (key: string, lang: "en" | "zh") =>
      JSON.stringify(buildPageLayout(key, { lang }, "x", "zh", [{ key }]));

    expect(built("reconciliation", "zh")).not.toEqual(built("commission", "zh"));
    expect(built("reconciliation", "zh")).toContain("对账");
    expect(built("commission", "zh")).toContain("佣金");

    expect(built("reconciliation", "en")).not.toEqual(built("commission", "en"));
    expect(built("reconciliation", "en")).toContain("reconciliation");
    expect(built("commission", "en")).toContain("Commission");
  });

  it("names the always-on modules and no others", () => {
    // 官网 joined them on 2026-08-22. It is free for the same reason the other
    // three are: a system with no page the business's own customers can see is
    // missing the half of the product the founder can actually demonstrate,
    // and it is not a choice the model should be spending a slot on.
    // The ORDER here is the catalogue's own, and it changed on 2026-08-30
    // when the catalogue was re-ordered to follow the owner's day (work,
    // then the money it produced, then the nouns it referenced). What this
    // test is about is WHICH four are free, not where they sit -- but it is
    // written strictly so that a change to either one has to be deliberate.
    expect(ALWAYS_MODULES).toEqual(["dashboard", "payments", "customers", "website"]);
  });

  it("puts both the free and the choosable modules in the prompt", () => {
    const prompt = catalogForPrompt();
    for (const key of MODULE_KEYS) expect(prompt, key).toContain(key);
    expect(prompt).toContain("ALREADY INCLUDED");
    expect(prompt).toContain("CHOOSE FROM");
  });
});

describe("normalizeModules", () => {
  it("always returns the modules every system gets, even from an empty answer", () => {
    const out = normalizeModules([]);
    expect(out.map((m) => m.key)).toEqual(["dashboard", "payments", "customers", "website"]);
  });

  it("drops keys that are not in the catalogue", () => {
    const out = normalizeModules([{ key: "crm", label: "CRM", why: "x" }]);
    expect(out.map((m) => m.key)).not.toContain("crm");
  });

  it("collapses duplicates", () => {
    const out = normalizeModules([
      { key: "reports", label: "报表", why: "a" },
      { key: "reports", label: "月报", why: "b" },
    ]);
    expect(out.filter((m) => m.key === "reports")).toHaveLength(1);
  });

  it("caps the set, because a system with eleven pages on day one gets closed", () => {
    const out = normalizeModules(MODULE_KEYS.map((key) => ({ key, label: "x", why: "y" })));
    expect(out.length).toBeLessThanOrEqual(MAX_MODULES);
  });

  it("keeps the business's own noun for an always-on module", () => {
    // The whole point: a SIM-card master dealer's `customers` page is 经销商.
    const out = normalizeModules([{ key: "customers", label: "经销商", why: "只跟经销商做" }]);
    expect(out.find((m) => m.key === "customers")?.label).toBe("经销商");
  });

  it("falls back to the catalogue label when the model gave none", () => {
    const out = normalizeModules([{ key: "ranking", label: "  ", why: "" }]);
    expect(out.find((m) => m.key === "ranking")?.label).toBe(MODULE_BY_KEY.ranking.label);
  });

  it("returns catalogue order regardless of the order the model listed them", () => {
    const out = normalizeModules([
      { key: "inventory", label: "库存", why: "a" },
      { key: "quotations", label: "报价", why: "b" },
    ]);
    const rank = out.map((m) => MODULE_KEYS.indexOf(m.key));
    expect(rank).toEqual([...rank].sort((x, y) => x - y));
  });

  it("survives the shapes a model actually gets wrong", () => {
    expect(() => normalizeModules(null)).not.toThrow();
    expect(() => normalizeModules("reports")).not.toThrow();
    expect(() => normalizeModules([null, 7, { nope: true }])).not.toThrow();
    expect(normalizeModules([null, 7]).length).toBe(ALWAYS_MODULES.length);
  });
});

describe("the default sets, which are the floor when nothing was analysed", () => {
  it("gives an unknown trade the general-purpose set", () => {
    expect(defaultModulesForIndustry("no-such-trade")).toEqual(defaultModulesForIndustry(null));
  });

  it("always includes the always-on three", () => {
    for (const slug of ["beauty", "retail", "wholesale", "renovation", null]) {
      const set = defaultModulesForIndustry(slug);
      for (const key of ALWAYS_MODULES) expect(set, `${slug}`).toContain(key);
    }
  });

  it("names every default module in the catalogue", () => {
    for (const slug of Object.keys({ beauty: 1, education: 1, fnb: 1, retail: 1, wholesale: 1, renovation: 1, services: 1, other: 1 })) {
      for (const key of defaultModulesForIndustry(slug)) {
        expect(MODULE_KEYS, `${slug} wants unknown module ${key}`).toContain(key);
      }
    }
  });

  it("gives no reason for a fallback recommendation, rather than inventing one", () => {
    for (const m of defaultRecommendations("renovation")) expect(m.why).toBe("");
  });

  /*
    A trade with no `pipeline` page cannot answer "who owes me money": the
    question is computed from pipeline rows minus what has been allocated
    against them, so with none, the answer is permanently empty and nothing
    on screen says why.

    `walk:tuition` found education in exactly that state on 2026-09-06 -- it
    could not open one fee bill -- so the rule below is a real hole turned
    into a guard, not a preference. A trade that genuinely does not bill goes
    on the list WITH ITS REASON; a trade that quietly loses its billing page
    goes red.
  */
  const BILLS_NOTHING: Record<string, string> = {
    beauty: "客人当场付 —— walk:salon 整条钱那一半走的是套票跟柜台收款，"
      + "而一页她从来不开的单，是一页她每天要滑过去的东西",
  };

  it("gives every trade that bills a page it can bill on", () => {
    for (const slug of Object.keys(DEFAULT_MODULES_FOR_INDUSTRY)) {
      const shapes = defaultModulesForIndustry(slug)
        .map((k) => MODULE_CATALOG.find((m) => m.key === k)?.shape);
      const canBill = shapes.includes("pipeline");
      if (BILLS_NOTHING[slug]) {
        expect(canBill, `${slug} 说它不开单，而它开局就有一页开得了`).toBe(false);
      } else {
        expect(
          canBill,
          `${slug} 开局没有一页开得了单 —— 「谁欠我钱」永远是空的。`
          + `真的不开单就写进 BILLS_NOTHING，连理由一起`,
        ).toBe(true);
      }
    }
  });

  /*
    🔴 **一笔开销都记不了的行业，两个东西永远是空的。**

    收款那一页的方向永远是「进来」（`recordsMoneyOut` 的档头写着为什么），
    所以一个开局没有帐本页（收款以外）的行业：

      🔴 「这个月赚多少」= 进来的 − 花出去的（`lib/portal/profit.ts`）。
         一笔开销都没有，那一格**永远不画** —— 而那是它自己的规矩，
         所以画面上连一句「为什么没有」都没有。

      🔴 **拍一张收据自动变一笔开销**（[任务 271](../../docs/founder-tasks.md)）
         那颗相机只画在 `spendsMoney` 的表单上 —— 到不了。

    2026-09-09 量的时候**八个行业八个都是这样**，跟 20260906740000 那次
    「教育开不了单」是同一个形状：一个不难答的问题，因为少一页而变成一个
    不可能答的问题。真的不花钱的行业写进 SPENDS_NOTHING，连理由一起。
  */
  const SPENDS_NOTHING: Record<string, string> = {};

  it("gives every trade a page it can record an expense on", () => {
    for (const slug of Object.keys(DEFAULT_MODULES_FOR_INDUSTRY)) {
      const canSpend = defaultModulesForIndustry(slug).some(recordsMoneyOut);
      if (SPENDS_NOTHING[slug]) {
        expect(canSpend, `${slug} 说它不花钱，而它开局就有一页记得了`).toBe(false);
      } else {
        expect(
          canSpend,
          `${slug} 开局记不了一笔花出去的钱 —— 「这个月赚多少」永远不画，`
          + `而拍收据那颗相机到不了。真的不花钱就写进 SPENDS_NOTHING，连理由一起`,
        ).toBe(true);
      }
    }
  });

  /*
    ⚠️ 而「开局有哪几页」是一个判断不是一条规则 —— 上面两条守的是
    「少了它，某一句话永远答不出来」，不是「这一页比较有用」。
    沙龙 2026-09-09 多的那两页（师傅 · 库存）就没有守卫：一间不卖东西、
    一个人做的沙龙，两页都是她要滑过去的。**不为一个偏好造一条会红的尺。**
  */
});

/**
 * The catalogue exists in two languages -- TypeScript here and SQL in the
 * migration the signup trigger runs -- and nothing forces them to agree. They
 * have to, because the trigger writes `page_key` values the check constraint
 * has to accept and this module has to be able to build.
 */
describe("the SQL mirror", () => {
  /*
    EACH OBJECT IS LOOKED UP IN THE NEWEST FILE THAT DEFINES *IT*.

    This used to find one file -- the newest defining `module_rank` -- and
    then look for the check constraint and `add_project_page` inside it too.
    That held only while all three were introduced together. On 2026-08-30
    `module_rank` was re-declared on its own to re-order the rail, and two
    tests failed reporting that the constraint "rejects dashboard", which is
    alarming and untrue: the constraint was untouched, in the file it has
    always lived in.

    A guard that fails for a reason it names wrongly costs more than one that
    does not fail, so it now asks the question per object.
  */
  const dir = join(process.cwd(), "supabase", "migrations");
  const newestDefining = (marker: string) => {
    const file = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .reverse()
      .find((f) => readFileSync(join(dir, f), "utf8").includes(marker));
    if (!file) throw new Error(`no migration defines ${marker}`);
    return readFileSync(join(dir, file), "utf8");
  };

  it("orders modules the same way in SQL as in TypeScript", () => {
    const sql = newestDefining("function public.module_rank");
    const arr = sql.slice(sql.indexOf("function public.module_rank"));
    const body = arr.slice(arr.indexOf("array["), arr.indexOf("]", arr.indexOf("array[")));
    const keys = [...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(keys).toEqual(MODULE_KEYS);
  });

  it("lets the check constraint accept every key the catalogue can produce", () => {
    const sql = newestDefining("project_pages_page_key_check");
    const check = sql.slice(sql.indexOf("project_pages_page_key_check"));
    for (const key of MODULE_KEYS) expect(check, `constraint rejects ${key}`).toContain(`'${key}'`);
  });

  it("lets a customer add every module type back after deleting it", () => {
    const sql = newestDefining("function public.add_project_page");
    const add = sql.slice(sql.indexOf("function public.add_project_page"));
    for (const key of MODULE_KEYS) expect(add, `cannot re-add ${key}`).toContain(`'${key}'`);
  });

  /*
    THE FOURTH COPY OF THE SAME LIST, found on 2026-09-02 while re-declaring
    the trigger for something else entirely.

    Task 85 said there were three (the check constraint, add_project_page,
    module_rank) and gave each its own migration. There were four. The signup
    trigger filters the model's recommendation through its own inline list, and
    `purchases` was never added to it -- so the analysis could return 進貨單,
    tell the owner their system would have it, and the trigger would drop it
    while provisioning. Nothing failed; the page was simply absent.

    That is why this is a derived guard and not a fourth hand-written list: the
    next key will be added to the catalogue and to three of the four places,
    and the only thing that will notice is something asking all four the same
    question.
  */
  it("provisions every module type the analysis is allowed to recommend", () => {
    const sql = newestDefining("function public.handle_new_account");
    const fn = sql.slice(sql.indexOf("function public.handle_new_account"));
    /* The filter, not the whole body: the body also names 'website' in the
       forced-page branch, which would mask a key missing from the list. */
    const list = fn.slice(fn.indexOf("where m.key in ("), fn.indexOf(");", fn.indexOf("where m.key in (")));
    for (const key of MODULE_KEYS) {
      expect(list, `signup silently drops ${key}`).toContain(`'${key}'`);
    }
  });

  /*
    THE GUARD THAT WAS ADVERTISED AND DID NOT EXIST.

    Both 20260830040000 and 20260831020000 carry a comment saying this file
    fails if their membership function drifts from MODULE_CATALOG. It did not:
    nothing here mentioned either function, and a shape could have been added
    in TypeScript with no table behind it -- which renders a page whose rows
    silently never become real, the exact defect these tables were built to
    end.

    A comment claiming a guard is worse than no comment, because it stops the
    next person looking.
  */
  /* ⚠️ DERIVED, NOT LISTED. The first version of this was a two-line literal
     -- ["pipeline", …], ["ledger", …] -- which is the same hand-written list
     the guard above it exists to catch, one level up. `directory` going live
     would have added a shape with a table and no check on it, silently, and
     this file would still have printed two passing rows.

     Every live shape has a membership function by definition (the test below
     is what makes that true), so the list is the live shapes. */
  const shapeFunctions = (Object.keys(SHAPE_STATE) as (keyof typeof SHAPE_STATE)[])
    .filter((shape) => SHAPE_STATE[shape] === "live")
    .map((shape) => [shape, `is_${shape}_module`] as const);

  it.each(shapeFunctions)("keeps SQL's idea of shape %s equal to the catalogue", (shape, fn) => {
    const sql = newestDefining(`function public.${fn}`);
    const body = sql.slice(sql.indexOf(`function public.${fn}`));
    const list = body.slice(body.indexOf("key in ("), body.indexOf(")", body.indexOf("key in (")));
    const inSql = [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    const inTs = MODULE_CATALOG.filter((m) => m.shape === shape).map((m) => m.key).sort();
    expect(inSql).toEqual(inTs);
  });

  /*
    A SHAPE CANNOT CLAIM TO BE RUNNING WITHOUT A TABLE.

    SHAPE_STATE is read by three things that all promise something to a
    customer: the projection decides whether to look for real rows, 加一单
    decides whether to open a form, and the console prints 「真的能跑」 on the
    founder's screen. Flipping a shape there without building its table would
    make all three lie at once, and the console's badge is the worst of them --
    it is the screen he uses to decide what to build NEXT.

    So the claim is checked against the database: a live shape must have a
    membership function, which is the thing every table's CHECK constraint and
    every RPC is written against.
  */
  it("has a table behind every shape marked live", () => {
    for (const [shape, state] of Object.entries(SHAPE_STATE)) {
      if (state !== "live") continue;
      const fn = `is_${shape}_module`;
      expect(
        () => newestDefining(`function public.${fn}`),
        `${shape} is marked live but no migration defines ${fn}()`,
      ).not.toThrow();
    }
  });

  /* And the reverse, which is the cheaper mistake to make: a table built and
     the flag never flipped means the projection never reads it, so a customer
     writes rows nobody ever sees. */
  it("marks live every shape that already has a table", () => {
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));
    const all = files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
    for (const shape of Object.keys(SHAPE_STATE) as (keyof typeof SHAPE_STATE)[]) {
      if (!all.includes(`function public.is_${shape}_module`)) continue;
      expect(SHAPE_STATE[shape], `is_${shape}_module() exists but the shape is still "drawn"`).toBe("live");
    }
  });

  /* A module that can be written but cannot be numbered would get 'DOC-' --
     or, since 20260831020000, an exception at the moment a customer presses
     the button. Either way the prefix belongs beside the shape. */
  it("gives every module that has a table its own document prefix", () => {
    const sql = newestDefining("function public.default_doc_prefix");
    const body = sql.slice(sql.indexOf("function public.default_doc_prefix"));
    /* WHICH SHAPES ARE NUMBERED IS READ, NOT LISTED.

       next_doc_no() branches on the membership functions, so its own body is
       the authority on which shapes get a number -- and `directory`
       deliberately is not one of them (a customer is a noun, not a document;
       see 20260831070000). Deriving it here means the two cannot disagree:
       adding a shape to next_doc_no without giving it a prefix fails, and so
       does giving a prefix to a shape nothing numbers. */
    const numbering = newestDefining("function public.next_doc_no");
    const numberedShapes = (Object.keys(SHAPE_STATE) as (keyof typeof SHAPE_STATE)[]).filter(
      (shape) => numbering.includes(`is_${shape}_module(in_module_key)`),
    );
    expect(numberedShapes.length, "no shape is numbered -- next_doc_no changed shape").toBeGreaterThan(0);
    for (const m of MODULE_CATALOG.filter((mod) => numberedShapes.includes(mod.shape))) {
      expect(body, `${m.key} would fall through to DOC-`).toContain(`when '${m.key}' then`);
    }
  });

  /* And the other way: a shape with no number must not be handed one. A
     directory row with QT-2026-0007 printed on it is a customer pretending to
     be a document, and the prefix would then be the only place in the product
     claiming that. */
  it("gives no document prefix to a shape nothing numbers", () => {
    const body = newestDefining("function public.default_doc_prefix");
    const numbering = newestDefining("function public.next_doc_no");
    const unnumbered = MODULE_CATALOG.filter(
      (m) => SHAPE_STATE[m.shape] === "live" && !numbering.includes(`is_${m.shape}_module(in_module_key)`),
    );
    for (const m of unnumbered) {
      expect(body, `${m.key} is a ${m.shape} -- nothing numbers it, so a prefix is a claim`).not.toContain(
        `when '${m.key}' then`,
      );
    }
  });
});

/**
 * The rename has to travel. The AI names a master dealer's counterparties
 * 经销商; the signup trigger stores that on the customers page. If it stops
 * there, the rail says 经销商 and the ranking table two pages over says 客户 --
 * which is what a real browser showed before `labelsFromPages` existed.
 */
describe("the business's own noun reaches every page", () => {
  const refs = [
    { key: "customers", title: "经销商" },
    { key: "ranking", title: null },
    { key: "staff", title: "师傅" },
  ];

  it("uses the renamed noun in a page that only refers to it", () => {
    const built = buildPageLayout("ranking", {}, "我的生意", "zh", refs);
    const json = JSON.stringify(built);
    expect(json).toContain("经销商");
    expect(json).not.toContain("客户 A");
  });

  it("does the same for the staff noun", () => {
    const built = buildPageLayout("tasks", {}, "我的生意", "zh", [...refs, { key: "tasks", title: null }]);
    expect(JSON.stringify(built)).toContain("师傅");
  });

  it("leaves the trade default alone when nothing was renamed", () => {
    const zh = buildPageLayout("ranking", { lang: "zh" }, "我的生意", "zh", [
      { key: "ranking" },
    ]);
    expect(JSON.stringify(zh)).toContain("客户");

    const en = buildPageLayout("ranking", {}, "My business", "zh", [
      { key: "ranking" },
    ]);
    expect(JSON.stringify(en)).toContain("Customer");
  });
});

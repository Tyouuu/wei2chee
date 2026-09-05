/**
 * 每一条页内锚点，都要在同一页找得到落点。
 *
 * ── 为什么（2026-09-05）──────────────────────────────────────────────────
 *
 * 客户唯一那个上线的官网上，**四条连结全部按不动** ——
 * 其中一条是右上角那颗 **「Ask price」，整页唯一的转换按钮**，
 * 而它指着一个**从来不存在**的 `#enquiry`。
 *
 * 🔴 而它不是四个 bug，是一个形状：**段会被拿掉，导航是另外产生的，
 * 两边没有对过。** 所以守卫也不能是一份名单（这个仓库栽在手写名单上
 * 至少八次），只能是那一句话本身：**指得到，或者不画。**
 *
 * ⚠️ 每一条都故意弄坏看过它红。
 */
import { describe, expect, it } from "vitest";
import { pruneDeadAnchors, pruneDeadAnchorsIn } from "./anchor-prune";
import { buildPageLayout, PAGES_FOR_INDUSTRY, type BusinessContext, type PageKey } from "@/lib/templates/industry-template";
import { forPublication } from "./publish-projection";
import { walkNodes, type PuckNode, type PuckLayout } from "./layout-ops";
import { SITE_PAGE_KEY } from "./system-register";

const node = (type: string, id: string, props: Record<string, unknown> = {}) =>
  ({ type, props: { id, ...props } }) as PuckNode;

describe("pruneDeadAnchors", () => {
  it("指不到的那一条整条拿掉，指得到的留着", () => {
    const out = pruneDeadAnchorsIn([
      node("SiteBar", "bar", {
        links: [
          { label: "在的", href: "#here" },
          { label: "不在的", href: "#gone" },
          { label: "外面", href: "https://example.com" },
        ],
      }),
      node("SiteFeatures", "here"),
    ]);
    const links = (out[0].props as { links: { href: string }[] }).links;
    expect(links.map((l) => l.href)).toEqual(["#here", "https://example.com"]);
  });

  it("🔴 那颗按钮指不到的时候，改成指询价那一块", () => {
    const out = pruneDeadAnchorsIn([
      node("SiteBar", "bar", { actionLabel: "Ask price", actionHref: "#enquiry" }),
      node("EnquiryForm", "website-form"),
    ]);
    expect((out[0].props as { actionHref?: string }).actionHref).toBe("#website-form");
    expect((out[0].props as { actionLabel?: string }).actionLabel).toBe("Ask price");
  });

  it("🔴 连询价都被拿掉了，那颗按钮整颗不画 —— 不是留一颗按不动的", () => {
    const out = pruneDeadAnchorsIn([
      node("SiteBar", "bar", { actionLabel: "Ask price", actionHref: "#enquiry" }),
      node("SiteFeatures", "here"),
    ]);
    expect((out[0].props as { actionHref?: string }).actionHref).toBeUndefined();
    expect((out[0].props as { actionLabel?: string }).actionLabel).toBeUndefined();
  });

  it("🔴 次要那几颗不回退到表单 —— 「看作品」导到询价表单是另一种说谎", () => {
    const out = pruneDeadAnchorsIn([
      node("SiteHero", "hero", {
        primaryLabel: "问价", primaryHref: "#",
        secondaryLabel: "看作品", secondaryHref: "#",
      }),
      node("EnquiryForm", "website-form"),
    ]);
    const p = out[0].props as Record<string, unknown>;
    /* 问价那一颗回退到表单 —— 那本来就是它要去的地方。 */
    expect(p.primaryHref).toBe("#website-form");
    expect(p.primaryLabel).toBe("问价");
    /* 看作品那一颗整颗拿掉。 */
    expect(p.secondaryHref).toBeUndefined();
    expect(p.secondaryLabel).toBeUndefined();
  });

  it("光秃秃的 `#` 也算按不动 —— site-hero 里十处 `|| \"#\"`", () => {
    const out = pruneDeadAnchorsIn([
      node("SiteBar", "bar", { actionLabel: "问价", actionHref: "#" }),
      node("EnquiryForm", "website-form"),
    ]);
    expect((out[0].props as { actionHref?: string }).actionHref).toBe("#website-form");
  });

  it("电话跟外部网址一个字都不动 —— 这里答不了它们通不通", () => {
    const out = pruneDeadAnchorsIn([
      node("SiteBar", "bar", { actionHref: "tel:0123456789" }),
    ]);
    expect((out[0].props as { actionHref?: string }).actionHref).toBe("tel:0123456789");
  });

  it("巢状插槽里的也算 —— 分栏里面那一块的落点数得到", () => {
    const out = pruneDeadAnchorsIn([
      node("SiteBar", "bar", { links: [{ label: "深的", href: "#deep" }] }),
      node("Columns", "cols", { a: [node("SiteFeatures", "deep")], b: [], c: [] }),
    ]);
    expect((out[0].props as { links: unknown[] }).links).toHaveLength(1);
  });
});

/** 那一页上真的存在的 id。 */
function idsOf(content: PuckNode[]): Set<string> {
  const out = new Set<string>();
  for (const n of walkNodes(content)) {
    const id = (n.props as { id?: unknown }).id;
    if (typeof id === "string" && id) out.add(id);
  }
  return out;
}

/** 每一条 `#...`。 */
function anchorsOf(content: PuckNode[]): string[] {
  const out: string[] = [];
  for (const n of walkNodes(content)) {
    for (const [k, v] of Object.entries(n.props ?? {})) {
      if (typeof v === "string" && v.startsWith("#") && v.length > 1 && /href$/i.test(k)) {
        out.push(v.slice(1));
      }
      if (Array.isArray(v)) {
        for (const item of v) {
          const href = (item as { href?: unknown })?.href;
          if (typeof href === "string" && href.startsWith("#") && href.length > 1) out.push(href.slice(1));
        }
      }
    }
  }
  return out;
}

describe("每一个行业的官网，产生出来跟发布出来都不准有死锚点", () => {
  const cases: { where: string; layout: PuckLayout }[] = [];
  for (const [slug, keys] of Object.entries(PAGES_FOR_INDUSTRY)) {
    if (!keys.includes(SITE_PAGE_KEY)) continue;
    const ctx: BusinessContext = {
      industry: {
        slug,
        name_zh: slug,
        labels: { customer: "客户", order: "单", staff: "师傅" },
        default_workflow: [],
        suggested_modules: [],
      },
    };
    cases.push({
      where: slug,
      layout: buildPageLayout(
        SITE_PAGE_KEY as PageKey,
        ctx,
        "兴发",
        "zh",
        keys.map((k) => ({ key: k })),
      ) as unknown as PuckLayout,
    });
  }

  it("这几页真的存在，不然下面每一条都是在量空气", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it("🔴 产生出来的那一版", () => {
    for (const c of cases) {
      const ids = idsOf(c.layout.content as PuckNode[]);
      const dead = anchorsOf(c.layout.content as PuckNode[]).filter((a) => !ids.has(a));
      expect([...new Set(dead)], `${c.where} 的官网上有指不到落点的锚点`).toEqual([]);
    }
  });

  it("🔴 发布出来的那一版 —— 发布还会再拿掉一次段", () => {
    for (const c of cases) {
      const published = forPublication(c.layout);
      const ids = idsOf(published.content as PuckNode[]);
      const dead = anchorsOf(published.content as PuckNode[]).filter((a) => !ids.has(a));
      expect([...new Set(dead)], `${c.where} 发布之后有指不到落点的锚点`).toEqual([]);
    }
  });

  it("而且不是把连结全部删光了才通过的", () => {
    const kept = cases.map((c) => anchorsOf(c.layout.content as PuckNode[]).length);
    expect(Math.max(...kept), "一条锚点都不剩，那不叫修好").toBeGreaterThan(0);
  });
});

describe("pruneDeadAnchors 作用在整个版面上", () => {
  it("同一件事，换一个入口", () => {
    const layout = {
      content: [
        node("SiteBar", "bar", { links: [{ label: "没了", href: "#gone" }] }),
      ],
    } as unknown as PuckLayout;
    const out = pruneDeadAnchors(layout);
    expect((out.content as PuckNode[])[0].props as { links: unknown[] }).toEqual(
      expect.objectContaining({ links: [] }),
    );
  });
});

/* 一页上的字，是**她**的字 —— 而且讲一笔的时候讲一笔。
 *
 * ── 眼睛先看到的（2026-09-09，三个行业各拍一次）─────────────────────────
 *
 * 一间沙龙、一家 medi spa、一间补习中心，各自把内建那几页改成自己的话
 * （`rename_project_page` —— 一个真的老板走的就是这条路）。拍出来：
 *
 *   侧栏       Appointments · Treatments · Class sessions
 *   大标题     **Bookings** · **Bookings** · **Bookings**
 *   按钮       **+ New appointments** · **+ New treatments** · **+ New class sessions**
 *   副标       **which stylists is taking them**
 *
 * 三件事，两个洞：
 *   ① 手写的那几支模版**收不到她改过的名字** —— `buildFromShape` 那一支
 *      本来就收 `self?.title`，只有 BUILDERS 那张表漏了一个参数。
 *      於是同一页在侧栏跟标题上有两个名字。
 *   ② 侧栏上那个字是**一张清单**的名字，而按钮开的是**一笔**、
 *      「哪个师傅接」问的是**一个人**。把清单的名字塞进那个位子，
 *      画出来就是 `New class sessions` 跟 `which stylists is`。
 *
 * ── 为什么写成守卫（[重点 24](../../docs/founder-points.md)）───────────────
 * 眼睛看到的错，如果没有变成一条会红的守卫，它会回来。这两条**故意弄坏看过它红**：
 *   ① 把 `title?.trim() ||` 拿掉 → 「大标题是她自己的字」当场红
 *   ② 把 `singularise(...)` 换回原来那一句 → 「一笔就讲一笔」当场红
 */
import { describe, expect, it } from "vitest";
import { buildPageLayout, type BusinessContext, type PageKey } from "./industry-template";
import { singularise, pluralise } from "./copy/chrome";
import { walkNodes, type PuckNode } from "@/lib/portal/layout-ops";

/** 一间怡保的沙龙，八页，而且**每一页都改成她自己的话** —— 这正是
 *  `rename_project_page` 走完之后资料库里的样子。 */
const SALON: BusinessContext = {
  lang: "en",
  industry: {
    slug: "beauty",
    name_zh: "美容",
    labels: { customer: "Customer", order: "Booking", staff: "Staff" },
    default_workflow: [],
    suggested_modules: [],
  },
};

const HER_PAGES = [
  { key: "dashboard" },
  { key: "customers", title: "Guests" },
  { key: "bookings", title: "Appointments" },
  { key: "payments" },
  { key: "expenses" },
  { key: "staff", title: "Stylists" },
  { key: "inventory", title: "Salon stock" },
  { key: "website" },
];

/** 没有改过名的同一间店 —— 内建那几页的 title 是 null
 *  （`built_in_pages_keep_no_title` 故意的）。 */
const STOCK_PAGES = HER_PAGES.map((p) => ({ key: p.key }));

const draw = (key: string, pages: { key: string; title?: string }[]): PuckNode[] =>
  (buildPageLayout(key as PageKey, SALON, "Wei Hair Studio", "en", pages) as unknown as {
    content: PuckNode[];
  }).content;

/** 那一页的大标题。**要走进去找** —— 外壳把每一页包了好几层，
 *  只看最外面那一层永远找不到它（这一条第一次跑就红在这里）。 */
const header = (nodes: PuckNode[]): PuckNode | undefined =>
  [...walkNodes(nodes)].find((n) => n.type === "PageHeader");

const words = (nodes: PuckNode[]): string[] => {
  const out: string[] = [];
  for (const n of walkNodes(nodes)) {
    for (const v of Object.values(n.props ?? {})) {
      if (typeof v === "string" && v.trim()) out.push(v);
    }
  }
  return out;
};

describe("一页上的字是她的字", () => {
  it("① 大标题跟侧栏讲同一个名字", () => {
    const head = header(draw("bookings", HER_PAGES));
    expect(
      head?.props?.title,
      "侧栏写着 Appointments 而这一页的大标题写着 Bookings —— 同一页两个名字。\n" +
        "→ BUILDERS 那张表要收 `self?.title`（buildFromShape 那一支本来就收）。",
    ).toBe("Appointments");
  });

  it("① 没有改过名的照旧用系统那一份 —— 一个像素都不变", () => {
    const head = header(draw("bookings", STOCK_PAGES));
    expect(head?.props?.title).toBe("Bookings");
  });

  it("② 那颗按钮开的是一笔，不是一批", () => {
    const bad = words(draw("dashboard", HER_PAGES)).filter((w) => /^New [a-z].*s$/.test(w));
    expect(
      bad,
      "总览上那颗按钮开的是**一张单**，而它印着一张清单的名字：\n" +
        `  ${bad.join(" · ")}\n` +
        "→ chrome.ts 的 primaryAction 要过一次 singularise()。",
    ).toEqual([]);
  });

  it("② 「哪个师傅接」问的是一个人", () => {
    const said = words(draw("bookings", HER_PAGES));
    expect(
      said.some((w) => w.includes("which stylist is taking")),
      `副标那一句读起来要通顺。现在是：\n  ${said.find((w) => w.includes("which")) ?? "（找不到那一句）"}`,
    ).toBe(true);
  });
});

describe("砍掉那个 s，只砍看得懂的", () => {
  it("我们自己词汇表上那几个", () => {
    const table: [string, string][] = [
      ["Appointments", "Appointment"],
      ["Class sessions", "Class session"],
      ["Treatments", "Treatment"],
      ["Stylists", "Stylist"],
      ["Guests", "Guest"],
      ["Fee bills", "Fee bill"],
      ["Expenses", "Expense"],
      ["Categories", "Category"],
      ["Boxes", "Box"],
    ];
    for (const [many, one] of table) expect(singularise(many, "en")).toBe(one);
  });

  it("🔴 这几个一个字都不准碰 —— 砍错一个字比留着一个复数难看得多", () => {
    for (const keep of ["Business", "Status", "Analysis", "Staff", "Crew", "Stock"]) {
      expect(singularise(keep, "en")).toBe(keep);
    }
  });

  it("中文不分单复数，两个方向都是原字", () => {
    expect(singularise("预约", "zh")).toBe("预约");
    expect(pluralise("预约", "zh")).toBe("预约");
  });
});

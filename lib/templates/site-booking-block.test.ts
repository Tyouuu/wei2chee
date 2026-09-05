/**
 * 客人自己订时段那一块，只出现在订得了的生意上。
 *
 * ── 为什么这一条要守（2026-09-05）──────────────────────────────────────
 *
 * `submit_site_booking` 对**没有一页在收预约**的生意回 `not_found` ——
 * 所以一个装修承包商的官网上画一颗「订这个时间」，就是一颗
 * **按下去一定失败的按钮**，而那是这个仓库禁的第一条
 * （任务 15 砍掉过一个搜不到东西的搜索框，任务 185 清掉一整行假筛选）。
 *
 * ⚠️ 而反过来那一半更容易漏：一间**真的有预约那一页**的沙龙，
 * 如果拿到的还是那张「留个电话跟想约的时间，我们确认了回你」的询价表，
 * 那就是[任务 96](../../docs/founder-tasks.md) 记的那件事没有做完 ——
 * 而两块并排更糟：同一个意思落进两个收件匣。
 */
import { describe, expect, it } from "vitest";
import {
  buildPageLayout,
  type BusinessContext,
  type PageKey,
} from "./industry-template";
import { walkNodes, type PuckNode } from "@/lib/portal/layout-ops";
import { SITE_PAGE_KEY } from "@/lib/portal/system-register";
import { forPublication } from "@/lib/portal/publish-projection";
/* 🔴 **一份名单，一个档案。** 手写第二份的时候 `style-order.test.ts`
   会红 —— 这个仓库栽在「第二份手写清单」上至少八次，而这一条守卫
   第一次跑就抓到我。 */
import { STYLE_ORDER } from "@/app/[locale]/style-picker/style-column";

const ctxFor = (slug: string, lang: "zh" | "en" = "zh") =>
  ({
    lang,
    industry: {
      slug,
      name_zh: slug,
      labels: { customer: "客户", order: "单", staff: "师傅" },
      default_workflow: ["Enquiry", "Quote", "Build"],
      suggested_modules: [],
    },
  }) as unknown as BusinessContext;

function siteOf(slug: string, keys: string[], lang: "zh" | "en" = "zh"): PuckNode[] {
  const layout = buildPageLayout(
    SITE_PAGE_KEY as PageKey,
    ctxFor(slug, lang),
    "兴发",
    lang,
    keys.map((k) => ({ key: k })),
  ) as { content: PuckNode[] };
  return [...walkNodes(layout.content)];
}

const types = (ns: PuckNode[]) => ns.map((n) => n.type);

/** 一间沙龙：有 bookings 那一页。 */
const SALON = ["dashboard", "customers", "bookings", "payments", "website"];
/** 一间装修公司：没有。 */
const RENO = ["dashboard", "customers", "quotations", "projects", "payments", "website"];


describe("有一页在收预约的生意", () => {
  it("🔴 官网上给的是真的挑时段，不是那张询价表", () => {
    const t = types(siteOf("beauty", SALON));
    expect(t, "沙龙的官网上没有挑时段那一块").toContain("SiteBooking");
    /* 两块并排 = 同一个意思落进两个收件匣。 */
    expect(t, "挑时段跟询价表两块都在").not.toContain("EnquiryForm");
  });

  it("那一块讲得出订完变成他系统里的哪一页", () => {
    const b = siteOf("beauty", SALON).find((n) => n.type === "SiteBooking")!;
    const p = b.props as { landsIn?: string; heading?: string };
    expect(p.landsIn, "那条箭头是这一块存在的理由").toBeTruthy();
    expect(p.heading).toBeTruthy();
  });

  it("🔴 说明写的是「自己挑一格」，不是「留个时间我们回你」", () => {
    for (const lang of ["zh", "en"] as const) {
      const p = siteOf("beauty", SALON, lang).find((n) => n.type === "SiteBooking")!
        .props as { blurb?: string; submitLabel?: string; note?: string };
      /* 那两句是**留言**那一块的，而这一块做的是**占一个钟头**。
         留着它，就是那一页在描述一个它已经不是的机制。 */
      for (const leave of ["Leave a number and a time", "留个电话跟想约的时间"]) {
        expect(p.blurb ?? "", `说明还是留言那一句：${p.blurb}`).not.toContain(leave);
      }
      /* 按钮上的字不给，让那一块用自己的（两种语言都在 SYSTEM_WORDS）。 */
      expect(p.submitLabel, "按钮拿的是询价那一颗的字").toBeUndefined();
      /* 「通常一天内回覆」在一颗「订这个时间」底下会让人分不清留住了没有。 */
      expect(p.note).toBeUndefined();
      expect(p.blurb, "说明整句不见了").toBeTruthy();
    }
  });

  it("⚠️ 营业时间是一个**预设**，而且四个都写在版面里 —— 他改得动", () => {
    const p = siteOf("beauty", SALON).find((n) => n.type === "SiteBooking")!.props as Record<string, unknown>;
    for (const k of ["openHour", "closeHour", "slotMinutes", "days"]) {
      expect(typeof p[k], `${k} 不在版面里，他就改不了`).toBe("number");
    }
    expect(p.openHour).toBeLessThan(p.closeHour as number);
  });

  it("发布出来的那一版也还在 —— 它不是编辑器里才画的东西", () => {
    const published = forPublication({
      content: siteOf("beauty", SALON).filter((n) => n.type),
    } as never) as { content: PuckNode[] };
    expect(types([...walkNodes(published.content)])).toContain("SiteBooking");
  });
});

describe("没有那一页的生意", () => {
  /* ⚠️ 这一条今天**是模版的形状在保证它**，不是 `booksIn`：装修落在
     「上门报价」那一套，而那一套从来不叫 `slots()`。故意把 `booksIn`
     弄成永远有值，它照样绿。留着是为了以后 —— 哪天有人把挑时段加进
     那一套模版，它会红。真正在守这件事的是底下那一条美容院的。 */
  it("🔴 官网上一块都不画 —— 一颗按下去一定失败的按钮", () => {
    const t = types(siteOf("renovation", RENO));
    expect(t, "装修承包商的官网上画了订时段").not.toContain("SiteBooking");
  });

  it("而它退回那张询价表，不是留一个洞", () => {
    expect(types(siteOf("renovation", RENO))).toContain("EnquiryForm");
  });

  it("🔴 一间美容院，AI 没有给它预约那一页 —— 照样不画", () => {
    /* 读的是**他手上这几页**，不是那张行业预设表。 */
    const t = types(siteOf("beauty", ["dashboard", "customers", "payments", "website"]));
    expect(t).not.toContain("SiteBooking");
    expect(t).toContain("EnquiryForm");
  });
});

describe("每一套风格都留得住它", () => {
  /* 🔴 有几套风格的官网**故意没有询价表**（`site-composition` 的
     `dropBlocks`）—— 満図 就是其中一套，而満図 正好是**美容那一行**
     拿到的那一套。所以如果挑时段那一块也被丢掉，一间沙龙的官网上
     就一个入口都没有了。
     **一个订位页没有订的地方，不是一个设计选择，是一张坏掉的页。** */
  it("🔴 连那几套「不放询价表」的风格也留得住挑时段", () => {
    const dropped: string[] = [];
    for (const style of STYLE_ORDER) {
      const layout = buildPageLayout(
        SITE_PAGE_KEY as PageKey,
        ctxFor("beauty"),
        "兴发",
        "zh",
        SALON.map((k) => ({ key: k })),
        style,
      ) as { content: PuckNode[] };
      const t = types([...walkNodes(layout.content)]);
      if (!t.includes("SiteBooking")) dropped.push(style);
    }
    expect(dropped, `这几套风格把挑时段丢掉了：${dropped.join(" · ")}`).toEqual([]);
  });
});

describe("那几颗「问价」的按钮照旧有落点", () => {
  const hrefs = (ns: PuckNode[]) => {
    const out: string[] = [];
    for (const n of ns) {
      for (const [k, v] of Object.entries(n.props ?? {})) {
        if (/href$/i.test(k) && typeof v === "string" && v.startsWith("#")) out.push(v);
        if (Array.isArray(v)) {
          for (const item of v) {
            const h = (item as { href?: unknown })?.href;
            if (typeof h === "string" && h.startsWith("#")) out.push(h);
          }
        }
      }
    }
    return out;
  };

  it("🔴 挑时段那一块也是一个落点 —— 不然那三颗会整颗被拿掉", () => {
    const ns = siteOf("beauty", SALON);
    const ids = new Set(
      ns.map((n) => (n.props as { id?: unknown }).id).filter((i): i is string => typeof i === "string"),
    );
    const dead = hrefs(ns).map((h) => h.slice(1)).filter((a) => !ids.has(a));
    expect([...new Set(dead)], "沙龙官网上有指不到落点的锚点").toEqual([]);
    /* 而且真的有人指过去了 —— 一条把按钮全删光的修法，读数上跟修好一样。 */
    expect(hrefs(ns).some((h) => h === "#website-booking")).toBe(true);
  });

  it("英文那一版也一样 —— 少一种语言等於半个做完", () => {
    const ns = siteOf("beauty", SALON, "en");
    expect(types(ns)).toContain("SiteBooking");
    const ids = new Set(
      ns.map((n) => (n.props as { id?: unknown }).id).filter((i): i is string => typeof i === "string"),
    );
    expect(hrefs(ns).map((h) => h.slice(1)).filter((a) => !ids.has(a))).toEqual([]);
  });
});

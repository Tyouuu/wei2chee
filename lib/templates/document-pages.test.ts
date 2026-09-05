/**
 * 两张单据不是同一张纸。
 *
 * 报价单是**寄出去给客人签**的；进货单是**我们叫货**的 ——
 * 而在 2026-09-05 之前两页印的是同一段：
 * **一张水泥订单底下画着一条永远不会有人签的签名线。**
 *
 * 🔴 而顺着它翻出第二件：`BUYING_STAGES`（开了单 → 到货了 → 付清了）
 * 写好之后**一次都没有到过画面** —— 它唯一的呼叫端在 pipeline 那一支，
 * 而进货单早就换成了单据那一支。这个仓库第 22 次「能力有、线没接」。
 *
 * ⚠️ 底下三条守的是**故意不改**的那两对。为了不一样而不一样，
 * 正是重点 7c 在挡的那件事 —— 一条会因为「两页长得一样」就变红的守卫，
 * 会逼下一个人去把一个对的答案拆掉。
 */
import { describe, expect, it } from "vitest";
import {
  buildPageLayout,
  type BusinessContext,
  type PageKey,
} from "./industry-template";
import { MODULE_KEYS } from "@/lib/portal/module-catalog";
import { walkNodes, type PuckNode } from "@/lib/portal/layout-ops";

/* ⚠️ `lang` 是**系统语言**（客户的系统讲什么话），
   而 buildPageLayout 那个参数是**介面语言**（网址上的 /zh/ 或 /en/）。
   两个不一样，而这几个字跟的是前者 —— 我第一版拿后者当尺，
   红的是我的道具不是产品（这个仓库第十三次）。 */
const base = {
  industry: {
    slug: "renovation",
    name_zh: "装修",
    labels: { customer: "客户", order: "单", staff: "师傅" },
    default_workflow: ["Enquiry", "Quote", "Approved", "Deposit", "Build"],
    suggested_modules: [],
  },
};
const ctx = { ...base, lang: "zh" } as unknown as BusinessContext;
const ctxEn = { ...base, lang: "en" } as unknown as BusinessContext;
const refs = MODULE_KEYS.map((k) => ({ key: k }));

function nodesOf(key: string, lang: "zh" | "en" = "zh"): PuckNode[] {
  const l = buildPageLayout(key as PageKey, lang === "en" ? ctxEn : ctx, "兴发", lang, refs) as {
    content: PuckNode[];
  };
  return [...walkNodes(l.content)];
}

/** 这一页画了哪些块，照顺序。 */
const shapeOf = (key: string) => nodesOf(key).map((n) => n.type);

describe("报价单跟进货单不是同一张纸", () => {
  const termsOf = (key: string, lang: "zh" | "en" = "zh") => {
    const t = nodesOf(key, lang).find((n) => n.type === "TermsBlock");
    expect(t, `${key} 底下没有那一段`).toBeTruthy();
    return t!.props as { body: string; signLabel: string };
  };

  it("🔴 进货单上不准印我们卖东西的条款 —— 那是讲给供应商听的一句假话", () => {
    const body = termsOf("purchases").body;
    /* 修之前它印的是报价单那一段，一字不差。 */
    expect(body).not.toBe(termsOf("quotations").body);
    for (const sold of ["报价", "订金", "开工"]) {
      expect(body, `进货单上印着「${sold}」—— 那是我们卖东西的话`).not.toContain(sold);
    }
  });

  it("🔴 签的是收货的人，不是客人", () => {
    expect(termsOf("purchases").signLabel).toBe("收货签名");
    expect(termsOf("quotations").signLabel).toBe("签名");
  });

  it("英文系统也是两段 —— 少一种语言等於半个修好", () => {
    const buy = termsOf("purchases", "en");
    expect(buy.body).not.toBe(termsOf("quotations", "en").body);
    expect(buy.signLabel).toBe("Received by");
    for (const sold of ["Quoted prices", "deposit"]) {
      expect(buy.body).not.toContain(sold);
    }
  });

  it("⚠️ 而那一段一个事实都不准发明 —— 送到哪里 · 几时要 · 付款条件都不知道", () => {
    for (const lang of ["zh", "en"] as const) {
      const body = termsOf("purchases", lang).body;
      /* 一段编出来的送货地址或付款期，跟一个假电话号码是同一类东西。 */
      expect(body).not.toMatch(/\d{1,3}\s*(天|days)/);
      expect(body).not.toMatch(/(地址|Address|Jalan|Taman)/);
    }
  });

  it("⚠️ 两张纸照旧是同一种块 —— 换的是字，不是骨架", () => {
    /* 我第一版换成一条三格的流程，被 module-copy 里一段已经写过的判断
       挡回来了（「状态是两件事的组合，不是一条直线」）。写下来，
       因为一条「两页不准长得一样」的守卫，会逼下一个人再拆一次。 */
    expect(shapeOf("purchases")).toContain("TermsBlock");
    expect(shapeOf("purchases")).not.toContain("WorkflowStrip");
  });
});

describe("而这两对故意一样 —— 它们在问同一句话", () => {
  it("工程跟任务都是板：「这一件走到哪」", () => {
    for (const k of ["projects", "tasks"]) {
      expect(shapeOf(k), `${k} 不是板`).toContain("TaskBoard");
      /* 板就是那一页 —— 底下不准再画一张一模一样的表。 */
      expect(shapeOf(k), `${k} 把同一批记录画了两次`).not.toContain("RecordTable");
    }
  });

  it("供应商跟师傅都是「左清单右详情」：「他们是谁，打开一个看」", () => {
    for (const k of ["suppliers", "staff"]) {
      const types = shapeOf(k);
      expect(types, `${k} 不是左清单右详情`).toContain("Columns");
      expect(types).toContain("RecordTable");
      expect(types).toContain("InfoRows");
    }
  });

  it("⚠️ 而它们不准悄悄变成单据 —— 一个人不是一张纸", () => {
    for (const k of ["suppliers", "staff"]) {
      expect(shapeOf(k), `${k} 上出现了签名线`).not.toContain("TermsBlock");
    }
  });
});

/**
 * 一页只准有一颗主要动作。
 *
 * 🔴 实拍：站在**进货单**那一页，侧栏顶上一颗黑的写着「＋ New quotations」，
 * 而同一屏右上角另一颗黑的写着「New purchase orders」——
 * **两颗一样重的按钮，去两个不同的地方，而其中一颗讲的是别的页。**
 * 读数当时全绿，是看图看到的。
 */
describe("一页只准有一颗主要动作", () => {
  const actionsOn = (key: string) => {
    const ns = nodesOf(key);
    const of = (t: string) =>
      ns
        .filter((n) => n.type === t)
        .map((n) => (n.props as { actionLabel?: string; actionHref?: string }))
        .filter((p) => p.actionLabel);
    return { rail: of("RailNav"), header: of("PageHeader") };
  };

  for (const key of MODULE_KEYS) {
    it(`${key}`, () => {
      const { rail, header } = actionsOn(key);
      expect(
        rail.length + header.length,
        "同一屏上两颗一样重的按钮，他要先决定按哪一颗",
      ).toBeLessThanOrEqual(1);
    });
  }

  it("🔴 而不是把两颗都拿掉了 —— 那一颗是这一页存在的理由", () => {
    /* 会写东西的那几页，那颗按钮一定在页面自己身上。 */
    for (const key of ["quotations", "purchases", "customers", "payments"]) {
      const { header } = actionsOn(key);
      expect(header.length, `${key} 上没有「加一单」`).toBe(1);
    }
  });

  it("没有自己那颗的页面，侧栏那一颗照旧在 —— 它是常驻的那个提议", () => {
    /* 总览没有页面标题（照参考那一页拿掉的），所以它的提议住在侧栏。 */
    const { rail, header } = actionsOn("dashboard");
    expect(header.length).toBe(0);
    expect(rail.length, "总览上一颗提议都没有").toBe(1);
  });

  it("⚠️ 侧栏那一颗永远指得到一页真的会写的 —— 不是一个死连结", () => {
    const { rail } = actionsOn("dashboard");
    expect(rail[0].actionHref).toMatch(/^\/[a-z]{2}\/portal\/[a-z-]+$/);
    expect(rail[0].actionHref).not.toContain("#");
  });
});

/**
 * 侧栏上不准有两行一样的字。
 *
 * 🔴 实拍：同一条侧栏上「Orders」出现两次，两个指到两页不同的东西。
 * 只在他自己加了第二页的时候现形 —— 八个行业的开局都没有同时给两页。
 */
describe("侧栏上不准有两行一样的字", () => {
  const railOf = (key: string, lang: "zh" | "en" = "zh") => {
    const rail = nodesOf(key, lang).find((n) => n.type === "RailNav")!;
    return (rail.props as { items: { label: string; href: string }[] }).items;
  };

  it("🔴 十八页全开的时候也不准撞 —— 这就是那张实拍", () => {
    for (const lang of ["zh", "en"] as const) {
      const items = railOf("dashboard", lang);
      const labels = items.map((i) => i.label);
      expect(new Set(labels).size, `撞的是：${labels.join(" · ")}`).toBe(labels.length);
    }
  });

  it("而它不是把名字换掉了 —— 只开一页的生意照旧拿他自己的词", () => {
    /* 八个行业的开局都只给其中一页，那时候没有人跟他抢。 */
    const one = [{ key: "projects" }, { key: "customers" }, { key: "dashboard" }];
    const rail = (
      buildPageLayout("dashboard" as PageKey, ctx, "兴发", "zh", one) as {
        content: PuckNode[];
      }
    ).content;
    const items = (
      [...walkNodes(rail)].find((n) => n.type === "RailNav")!.props as {
        items: { label: string; href: string }[];
      }
    ).items;
    expect(items.find((i) => i.href.endsWith("/projects"))!.label).toBe("单");
  });

  it("两页都开的时候，退的那一个退回目录自己的词 —— 不准退到别人身上", () => {
    const items = railOf("dashboard");
    const projects = items.find((i) => i.href.endsWith("/projects"))!.label;
    const orders = items.find((i) => i.href.endsWith("/orders"))!.label;
    expect(projects).not.toBe(orders);
    /* 两个都要是真的字，不是编号或者空白。 */
    for (const l of [projects, orders]) expect(l.trim().length).toBeGreaterThan(0);
  });

  it("同一份页面清单跑两次，字一模一样 —— 不准看谁先问", () => {
    expect(railOf("dashboard").map((i) => i.label)).toEqual(
      railOf("customers").map((i) => i.label),
    );
  });

  it("每一行还是指得到自己那一页 —— 换字不准换门牌", () => {
    const items = railOf("dashboard");
    expect(new Set(items.map((i) => i.href)).size).toBe(items.length);
  });
});

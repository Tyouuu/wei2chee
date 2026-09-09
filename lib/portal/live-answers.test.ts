import { describe, it, expect } from "vitest";
import {
  BUSINESS_FACT_ALWAYS_GAPS,
  renderBusinessFacts,
  BUSINESS_FACT_GAPS,
  type BusinessFacts,
} from "./live-answers";

/**
 * The assistant is about to start quoting his money. These are the ways that
 * goes wrong, each written as the sentence an owner would have read.
 */

const withFigures = (over: Partial<BusinessFacts> = {}): BusinessFacts => ({
  asOf: "2026-09-03",
  lang: "zh",
  unread: false,
  /* 预设是「问了，没有人欠」—— 不是 null。null 是「没有问」，
     而一个预设成「没有问」的夹具会让下面每一条 owing 的断言量到空气。 */
  owing: [],
  /* 预设是「有两件要跟」—— 不是空的。空的夹具会让下面那几条断言
     量到「一件都没有」那一句，而不是量到它们真正在守的那一段。 */
  nudges: [
    { kind: "quote_expiring", line: "QT-2026-0012 李太太 的报价三天后到期 · 09-02 跟过了" },
    { kind: "payment_overdue", line: "陈先生 欠 RM 3,000 · 迟了 12 天" },
  ],
  /* 他自己打过的价钱。预设有两件，不是空的 —— 一个空的夹具会让
     下面那几条断言量到空气。 */
  prices: [
    { line: "水泥 50kg · 包 · RM 18.50" },
    { line: "换灯 · 盏 · RM 380.00" },
  ],
  pricesCut: false,
  figures: [
    { label: "本月收到", value: "RM 12,340", previous: "RM 9,800" },
    { label: "还没用完的订金", value: "RM 3,000" },
    { label: "经销商", value: "12 个" },
  ],
  rows: [
    { doc: "RC-2026-0007", party: "陈先生", amount: "RM 3,000", on: "2026-09-02" },
    { doc: "QT-2026-0012", party: "李太太", amount: "RM 22,800", on: "2026-08-30", stage: "Awaiting reply" },
  ],
  trend: [
    { label: "4月", value: 1 }, { label: "5月", value: 2 },
    { label: "6月", value: 3 }, { label: "7月", value: 4 },
    { label: "8月", value: 5 }, { label: "9月", value: 6 },
  ],
  ...over,
});

describe("什么会到模型面前", () => {
  it("有数字的时候，每一格的标签跟值都在", () => {
    const out = renderBusinessFacts(withFigures());
    expect(out).toContain("本月收到");
    expect(out).toContain("RM 12,340");
    expect(out).toContain("还没用完的订金");
    expect(out).toContain("RM 3,000");
  });

  it("上个月那个数字也给，因为「比上个月多」是他真的会问的", () => {
    expect(renderBusinessFacts(withFigures())).toContain("RM 9,800");
  });

  /* 他的词，不是我们的词。一个 SIM 经销商的名册叫「经销商」，而助手回
     「你有 12 个客户」就是把他的生意讲成别人的。 */
  it("用他自己的名词", () => {
    const out = renderBusinessFacts(withFigures());
    expect(out).toContain("经销商");
    /* ⚠️ 只看数字那几行。第一版整段检查，而「客户」本来就该出现在
       「某一个客户欠多少 —— 还没做」那一行 —— 那是我把自己的期望写成了
       正确答案，尺子就开始量作者不量产品。这个仓库栽过至少两次。 */
    const figureLines = out
      .split("\n")
      .filter((l) => l.startsWith("- ") && l.includes(":"));
    expect(figureLines.length).toBeGreaterThan(0);
    expect(figureLines.some((l) => l.includes("客户"))).toBe(false);
  });

  it("日期跟着他的月份走，印在开头", () => {
    expect(renderBusinessFacts(withFigures())).toContain("2026-09-03");
  });
});

describe("答不了的那几行", () => {
  /* 这一条守的是这个档案存在的理由：一个只被告知自己知道什么的模型，
     会在中间那片空白上自己编。洞要念出来。 */
  it("有数字的时候一定跟着出现", () => {
    const out = renderBusinessFacts(withFigures());
    expect(out).toContain("答不了的");
    for (const key of BUSINESS_FACT_ALWAYS_GAPS) {
      expect(out).toContain(BUSINESS_FACT_GAPS.zh[key]);
    }
  });

  it("利润那一格要点名，因为那是他最会问的一题", () => {
    expect(renderBusinessFacts(withFigures())).toMatch(/利润|赚多少/);
  });

  /* ⚠️ 每一行都要带原因。「还没做」三个字教会模型讲「我不知道」，
     而那正是让老板不再问的那一句。 */
  it("每一行都带原因，不是光讲还没做", () => {
    for (const lang of ["zh", "en"] as const) {
      for (const gap of Object.values(BUSINESS_FACT_GAPS[lang])) {
        expect(gap, `「${gap}」没有讲为什么`).toMatch(/——|—/);
      }
    }
  });

  it("两种语言的条数一样，不然英文的老板少听到一个洞", () => {
    expect(Object.keys(BUSINESS_FACT_GAPS.en).sort()).toEqual(
      Object.keys(BUSINESS_FACT_GAPS.zh).sort(),
    );
  });
});

describe("读不到，跟没有记录，是两件事", () => {
  /* 这两件事合成一件，就是一个客户因为查询逾时而被告知他这个月是空的。 */
  it("读不到 → 讲读不到，而且一个 0 都不准出现", () => {
    const out = renderBusinessFacts(withFigures({ unread: true, figures: [], trend: [] }));
    expect(out).toContain("读不到");
    expect(out).not.toMatch(/RM\s*0\b/);
  });

  it("没有记录 → 讲还没有记录，不是回一片空白", () => {
    const out = renderBusinessFacts(withFigures({ figures: [], trend: [] }));
    expect(out.trim()).not.toBe("");
    expect(out).toContain("还没有任何记录");
  });

  /* 完全没有生意资料的专案（刚注册、还没走完问卷）才是 null。
     那时候整段不出现，而不是出现一段空的标题。 */
  it("没有资料可讲的时候，整段不出现", () => {
    expect(renderBusinessFacts(null)).toBe("");
  });
});

describe("走势有上限", () => {
  it("最多六点，跟他画面上那张图一样远", () => {
    const many = Array.from({ length: 24 }, (_, i) => ({ label: `${i}月`, value: i }));
    const out = renderBusinessFacts(withFigures({ trend: many.slice(-6) }));
    /* ⚠️ 只数走势那一行。第一版数的是整段里有几个「·」，而那一天整段只有
       走势在用它 —— 加了「最近这几笔」之后它就开始量别人的东西，当场变红。
       一把「刚好只有一个东西符合」的尺，看起来跟一把量对了的尺一模一样。 */
    const line = out.split("\n").find((l) => l.includes("近六个月")) ?? "";
    expect(line).not.toBe("");
    expect(line.split("·").length - 1).toBeLessThanOrEqual(6);
  });
});

describe("英文的系统拿到英文", () => {
  it("标题跟洞都跟着系统语言走", () => {
    const out = renderBusinessFacts(
      withFigures({ lang: "en", figures: [{ label: "Received this month", value: "RM 12,340" }] }),
    );
    expect(out).toContain("counted from their own books");
    expect(out).toContain("Cannot be answered");
    expect(out).not.toContain("答不了的");
  });
});

describe("总额底下的那几笔", () => {
  /* 一个他打不开的总数，是一个他只能相信的总数。数字是答案，那几笔是收据。 */
  it("单号 · 对方 · 金额 · 日期都给出去", () => {
    const out = renderBusinessFacts(withFigures());
    expect(out).toContain("RC-2026-0007");
    expect(out).toContain("陈先生");
    expect(out).toContain("RM 3,000");
    expect(out).toContain("2026-09-02");
  });

  it("走单那几笔连它走到哪一格一起给", () => {
    expect(renderBusinessFacts(withFigures())).toContain("Awaiting reply");
  });

  it("没有记录的时候不出现「最近这几笔」这个空标题", () => {
    const out = renderBusinessFacts(withFigures({ rows: [] }));
    expect(out).not.toContain("最近这几笔");
  });

  /* WrenAI 的 row limit，而理由是他的不是我们的：
     「列出全部客户」不可以在一个聊天面板里回三千行。 */
  it("再多也不会全部倒进去", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      doc: `RC-${i}`, party: `客${i}`, amount: "RM 1", on: "2026-09-01",
    }));
    const out = renderBusinessFacts(withFigures({ rows: many }));
    const listed = out.split("\n").filter((l) => l.startsWith("- RC-")).length;
    expect(listed).toBeLessThanOrEqual(10);
  });
});

describe("谁欠他钱", () => {
  it("欠款清单进得了提示词，带名字、金额、欠几天", () => {
    const out = renderBusinessFacts(
      withFigures({
        owing: [
          {
            partyId: "a",
            name: "陈先生",
            owedCents: 3_000_00,
            oldestDays: 62,
            limitCents: null,
          },
        ],
      }),
    );
    expect(out).toContain("陈先生");
    expect(out).toContain("RM 3,000");
    expect(out).toContain("62 天");
  });

  /* 🔴 这一条守的是这一整件事：`party_debts` 对一个师傅回零行，
     跟「每一张单都收齐了」长得一模一样。混掉了，助手就会对着一个师傅
     讲「没有人欠你钱」，而他老板的帐上挂着三万。 */
  it("没有问（null）的时候，一个字都不讲，而且明写不准说没有人欠", () => {
    const out = renderBusinessFacts(withFigures({ owing: null }));
    expect(out).not.toContain("没有人欠他钱");
    expect(out).toContain(BUSINESS_FACT_GAPS.zh.owingUnread);
  });

  it("问了而没有人欠，讲得出「都收齐了」", () => {
    const out = renderBusinessFacts(withFigures({ owing: [] }));
    expect(out).toContain("没有人欠他钱");
  });

  /* ⚠️ 一条过期的「答不了」，是助手拒绝回答一件它手上已经有答案的事 ——
     跟宣称做了却没做，是同一个缺陷的两张脸。 */
  it("读到了之后，那一行「答不了」要退休", () => {
    const out = renderBusinessFacts(
      withFigures({
        owing: [
          { partyId: "a", name: "陈先生", owedCents: 100, oldestDays: 1, limitCents: null },
        ],
      }),
    );
    expect(out).not.toContain(BUSINESS_FACT_GAPS.zh.owingUnread);
  });

  it("「某一个客户欠多少」已经不在答不了的名单里了", () => {
    const all = Object.values(BUSINESS_FACT_GAPS.zh).join("\n");
    expect(all).not.toContain("按客户查那一支还没做");
  });
});


/**
 * 🔴 系统自己看出来的那几件，要真的到得了模型眼前。
 *
 * 2026-09-09 补的第十七条「能力有、线没接」：十二种信号 9-06 就算得出来、
 * 「今天要跟的」那一页在读它们，而这个档案里一个字都没提过 —— 所以他问
 * 「今天有什么要跟」，助手答「我看不到」，而画面上就写着。
 */
describe("系统自己看出来的那几件", () => {
  it("印进去了，一条不漏", () => {
    const out = renderBusinessFacts(withFigures());
    expect(out).toContain("李太太 的报价三天后到期");
    expect(out).toContain("陈先生 欠 RM 3,000");
  });

  it("🔴 一件都没有的时候也讲一句，不留白", () => {
    /* 留白的时候模型会拿上面那些数字凑一个「你大概要跟这几个」出来。 */
    const out = renderBusinessFacts(withFigures({ nudges: [] }));
    expect(out).toContain("一件都没有要跟的");
  });

  it("英文那一份也有它自己的两句", () => {
    const on = renderBusinessFacts(withFigures({ lang: "en" }));
    expect(on).toContain("has spotted");
    const off = renderBusinessFacts(withFigures({ lang: "en", nudges: [] }));
    expect(off).toContain("Nothing the system has spotted");
    /* 🔴 不准跨语言凑合（[重点 13]）—— 而要量的是**我们的字**，
       不是他生意自己的字：夹具里的「本月收到」「经销商」是他自己的词，
       在英文那一份里出现是对的。第一版把整段拿去比中文，红的是一条
       假的（[重点 31]：红的时候先问是不是我量错了）。 */
    expect(off).not.toContain("一件都没有要跟的");
    expect(on).not.toContain("系统自己看出来");
  });

  it("🔴 它排在「答不了的」上面 —— 一件他要做的事，不该印在一串做不到后面", () => {
    const out = renderBusinessFacts(withFigures());
    expect(out.indexOf("李太太 的报价三天后到期")).toBeLessThan(
      out.indexOf("答不了的"),
    );
  });
});


/**
 * 🔴 他自己打过的价钱，要到得了模型眼前。
 *
 * [重点 29] 那张表：① 算出来 ② **从他自己以前的东西挑**
 * ③ 从别的地方搬 ④ 才轮到他打字。`catalog_items.price_cents`
 * 从 20260901070000 就在，而助手看不到它 —— 他开报价单那一页的时候，
 * 货品在另一页。
 */
describe("他自己的价目", () => {
  it("印进去了", () => {
    const out = renderBusinessFacts(withFigures());
    expect(out).toContain("水泥 50kg · 包 · RM 18.50");
    expect(out).toContain("换灯");
  });

  it("🔴 一件都没有的时候，不出一个空标题", () => {
    const out = renderBusinessFacts(withFigures({ prices: [] }));
    expect(out).not.toContain("他自己的价目");
  });

  it("🔴 没截的时候，不讲「我看不全」", () => {
    /* 一条过期的「答不了」，跟宣称做了却没做是同一个缺陷的另一张脸。 */
    const out = renderBusinessFacts(withFigures());
    expect(out).not.toContain("40 件");
  });

  it("真的截了就要讲出来", () => {
    const out = renderBusinessFacts(withFigures({ pricesCut: true }));
    expect(out).toContain("40 件");
  });

  it("英文那一份也有它自己的两句", () => {
    const on = renderBusinessFacts(withFigures({ lang: "en" }));
    expect(on).toContain("His own price list");
    const cut = renderBusinessFacts(withFigures({ lang: "en", pricesCut: true }));
    expect(cut).toContain("most recent 40");
  });
});

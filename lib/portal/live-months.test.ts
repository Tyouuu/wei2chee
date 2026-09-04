import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildMonthlyReport, buildRanking, daysBetween, type MonthFact } from "./live-months";
import { READS_SHAPES, SHAPE_STATE, isLiveShape, isRealShape } from "./shape-state";
import { MODULE_CATALOG } from "./module-catalog";

/**
 * 报表 and 排名 are the first two pages whose figures are COMPUTED rather than
 * stored, so nothing in the database can contradict them and nothing in the
 * database can check them either. These assertions are the only thing standing
 * between a wrong sum and a founder reading it as his own month.
 */

const now = { y: 2026, m: 9 };
let seq = 0;
const at = (entry_on: string, ringgit: number): MonthFact => ({
  id: `m${++seq}`,
  adjusts_id: null,
  direction: "in",
  category: null,
  entry_on,
  amount_cents: ringgit * 100,
});
/* 花出去的一笔，给「赚多少」那两格用。 */
const spent = (entry_on: string, ringgit: number, category: string | null = null): MonthFact => ({
  id: `s${++seq}`,
  adjusts_id: null,
  direction: "out",
  category,
  entry_on,
  amount_cents: ringgit * 100,
});
/* 一笔冲正：方向跟原本那笔相反，adjusts_id 指着它。 */
const undo = (entry_on: string, ringgit: number, undoes: string): MonthFact => ({
  id: `u${++seq}`,
  adjusts_id: undoes,
  direction: "out",
  category: null,
  entry_on,
  amount_cents: ringgit * 100,
});

describe("报表 -- money that arrived, by month", () => {
  it("says nothing at all when there is nothing to say", () => {
    /* Not zeroes. An empty business keeps the demonstration, which is the
       founder's decision of 2026-08-30 and the rule every other projection in
       this directory follows. */
    expect(buildMonthlyReport({ lang: "zh", now, ledger: [] })).toBeNull();
  });

  it("buckets by the digits of the date, not by parsing it", () => {
    /* ⚠️ THE BUG THIS EXISTS FOR. The server runs on UTC. A payment entered at
       half past midnight on 1 September in Kuala Lumpur is 「2026-09-01」 in the
       column, and `new Date(...)` would file it in August -- the same class as
       20260831030000, where 收款 recorded between midnight and 8am landed on
       the wrong day. */
    const r = buildMonthlyReport({
      lang: "zh",
      now,
      ledger: [at("2026-09-01", 500), at("2026-08-31", 300)],
    })!;
    expect(r.rows[0].primary).toBe("2026 年 9 月");
    expect(r.rows[0].amount).toBe("RM 500");
    expect(r.rows[1].amount).toBe("RM 300");
  });

  it("puts the month he opened the page in at the top", () => {
    const r = buildMonthlyReport({ lang: "zh", now, ledger: [at("2026-09-02", 10)] })!;
    expect(r.rows).toHaveLength(6);
    expect(r.rows[0].primary).toBe("2026 年 9 月");
    expect(r.rows[5].primary).toBe("2026 年 4 月");
  });

  it("draws the same six months the table lists", () => {
    /* One span, not two. The last bar and the first row have to be the same
       month or the page argues with itself. */
    const r = buildMonthlyReport({ lang: "zh", now, ledger: [at("2026-09-02", 10)] })!;
    expect(r.stats.trend).toHaveLength(6);
    expect(r.stats.trend[5].label).toBe("9月");
    expect(r.stats.trend[5].value).toBe(10);
    expect(r.rows[0].primary).toContain("9 月");
  });

  it("compares each month with the one before it", () => {
    const r = buildMonthlyReport({
      lang: "zh",
      now,
      ledger: [at("2026-09-02", 200), at("2026-08-02", 100), at("2026-07-02", 400)],
    })!;
    expect(r.rows[0].status).toBe("增长");
    expect(r.rows[0].tone).toBe("positive");
    expect(r.rows[1].status).toBe("下滑");
    expect(r.rows[1].tone).toBe("warning");
  });

  it("does not call a quiet first month a problem", () => {
    /* A new business has several, and colouring them red is this product
       telling him his own opening months were a failure. */
    const r = buildMonthlyReport({ lang: "zh", now, ledger: [at("2026-09-02", 200)] })!;
    expect(r.rows[0].tone).toBe("neutral");
    expect(r.rows[5].tone).toBe("neutral");
  });

  it("says the month before was empty rather than calling it level", () => {
    /* 🔴 The first screenshot showed 「2026 年 6 月 · RM 3,200 · 持平」 above a
       May with nothing in it. Nothing against nothing is not level pegging,
       and RM 3,200 against nothing certainly is not. */
    const r = buildMonthlyReport({ lang: "zh", now, ledger: [at("2026-09-02", 200)] })!;
    expect(r.rows[0].status).toBe("上个月没有");
  });

  it("never claims a first month it did not look for", () => {
    /* 🔴 Also from the picture. The oldest row read 「第一个月」 -- a claim about
       this business made because the month before it had not been fetched, not
       because it was empty. Seven are counted and six are shown. */
    const r = buildMonthlyReport({
      lang: "zh",
      now,
      ledger: [at("2026-03-02", 500), at("2026-04-02", 900)],
    })!;
    expect(r.rows.map((x) => x.primary)).not.toContain("2026 年 3 月");
    expect(r.rows[5].primary).toBe("2026 年 4 月");
    /* April is measured against a March it can actually see. */
    expect(r.rows[5].status).toBe("增长");
  });

  describe("the three tiles", () => {
    const r = buildMonthlyReport({
      lang: "zh",
      now,
      ledger: [at("2026-09-02", 300), at("2026-09-03", 200), at("2026-08-02", 100)],
    })!;

    it("names the money in words the page cannot get wrong", () => {
      /* 任务 80: a right number under a wrong label is worse than a sample.
         The table's column is headed 营业额; this tile is what defines it, and
         it has to say cash. */
      expect(r.stats.tiles[0].label).toBe("本月收到");
      expect(r.stats.tiles[0].value).toBe("RM 500");
      expect(r.stats.tiles[1].deltaLabel).toBe("钱真的进来的那一天算");
    });

    it("counts entries, not ringgit, in the middle tile", () => {
      expect(r.stats.tiles[1].value).toBe("2 笔");
      expect(r.stats.tiles[1].value).not.toMatch(/RM/);
    });

    /* ⚠️ 「平均一笔」那一格 2026-09-04 拿掉了，位子让给「花掉」跟「赚」。
       一个承包商一个月三笔收款，那个平均数几乎不讲任何事。
       所以这里少了一条测试，而它是**跟着那一格一起走的**，
       不是一条被放宽的断言。 */

    it("brings its own icons rather than borrowing the dashboard's", () => {
      /* Positional icons are right on 总览, where the four tiles are always
         the same four questions. Here 「笔数」 would arrive wearing the
         reconciliation mark. */
      expect(r.stats.tiles.map((t) => t.icon)).toEqual([
        "payments",
        "reconciliation",
        /* 「花掉」永远画；「赚」只在他记过开销之后 -- 见底下那一段。 */
        "expenses",
      ]);
    });

    it("carries a six-point sparkline, so the delta is computed not claimed", () => {
      expect(r.stats.tiles[0].spark).toEqual([0, 0, 0, 0, 100, 500]);
    });

    it("charts the six it shows, not the seven it counted", () => {
      expect(r.stats.trend).toHaveLength(6);
      expect(r.stats.trend.map((p) => p.label)).toEqual(["4月", "5月", "6月", "7月", "8月", "9月"]);
    });
  });

  it("speaks the system's language", () => {
    const en = buildMonthlyReport({ lang: "en", now, ledger: [at("2026-09-02", 10)] })!;
    expect(en.rows[0].primary).toBe("September 2026");
    expect(en.stats.tiles[0].label).toBe("Received this month");
  });

  /* ── 赚多少（20260904200000） ────────────────────────────────────────── */
  describe("赚多少", () => {
    it("🔴 a payment that was reversed is not turnover", () => {
      /* 画面上那张表已经把它标成「已冲正」了。同一页两个答案，
         而这一页的整栏都是钱。 */
      /* ⚠️ 指着**它真的那个 id**，不是一个我数出来的 'm1'。
         seq 是整个档案共用的，所以写死一个 id 的测试会因为别人在
         上面加了一个 fixture 而变绿 -- 那种测试比没有更糟。 */
      const taken = at("2026-09-02", 500);
      const r = buildMonthlyReport({
        lang: "zh",
        now,
        ledger: [taken, undo("2026-09-03", 500, taken.id)],
      })!;
      expect(r.rows[0].amount).toBe("RM 0");
    });

    it("does not draw 「赚」 for a business that has never recorded a cost", () => {
      /* 那时候「赚」会等於「收到」-- 而那是这一页在宣称一件它不知道的事。 */
      const r = buildMonthlyReport({ lang: "zh", now, ledger: [at("2026-09-02", 900)] })!;
      expect(r.stats.tiles.map((t) => t.label)).not.toContain("本月赚");
      expect(r.stats.tiles.find((t) => t.label === "本月花掉")?.deltaLabel).toBe("还没记过开销");
    });

    it("draws it the moment he records his first expense", () => {
      const r = buildMonthlyReport({
        lang: "zh",
        now,
        ledger: [at("2026-09-02", 900), spent("2026-09-03", 200, "材料")],
      })!;
      const earned = r.stats.tiles.find((t) => t.label === "本月赚");
      expect(earned?.value).toBe("RM 700");
      /* 定义写在画面上，不是只写在注解里。 */
      expect(earned?.deltaLabel).toBe("收到的减花掉的");
    });

    it("names the biggest thing he spent on", () => {
      const r = buildMonthlyReport({
        lang: "zh",
        now,
        ledger: [
          at("2026-09-02", 900),
          spent("2026-09-03", 80, "车油"),
          spent("2026-09-04", 500, "材料"),
        ],
      })!;
      expect(r.stats.tiles.find((t) => t.label === "本月花掉")?.deltaLabel)
        .toBe("最大一笔：材料 RM 500");
    });

    it("calls what has no category 「没写类别」 rather than hiding it", () => {
      const r = buildMonthlyReport({
        lang: "zh",
        now,
        ledger: [at("2026-09-02", 900), spent("2026-09-03", 300)],
      })!;
      expect(r.stats.tiles.find((t) => t.label === "本月花掉")?.deltaLabel)
        .toBe("最大一笔：没写类别 RM 300");
    });

    it("🔴 says a losing month is losing, and marks it", () => {
      const r = buildMonthlyReport({
        lang: "zh",
        now,
        ledger: [at("2026-09-02", 100), spent("2026-09-03", 400, "材料")],
      })!;
      const earned = r.stats.tiles.find((t) => t.label === "本月赚");
      expect(earned?.value).toBe("-RM 300");
      expect(earned?.tone).toBe("warn");
    });

    it("counts spending in the month it happened, not the whole book", () => {
      const r = buildMonthlyReport({
        lang: "zh",
        now,
        ledger: [
          at("2026-09-02", 900),
          spent("2026-09-03", 100, "材料"),
          spent("2026-07-03", 5000, "材料"),
        ],
      })!;
      expect(r.stats.tiles.find((t) => t.label === "本月花掉")?.value).toBe("RM 100");
    });

    it("speaks the system's language here too", () => {
      const en = buildMonthlyReport({
        lang: "en",
        now,
        ledger: [at("2026-09-02", 900), spent("2026-09-03", 200, "Materials")],
      })!;
      expect(en.stats.tiles.map((t) => t.label)).toContain("Kept this month");
      expect(en.stats.tiles.find((t) => t.label === "Spent this month")?.deltaLabel)
        .toBe("Biggest: Materials RM 200");
    });
  });
});

describe("排名 -- who is up and who is slipping", () => {
  const party = (name: string, on: string, ringgit: number, id: string | null = null) => ({
    party: name,
    party_id: id,
    amount_cents: ringgit * 100,
    on,
  });
  const today = "2026-09-01";

  it("says nothing when there is nothing", () => {
    expect(buildRanking({ lang: "zh", now, today, facts: [] })).toBeNull();
  });

  it("says nothing when everything is older than the window", () => {
    /* Not an empty table with a heading over it. Nobody has been active, and a
       ranking of nobody is a demonstration, so the samples stay. */
    expect(
      buildRanking({ lang: "zh", now, today, facts: [party("陈先生", "2026-01-01", 900)] }),
    ).toBeNull();
  });

  it("ranks by what moved through them, biggest first", () => {
    const r = buildRanking({
      lang: "zh",
      now,
      today,
      facts: [party("A", "2026-08-20", 100), party("B", "2026-08-20", 900)],
    })!;
    expect(r.rows.map((x) => x.primary)).toEqual(["B", "A"]);
    expect(r.rows[0].amount).toBe("RM 900");
  });

  it("groups by id where there is one, by name where there is not", () => {
    /* ⚠️ The opposite call from convert_enquiry (20260901060000), on purpose,
       and this is the assertion that keeps the two from being conflated. Two
       receipts written before the customer record existed, plus two after,
       are one dealer -- nothing is filed by this page, so merging costs
       nothing and splitting him in two answers a question nobody asked. */
    const r = buildRanking({
      lang: "zh",
      now,
      today,
      facts: [
        party("陈先生", "2026-08-20", 100),
        party("  陈先生 ", "2026-08-21", 100),
        party("陈先生", "2026-08-22", 100, "id-1"),
        party("陈先生", "2026-08-23", 100, "id-1"),
      ],
    })!;
    expect(r.rows).toHaveLength(2);
    expect(r.rows.every((x) => x.amount === "RM 200")).toBe(true);
  });

  it("leaves out documents with nobody on them", () => {
    const r = buildRanking({
      lang: "zh",
      now,
      today,
      facts: [party("A", "2026-08-20", 100), party("   ", "2026-08-20", 900)],
    })!;
    expect(r.rows).toHaveLength(1);
  });

  describe("退步中 is measured, and that is the point", () => {
    it("marks a fall against the same length of time before it", () => {
      const r = buildRanking({
        lang: "zh",
        now,
        today,
        facts: [party("A", "2026-07-05", 900), party("A", "2026-08-25", 100)],
      })!;
      expect(r.rows[0].status).toBe("退步中");
      expect(r.rows[0].tone).toBe("warning");
    });

    it("never marks a newcomer as falling from nothing", () => {
      /* Somebody whose first document is this week has no earlier half. Calling
         that a decline would be the page inventing a past for him. */
      const r = buildRanking({ lang: "zh", now, today, facts: [party("A", "2026-08-30", 100)] })!;
      expect(r.rows[0].status).not.toBe("退步中");
    });

    it("counts the fallers in its own tile", () => {
      const r = buildRanking({
        lang: "zh",
        now,
        today,
        facts: [
          party("A", "2026-07-05", 900),
          party("A", "2026-08-25", 100),
          party("B", "2026-08-25", 500),
        ],
      })!;
      expect(r.stats.tiles[1].label).toBe("退步中");
      expect(r.stats.tiles[1].value).toBe("1");
      expect(r.stats.tiles[1].tone).toBe("warn");
    });
  });

  it("gives 顶级 to the top fifth, and at least to one", () => {
    const facts = Array.from({ length: 10 }, (_, i) =>
      party(`D${i}`, "2026-08-20", (10 - i) * 100),
    );
    const r = buildRanking({ lang: "zh", now, today, facts })!;
    expect(r.rows.filter((x) => x.status === "顶级")).toHaveLength(2);
    const one = buildRanking({ lang: "zh", now, today, facts: [party("A", "2026-08-20", 1)] })!;
    expect(one.rows[0].status).toBe("顶级");
  });

  it("counts how long ago, in Malaysia, from the digits", () => {
    const r = buildRanking({
      lang: "zh",
      now,
      today,
      facts: [party("A", "2026-09-01", 10), party("B", "2026-08-23", 10)],
    })!;
    const by = Object.fromEntries(r.rows.map((x) => [x.primary, x.secondary]));
    expect(by.A).toBe("今天");
    expect(by.B).toBe("9 天前");
  });

  it("renames the chart to what it actually counted", () => {
    /* 🔴 From the picture. The block is drawn captioned 「顶级和活跃加起来的
       人数」 and this counts everybody with a record, 退步中 included. A tier is
       decided over the whole window, so that caption cannot be made true --
       and only the thing that did the counting knows what it counted. */
    const r = buildRanking({ lang: "zh", now, today, facts: [party("A", "2026-08-20", 10)] })!;
    expect(r.stats.trendTitle).toBe("每个月有来往的人数");
    expect(r.stats.trendCaption).toContain("不分等级");
  });

  it("charts exactly what its caption says -- how many different people", () => {
    const r = buildRanking({
      lang: "zh",
      now,
      today,
      facts: [
        party("A", "2026-08-02", 10),
        party("A", "2026-08-09", 10),
        party("B", "2026-08-09", 10),
        party("C", "2026-09-01", 10),
      ],
    })!;
    const aug = r.stats.trend.find((p) => p.label === "8月")!;
    expect(aug.value).toBe(2);
    expect(r.stats.trend.find((p) => p.label === "9月")!.value).toBe(1);
  });
});

describe("daysBetween", () => {
  it("reads the digits and never parses an instant", () => {
    expect(daysBetween("2026-08-23", "2026-09-01")).toBe(9);
    expect(daysBetween("2026-09-01", "2026-09-01")).toBe(0);
    /* Across a leap-free year boundary, which is where a hand-rolled
       subtraction of month numbers goes wrong. */
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
  });

  it("returns 0 rather than NaN for something that is not a date", () => {
    expect(daysBetween("", "2026-09-01")).toBe(0);
  });
});

describe("a shape that only asks is wired to something that asks", () => {
  /*
    🔴 THE DEFECT THIS REPO HAS SHIPPED SIXTEEN TIMES: the capability exists
    and nothing calls it. 报表 and 排名 spent their whole life as drawings not
    because they were hard but because no caller ever read a ledger on their
    behalf -- and the console badge said 「还是画的」, which read as a plan
    rather than as a missing wire.

    So the claim is checked against the caller. `reads` means 「his own figures
    reach this page」, and the only place that can be true is the page that
    builds it.
  */
  const page = readFileSync(
    join(process.cwd(), "app", "[locale]", "portal", "[pageKey]", "page.tsx"),
    "utf8",
  );

  it.each([...READS_SHAPES])("routes real figures into %s", (shape) => {
    expect(page).toContain(`"${shape}"`);
  });

  it("gives no 加一单 button to a shape with nothing to add to", () => {
    /* 「Add a report」 is a button that would have to write a row into a page
       whose whole definition is that it holds none. */
    for (const shape of READS_SHAPES) expect(isLiveShape(shape)).toBe(false);
  });

  it("counts a reads shape as real, because to him it is", () => {
    for (const shape of READS_SHAPES) expect(isRealShape(shape)).toBe(true);
  });

  it("keeps every module of a reads shape out of the numbering", () => {
    /* A report has no document number. Nothing issued it. */
    for (const m of MODULE_CATALOG) {
      if (SHAPE_STATE[m.shape] !== "reads") continue;
      expect(READS_SHAPES.has(m.shape)).toBe(true);
    }
  });
});

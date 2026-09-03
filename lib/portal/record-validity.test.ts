import { describe, it, expect } from "vitest";
import {
  validityKindOf,
  defaultDueOn,
  isPastDue,
  daysLeft,
  todayMYT,
  DEFAULT_VALID_DAYS,
} from "./record-validity";
import { MODULE_KEYS, MODULE_BY_KEY } from "./module-catalog";

/**
 * 每一条写成老板会读到的那句话。
 */

describe("同一栏，三种意思", () => {
  it("报价单是有效期", () => {
    expect(validityKindOf("quotations")).toBe("validTill");
  });

  it("订单 · 工程 · 任务是期限", () => {
    for (const k of ["orders", "projects", "tasks"]) {
      expect(validityKindOf(k), k).toBe("deadline");
    }
  });

  it("进货单是预计到货 —— 那是买的那一边，不是答应人家的日子", () => {
    expect(validityKindOf("purchases")).toBe("expected");
  });

  it("不是走单的模块没有这一格", () => {
    for (const k of ["payments", "customers", "inventory", "bookings", "website"]) {
      expect(validityKindOf(k), k).toBeNull();
    }
  });

  /* 守的是形状不是这一次：新加一个走单模块而忘了给它一个字，
     它会静静穿上「没有日子」，而它的单上明明有一格日期。 */
  it("每一个走单模块都要讲得出它的日子叫什么", () => {
    const missing = MODULE_KEYS.filter(
      (k) => MODULE_BY_KEY[k]?.shape === "pipeline" && validityKindOf(k) === null,
    );
    expect(missing, `这几个走单模块没有讲它的日子叫什么：${missing.join(" ")}`).toEqual([]);
  });
});

describe("预设 +30 天，而且只有报价单有", () => {
  it("报价单预设一个月后", () => {
    expect(defaultDueOn("validTill", "2026-09-03")).toBe("2026-10-03");
    expect(DEFAULT_VALID_DAYS).toBe(30);
  });

  /* ⚠️ 这一条是这个档案里最重要的一条。替他猜一个交货日填进去，
     比留白更糟 —— 留白他会去填，一个猜的他会以为是真的。 */
  it("期限跟预计到货不给预设 —— 那是他跟客人谈出来的日子", () => {
    expect(defaultDueOn("deadline", "2026-09-03")).toBeUndefined();
    expect(defaultDueOn("expected", "2026-09-03")).toBeUndefined();
    expect(defaultDueOn(null, "2026-09-03")).toBeUndefined();
  });

  it("给一个不是日期的东西，不会吐出一个假日期", () => {
    expect(defaultDueOn("validTill", "")).toBeUndefined();
    expect(defaultDueOn("validTill", "下个月")).toBeUndefined();
  });
});

describe("过期是算出来的", () => {
  const flow = ["Enquiry", "Quoted", "Confirmed"];

  it("日子过了而单还开着 —— 过期", () => {
    expect(isPastDue({ dueOn: "2026-09-01", stage: "Quoted", workflow: flow, today: "2026-09-03" })).toBe(true);
  });

  it("今天到期还不算过期 —— 今天他还可以接", () => {
    expect(isPastDue({ dueOn: "2026-09-03", stage: "Quoted", workflow: flow, today: "2026-09-03" })).toBe(false);
  });

  it("没有日子的单永远不过期 —— 大部分单本来就没有", () => {
    expect(isPastDue({ dueOn: null, today: "2026-09-03" })).toBe(false);
    expect(isPastDue({ dueOn: "  ", today: "2026-09-03" })).toBe(false);
  });

  /* 一张成交的报价单不会过期。它已经变成生意了。 */
  it("走到流程最后一格就不算过期", () => {
    expect(isPastDue({ dueOn: "2026-08-01", stage: "Confirmed", workflow: flow, today: "2026-09-03" })).toBe(false);
  });

  it("收起来的不算过期", () => {
    expect(
      isPastDue({ dueOn: "2026-08-01", stage: "Quoted", workflow: flow, archivedAt: "2026-08-20", today: "2026-09-03" }),
    ).toBe(false);
  });

  /* ⚠️ 不猜。流程是空的时候我们真的不知道哪一格算结束，
     那就照日历讲实话，而不是发明一个「Confirmed 大概是最后一格」。 */
  it("没有流程的时候不猜哪一格算结束", () => {
    expect(isPastDue({ dueOn: "2026-08-01", stage: "随便打的一格", today: "2026-09-03" })).toBe(true);
  });

  it("他自己改过名字的一格，照样算得出过期", () => {
    expect(
      isPastDue({ dueOn: "2026-08-01", stage: "等老板回", workflow: flow, today: "2026-09-03" }),
    ).toBe(true);
  });
});

describe("还剩几天", () => {
  it("还没到讲还剩几天", () => {
    expect(daysLeft("2026-09-06", "2026-09-03")).toBe(3);
  });

  it("过了讲负数", () => {
    expect(daysLeft("2026-08-22", "2026-09-03")).toBe(-12);
  });

  it("今天是零", () => {
    expect(daysLeft("2026-09-03", "2026-09-03")).toBe(0);
  });

  it("没有日子就没有天数，不是 0", () => {
    expect(daysLeft(null, "2026-09-03")).toBeNull();
    expect(daysLeft("不知道", "2026-09-03")).toBeNull();
  });
});

describe("今天是马来西亚的今天", () => {
  /* 伺服器跑 UTC。马来西亚半夜十二点到早上八点之间，两个日子不一样 ——
     一张今天到期的单会在他还在看的时候提早一天变红。
     这跟 20260831030000 在资料库那一边修的是同一个坑。 */
  it("马来西亚 09-04 凌晨一点，伺服器还是 09-03", () => {
    expect(todayMYT(new Date("2026-09-03T17:00:00Z"))).toBe("2026-09-04");
  });

  it("马来西亚 09-03 晚上七点，两边同一天", () => {
    expect(todayMYT(new Date("2026-09-03T11:00:00Z"))).toBe("2026-09-03");
  });
});

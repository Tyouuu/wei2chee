/**
 * 工作台只有一套样子，而**画面上的字要跟它讲同一句话**。
 *
 * ── 为什么有这一条（2026-09-06）────────────────────────────────────────────
 *
 * 2026-09-04 起 `projects.style` 只管一个画面：客户的官网。
 * 而到 2026-09-06 为止，风格那一页还写着
 * **「Switch with a click … every page above changes with it」** ——
 * 一句在描述一个产品已经没有的行为。
 *
 * 一颗按不动的按钮跟一句不再成立的话，是同一个缺陷的两张脸；
 * 而后者更难发现，因为**它不会报错，也不会有人去按它**。
 *
 * 所以这一条守两半：
 *   ① `canvasRegister` 真的只让官网跟着他挑的那一套走
 *   ② **那一页的字里不可以再出现「上面每一页都会跟着变」那种承诺**
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SITE_PAGE_KEY, SYSTEM_REGISTER, canvasRegister, deskSurface } from "./system-register";

/* 客户系统里真的会出现的那几页 —— 从目录推出来，不是手写的。 */
const OTHER_PAGES = [
  "dashboard",
  "quotations",
  "orders",
  "payments",
  "customers",
  "suppliers",
  "staff",
  "inventory",
  "bookings",
  "reports",
];

describe("工作台一套，官网跟着他挑的走", () => {
  it("官网穿他自己挑的那一套", () => {
    expect(canvasRegister(SITE_PAGE_KEY, "hearth")).toBe("hearth");
    expect(canvasRegister(SITE_PAGE_KEY, "signboard")).toBe("signboard");
  });

  it("他还没挑的时候，官网也有一套可穿", () => {
    expect(canvasRegister(SITE_PAGE_KEY, null)).toBe(SYSTEM_REGISTER);
  });

  it.each(OTHER_PAGES)("%s 不跟着他挑的那一套走", (key) => {
    expect(canvasRegister(key, "hearth")).toBe(SYSTEM_REGISTER);
    expect(canvasRegister(key, "signboard")).toBe(SYSTEM_REGISTER);
  });

  it("工作台是工作台那一面，官网不是", () => {
    expect(deskSurface(SITE_PAGE_KEY)).toBeUndefined();
    for (const k of OTHER_PAGES) expect(deskSurface(k)).toBe("desk");
  });
});

describe("🔴 画面上的字不可以再承诺那件事", () => {
  const en = JSON.parse(readFileSync(join(process.cwd(), "messages", "en.json"), "utf8"));
  const zh = JSON.parse(readFileSync(join(process.cwd(), "messages", "zh.json"), "utf8"));

  /* 讲的是「换一套，上面／每一页都会跟着变」的那几种说法。
     ⚠️ 门槛写得**窄** —— 一条会把「官网会跟着变」也判红的守卫，
     会教下一个人去关掉它。 */
  const BANNED = [
    /every page (above|here) changes/i,
    /all your pages change/i,
    /上面每一页/,
    /每一页都(会)?跟着变/,
  ];

  it.each([
    ["en", en],
    ["zh", zh],
  ])("%s", (_lang, dict) => {
    const home = dict.portal.home as Record<string, unknown>;
    const styles = dict.portal.styles as Record<string, unknown>;
    const said = [...Object.values(home), ...Object.values(styles)].filter(
      (v): v is string => typeof v === "string",
    );
    const bad = said.filter((v) => BANNED.some((re) => re.test(v)));
    expect(bad, `还在承诺工作台会跟着换：${bad.join(" | ")}`).toEqual([]);
  });
});

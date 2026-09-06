import { describe, expect, it } from "vitest";
import { waLink, waNumber } from "./wa-link";

/**
 * ⚠️ 每一个例子都是**真的会被打进那一格的写法**，不是我编的格式。
 * 名册那一栏是自由文字（`directory_entries.whatsapp`），所以他打什么都有。
 */
describe("他打进去的那串号码", () => {
  it("本地写法补上国码", () => {
    expect(waNumber("012-345 6789")).toBe("60123456789");
    expect(waNumber("0123456789")).toBe("60123456789");
  });

  it("已经有国码的不动它", () => {
    expect(waNumber("+60 12-345 6789")).toBe("60123456789");
    expect(waNumber("60123456789")).toBe("60123456789");
  });

  it("别的国家照他打的走", () => {
    /* 新加坡。他打了 `+`，那就是他讲的国码 —— 我们不改它。 */
    expect(waNumber("+65 8123 4567")).toBe("6581234567");
  });

  /* 🔴 这一条是这一支存在的理由 —— 见档头。 */
  it("认不出来就回 null，不猜", () => {
    expect(waNumber("123456789")).toBeNull();
    expect(waNumber("012")).toBeNull();
    expect(waNumber("")).toBeNull();
    expect(waNumber(null)).toBeNull();
    expect(waNumber("找陈先生")).toBeNull();
  });

  it("那句话跟着连结走，而且是编码过的", () => {
    const url = waLink("012-345 6789", "你好 陈先生，RM 1,200 还没收到。");
    expect(url).toContain("https://wa.me/60123456789?text=");
    expect(url).toContain(encodeURIComponent("RM 1,200"));
  });

  it("号码认不出来的时候连结也是 null —— 呼叫端不准画那颗按钮", () => {
    expect(waLink("123456789", "你好")).toBeNull();
  });
});

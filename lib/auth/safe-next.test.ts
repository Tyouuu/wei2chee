import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("登入后的 next 只认本站的路径", () => {
  it("一条本站的路径原样收下", () => {
    expect(safeNext("/en/salon-preview/overview")).toBe("/en/salon-preview/overview");
    expect(safeNext("/en/portal/customers?x=1")).toBe("/en/portal/customers?x=1");
  });

  it("没给、给空的，都是没有", () => {
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext(null)).toBeNull();
    expect(safeNext("")).toBeNull();
  });

  it("陣列（同一个参数出现两次）取第一个", () => {
    expect(safeNext(["/en/portal", "https://evil.example"])).toBe("/en/portal");
    expect(safeNext(["https://evil.example", "/en/portal"])).toBeNull();
  });

  it.each([
    "https://evil.example",
    "http://evil.example/en/portal",
    "//evil.example",
    "//evil.example/en/portal",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "en/portal",
    "/en/portal\n",
    "/en/por\u0000tal",
  ])("🔴 开放式转址一律挡下来：%j", (v) => {
    expect(safeNext(v)).toBeNull();
  });

  it("过长的当没有", () => {
    expect(safeNext("/" + "a".repeat(400))).toBeNull();
  });
});

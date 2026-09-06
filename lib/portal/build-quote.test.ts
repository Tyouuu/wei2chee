/**
 * 那两个数字，跟**画面上不可以再出现上一套**。
 *
 * ── 为什么后面那一半也是一条守卫（2026-09-06）─────────────────────────────
 *
 * 概念 2026-09-03 换掉了，而需求书那一页印了三天上一套的价目 ——
 * 起底 RM 1,500 ＋ 第一个 RM 800 ＋ 同类再一个 RM 300，合计 RM 5,800，
 * 底下写「规格书 RM 500 … 托管 RM 150 一个月」。
 *
 * 没有任何东西会红，因为**那些数字每一个都算得出来，只是算的是上一套**。
 * 所以这一条不只钉住新的两个数字，也钉住那几句话不可以回来。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ANNUAL_FEE_MYR, BUILD_FEE_MYR, formatMyr } from "./build-quote";

describe("他要付的钱", () => {
  it("建置一次 RM 1,500，之后每年 RM 1,500", () => {
    expect(BUILD_FEE_MYR).toBe(1500);
    expect(ANNUAL_FEE_MYR).toBe(1500);
  });

  it("印出来带千位逗号", () => {
    expect(formatMyr(1500)).toBe("RM 1,500");
    expect(formatMyr(0)).toBe("RM 0");
  });

  /* 🔴 上一套那几个数字跟那几句话，不可以回到那份文件上。
     ⚠️ 只扫**需求书自己**那一段文案 —— 一把扫全部文案的尺会把
     别处真的 RM 500 判红（例如以后真的有一个 RM 800 的加做费）。 */
  it.each(["en", "zh"])("%s 的需求书里没有上一套的价目", (lang) => {
    const dict = JSON.parse(
      readFileSync(join(process.cwd(), "messages", `${lang}.json`), "utf8"),
    ) as { portal: { spec: Record<string, unknown> } };
    const said = Object.values(dict.portal.spec)
      .filter((v): v is string => typeof v === "string")
      .join(" | ");

    /* 按模块／按形状那一套：一个模块一个价钱。 */
    expect(/RM ?800|RM ?300|RM ?5,800/.test(said), `还印着上一套的价目：${said}`).toBe(false);
    /* 规格书那一笔，跟「托管 RM 150 一个月」。 */
    expect(/RM ?500/.test(said), `还印着规格书那一笔：${said}`).toBe(false);
    expect(/150 ?\/ ?month|150 ?\/ ?月/.test(said), `还印着月费：${said}`).toBe(false);
  });
});

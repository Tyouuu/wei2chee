import { describe, expect, it } from "vitest";
import {
  landingAfterLogin,
  platformHome,
  productHome,
  systemSurfaceOf,
} from "./system-surface";

describe("哪一种帐号用哪一套系统界面", () => {
  it("美容 / 沙龙 / medi spa（beauty）用沙龙界面", () => {
    expect(systemSurfaceOf({ industry: { slug: "beauty" } })).toBe("salon");
  });

  it("其余行业、没有行业、没有 context，都走原来的（classic）", () => {
    expect(systemSurfaceOf({ industry: { slug: "renovation" } })).toBe("classic");
    expect(systemSurfaceOf({ industry: { slug: "education" } })).toBe("classic");
    expect(systemSurfaceOf({ industry: null })).toBe("classic");
    expect(systemSurfaceOf({})).toBe("classic");
    expect(systemSurfaceOf(null)).toBe("classic");
    expect(systemSurfaceOf(undefined)).toBe("classic");
  });

  it("两个正门都带语言前缀", () => {
    expect(productHome("en")).toBe("/en/salon-preview/overview");
    expect(platformHome("zh")).toBe("/zh/portal");
  });
});

describe("登入之后落在哪里", () => {
  it("沙龙帐号落在产品", () => {
    expect(landingAfterLogin({ locale: "en", surface: "salon", next: null })).toBe("/en/salon-preview/overview");
  });

  it("其余帐号落在平台首页（跟以前一模一样）", () => {
    expect(landingAfterLogin({ locale: "en", surface: "classic", next: null })).toBe("/portal");
  });

  it("链接里带了 next，不管哪一种帐号，next 赢", () => {
    expect(landingAfterLogin({ locale: "en", surface: "salon", next: "/en/portal/consent" })).toBe("/en/portal/consent");
    expect(landingAfterLogin({ locale: "en", surface: "classic", next: "/en/salon-preview/overview" })).toBe("/en/salon-preview/overview");
  });
});

describe("旧侧栏里哪几页在产品里有新版", () => {
  it("总览 · 预约 · 客户 · 收款 · 师傅 · 库存有；带语言前缀", async () => {
    const { productPathFor } = await import("./system-surface");
    expect(productPathFor("en", "dashboard")).toBe("/en/salon-preview/overview");
    expect(productPathFor("en", "bookings")).toBe("/en/salon-preview/schedule");
    expect(productPathFor("en", "customers")).toBe("/en/salon-preview/clients");
    expect(productPathFor("en", "payments")).toBe("/en/salon-preview/invoices");
    expect(productPathFor("en", "staff")).toBe("/en/salon-preview/stylists");
    expect(productPathFor("en", "inventory")).toBe("/en/salon-preview/stock");
  });

  it("没有新版的（开销 · 官网 · 进货 …）回 null，照旧走旧页", async () => {
    const { productPathFor } = await import("./system-surface");
    for (const k of ["expenses", "website", "purchases", "suppliers", "quotations", "orders", "no-such-page"]) {
      expect(productPathFor("en", k)).toBeNull();
    }
  });

  it("每一个新页真的存在（映射不会指向一个不存在的路径）", async () => {
    const { productPathFor } = await import("./system-surface");
    const { existsSync } = await import("node:fs");
    for (const k of ["dashboard", "bookings", "customers", "payments", "staff", "inventory"]) {
      const slug = productPathFor("en", k)!.split("/").pop()!;
      expect(existsSync(`app/[locale]/salon-preview/${slug}/page.tsx`), `${k} → ${slug}`).toBe(true);
    }
  });
});

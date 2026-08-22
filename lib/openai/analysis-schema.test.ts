import { describe, it, expect } from "vitest";
import { analysisSchema, fallbackAnalysis } from "./analysis-schema";

const validAnalysis = () => ({
  bottlenecks: [{ title: "追款慢", description: "手工追踪付款", severity: "high" }],
  before_workflow: ["客户", "订单"],
  after_workflow: ["客户", "报价", "订单", "收款"],
  // The English side is REQUIRED, not optional. The system this analysis
  // builds is English by default while the owner answers in Chinese, so a
  // model that returns only the Chinese fields has not done the job -- and
  // making that a parse failure is what sends it to the retry rather than to
  // a customer with a half-generic first screen.
  after_workflow_en: ["Client", "Quote", "Order", "Payment"],
  focus_stage_index: 1,
  summary: "你有 3 个环节可以自动化",
  summary_en: "Three steps here can run themselves",
  modules: [
    { key: "dashboard", label: "总览", label_en: "Overview", why: "每天要看的数字" },
    { key: "customers", label: "客户", label_en: "Customers", why: "名单散在 WhatsApp" },
    { key: "quotations", label: "报价单", label_en: "Quotations", why: "报价出去没人跟" },
    { key: "payments", label: "收款", label_en: "Payments", why: "追款靠记性" },
  ],
});

describe("analysisSchema", () => {
  it("accepts a well-formed analysis object", () => {
    expect(() => analysisSchema.parse(validAnalysis())).not.toThrow();
  });

  it("rejects an object missing required fields", () => {
    expect(() => analysisSchema.parse({ bottlenecks: [] })).toThrow();
  });

  it("rejects an empty bottlenecks array", () => {
    expect(() => analysisSchema.parse({ ...validAnalysis(), bottlenecks: [] })).toThrow();
  });

  // The whole point of making severity an enum rather than a string: a model
  // that answers "very high" or "严重" is producing a valid STRING and an
  // unusable VALUE. Shape validation alone would let this through.
  it("rejects a severity outside the enum", () => {
    const invalid = {
      ...validAnalysis(),
      bottlenecks: [{ title: "追款慢", description: "手工追踪付款", severity: "very high" }],
    };
    expect(() => analysisSchema.parse(invalid)).toThrow();
  });

  it("rejects more than four bottlenecks", () => {
    const one = { title: "问题", description: "说明", severity: "low" as const };
    expect(() =>
      analysisSchema.parse({ ...validAnalysis(), bottlenecks: [one, one, one, one, one] }),
    ).toThrow();
  });

  // Clamped, not rejected: an off-by-one index is a recoverable blemish, and
  // throwing away an otherwise-good analysis over it would send a real visitor
  // to the fallback for no reason.
  it("clamps an out-of-range focus_stage_index to the last stage", () => {
    const parsed = analysisSchema.parse({ ...validAnalysis(), focus_stage_index: 99 });
    expect(parsed.focus_stage_index).toBe(3);
  });

  it("clamps a negative focus_stage_index to the first stage", () => {
    const parsed = analysisSchema.parse({ ...validAnalysis(), focus_stage_index: -4 });
    expect(parsed.focus_stage_index).toBe(0);
  });
});

describe("fallbackAnalysis", () => {
  const industry = {
    name_zh: "装修/承包商",
    name_en: "Renovation / Contractor",
    default_workflow: ["Customer", "Quotation", "Approval", "Deposit", "Project", "Milestone", "Final Payment"],
  };

  // The fallback is only worth having if it satisfies the same contract the
  // model's output does -- otherwise the failure path fails a second time,
  // at the point where there is nothing left to fall back to.
  it("produces output that passes the same schema, in both languages", () => {
    expect(() => analysisSchema.parse(fallbackAnalysis(industry, "zh"))).not.toThrow();
    expect(() => analysisSchema.parse(fallbackAnalysis(industry, "en"))).not.toThrow();
  });

  it("caps the workflow at the schema's six-stage limit", () => {
    const parsed = analysisSchema.parse(fallbackAnalysis(industry, "zh"));
    expect(parsed.after_workflow).toHaveLength(6);
  });

  it("still produces a valid analysis for an industry with no workflow data", () => {
    const bare = { name_zh: "其他", name_en: "Other", default_workflow: [] };
    expect(() => analysisSchema.parse(fallbackAnalysis(bare, "zh"))).not.toThrow();
  });

  it("answers in the requested language", () => {
    expect(fallbackAnalysis(industry, "zh").summary).toContain("装修");
    expect(fallbackAnalysis(industry, "en").summary).toContain("Renovation");
  });
});

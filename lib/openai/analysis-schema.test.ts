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
  enquiry: {
    lands_in: "quotations",
    fields: [
      { label: "称呼", label_en: "Your name", kind: "text" },
      { label: "电话", label_en: "Phone", kind: "phone" },
      { label: "想做什么", label_en: "What do you need?", kind: "long" },
    ],
  },
});

describe("analysisSchema", () => {
  it("accepts a well-formed analysis object", () => {
    expect(() => analysisSchema.parse(validAnalysis())).not.toThrow();
  });

  it("rejects an object missing required fields", () => {
    expect(() => analysisSchema.parse({ bottlenecks: [] })).toThrow();
  });

  // 「你应该想到更多方面就是可能别的行业是不用这个报价单的呢？」 -- three separate
  // ways an enquiry could land somewhere this business cannot show it.
  it("moves an enquiry off a page this business does not have", () => {
    const parsed = analysisSchema.parse({
      ...validAnalysis(),
      enquiry: { ...validAnalysis().enquiry, lands_in: "bookings" },
    });
    // No bookings module in this analysis, so it falls back to the first
    // sell-side page that IS present rather than linking nowhere.
    expect(parsed.enquiry.lands_in).toBe("quotations");
  });

  it("keeps \"none\" when the trade takes no enquiries", () => {
    const parsed = analysisSchema.parse({
      ...validAnalysis(),
      enquiry: { lands_in: "none", fields: [] },
    });
    expect(parsed.enquiry.lands_in).toBe("none");
    expect(parsed.enquiry.fields).toEqual([]);
  });

  it("refuses to land an enquiry somewhere it cannot honestly become a record", () => {
    const parsed = analysisSchema.parse({
      ...validAnalysis(),
      // A real module key, and a nonsense destination for a stranger's first
      // message. Corrected rather than believed.
      enquiry: { ...validAnalysis().enquiry, lands_in: "payments" },
    });
    expect(parsed.enquiry.lands_in).toBe("quotations");
  });

  it("caps the form at four questions", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      label: `问${i}`,
      label_en: `Q${i}`,
      kind: "text" as const,
    }));
    expect(() =>
      analysisSchema.parse({ ...validAnalysis(), enquiry: { lands_in: "quotations", fields: six } }),
    ).toThrow();
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

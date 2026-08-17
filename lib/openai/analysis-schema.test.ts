import { describe, it, expect } from "vitest";
import { analysisSchema } from "./analysis-schema";

describe("analysisSchema", () => {
  it("accepts a well-formed analysis object", () => {
    const valid = {
      bottlenecks: [{ icon: "clock", title: "追款慢", description: "手工追踪付款" }],
      before_workflow: ["Customer", "Order"],
      after_workflow: ["Customer", "Quotation", "Order", "Payment"],
      summary: "你有 3 个环节可以自动化",
    };
    expect(() => analysisSchema.parse(valid)).not.toThrow();
  });

  it("rejects an object missing required fields", () => {
    const invalid = { bottlenecks: [] };
    expect(() => analysisSchema.parse(invalid)).toThrow();
  });

  it("rejects an empty bottlenecks array", () => {
    const invalid = {
      bottlenecks: [],
      before_workflow: ["Customer"],
      after_workflow: ["Customer", "Payment"],
      summary: "test",
    };
    expect(() => analysisSchema.parse(invalid)).toThrow();
  });
});

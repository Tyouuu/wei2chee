import { z } from "zod";

export const analysisSchema = z.object({
  bottlenecks: z
    .array(
      z.object({
        icon: z.string(),
        title: z.string(),
        description: z.string(),
      }),
    )
    .min(1)
    .max(6),
  before_workflow: z.array(z.string()).min(1),
  after_workflow: z.array(z.string()).min(1),
  summary: z.string(),
});

export type AnalysisPayload = z.infer<typeof analysisSchema>;

export const analysisJsonSchema = {
  name: "business_analysis",
  strict: true,
  schema: {
    type: "object",
    properties: {
      bottlenecks: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            icon: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
          },
          required: ["icon", "title", "description"],
          additionalProperties: false,
        },
      },
      before_workflow: { type: "array", items: { type: "string" }, minItems: 1 },
      after_workflow: { type: "array", items: { type: "string" }, minItems: 1 },
      summary: { type: "string" },
    },
    required: ["bottlenecks", "before_workflow", "after_workflow", "summary"],
    additionalProperties: false,
  },
} as const;

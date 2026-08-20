import { z } from "zod";

/**
 * The contract for what the model is allowed to return, in both the shapes
 * that enforce it: a JSON Schema sent to OpenAI with `strict: true` (so the
 * model literally cannot emit anything else), and a Zod schema that re-checks
 * the parsed result on our side.
 *
 * REVISED 2026-08-20 for output stability. Three changes, each closing a real
 * source of variance:
 *
 * 1. `icon` is GONE. It was a required field on every bottleneck, in a strict
 *    schema, that nothing in the entire codebase ever rendered -- confirmed by
 *    grep against components/sections/analysis-reveal.tsx, the only consumer.
 *    A required field with no consumer is not free: the model spends attention
 *    choosing a value, that value is one more thing that can come back in an
 *    unexpected shape, and its presence in the schema tells the model this is
 *    information worth having. Deleting unused required fields is the cheapest
 *    stability win available and it was sitting here unclaimed.
 *
 * 2. `severity` is an ENUM, not free text. Constraining SHAPE (this is a
 *    string) without constraining VALUES is only half the job -- "high" /
 *    "High" / "严重" / "very high" are all valid strings and all break any
 *    code that switches on the value. An enum makes the set of possible
 *    outputs finite and therefore testable.
 *
 * 3. `focus_stage_index` is an integer index into `after_workflow`, not a
 *    repeated stage NAME. Asking a model to reproduce a string it generated
 *    earlier in the same response is asking for a near-miss ("收订金" vs
 *    "订金"); an integer either points at a real stage or is out of range, and
 *    out-of-range is trivially detectable and clampable.
 */

const SEVERITIES = ["high", "medium", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const analysisSchema = z
  .object({
    bottlenecks: z
      .array(
        z.object({
          title: z.string().min(1),
          description: z.string().min(1),
          severity: z.enum(SEVERITIES),
        }),
      )
      .min(1)
      .max(4),
    before_workflow: z.array(z.string().min(1)).min(1).max(8),
    after_workflow: z.array(z.string().min(1)).min(1).max(6),
    focus_stage_index: z.number().int(),
    summary: z.string().min(1),
  })
  // Clamped rather than rejected. An index one past the end is a trivially
  // recoverable mistake, and throwing away an otherwise-good analysis over it
  // would trade a small blemish for a total failure -- exactly the wrong
  // trade for the first thing a prospective customer sees.
  .transform((value) => ({
    ...value,
    focus_stage_index: Math.min(
      Math.max(0, value.focus_stage_index),
      value.after_workflow.length - 1,
    ),
  }));

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
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "6-12 characters. The problem, named." },
            description: {
              type: "string",
              description: "One sentence, under 40 characters. What it costs the business.",
            },
            severity: { type: "string", enum: [...SEVERITIES] },
          },
          required: ["title", "description", "severity"],
          additionalProperties: false,
        },
      },
      before_workflow: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: { type: "string", description: "A stage name, 2-4 characters." },
      },
      after_workflow: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: { type: "string", description: "A stage name, 2-4 characters." },
      },
      focus_stage_index: {
        type: "integer",
        description:
          "0-based index into after_workflow naming the stage this business should fix first.",
      },
      summary: { type: "string", description: "One sentence, under 50 characters." },
    },
    required: ["bottlenecks", "before_workflow", "after_workflow", "focus_stage_index", "summary"],
    additionalProperties: false,
  },
} as const;

/**
 * The analysis this endpoint returns when the model cannot be reached or keeps
 * returning something that will not validate.
 *
 * WHY A FALLBACK EXISTS AT ALL: before this, both failure paths returned a 502
 * and the visitor -- someone who had just spent minutes answering questions
 * about their business -- got an error and left. That is the single most
 * expensive moment in the funnel to fail at. An LLM being briefly unavailable
 * is a routine event and must not be a lost customer.
 *
 * What comes back is deliberately honest rather than fabricated: it describes
 * the industry's known default workflow (real data, from the industries table)
 * and names generic-but-true operational problems, instead of inventing
 * specifics about a business it did not actually analyse.
 */
export function fallbackAnalysis(
  industry: { name_zh: string; name_en: string; default_workflow: string[] },
  language: "zh" | "en",
): AnalysisPayload {
  const stages =
    industry.default_workflow.length > 0 ? industry.default_workflow.slice(0, 6) : ["Customer", "Payment"];

  if (language === "zh") {
    return {
      bottlenecks: [
        {
          title: "记录分散",
          description: "订单和客户资料散在 WhatsApp、excel 和纸本，找一次要翻很久。",
          severity: "high",
        },
        {
          title: "追款靠记性",
          description: "谁付了、谁还欠着，没有一个地方能一眼看完。",
          severity: "high",
        },
        {
          title: "进度看不到",
          description: "客户问进度要打电话问员工，员工也要再确认。",
          severity: "medium",
        },
      ],
      before_workflow: stages,
      after_workflow: stages,
      focus_stage_index: 0,
      summary: `${industry.name_zh}的日常运作大多还靠人记，把记录集中起来是第一步。`,
    };
  }

  return {
    bottlenecks: [
      {
        title: "Scattered records",
        description: "Orders and customer details live across WhatsApp, Excel and paper.",
        severity: "high",
      },
      {
        title: "Payment chasing by memory",
        description: "No single place shows who has paid and who still owes.",
        severity: "high",
      },
      {
        title: "Invisible progress",
        description: "Answering 'where is my job' means calling a staff member first.",
        severity: "medium",
      },
    ],
    before_workflow: stages,
    after_workflow: stages,
    focus_stage_index: 0,
    summary: `Most of this ${industry.name_en} business still runs on memory; centralising records is step one.`,
  };
}

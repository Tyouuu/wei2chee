import { z } from "zod";
import { MODULE_KEYS, defaultRecommendations, normalizeModules } from "@/lib/portal/module-catalog";

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

/** A workflow stage is a column heading, not a sentence. Six rather than the
 *  prompt's "2-4" so a genuinely four-character stage with a qualifier
 *  survives, while a leaked sentence cannot. */
const STAGE_MAX_CHARS = 6;

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
    // The character cap is enforced HERE, not only in the prompt. A system
    // message saying "2-4 characters" is a request; a schema is a rule. Fed a
    // long brief, the live model returned 「佣金核算容易出错，影响结算准确性。」
    // as a workflow stage -- a bottleneck description that would have been
    // drawn as a column heading in the customer's own system. Truncating
    // rather than rejecting, because one long stage name is not worth losing
    // an otherwise-good analysis over, for the same reason focus_stage_index
    // is clamped below.
    before_workflow: z.array(z.string().min(1)).min(1).max(8),
    after_workflow: z.array(z.string().min(1)).min(1).max(6),
    focus_stage_index: z.number().int(),
    summary: z.string().min(1),
    // What the system should be MADE of. Until 2026-08-21 the model had no
    // field for this at all: it analysed the business in detail and then had
    // no say in what was built, because page count came from a SQL CASE over
    // eight industry slugs. See lib/portal/module-catalog.ts.
    modules: z
      .array(
        z.object({
          key: z.enum(MODULE_KEYS as [string, ...string[]]),
          label: z.string().min(1),
          // Required of the MODEL (the JSON schema below lists it in
          // `required` and says what it must reference), but allowed to be
          // empty HERE -- because the fallback path legitimately has no reason
          // to give. Nothing analysed that business, and writing 「你需要报价单，
          // 因为你先报价」 would be the one kind of fabrication the fallback
          // exists to avoid. The reveal renders a module with no reason as a
          // plain name, which is the honest rendering.
          why: z.string(),
        }),
      )
      .min(1),
  })
  // Clamped rather than rejected. An index one past the end is a trivially
  // recoverable mistake, and throwing away an otherwise-good analysis over it
  // would trade a small blemish for a total failure -- exactly the wrong
  // trade for the first thing a prospective customer sees.
  .transform((value) => {
    const stage = (s: string) => (s.length > STAGE_MAX_CHARS ? s.slice(0, STAGE_MAX_CHARS) : s);
    const after_workflow = value.after_workflow.map(stage);
    return {
      ...value,
      before_workflow: value.before_workflow.map(stage),
      after_workflow,
      focus_stage_index: Math.min(
        Math.max(0, value.focus_stage_index),
        after_workflow.length - 1,
      ),
      modules: normalizeModules(value.modules),
    };
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
      modules: {
        type: "array",
        minItems: 4,
        maxItems: 8,
        description:
          "The pages this business's system should be made of. Choose ONLY from the catalogue in the user message. Include the three always-on modules so you can name them in this business's own words.",
        items: {
          type: "object",
          properties: {
            key: {
              type: "string",
              enum: [...MODULE_KEYS],
              description: "A key from the catalogue. Never invent one.",
            },
            label: {
              type: "string",
              description:
                "What THIS business calls it, 2-4 characters. A SIM-card master dealer calls customers 经销商, a salon calls them 顾客. Use the catalogue's own label when the business has no special word.",
            },
            why: {
              type: "string",
              description:
                "One line, under 24 characters, on why this business specifically needs it. Reference something the owner actually told you.",
            },
          },
          required: ["key", "label", "why"],
          additionalProperties: false,
        },
      },
    },
    required: [
      "bottlenecks",
      "before_workflow",
      "after_workflow",
      "focus_stage_index",
      "summary",
      "modules",
    ],
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
  industry: { slug?: string; name_zh: string; name_en: string; default_workflow: string[] },
  language: "zh" | "en",
): AnalysisPayload {
  // The trade's standard set, with no `why` lines -- because nothing reasoned
  // about this business, and inventing a reason ("你需要报价单，因为你先报价")
  // would be the one kind of fabrication this fallback exists to avoid. The
  // reveal renders a module with no reason as a plain name, which is honest.
  const modules = defaultRecommendations(industry.slug);
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
      modules,
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
    modules,
  };
}

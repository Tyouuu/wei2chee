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
    // The same two fields again, in English. NOT decoration: the system
    // this business gets is BUILT in English by default while the owner
    // answers and reads in Chinese (migration 20260822060000), so without
    // these the tailored workflow and the one-line summary -- the two
    // things that make a first screen read as "it understood my business"
    // -- are the exact parts that get thrown away.
    after_workflow_en: z.array(z.string().min(1)).min(1).max(6),
    focus_stage_index: z.number().int(),
    summary: z.string().min(1),
    summary_en: z.string().min(1),
    // What the system should be MADE of. Until 2026-08-21 the model had no
    // field for this at all: it analysed the business in detail and then had
    // no say in what was built, because page count came from a SQL CASE over
    // eight industry slugs. See lib/portal/module-catalog.ts.
    modules: z
      .array(
        z.object({
          key: z.enum(MODULE_KEYS as [string, ...string[]]),
          label: z.string().min(1),
          // The business's own noun in English -- what the page is headed
          // in the default system. A master dealer's customers are Dealers,
          // not Customers. Snake_case here because this is the WIRE shape the
          // model returns, matching `label_en` in analysisJsonSchema below;
          // normalizeModules is what turns it into the camelCase field the
          // rest of the codebase reads.
          label_en: z.string().min(1),
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

    /**
     * WHERE A WEBSITE ENQUIRY BECOMES A RECORD, AND WHAT IT ASKS.
     *
     * The founder, on being told an enquiry becomes a 报价单: 「你应该想到更多
     * 方面就是可能别的行业是不用这个报价单的呢？我不是只做一个行业呢？」. He was
     * right about more than he said. Three things were wrong at once:
     *
     *   1. WHICH PAGE was decided by the ORDER of a hard-coded array
     *      (`["quotations","bookings","orders","projects"].find`). A wholesaler
     *      has both quotations and orders, so it always landed in quotations --
     *      but a wholesaler doing repeat business off its own site is taking
     *      ORDERS. An array's order was answering a question about a business.
     *   2. SOME TRADES TAKE NO ENQUIRIES AT ALL. A kopitiam, a grocery, a car
     *      wash: customers walk in. Promising them 「你的询价会变成一张单」 buys
     *      an inbox that stays empty for a month, which does not read as "no
     *      enquiries yet" -- it reads as a product that is broken. Hence
     *      "none", and a shopfront page instead of a form.
     *   3. WHAT THE FORM ASKED was identical across all eight industries, under
     *      a placeholder reading "3-room renovation, roughly how much?" -- shown
     *      to salons, clinics and workshops. That one is the most damaging,
     *      because it contradicts the only thing this product claims.
     *
     * The model is the only thing in the pipeline that knows the answer: it has
     * already read the business and already chosen its modules. It picks from a
     * closed list, exactly like `modules` -- see the note at the top of
     * lib/portal/module-catalog.ts for why this product never lets an LLM
     * invent a key.
     */
    enquiry: z.object({
      /** A module key this analysis actually chose, or "none". Validated
       *  against the chosen modules in the transform below, because a key that
       *  is real but absent from THIS system is a link to a page that does not
       *  exist. */
      lands_in: z.string(),
      /** What the form asks. Capped at four: every extra field on a
       *  landing-page form costs replies, which is enquiry-form.tsx's own
       *  note and the reason this is not "as many as you like". */
      fields: z
        .array(
          z.object({
            label: z.string().min(1),
            label_en: z.string().min(1),
            kind: z.enum(["text", "phone", "email", "date", "long"]),
          }),
        )
        .max(4),
    }),
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
      // English words are longer than Chinese ones for the same idea, so
      // the character cap that keeps a Chinese stage from becoming a
      // sentence would truncate ordinary English mid-word. These are
      // capped by the schema's own maxItems and left alone here.
      after_workflow_en: value.after_workflow_en.map((s) => s.trim()),
      focus_stage_index: Math.min(
        Math.max(0, value.focus_stage_index),
        after_workflow.length - 1,
      ),
      modules: normalizeModules(value.modules),
      enquiry: normalizeEnquiry(value.enquiry, normalizeModules(value.modules)),
    };
  });

/** Page types an enquiry can honestly become. A stranger filling in a form on a
 *  business's website is starting a job, a booking, an order or a conversation
 *  -- never a payment record or a stock count, and a model that says so is
 *  corrected rather than believed. */
const ENQUIRY_TARGETS = ["quotations", "bookings", "orders", "projects", "customers"];

/**
 * Keeps the model's answer inside what this system can actually deliver.
 *
 * Three corrections, each for a failure that would reach a paying customer:
 *
 *   - A target this business does not HAVE is a link to a page that does not
 *     exist. Falls back to the first target it does have, in the order above --
 *     the same order as before, but now only as a LAST resort rather than as
 *     the whole decision.
 *   - No usable target at all means no arrow. "none" is a real answer here, not
 *     a failure: see the note on the schema field.
 *   - No fields means the generic three, because a form with no questions is
 *     worse than a form with ordinary ones.
 */
function normalizeEnquiry(
  raw: { lands_in: string; fields: { label: string; label_en: string; kind: string }[] },
  modules: ReturnType<typeof normalizeModules>,
) {
  const has = new Set(modules.map((m) => m.key));
  const asked = raw.lands_in?.trim();
  const landsIn =
    asked === "none"
      ? "none"
      : asked && ENQUIRY_TARGETS.includes(asked) && has.has(asked)
        ? asked
        : (ENQUIRY_TARGETS.find((k) => has.has(k)) ?? "none");

  return {
    lands_in: landsIn,
    fields: raw.fields?.length ? raw.fields.slice(0, 4) : [],
  };
}

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
      after_workflow_en: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        description:
          "after_workflow again in English, same stages in the same order. One or two words each -- these are column headings in a system, not sentences.",
        items: { type: "string", description: "A stage name, 1-2 words." },
      },
      focus_stage_index: {
        type: "integer",
        description:
          "0-based index into after_workflow naming the stage this business should fix first.",
      },
      summary: { type: "string", description: "One sentence, under 50 characters." },
      summary_en: {
        type: "string",
        description:
          "summary again in English, about the same business. One sentence, under 90 characters.",
      },
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
            label_en: {
              type: "string",
              description:
                "The same noun in English, one or two words. A master dealer's customers are Dealers; a salon's are Clients; a tuition centre's are Parents. Use the catalogue's own English label when the business has no special word.",
            },
            why: {
              type: "string",
              description:
                "One line, under 24 characters, on why this business specifically needs it. Reference something the owner actually told you.",
            },
          },
          required: ["key", "label", "label_en", "why"],
          additionalProperties: false,
        },
      },
      enquiry: {
        type: "object",
        description:
          "What happens when a stranger fills in the form on this business's own website.",
        properties: {
          lands_in: {
            type: "string",
            enum: [...ENQUIRY_TARGETS, "none"],
            description:
              "Which page of THIS system a website enquiry becomes a row in. It must be one of the modules you chose above. Choose by how this trade actually wins work: a renovation contractor quotes, so quotations; a salon or clinic books a time, so bookings; a shop or wholesaler taking repeat orders from its own site, so orders. Answer \"none\" when this trade does not take enquiries through a website at all -- a kopitiam, a grocery, a car wash, anywhere customers simply walk in. \"none\" is a real answer and is better than an inbox that never fills.",
          },
          fields: {
            type: "array",
            minItems: 0,
            maxItems: 4,
            description:
              "What the form asks, in the order it asks. Name and phone are almost always the first two. The rest must be what THIS trade needs to reply with a price or a time: a workshop needs the car and the problem, a clinic needs the service and a preferred time, a wholesaler needs the company and what goods. Empty when lands_in is \"none\".",
            items: {
              type: "object",
              properties: {
                label: { type: "string", description: "The question, in Chinese, 2-6 characters." },
                label_en: { type: "string", description: "The same question in English, 1-4 words." },
                kind: {
                  type: "string",
                  enum: ["text", "phone", "email", "date", "long"],
                  description:
                    "How it is typed. `long` is a multi-line box, for the one question that needs a sentence.",
                },
              },
              required: ["label", "label_en", "kind"],
              additionalProperties: false,
            },
          },
        },
        required: ["lands_in", "fields"],
        additionalProperties: false,
      },
    },
    required: [
      "bottlenecks",
      "before_workflow",
      "after_workflow",
      "after_workflow_en",
      "focus_stage_index",
      "summary",
      "summary_en",
      "modules",
      "enquiry",
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
  // The fallback cannot know this trade's real questions -- nothing analysed it
  // -- so it asks the three every business asks and lands them in the first
  // sell-side page the trade actually has. Generic but never WRONG, which is
  // the standard the rest of this fallback holds itself to. It never answers
  // "none": refusing a business its enquiry form on no evidence would be a
  // fabrication in the other direction.
  const enquiry = {
    lands_in:
      ENQUIRY_TARGETS.find((k) => modules.some((m) => m.key === k)) ?? "none",
    fields: [
      { label: "称呼", label_en: "Your name", kind: "text" as const },
      { label: "电话", label_en: "Phone / WhatsApp", kind: "phone" as const },
      { label: "想做什么", label_en: "What do you need?", kind: "long" as const },
    ],
  };
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
      // `industries.default_workflow` is stored in English already, so the
      // fallback needs no second list -- the stages ARE the English ones.
      after_workflow_en: stages,
      focus_stage_index: 0,
      summary: `${industry.name_zh}的日常运作大多还靠人记，把记录集中起来是第一步。`,
      summary_en: `Most of this ${industry.name_en} business still runs on memory; centralising records is step one.`,
      modules,
      enquiry,
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
    after_workflow_en: stages,
    focus_stage_index: 0,
    summary: `Most of this ${industry.name_en} business still runs on memory; centralising records is step one.`,
    summary_en: `Most of this ${industry.name_en} business still runs on memory; centralising records is step one.`,
    modules,
    enquiry,
  };
}

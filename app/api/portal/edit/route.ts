import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSessionUser } from "@/lib/supabase/server-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  applyLayoutOps,
  describeLayout,
  layoutOpsSchema,
  EDITABLE_TEXT_FIELDS,
  REGISTERED_COMPONENTS,
  type PuckLayout,
} from "@/lib/portal/layout-ops";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Conversational editing: the customer says what they want changed, in their
 * own words, and the page changes.
 *
 * This is the feature that separates "a drag-and-drop tool" from "an AI system
 * builder". A Malaysian SME owner may never have used a page builder and will
 * not reliably discover that a table's columns are edited through a panel on
 * the right -- but every one of them can say "加一个记录客人生日的地方". Durable
 * and Framer both converged on the same shape: keep the visual editor, and put a
 * conversational path beside it rather than instead of it.
 *
 * The model never sees or writes layout JSON. It reads a compact outline of the
 * page and emits operations against a strict schema, which
 * lib/portal/layout-ops.ts applies deterministically -- see that file for why
 * that boundary is the whole reliability story.
 *
 * NOTHING IS PERSISTED HERE. The edited layout goes back to the browser and
 * into Puck's own state, exactly as a drag would. Saving still goes through
 * save_project_page and its paid gate, so this route cannot become a way around
 * payment, and a customer can undo an AI edit with the same undo button that
 * undoes everything else.
 */

const SYSTEM_PROMPT = `You edit a small-business system's page layout by emitting operations.

You are given a list of the blocks currently on the page. Each line has an
\`id\`, a \`type\`, and its current text. Return operations that carry out the
owner's request, and nothing more.

Rules:
- Only ever use an \`id\` that appears in the page listing. Never invent one.
- Only ever name a component from the allowed list. Never invent one.
- Prefer editing existing blocks over adding new ones. An owner asking to
  "record customer birthdays" usually wants a column renamed or a field added,
  not a second table.
- Make the smallest change that satisfies the request. Do not tidy, reword or
  improve anything you were not asked about.
- Write all text in the same language the owner used.
- If the request cannot be carried out with the available operations, return an
  empty operations list and say so plainly in the explanation.
- explanation: ONE sentence, in the owner's language, saying what you changed.`;

export async function POST(req: NextRequest) {
  // Editing is a signed-in action. Not gated on `paid`: an unpaid customer is
  // explicitly allowed to explore and shape their design -- the gate is on
  // SAVING it (save_project_page), which is where it belongs.
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Every call here spends OpenAI credit, and the button that triggers it sits
  // in front of an UNPAID customer by design (exploring the design is free,
  // saving it is not). Without a cap, one bored visitor holding down Enter is a
  // direct, unbounded bill. Keyed on the account rather than the IP, because
  // this route is authenticated -- the identity that matters is whose editor it
  // is, not which network they are on.
  //
  // 40/hour is deliberately generous: a customer genuinely shaping their system
  // in one sitting should never meet this, and someone who does is not editing.
  const supabase = createServerSupabaseClient();
  const rate = await checkRateLimit(supabase, `edit:${user.id}`, {
    limit: 40,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: "rate limit exceeded" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const { layout, instruction } = (body ?? {}) as {
    layout?: PuckLayout;
    instruction?: string;
  };

  if (!layout || !Array.isArray(layout.content) || typeof instruction !== "string") {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const trimmed = instruction.trim();
  if (!trimmed) return NextResponse.json({ error: "empty instruction" }, { status: 400 });
  // A cap, not a validation: long pasted essays cost tokens and produce worse
  // operations than a sentence does.
  if (trimmed.length > 500) {
    return NextResponse.json({ error: "instruction too long" }, { status: 400 });
  }

  const userPrompt = `Blocks currently on this page:
${describeLayout(layout)}

Components you may add: ${REGISTERED_COMPONENTS.join(", ")}
Text fields you may set: ${EDITABLE_TEXT_FIELDS.join(", ")}

The business owner asked:
"${trimmed}"`;

  let parsed;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      reasoning_effort: "high",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_schema", json_schema: EDIT_JSON_SCHEMA },
    });
    parsed = layoutOpsSchema.parse(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
  } catch (err) {
    console.error("layout edit failed", err);
    // No fallback here, unlike /api/analyze. Guessing at an edit nobody asked
    // for is worse than saying "I did not understand that" -- the customer's
    // design is already on screen and unharmed, and they can rephrase.
    return NextResponse.json({ error: "edit failed" }, { status: 502 });
  }

  const result = applyLayoutOps(layout, parsed.operations);

  return NextResponse.json({
    layout: result.layout,
    explanation: parsed.explanation,
    applied: result.applied,
    skipped: result.skipped,
  });
}

/**
 * The strict schema sent to OpenAI. Written out rather than derived from the
 * Zod union because structured outputs need every branch's fields listed as
 * `required` with nullable types for the optional ones -- a generated schema
 * that silently drops a constraint is exactly the failure this endpoint is
 * built to avoid.
 */
const EDIT_JSON_SCHEMA = {
  name: "layout_edit",
  strict: true,
  schema: {
    type: "object",
    properties: {
      operations: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          properties: {
            op: {
              type: "string",
              enum: [
                "set_text",
                "add_component",
                "remove_component",
                "add_table_row",
                "set_workflow",
              ],
            },
            target_id: { type: ["string", "null"] },
            field: { type: ["string", "null"], enum: [...EDITABLE_TEXT_FIELDS, null] },
            value: { type: ["string", "null"] },
            component: { type: ["string", "null"], enum: [...REGISTERED_COMPONENTS, null] },
            after_id: { type: ["string", "null"] },
            title: { type: ["string", "null"] },
            primary: { type: ["string", "null"] },
            secondary: { type: ["string", "null"] },
            amount: { type: ["string", "null"] },
            status_label: { type: ["string", "null"] },
            status_tone: {
              type: ["string", "null"],
              enum: ["positive", "warning", "negative", "neutral", null],
            },
            stages: { type: ["array", "null"], items: { type: "string" } },
          },
          required: [
            "op",
            "target_id",
            "field",
            "value",
            "component",
            "after_id",
            "title",
            "primary",
            "secondary",
            "amount",
            "status_label",
            "status_tone",
            "stages",
          ],
          additionalProperties: false,
        },
      },
      explanation: { type: "string" },
    },
    required: ["operations", "explanation"],
    additionalProperties: false,
  },
} as const;

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
  type PageSuggestion,
  type PuckLayout,
} from "@/lib/portal/layout-ops";
import { COLUMN_KINDS } from "@/lib/portal/table-model";
import { buildDesignDoc, preferredVariants } from "@/lib/portal/design-doc";

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
  "record customer birthdays" usually wants a column added to the existing
  table, not a second table.
- Make the smallest change that satisfies the request. Do not tidy, reword or
  improve anything you were not asked about.
- Write all text in the same language the owner used.
- explanation: ONE sentence, in the owner's language, saying what you changed.

Look (款式):
- Some blocks list \`variant=<id> options=[id:"name" ...]\`. That is the block's
  current look and the looks it can be switched to. set_variant changes it.
- Blocks you ADD already arrive in this customer's style. Do not follow an
  add_component with a set_variant; you have no id for a block you just made.
- Do not restyle blocks the owner did not ask about.
- When the owner asks for a look ("表格太挤了", "改成隔行底色"), set_variant is
  the operation, not add/remove.

Record tables:
- Each table lists its columns as \`key:"label"(type)\`. Use the KEY to target a
  column; it is an internal identifier the owner never sees.
- add_table_column adds a column and gives every existing row a blank cell for
  it. Pick column_kind by what the column holds: 文字 = text, 说明 = a longer
  secondary description, 金额 = money (right-aligned), 状态 = a status with a
  colour. Most new columns are 文字.
- set_table_column renames a column (and can change its type).
- remove_table_column deletes a column and its cells. A table must keep at
  least one column.
- add_table_row's \`cells\` is POSITIONAL: cells[0] is the first column listed,
  cells[1] the second, and so on. Supply one string per column, in that order.

Whole pages:
- You cannot add or delete a page yourself, but you can OFFER to. When the
  owner asks for one, return an empty operations list and set \`suggestion\`:
    * adding -> action "add_page", page_title = the owner's own name for it.
      Also set page_key if one of these built-in types is clearly what they
      mean, so the page arrives with real sample data:
      customers, quotations, projects, payments, bookings, orders.
      Otherwise leave page_key null and a blank custom page is created.
    * deleting -> action "remove_page", page_key = the key of an EXISTING page
      from the page list you were given. Never the dashboard.
  Write the explanation as an offer in the owner's language, e.g.
  「我可以帮你加一页「员工排班」」. Do not tell them to go and do it themselves.
- Set suggestion.action to "none" for every other request.

If a request genuinely cannot be carried out, return an empty operations list
and say so plainly in one sentence. Do not apologise and do not offer to do it
later.`;

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
  const { layout, instruction, pages } = (body ?? {}) as {
    layout?: PuckLayout;
    instruction?: string;
    /** The customer's own page list, so「把报价单那一页删掉」can name a real page
     *  instead of being told the page does not exist. Sent by the client rather
     *  than re-queried here because the editor already has it, and it is only
     *  ever used to constrain a suggestion, never to authorise anything -- the
     *  RPC the button calls resolves the project from auth.uid() itself. */
    pages?: { key: string; label: string }[];
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

  // The customer's own 版式 and 配色, resolved from their session rather than
  // sent by the browser. Absent for a project that has not reached 风格选择 --
  // buildDesignDoc returns null and the prompt simply carries no brief, which
  // is the behaviour every call had before this existed.
  const { data: project } = await supabase
    .from("projects")
    .select("style, palette")
    .eq("account_id", user.id)
    .single();
  const designDoc = buildDesignDoc(project?.style, project?.palette);

  const pageList = (Array.isArray(pages) ? pages : [])
    .map((p) => `${p.key} ("${p.label}")`)
    .join(", ");

  const userPrompt = `Blocks currently on this page:
${describeLayout(layout)}

Components you may add: ${REGISTERED_COMPONENTS.join(", ")}
Text fields you may set: ${EDITABLE_TEXT_FIELDS.join(", ")}
Pages in this system: ${pageList || "(unknown)"}

${designDoc ? `
${designDoc}
` : ""}
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

  const result = applyLayoutOps(layout, parsed.operations, preferredVariants(project?.style));

  return NextResponse.json({
    layout: result.layout,
    explanation: parsed.explanation,
    applied: result.applied,
    skipped: result.skipped,
    suggestion: resolveSuggestion(parsed.suggestion, Array.isArray(pages) ? pages : []),
  });
}

/** Page types `add_project_page` knows how to build. Mirrors the same list in
 *  the RPC and in add-page-dialog.tsx; `dashboard` is excluded because every
 *  system already has one. */
const KNOWN_PAGE_TYPES = ["customers", "quotations", "projects", "payments", "bookings", "orders"];

/**
 * Turns the model's proposal into something the button can act on, or into
 * nothing.
 *
 * Everything here is a reality check, not a permission check -- the RPC behind
 * the button resolves the project from `auth.uid()` and refuses to delete the
 * dashboard on its own, so nothing below is what stops a bad write. What it
 * stops is a BUTTON THAT FAILS: an offer to delete a page the customer does not
 * have, or to add a page type that does not exist, is worse than no offer,
 * because they have to press it to find out.
 */
function resolveSuggestion(
  suggestion: PageSuggestion | null | undefined,
  pages: { key: string; label: string }[],
): { action: "add_page" | "remove_page"; pageKey: string | null; title: string; label: string } | null {
  if (!suggestion || suggestion.action === "none") return null;

  if (suggestion.action === "add_page") {
    const key = suggestion.page_key && KNOWN_PAGE_TYPES.includes(suggestion.page_key)
      ? suggestion.page_key
      : null;
    const title = (suggestion.page_title ?? "").trim().slice(0, 24);
    // A custom page is created from its title, so without one there is nothing
    // to create. A known type can carry an empty title -- it takes its label
    // from the trade's own vocabulary, as it always has.
    if (!key && !title) return null;
    // Already there: adding it again is a no-op in the RPC, so offering it
    // would be a button that visibly does nothing.
    if (key && pages.some((p) => p.key === key)) return null;
    return { action: "add_page", pageKey: key, title, label: title || "新页面" };
  }

  const target = pages.find((p) => p.key === suggestion.page_key);
  if (!target || target.key === "dashboard") return null;
  return { action: "remove_page", pageKey: target.key, title: target.label, label: target.label };
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
                "add_table_column",
                "remove_table_column",
                "set_table_column",
                "set_workflow",
                "set_variant",
              ],
            },
            target_id: { type: ["string", "null"] },
            field: { type: ["string", "null"], enum: [...EDITABLE_TEXT_FIELDS, null] },
            value: { type: ["string", "null"] },
            component: { type: ["string", "null"], enum: [...REGISTERED_COMPONENTS, null] },
            after_id: { type: ["string", "null"] },
            title: { type: ["string", "null"] },
            column_key: { type: ["string", "null"] },
            column_label: { type: ["string", "null"] },
            column_kind: { type: ["string", "null"], enum: [...COLUMN_KINDS, null] },
            cells: { type: ["array", "null"], items: { type: "string" } },
            status_tone: {
              type: ["string", "null"],
              enum: ["positive", "warning", "negative", "neutral", null],
            },
            stages: { type: ["array", "null"], items: { type: "string" } },
            // Not enum-constrained: the valid ids depend on the block being
            // targeted, which the model reads off that block's own
            // options=[...] listing. A wrong id is dropped by set_variant with
            // a reason, never applied to the wrong block.
            variant_id: { type: ["string", "null"] },
          },
          required: [
            "op",
            "target_id",
            "field",
            "value",
            "component",
            "after_id",
            "title",
            "column_key",
            "column_label",
            "column_kind",
            "cells",
            "status_tone",
            "stages",
            "variant_id",
          ],
          additionalProperties: false,
        },
      },
      explanation: { type: "string" },
      // Always present, usually "none". A separate field rather than another
      // operation because it is a proposal the customer confirms, not a change
      // this route makes -- see pageSuggestionSchema for why that line is where
      // it is.
      suggestion: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["add_page", "remove_page", "none"] },
          page_title: { type: ["string", "null"] },
          page_key: { type: ["string", "null"] },
        },
        required: ["action", "page_title", "page_key"],
        additionalProperties: false,
      },
    },
    required: ["operations", "explanation", "suggestion"],
    additionalProperties: false,
  },
} as const;

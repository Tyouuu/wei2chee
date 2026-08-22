import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  analysisSchema,
  analysisJsonSchema,
  fallbackAnalysis,
  type AnalysisPayload,
} from "@/lib/openai/analysis-schema";
import { catalogForPrompt, MAX_MODULES } from "@/lib/portal/module-catalog";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * The instruction that does not change between businesses. Splitting the
 * unchanging rules out of the per-request prompt is the first thing that makes
 * an LLM's output stable: the model sees the same constraints in the same
 * position every time, and the only thing that varies is the data.
 *
 * The rules are written as hard limits with numbers, not as adjectives. "Keep
 * it short" produces a different length every call; "under 12 characters"
 * produces the same length every call.
 */
const SYSTEM_PROMPT = `You analyse small businesses in Malaysia and return structured findings.

Hard rules, which override anything the business owner's answers imply:
- Write in the requested language ONLY. Never mix languages inside one field.
- Bottleneck titles: 6-12 characters. Name the problem, do not describe it.
- Bottleneck descriptions: ONE sentence, under 40 characters.
- Workflow stage names: 2-4 characters each. They are column headings in a
  system, not sentences.
- after_workflow must be a REAL improvement on before_workflow, not a rename.
  If the workflow is already sound, return it unchanged rather than inventing
  stages that add no value.
- summary: ONE sentence, under 50 characters, about THIS business.
- Never invent specifics (names, amounts, dates) the owner did not give you.

Choosing this business's modules -- the pages their system will be built from:
- Choose ONLY keys from the catalogue in the user message. Never invent a key.
- Choose what this business RUNS ON, not what would be nice. A business that
  does not send quotations must not get 报价单; one whose whole month ends in a
  reconciliation against an upstream statement must get 对账.
- Fewer, correct modules beat more. ${MAX_MODULES} is the hard ceiling and most
  businesses need five or six.
- "label" is the business's OWN noun, 2-4 characters. A SIM-card master dealer's
  customers are 经销商, a salon's are 顾客, a tuition centre's are 家长.
- "label_en" is that same noun in English, one or two words: Dealers, Clients,
  Parents. It is what the page is actually HEADED, because the system is built
  in English by default -- so a lazy "Customers" here costs the business its
  own vocabulary on every screen.
- "why" must reference something the owner actually told you, under 24
  characters. If you cannot tie it to their answers, do not choose that module.`;

/** Retried once, then the deterministic fallback. Two attempts is the right
 *  number here: a transient failure almost always clears on the second call,
 *  and a third attempt only adds latency to a visitor who is already waiting
 *  on a screen that promised them an answer. */
const MAX_ATTEMPTS = 2;

type Industry = {
  slug: string;
  name_zh: string;
  name_en: string;
  default_workflow: string[];
  suggested_modules: string[];
  labels: { customer: string; order: string; staff: string };
};

function buildUserPrompt(
  industry: Industry,
  language: "zh" | "en",
  answers: Record<string, string>,
): string {
  return `Business type: ${industry.name_en}
This industry's own vocabulary: customer = "${industry.labels.customer}", order = "${industry.labels.order}", staff = "${industry.labels.staff}".
Typical workflow for this industry: ${JSON.stringify(industry.default_workflow)}
Modules this industry usually needs: ${JSON.stringify(industry.suggested_modules)}

What the owner told us:
${Object.entries(answers)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

Respond in ${language === "zh" ? "Chinese" : "English"}.
The three _en fields (summary_en, after_workflow_en, label_en) are ALWAYS in
English regardless of the language above. They are not a translation exercise:
the owner reads the analysis in their language, and the SYSTEM those fields
build is read by their staff, their customers and LHDN. Write them as Malaysian
business English -- the words this owner's own quotation would use.
Use the industry's own vocabulary above for stage names where it fits -- these
stage names become the column headings in the system this owner will be shown
next, so they must read like something they would write themselves.

MODULE CATALOGUE -- the only pages that can be built. Choose this business's set:
${catalogForPrompt()}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { industryId, language, answers } = body as {
    industryId: string;
    language: "zh" | "en";
    answers: Record<string, string>;
  };

  if (!industryId || !language || !answers) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const identifier = req.headers.get("x-forwarded-for") ?? "unknown";

  const rateLimit = await checkRateLimit(supabase, identifier);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate limit exceeded" }, { status: 429 });
  }

  const { data: industry, error: industryError } = await supabase
    .from("industries")
    .select("*")
    .eq("id", industryId)
    .single();
  if (industryError || !industry) {
    return NextResponse.json({ error: "unknown industry" }, { status: 400 });
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({ industry_id: industryId, language, answers })
    .select()
    .single();
  if (leadError || !lead) {
    return NextResponse.json({ error: "failed to save lead" }, { status: 500 });
  }

  const userPrompt = buildUserPrompt(industry as Industry, language, answers);

  let parsed: AnalysisPayload | null = null;
  let rawResponse: unknown = null;
  let usedFallback = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !parsed; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-5.6-luna",
        reasoning_effort: "high",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
          // On the retry, the model is told what went wrong. A bare retry
          // re-rolls the same dice; a retry carrying the failure is a
          // different, better-informed call.
          ...(attempt > 1
            ? [
                {
                  role: "user" as const,
                  content:
                    "Your previous response did not satisfy the schema. Return ONLY valid JSON matching the schema exactly, obeying every character limit in the system message.",
                },
              ]
            : []),
        ],
        response_format: { type: "json_schema", json_schema: analysisJsonSchema },
      });

      const raw = completion.choices[0]?.message?.content;
      rawResponse = JSON.parse(raw ?? "{}");
      parsed = analysisSchema.parse(rawResponse);
    } catch (err) {
      // Logged with the attempt number so a recurring failure at attempt 1
      // that always clears at attempt 2 is distinguishable from a total
      // outage -- they need different responses from us.
      console.error(`analysis attempt ${attempt}/${MAX_ATTEMPTS} failed`, err);
    }
  }

  if (!parsed) {
    // Deliberately NOT a 502. See fallbackAnalysis's own comment: a visitor who
    // has just answered a page of questions about their business is at the
    // most expensive possible moment to show an error screen, and a model
    // being briefly unavailable is a routine event. They get a real, honest,
    // industry-accurate analysis built from the industries table instead.
    parsed = fallbackAnalysis(industry as Industry, language);
    rawResponse = { fallback: true };
    usedFallback = true;
  }

  const { data: analysisRow, error: analysisError } = await supabase
    .from("analysis_results")
    .insert({
      lead_id: lead.id,
      raw_llm_response: rawResponse,
      bottlenecks: parsed.bottlenecks,
      before_workflow: parsed.before_workflow,
      after_workflow: parsed.after_workflow,
      // The English twins of the two tailored fields. The system this owner is
      // about to be shown is BUILT in English by default while they answered
      // in Chinese (migration 20260822060000), so without these the workflow
      // and the summary -- the two things that prove the questionnaire was
      // read -- are exactly what gets dropped on the way in.
      after_workflow_en: parsed.after_workflow_en,
      summary: parsed.summary,
      summary_en: parsed.summary_en,
      modules: parsed.modules,
    })
    .select()
    .single();
  if (analysisError || !analysisRow) {
    return NextResponse.json({ error: "failed to save analysis" }, { status: 500 });
  }

  // `usedFallback` is reported so the founder can tell, from logs or from the
  // client, when a lead's analysis was generated rather than reasoned -- those
  // leads are worth a closer look before a sales conversation.
  return NextResponse.json({ leadId: lead.id, analysis: analysisRow, usedFallback });
}

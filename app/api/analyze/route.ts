import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { analysisSchema, analysisJsonSchema } from "@/lib/openai/analysis-schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  const prompt = `You are analyzing a ${industry.name_en} business in Malaysia.
Default workflow for this industry: ${JSON.stringify(industry.default_workflow)}.
Suggested modules: ${JSON.stringify(industry.suggested_modules)}.
The business owner answered:
${Object.entries(answers).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

Identify 2-4 operational bottlenecks, describe their current (before) workflow
and a recommended (after) workflow as short stage-name arrays, and write a
one-sentence summary. Respond in ${language === "zh" ? "Chinese" : "English"}.`;

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      reasoning_effort: "high",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_schema", json_schema: analysisJsonSchema },
    });
  } catch (err) {
    console.error("OpenAI call failed", err);
    return NextResponse.json({ error: "analysis generation failed" }, { status: 502 });
  }

  const raw = completion.choices[0]?.message?.content;
  let parsed;
  try {
    parsed = analysisSchema.parse(JSON.parse(raw ?? "{}"));
  } catch (err) {
    console.error("LLM output failed schema validation", err, raw);
    return NextResponse.json({ error: "analysis generation failed" }, { status: 502 });
  }

  const { data: analysisRow, error: analysisError } = await supabase
    .from("analysis_results")
    .insert({
      lead_id: lead.id,
      raw_llm_response: JSON.parse(raw ?? "{}"),
      bottlenecks: parsed.bottlenecks,
      before_workflow: parsed.before_workflow,
      after_workflow: parsed.after_workflow,
      summary: parsed.summary,
    })
    .select()
    .single();
  if (analysisError || !analysisRow) {
    return NextResponse.json({ error: "failed to save analysis" }, { status: 500 });
  }

  return NextResponse.json({ leadId: lead.id, analysis: analysisRow });
}

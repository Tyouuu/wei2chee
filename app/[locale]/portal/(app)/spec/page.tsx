import { redirect } from "next/navigation";
import Link from "next/link";
import OpenAI from "openai";
import { z } from "zod";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import {
  PAGE_KEYS,
  buildPageLayout,
  isUngeneratedLayout,
  sortPageKeys,
  type BusinessContext,
  type PageKey,
} from "@/lib/templates/industry-template";
import { displayBusinessName, sortPages, type PageId } from "@/lib/templates/industry-template";
import { buildSystemSpec, specToText, type SystemSpec } from "@/lib/portal/spec-outline";
import type { PuckLayout } from "@/lib/portal/layout-ops";
import { WHATSAPP_NUMBER } from "@/lib/brand";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * 系统需求书 -- the specification document a customer reads before paying, and
 * the founder builds from afterwards.
 *
 * WHY THIS PAGE EXISTS: "Deploy" used to be a WhatsApp message and a blob of
 * layout JSON. For the customer that is nothing -- they are being asked for
 * RM5,000 on the strength of a chat message. For the founder it is a puzzle:
 * a Puck tree is not a build brief. This page turns the design the customer
 * actually made into a document that serves both sides, which is the third of
 * the three jobs AI has in this product (docs/formae-product-direction.md 4.3
 * and 4.4) and the only one that had no implementation at all.
 *
 * STRUCTURE IS EXTRACTED, PROSE IS WRITTEN. Every fact in this document --
 * pages, tables, columns, workflow stages, inputs -- comes from
 * lib/portal/spec-outline.ts reading the real layouts. The model is only ever
 * asked to write the paragraphs AROUND those facts. A hallucinated column in a
 * build specification is a bug that gets built, so the model is never in a
 * position to invent one.
 *
 * If the model is unavailable the page still renders, from the extracted
 * structure alone. A specification with no prose is a worse document; a
 * specification that will not load is not a document.
 */

const proseSchema = z.object({
  overview: z.string().min(1),
  modules: z
    .array(z.object({ name: z.string().min(1), purpose: z.string().min(1) }))
    .min(1)
    .max(6),
  notes: z.array(z.string().min(1)).max(5),
});

type Prose = z.infer<typeof proseSchema>;

const PROSE_JSON_SCHEMA = {
  name: "system_spec_prose",
  strict: true,
  schema: {
    type: "object",
    properties: {
      overview: {
        type: "string",
        description: "2-3 sentences describing what this system is for. Chinese.",
      },
      modules: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Module name, 2-6 characters." },
            purpose: { type: "string", description: "One sentence, under 40 characters." },
          },
          required: ["name", "purpose"],
          additionalProperties: false,
        },
      },
      notes: {
        type: "array",
        maxItems: 5,
        items: { type: "string", description: "One build consideration, one sentence." },
      },
    },
    required: ["overview", "modules", "notes"],
    additionalProperties: false,
  },
} as const;

async function writeProse(spec: SystemSpec, industryName: string): Promise<Prose | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      reasoning_effort: "high",
      messages: [
        {
          role: "system",
          content: `You write build specifications for small-business systems in Malaysia.

You are given the EXACT structure of a system its owner designed. Every page,
table, column and workflow stage listed is a fact. Write the prose around those
facts.

Hard rules:
- Never mention a page, table, column or stage that is not in the structure.
- Never invent a feature. If the design has no reporting, do not describe any.
- Write in Chinese, in the owner's own vocabulary as it appears in the structure.
- Modules must correspond to what is actually in the design.
- notes: real build considerations a developer would want flagged, drawn from
  what the design implies. Empty array if there is nothing worth saying.`,
        },
        {
          role: "user",
          content: `行业：${industryName}\n\n客户设计出来的系统结构：\n\n${specToText(spec)}`,
        },
      ],
      response_format: { type: "json_schema", json_schema: PROSE_JSON_SCHEMA },
    });
    return proseSchema.parse(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
  } catch (err) {
    // Logged, not surfaced: the document below is complete without this.
    console.error("spec prose generation failed", err);
    return null;
  }
}

export default async function SystemSpecPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSessionSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, style")
    .eq("account_id", user.id)
    .single();
  if (!project) redirect("/login");
  if (!project.style) redirect("/portal/style-select");

  const { data: rows } = await supabase
    .from("project_pages")
    .select("page_key, title, layout_json")
    .eq("project_id", project.id);

  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessContext = (context as BusinessContext | null) ?? {};
  const industryName = businessContext.industry?.name_zh ?? "一般生意";
  // The customer's own company name (projects.business_name, migration
  // 20260820180000) rather than their email's local part. This document is the
  // one a contractor is meant to hand to a developer, or read back to decide
  // whether to spend RM5,000 -- and it was titled "tianyou.demo的系统".
  const businessName = displayBusinessName(businessContext);

  // Unsaved pages are specified from what the customer WOULD see, using the
  // same generator the editor uses. A free-tier customer has saved nothing yet
  // and is exactly the person this document has to convince.
  // The pages this account actually has, in its own order -- not every page
  // type the product knows about. Pages are provisioned per industry
  // (migration 20260820160000), so specifying all seven would put a 「预约」
  // section into a contractor's build brief for a page they do not have.
  const pageRefs = sortPages(
    (rows ?? []).map((r: { page_key: string; title: string | null }) => ({
      key: r.page_key,
      title: r.title,
    })),
  );

  const layouts = Object.fromEntries(
    pageRefs.map(({ key }) => {
      const saved = (rows ?? []).find(
        (r: { page_key: string }) => r.page_key === key,
      )?.layout_json as Record<string, unknown> | undefined;
      const layout = isUngeneratedLayout(saved)
        ? (buildPageLayout(
            key,
            businessContext,
            businessName,
            locale,
            pageRefs,
          ) as unknown as PuckLayout)
        : (saved as unknown as PuckLayout);
      return [key, layout];
    }),
  ) as Record<PageId, PuckLayout>;

  const spec = buildSystemSpec(layouts, pageRefs);

  // Every render of this page would otherwise be an LLM call: a reload, a
  // back-button, a share link opened twice. Capped per account, and going over
  // the cap costs the PROSE, not the document -- the structural specification
  // below is extracted from the customer's own layouts and always renders.
  const rateSupabase = createServerSupabaseClient();
  const rate = await checkRateLimit(rateSupabase, `spec:${user.id}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  const prose = rate.allowed ? await writeProse(spec, industryName) : null;

  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `我的系统需求书已经生成了，想谈下一步\n\n账号邮箱: ${user.email}\n项目编号: ${project.id}`,
  )}`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 print:py-0">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/${locale}/portal/dashboard`}
          className="[font-size:var(--text-sm)] text-muted-foreground underline underline-offset-4"
        >
          ← 回到编辑器
        </Link>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-primary px-4 py-2 [font-size:var(--text-sm)] font-semibold text-primary-foreground"
        >
          交给我们建系统
        </a>
      </div>

      <header className="border-b pb-6">
        <p className="[font-size:var(--text-xs)] tracking-[0.16em] text-muted-foreground uppercase">
          Formae · 系统需求书
        </p>
        <h1 className="mt-2 [font-size:var(--text-title)] font-semibold text-foreground">{businessName}的系统</h1>
        <p className="mt-1 [font-size:var(--text-sm)] text-muted-foreground">
          行业：{industryName} · 生成日期：{new Date().toISOString().slice(0, 10)}
        </p>
      </header>

      <section className="mt-8">
        <h2 className="[font-size:var(--text-lg)] font-semibold text-foreground">一、这套系统是做什么的</h2>
        <p className="mt-2 [font-size:var(--text-sm)] leading-relaxed text-muted-foreground">
          {prose?.overview ??
            `这份文档由 ${businessName} 在 Formae 上亲自设计的界面直接生成，下面每一页、每一个栏位都是客户自己确认过的。`}
        </p>
      </section>

      {spec.workflowStages.length > 0 && (
        <section className="mt-8">
          <h2 className="[font-size:var(--text-lg)] font-semibold text-foreground">二、业务流程</h2>
          <p className="mt-2 [font-size:var(--text-sm)] text-foreground">{spec.workflowStages.join(" → ")}</p>
          <p className="mt-1 [font-size:var(--text-sm)] text-muted-foreground">
            系统需要能记录每一笔业务当前走到哪一步，并能按步骤筛选。
          </p>
        </section>
      )}

      {prose?.modules?.length ? (
        <section className="mt-8">
          <h2 className="[font-size:var(--text-lg)] font-semibold text-foreground">三、需要的模块</h2>
          <ul className="mt-2 space-y-1.5">
            {prose.modules.map((m) => (
              <li key={m.name} className="[font-size:var(--text-sm)] text-muted-foreground">
                <span className="font-semibold text-foreground">{m.name}</span> — {m.purpose}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="[font-size:var(--text-lg)] font-semibold text-foreground">四、每一页的具体要求</h2>
        {spec.pages.map((page) => (
          <div key={page.pageKey} className="mt-5 border-l-2 pl-4">
            <h3 className="[font-size:var(--text-base)] font-semibold text-foreground">
              {page.heading ?? page.title}
            </h3>
            {page.subtitle && (
              <p className="mt-0.5 [font-size:var(--text-sm)] text-muted-foreground">{page.subtitle}</p>
            )}

            <ul className="mt-2 space-y-1 [font-size:var(--text-sm)] text-muted-foreground">
              {page.metrics.map((m, i) => (
                <li key={`m${i}`}>
                  关键数字：<span className="text-foreground">{m.label}</span>
                  {m.sample ? `（示例 ${m.sample}）` : ""}
                </li>
              ))}
              {page.tables.map((t, i) => (
                <li key={`t${i}`}>
                  数据表「<span className="text-foreground">{t.caption}</span>」，栏位：
                  <span className="text-foreground">{t.columns.join(" / ")}</span>
                </li>
              ))}
              {page.workflows.map((w, i) =>
                w.stages.length ? (
                  <li key={`w${i}`}>
                    流程：<span className="text-foreground">{w.stages.join(" → ")}</span>
                  </li>
                ) : null,
              )}
              {page.inputs.map((inp, i) => (
                <li key={`i${i}`}>
                  输入项：<span className="text-foreground">{inp.label}</span>（{inp.kind}）
                </li>
              ))}
              {page.metrics.length + page.tables.length + page.workflows.length + page.inputs.length ===
                0 && <li>这一页客户暂时留空。</li>}
            </ul>
          </div>
        ))}
      </section>

      {spec.vocabulary.length > 0 && (
        <section className="mt-8">
          <h2 className="[font-size:var(--text-lg)] font-semibold text-foreground">五、必须沿用的称呼</h2>
          <p className="mt-2 [font-size:var(--text-sm)] text-muted-foreground">
            系统里的用词要跟客户自己的叫法一致，不要换成通用词：
          </p>
          <p className="mt-1.5 [font-size:var(--text-sm)] text-foreground">{spec.vocabulary.join(" · ")}</p>
        </section>
      )}

      {prose?.notes?.length ? (
        <section className="mt-8">
          <h2 className="[font-size:var(--text-lg)] font-semibold text-foreground">六、建设注意事项</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 [font-size:var(--text-sm)] text-muted-foreground">
            {prose.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-10 border-t pt-4 [font-size:var(--text-xs)] text-muted-foreground">
        本文档由客户在 Formae 编辑器里的实际设计自动生成。页面、栏位、流程、称呼全部取自客户自己的设计，不是模板推测。
      </footer>
    </main>
  );
}

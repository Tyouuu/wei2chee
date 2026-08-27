import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
import { tradeLabel } from "@/lib/templates/industry-template";
import type { PuckLayout } from "@/lib/portal/layout-ops";
import { WHATSAPP_NUMBER } from "@/lib/brand";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAiUsage } from "@/lib/portal/ai-usage";
import { AI_MODEL, AI_REASONING_EFFORT } from "@/lib/portal/ai-model";
import { checkRateLimit } from "@/lib/rate-limit";
import chrome from "../../chrome.module.css";

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

/*
  THE SCHEMA NAMES THE LANGUAGE, SO THE SCHEMA HAS TO BE A FUNCTION OF IT.

  This was a constant whose first field description ended in the word
  「Chinese.」 and whose lengths -- "2-6 characters", "under 40 characters" --
  were counts of Chinese characters. The system prompt above it said 「Write in
  English」. Measured on 2026-08-26: the prose came back Chinese every time,
  which is exactly right of the model. It was handed one line saying English and
  a schema saying Chinese, and a field description sits closer to the field than
  a paragraph of preamble does.

  A length is a language fact too. "2-6 characters" is 收款管理; the same module
  in English is "Payments and collections", and holding it to six would produce
  an abbreviation nobody uses.
*/
const proseJsonSchema = (lang: "zh" | "en") =>
  ({
    name: "system_spec_prose",
    strict: true,
    schema: {
      type: "object",
      properties: {
        overview: {
          type: "string",
          description: `2-3 sentences describing what this system is for. ${
            lang === "zh" ? "Chinese." : "English."
          }`,
        },
        modules: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description:
                  lang === "zh" ? "Module name, 2-6 characters." : "Module name, 1-3 words.",
              },
              purpose: {
                type: "string",
                description:
                  lang === "zh"
                    ? "One sentence, under 40 characters."
                    : "One sentence, under 90 characters.",
              },
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
  }) as const;

/*
  THE CALLER THE LEDGER NEVER KNEW ABOUT.

  ai_usage was built for the two routes under app/api and this one was missed
  -- it is a page, not a route, so nobody adding accounting went looking here.
  It spends the founder's key at the same reasoning effort as the other two,
  and until 2026-08-27 none of it appeared in 「这个功能花我多少钱」.

  Its own surface rather than folded into 'analyze': this runs once per visit
  to the specification, not once per customer, so a single total would hide
  which of the three is actually expensive.
*/
async function writeProse(
  spec: SystemSpec,
  industryName: string,
  /** The document's language, so the prose matches the headings around it. A
   *  specification whose section titles are English and whose paragraphs are
   *  Chinese reads as two documents stapled together.
   *
   *  It also names the language of the FACTS below. Measured 2026-08-26: this
   *  was a one-line instruction sitting on top of forty lines of Chinese
   *  structure (「业务流程」「关键数字」「数据表…栏位」), and the prose came back
   *  Chinese every time. The model was not ignoring the instruction -- it was
   *  following the language of what it was shown. Naming one language while
   *  showing the other is a contradiction, not an instruction. */
  lang: "zh" | "en",
  /* The caller already holds one for its rate-limit check; passed in rather
     than created again so both writes travel on the same session. */
  supabase: SupabaseClient,
): Promise<Prose | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const startedAt = Date.now();
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      reasoning_effort: AI_REASONING_EFFORT,
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
- Write in ${lang === "zh" ? "Chinese" : "English"}, in the owner's own vocabulary as it appears in the structure.
  Keep the owner's OWN words exactly as given -- page headings, column names
  and workflow stages are quoted, never translated. The prose around them is
  what changes language.
- Modules must correspond to what is actually in the design.
- notes: real build considerations a developer would want flagged, drawn from
  what the design implies. Empty array if there is nothing worth saying.`,
        },
        {
          role: "user",
          content:

            lang === "zh"

              ? `行业：${industryName}\n\n客户设计出来的系统结构：\n\n${specToText(spec, "zh")}`

              : `Industry: ${industryName}\n\nThe system this owner designed:\n\n${specToText(spec, "en")}`,
        },
      ],
      response_format: { type: "json_schema", json_schema: proseJsonSchema(lang) },
    });
    /* Before the parse, because a reply that will not parse still cost the
       money. Swallows its own errors -- see recordAiUsage. */
    await recordAiUsage(supabase, "spec", AI_MODEL, completion.usage, {
      tookMs: Date.now() - startedAt,
    });
    return proseSchema.parse(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
  } catch (err) {
    // Logged, not surfaced: the document below is complete without this.
    console.error("spec prose generation failed", err);
    /* A failure here is INVISIBLE to the customer -- the document renders
       without the prose and reads as complete. That is right for them, and it
       means nobody here finds out unless the row exists. */
    await recordAiUsage(supabase, "spec", AI_MODEL, null, {
      outcome: "failed",
      tookMs: Date.now() - startedAt,
    });
    return null;
  }
}

export default async function SystemSpecPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  /*
    THE DOCUMENT FOLLOWS THE INTERFACE LOCALE, not the system language.

    It is Formae's document ABOUT the customer's system, read by the customer
    before paying and by whoever builds it afterwards. What stays in the
    customer's own words is the CONTENT it quotes -- their page headings, their
    column names, their workflow stages -- because that is the whole argument
    of the thing: 「系统里的用词要跟客户自己的叫法一致」.
  */
  const t = await getTranslations({ locale, namespace: "portal.spec" });
  const zh = locale === "zh";

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
  // Not `name_zh`: it is stored as 「装修/承包商」 and this document is read in
  // whichever language its headings are in. tradeLabel already answers that
  // question for the landing pages.
  const industryName = businessContext.industry
    ? tradeLabel(businessContext.industry, zh ? "zh" : "en")
    : t("genericTrade");
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

  const spec = buildSystemSpec(layouts, pageRefs, zh ? "zh" : "en");

  // Every render of this page would otherwise be an LLM call: a reload, a
  // back-button, a share link opened twice. Capped per account, and going over
  // the cap costs the PROSE, not the document -- the structural specification
  // below is extracted from the customer's own layouts and always renders.
  const rateSupabase = createServerSupabaseClient();
  const rate = await checkRateLimit(rateSupabase, `spec:${user.id}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  const prose = rate.allowed
    ? await writeProse(spec, industryName, zh ? "zh" : "en", rateSupabase)
    : null;

  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `我的系统需求书已经生成了，想谈下一步\n\n账号邮箱: ${user.email}\n项目编号: ${project.id}`,
  )}`;

  /*
   * SECTION NUMBERS ARE COUNTED, NOT TYPED.
   *
   * Four of this document's six sections are conditional -- 业务流程 needs
   * workflow stages, 需要的模块 and 建设注意事项 need the AI prose, 必须沿用的称呼
   * needs vocabulary -- and the headings used to hardcode 一 through 六
   * regardless.
   *
   * That is not a cosmetic bug. `writeProse` sits behind checkRateLimit at 10
   * calls an hour, so the eleventh view of the day returns null and the
   * customer opens the document they are being asked to pay RM 5,000 against
   * and reads "一、二、四、五". The only available conclusion is that two
   * sections went missing -- on the single artefact whose entire job is to
   * prove nothing was lost in translation.
   *
   * Counting them makes the document always read 一二三四, however many of
   * them there are.
   */
  /*
    THE NUMERALS FOLLOW THE DOCUMENT'S LANGUAGE.

    「一、二、三」 in an English specification reads as a rendering fault to the
    developer who has to build from it -- and this document's whole job is to
    prove nothing was lost between what the customer designed and what gets
    built.
  */
  const CN = zh
    ? ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]
    : ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
  const sep = zh ? "、" : ". ";
  const hasFlow = spec.workflowStages.length > 0;
  const hasModules = Boolean(prose?.modules?.length);
  const hasVocab = spec.vocabulary.length > 0;
  const hasNotes = Boolean(prose?.notes?.length);
  let seq = 0;
  const nextNo = () => CN[seq++] ?? String(seq);
  // Assigned in document order; a section that is not rendered never takes a
  // number, and every one after it moves up.
  const noPurpose = nextNo();
  const noFlow = hasFlow ? nextNo() : null;
  const noModules = hasModules ? nextNo() : null;
  const noPages = nextNo();
  const noVocab = hasVocab ? nextNo() : null;
  const noNotes = hasNotes ? nextNo() : null;

  return (
    <main
      className={`${chrome.paper} ${chrome.paperSheet} mx-auto my-8 max-w-3xl px-10 py-12 print:my-0 print:max-w-none print:px-0 print:py-0`}
    >
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/${locale}/portal/dashboard`}
          className="[font-size:var(--text-sm)] text-muted-foreground underline underline-offset-4"
        >
          {t("back")}
        </Link>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-primary px-4 py-2 [font-size:var(--text-sm)] font-semibold text-primary-foreground"
        >
          {t("handoff")}
        </a>
      </div>

      <header className="border-b pb-6">
        <p className="[font-size:var(--text-xs)] tracking-[0.16em] text-muted-foreground uppercase">
          {t("brand")}
        </p>
        <h1 className="mt-2 [font-size:var(--text-title)] font-semibold text-foreground">{t("titleOf", { business: businessName })}</h1>
        <p className="mt-1 [font-size:var(--text-sm)] text-muted-foreground">
          {t("meta", { industry: industryName, date: new Date().toISOString().slice(0, 10) })}
        </p>
      </header>

      <section className="mt-8">
        <h2 className="[font-size:var(--text-lg)] font-semibold text-foreground">{noPurpose}{sep}{t("secPurpose")}</h2>
        <p className="mt-2 [font-size:var(--text-sm)] leading-relaxed text-muted-foreground">
          {prose?.overview ??
            t("overviewFallback", { business: businessName })}
        </p>
      </section>

      {hasFlow && (
        <section className="mt-8">
          <h2 className="[font-size:var(--text-lg)] font-semibold text-foreground">{noFlow}{sep}{t("secFlow")}</h2>
          <p className="mt-2 [font-size:var(--text-sm)] text-foreground">{spec.workflowStages.join(" → ")}</p>
          <p className="mt-1 [font-size:var(--text-sm)] text-muted-foreground">
            {t("flowNote")}
          </p>
        </section>
      )}

      {hasModules && prose ? (
        <section className="mt-8">
          <h2 className="[font-size:var(--text-lg)] font-semibold text-foreground">{noModules}{sep}{t("secModules")}</h2>
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
        <h2 className="[font-size:var(--text-lg)] font-semibold text-foreground">{noPages}{sep}{t("secPages")}</h2>
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
                  {t("metric")}: <span className="text-foreground">{m.label}</span>
                  {m.sample ? ` (${t("sample", { v: m.sample })})` : ""}
                </li>
              ))}
              {/* `tbl`, not `t` -- the map parameter was shadowing the
                  translator, which the compiler caught the moment this section
                  started calling t(). */}
              {page.tables.map((tbl, i) => (
                <li key={`t${i}`}>
                  {t("tablePrefix")}
                  <span className="text-foreground">{tbl.caption}</span>
                  {t("tableSuffix")}{" "}
                  <span className="text-foreground">{tbl.columns.join(" / ")}</span>
                </li>
              ))}
              {page.workflows.map((w, i) =>
                w.stages.length ? (
                  <li key={`w${i}`}>
                    {t("flowPrefix")}<span className="text-foreground">{w.stages.join(" → ")}</span>
                  </li>
                ) : null,
              )}
              {page.inputs.map((inp, i) => (
                <li key={`i${i}`}>
                  {t("inputPrefix")}<span className="text-foreground">{inp.label}</span> ({inp.kind})
                </li>
              ))}
              {page.metrics.length + page.tables.length + page.workflows.length + page.inputs.length ===
                0 && <li>{t("emptyPage")}</li>}
            </ul>
          </div>
        ))}
      </section>

      {hasVocab && (
        <section className="mt-8">
          <h2 className="[font-size:var(--text-lg)] font-semibold text-foreground">{noVocab}{sep}{t("secVocab")}</h2>
          <p className="mt-2 [font-size:var(--text-sm)] text-muted-foreground">
            {t("vocabNote")}
          </p>
          <p className="mt-1.5 [font-size:var(--text-sm)] text-foreground">{spec.vocabulary.join(" · ")}</p>
        </section>
      )}

      {hasNotes && prose ? (
        <section className="mt-8">
          <h2 className="[font-size:var(--text-lg)] font-semibold text-foreground">{noNotes}{sep}{t("secNotes")}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 [font-size:var(--text-sm)] text-muted-foreground">
            {prose.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-10 border-t pt-4 [font-size:var(--text-xs)] text-muted-foreground">
        {t("footer")}
      </footer>
    </main>
  );
}

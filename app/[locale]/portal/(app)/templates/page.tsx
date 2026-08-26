import { redirect } from "next/navigation";
import type { Data } from "@puckeditor/core";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";
import { TemplatesClient } from "./templates-client";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { composeSite } from "@/lib/templates/site-composition";
import { ALL_LANDINGS } from "@/lib/templates/all-landings";
import {
  landingContentFor,
  PAGE_KEYS,
  buildPageLayout,
  displayOwnerName,
  pageLabel,
  sortPages,
  systemLangOf,
  tradeLabels,
  type BusinessContext,
} from "@/lib/templates/industry-template";

/**
 * The template library.
 *
 * WHAT A "TEMPLATE" IS HERE, AND WHY THAT IS NOT A STRETCH. This product
 * already knows how to build seven kinds of business page, each one assembled
 * from the customer's own trade vocabulary, workflow and sample records
 * (`lib/templates/industry-template.ts`). Those have always been templates —
 * they were just invisible, offered as a row of unlabelled buttons inside the
 * 加一页 dialog with nothing to look at before committing.
 *
 * So this page does not invent a template system. It renders the one that
 * exists: every page type built WITH THIS CUSTOMER'S OWN CONTEXT, so a
 * contractor previewing 「预约」 sees their own trade's words in it, not a
 * generic mock. That is the difference between choosing from a menu and seeing
 * what you are choosing.
 *
 * Building all seven on every load is cheap — these are pure functions over
 * data already fetched, no LLM call and no write.
 */


export default async function TemplatesPage({
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
    .select("id, style, palette")
    .eq("account_id", user.id)
    .single();

  if (!project) redirect("/login");

  const { data: pageRows } = await supabase
    .from("project_pages")
    .select("page_key, title")
    .eq("project_id", project.id);

  const pageRefs = sortPages(
    (pageRows ?? []).map((r: { page_key: string; title: string | null }) => ({
      key: r.page_key,
      title: r.title,
    })),
  );
  const existing = pageRefs.map((r) => r.key);

  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessContext = (context as BusinessContext | null) ?? {};
  const ownerName = displayOwnerName(
    businessContext,
    user.email?.split("@")[0] || "我",
  );
  const labels = tradeLabels(businessContext);

  const templates = PAGE_KEYS.map((key) => ({
    pageKey: key,
    label: pageLabel({ key }, labels, systemLangOf(businessContext)),
    // `dashboard` is excluded from the "add" action rather than from the
    // gallery: every system already has one, and seeing it here is how a
    // customer understands the set is complete.
    alreadyAdded: existing.includes(key),
    layout: buildPageLayout(
      key,
      businessContext,
      ownerName,
      locale,
      pageRefs,
    ) as unknown as Data,
  }));

  // 官网版面 — six SHAPES for the one page a business's own customers read,
  // as opposed to the gallery above, which is one shape per KIND of page.
  // The distinction is the whole reason this section exists: everywhere else
  // in this product a customer picks WHAT the page is; here they pick what it
  // LOOKS like, which is the thing 21st.dev does and nothing here did.
  //
  // Built with this business's own words, like everything else on this page, so
  // a contractor comparing 现货落单 against 上门报价 is comparing two versions
  // of their own website rather than two mockups.
  const landingContent = landingContentFor(businessContext, pageRefs);
  // Chrome, so the names follow the INTERFACE locale rather than the system
  // language: this is Formae's gallery, not the customer's page. The English is
  // written out on each template -- see the note on labelEn in
  // lib/templates/landing-templates.ts for why it is not machine-translated.
  const zh = locale === "zh";
  const landings = ALL_LANDINGS.map((t) => ({
    key: t.key,
    label: zh ? t.label : t.labelEn,
    blurb: zh ? t.blurb : t.blurbEn,
    /*
      COMPOSED, NOT RAW -- the same call buildWebsite makes.

      Without this the gallery would show six pages in the TEMPLATE's order
      while the page the customer actually gets comes back in the REGISTER's
      order (site-composition.ts, 2026-08-27). A gallery that shows a different
      page from the one it hands over is worse than no gallery: it is the
      product lying about its own output, and the customer finds out after
      choosing.
    */
    layout: {
      root: {},
      content: composeSite(t.build(landingContent), project.style as string | null),
    } as unknown as Data,
  }));

  return (
    <TemplatesClient
      locale={locale}
      landings={landings}
      hasWebsite={existing.includes("website")}
      style={project.style as StyleName}
      palette={(project.palette as string | null) ?? null}
      templates={templates}
      pageCount={pageRefs.length}
    />
  );
}

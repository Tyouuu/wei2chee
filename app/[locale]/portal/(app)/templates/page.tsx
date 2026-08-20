import { redirect } from "next/navigation";
import type { Data } from "@puckeditor/core";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { TemplatesClient } from "./templates-client";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import {
  PAGE_KEYS,
  buildPageLayout,
  displayOwnerName,
  pageLabel,
  sortPages,
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

const FALLBACK_LABELS = { customer: "客户", order: "订单", staff: "员工" };

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
    .select("id, style")
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
  const ownerName = displayOwnerName(businessContext, user.email?.split("@")[0] || "我");
  const labels = businessContext.industry?.labels ?? FALLBACK_LABELS;

  const templates = PAGE_KEYS.map((key) => ({
    pageKey: key,
    label: pageLabel({ key }, labels),
    // `dashboard` is excluded from the "add" action rather than from the
    // gallery: every system already has one, and seeing it here is how a
    // customer understands the set is complete.
    alreadyAdded: existing.includes(key),
    layout: buildPageLayout(key, businessContext, ownerName, locale, pageRefs) as unknown as Data,
  }));

  return (
    <TemplatesClient
      locale={locale}
      style={project.style as StyleName}
      templates={templates}
      pageCount={pageRefs.length}
    />
  );
}

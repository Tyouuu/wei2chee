import { redirect } from "next/navigation";
import type { Data } from "@puckeditor/core";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { StylesClient } from "./styles-client";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { upgradeLayout } from "@/lib/portal/layout-upgrade";
import {
  buildPageLayout,
  displayOwnerName,
  isUngeneratedLayout,
  pageLabel,
  sortPages,
  systemLangOf,
  tradeLabels,
  type BusinessContext,
  type PageKey,
} from "@/lib/templates/industry-template";

/**
 * The style library.
 *
 * WHY IT IS ITS OWN ROUTE. It used to be the third section of a scrolling home
 * page, which meant the control that changes how the customer's entire system
 * looks was something you found by scrolling past your own pages. It is one of
 * the three or four decisions a customer makes about their system; it deserves
 * a destination in the rail, and the rail is what gives it one.
 */
export default async function StylesPage({
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
    .select("id, style, palette, layout")
    .eq("account_id", user.id)
    .single();

  if (!project) redirect("/login");
  if (!project.style) redirect("/portal/style-select");

  /*
    THE CUSTOMER'S OWN PAGES, PLAYED THROUGH — the same reel as the editor's
    style sheet, and for the same reason: 「不能是从dashboard第一页开始」. This page
    was showing a hand-built quotation table with the register's name typed
    into it, which is one artefact from one page, drawn by hand, to somebody
    deciding what their whole system will look like.
  */
  const { data: pageRows } = await supabase
    .from("project_pages")
    .select("page_key, title, sort_order, layout_json")
    .eq("project_id", project.id);

  const pageRefs = sortPages(
    (pageRows ?? []).map(
      (r: { page_key: string; title: string | null; sort_order: number | null }) => ({
        key: r.page_key,
        title: r.title,
        sortOrder: r.sort_order,
      }),
    ),
  );

  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessContext = (context as BusinessContext | null) ?? {};
  const ownerName = displayOwnerName(businessContext, user.email?.split("@")[0] || "我");

  const previewPages = pageRefs.slice(0, 4).map((ref) => {
    const row = (pageRows ?? []).find((r: { page_key: string }) => r.page_key === ref.key);
    const saved = (row?.layout_json as Record<string, unknown>) ?? {};
    const data = isUngeneratedLayout(saved)
      ? (buildPageLayout(
          ref.key as PageKey,
          businessContext,
          ownerName,
          locale,
          pageRefs,
          project.style as string,
          (project.layout as string | null) ?? null,
        ) as unknown as Record<string, unknown>)
      : upgradeLayout(saved);
    return {
      key: ref.key,
      label: pageLabel(ref, tradeLabels(businessContext, pageRefs), systemLangOf(businessContext)),
      data,
    };
  });

  return (
    <StylesClient
      locale={locale}
      style={project.style as StyleName}
      palette={(project.palette as string | null) ?? null}
      previewPages={previewPages as unknown as { key: string; label: string; data: Data }[]}
    />
  );
}

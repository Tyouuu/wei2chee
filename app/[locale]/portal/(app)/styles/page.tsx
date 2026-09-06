import { redirect } from "next/navigation";
import { SITE_PAGE_KEY } from "@/lib/portal/system-register";
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
 * page, which meant the control that changes how his site looks was something
 * you found by scrolling past your own pages. It is one of the three or four
 * decisions a customer makes; it deserves a destination in the rail, and the
 * rail is what gives it one.
 *
 * ⚠️ 2026-09-04 起它只管**一个**画面：客户的官网 `/s/<slug>`。
 * 工作台不再跟着它走（`SYSTEM_REGISTER`，见 lib/portal/system-register.ts）——
 * 而这一页的字到 2026-09-06 都还写着「上面每一页都会跟着变」。
 * 一页在描述一个产品已经没有的行为，跟一颗按不动的按钮是同一个缺陷。
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

  /* 🔴 2026-09-04：这几张缩图只放**官网**那一页了。
     老板：`我现在只需要你一个UI风格for 我的system only` · `做好一套就可以了`。

     以前它播四页（总览 · 客户 · 报价单 · 收款），因为「一套风格是关於一整套
     系统的决定」。**那句话今天不成立了** —— 换一套风格只会换官网。
     还播四页的话，四张里有三张不管你选哪一套都一模一样，
     而缩图正是客人拿来做决定的东西：一张不会变的缩图，会让他以为这个选择没用。
     见 lib/portal/system-register.ts。 */
  const previewPages = pageRefs.filter((r) => r.key === SITE_PAGE_KEY).map((ref) => {
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
      : upgradeLayout(saved, systemLangOf(businessContext));
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

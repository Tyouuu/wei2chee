import { redirect } from "next/navigation";
import type { Data } from "@puckeditor/core";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { PortalHome } from "./home-client";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import {
  buildPageLayout,
  isUngeneratedLayout,
  sortPageKeys,
  type BusinessContext,
  type PageKey,
} from "@/lib/templates/industry-template";

/**
 * The customer's home.
 *
 * WHY THIS PAGE NOW EXISTS: until now `/portal` had no UI at all — it read
 * `projects.style` and redirected straight to `/portal/dashboard`, which IS the
 * Puck editor. So the first thing a business owner saw after signing in was a
 * drag-and-drop canvas with a component palette down the left side. The
 * founder's objection was exactly right, and it is not a styling one:
 * **no product drops a customer into an authoring tool as their landing
 * surface.** Durable signs you in to a Home — greeting, your site, your
 * modules, your next action — and editing is one destination you choose from
 * it. 21st.dev opens on a gallery you browse. Neither opens on a canvas.
 *
 * So the editor became a destination rather than the front door, and this is
 * the front door: what the system understood about the business, the pages it
 * built, rendered as real miniatures of themselves, and the two things a
 * customer can actually do next (read the specification, hand it over to be
 * built).
 *
 * The layout generation below deliberately mirrors `[pageKey]/page.tsx`
 * exactly. A page that has never been saved is generated on read, not
 * persisted, so a customer who has never opened the editor still sees real
 * pages here — showing five empty cards on the home screen would reintroduce
 * the blank-canvas problem one level up.
 */
export default async function PortalHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Session-aware client, not the service-role client: RLS's
  // `projects_select_own` / `project_pages_select_own` policies are the real
  // enforcement, with the `.eq(...)` filters kept for explicitness.
  const supabase = await createSessionSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, style, paid")
    .eq("account_id", user.id)
    .single();

  if (!project) redirect("/login");
  if (!project.style) redirect("/portal/style-select");

  const { data: pageRows } = await supabase
    .from("project_pages")
    .select("page_key, layout_json")
    .eq("project_id", project.id);

  const pageKeys = sortPageKeys(
    (pageRows ?? []).map((r: { page_key: string }) => r.page_key as PageKey),
  );

  // One call, not one per page: `get_my_business_context` is `security definer`
  // and resolves the lead from auth.uid() internally, so there is no id to pass
  // and nothing here can reach another customer's lead.
  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessContext = (context as BusinessContext | null) ?? {};
  const brandName = user.email?.split("@")[0] || "我的生意";

  const pages = pageKeys.map((key) => {
    const row = (pageRows ?? []).find((r: { page_key: string }) => r.page_key === key);
    const saved = (row?.layout_json as Record<string, unknown>) ?? {};
    const generated = isUngeneratedLayout(saved);
    return {
      pageKey: key,
      isDraft: generated,
      layout: (generated
        ? buildPageLayout(key, businessContext, brandName, locale, pageKeys)
        : saved) as unknown as Data,
    };
  });

  return (
    <PortalHome
      locale={locale}
      accountEmail={user.email}
      paid={Boolean(project.paid)}
      style={project.style as StyleName}
      pages={pages}
      summary={businessContext.analysis?.summary ?? null}
      industryName={businessContext.industry?.name_zh ?? null}
    />
  );
}

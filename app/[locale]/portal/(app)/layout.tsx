import { redirect } from "next/navigation";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { PortalShell } from "./portal-shell";
import { SystemLangProvider } from "@/design-system/system-lang-context";
import {
  displayBusinessName,
  displayOwnerName,
  pageLabel,
  sortPages,
  systemLangOf,
  tradeLabels,
  type BusinessContext,
} from "@/lib/templates/industry-template";

/**
 * The shell every application screen sits inside.
 *
 * WHY A ROUTE GROUP. `(app)` does not appear in any URL — `/portal`,
 * `/portal/library`, `/portal/spec` are unchanged. What it buys is the ability
 * to give those screens a shell while leaving `/portal/[pageKey]` (the Puck
 * editor, which must be full-screen) and `/portal/style-select` (one-time
 * onboarding, before there is an app to navigate) outside it. Next resolves
 * static segments before dynamic ones, so `/portal/library` reaches this
 * group's `library/page.tsx` rather than the `[pageKey]` editor.
 *
 * WHY THE NAV DATA IS FETCHED HERE AND NOT IN EACH PAGE. The rail lists the
 * customer's own pages by their own names, on every screen. Fetching that in
 * the layout means one query for the whole shell rather than one per route, and
 * means a page that forgets to pass nav data cannot render a rail with holes
 * in it.
 */


export default async function PortalAppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Session-aware client: RLS's own `projects_select_own` /
  // `project_pages_select_own` policies are the real enforcement, the `.eq()`
  // filters are for explicitness.
  const supabase = await createSessionSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, paid, site_published")
    .eq("account_id", user.id)
    .single();

  // A founder account has no project of its own, and must still be able to
  // reach the console. Customers without a project are a broken signup and go
  // back to login, as before.
  const { data: founder } = await supabase.rpc("is_founder");
  const isFounder = Boolean(founder);

  if (!project && !isFounder) redirect("/login");

  const { data: pageRows } = project
    ? await supabase
        .from("project_pages")
        .select("page_key, title, sort_order")
        .eq("project_id", project.id)
    : { data: [] };

  const pageRefs = sortPages(
    (pageRows ?? []).map((r: { page_key: string; title: string | null; sort_order: number | null }) => ({
      key: r.page_key,
      title: r.title,
      sortOrder: r.sort_order,
    })),
  );

  /*
    THE PUBLIC SIDE, IN THE RAIL.

    「客户的system页面 跟客户的landing pages跟website应该是要分开放的」. The home
    screen was split on 2026-08-25; the rail was not, so 官网 still sat sixth in
    「我的系统」 next to 报价单 and 客户 as though it were another internal page. It
    is not: it has a public address, it is either live or it is not, and
    strangers post into it. Those three facts are the whole difference, and a
    rail that hides all three is the reason the split had to be explained on the
    home screen at all.

    A head-only count, the same one the home screen takes: 「有没有新的询价」 is
    the one thing an owner opens this product to find out, and it belongs where
    it can be seen from every screen rather than only on the one screen he has
    to navigate to.
  */
  const { count: enquiryCount } = project
    ? await supabase
        .from("site_enquiries")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id)
    : { count: 0 };

  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessContext = (context as BusinessContext | null) ?? {};

  return (
    <PortalShell
      locale={locale}
      accountEmail={user.email ?? ""}
      businessName={displayBusinessName(businessContext)}
      savedBusinessName={businessContext.identity?.business_name ?? null}
      savedOwnerName={businessContext.identity?.owner_name ?? null}
      systemLang={systemLangOf(businessContext)}
      ownerName={displayOwnerName(businessContext, user.email?.split("@")[0] || "我")}
      pages={pageRefs.map((ref) => ({
        key: ref.key,
        label: pageLabel(
          ref,
          tradeLabels(businessContext, pageRefs),
          systemLangOf(businessContext),
        ),
      }))}
      sitePublished={Boolean(project?.site_published)}
      enquiryCount={enquiryCount ?? 0}
      paid={Boolean(project?.paid)}
      isFounder={isFounder}
    >
      {/* Inside the shell, not around it. PortalShell is FORMAE -- dark chrome,
          the founder's own product, always in the owner's language. Everything
          it wraps is the CUSTOMER'S system, which speaks whatever
          `projects.system_language` says. Putting the provider here is what
          keeps that line visible in the code as well as on the screen. */}
      <SystemLangProvider lang={systemLangOf(businessContext)}>
        {children}
      </SystemLangProvider>
    </PortalShell>
  );
}

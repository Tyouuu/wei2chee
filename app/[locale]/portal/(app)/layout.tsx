import { redirect } from "next/navigation";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { PortalShell } from "./portal-shell";
import {
  displayBusinessName,
  displayOwnerName,
  pageLabel,
  sortPages,
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

const FALLBACK_LABELS = { customer: "客户", order: "订单", staff: "员工" };

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
    .select("id, paid")
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
        .select("page_key, title")
        .eq("project_id", project.id)
    : { data: [] };

  const pageRefs = sortPages(
    (pageRows ?? []).map((r: { page_key: string; title: string | null }) => ({
      key: r.page_key,
      title: r.title,
    })),
  );

  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessContext = (context as BusinessContext | null) ?? {};

  return (
    <PortalShell
      locale={locale}
      accountEmail={user.email ?? ""}
      businessName={displayBusinessName(businessContext)}
      savedBusinessName={businessContext.identity?.business_name ?? null}
      savedOwnerName={businessContext.identity?.owner_name ?? null}
      ownerName={displayOwnerName(businessContext, user.email?.split("@")[0] || "我")}
      pages={pageRefs.map((ref) => ({
        key: ref.key,
        label: pageLabel(ref, businessContext.industry?.labels ?? FALLBACK_LABELS),
      }))}
      paid={Boolean(project?.paid)}
      isFounder={isFounder}
    >
      {children}
    </PortalShell>
  );
}

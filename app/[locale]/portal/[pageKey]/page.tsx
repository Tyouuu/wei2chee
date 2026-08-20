import { notFound, redirect } from "next/navigation";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { PortalEditor } from "./editor-client";
import { upgradeLayout } from "@/lib/portal/layout-upgrade";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import {
  PAGE_KEYS,
  buildPageLayout,
  displayOwnerName,
  isBuiltInPage,
  isUngeneratedLayout,
  pageLabel,
  sortPages,
  type BusinessContext,
  type PageKey,
} from "@/lib/templates/industry-template";

/** Used when an account has no lead, so `industry.labels` is absent -- the same
 *  generic vocabulary industry-template.ts falls back to. */
const FALLBACK_LABELS = { customer: "客户", order: "订单", staff: "员工" };

export default async function PortalEditorPage({
  params,
}: {
  params: Promise<{ locale: string; pageKey: string }>;
}) {
  const { locale, pageKey } = await params;
  // Cheap shape check only. The REAL check is against the pages this account
  // actually has, further down -- a business whose trade has no quotations
  // must 404 on /portal/quotations rather than render an empty one.
  // Shape check only, and it now has to admit custom keys -- the real check is
  // still `if (!page) notFound()` further down, against the pages this account
  // actually has. Mirrors the database's own constraint (migration
  // 20260820200000) rather than restating a different rule.
  if (!isBuiltInPage(pageKey) && !/^custom_[a-z0-9]{8,32}$/.test(pageKey)) notFound();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Session-aware client, not the service-role client: RLS's
  // `projects_select_own`/`project_pages_select_own` policies are the real
  // enforcement for both reads below, with the `.eq(...)` filters kept for
  // explicitness -- the filters alone aren't a backstop against a future
  // edit dropping or mistyping one.
  const supabase = await createSessionSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, style, paid")
    .eq("account_id", user.id)
    .single();

  if (!project) redirect("/login");
  if (!project.style) redirect("/portal/style-select");

  // Every page this account has, in its own order. Pages are now provisioned
  // per industry (migration 20260820160000), so this is the only honest source
  // for both "does this page exist for this customer" and the editor's nav --
  // a hardcoded five-page list would 404 a salon's 预约 page and offer a
  // contractor's 报价单 to a restaurant.
  const { data: pageRows } = await supabase
    .from("project_pages")
    .select("page_key, title, layout_json")
    .eq("project_id", project.id);

  const pageRefs = sortPages(
    (pageRows ?? []).map((r: { page_key: string; title: string | null }) => ({
      key: r.page_key,
      title: r.title,
    })),
  );
  const page = (pageRows ?? []).find((r: { page_key: string }) => r.page_key === pageKey);
  if (!page) notFound();

  const savedLayout = (page.layout_json as Record<string, unknown>) ?? {};

  // THE FIX for the journey's worst break (docs/formae-product-direction.md
  // sections 2-4): the signup trigger creates all five project_pages rows with
  // `layout_json = '{}'`, so before this a customer who had just spent the
  // acquisition flow answering questions about their business landed on an
  // empty canvas, with every one of those answers discarded.
  //
  // A page that has never been written to is instead generated NOW, from the
  // customer's own industry, questionnaire and AI analysis. Nothing is
  // persisted here -- generation is a pure read-side default, so it costs no
  // write path, respects the paid gate exactly as before (an unpaid customer
  // can explore and edit their generated system, they just cannot save it),
  // and re-runs harmlessly on every load until their first save.
  // `get_my_business_context` (20260820120000) is security definer and resolves
  // the lead from auth.uid() internally -- there is no id to pass and therefore
  // no way for this call to reach another customer's lead. Returns null for an
  // account that signed up without ever answering the questionnaire;
  // buildPageLayout treats that as "no context" and still produces a complete
  // generic system rather than a blank page.
  //
  // Fetched unconditionally, where it used to be fetched only when a page had
  // to be generated: the page tabs now carry the trade's own vocabulary
  // ("客户" vs "病人") and a customer's own titles for pages they added, so the
  // labels need it on every load, not only on a first visit.
  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessContext = (context as BusinessContext | null) ?? {};

  // Brought up to the current component shapes BEFORE Puck sees it. Puck's
  // fields panel edits exactly the props it is handed, so a table left in the
  // legacy four-prop shape would show the customer both the new column editor
  // and a dead row editor -- see lib/portal/layout-upgrade.ts.
  let initialData = upgradeLayout(savedLayout);
  if (isUngeneratedLayout(savedLayout)) {
    initialData = buildPageLayout(
      pageKey,
      businessContext,
      // The account chip only -- the rail's BRAND label now comes from
      // `projects.business_name` inside buildPageLayout. This is the person,
      // and the email's local part is the stand-in until they set a name.
      displayOwnerName(businessContext, user.email?.split("@")[0] || "我"),
      locale,
      pageRefs,
    ) as unknown as Record<string, unknown>;
  }

  return (
    <PortalEditor
      pageKey={pageKey}
      projectId={project.id}
      accountEmail={user.email}
      /** projects.paid (Task 1) -- save_project_page raises "payment required"
       * server-side for an unpaid project (the real enforcement), but the
       * paywall interstitial is shown client-side off this prop so an unpaid
       * customer sees a purpose-built CTA instead of a raw error. */
      paid={Boolean(project.paid)}
      initialData={initialData}
      /** True only when the customer has never saved this page, i.e. what they
       * are looking at is the generated draft rather than their own work. The
       * editor uses it to say so, which is the difference between "the system
       * guessed this for you, change anything" and a customer assuming these
       * are real records. */
      isGeneratedDraft={isUngeneratedLayout(savedLayout)}
      locale={locale}
      navPages={pageRefs.map((ref) => ({
        key: ref.key,
        label: pageLabel(ref, businessContext.industry?.labels ?? FALLBACK_LABELS),
      }))}
      /** The customer's own chosen style (projects.style, Task 3) -- applies to
       * canvas CONTENT only. Chrome stays Ledger regardless, per Task 5's own
       * reviewed design. */
      style={project.style as StyleName}
    />
  );
}

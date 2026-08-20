import { notFound, redirect } from "next/navigation";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { PortalEditor } from "./editor-client";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import {
  PAGE_KEYS,
  buildPageLayout,
  isUngeneratedLayout,
  type BusinessContext,
  type PageKey,
} from "@/lib/templates/industry-template";

export default async function PortalEditorPage({
  params,
}: {
  params: Promise<{ locale: string; pageKey: string }>;
}) {
  const { locale, pageKey } = await params;
  if (!PAGE_KEYS.includes(pageKey as PageKey)) notFound();

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

  const { data: page } = await supabase
    .from("project_pages")
    .select("layout_json")
    .eq("project_id", project.id)
    .eq("page_key", pageKey)
    .single();

  const savedLayout = (page?.layout_json as Record<string, unknown>) ?? {};

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
  let initialData = savedLayout;
  if (isUngeneratedLayout(savedLayout)) {
    // `get_my_business_context` (20260820120000) is security definer and
    // resolves the lead from auth.uid() internally -- there is no id to pass
    // and therefore no way for this call to reach another customer's lead.
    // Returns null for an account that signed up without ever answering the
    // questionnaire; buildPageLayout treats that as "no context" and still
    // produces a complete generic system rather than a blank page.
    const { data: context } = await supabase.rpc("get_my_business_context");

    initialData = buildPageLayout(
      pageKey as PageKey,
      (context as BusinessContext | null) ?? {},
      // The rail's brand label and account chip. The local-part of the signup
      // email is a better placeholder than the full address (which would put
      // the customer's own email into a screenshot of their system) and better
      // than nothing.
      user.email?.split("@")[0] || "我的生意",
      locale,
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
      /** The customer's own chosen style (projects.style, Task 3) -- applies to
       * canvas CONTENT only. Chrome stays Ledger regardless, per Task 5's own
       * reviewed design. */
      style={project.style as StyleName}
    />
  );
}

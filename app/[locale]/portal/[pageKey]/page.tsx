import { notFound, redirect } from "next/navigation";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { PortalEditor } from "./editor-client";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

const VALID_PAGE_KEYS = ["dashboard", "customers", "quotations", "projects", "payments"];

export default async function PortalEditorPage({ params }: { params: Promise<{ pageKey: string }> }) {
  const { pageKey } = await params;
  if (!VALID_PAGE_KEYS.includes(pageKey)) notFound();

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
    .select("id, style")
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

  return (
    <PortalEditor
      pageKey={pageKey}
      initialData={(page?.layout_json as Record<string, unknown>) ?? {}}
      // Untyped Supabase client (see createSessionSupabaseClient's own
      // comment) -- `style` comes back as `any`, narrowed here the same
      // way this file already narrows `layout_json` above. The `style is
      // null` redirect a few lines up guarantees a value; the db's own
      // check constraint (`style in ('ledger','hearth','blueprint')`,
      // supabase/migrations/20260818120000_customer_portal_schema.sql)
      // guarantees it's one of the three real StyleName values.
      style={project.style as StyleName}
    />
  );
}

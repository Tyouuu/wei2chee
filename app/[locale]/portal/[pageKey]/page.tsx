import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/server-session";
import { PortalEditor } from "./editor-client";

const VALID_PAGE_KEYS = ["dashboard", "customers", "quotations", "projects", "payments"];

export default async function PortalEditorPage({ params }: { params: Promise<{ pageKey: string }> }) {
  const { pageKey } = await params;
  if (!VALID_PAGE_KEYS.includes(pageKey)) notFound();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = createServerSupabaseClient();
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

  return <PortalEditor pageKey={pageKey} initialData={(page?.layout_json as Record<string, unknown>) ?? {}} />;
}

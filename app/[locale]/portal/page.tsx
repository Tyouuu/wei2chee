import { redirect } from "next/navigation";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";

/**
 * The `/portal` branch-router: no UI of its own, just decides where to send
 * a logged-in visitor -- style-select (if `projects.style` is still null)
 * or straight to the dashboard editor page. `/portal/[pageKey]` is the real
 * route shape (one account = one project in this version; routes look up
 * "the caller's own project" via `auth.uid()`, never a URL-supplied project
 * id), not `/portal/[projectId]/[pageKey]`.
 */
export default async function PortalRootPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Session-aware client, not the service-role client: RLS's
  // `projects_select_own` policy is the real enforcement here, with the
  // `.eq("account_id", user.id)` filter below kept for explicitness -- the
  // filter alone isn't a backstop against a future edit dropping it.
  const supabase = await createSessionSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("style")
    .eq("account_id", user.id)
    .single();

  if (!project?.style) redirect("/portal/style-select");
  redirect("/portal/dashboard");
}

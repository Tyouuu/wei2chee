import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/server-session";

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

  // Service-role read here is fine and simpler than threading a
  // session-aware server client through one more file for a single
  // SELECT -- this route makes no decision based on data a customer
  // shouldn't see, it only branches on their own project's style field.
  const supabase = createServerSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("style")
    .eq("account_id", user.id)
    .single();

  if (!project?.style) redirect("/portal/style-select");
  redirect("/portal/dashboard");
}

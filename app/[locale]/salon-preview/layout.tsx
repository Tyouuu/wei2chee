import type { ReactNode } from "react";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { SalonViewerProvider, type SalonViewer } from "./salon-shell";

/**
 * Tells the sidebar who is looking and which pages their business keeps
 * (Task 414). Asked once here, on the server, so the first paint already has the
 * right rows; a layout is not torn down when you move between salon pages, so
 * the sidebar does not blink or ask again on every click. A full reload (or
 * router.refresh()) asks again, which is when a page added or taken away in the
 * portal shows up.
 *
 * It never redirects: the pages themselves send a logged-out visitor to the
 * login, and doing it here too would change where they land. With nobody signed
 * in the provider is null and the sidebar draws every row, as it always did.
 *
 * ⚠️ One round trip, not three. A layout that awaits holds its page back until
 * it has finished, so every second this spends is a second added to every salon
 * page and to every router.refresh() (a stock receipt, a booking). The three
 * questions -- who is this, which business and as what, which pages -- do not
 * depend on each other, so they go out together. project_pages is asked for
 * every project this login can see (RLS decides which) and cut down to the
 * business that my_workspace() names, instead of waiting for that answer first.
 */
export default async function SalonPreviewLayout({ children }: { children: ReactNode }) {
  let viewer: SalonViewer | null = null;

  const supabase = await createSessionSupabaseClient();
  const [auth, workspace, pages] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("my_workspace"),
    supabase.from("project_pages").select("project_id, page_key"),
  ]);

  const user = auth.data.user;
  const row = (workspace.data as { project_id: string; role: string }[] | null)?.[0];
  if (user?.email && row?.project_id) {
    viewer = {
      pageKeys: ((pages.data ?? []) as { project_id: string; page_key: string }[])
        .filter((p) => p.project_id === row.project_id)
        .map((p) => p.page_key),
      isOwner: row.role !== "staff",
      viewerName: user.email.split("@")[0],
    };
  }

  return <SalonViewerProvider value={viewer}>{children}</SalonViewerProvider>;
}

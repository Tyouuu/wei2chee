import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server-session";

// `[background:var(--color-canvas)]` was tried here during the final-review
// fix wave (to resolve a previously-dead declaration -- --color-canvas only
// exists inside .ledger/.hearth/.blueprint in style-scope.module.css, so it
// silently resolved to nothing). Reverted: this layout wraps EVERY portal
// route, including /portal/style-select, which deliberately uses the
// acquisition site's own dark-theme tokens (see that page's own comment) --
// painting a light Ledger canvas underneath it made its near-white heading
// unreadable (~1.06:1 contrast, confirmed live). The editor route
// (editor-client.tsx) already declares its own complete, independent
// .ledger scope on its own root div and doesn't need this wrapper's
// background at all, so fixing the dead declaration here had no real
// upside and a real, customer-facing downside on the first screen a
// customer sees after signup.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <div className="min-h-screen">{children}</div>;
}

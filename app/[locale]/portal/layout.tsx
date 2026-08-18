import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server-session";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <div className="min-h-screen [background:var(--color-canvas)]">{children}</div>;
}

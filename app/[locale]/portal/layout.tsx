import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server-session";
// Same scoped Ledger token class editor-client.tsx applies to its own
// wrapper (see that file's own comment) -- without a scope class here,
// --color-canvas below is never defined (it only exists inside
// .ledger/.hearth/.blueprint in style-scope.module.css) and silently
// resolves to nothing. The whole portal's chrome is Ledger regardless of
// the customer's own content style, per Task 5's reviewed design.
import styles from "@/app/[locale]/style-picker/style-scope.module.css";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <div className={`min-h-screen ${styles.ledger} [background:var(--color-canvas)]`}>{children}</div>;
}

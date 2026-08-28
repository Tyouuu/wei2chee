import { notFound, redirect } from "next/navigation";
import { createSessionSupabaseClient, getSessionUser } from "@/lib/supabase/server-session";
import { ConsoleShell } from "./console-shell";

/**
 * The console, outside /portal.
 *
 * WHY IT MOVED. `/portal` means "the customer's portal", and the founder is not
 * a customer. Living under it meant the admin panel inherited the customer's
 * shell -- rail, libraries, delivery -- and it also meant the two could never be
 * served separately. They are about to be: same repository, two Vercel
 * projects, `APP_SURFACE` deciding which surface a deployment answers for (see
 * proxy.ts). A path split is the precondition for that, and it is also what
 * makes moving the console to its own domain later a DNS change rather than a
 * refactor.
 *
 * WHAT THE SEPARATE ORIGIN ACTUALLY BUYS, since it is easy to believe it is
 * secrecy and it is not: an admin URL is not a secret and guessing it gets
 * nobody anything -- every console read is behind an `is_founder()` check
 * inside a `security definer` function. What a second origin buys is blast
 * radius. An XSS anywhere in the customer portal today sits on the same origin
 * as the founder's session cookie. On its own origin it does not.
 *
 * `notFound()` rather than a redirect for a signed-in non-founder: a 404 does
 * not confirm that the route exists.
 */
export default async function ConsoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSessionSupabaseClient();
  const { data: founder } = await supabase.rpc("is_founder");
  if (!founder) notFound();

  return (
    <ConsoleShell locale={locale} email={user.email ?? ""}>
      {children}
    </ConsoleShell>
  );
}

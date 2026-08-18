import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Session-aware client for Server Components -- read-only (Server
 * Components can't write cookies; the proxy (middleware-client.ts) is what
 * keeps the session fresh), RLS-enforcing (uses the anon key plus the
 * caller's own session, not the service role). Use this for any table read
 * that should be bounded by the signed-in user's own RLS policies, instead
 * of `createServerSupabaseClient()` (lib/supabase/server.ts), which is
 * service-role and bypasses RLS entirely -- fine for reads that don't
 * depend on who's asking, wrong for anything scoped to "the caller's own
 * row(s)", where RLS should be a real backstop under the app-layer filter,
 * not just documentation of intent.
 */
export async function createSessionSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // no-op: Server Components can't write cookies; the proxy
          // (middleware-client.ts) is what keeps the session fresh.
        },
      },
    },
  );
}

export async function getSessionUser(): Promise<{ id: string; email: string } | null> {
  const supabase = await createSessionSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) return null;
  return { id: user.id, email: user.email };
}

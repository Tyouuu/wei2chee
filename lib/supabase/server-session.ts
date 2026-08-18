import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Read-only session lookup for Server Components. Only `getAll` is
 * implemented in the cookie adapter -- Server Components cannot set
 * cookies (see Next's cookies() docs: writes require a Server Function
 * or Route Handler), and this helper is never used to write.
 */
export async function getSessionUser(): Promise<{ id: string; email: string } | null> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) return null;
  return { id: user.id, email: user.email };
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session cookie on every request that passes
 * through the proxy, so a Server Component's `cookies()` read always sees
 * an up-to-date session rather than one that silently expired mid-visit.
 * This is the standard @supabase/ssr proxy pattern -- the cookie handlers
 * below are required exactly as shown, not optional boilerplate.
 */
export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Touching getUser() is what actually triggers the refresh when needed.
  await supabase.auth.getUser();

  return response;
}

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Session-aware Supabase client for Route Handlers. Unlike
 * `lib/supabase/server-session.ts` (Server Components, read-only, no-op
 * `setAll`), a Route Handler CAN and must write cookies -- this is the
 * client `app/auth/confirm/route.ts` uses so that `verifyOtp()`'s session
 * actually gets persisted to the browser instead of being discarded.
 */
export async function createRouteHandlerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );
}

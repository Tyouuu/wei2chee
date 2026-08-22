import { createClient } from "@supabase/supabase-js";

// Service-role client for API routes only. Never import this into a
// client component — the service role key must never reach the browser.
export function createServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * Anonymous client -- the anon key, no session, no cookies.
 *
 * For the one part of this product a stranger reads: a customer's published
 * 官网 at /s/<slug>. Not `createSessionSupabaseClient`, because that resolves a
 * session from cookies and RLS on `projects`/`project_pages` is scoped to
 * auth.uid() -- a visitor has neither, and a logged-in visitor must not see a
 * different page from a logged-out one. Not the service-role client either:
 * this reads through `get_public_site`, whose returned columns ARE the public
 * surface, and handing that path a key that bypasses RLS would make the
 * function's narrowness the only thing standing between an anonymous request
 * and every table.
 */
export function createAnonSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

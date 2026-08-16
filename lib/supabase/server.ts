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

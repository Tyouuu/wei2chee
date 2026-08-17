import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function evaluateRateLimit(
  recentEventTimestamps: number[],
  now: number,
  opts: { limit?: number; windowMs?: number } = {},
): { allowed: boolean; remaining: number } {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const inWindow = recentEventTimestamps.filter((t) => now - t < windowMs);
  const remaining = Math.max(0, limit - inWindow.length);
  return { allowed: inWindow.length < limit, remaining };
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  identifier: string,
  opts: { limit?: number; windowMs?: number } = {},
): Promise<{ allowed: boolean; remaining: number }> {
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const since = new Date(Date.now() - windowMs).toISOString();

  const { data, error } = await supabase
    .from("rate_limit_events")
    .select("created_at")
    .eq("identifier", identifier)
    .gte("created_at", since);

  if (error) throw error;

  const timestamps = (data ?? []).map((row) => new Date(row.created_at).getTime());
  const result = evaluateRateLimit(timestamps, Date.now(), opts);

  if (result.allowed) {
    await supabase.from("rate_limit_events").insert({ identifier });
  }

  return result;
}

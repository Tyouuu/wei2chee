import { createServerSupabaseClient } from "@/lib/supabase/server";

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

/**
 * 🔴 只走 service-role，不收调用端传来的连线 —— `rate_limit_events`
 * 从建表那天起（20260816204034）就是「没有公开政策，只走服务端的
 * service role key」，而这一支从写出来那天就收一个任意的 `supabase`
 * 参数，两处呼叫端（`hear` · `receipt`）传的是老板自己那个登入
 * （`authenticated` 角色，受 RLS 管）——查永远读到空（RLS 零政策，
 * 读不到任何一行，於是永远以为没有历史）、写永远报违反政策而整支
 * 302 出去。限流因此从来没有真的挡过这两支，而且每一次呼叫都会炸。
 * 把连线收回来自己管，这个错以后没有地方可以再犯一次。
 */
export async function checkRateLimit(
  identifier: string,
  opts: { limit?: number; windowMs?: number } = {},
): Promise<{ allowed: boolean; remaining: number }> {
  const supabase = createServerSupabaseClient();
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

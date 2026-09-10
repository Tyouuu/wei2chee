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
 *
 * 🔴 `headers` -- 只有助手写东西那条路会传。20260911150000 那份 via_ai
 * 契约：`x-formae-actor: assistant`，触发器用 `current_setting("request.headers",
 * true)` 读它，一个手动按按钮的人从来不会带这个头。
 *
 * ⚠️ 默认是没有 -- 老板自己点按钮、每一处只是读一下、认证检查那几十个
 * 呼叫端全部照旧不带任何东西，一个字都不用改。只有 route.ts 里代表助手
 * 写东西的那几处才传 `{ "x-formae-actor": "assistant" }`。同一个身分
 * （重点 23，AI 平权不变），多带一个「这一次是谁按的方向盘」的记号。
 */
export async function createSessionSupabaseClient(headers?: Record<string, string>) {
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
      ...(headers ? { global: { headers } } : {}),
    },
  );
}

/** 🔴 助手写东西那几处专用 -- 见上面 `headers` 的注解。一个字都不重写，
 *  只是把那份契约的字面值收在一个地方，不要每个呼叫端各自抄一遍。 */
export const ASSISTANT_ACTOR_HEADERS = { "x-formae-actor": "assistant" } as const;

export async function getSessionUser(): Promise<{ id: string; email: string } | null> {
  const supabase = await createSessionSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) return null;
  return { id: user.id, email: user.email };
}

import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler-client";
import { systemSurfaceOf } from "@/lib/portal/system-surface";

/**
 * The one place a session gets established from a link.
 *
 * WHY THIS EXISTS ALONGSIDE /auth/confirm. That route handles exactly one
 * shape: `token_hash` + `type`, which is what the customised "Confirm signup"
 * email template sends. Three flows this product needs do NOT send that shape:
 *
 *   - Google sign-in comes back with `?code=` (PKCE) and needs
 *     exchangeCodeForSession
 *   - password recovery, sent by resetPasswordForEmail, comes back through
 *     Supabase's own /auth/v1/verify with either shape depending on how the
 *     project's templates are configured
 *   - any future magic link
 *
 * Rather than one route per flow, this accepts both shapes. Signup keeps its
 * own route because its email template is already deployed pointing at it and
 * re-pointing a live template is a change with no upside.
 *
 * `next` IS ATTACKER-CONTROLLABLE. A hand-crafted link can set it to anything,
 * and this route establishes a session immediately before redirecting there.
 * The guard below is copied verbatim from /auth/confirm and is deliberately
 * stricter than `startsWith("/")`: browsers apply the WHATWG URL spec's
 * backslash-to-slash normalisation, so "/\evil.com" passes a naive check and
 * still resolves as protocol-relative "//evil.com". This rejects any
 * backslash, any second slash, and any colon so an embedded scheme cannot
 * sneak through either.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const explicitNext = searchParams.get("next");
  const rawNext = explicitNext ?? "/portal";
  const next = /^\/(?!\/)[^\s\\:]*$/.test(rawNext) ? rawNext : "/portal";

  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createRouteHandlerSupabaseClient();

  /* Where a signed-in person lands when the link did not ask for somewhere
     specific: a salon account opens the salon system (lib/portal/system-surface.ts),
     the same rule the password login uses. A brand-new Google user has no
     business yet, so they still land on /portal. */
  async function landing() {
    if (explicitNext) return next;
    const { data: context } = await supabase.rpc("get_my_business_context");
    return systemSurfaceOf(context) === "salon" ? "/salon-preview/overview" : next;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(await landing());
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) redirect(await landing());
  }

  // Same destination as the signup route's failure path, so a customer who
  // clicks an expired link gets one explanation rather than two.
  redirect(`${origin}/auth/confirm-error`);
}

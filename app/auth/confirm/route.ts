import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler-client";

// Deliberately outside app/[locale]/ -- Supabase's confirmation email link
// (built from the "Confirm signup" template, see Step 3 of the Task 2a
// brief) has no knowledge of next-intl locale routing, and the proxy's
// matcher excludes /auth so this route is reached unrewritten.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next") ?? "/portal";
  // `next` is attacker-controllable (a hand-crafted confirmation link can
  // set it to anything) -- without this guard, an absolute or
  // protocol-relative URL would redirect off-site right after this route
  // establishes a session. The shipped email template always sends
  // next=/portal, so this never fires in the normal flow.
  //
  // A plain `startsWith("/") && !startsWith("//")` check is NOT enough:
  // browsers apply the WHATWG URL spec's backslash-to-slash normalization
  // for http(s) URLs, so a value like "/\evil.com" starts with a single
  // forward slash (passes both checks) but still resolves as a
  // protocol-relative "//evil.com" once the browser parses it. This regex
  // additionally rejects any backslash and any second slash immediately
  // after the first, and rejects a colon so an embedded scheme
  // ("/x:evil.com") can't sneak through either.
  const next = /^\/(?!\/)[^\s\\:]*$/.test(rawNext) ? rawNext : "/portal";

  if (token_hash && type) {
    const supabase = await createRouteHandlerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      redirect(next);
    }
  }

  redirect("/auth/confirm-error");
}

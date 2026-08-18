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
  const next = searchParams.get("next") ?? "/portal";

  if (token_hash && type) {
    const supabase = await createRouteHandlerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      redirect(next);
    }
  }

  redirect("/auth/confirm-error");
}

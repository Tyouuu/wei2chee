import createIntlProxy from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { updateSupabaseSession } from "./lib/supabase/middleware-client";
import type { NextRequest } from "next/server";

const intlProxy = createIntlProxy(routing);

export async function proxy(request: NextRequest) {
  // Run the Supabase session refresh first so its Set-Cookie header
  // survives; next-intl's proxy returns its own response object for
  // locale rewrites, and we want the auth cookie to ride along with it.
  const supabaseResponse = await updateSupabaseSession(request);
  const intlResponse = intlProxy(request);

  // next-intl may rewrite/redirect for locale handling; when it does,
  // its response takes precedence for routing, but the auth cookie set
  // by Supabase must still be copied onto it.
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};

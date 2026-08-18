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
    intlResponse.cookies.set(cookie);
  });

  return intlResponse;
}

export const config = {
  // `auth` is excluded alongside `api`/`_next`: app/auth/confirm/route.ts
  // and app/auth/confirm-error/page.tsx live outside app/[locale]/ on
  // purpose (Supabase's confirmation email link has no knowledge of
  // next-intl locale routing), so this proxy -- next-intl's rewrite in
  // particular -- must never touch /auth/*. Without this exclusion,
  // next-intl 307-redirects /auth/confirm to /zh/auth/confirm, which has
  // no matching route and breaks every real confirmation link.
  matcher: ["/((?!api|_next|auth|.*\\..*).*)"],
};

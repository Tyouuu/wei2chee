import createIntlProxy from "next-intl/middleware";
import { NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { updateSupabaseSession } from "./lib/supabase/middleware-client";
import type { NextRequest } from "next/server";

const intlProxy = createIntlProxy(routing);

/*
  WHICH OF THE TWO PRODUCTS THIS DEPLOYMENT IS.

  One repository, two Vercel projects, one env var. `APP_SURFACE=admin` serves
  the founder's console and nothing else; `APP_SURFACE=app` serves the customer
  product and refuses the console.

  UNSET SERVES BOTH, AND THAT IS THE POINT OF UNSET. There is one dev server on
  one laptop, and a split that makes the console unreachable locally unless you
  remember to flip an env var is a split you will turn off. Unset also means the
  existing production deployment keeps behaving exactly as it does today until
  the second Vercel project exists and both vars are set deliberately.

  WHY NOT TWO APPS IN A MONOREPO. That is the expensive way to get the same
  thing: workspaces, a shared package, two tsconfigs, two dependency trees, and
  a design system that now has to be published to be imported. What the split is
  actually for is TWO ORIGINS -- so an XSS in the customer portal is not sitting
  on the same origin as the founder's session cookie. Two origins do not require
  two codebases, and two codebases drift.

  WHY 404 AND NOT A REDIRECT. Redirecting /console from the customer deployment
  to the admin one would publish the admin address to everyone who guesses the
  path. A 404 is what a route that is not served by this deployment looks like.

  This is not the security boundary. Every console read goes through a
  `security definer` RPC that checks `is_founder()` itself; if this file were
  deleted the database would still refuse. It decides what a DEPLOYMENT answers
  for, not who may read what.
*/
const SURFACE = process.env.APP_SURFACE === "admin"
  ? "admin"
  : process.env.APP_SURFACE === "app"
    ? "app"
    : "both";

/** Locale-agnostic: /console, /en/console, /zh/console/leads. */
const isConsolePath = (pathname: string) =>
  /^\/(?:[a-z]{2}\/)?console(?:\/|$)/.test(pathname);

/** The routes the admin deployment needs besides the console itself: signing
 *  in, and the magic-link/confirmation route that finishes it. `/login` is
 *  under [locale]; `/auth/*` is excluded by the matcher and never reaches
 *  here. */
const isAuthPath = (pathname: string) =>
  /^\/(?:[a-z]{2}\/)?(?:login|forgot-password|reset-password)(?:\/|$)/.test(pathname);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const wantsConsole = isConsolePath(pathname);

  const refused =
    SURFACE === "admin"
      ? !wantsConsole && !isAuthPath(pathname)
      : SURFACE === "app" && wantsConsole;

  if (refused) return new NextResponse(null, { status: 404 });

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
  // `s/` joins them for the same reason, one layer out: /s/<slug> is a
  // customer's own published website, read by strangers who have never heard
  // of Formae. next-intl would 307 it to /zh/s/<slug>, putting our locale
  // prefix in a URL that business prints on a name card -- and there is no
  // locale to choose anyway, because the page speaks whatever language that
  // business's system speaks.
  matcher: ["/((?!api|_next|auth|s/|.*\\..*).*)"],
};

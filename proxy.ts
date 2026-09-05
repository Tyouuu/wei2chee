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
  // `p/` 跟 `s/` 是同一件事：/p/<号码> 是一条发给某一个经销商的连结，
  // 打开它的人从来没有听过 Formae，而这一页讲的是那套系统自己的语言。
  // 被 307 成 /zh/p/<号码> 就是那条连结在他手上会死掉的方式。
  // `s/` joins them for the same reason, one layer out: /s/<slug> is a
  // customer's own published website, read by strangers who have never heard
  // of Formae. next-intl would 307 it to /zh/s/<slug>, putting our locale
  // prefix in a URL that business prints on a name card -- and there is no
  // locale to choose anyway, because the page speaks whatever language that
  // business's system speaks.
  // `icon` / `apple-icon` / `manifest` 是 Next 自己的图标跟清单路由，
  // 而它们**没有副檔名** —— 上面那条“带点就放行”只挡得住有点的
  // (`favicon.ico` · `robots.txt` · `sitemap.xml` 都是靠它逃掉的)，
  // 所以这几条会被 307 到 `/en/apple-icon`，而那个网址底下没有东西。
  //
  // 实测 2026-09-04：`/apple-icon` → 307 → `/en/apple-icon`。
  // 后果不是少一张图：**iOS 加到主画面的时候找不到图标，
  // 就会去截一张网页的图缩成 180px** —— 一片灰。
  // 而那正好是「桌面图标」这件事唯一给他看的东西（任务 141）。
  // 任务 46b 把它记成「回 404」，记了三天没人动。
  matcher: ["/((?!api|_next|auth|s/|p/|icon|apple-icon|manifest|.*\\..*).*)"],
};

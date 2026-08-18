# Customer Portal & Drag-and-Drop Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Before writing any route, proxy, or Server Component code, read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` and `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` yourself** — do not rely on training-data memory of Next.js. Two breaking changes from training data already confirmed during planning, both already accounted for below, but verify nothing else has moved since: (1) `middleware.ts` is deprecated in Next 16, renamed to `proxy.ts` (function renamed `middleware` → `proxy`, same `NextRequest`/`NextResponse` API, same `config.matcher`); (2) `cookies()` from `next/headers` is **async** (`await cookies()`), not the pre-v15 synchronous API.

**Goal:** Give visitors a real account (public self-registration), a one-time style choice, and a hands-on drag-and-drop preview of arranging the existing 21-component design-system library into their own business system — free to explore, gated behind a manually-marked payment to save or hand off to the founder for real building.

**Architecture:** Supabase Auth for accounts, three new Postgres tables (`accounts`/`projects`/`project_pages`) with RLS restricted to `SELECT`-only for end users and two `SECURITY DEFINER` RPCs (`set_project_style`, `save_project_page`) as the only write paths — payment-gating and one-time-style-choice logic live in the database, not just the app layer. The editor itself is [Puck](https://github.com/puckeditor/puck) (MIT, React-native, embeddable), re-skinned with the existing Ledger token set's CSS custom properties rather than Puck's default look, with the 21 `design-system/components/*.tsx` files wrapped as Puck's draggable block config.

**Tech Stack:** Next.js 16 (App Router) + `@puckeditor/core` 0.23.0 + Supabase Auth/Postgres/RLS (`@supabase/ssr` for session-aware clients) + TypeScript + Tailwind v4 + next-intl (existing zh/en) + Vitest/Testing Library (existing).

## Global Constraints

- **One account = one project in this version.** No multi-project-per-account UI or route param — routes look up "the caller's own project" via `auth.uid()`, never take a `projectId` from the URL. (This narrows the spec's `/portal/[projectId]/[pageKey]` route shape to `/portal/[pageKey]` — a deliberate simplification made while writing this plan, since the 1:1 relationship makes a URL-supplied project id both redundant and unnecessary IDOR surface area.)
- **No customer-facing write path for `projects.paid`.** It is set only by the founder editing the row directly in Supabase Studio (the dashboard uses the service-role key and bypasses RLS) — no admin UI, no API route, per the spec's explicit "a Supabase table edit is sufficient for v1."
- **Every color in new UI is token-driven** — `var(--color-*)` etc. from `design-system/tokens/ledger.css`, never a hardcoded hex, matching the rest of `design-system/` (Global Constraint from the design-system plan, still binding here since this work extends that system).
- **Bilingual (zh default, en secondary)** for all user-facing text, via the existing next-intl setup — no new i18n mechanism.
- **No real payment gateway, no automated system generation from a saved layout, no additional style sets, no card-library expansion** — all explicitly out of scope per `docs/superpowers/specs/2026-08-18-customer-portal-and-editor-design.md` §2. If a task's implementer is tempted to add any of these "while they're in there," that's scope creep — stop and flag it instead.

---

### Task 1: Database schema — accounts, projects, project_pages, RLS, and the two write RPCs

**Files:**
- Create: `supabase/migrations/20260818120000_customer_portal_schema.sql`

**Interfaces:**
- Produces: three tables (`accounts`, `projects`, `project_pages`) and two callable RPCs (`set_project_style(new_style text)`, `save_project_page(target_page_key text, new_layout jsonb)`) that Tasks 3 and 6 call via `supabase.rpc(...)` from the browser client. Also produces a trigger that auto-provisions `accounts`/`projects`/`project_pages` rows the moment a new `auth.users` row is created (i.e., the moment someone finishes signing up).
- Consumes: the existing `leads` table (`leads.id`, already `uuid primary key` per `supabase/migrations/20260816204034_init_schema.sql`) for the `accounts.lead_id` foreign key.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260818120000_customer_portal_schema.sql

create table public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  lead_id uuid references public.leads(id),
  created_at timestamptz not null default now()
);

-- One project per account in this version -- the `unique` constraint on
-- account_id is what makes "the caller's own project" a well-defined
-- lookup with no id ambiguity.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  style text check (style in ('ledger', 'hearth', 'blueprint')),
  paid boolean not null default false,
  paid_marked_by text,
  paid_marked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  page_key text not null check (page_key in ('dashboard', 'customers', 'quotations', 'projects', 'payments')),
  layout_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (project_id, page_key)
);

alter table public.accounts enable row level security;
alter table public.projects enable row level security;
alter table public.project_pages enable row level security;

-- SELECT-only for end users. There are deliberately no insert/update/delete
-- policies here: account/project/page rows are created only by the trigger
-- below (runs as the function owner, bypasses RLS), style is set only via
-- set_project_style(), page content is saved only via save_project_page(),
-- and `paid` is flipped only by the founder in Supabase Studio (service
-- role, also bypasses RLS). A customer has no direct write path to any of
-- these tables at all -- every write is mediated by a function that can
-- enforce the one-time-style-choice and paid-gating rules that a bare RLS
-- policy can't express.
create policy "accounts_select_own" on public.accounts
  for select using (auth.uid() = id);

create policy "projects_select_own" on public.projects
  for select using (auth.uid() = account_id);

create policy "project_pages_select_own" on public.project_pages
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = project_pages.project_id
        and projects.account_id = auth.uid()
    )
  );

-- Auto-provisioning: the moment someone finishes Supabase Auth sign-up,
-- give them an account row, a project row, and all five empty page rows,
-- atomically. `lead_id` comes from the signup call's user metadata (see
-- Task 2's signUp() call, which passes `options: { data: { lead_id } }`).
create or replace function public.handle_new_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_project_id uuid;
  each_page_key text;
begin
  insert into public.accounts (id, email, lead_id)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'lead_id', '')::uuid
  );

  insert into public.projects (account_id)
  values (new.id)
  returning id into new_project_id;

  foreach each_page_key in array array['dashboard', 'customers', 'quotations', 'projects', 'payments']
  loop
    insert into public.project_pages (project_id, page_key)
    values (new_project_id, each_page_key);
  end loop;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_account();

-- Write path 1: the one-time style choice. Fails (raises) if the project
-- doesn't exist for this caller, or if style was already set -- both
-- conditions collapse to the same "no row matched the update" case, which
-- Postgres exposes via `not found` after an UPDATE.
create or replace function public.set_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_style not in ('ledger', 'hearth', 'blueprint') then
    raise exception 'invalid style: %', new_style;
  end if;

  update public.projects
  set style = new_style, updated_at = now()
  where account_id = auth.uid()
    and style is null;

  if not found then
    raise exception 'style already set or project not found';
  end if;
end;
$$;

revoke execute on function public.set_project_style(text) from public;
grant execute on function public.set_project_style(text) to authenticated;

-- Write path 2: saving a page's layout. This is where the paid gate is
-- actually enforced -- not in the app layer, here, so there is exactly one
-- place in the whole system that can let an unpaid save through, and it's
-- this three-line check.
create or replace function public.save_project_page(target_page_key text, new_layout jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
  is_paid boolean;
begin
  select id, paid into target_project_id, is_paid
  from public.projects
  where account_id = auth.uid();

  if target_project_id is null then
    raise exception 'project not found';
  end if;

  if not is_paid then
    raise exception 'payment required';
  end if;

  update public.project_pages
  set layout_json = new_layout, updated_at = now()
  where project_id = target_project_id
    and page_key = target_page_key;

  if not found then
    raise exception 'page not found: %', target_page_key;
  end if;
end;
$$;

revoke execute on function public.save_project_page(text, jsonb) from public;
grant execute on function public.save_project_page(text, jsonb) to authenticated;
```

- [ ] **Step 2: Apply the migration to the live Supabase project**

This repo has no local Docker/shadow database (established in earlier work on this repo — see `.superpowers/sdd/` history if present, or just proceed directly). Apply via the Supabase CLI against the real project, using a personal access token if the ambient CLI session isn't authenticated in this environment:

```bash
supabase db push
```

If that fails with an auth error, get `SUPABASE_ACCESS_TOKEN` from the environment or `.env.local` (do not print its value) and retry with:

```bash
SUPABASE_ACCESS_TOKEN=<token> supabase db push
```

- [ ] **Step 3: Verify RLS isolation with two real throwaway accounts — this is the one non-negotiable test in this whole plan**

There is no local Postgres to run an automated suite against (matches this repo's established pattern of verifying RLS against the live database directly rather than mocking it). Do this by hand, against the real project, using the Supabase Management API or the JS client from a scratch script:

1. Create two real test users via the Auth API (e.g. `test-a-<random>@example.com` / `test-b-<random>@example.com`, throwaway passwords) using the **anon key** client (`supabase.auth.signUp`), not the service role — this exercises the real trigger, same as production sign-up.
2. Confirm each got its own `accounts`/`projects`/`project_pages` rows (5 pages each) by querying with the **service role** key (bypasses RLS, for verification only).
3. Sign in as test-a (`supabase.auth.signInWithPassword`), and using **that session's** client (anon key + the session, not service role), attempt to `select * from project_pages where project_id = '<test-b's project id>'`. Confirm this returns **zero rows** (RLS blocks it), not an error — RLS silently filters, it doesn't throw.
4. As test-a, call `set_project_style('ledger')` for test-a's own project — confirm it succeeds. Call it a second time — confirm it raises (already set).
5. As test-a, call `save_project_page('dashboard', '{"foo":"bar"}')` — confirm it raises `payment required` (test-a's `paid` is still `false`).
6. Using the **service role** client, flip test-b's `projects.paid` to `true` directly (simulating the founder's manual action). Sign in as test-b, call `save_project_page('dashboard', '{"foo":"bar"}')` — confirm it now succeeds, and that a service-role read shows `layout_json` updated.
7. **Delete both test accounts** (via `supabase.auth.admin.deleteUser` with the service role, which cascades to `accounts`/`projects`/`project_pages` via the `on delete cascade` FKs) — do not leave throwaway accounts in the live project.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260818120000_customer_portal_schema.sql
git commit -m "Add customer portal schema: accounts, projects, project_pages, RLS, write RPCs"
```

---

### Task 2: Auth — proxy session refresh, session-aware Supabase clients, sign-up (with lead-linking), login

**Files:**
- Modify: `middleware.ts` → rename to `proxy.ts`
- Create: `lib/supabase/middleware-client.ts`
- Create: `lib/supabase/server-session.ts`
- Create: `app/[locale]/signup/page.tsx`
- Create: `app/[locale]/signup/signup-form.tsx`
- Create: `app/[locale]/login/page.tsx`
- Create: `app/[locale]/login/login-form.tsx`
- Modify: `messages/en.json`, `messages/zh.json` (add `auth.*` keys)

**Interfaces:**
- Consumes: `lib/supabase/client.ts`'s existing `createBrowserSupabaseClient()` (anon key, respects RLS) — the form components use this directly for `signUp`/`signInWithPassword`, no new client needed there.
- Produces: `getSessionUser()` from `lib/supabase/server-session.ts` — `async function getSessionUser(): Promise<{ id: string; email: string } | null>`, used by Task 4's portal layout to gate access server-side.

- [ ] **Step 1: Migrate `middleware.ts` to `proxy.ts`**

```bash
npx @next/codemod@canary middleware-to-proxy .
```

Confirm the result: `proxy.ts` now exists, `middleware.ts` is gone, and the exported function is named `proxy` (or default-exported) rather than `middleware`. If the codemod doesn't run cleanly in this environment, do it by hand: `git mv middleware.ts proxy.ts`, then rename the exported `middleware` function to `proxy`, keeping the body and `export const config` identical.

- [ ] **Step 2: Add the Supabase session-refresh helper**

```typescript
// lib/supabase/middleware-client.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session cookie on every request that passes
 * through the proxy, so a Server Component's `cookies()` read always sees
 * an up-to-date session rather than one that silently expired mid-visit.
 * This is the standard @supabase/ssr proxy pattern -- the cookie handlers
 * below are required exactly as shown, not optional boilerplate.
 */
export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Touching getUser() is what actually triggers the refresh when needed.
  await supabase.auth.getUser();

  return response;
}
```

- [ ] **Step 3: Wire it into `proxy.ts` alongside the existing next-intl proxy**

Read the current `proxy.ts` (post-rename) in full before editing — it currently only does `createMiddleware(routing)` (now the exported `proxy`). Compose both:

```typescript
// proxy.ts
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
```

- [ ] **Step 4: Add the server-side session reader for Server Components**

```typescript
// lib/supabase/server-session.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Read-only session lookup for Server Components. Only `getAll` is
 * implemented in the cookie adapter -- Server Components cannot set
 * cookies (see Next's cookies() docs: writes require a Server Function
 * or Route Handler), and this helper is never used to write.
 */
export async function getSessionUser(): Promise<{ id: string; email: string } | null> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // no-op: Server Components can't write cookies; the proxy
          // (Step 2/3 above) is what keeps the session fresh.
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) return null;
  return { id: user.id, email: user.email };
}
```

- [ ] **Step 5: Add `auth.*` i18n keys**

Add to both `messages/en.json` and `messages/zh.json`, following the existing flat-namespace convention (see `stylePicker.*` for the pattern):

```json
"auth": {
  "signupTitle": "创建账号",
  "signupEmailLabel": "邮箱",
  "signupPasswordLabel": "密码",
  "signupSubmit": "注册",
  "signupSwitchToLogin": "已经有账号？登录",
  "loginTitle": "登录",
  "loginSubmit": "登录",
  "loginSwitchToSignup": "还没有账号？注册",
  "errorInvalidCredentials": "邮箱或密码不正确。",
  "errorEmailTaken": "这个邮箱已经注册过了。",
  "errorGeneric": "出了点问题，请再试一次。"
}
```

(English file gets the literal English translations of the same keys — omitted here for brevity, but every key above must exist in `messages/en.json` too, e.g. `"signupTitle": "Create your account"`, etc.)

- [ ] **Step 6: Build the sign-up form (Client Component) and page (Server Component)**

```tsx
// app/[locale]/signup/signup-form.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function SignupForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get("lead");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createBrowserSupabaseClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: leadId ? { lead_id: leadId } : undefined,
      },
    });

    setPending(false);

    if (signUpError) {
      setError(
        signUpError.message.toLowerCase().includes("already registered")
          ? t("errorEmailTaken")
          : t("errorGeneric"),
      );
      return;
    }

    router.push("/portal");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-[13px] [font-weight:var(--fw-medium)]" htmlFor="signup-email">
          {t("signupEmailLabel")}
        </label>
        <input
          id="signup-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 [border-color:var(--color-ink-800)]"
        />
      </div>
      <div>
        <label className="block text-[13px] [font-weight:var(--fw-medium)]" htmlFor="signup-password">
          {t("signupPasswordLabel")}
        </label>
        <input
          id="signup-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 [border-color:var(--color-ink-800)]"
        />
      </div>
      {error ? <p className="text-[13px] [color:var(--color-clay-bright)]">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg px-4 py-2.5 text-[13px] text-[color:var(--color-on-primary)] [background-color:var(--color-primary)] [font-weight:var(--fw-semibold)] disabled:opacity-50"
      >
        {t("signupSubmit")}
      </button>
    </form>
  );
}
```

```tsx
// app/[locale]/signup/page.tsx
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const t = await getTranslations("auth");

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-[20px] [font-weight:var(--fw-semibold)]">{t("signupTitle")}</h1>
      <div className="mt-6">
        <SignupForm />
      </div>
    </main>
  );
}
```

(Remove the stray `useTranslations` import from `page.tsx` above if your editor flags it as unused — this file uses `getTranslations`, the async Server Component variant; `useTranslations` was listed by mistake and must not appear in the final file.)

- [ ] **Step 7: Build the login form and page (same structure as sign-up, different call)**

```tsx
// app/[locale]/login/login-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createBrowserSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setPending(false);

    if (signInError) {
      setError(t("errorInvalidCredentials"));
      return;
    }

    router.push("/portal");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-[13px] [font-weight:var(--fw-medium)]" htmlFor="login-email">
          {t("signupEmailLabel")}
        </label>
        <input
          id="login-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 [border-color:var(--color-ink-800)]"
        />
      </div>
      <div>
        <label className="block text-[13px] [font-weight:var(--fw-medium)]" htmlFor="login-password">
          {t("signupPasswordLabel")}
        </label>
        <input
          id="login-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 [border-color:var(--color-ink-800)]"
        />
      </div>
      {error ? <p className="text-[13px] [color:var(--color-clay-bright)]">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg px-4 py-2.5 text-[13px] text-[color:var(--color-on-primary)] [background-color:var(--color-primary)] [font-weight:var(--fw-semibold)] disabled:opacity-50"
      >
        {t("loginSubmit")}
      </button>
    </form>
  );
}
```

```tsx
// app/[locale]/login/page.tsx
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const t = await getTranslations("auth");

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-[20px] [font-weight:var(--fw-semibold)]">{t("loginTitle")}</h1>
      <div className="mt-6">
        <LoginForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Verify**

Run `npx tsc --noEmit` (clean). Start the dev server, use Playwright to: sign up a throwaway test account at `/zh/signup`, confirm redirect to `/portal`, confirm (via the service-role client or Supabase Studio) that `accounts`/`projects`/5×`project_pages` rows now exist for that user. Sign out, sign back in at `/zh/login` with the same credentials, confirm it succeeds. Delete the throwaway account afterward (same cleanup discipline as Task 1 Step 3).

- [ ] **Step 9: Commit**

```bash
git add proxy.ts lib/supabase/middleware-client.ts lib/supabase/server-session.ts app/\[locale\]/signup app/\[locale\]/login messages/en.json messages/zh.json
git rm middleware.ts 2>/dev/null || true
git commit -m "Add Supabase-backed sign-up and login, migrate middleware.ts to proxy.ts"
```

---

### Task 2a: Email confirmation flow (inserted — the human partner wants real email verification, not a shortcut)

**Why this task exists:** Task 2's implementer found that this Supabase project has "Confirm email" enabled, which means a real `signUp()` returns no error but also no session until the visitor clicks the confirmation link in their inbox — Task 2's redirect-to-`/portal` logic only checked for an error, not for a session, so a real signup today would silently fail to land anyone in their account. The implementer's own suggestion was to disable email confirmation to sidestep this. The human partner explicitly rejected that: they want this to read as a real product, not a corner cut for lack of time, so this task builds the actual confirmation flow instead of turning the setting off.

**Files:**
- Modify: `app/[locale]/signup/signup-form.tsx` (detect the no-session-after-signup case, show a confirmation-pending state instead of redirecting)
- Create: `app/auth/confirm/route.ts` (the callback Supabase's confirmation link hits — deliberately outside `app/[locale]/`, since Supabase's email link has no knowledge of next-intl locale routing)
- Modify: `lib/supabase/server.ts` or create `lib/supabase/route-handler-client.ts` (a session-aware Supabase client with a **writable** cookie adapter — Task 2's `server-session.ts` has a deliberate no-op `setAll` because Server Components can't write cookies; a Route Handler can and must, to actually persist the session `verifyOtp` establishes)
- Modify: `messages/en.json`, `messages/zh.json` (add `auth.confirmPendingTitle`/`auth.confirmPendingBody`, `auth.confirmError`)
- Configuration (not a file in this repo): update the Supabase project's "Confirm Signup" email template and confirm the redirect/site URL — see Step 3.

**Interfaces:**
- Consumes: Task 2's `createBrowserSupabaseClient()` (unchanged), the existing `auth.*` i18n namespace.
- Produces: `app/auth/confirm/route.ts`'s `GET` handler — the target Supabase's email link points at, not consumed by any other code in this repo.

- [ ] **Step 1: Read the exact current Supabase pattern before writing anything**

This plan was written after fetching Supabase's own current docs for this exact flow (`https://supabase.com/docs/guides/auth/server-side/email-based-auth-with-pkce-flow-for-ssr`) — re-fetch it yourself before implementing, since auth SDK patterns are exactly the kind of thing that drifts from training data. The confirmed-current shape at plan-writing time:

```typescript
// app/auth/confirm/route.ts
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler-client";

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
```

- [ ] **Step 2: Build the writable Route-Handler Supabase client**

Route Handlers, unlike Server Components, can write cookies (this repo's own `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` confirms: "`.set` ... must be used in a Server Function or Route Handler"). This needs a real `setAll`, not the no-op Task 2's `server-session.ts` uses:

```typescript
// lib/supabase/route-handler-client.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createRouteHandlerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );
}
```

- [ ] **Step 3: Update the Supabase project's email template and redirect configuration**

The default "Confirm Signup" template's `{{ .ConfirmationURL }}` needs to point at the new route instead. Attempt this via the Supabase CLI/Management API first (`supabase` CLI is linked and logged in to the correct project in this checkout); if it returns a 403 privilege error (this project's current CLI login has hit 403s on some config-level endpoints in Task 1's work — `migration list` and `config push` both did), that means this specific change needs the human partner to make it by hand in the dashboard (**Authentication → Email Templates → Confirm signup**, Supabase dashboard for the "Wei2Chee" project) — stop and ask for that if the API/CLI route is blocked, rather than leaving the email template silently unfixed. The template's confirmation link should read:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/portal">Confirm email address</a>
```

Also confirm the project's configured **Site URL** and **Redirect URLs** (Authentication → URL Configuration) include this app's real deployed origin (`https://wei2chee.vercel.app`) and, for local testing, `http://localhost:3000` — Supabase rejects confirmation redirects to URLs not on this allowlist. Same escalation rule: try via CLI/API first, ask the human partner if blocked.

- [ ] **Step 4: Update `signup-form.tsx` to handle the no-session case**

```tsx
// app/[locale]/signup/signup-form.tsx -- inside handleSubmit, replace the unconditional
// router.push("/portal") with a session check
const supabase = createBrowserSupabaseClient();
const { data, error: signUpError } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: leadId ? { lead_id: leadId } : undefined,
  },
});

setPending(false);

if (signUpError) {
  setError(/* unchanged */);
  return;
}

if (!data.session) {
  setConfirmPending(true); // new state, add `const [confirmPending, setConfirmPending] = useState(false)`
  return;
}

router.push("/portal");
```

Add a rendered branch for `confirmPending` (replacing the form, matching this file's existing token-driven styling conventions) showing `t("confirmPendingTitle")`/`t("confirmPendingBody")` — something like "去邮箱确认" / "Check your inbox to confirm your account before continuing."

- [ ] **Step 5: Add the i18n keys**

```json
"auth": {
  "confirmPendingTitle": "请确认你的邮箱",
  "confirmPendingBody": "我们发了一封确认邮件到你的邮箱，点击里面的链接完成注册。",
  "confirmError": "确认链接无效或已过期，请重新注册。"
}
```
(Plus English equivalents in `messages/en.json`, and a minimal `app/auth/confirm-error/page.tsx` rendering `confirmError` with a link back to `/login` — this route has no locale segment for the same reason `app/auth/confirm/route.ts` doesn't; keep its copy hardcoded bilingual or default to one language, this is a rare-path error page, not worth wiring into next-intl's locale routing.)

- [ ] **Step 6: Verify end-to-end with a real email**

This is the one part of this task that can't be faked with `admin.createUser({ email_confirm: true })`, since that flag skips confirmation entirely — the whole point here is testing the flow that requires it. Use a real, reachable throwaway inbox you control (not a disposable-domain address — this project already blocks those) to sign up through the actual `/zh/signup` UI, confirm the "check your inbox" state renders, retrieve the real confirmation email, click the link (or extract and visit the URL directly if driving a real inbox via Playwright isn't practical), confirm it lands on `/portal` with a real session, then delete the throwaway account via the service-role client afterward.

If a real inbox isn't practically available in this environment, do the next-best verification: use `supabase.auth.admin.generateLink({ type: "signup", email, password })` with the service-role client to get a real `token_hash` without needing an actual email to arrive, hit `/auth/confirm?token_hash=<hash>&type=signup` directly, and confirm it establishes a session and redirects correctly — this exercises the route handler and `verifyOtp` call for real, just without the email-transport leg. State clearly in your report which verification method you used and why.

Run `npx tsc --noEmit` (clean).

- [ ] **Step 7: Commit**

```bash
git add app/\[locale\]/signup/signup-form.tsx app/auth/confirm/route.ts app/auth/confirm-error lib/supabase/route-handler-client.ts messages/en.json messages/zh.json
git commit -m "Add real email confirmation flow instead of disabling Supabase's Confirm Email setting"
```

---

### Task 3: Style-selection step inside the portal

**Files:**
- Modify: `app/[locale]/style-picker/style-column.tsx`
- Create: `app/[locale]/style-picker/__tests__/style-column.test.tsx`
- Create: `app/[locale]/portal/style-select/page.tsx`
- Create: `app/[locale]/portal/style-select/style-select-client.tsx`
- Modify: `messages/en.json`, `messages/zh.json` (add `portal.styleSelect.*` keys)

**Interfaces:**
- Consumes: `StyleColumn` (modified below), `SampleContent` (unchanged, from `app/[locale]/style-picker/sample-content.tsx`), `getSessionUser()` from Task 2.
- Produces: nothing new consumed by later tasks directly, but this is the gate Task 4's portal layout redirects through when `projects.style` is null.

- [ ] **Step 1: Write the failing test for `StyleColumn`'s new `onSelect` path**

`StyleColumn` currently always renders a `wa.me` link. It needs a second mode: when an `onSelect` callback is passed, render a real `<button>` that calls it, instead of the WhatsApp anchor — and in that mode `whatsappPrefillText` isn't needed. Read the current file in full before editing (shown in this plan's Task 4 context of the design-system plan if you want the fuller history — but the current content is authoritative, read it fresh).

```tsx
// app/[locale]/style-picker/__tests__/style-column.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { StyleColumn } from "../style-column";

test("renders a WhatsApp link when no onSelect is given (existing public-page behavior)", () => {
  render(
    <StyleColumn
      styleName="ledger"
      label="Ledger"
      description="desc"
      selectCta="选这个风格"
      whatsappPrefillText="我选择 Ledger 风格"
    />,
  );
  const link = screen.getByTestId("style-picker-select-ledger");
  expect(link.tagName).toBe("A");
  expect(link).toHaveAttribute("href", expect.stringContaining("wa.me"));
});

test("renders a button and calls onSelect when onSelect is given (portal behavior)", () => {
  const onSelect = vi.fn();
  render(
    <StyleColumn
      styleName="hearth"
      label="Hearth"
      description="desc"
      selectCta="选这个风格"
      onSelect={onSelect}
    />,
  );
  const button = screen.getByTestId("style-picker-select-hearth");
  expect(button.tagName).toBe("BUTTON");
  fireEvent.click(button);
  expect(onSelect).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/\[locale\]/style-picker/__tests__/style-column.test.tsx`
Expected: FAIL (`onSelect` prop doesn't exist yet, button path isn't implemented).

- [ ] **Step 3: Modify `StyleColumn` to support both modes**

Change the props type and the CTA rendering. Keep everything else in the file (the Blueprint-only grid/sheet-marks/annotation logic) untouched:

```tsx
export function StyleColumn({
  styleName,
  label,
  description,
  selectCta,
  whatsappPrefillText,
  onSelect,
}: {
  styleName: StyleName;
  label: string;
  description: string;
  selectCta: string;
  /** Already-localized prefill text, e.g. "I'd like the Ledger style". Required when onSelect is not given. */
  whatsappPrefillText?: string;
  /** When given, renders a real button calling this instead of a WhatsApp link -- used by the portal's style-selection step, not the public comparison page. */
  onSelect?: () => void;
}) {
  const whatsappHref = whatsappPrefillText
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappPrefillText)}`
    : undefined;

  // ...unchanged isBlueprint / grid / sheet-marks logic...

  return (
    <div /* ...unchanged... */>
      {/* ...unchanged heading/description/SampleContent... */}

      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          data-testid={`style-picker-select-${styleName}`}
          className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-[13px] text-[color:var(--color-on-primary)] transition-colors [background-color:var(--color-primary)] [font-weight:var(--fw-semibold)] [transition-duration:var(--dur)] [transition-timing-function:var(--ease-out-quad)] hover:[background-color:var(--color-primary-deep)]"
        >
          {selectCta}
        </button>
      ) : (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`style-picker-select-${styleName}`}
          className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-[13px] text-[color:var(--color-on-primary)] transition-colors [background-color:var(--color-primary)] [font-weight:var(--fw-semibold)] [transition-duration:var(--dur)] [transition-timing-function:var(--ease-out-quad)] hover:[background-color:var(--color-primary-deep)]"
        >
          {selectCta}
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/\[locale\]/style-picker/__tests__/style-column.test.tsx`
Expected: PASS, 2/2. Also run `npx vitest run app/\[locale\]/style-picker/__tests__/style-scope.sync.test.ts` to confirm this change didn't touch anything that test covers (it shouldn't — no token or CSS-module changes here).

- [ ] **Step 5: Add `portal.styleSelect.*` i18n keys**

```json
"portal": {
  "styleSelect": {
    "title": "选择你的系统风格",
    "subtitle": "这个选择之后不能更改，请仔细比较后再决定。"
  }
}
```
(Plus the English equivalents in `messages/en.json`.)

- [ ] **Step 6: Build the style-select page**

```tsx
// app/[locale]/portal/style-select/style-select-client.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { StyleColumn, type StyleName } from "@/app/[locale]/style-picker/style-column";

const STYLES: StyleName[] = ["ledger", "hearth", "blueprint"];

export function StyleSelectClient() {
  const t = useTranslations("stylePicker");
  const router = useRouter();
  const [pending, setPending] = useState<StyleName | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(style: StyleName) {
    setPending(style);
    setError(null);

    const supabase = createBrowserSupabaseClient();
    const { error: rpcError } = await supabase.rpc("set_project_style", { new_style: style });

    if (rpcError) {
      setPending(null);
      setError(rpcError.message);
      return;
    }

    router.push(`/portal/dashboard`);
  }

  return (
    <>
      {error ? <p className="mb-4 text-[13px] [color:var(--color-clay-bright)]">{error}</p> : null}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {STYLES.map((style) => (
          <StyleColumn
            key={style}
            styleName={style}
            label={t(`styles.${style}.label`)}
            description={t(`styles.${style}.description`)}
            selectCta={pending === style ? "…" : t("selectCta")}
            onSelect={() => handleSelect(style)}
          />
        ))}
      </div>
    </>
  );
}
```

```tsx
// app/[locale]/portal/style-select/page.tsx
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/supabase/server-session";
import { StyleSelectClient } from "./style-select-client";

export default async function StyleSelectPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const t = await getTranslations("portal.styleSelect");

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-[24px] [font-weight:var(--fw-semibold)]">{t("title")}</h1>
      <p className="mt-2 text-[14px] [color:var(--color-paper-dim)]">{t("subtitle")}</p>
      <div className="mt-10">
        <StyleSelectClient />
      </div>
    </main>
  );
}
```

Note: this page reuses the existing `t("styles.<name>.label")` / `t("styles.<name>.description")` / `t("selectCta")` keys already defined under the `stylePicker` namespace (used by the public `/style-picker` page) — no need to duplicate that copy under `portal.*`.

- [ ] **Step 7: Verify**

Run `npx tsc --noEmit` (clean) and the full `npx vitest run` (all tests, including the new ones, pass with zero regressions).

- [ ] **Step 8: Commit**

```bash
git add app/\[locale\]/style-picker/style-column.tsx app/\[locale\]/style-picker/__tests__/style-column.test.tsx app/\[locale\]/portal/style-select messages/en.json messages/zh.json
git commit -m "Add portal style-selection step, extend StyleColumn with a button mode"
```

---

### Task 4: Puck installation, component registration, and portal routing/auth guard

**Files:**
- Create: `design-system/editor/puck-config.tsx`
- Create: `app/[locale]/portal/layout.tsx`
- Create: `app/[locale]/portal/page.tsx`
- Create: `app/[locale]/portal/[pageKey]/page.tsx`
- Create: `app/[locale]/portal/[pageKey]/editor-client.tsx`
- Modify: `package.json`, `package-lock.json` (add `@puckeditor/core`)

**Interfaces:**
- Consumes: `getSessionUser()` (Task 2), `set_project_style`/project lookup patterns from Task 3, all 21 `design-system/components/*.tsx` exports.
- Produces: `puckConfig`, a `Config` object (from `@puckeditor/core`) that Task 5 imports to apply theming, and `editor-client.tsx`'s `<PortalEditor>` component that Task 6 extends with save/paywall logic.

- [ ] **Step 1: Install Puck**

```bash
npm install @puckeditor/core@0.23.0
```

- [ ] **Step 2: Read every design-system component's prop signature before wrapping any of them**

Read all 21 files under `design-system/components/*.tsx` in full (you already have their names from Task 2/3 of the design-system plan: `field`, `page-header`, `empty-state`, `status-dot`, `modal`, `listbox`, `combobox`, `data-grid`, `date-picker`, `month-picker`, `filter-chips`, `columns-menu`, `text-autocomplete`, `confirm-submit-button`, `receipt-field`, `anchored-panel`, `avatar`, `rail-nav`, `mobile-nav`, `notification-toast`, `hero-card`). Puck's `fields` config needs a field type per prop, and several of these components take non-primitive props (render-prop children, `ReactNode`, arrays of objects) that Puck's built-in field types (`text`, `textarea`, `number`, `select`) cannot represent directly.

**Do not attempt to wrap every prop of every component.** For this first integration pass, register a smaller, deliberately curated subset whose props are Puck-field-friendly, and skip the rest (documenting which, and why, in this task's PR/commit message) rather than inventing complex custom Puck fields for exotic prop shapes — that complexity can be added component-by-component later, once the basic editor is proven end-to-end. Register at minimum: `PageHeader`, `EmptyState`, `StatusDot`, `HeroCard`, and `Avatar` — these five all take simple string/enum props with no render-prop or array-of-object requirements, based on their signatures documented in the design-system plan's Task 2/3 reports.

- [ ] **Step 3: Write the Puck config**

```tsx
// design-system/editor/puck-config.tsx
import type { Config } from "@puckeditor/core";
import { PageHeader } from "@/design-system/components/page-header";
import { EmptyState } from "@/design-system/components/empty-state";
import { StatusDot } from "@/design-system/components/status-dot";
import { HeroCard } from "@/design-system/components/hero-card";
import { Avatar } from "@/design-system/components/avatar";

type Components = {
  PageHeader: { title: string; subtitle?: string };
  EmptyState: { variant: "empty" | "filtered" | "cleared"; title: string; description?: string };
  StatusDot: { tone: "positive" | "warning" | "negative" | "neutral"; label: string };
  HeroCard: { title: string; value: string };
  Avatar: { name: string };
};

export const puckConfig: Config<Components> = {
  components: {
    PageHeader: {
      fields: {
        title: { type: "text" },
        subtitle: { type: "text" },
      },
      defaultProps: { title: "标题" },
      render: ({ title, subtitle }) => <PageHeader title={title} subtitle={subtitle} />,
    },
    EmptyState: {
      fields: {
        variant: {
          type: "select",
          options: [
            { label: "Empty", value: "empty" },
            { label: "Filtered", value: "filtered" },
            { label: "Cleared", value: "cleared" },
          ],
        },
        title: { type: "text" },
        description: { type: "textarea" },
      },
      defaultProps: { variant: "empty", title: "还没有内容" },
      render: ({ variant, title, description }) => (
        <EmptyState variant={variant} title={title} description={description} />
      ),
    },
    StatusDot: {
      fields: {
        tone: {
          type: "select",
          options: [
            { label: "Positive", value: "positive" },
            { label: "Warning", value: "warning" },
            { label: "Negative", value: "negative" },
            { label: "Neutral", value: "neutral" },
          ],
        },
        label: { type: "text" },
      },
      defaultProps: { tone: "neutral", label: "状态" },
      render: ({ tone, label }) => <StatusDot tone={tone} label={label} />,
    },
    HeroCard: {
      fields: {
        title: { type: "text" },
        value: { type: "text" },
      },
      defaultProps: { title: "本月营收", value: "RM 0" },
      render: ({ title, value }) => <HeroCard title={title} value={value} />,
    },
    Avatar: {
      fields: {
        name: { type: "text" },
      },
      defaultProps: { name: "客户" },
      render: ({ name }) => <Avatar name={name} />,
    },
  },
};
```

If any of the five components' real prop names differ from the guesses above (this plan was written without re-reading every one of the 21 files' current exact signatures token-by-token), **the real component file is the authority — fix the field/prop mismatch to match the actual export, don't force the component to match this plan.** Note any such fix in your task report the same way earlier design-system tasks documented brief-vs-real-source discrepancies.

- [ ] **Step 4: Build the portal's auth-guard layout**

```tsx
// app/[locale]/portal/layout.tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server-session";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <div className="min-h-screen [background:var(--color-canvas)]">{children}</div>;
}
```

- [ ] **Step 5: Build the `/portal` branch-router page**

This page has no UI of its own — it just decides where to send a logged-in visitor: style-select (if `projects.style` is still null) or straight to the dashboard editor page.

```tsx
// app/[locale]/portal/page.tsx
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/server-session";

export default async function PortalRootPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Service-role read here is fine and simpler than threading a
  // session-aware server client through one more file for a single
  // SELECT -- this route makes no decision based on data a customer
  // shouldn't see, it only branches on their own project's style field.
  const supabase = createServerSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("style")
    .eq("account_id", user.id)
    .single();

  if (!project?.style) redirect("/portal/style-select");
  redirect("/portal/dashboard");
}
```

- [ ] **Step 6: Build the editor page shell (no save/paywall logic yet — that's Task 6)**

```tsx
// app/[locale]/portal/[pageKey]/editor-client.tsx
"use client";

import { Puck } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { puckConfig } from "@/design-system/editor/puck-config";

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  customers: "Customers",
  quotations: "Quotations",
  projects: "Projects",
  payments: "Payments",
};

export function PortalEditor({
  pageKey,
  initialData,
}: {
  pageKey: string;
  initialData: Record<string, unknown>;
}) {
  return (
    <div className="flex h-screen flex-col">
      <div className="border-b px-4 py-2 text-[13px] [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)]">
        {PAGE_LABELS[pageKey] ?? pageKey}
      </div>
      <div className="flex-1">
        <Puck config={puckConfig} data={initialData} onPublish={() => {}} />
      </div>
    </div>
  );
}
```

```tsx
// app/[locale]/portal/[pageKey]/page.tsx
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/server-session";
import { PortalEditor } from "./editor-client";

const VALID_PAGE_KEYS = ["dashboard", "customers", "quotations", "projects", "payments"];

export default async function PortalEditorPage({ params }: { params: Promise<{ pageKey: string }> }) {
  const { pageKey } = await params;
  if (!VALID_PAGE_KEYS.includes(pageKey)) notFound();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = createServerSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, style")
    .eq("account_id", user.id)
    .single();

  if (!project) redirect("/login");
  if (!project.style) redirect("/portal/style-select");

  const { data: page } = await supabase
    .from("project_pages")
    .select("layout_json")
    .eq("project_id", project.id)
    .eq("page_key", pageKey)
    .single();

  return <PortalEditor pageKey={pageKey} initialData={(page?.layout_json as Record<string, unknown>) ?? {}} />;
}
```

(`params` is a `Promise` here — confirm this against `node_modules/next/dist/docs` for Next 16's current App Router convention before assuming it matches training data; if the installed version has since changed this back to a plain object, adjust accordingly and note the discrepancy in your report.)

- [ ] **Step 7: Verify**

Run `npx tsc --noEmit` (clean). Start the dev server, sign in as a test account that has already picked a style (reuse or recreate one from Task 2/3's verification), navigate to `/zh/portal/dashboard`, confirm Puck's editor renders with the five registered components available to drag, and that dragging one onto the canvas works (Puck's own drag-and-drop mechanics — confirming integration works, not re-testing the library itself).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json design-system/editor app/\[locale\]/portal
git commit -m "Install Puck, register 5 initial design-system components, wire portal routing and auth guard"
```

---

### Task 5: Re-skin Puck's editor chrome with Ledger tokens

**Files:**
- Create: `design-system/editor/puck-theme.css`
- Modify: `app/[locale]/portal/[pageKey]/editor-client.tsx`

**Interfaces:**
- Consumes: `design-system/tokens/ledger.css`'s custom properties (`--color-primary`, `--color-canvas`, `--color-ink-*`, `--fw-*`, `--hairline`, etc.) and Puck's own documented theming tokens (`--puck-color-*`, `--puck-radius-*`, etc. — see `https://puckeditor.com/docs/extending-puck/theming` for the full token list; read it before writing this file rather than guessing token names beyond the ones shown below).

- [ ] **Step 1: Write the theme file, mapping Puck's tokens onto Ledger's**

```css
/* design-system/editor/puck-theme.css */

/*
  The portal editor's own chrome is always Ledger, regardless of which
  style the customer picked for their canvas content (see the design
  spec §4 -- this distinction is deliberate: the toolbar/sidebar/canvas
  frame is Formae's own tool interface, not something the customer is
  designing). Every value below is a var() reference into ledger.css,
  never a literal color -- this file must stay token-driven for the
  same reason every other file in design-system/ is.
*/
.portal-editor-scope {
  --puck-color-interactive: var(--color-primary);
  --puck-color-interactive-hover: var(--color-primary-deep);
  --puck-color-interactive-active: var(--color-primary-deep);
  --puck-color-interactive-subtle: var(--color-primary-soft);

  --puck-color-grey-01: var(--color-canvas);
  --puck-color-grey-02: var(--color-ink-950);
  --puck-color-grey-03: var(--color-ink-900);
  --puck-color-grey-11: var(--color-ink-800);
  --puck-color-grey-12: var(--color-paper);

  --puck-font-family: inherit;
  --puck-font-weight-medium: var(--fw-medium);
  --puck-font-weight-bold: var(--fw-semibold);

  --puck-radius-s: 4px;
  --puck-radius-m: 8px;
  --puck-radius-l: 12px;
}
```

If, after reading `https://puckeditor.com/docs/extending-puck/theming` directly, the actual current token names differ from the `--puck-color-grey-NN` guesses above (this plan's author confirmed `--puck-color-interactive*` from the docs but not the full grey scale's exact numbering), **fix the token names to match the real documented list** rather than shipping a theme file with dead overrides that silently do nothing.

- [ ] **Step 2: Import the theme and scope it onto the editor**

```tsx
// app/[locale]/portal/[pageKey]/editor-client.tsx  (add these two lines, keep the rest from Task 4)
import "@puckeditor/core/puck.css";
import "@/design-system/editor/puck-theme.css";
```

Add the `portal-editor-scope` class to the outermost `<div>` in `PortalEditor`'s returned JSX from Task 4 (the `flex h-screen flex-col` div) so the CSS custom property overrides apply to everything inside, including Puck's own chrome.

- [ ] **Step 3: Verify visually — this is the actual acceptance test for this task**

Run `npx tsc --noEmit` (clean). Start the dev server, sign in, open `/zh/portal/dashboard`, take a Playwright screenshot. Compare against Puck's default appearance (its own docs/demo site, or the pre-theming screenshot from Task 4's verification if you kept one): confirm the accent color, background, and radii now visibly read as Ledger rather than Puck's stock blue/grey default. This directly serves the "no AI 味, professional, design-forward" requirement carried from this session's brainstorming — if the editor still looks like an unmodified open-source tool bolted on, this task isn't done.

- [ ] **Step 4: Commit**

```bash
git add design-system/editor/puck-theme.css app/\[locale\]/portal/\[pageKey\]/editor-client.tsx
git commit -m "Re-skin Puck's editor chrome with Ledger tokens"
```

---

### Task 5a: Fix canvas-content styling inside Puck's iframe (inserted — dragged components render broken)

**Why this task exists:** Task 5's implementer found, and its review independently confirmed live, that Puck renders its canvas in a `srcdoc` iframe. The iframe copies the parent document's compiled stylesheet wholesale, but nothing inside the iframe's own DOM ever gets the `.ledger`/`.hearth`/`.blueprint` scope class applied to it — so the copied CSS rules that *define* the `--color-*` custom properties (`.ledger { --color-primary: ...; }` etc.) have no element to attach to inside the iframe, and every design-system component dragged onto the canvas renders with unresolved tokens (confirmed live: a dragged `HeroCard` showed near-invisible text on no background). Task 5 fixed this for chrome (by applying the scope class to the parent-document wrapper, which chrome lives in) and partially patched the worst canvas symptom (the leaked dark marketing-site body background), but explicitly did not fix component-level styling — that's this task.

This also completes a design intent stated but not yet wired: canvas *content* should render in whichever style the customer picked in Task 3 (`projects.style`), not be hardcoded to Ledger — chrome stays Ledger regardless (Task 5's own design, confirmed correct by its review), only the canvas differs per customer.

**Files:**
- Modify: `app/[locale]/portal/[pageKey]/editor-client.tsx` (pass `style` through, apply it to the canvas)
- Modify: `app/[locale]/portal/[pageKey]/page.tsx` (already reads `project.style` per Task 4 — thread it into `PortalEditor`'s props, it currently isn't)
- Modify: `design-system/editor/puck-theme.css` (remove now-unnecessary iframe-leak workarounds if the iframe-disable approach in Step 1 makes them dead code — confirm before deleting, don't assume)

**Interfaces:**
- Consumes: `Puck`'s `iframe` prop (from `@puckeditor/core`), `style-scope.module.css`'s existing `.ledger`/`.hearth`/`.blueprint` classes (Task 5 already imports this file — reuse, don't duplicate).
- Produces: canvas content that genuinely resolves `var(--color-*)` tokens to the customer's chosen style's real values, not Ledger's regardless of choice, not unresolved/invisible.

- [ ] **Step 1: Try disabling Puck's iframe entirely — likely the cleanest fix**

Puck supports `<Puck iframe={{ enabled: false }} config={...} data={...} ... />`, which renders the canvas directly in the parent document instead of a `srcdoc` iframe (confirmed via Puck's own docs, `puckeditor.com/docs/api-reference/overrides/iframe` and the "Puck 0.22: Theming & styling improvements" release notes — re-fetch these yourself before implementing, don't take this plan's summary as gospel this far downstream). If the canvas renders in the same document as the chrome, it can simply live inside the same `.ledger`/`.hearth`/`.blueprint`-scoped wrapper Task 5 already built for chrome (or a sibling wrapper scoped to the *canvas's* own style, separate from the chrome wrapper's fixed Ledger scope — see Step 2), and every CSS-boundary problem Task 5 had to hack around disappears, because there's no longer a boundary.

**Known tradeoff, confirm it doesn't matter here:** disabling the iframe also disables Puck's viewport-switching feature (responsive preview at different widths). Nothing in this plan's scope (Tasks 1-7) asks for viewport switching — confirm this is genuinely unused before proceeding, and note in your report if you find otherwise.

- [ ] **Step 2: Apply the customer's chosen style to canvas content, chrome stays Ledger**

`app/[locale]/portal/[pageKey]/page.tsx` already reads `project.style` (Task 4) but currently never passes it to `PortalEditor`. Thread it through as a prop. Inside `editor-client.tsx`, the chrome wrapper (Task 5's `.portal-editor-scope` + `.ledger`) stays exactly as-is — do not change chrome to follow the customer's style, that's a deliberate, already-reviewed design decision. Wrap only the canvas region (or, if Step 1's iframe-disable means canvas and chrome now share one DOM tree, wrap just the canvas's rendered subtree) in a **second**, independent scope class matching `style-scope.module.css`'s `SCOPE_CLASS[project.style]` (the same lookup `style-column.tsx` already uses) — chrome and canvas can legitimately be two different registers at once (Ledger tool, Hearth content, say), and `style-scope.module.css`'s classes are designed to nest/coexist since that's exactly what the public `/style-picker` page already does with three side-by-side instances.

- [ ] **Step 3: Verify Task 5's now-possibly-dead workarounds, remove if genuinely dead**

If Step 1's iframe-disable eliminates the CSS boundary entirely, `puck-theme.css`'s iframe body-background override and the `--color-paper` literal-fallback fix (both added in Task 5, the second one in Task 5's own fix round) may now be unreachable dead code — there's no more iframe `body` to leak into or resolve tokens incorrectly inside. Confirm this precisely (don't assume) by checking whether Puck's rendered DOM still contains any element these rules could still match once `iframe.enabled: false`; if genuinely dead, remove them and say so in your report with the reasoning; if any part is still reachable for a reason you find, leave it and explain why.

- [ ] **Step 4: Verify visually — this task's real acceptance test**

Run `npx tsc --noEmit` (clean). Start the dev server, sign in as a test account with `style` set to something other than `ledger` (e.g. `hearth`, so chrome-vs-canvas divergence is visually obvious — chrome should stay Ledger blue/navy, canvas content should read as Hearth's sage/teal register), navigate to `/zh/portal/dashboard`, drag `HeroCard` onto the canvas, take a screenshot. Confirm: the dragged component's text and background now render with real, legible, correctly-resolved colors (not near-invisible), and the canvas's own colors visibly differ from the chrome's (proving the two-scope design from Step 2 actually took effect, not just "canvas happens to look okay by accident"). Clean up the test account, confirm deletion.

- [ ] **Step 5: Commit**

```bash
git add app/\[locale\]/portal/\[pageKey\]/editor-client.tsx app/\[locale\]/portal/\[pageKey\]/page.tsx design-system/editor/puck-theme.css
git commit -m "Fix canvas-content styling inside Puck (disable iframe boundary, apply customer's chosen style to canvas)"
```

---

### Task 6: Save/paywall gating and the free-tier local draft safety net

**Files:**
- Modify: `app/[locale]/portal/[pageKey]/editor-client.tsx`
- Create: `app/[locale]/portal/[pageKey]/__tests__/local-draft.test.ts`
- Create: `app/[locale]/portal/local-draft.ts`
- Modify: `messages/en.json`, `messages/zh.json` (add `portal.editor.*` keys)

**Interfaces:**
- Consumes: `save_project_page` RPC (Task 1), `WHATSAPP_NUMBER` from `lib/brand.ts`.
- Produces: `readLocalDraft(projectId, pageKey)` / `writeLocalDraft(projectId, pageKey, data)` from `local-draft.ts`, pure functions Task 7 doesn't need but future portal pages might.

- [ ] **Step 1: Write the failing test for the local-draft helpers**

```typescript
// app/[locale]/portal/[pageKey]/__tests__/local-draft.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { readLocalDraft, writeLocalDraft, localDraftKey } from "../../local-draft";

describe("local draft safety net", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing has been saved yet", () => {
    expect(readLocalDraft("proj-1", "dashboard")).toBeNull();
  });

  it("round-trips a written draft", () => {
    const data = { content: [{ type: "PageHeader", props: { title: "hi" } }] };
    writeLocalDraft("proj-1", "dashboard", data);
    expect(readLocalDraft("proj-1", "dashboard")).toEqual(data);
  });

  it("keys drafts separately per project and page", () => {
    writeLocalDraft("proj-1", "dashboard", { a: 1 });
    writeLocalDraft("proj-1", "customers", { a: 2 });
    writeLocalDraft("proj-2", "dashboard", { a: 3 });

    expect(readLocalDraft("proj-1", "dashboard")).toEqual({ a: 1 });
    expect(readLocalDraft("proj-1", "customers")).toEqual({ a: 2 });
    expect(readLocalDraft("proj-2", "dashboard")).toEqual({ a: 3 });
  });

  it("produces the expected storage key shape", () => {
    expect(localDraftKey("proj-1", "dashboard")).toBe("formae-portal-draft:proj-1:dashboard");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "app/[locale]/portal/[pageKey]/__tests__/local-draft.test.ts"`
Expected: FAIL (`../../local-draft` doesn't exist yet).

- [ ] **Step 3: Implement the local-draft helpers**

```typescript
// app/[locale]/portal/local-draft.ts

/**
 * Passive, best-effort local safety net for free-tier customers, who have
 * no server-side save (see save_project_page's payment-required check).
 * Never a substitute for the real save -- it doesn't sync across devices
 * and is silently dropped if localStorage is unavailable (private
 * browsing, quota exceeded, etc.).
 */
export function localDraftKey(projectId: string, pageKey: string): string {
  return `formae-portal-draft:${projectId}:${pageKey}`;
}

export function readLocalDraft(projectId: string, pageKey: string): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(localDraftKey(projectId, pageKey));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeLocalDraft(projectId: string, pageKey: string, data: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(localDraftKey(projectId, pageKey), JSON.stringify(data));
  } catch {
    // localStorage full or unavailable -- this is a best-effort safety
    // net, not a guarantee, so fail silently rather than interrupting
    // the customer's editing.
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "app/[locale]/portal/[pageKey]/__tests__/local-draft.test.ts"`
Expected: PASS, 4/4.

- [ ] **Step 5: Add `portal.editor.*` i18n keys**

```json
"portal": {
  "editor": {
    "paywallTitle": "你的设计已经准备好了",
    "paywallBody": "付款后即可保存你的设计。",
    "paywallCta": "联系我们付款",
    "saveSuccess": "已保存",
    "saveError": "保存失败，请重试。"
  }
}
```
(Plus English equivalents.)

- [ ] **Step 6: Wire save/paywall logic and the local-draft mirror into the editor**

```tsx
// app/[locale]/portal/[pageKey]/editor-client.tsx  (full replacement of the previous version from Tasks 4-5)
"use client";

import { useState } from "react";
import { Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import "@/design-system/editor/puck-theme.css";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { WHATSAPP_NUMBER } from "@/lib/brand";
import { puckConfig } from "@/design-system/editor/puck-config";
import { readLocalDraft, writeLocalDraft } from "../local-draft";

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  customers: "Customers",
  quotations: "Quotations",
  projects: "Projects",
  payments: "Payments",
};

type SaveState = "idle" | "saving" | "saved" | "error" | "paywall";

export function PortalEditor({
  pageKey,
  projectId,
  paid,
  initialData,
}: {
  pageKey: string;
  projectId: string;
  paid: boolean;
  initialData: Record<string, unknown>;
}) {
  const t = useTranslations("portal.editor");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const startingData = (readLocalDraft(projectId, pageKey) as Data) ?? (initialData as Data);

  async function handleChange(data: Data) {
    // Passive mirror on every change, independent of the explicit save
    // action below -- see local-draft.ts's own doc comment.
    writeLocalDraft(projectId, pageKey, data as Record<string, unknown>);
  }

  async function handleSaveClick(data: Data) {
    if (!paid) {
      setSaveState("paywall");
      return;
    }

    setSaveState("saving");
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc("save_project_page", {
      target_page_key: pageKey,
      new_layout: data,
    });
    setSaveState(error ? "error" : "saved");
  }

  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "我的设计已经准备好了，我想付款保存",
  )}`;

  return (
    <div className="portal-editor-scope flex h-screen flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2 text-[13px] [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)]">
        <span>{PAGE_LABELS[pageKey] ?? pageKey}</span>
        {saveState === "saved" ? <span className="[color:var(--color-jade-bright)]">{t("saveSuccess")}</span> : null}
        {saveState === "error" ? <span className="[color:var(--color-clay-bright)]">{t("saveError")}</span> : null}
      </div>

      {saveState === "paywall" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <h2 className="text-[18px] [font-weight:var(--fw-semibold)]">{t("paywallTitle")}</h2>
          <p className="text-[14px] [color:var(--color-paper-dim)]">{t("paywallBody")}</p>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 rounded-lg px-4 py-2.5 text-[13px] text-[color:var(--color-on-primary)] [background-color:var(--color-primary)] [font-weight:var(--fw-semibold)]"
          >
            {t("paywallCta")}
          </a>
          <button
            type="button"
            onClick={() => setSaveState("idle")}
            className="text-[13px] underline [color:var(--color-paper-dim)]"
          >
            返回编辑
          </button>
        </div>
      ) : (
        <div className="flex-1">
          <Puck
            config={puckConfig}
            data={startingData}
            onChange={handleChange}
            onPublish={handleSaveClick}
          />
        </div>
      )}
    </div>
  );
}
```

Update `page.tsx` (Task 4) to pass the two new required props:

```tsx
// app/[locale]/portal/[pageKey]/page.tsx  (only the render line changes)
return (
  <PortalEditor
    pageKey={pageKey}
    projectId={project.id}
    paid={Boolean((project as { paid?: boolean }).paid)}
    initialData={(page?.layout_json as Record<string, unknown>) ?? {}}
  />
);
```

...and add `paid` to that page's `.select("id, style")` call (Task 4) — change it to `.select("id, style, paid")`.

- [ ] **Step 7: Verify**

Run `npx tsc --noEmit` (clean) and the full `npx vitest run` suite (all pass, no regressions). Manually, using an unpaid test account: open the editor, drag a component, click Publish/save — confirm the paywall state appears (not an error), and that reloading the page still shows the dragged component (local-draft round-trip working). Using a test account whose `paid` was flipped to `true` via Supabase Studio (or the service-role client, matching Task 1 Step 3's verification pattern): confirm save actually persists — reload from a fresh tab with no local draft and confirm the saved layout still loads from the server.

- [ ] **Step 8: Commit**

```bash
git add app/\[locale\]/portal/\[pageKey\]/editor-client.tsx app/\[locale\]/portal/\[pageKey\]/__tests__/local-draft.test.ts app/\[locale\]/portal/local-draft.ts app/\[locale\]/portal/\[pageKey\]/page.tsx messages/en.json messages/zh.json
git commit -m "Add save/paywall gating and free-tier local draft safety net"
```

---

### Task 7: Deploy handoff, acquisition-site entry point, and final i18n/routing polish

**Files:**
- Modify: `app/[locale]/portal/[pageKey]/editor-client.tsx`
- Modify: `messages/en.json`, `messages/zh.json` (add `portal.editor.deployCta`; remove the now-dead `cta.placeholderNotice`)
- Modify: `app/[locale]/page.tsx` (thread `leadId` through instead of discarding it)
- Modify: `components/sections/conversion-cta.tsx` (resolve its existing placeholder "Continue" button into the real sign-up link)

**Interfaces:**
- Consumes: `save_project_page`'s implicit "already paid" guarantee (Deploy is only offered once a save has succeeded at least once — see Step 1), `WHATSAPP_NUMBER`.

- [ ] **Step 1: Add the Deploy action, gated behind having saved at least once**

Add a `hasSavedOnce` piece of state (true once `saveState` has reached `"saved"` at least one time in this session, or — more robustly — once `project_pages.updated_at` differs from its creation timestamp, but session-local tracking is sufficient for v1 per the spec's deliberately narrow Deploy definition). Add a Deploy button next to the save-success indicator:

```tsx
// app/[locale]/portal/[pageKey]/editor-client.tsx  (additions to Task 6's version)

// ...inside the component, alongside the existing saveState logic...
const [hasSavedOnce, setHasSavedOnce] = useState(false);

// in handleSaveClick, on success:
if (!error) {
  setSaveState("saved");
  setHasSavedOnce(true);
}

const deployWhatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "我的系统设计已经确定了，请开始帮我建系统",
)}`;

// in the header bar JSX, alongside the saveState indicators:
{hasSavedOnce ? (
  <a
    href={deployWhatsappHref}
    target="_blank"
    rel="noopener noreferrer"
    className="rounded-md px-3 py-1.5 text-[12px] text-[color:var(--color-on-primary)] [background-color:var(--color-jade)] [font-weight:var(--fw-semibold)]"
  >
    {t("deployCta")}
  </a>
) : null}
```

Add `portal.editor.deployCta` to both message files (e.g. `"deployCta": "确认设计，交给我们建系统"`, English: `"Confirm design, hand off to build"`).

Per the spec §6, this action does not call any new backend endpoint — clicking it is entirely the WhatsApp deep link itself (matching every other conversion point in this product). There is no "freeze" mutation to write, because `project_pages.layout_json` already reflects the last save, and a customer with `paid = true` can keep editing/re-saving after deploying if they change their mind before the founder starts building — that's a feature, not a gap, given how narrowly v1's Deploy is scoped.

- [ ] **Step 2: Resolve the acquisition site's existing "Continue" placeholder into the real entry point**

This is better than it sounds — `components/sections/conversion-cta.tsx` already has a **placeholder button for exactly this feature**. It reads `继续设计我的系统` ("Continue designing my system", the `cta.continue` i18n key) and on click just shows `cta.placeholderNotice` ("This feature is still in development, we'll contact you soon!"). Read `components/sections/conversion-cta.tsx` and `app/[locale]/page.tsx` in full first (both shown below in their current, real state as of this plan being written — re-read them anyway in case something changed since, but they should match).

`app/[locale]/page.tsx` currently discards the lead id on purpose (`onDone={(_leadId, result) => setAnalysis(result)}`, with a comment explaining why — nothing downstream needed it before now). Change it to keep the id and thread it into `ConversionCta`:

```tsx
// app/[locale]/page.tsx -- two changes to the existing JSX
// 1. capture the id instead of discarding it:
const [leadId, setLeadId] = useState<string | null>(null);
// ...
onDone={(id, result) => {
  setLeadId(id);
  setAnalysis(result);
}}
// 2. pass it down (replaces the old comment about ConversionCta only needing summary):
{analysis && leadId && <ConversionCta summary={analysis.summary} leadId={leadId} />}
```

(Add the `leadId` state declaration near the file's existing `useState` calls for `answers`/`selectedIndustry`/`analysis` — match their existing style.)

In `components/sections/conversion-cta.tsx`, accept the new prop and replace the placeholder button with a real link — keep the WhatsApp button untouched (both stay, per the design spec §3), and reuse the existing `cta.continue` copy as-is rather than adding a new key, since it already says the right thing:

Also update the top-of-file import: `AnimatePresence` from `framer-motion` was only used by the removed placeholder-notice block — drop it from the import (`import { motion, type Variants } from "framer-motion";`) so `tsc`/lint doesn't flag an unused import, and drop the now-unused `useState` import too (`continueClicked` was this file's only state).

```tsx
// components/sections/conversion-cta.tsx -- signature and the placeholder button change
export function ConversionCta({ summary, leadId }: { summary: string; leadId: string }) {
  const t = useTranslations("cta");
  // `continueClicked`/`setContinueClicked` and the AnimatePresence placeholder-notice
  // block below are removed entirely -- there's no more "not implemented yet" state
  // to show, the button now really does something.
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `${t("whatsappPrefill")} ${summary}`,
  )}`;

  return (
    <div className="border-t border-border">
      <SectionShell
        index="04"
        label="BUILD"
        heading={t("title")}
        headingClassName="text-[clamp(2rem,5vw,3.5rem)] leading-[1.15] !max-w-3xl"
      >
        <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }}>
          <motion.div variants={item} className="flex flex-wrap items-center gap-4">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative overflow-hidden border border-signal bg-signal px-8 py-4 font-mono text-[0.75rem] tracking-[0.14em] text-[oklch(0.16_0.012_265)] uppercase transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:outline-none"
            >
              <span className="relative">{t("whatsapp")} →</span>
            </a>

            <a
              href={`/signup?lead=${leadId}`}
              className="group relative border border-border px-8 py-4 font-mono text-[0.75rem] tracking-[0.14em] text-foreground/80 uppercase transition-colors duration-300 hover:border-foreground/50 hover:text-foreground focus-visible:ring-1 focus-visible:ring-blueprint focus-visible:outline-none"
            >
              {t("continue")}
            </a>
          </motion.div>
        </motion.div>
      </SectionShell>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 sm:px-10">
          <span className="annotation !text-muted-foreground">{BRAND_NAME} / SYS.DESIGN</span>
          <span className="annotation !text-muted-foreground/60">MALAYSIA</span>
        </div>
      </div>
    </div>
  );
}
```

`cta.placeholderNotice` becomes a dead i18n key once this ships — remove it from both `messages/en.json` and `messages/zh.json` in this same step (same discipline as the design-system plan's final review catching a dead key: don't leave it for a future cleanup pass to find).

- [ ] **Step 3: Verify end-to-end**

Run `npx tsc --noEmit` (clean) and the full `npx vitest run` suite (all pass). Start the dev server, use Playwright to drive the complete flow once: `/zh` → industry select → peer cases → onboarding questions → AI analysis reveal → on the resulting `ConversionCta`, confirm the WhatsApp button is still present and unchanged, then click "继续设计我的系统" → confirm it lands on `/zh/signup?lead=<uuid>` with a real lead id in the URL (not empty, not literally the string `"undefined"`) → complete sign-up → confirm redirect to style-select → pick a style → confirm redirect to `/portal/dashboard` → drag a component → click save (expect paywall, since this test account is unpaid) → confirm the local draft persisted across a reload. Delete the throwaway test lead/account afterward.

- [ ] **Step 4: Commit**

```bash
git add app/\[locale\]/portal/\[pageKey\]/editor-client.tsx messages/en.json messages/zh.json app/\[locale\]/page.tsx components/sections/conversion-cta.tsx
git commit -m "Add Deploy handoff action and resolve the acquisition site's placeholder Continue button into the real portal entry point"
```

---

## Final Review

After all seven tasks are complete and individually reviewed, dispatch a whole-branch review (per `superpowers:subagent-driven-development`'s process) covering the same ground as the design-system plan's final review did: cross-task integration (does the acquisition-site entry point actually reach a working portal end to end), the RLS/RPC security model holding up as a whole (not just per-table), zero hardcoded colors across every new file, and whether the "no AI 味, professional" bar from this session's brainstorming is actually met by the shipped editor chrome — not just claimed.

# Formae Acquisition Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the acquisition site subsystem from `docs/superpowers/specs/2026-08-17-formae-acquisition-site-design.md` — a bilingual (zh/en) landing flow that takes a visitor from Hero through a Typeform-style progressive Q&A into a real AI-generated business analysis, ending in a WhatsApp/waitlist CTA.

**Architecture:** Next.js App Router site, Sections 1–3 and 6 as a normal scrolling landing page, Section 4 as a full-screen one-question-per-step flow, Section 5 as a server-generated (OpenAI structured output) reveal. Supabase holds `industries`/`reference_cases` (config data) and `leads`/`analysis_results` (visitor data). No client-side auth — the whole flow is anonymous.

**Tech Stack:** Next.js 15 (App Router, TypeScript) · Tailwind CSS · shadcn/ui · Framer Motion · next-intl (i18n) · Supabase (Postgres + `@supabase/ssr`) · OpenAI API (structured outputs, Zod validation) · Vercel · Vitest (unit tests for pure logic only)

## Global Constraints

- Locales: `zh` (default) and `en` only — no Malay this round, per spec §8.
- No automated UI/E2E test suite — that was an explicit spec decision (§9), not an oversight. Manual verification steps are given for UI tasks instead. Pure-logic files (rate limiter, LLM output validator) DO get Vitest unit tests — they're cheap, fast, and catch real bugs even in a prototype.
- Data model field names must match spec §6 exactly: `industries`, `reference_cases`, `leads`, `analysis_results`.
- Reference cases for industries without real Discovery data must be labeled `source: 'inferred'` and rendered as "行业典型场景" in the UI — never presented as a real client story (spec §4, hard rule).
- LLM provider is OpenAI (spec §5) — structured output via `response_format: json_schema`, validated again with Zod server-side before persisting (never trust the raw model output blindly).
- Brand name "Formae" is tentative (pending domain/trademark confirmation) — centralize it in one constant (`lib/brand.ts`), never hardcode the string across components, so a rename later is a one-line change.
- Component sourcing per spec §7: 21st.dev (shadcn-native, primary), React Bits (animated flourishes, MIT + Commons Clause — fine for internal product use), ShaderGradient (Hero background), Aceternity UI (secondary, for effects not covered by the above).
- Section 4 interaction reference: [imran-baitham/NextJs-Typeform-Clone](https://github.com/imran-baitham/NextJs-Typeform-Clone) (Next.js + Tailwind + shadcn one-question-per-screen pattern).

---

### Task 1: Scaffold Next.js project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css` (all via `create-next-app`)
- Modify: `.gitignore`

**Interfaces:**
- Produces: a working Next.js 15 App Router project at repo root, buildable with `npm run dev` / `npm run build`.

- [ ] **Step 1: Remove the placeholder `.gitignore` so `create-next-app` doesn't conflict with it**

Run: `rm .gitignore`

- [ ] **Step 2: Scaffold the app**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --import-alias "@/*" --no-src-dir --use-npm
```
Answer any remaining interactive prompts with defaults (Turbopack: yes is fine).

- [ ] **Step 3: Re-add the brainstorming scratch dir to the generated `.gitignore`**

Append to `.gitignore`:
```
.superpowers/
```

- [ ] **Step 4: Verify the dev server runs**

Run: `npm run dev`
Manual check: open `http://localhost:3000` — the default Next.js starter page renders with no console errors. Stop the server (Ctrl+C) once confirmed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js app with TypeScript + Tailwind"
```

---

### Task 2: shadcn/ui + i18n (next-intl) setup

**Files:**
- Create: `components.json` (via shadcn CLI)
- Create: `i18n/routing.ts`, `i18n/request.ts`, `middleware.ts`
- Create: `messages/zh.json`, `messages/en.json`
- Create: `lib/brand.ts`
- Modify: move `app/layout.tsx` → `app/[locale]/layout.tsx`, move `app/page.tsx` → `app/[locale]/page.tsx`

**Interfaces:**
- Produces: `routing` export from `i18n/routing.ts` (locales `['zh','en']`, default `'zh'`) — later tasks import this for `<Link>`/`useRouter` from `i18n/routing` (never plain `next/link`, so locale prefixes stay correct).
- Produces: `BRAND_NAME` constant from `lib/brand.ts` — all UI copy referencing the product name imports this instead of hardcoding a string.

- [ ] **Step 1: Init shadcn/ui**

Run: `npx shadcn@latest init` — choose: style "New York", base color "Neutral", CSS variables "yes".

- [ ] **Step 2: Install next-intl**

Run: `npm install next-intl`

- [ ] **Step 3: Create the brand constant**

`lib/brand.ts`:
```typescript
export const BRAND_NAME = "Formae";
export const BRAND_TAGLINE_ZH = "设计你的生意，用 AI 运营它。";
export const BRAND_TAGLINE_EN = "Design your business. Run it with AI.";
```

- [ ] **Step 4: Create the routing config**

`i18n/routing.ts`:
```typescript
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["zh", "en"],
  defaultLocale: "zh",
});
```

- [ ] **Step 5: Create the request config**

`i18n/request.ts`:
```typescript
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 6: Create the middleware**

`middleware.ts` (repo root):
```typescript
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
```

- [ ] **Step 7: Seed the message files**

`messages/zh.json`:
```json
{
  "hero": {
    "headline": "你的生意，其实可以更简单。",
    "subheadline": "系统帮你设计专属系统。2 分钟，看到改变。",
    "cta": "看看你的生意会变成怎样"
  }
}
```

`messages/en.json`:
```json
{
  "hero": {
    "headline": "Your business, actually simpler.",
    "subheadline": "The system designs your system. 2 minutes, see the change.",
    "cta": "See what your business could become"
  }
}
```

- [ ] **Step 8: Move `app/layout.tsx` and `app/page.tsx` under `[locale]`**

Run:
```bash
mkdir "app/[locale]"
git mv app/layout.tsx "app/[locale]/layout.tsx"
git mv app/page.tsx "app/[locale]/page.tsx"
```

Replace `app/[locale]/layout.tsx` with:
```tsx
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

Move `app/globals.css` up one level is not needed — keep it at `app/globals.css`; the import path above (`../globals.css`) already accounts for `[locale]` being one level deeper.

Replace `app/[locale]/page.tsx` with a placeholder for now:
```tsx
import { useTranslations } from "next-intl";

export default function HomePage() {
  const t = useTranslations("hero");
  return <h1>{t("headline")}</h1>;
}
```

- [ ] **Step 9: Verify locale routing**

Run: `npm run dev`
Manual check: `http://localhost:3000` redirects to `/zh` and shows "你的生意，其实可以更简单。"; `http://localhost:3000/en` shows the English headline. No console errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Add shadcn/ui and next-intl (zh/en) locale routing"
```

---

### Task 3: Supabase schema + RLS + client helpers

**Files:**
- Create: `supabase/migrations/<timestamp>_init_schema.sql`
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`
- Create: `types/database.ts`
- Create: `.env.local.example`

**Interfaces:**
- Produces: `createBrowserSupabaseClient()` from `lib/supabase/client.ts` (used by client components).
- Produces: `createServerSupabaseClient()` from `lib/supabase/server.ts` (used only in API routes — uses the service role key, never exposed to the browser).
- Produces: TypeScript types `Industry`, `ReferenceCase`, `Lead`, `AnalysisResult` from `types/database.ts` matching spec §6 field names exactly — later tasks import these.

- [ ] **Step 1: Init the Supabase project config**

Run: `supabase init`

- [ ] **Step 2: Create (or choose) the Supabase project**

Run: `supabase projects list` to see available organizations. If it's not obvious which org this prototype should live under, ask the user before proceeding — this creates a new billable project.

Once you have an org id, run:
```bash
supabase projects create formae-prototype --org-id <ORG_ID> --region ap-southeast-1
```
Note the returned project ref.

- [ ] **Step 3: Link the local project**

Run: `supabase link --project-ref <PROJECT_REF>` (enter the DB password when prompted, or pass `--password` if you have it non-interactively).

- [ ] **Step 4: Write the schema migration**

Run: `supabase migration new init_schema` — this creates `supabase/migrations/<timestamp>_init_schema.sql`. Replace its contents with:

```sql
create extension if not exists "pgcrypto";

create table industries (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_zh text not null,
  name_en text not null,
  has_verified_discovery boolean not null default false,
  labels jsonb not null default '{}'::jsonb,
  default_workflow jsonb not null default '[]'::jsonb,
  suggested_modules jsonb not null default '[]'::jsonb,
  style_recommendation text,
  created_at timestamptz not null default now()
);

create table reference_cases (
  id uuid primary key default gen_random_uuid(),
  industry_id uuid not null references industries(id) on delete cascade,
  is_verified boolean not null default false,
  anonymous_name text not null,
  pain_points jsonb not null default '[]'::jsonb,
  modules jsonb not null default '[]'::jsonb,
  workflow jsonb not null default '[]'::jsonb,
  highlights jsonb not null default '[]'::jsonb,
  source text not null check (source in ('internal', 'inferred')),
  created_at timestamptz not null default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  industry_id uuid references industries(id),
  language text not null check (language in ('zh', 'en')),
  answers jsonb not null default '{}'::jsonb,
  style_selected text
);

create table analysis_results (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  raw_llm_response jsonb not null,
  bottlenecks jsonb not null,
  before_workflow jsonb not null,
  after_workflow jsonb not null,
  summary text not null,
  generated_at timestamptz not null default now()
);

create table rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_identifier_idx on rate_limit_events (identifier, created_at);

alter table industries enable row level security;
alter table reference_cases enable row level security;
alter table leads enable row level security;
alter table analysis_results enable row level security;
alter table rate_limit_events enable row level security;

create policy "industries are publicly readable" on industries
  for select using (true);

create policy "reference cases are publicly readable" on reference_cases
  for select using (true);

-- leads, analysis_results, rate_limit_events: no public policies.
-- All writes/reads happen server-side via the service role key in API routes.
```

- [ ] **Step 5: Apply the migration**

Run: `supabase db push`
Manual check: run `supabase db diff` — expect no pending changes.

- [ ] **Step 6: Generate TypeScript types from the live schema**

Run: `supabase gen types typescript --linked > types/database-generated.ts`

- [ ] **Step 7: Write the hand-written domain types**

`types/database.ts`:
```typescript
export interface Industry {
  id: string;
  slug: string;
  name_zh: string;
  name_en: string;
  has_verified_discovery: boolean;
  labels: { customer: string; order: string; staff: string };
  default_workflow: string[];
  suggested_modules: string[];
  style_recommendation: string | null;
}

export interface ReferenceCase {
  id: string;
  industry_id: string;
  is_verified: boolean;
  anonymous_name: string;
  pain_points: string[];
  modules: string[];
  workflow: string[];
  highlights: string[];
  source: "internal" | "inferred";
}

export interface Lead {
  id: string;
  created_at: string;
  industry_id: string | null;
  language: "zh" | "en";
  answers: Record<string, string | string[]>;
  style_selected: string | null;
}

export interface AnalysisResult {
  id: string;
  lead_id: string;
  bottlenecks: { icon: string; title: string; description: string }[];
  before_workflow: string[];
  after_workflow: string[];
  summary: string;
  generated_at: string;
}
```

- [ ] **Step 8: Write the Supabase client helpers**

Run: `npm install @supabase/supabase-js @supabase/ssr`

`lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

`lib/supabase/server.ts`:
```typescript
import { createClient } from "@supabase/supabase-js";

// Service-role client for API routes only. Never import this into a
// client component — the service role key must never reach the browser.
export function createServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
```

- [ ] **Step 9: Write the env var template**

`.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

Copy it to `.env.local` and fill in real values from the Supabase project dashboard (Settings → API) before running the app locally. `.env.local` is already gitignored by `create-next-app`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Add Supabase schema (industries, reference_cases, leads, analysis_results) with RLS"
```

---

### Task 4: Seed industry + reference case data

**Files:**
- Create: `supabase/seed.sql`

**Interfaces:**
- Consumes: schema from Task 3.
- Produces: 8 seeded rows in `industries` (5 `has_verified_discovery = true`, 3 `false`), each with 1–2 `reference_cases` rows.

- [ ] **Step 1: Write the seed file**

`supabase/seed.sql`:
```sql
insert into industries (slug, name_zh, name_en, has_verified_discovery, labels, default_workflow, suggested_modules, style_recommendation) values
('renovation', '装修/承包商', 'Renovation / Contractor', true,
  '{"customer":"客户","order":"项目","staff":"师傅"}',
  '["Customer","Quotation","Approval","Deposit","Project","Milestone","Final Payment"]',
  '["Customer","Quotation","Project","Payment"]', 'industrial'),
('retail', '零售/门店', 'Retail', true,
  '{"customer":"顾客","order":"订单","staff":"店员"}',
  '["Customer","Order","Payment"]',
  '["Customer","Quotation","Payment"]', 'modern'),
('beauty', '美容/沙龙', 'Beauty / Salon', true,
  '{"customer":"顾客","order":"预约","staff":"美容师"}',
  '["Customer","Booking","Service","Payment"]',
  '["Customer","Project","Payment"]', 'warm-professional'),
('wholesale', '批发/分销', 'Wholesale / Distribution', true,
  '{"customer":"客户","order":"订单","staff":"业务员"}',
  '["Customer","Quotation","Order","Payment"]',
  '["Customer","Quotation","Payment"]', 'professional'),
('services', '服务型公司', 'Professional Services', true,
  '{"customer":"客户","order":"项目","staff":"顾问"}',
  '["Customer","Quotation","Project","Payment"]',
  '["Customer","Project","Payment"]', 'professional'),
('fnb', '餐饮/F&B', 'F&B', false,
  '{"customer":"顾客","order":"订单","staff":"员工"}',
  '["Customer","Order","Payment"]',
  '["Customer","Payment"]', 'playful'),
('education', '教育/补习', 'Education / Tuition', false,
  '{"customer":"家长","order":"报名","staff":"老师"}',
  '["Customer","Enrollment","Payment"]',
  '["Customer","Project","Payment"]', 'warm-professional'),
('other', '其他', 'Other', false,
  '{"customer":"客户","order":"订单","staff":"员工"}',
  '["Customer","Quotation","Project","Payment"]',
  '["Customer","Project","Payment"]', 'minimal');

insert into reference_cases (industry_id, is_verified, anonymous_name, pain_points, modules, workflow, highlights, source)
select id, true, '一家 12 人装修公司',
  '["Customer information scattered across WhatsApp and Excel","Project updates depend on WhatsApp","Payment follow-up is manual"]',
  '["Customer Management","Quotation System","Project Management","Site Update","Payment Tracking","AI Assistant"]',
  '["Customer","Quotation","Approval","Deposit","Project","Milestone","Final Payment"]',
  '["每月追款时间从 8 小时降到 1 小时","漏单从每月 2-3 单降到接近 0"]',
  'internal'
from industries where slug = 'renovation';

insert into reference_cases (industry_id, is_verified, anonymous_name, pain_points, modules, workflow, highlights, source)
select id, false, '行业典型场景',
  '["订单靠纸本记录","高峰期漏单","没有会员复购数据"]',
  '["Customer Management","Order Tracking","Payment"]',
  '["Customer","Order","Payment"]',
  '["典型场景，非真实客户案例"]',
  'inferred'
from industries where slug = 'fnb';
```

- [ ] **Step 2: Apply the seed**

Run: `supabase db reset` (applies migrations then `seed.sql` against the linked project) — or `psql` the seed file directly against the project connection string if `db reset` is not appropriate for a non-local linked project. Prefer running the seed SQL via the Supabase SQL editor in the dashboard if `db reset` would wipe unrelated data.

Manual check: in the Supabase dashboard Table Editor, confirm `industries` has 8 rows and `reference_cases` has 2 rows.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Seed industries and reference cases (5 verified, 3 inferred)"
```

---

### Task 5: Deploy skeleton to Vercel

**Files:**
- Create: `vercel.json` (only if defaults need overriding — likely not needed)

**Interfaces:**
- Produces: a live Vercel URL serving the current skeleton, confirming the deploy pipeline works before more code piles up.

- [ ] **Step 1: Link the Vercel project**

Run: `vercel link` — follow prompts, create a new project (suggest name matching `BRAND_NAME` lowercased, e.g. `formae`).

- [ ] **Step 2: Add environment variables**

Run for each of `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`:
```bash
vercel env add <NAME> production
```
Paste the value from `.env.local` when prompted. Repeat for `preview` and `development` environments too if you want branch previews to work.

- [ ] **Step 3: Deploy**

Run: `vercel --prod`

- [ ] **Step 4: Verify**

Manual check: open the returned URL, confirm it redirects to `/zh` and shows the same headline as local dev, with no server errors in `vercel logs`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Confirm Vercel deploy pipeline" --allow-empty
```

---

### Task 6: Hero section (Section 1)

**Files:**
- Create: `components/sections/hero-section.tsx`
- Modify: `app/[locale]/page.tsx`
- Modify: `messages/zh.json`, `messages/en.json` (already has `hero` keys from Task 2 — extend if needed)

**Interfaces:**
- Consumes: `BRAND_NAME` from `lib/brand.ts` (Task 2), `useTranslations` from `next-intl`.
- Produces: `<HeroSection onCtaClick={() => void}>` component — `onCtaClick` is called when the CTA button is pressed; Task 15 wires this to scroll/advance to Section 2.

- [ ] **Step 1: Install ShaderGradient**

Run: `npm install @shadergradient/react @react-three/fiber three three-stdlib camera-controls`

- [ ] **Step 2: Build the Hero component**

`components/sections/hero-section.tsx`:
```tsx
"use client";

import { useTranslations } from "next-intl";
import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";
import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/brand";

export function HeroSection({ onCtaClick }: { onCtaClick: () => void }) {
  const t = useTranslations("hero");

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden text-center">
      <ShaderGradientCanvas className="absolute inset-0 -z-10">
        <ShaderGradient
          control="query"
          urlString="https://www.shadergradient.co/customize?type=waterPlane&color1=%23606080&color2=%238da0ce&color3=%23212121"
        />
      </ShaderGradientCanvas>
      <p className="mb-2 text-sm uppercase tracking-widest text-muted-foreground">
        {BRAND_NAME}
      </p>
      <h1 className="max-w-2xl text-4xl font-bold sm:text-5xl">{t("headline")}</h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">{t("subheadline")}</p>
      <Button size="lg" className="mt-8" onClick={onCtaClick}>
        {t("cta")}
      </Button>
    </section>
  );
}
```

- [ ] **Step 3: Install the shadcn Button**

Run: `npx shadcn@latest add button`

- [ ] **Step 4: Wire it into the page**

`app/[locale]/page.tsx`:
```tsx
"use client";

import { HeroSection } from "@/components/sections/hero-section";

export default function HomePage() {
  return (
    <main>
      <HeroSection onCtaClick={() => {
        document.getElementById("industry-select")?.scrollIntoView({ behavior: "smooth" });
      }} />
    </main>
  );
}
```

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open `/zh` and `/en`. Check: animated gradient background renders, headline/subheadline/CTA text matches the locale, clicking the CTA doesn't error (target element doesn't exist yet — that's expected until Task 7).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add Hero section with ShaderGradient background"
```

---

### Task 7: Industry selection (Section 2)

**Files:**
- Create: `components/sections/industry-select.tsx`
- Create: `lib/industries.ts`
- Modify: `app/[locale]/page.tsx`

**Interfaces:**
- Consumes: `Industry` type (Task 3), `createBrowserSupabaseClient` (Task 3).
- Produces: `getIndustries(): Promise<Industry[]>` from `lib/industries.ts` — Task 8 (peer cases) and Task 9 (stepper) both call this or receive the selected industry from it.
- Produces: `<IndustrySelect onSelect={(industry: Industry) => void}>` — fires when a visitor picks an industry pill.

- [ ] **Step 1: Write the data fetch helper**

`lib/industries.ts`:
```typescript
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Industry } from "@/types/database";

export async function getIndustries(): Promise<Industry[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("industries")
    .select("*")
    .order("has_verified_discovery", { ascending: false });

  if (error) throw error;
  return data as Industry[];
}
```

- [ ] **Step 2: Build the component**

`components/sections/industry-select.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getIndustries } from "@/lib/industries";
import type { Industry } from "@/types/database";
import { Button } from "@/components/ui/button";

export function IndustrySelect({ onSelect }: { onSelect: (industry: Industry) => void }) {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const locale = useLocale();
  const t = useTranslations("industrySelect");

  useEffect(() => {
    getIndustries().then(setIndustries).catch(console.error);
  }, []);

  return (
    <section id="industry-select" className="min-h-screen px-6 py-24">
      <h2 className="text-center text-2xl font-semibold">{t("title")}</h2>
      <div className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-3">
        {industries.map((industry) => (
          <Button
            key={industry.id}
            variant="outline"
            className="rounded-full"
            onClick={() => onSelect(industry)}
          >
            {locale === "zh" ? industry.name_zh : industry.name_en}
          </Button>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Add translation keys**

Add to both `messages/zh.json` and `messages/en.json`:
```json
"industrySelect": { "title": "你的生意属于哪一行？" }
```
(English file: `"industrySelect": { "title": "Which industry is your business in?" }`)

- [ ] **Step 4: Wire into the page**

Update `app/[locale]/page.tsx` to hold selected-industry state and render `<IndustrySelect>` below `<HeroSection>`:
```tsx
"use client";

import { useState } from "react";
import { HeroSection } from "@/components/sections/hero-section";
import { IndustrySelect } from "@/components/sections/industry-select";
import type { Industry } from "@/types/database";

export default function HomePage() {
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);

  return (
    <main>
      <HeroSection onCtaClick={() => {
        document.getElementById("industry-select")?.scrollIntoView({ behavior: "smooth" });
      }} />
      <IndustrySelect onSelect={setSelectedIndustry} />
      {selectedIndustry && <p className="text-center">{selectedIndustry.name_zh} selected</p>}
    </main>
  );
}
```

- [ ] **Step 5: Manual verification**

Confirm all 8 seeded industries render as pills in both locales, clicking one shows the temporary "selected" text below. No console errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add Industry selection section"
```

---

### Task 8: Peer case gallery (Section 3)

**Files:**
- Create: `components/sections/peer-case-gallery.tsx`
- Create: `lib/reference-cases.ts`
- Modify: `app/[locale]/page.tsx`

**Interfaces:**
- Consumes: `Industry` (from Task 7's selection state), `ReferenceCase` type (Task 3).
- Produces: `getReferenceCases(industryId: string): Promise<ReferenceCase[]>`.

- [ ] **Step 1: Write the data fetch helper**

`lib/reference-cases.ts`:
```typescript
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ReferenceCase } from "@/types/database";

export async function getReferenceCases(industryId: string): Promise<ReferenceCase[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("reference_cases")
    .select("*")
    .eq("industry_id", industryId);

  if (error) throw error;
  return data as ReferenceCase[];
}
```

- [ ] **Step 2: Build the component**

`components/sections/peer-case-gallery.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getReferenceCases } from "@/lib/reference-cases";
import type { ReferenceCase } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PeerCaseGallery({ industryId }: { industryId: string }) {
  const [cases, setCases] = useState<ReferenceCase[]>([]);
  const t = useTranslations("peerCases");

  useEffect(() => {
    getReferenceCases(industryId).then(setCases).catch(console.error);
  }, [industryId]);

  if (cases.length === 0) return null;

  return (
    <section className="px-6 py-24">
      <h2 className="text-center text-2xl font-semibold">{t("title")}</h2>
      <div className="mx-auto mt-8 grid max-w-3xl gap-4">
        {cases.map((c) => (
          <Card key={c.id}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{c.anonymous_name}</CardTitle>
              {c.source === "inferred" && (
                <Badge variant="secondary">{t("inferredLabel")}</Badge>
              )}
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {c.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Install shadcn Card and Badge**

Run: `npx shadcn@latest add card badge`

- [ ] **Step 4: Add translation keys**

`messages/zh.json`:
```json
"peerCases": { "title": "跟你同行的公司，我们帮他们这样做。", "inferredLabel": "行业典型场景" }
```
`messages/en.json`:
```json
"peerCases": { "title": "Here's how we've helped businesses like yours.", "inferredLabel": "Industry-typical scenario" }
```

- [ ] **Step 5: Wire into the page**

Update `app/[locale]/page.tsx`: replace the temporary "selected" text with `{selectedIndustry && <PeerCaseGallery industryId={selectedIndustry.id} />}`.

- [ ] **Step 6: Manual verification**

Select `renovation` (装修/承包商) — confirm the real case renders with no "inferred" badge. Select `fnb` (餐饮/F&B) — confirm the case renders WITH the "行业典型场景" / "Industry-typical scenario" badge. This is the hard rule from spec §4 — verify it visually, don't skip this check.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add Peer case gallery with verified/inferred labeling"
```

---

### Task 8a: Bilingual reference case content (follow-up)

**Why this task exists:** Task 8's review found that `reference_cases` (unlike `industries`, which has `name_zh`/`name_en`) has no per-locale split for `anonymous_name`/`highlights` — an `/en` visitor sees Chinese case content inside an otherwise-English page. The user asked to fix this now rather than defer it.

**Files:**
- Create: `supabase/migrations/<timestamp>_reference_case_i18n.sql`
- Modify: `types/database.ts`
- Modify: `components/sections/peer-case-gallery.tsx`
- Modify: `supabase/seed.sql` (for future re-seeds/documentation — the live data itself is updated by the migration's UPDATE statement, not by re-running this file)

**Interfaces:**
- Consumes: the live Supabase project (already linked), the Management API SQL-execution pattern already proven in Tasks 3/4 (no Docker available, `supabase db diff` doesn't work here).
- Produces: `ReferenceCase` type gains `anonymous_name_zh`/`anonymous_name_en`/`highlights_zh`/`highlights_en`, loses `anonymous_name`/`highlights`. `PeerCaseGallery` picks the right field via `useLocale()`, same pattern already used in `components/sections/industry-select.tsx`.

- [ ] **Step 1: Write the migration**

Run: `supabase migration new reference_case_i18n` — creates `supabase/migrations/<timestamp>_reference_case_i18n.sql`. Contents:

```sql
alter table reference_cases
  add column anonymous_name_zh text,
  add column anonymous_name_en text,
  add column highlights_zh jsonb,
  add column highlights_en jsonb;

update reference_cases set
  anonymous_name_zh = '一家 12 人装修公司',
  anonymous_name_en = 'A 12-person renovation company',
  highlights_zh = '["每月追款时间从 8 小时降到 1 小时","漏单从每月 2-3 单降到接近 0"]'::jsonb,
  highlights_en = '["Monthly payment follow-up time dropped from 8 hours to 1 hour","Missed orders dropped from 2-3/month to nearly zero"]'::jsonb
where anonymous_name = '一家 12 人装修公司';

update reference_cases set
  anonymous_name_zh = '行业典型场景',
  anonymous_name_en = 'Industry-typical scenario',
  highlights_zh = '["典型场景，非真实客户案例"]'::jsonb,
  highlights_en = '["Typical scenario, not a real client case"]'::jsonb
where anonymous_name = '行业典型场景';

alter table reference_cases
  alter column anonymous_name_zh set not null,
  alter column anonymous_name_en set not null,
  alter column highlights_zh set not null,
  alter column highlights_en set not null;

alter table reference_cases
  drop column anonymous_name,
  drop column highlights;
```

- [ ] **Step 2: Apply it via the Management API** (same pattern as Tasks 3/4 — no Docker, no dashboard access)

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/xtsnrnpcgknrvuslhhdu/database/query" \
  -H "Authorization: Bearer <SUPABASE_ACCESS_TOKEN — ask the controller if you don't have it>" \
  -H "Content-Type: application/json" \
  -d '{"query": "<the migration SQL as a JSON string>"}'
```

Verify afterward: `SELECT slug, anonymous_name_zh, anonymous_name_en FROM reference_cases JOIN industries ON industries.id = reference_cases.industry_id;` should return 2 rows, both `_zh`/`_en` columns populated, and `SELECT column_name FROM information_schema.columns WHERE table_name = 'reference_cases';` should no longer list `anonymous_name`/`highlights`.

- [ ] **Step 3: Regenerate types**

Run: `supabase gen types typescript --linked > types/database-generated.ts` (with the same `SUPABASE_ACCESS_TOKEN` prefix as Task 3 used). Then update the hand-written type:

`types/database.ts` — replace the `ReferenceCase` interface's `anonymous_name: string;` and `highlights: string[];` lines with:
```typescript
  anonymous_name_zh: string;
  anonymous_name_en: string;
  highlights_zh: string[];
  highlights_en: string[];
```

- [ ] **Step 4: Update the component**

`components/sections/peer-case-gallery.tsx` — add `useLocale` to the `next-intl` import, and change the two field references:
```tsx
import { useLocale, useTranslations } from "next-intl";
```
```tsx
const locale = useLocale();
```
Replace `<CardTitle>{c.anonymous_name}</CardTitle>` with `<CardTitle>{locale === "zh" ? c.anonymous_name_zh : c.anonymous_name_en}</CardTitle>`, and replace `{c.highlights.map((h, i) => (` with `{(locale === "zh" ? c.highlights_zh : c.highlights_en).map((h, i) => (`.

- [ ] **Step 5: Update the seed file for future re-seeds**

`supabase/seed.sql` — update both `insert into reference_cases` statements' column lists and values to use `anonymous_name_zh`/`anonymous_name_en`/`highlights_zh`/`highlights_en` instead of `anonymous_name`/`highlights`, using the same zh/en values as the migration's UPDATE statements above.

- [ ] **Step 6: Manual verification**

Run `npm run dev`. Select renovation on `/zh` — confirm Chinese case title/highlights. Select renovation on `/en` — confirm English case title/highlights (not Chinese). Repeat for F&B (inferred case) on both locales — confirm the badge still shows correctly (Task 8's behavior must still hold) and the content is in the right language.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add per-locale content to reference_cases (fixes /en showing Chinese case text)"
```

---

### Task 9: Onboarding stepper shell (Section 4)

**Files:**
- Create: `components/onboarding/stepper.tsx`
- Create: `components/onboarding/question-card.tsx`
- Create: `components/onboarding/questions.ts`
- Modify: `app/[locale]/page.tsx`

**Interfaces:**
- Produces: `<OnboardingStepper industry={Industry} onComplete={(answers: Record<string, string | string[]>) => void}>` — Task 11 consumes the `answers` object shape produced here.
- Produces: `QUESTIONS` array from `components/onboarding/questions.ts` — each question has `id`, `type: 'single' | 'multi' | 'text'`, `options?`.

- [ ] **Step 1: Define the question set**

`components/onboarding/questions.ts`:
```typescript
export interface Question {
  id: string;
  type: "single" | "text";
  titleKey: string;
  optionsKey?: string[];
}

export const QUESTIONS: Question[] = [
  {
    id: "current_tool",
    type: "single",
    titleKey: "q1.title",
    optionsKey: ["q1.opt1", "q1.opt2", "q1.opt3", "q1.opt4", "q1.opt5"],
  },
  {
    id: "time_sink",
    type: "single",
    titleKey: "q2.title",
    optionsKey: ["q2.opt1", "q2.opt2", "q2.opt3", "q2.opt4", "q2.opt5"],
  },
  {
    id: "new_customer_flow",
    type: "text",
    titleKey: "q3.title",
  },
];
```

- [ ] **Step 2: Add translation keys**

`messages/zh.json` — add under a new `"onboarding"` key:
```json
"onboarding": {
  "q1": { "title": "你现在用什么管理客户和订单？", "opt1": "WhatsApp", "opt2": "Excel", "opt3": "纸本", "opt4": "现有软件", "opt5": "没有系统" },
  "q2": { "title": "你平时最花时间在什么事情上？", "opt1": "追付款", "opt2": "整理订单", "opt3": "安排员工", "opt4": "做报告", "opt5": "跟客户 follow-up" },
  "q3": { "title": "你接一个新客户，过程是怎样的？", "placeholder": "打一两句话就好" },
  "next": "下一题", "back": "上一题", "submit": "开始分析"
}
```
`messages/en.json` — matching English equivalents with the same key structure.

- [ ] **Step 3: Build the question card**

`components/onboarding/question-card.tsx`:
```tsx
"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Question } from "./questions";

export function QuestionCard({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("onboarding");

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.25 }}
      className="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center"
    >
      <h3 className="max-w-lg text-2xl font-semibold">{t(question.titleKey)}</h3>
      {question.type === "single" && question.optionsKey && (
        <div className="flex flex-wrap justify-center gap-3">
          {question.optionsKey.map((key) => (
            <Button
              key={key}
              variant={value === t(key) ? "default" : "outline"}
              onClick={() => onChange(t(key))}
            >
              {t(key)}
            </Button>
          ))}
        </div>
      )}
      {question.type === "text" && (
        <Textarea
          className="max-w-md"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t(`${question.id === "new_customer_flow" ? "q3" : ""}.placeholder`)}
        />
      )}
    </motion.div>
  );
}
```

- [ ] **Step 4: Install shadcn Textarea and Progress**

Run: `npx shadcn@latest add textarea progress`

- [ ] **Step 5: Build the stepper container**

`components/onboarding/stepper.tsx`:
```tsx
"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { QUESTIONS } from "./questions";
import { QuestionCard } from "./question-card";
import type { Industry } from "@/types/database";

export function OnboardingStepper({
  industry,
  onComplete,
}: {
  industry: Industry;
  onComplete: (answers: Record<string, string>) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const t = useTranslations("onboarding");

  const currentQuestion = QUESTIONS[stepIndex];
  const currentValue = answers[currentQuestion.id] ?? "";
  const isLast = stepIndex === QUESTIONS.length - 1;

  function handleNext() {
    if (isLast) {
      onComplete(answers);
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  return (
    <section className="fixed inset-0 z-50 flex flex-col justify-center bg-background px-6">
      <Progress value={((stepIndex + 1) / QUESTIONS.length) * 100} className="mx-auto mb-8 max-w-md" />
      <AnimatePresence mode="wait">
        <QuestionCard
          key={currentQuestion.id}
          question={currentQuestion}
          value={currentValue}
          onChange={(value) => setAnswers((a) => ({ ...a, [currentQuestion.id]: value }))}
        />
      </AnimatePresence>
      <div className="mx-auto flex max-w-md justify-between">
        <Button variant="ghost" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => i - 1)}>
          {t("back")}
        </Button>
        <Button onClick={handleNext} disabled={!currentValue}>
          {isLast ? t("submit") : t("next")}
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Wire into the page (behind the industry selection)**

Update `app/[locale]/page.tsx` to conditionally render the stepper as a full-screen overlay once an industry is picked, with a "start" trigger (e.g. append a "开始" button under `PeerCaseGallery`, or auto-open the stepper immediately after industry selection — keep it simple and auto-open for now):

```tsx
"use client";

import { useState } from "react";
import { HeroSection } from "@/components/sections/hero-section";
import { IndustrySelect } from "@/components/sections/industry-select";
import { PeerCaseGallery } from "@/components/sections/peer-case-gallery";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import type { Industry } from "@/types/database";

export default function HomePage() {
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);
  const [showStepper, setShowStepper] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);

  return (
    <main>
      <HeroSection onCtaClick={() => document.getElementById("industry-select")?.scrollIntoView({ behavior: "smooth" })} />
      <IndustrySelect onSelect={setSelectedIndustry} />
      {selectedIndustry && (
        <>
          <PeerCaseGallery industryId={selectedIndustry.id} />
          <div className="pb-24 text-center">
            <button className="underline" onClick={() => setShowStepper(true)}>Start →</button>
          </div>
        </>
      )}
      {showStepper && selectedIndustry && (
        <OnboardingStepper
          industry={selectedIndustry}
          onComplete={(a) => { setAnswers(a); setShowStepper(false); }}
        />
      )}
      {answers && <pre>{JSON.stringify(answers, null, 2)}</pre>}
    </main>
  );
}
```

- [ ] **Step 7: Manual verification**

Select an industry, click "Start", answer all 3 questions (confirm "Next" is disabled until a value is chosen, "Back" works, progress bar advances), confirm on the last question the button reads "开始分析"/"submit" and clicking it closes the stepper and dumps the collected answers as JSON below. Test in both locales.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add Typeform-style onboarding stepper (Section 4)"
```

---

### Task 10: Rate limiter (unit tested)

**Files:**
- Create: `lib/rate-limit.ts`
- Test: `lib/rate-limit.test.ts`

**Interfaces:**
- Produces: `checkRateLimit(supabase: SupabaseClient, identifier: string, opts?: { limit?: number; windowMs?: number }): Promise<{ allowed: boolean; remaining: number }>` — Task 11's API route calls this before doing anything else.

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: Write the failing test**

`lib/rate-limit.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { evaluateRateLimit } from "./rate-limit";

describe("evaluateRateLimit", () => {
  it("allows the request when under the limit", () => {
    const now = Date.now();
    const recentEvents = [now - 1000, now - 2000]; // 2 events
    const result = evaluateRateLimit(recentEvents, now, { limit: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it("blocks the request when at the limit", () => {
    const now = Date.now();
    const recentEvents = Array.from({ length: 5 }, (_, i) => now - i * 1000);
    const result = evaluateRateLimit(recentEvents, now, { limit: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("ignores events outside the window", () => {
    const now = Date.now();
    const recentEvents = [now - 120_000]; // 2 minutes ago, outside a 60s window
    const result = evaluateRateLimit(recentEvents, now, { limit: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/rate-limit.test.ts`
Expected: FAIL with "evaluateRateLimit is not a function" or module not found.

- [ ] **Step 4: Implement the pure logic + the Supabase-backed wrapper**

`lib/rate-limit.ts`:
```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

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

export async function checkRateLimit(
  supabase: SupabaseClient,
  identifier: string,
  opts: { limit?: number; windowMs?: number } = {},
): Promise<{ allowed: boolean; remaining: number }> {
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/rate-limit.test.ts`
Expected: PASS, 3/3 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add rate limiter with unit tests"
```

---

### Task 11: `/api/analyze` route (OpenAI structured output + persistence)

**Files:**
- Create: `app/api/analyze/route.ts`
- Create: `lib/openai/analysis-schema.ts`
- Test: `lib/openai/analysis-schema.test.ts`

**Interfaces:**
- Consumes: `checkRateLimit` (Task 10), `createServerSupabaseClient` (Task 3), `Industry`/`AnalysisResult` types (Task 3), the `answers` shape produced by `OnboardingStepper` (Task 9).
- Produces: `POST /api/analyze` — request body `{ industryId: string, language: 'zh' | 'en', answers: Record<string, string> }`, response `{ leadId: string, analysis: AnalysisResult }` on success, `{ error: string }` with appropriate status on failure (429 for rate limit, 502 for LLM failure).

- [ ] **Step 1: Install the OpenAI SDK and Zod**

Run: `npm install openai zod`

- [ ] **Step 2: Write the failing schema validation test**

`lib/openai/analysis-schema.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { analysisSchema } from "./analysis-schema";

describe("analysisSchema", () => {
  it("accepts a well-formed analysis object", () => {
    const valid = {
      bottlenecks: [{ icon: "clock", title: "追款慢", description: "手工追踪付款" }],
      before_workflow: ["Customer", "Order"],
      after_workflow: ["Customer", "Quotation", "Order", "Payment"],
      summary: "你有 3 个环节可以自动化",
    };
    expect(() => analysisSchema.parse(valid)).not.toThrow();
  });

  it("rejects an object missing required fields", () => {
    const invalid = { bottlenecks: [] };
    expect(() => analysisSchema.parse(invalid)).toThrow();
  });

  it("rejects an empty bottlenecks array", () => {
    const invalid = {
      bottlenecks: [],
      before_workflow: ["Customer"],
      after_workflow: ["Customer", "Payment"],
      summary: "test",
    };
    expect(() => analysisSchema.parse(invalid)).toThrow();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/openai/analysis-schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the schema**

`lib/openai/analysis-schema.ts`:
```typescript
import { z } from "zod";

export const analysisSchema = z.object({
  bottlenecks: z
    .array(
      z.object({
        icon: z.string(),
        title: z.string(),
        description: z.string(),
      }),
    )
    .min(1)
    .max(6),
  before_workflow: z.array(z.string()).min(1),
  after_workflow: z.array(z.string()).min(1),
  summary: z.string(),
});

export type AnalysisPayload = z.infer<typeof analysisSchema>;

export const analysisJsonSchema = {
  name: "business_analysis",
  strict: true,
  schema: {
    type: "object",
    properties: {
      bottlenecks: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            icon: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
          },
          required: ["icon", "title", "description"],
          additionalProperties: false,
        },
      },
      before_workflow: { type: "array", items: { type: "string" }, minItems: 1 },
      after_workflow: { type: "array", items: { type: "string" }, minItems: 1 },
      summary: { type: "string" },
    },
    required: ["bottlenecks", "before_workflow", "after_workflow", "summary"],
    additionalProperties: false,
  },
} as const;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/openai/analysis-schema.test.ts`
Expected: PASS, 3/3 tests.

- [ ] **Step 6: Write the API route**

`app/api/analyze/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { analysisSchema, analysisJsonSchema } from "@/lib/openai/analysis-schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { industryId, language, answers } = body as {
    industryId: string;
    language: "zh" | "en";
    answers: Record<string, string>;
  };

  if (!industryId || !language || !answers) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const identifier = req.headers.get("x-forwarded-for") ?? "unknown";

  const rateLimit = await checkRateLimit(supabase, identifier);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate limit exceeded" }, { status: 429 });
  }

  const { data: industry, error: industryError } = await supabase
    .from("industries")
    .select("*")
    .eq("id", industryId)
    .single();
  if (industryError || !industry) {
    return NextResponse.json({ error: "unknown industry" }, { status: 400 });
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({ industry_id: industryId, language, answers })
    .select()
    .single();
  if (leadError || !lead) {
    return NextResponse.json({ error: "failed to save lead" }, { status: 500 });
  }

  const prompt = `You are analyzing a ${industry.name_en} business in Malaysia.
Default workflow for this industry: ${JSON.stringify(industry.default_workflow)}.
Suggested modules: ${JSON.stringify(industry.suggested_modules)}.
The business owner answered:
${Object.entries(answers).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

Identify 2-4 operational bottlenecks, describe their current (before) workflow
and a recommended (after) workflow as short stage-name arrays, and write a
one-sentence summary. Respond in ${language === "zh" ? "Chinese" : "English"}.`;

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_schema", json_schema: analysisJsonSchema },
    });
  } catch (err) {
    console.error("OpenAI call failed", err);
    return NextResponse.json({ error: "analysis generation failed" }, { status: 502 });
  }

  const raw = completion.choices[0]?.message?.content;
  let parsed;
  try {
    parsed = analysisSchema.parse(JSON.parse(raw ?? "{}"));
  } catch (err) {
    console.error("LLM output failed schema validation", err, raw);
    return NextResponse.json({ error: "analysis generation failed" }, { status: 502 });
  }

  const { data: analysisRow, error: analysisError } = await supabase
    .from("analysis_results")
    .insert({
      lead_id: lead.id,
      raw_llm_response: JSON.parse(raw ?? "{}"),
      bottlenecks: parsed.bottlenecks,
      before_workflow: parsed.before_workflow,
      after_workflow: parsed.after_workflow,
      summary: parsed.summary,
    })
    .select()
    .single();
  if (analysisError || !analysisRow) {
    return NextResponse.json({ error: "failed to save analysis" }, { status: 500 });
  }

  return NextResponse.json({ leadId: lead.id, analysis: analysisRow });
}
```

- [ ] **Step 7: Manual verification**

With a real `OPENAI_API_KEY` in `.env.local`, run `npm run dev` and use `curl` or a REST client:
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"industryId":"<a real industry id from the industries table>","language":"zh","answers":{"current_tool":"WhatsApp","time_sink":"追付款","new_customer_flow":"客户联系我，我口头报价"}}'
```
Expected: a 200 response with `leadId` and a populated `analysis` object. Check the Supabase dashboard — a new row exists in both `leads` and `analysis_results`. Send the same request 6 times in under an hour from the same origin — the 6th should return 429.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add /api/analyze route with OpenAI structured output and rate limiting"
```

---

### Task 12: Analysis reveal UI (Section 5)

**Files:**
- Create: `components/sections/analysis-reveal.tsx`
- Modify: `app/[locale]/page.tsx`

**Interfaces:**
- Consumes: the `answers` object from Task 9's `OnboardingStepper.onComplete`, `selectedIndustry.id`.
- Produces: `<AnalysisReveal industryId={string} language={'zh'|'en'} answers={Record<string,string>} onDone={(leadId: string, analysis: AnalysisResult) => void}>` — calls `POST /api/analyze` on mount. Task 13 and Task 15 both consume the `analysis` argument, not just `leadId`.

- [ ] **Step 1: Build the component**

`components/sections/analysis-reveal.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import type { AnalysisResult } from "@/types/database";

export function AnalysisReveal({
  industryId,
  language,
  answers,
  onDone,
}: {
  industryId: string;
  language: "zh" | "en";
  answers: Record<string, string>;
  onDone: (leadId: string, analysis: AnalysisResult) => void;
}) {
  const [state, setState] = useState<"loading" | "error" | "done">("loading");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const t = useTranslations("analysis");

  useEffect(() => {
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ industryId, language, answers }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setAnalysis(data.analysis);
        setState("done");
        onDone(data.leadId, data.analysis);
      })
      .catch((err) => {
        console.error(err);
        setState("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "loading") {
    return (
      <section className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse text-lg">{t("loading")}</p>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="flex min-h-screen items-center justify-center">
        <p>{t("error")}</p>
      </section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-2xl px-6 py-24"
    >
      <p className="text-center text-lg font-medium">{analysis!.summary}</p>
      <div className="mt-8 grid gap-4">
        {analysis!.bottlenecks.map((b, i) => (
          <div key={i} className="rounded-lg border p-4">
            <h4 className="font-semibold">{b.title}</h4>
            <p className="text-sm text-muted-foreground">{b.description}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
        <div>
          <h5 className="font-semibold">{t("before")}</h5>
          <p>{analysis!.before_workflow.join(" → ")}</p>
        </div>
        <div>
          <h5 className="font-semibold">{t("after")}</h5>
          <p>{analysis!.after_workflow.join(" → ")}</p>
        </div>
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 2: Add translation keys**

`messages/zh.json`:
```json
"analysis": { "loading": "系统正在分析你的业务...", "error": "分析生成失败，请重试。", "before": "现在的流程", "after": "建议的流程" }
```
`messages/en.json` — matching English.

- [ ] **Step 3: Wire into the page**

Replace the temporary `<pre>{JSON.stringify(answers...)}</pre>` in `app/[locale]/page.tsx` with:
```tsx
{answers && selectedIndustry && (
  <AnalysisReveal
    industryId={selectedIndustry.id}
    language={locale as "zh" | "en"}
    answers={answers}
    onDone={setLeadId}
  />
)}
```
(add `const locale = useLocale();` from `next-intl`, and `const [leadId, setLeadId] = useState<string | null>(null);` to the page's state.)

- [ ] **Step 4: Manual verification**

Complete the full flow: pick industry → answer 3 questions → confirm loading state shows, then bottlenecks + before/after workflow render. Confirm the error state by temporarily setting an invalid `OPENAI_API_KEY` and re-running — should show the friendly error message, not a crash.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add AI analysis reveal (Section 5)"
```

---

### Task 13: Conversion CTA (Section 6)

**Files:**
- Create: `components/sections/conversion-cta.tsx`
- Modify: `app/[locale]/page.tsx`

**Interfaces:**
- Consumes: `leadId` (Task 12), `analysis.summary` for the WhatsApp prefill text.

- [ ] **Step 1: Build the component**

`components/sections/conversion-cta.tsx`:
```tsx
"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const WHATSAPP_NUMBER = "60123456789"; // TODO before real launch: replace with the real business WhatsApp number

export function ConversionCta({ summary }: { summary: string }) {
  const t = useTranslations("cta");
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `${t("whatsappPrefill")} ${summary}`,
  )}`;

  return (
    <section className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-2xl font-semibold">{t("title")}</h2>
      <div className="flex gap-4">
        <Button asChild>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
            {t("whatsapp")}
          </a>
        </Button>
        <Button variant="outline" onClick={() => alert(t("placeholderNotice"))}>
          {t("continue")}
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add translation keys**

`messages/zh.json`:
```json
"cta": {
  "title": "要不要继续设计你的系统？",
  "whatsapp": "发送分析报告到 WhatsApp",
  "whatsappPrefill": "我刚做了业务分析，结果是：",
  "continue": "继续设计我的系统",
  "placeholderNotice": "这个功能还在开发中，我们会尽快联系你！"
}
```
`messages/en.json` — matching English.

- [ ] **Step 3: Wire into the page**

Add `analysis` state to `app/[locale]/page.tsx` (`const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);`), pass `onDone={(leadId, result) => { setLeadId(leadId); setAnalysis(result); }}` to `<AnalysisReveal>` (Task 12 already produces `onDone` with this two-argument signature), then render `{analysis && <ConversionCta summary={analysis.summary} />}` below it.

- [ ] **Step 4: Manual verification**

Complete the full flow, confirm the WhatsApp button opens `wa.me` with the prefilled analysis summary text, and the "继续设计我的系统" button shows the placeholder alert without erroring.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add Conversion CTA (Section 6) with WhatsApp deep link"
```

---

### Task 14: Style switching (2–3 themes)

**Files:**
- Create: `app/globals.css` (modify — add theme token blocks)
- Create: `components/style-switcher.tsx`
- Modify: `app/[locale]/layout.tsx`

**Interfaces:**
- Produces: a `data-theme` attribute on `<html>`, switchable client-side, persisted to `localStorage`.

- [ ] **Step 1: Add theme token blocks to `globals.css`**

Append to `app/globals.css` (after the existing shadcn-generated `:root` and `.dark` blocks):
```css
[data-theme="warm-professional"] {
  --primary: oklch(0.55 0.12 50);
  --background: oklch(0.98 0.01 80);
  --radius: 0.5rem;
}

[data-theme="industrial"] {
  --primary: oklch(0.4 0.02 260);
  --background: oklch(0.95 0 0);
  --radius: 0.125rem;
}
```

- [ ] **Step 2: Build the switcher**

`components/style-switcher.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const THEMES = ["default", "warm-professional", "industrial"] as const;

export function StyleSwitcher() {
  const [theme, setTheme] = useState<(typeof THEMES)[number]>("default");

  useEffect(() => {
    const stored = localStorage.getItem("formae-theme");
    if (stored && THEMES.includes(stored as (typeof THEMES)[number])) {
      setTheme(stored as (typeof THEMES)[number]);
    }
  }, []);

  useEffect(() => {
    if (theme === "default") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    localStorage.setItem("formae-theme", theme);
  }, [theme]);

  return (
    <div className="fixed bottom-4 right-4 z-40 flex gap-2 rounded-full border bg-background p-2 shadow-lg">
      {THEMES.map((t) => (
        <Button key={t} size="sm" variant={theme === t ? "default" : "ghost"} onClick={() => setTheme(t)}>
          {t}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Wire into the layout**

Add `<StyleSwitcher />` inside `app/[locale]/layout.tsx`'s `<body>`, alongside `{children}`.

- [ ] **Step 4: Manual verification**

Click each theme button, confirm the background/primary color/border-radius visibly change across the whole page, and confirm the choice survives a page reload (localStorage persistence).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add style switching (default, warm-professional, industrial)"
```

---

### Task 15: Wire full end-to-end flow + final QA pass

**Files:**
- Modify: `app/[locale]/page.tsx` (consolidate all section state into one clean flow)

**Interfaces:**
- No new interfaces — this task is integration and verification only.

- [ ] **Step 1: Consolidate `app/[locale]/page.tsx`**

Rewrite the page to thread state cleanly through all six sections in one file:
```tsx
"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { HeroSection } from "@/components/sections/hero-section";
import { IndustrySelect } from "@/components/sections/industry-select";
import { PeerCaseGallery } from "@/components/sections/peer-case-gallery";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { AnalysisReveal } from "@/components/sections/analysis-reveal";
import { ConversionCta } from "@/components/sections/conversion-cta";
import type { Industry, AnalysisResult } from "@/types/database";

export default function HomePage() {
  const locale = useLocale() as "zh" | "en";
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);
  const [showStepper, setShowStepper] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  return (
    <main>
      <HeroSection onCtaClick={() => document.getElementById("industry-select")?.scrollIntoView({ behavior: "smooth" })} />
      <IndustrySelect onSelect={setSelectedIndustry} />
      {selectedIndustry && !answers && (
        <>
          <PeerCaseGallery industryId={selectedIndustry.id} />
          <div className="pb-24 text-center">
            <button className="underline" onClick={() => setShowStepper(true)}>Start →</button>
          </div>
        </>
      )}
      {showStepper && selectedIndustry && (
        <OnboardingStepper
          industry={selectedIndustry}
          onComplete={(a) => { setAnswers(a); setShowStepper(false); }}
        />
      )}
      {answers && selectedIndustry && !analysis && (
        <AnalysisReveal
          industryId={selectedIndustry.id}
          language={locale}
          answers={answers}
          onDone={(_leadId, result) => setAnalysis(result)}
        />
      )}
      {analysis && <ConversionCta summary={analysis.summary} />}
    </main>
  );
}
```

Update `AnalysisReveal`'s `onDone` prop type (Task 12) to `(leadId: string, analysis: AnalysisResult) => void` and call `onDone(data.leadId, data.analysis)` in its fetch `.then()` handler if not already done in Task 13.

- [ ] **Step 2: Full manual QA pass — Chinese**

Open `/zh`. Walk the entire flow start to finish: Hero CTA → pick an industry with verified data (e.g. 装修/承包商) → confirm real case + highlights render → Start → answer all 3 questions → confirm loading → confirm bottlenecks/before/after render → confirm WhatsApp button opens with prefilled Chinese text → confirm theme switcher works throughout.

- [ ] **Step 3: Full manual QA pass — English**

Repeat Step 2 at `/en`, this time picking an industry WITHOUT verified data (e.g. F&B) — confirm the "Industry-typical scenario" badge shows instead of a real case.

- [ ] **Step 4: Verify rate limiting doesn't block normal QA**

Confirm you didn't trip the 5-requests-per-hour limit from Task 10 during QA. If you did, either wait out the window or temporarily raise the limit in `checkRateLimit`'s call site for local testing (revert before deploying).

- [ ] **Step 5: Deploy and verify on Vercel**

Run: `vercel --prod`
Repeat the Step 2 QA pass against the live URL.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Wire full Section 1-6 flow end-to-end"
```

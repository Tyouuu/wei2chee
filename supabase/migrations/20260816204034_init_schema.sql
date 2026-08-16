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

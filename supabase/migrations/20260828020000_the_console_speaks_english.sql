-- supabase/migrations/20260828020000_the_console_speaks_english.sql
--
-- The console's TRADE column was Chinese on the English portal, and no ruler
-- could see it.
--
-- `industries` has carried both `name_zh` and `name_en` since the very first
-- migration -- both NOT NULL, both populated. `console_customers` returns
-- `i.name_zh` and only `i.name_zh`, so the founder's own admin panel prints
-- 「装修/承包商」and 「其他」 in a column headed TRADE, next to a STAGE column
-- reading "Paid" and a header reading "Your business, without opening
-- Supabase". Task 18 counted 386 Chinese strings on the English portal and
-- drove them to zero; this one survived that sweep for a reason worth writing
-- down: `npm run check:en` signs in as tianyou.demo@formae.test, which is a
-- CUSTOMER account, and `is_founder()` is false for it. Every console route
-- 404s for the ruler. The ruler reported zero because it could not open the
-- page, not because the page was clean -- the same failure mode as
-- check:registers hashing the wrong nodes and reporting 0/0.
--
-- WHY BOTH NAMES COME BACK, NOT THE ONE THAT MATCHES A `lang` ARGUMENT. The
-- caller is a React component that already knows its locale, and `specToText`
-- established the pattern of passing language down. But this function feeds a
-- table that renders once per locale route, and returning both keeps the RPC
-- free of a language parameter that would have exactly two legal values and
-- would need updating the day a third locale appears. The column is nullable
-- on purpose: `industry_name` is already null for a customer with no lead.
--
-- Additive only. `industry_name` keeps its position, its name and its Chinese
-- value, so nothing reading this function today changes behaviour.

drop function if exists public.console_customers();

create or replace function public.console_customers()
returns table (
  project_id uuid,
  account_id uuid,
  email text,
  business_name text,
  owner_name text,
  industry_name text,
  industry_name_en text,
  style text,
  paid boolean,
  stage text,
  dev_fee_myr integer,
  monthly_fee_myr integer,
  page_count bigint,
  founder_note text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_founder() then
    raise exception 'not permitted';
  end if;

  return query
  select
    p.id, a.id, a.email, p.business_name, p.owner_name,
    i.name_zh, i.name_en, p.style, p.paid, p.stage, p.dev_fee_myr, p.monthly_fee_myr,
    (select count(*) from public.project_pages pp where pp.project_id = p.id),
    p.founder_note, p.created_at, p.updated_at
  from public.projects p
  join public.accounts a on a.id = p.account_id
  left join public.leads l on l.id = a.lead_id
  left join public.industries i on i.id = l.industry_id
  where a.role = 'customer'
  order by p.updated_at desc nulls last, p.created_at desc;
end;
$$;

revoke execute on function public.console_customers() from anon;
grant execute on function public.console_customers() to authenticated;

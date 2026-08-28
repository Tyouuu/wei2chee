-- supabase/migrations/20260828030000_the_leads_list_speaks_english.sql
--
-- The other half of 20260828020000. `console_customers` was returning only
-- `i.name_zh`; so is `console_leads`, and its column is on screen fifteen times
-- instead of twice -- 美容/沙龙, 批发/分销, 其他 down a page whose every other
-- word is English.
--
-- Split from that migration deliberately rather than folded into it. The
-- customers table was found by looking at a screenshot; this one was found by
-- the ruler afterwards, once check:en could finally sign in as the founder and
-- open the page at all. Two different discoveries, two migrations, so the log
-- says which was seen and which was measured.
--
-- Everything else is byte-for-byte the 20260821020000 body, including the
-- lateral join that takes only the newest analysis and the comment saying why.
-- `industry_name` keeps its position, its name and its Chinese value; the new
-- column is appended after it, which is additive for a `returns table` a client
-- reads by name.

-- Postgres refuses to change a function's return type in place, so the old
-- signature has to go before the new one can exist.
drop function if exists public.console_leads();

create or replace function public.console_leads()
returns table (
  id uuid,
  created_at timestamptz,
  language text,
  industry_name text,
  industry_name_en text,
  style_selected text,
  answers jsonb,
  summary text,
  bottlenecks jsonb,
  converted boolean,
  account_email text
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
    l.id, l.created_at, l.language, i.name_zh, i.name_en, l.style_selected, l.answers,
    ar.summary, ar.bottlenecks,
    (a.id is not null), a.email
  from public.leads l
  left join public.industries i on i.id = l.industry_id
  -- Newest analysis only. A lead can be re-analysed, and joining them all would
  -- multiply the row out once per attempt.
  left join lateral (
    select r.summary, r.bottlenecks
    from public.analysis_results r
    where r.lead_id = l.id
    order by r.generated_at desc
    limit 1
  ) ar on true
  left join public.accounts a on a.lead_id = l.id
  order by l.created_at desc;
end;
$$;

revoke execute on function public.console_leads() from anon;
grant execute on function public.console_leads() to authenticated;

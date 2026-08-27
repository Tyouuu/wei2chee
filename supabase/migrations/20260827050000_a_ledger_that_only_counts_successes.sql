-- A LEDGER THAT ONLY RECORDS SUCCESSES CANNOT ANSWER 「它坏了吗」.
--
-- `ai_usage` records a row after the model replies. Every call that FAILED --
-- the provider 500ing, the request being cut off at the platform's ceiling,
-- a reply that would not parse -- writes nothing at all. So the table answers
-- 「这个功能花我多少钱」 and is silent on the only other question anybody asks
-- of a running feature, which is whether it is still working.
--
-- Today the answer to 「AI 坏了我们怎么知道」 is: a customer tells us. The
-- failures go to console.error, which lands in the hosting platform's log
-- viewer, which the founder does not read and which expires.
--
-- TWO COLUMNS, NOT A SECOND TABLE. A failure is the same event as a success --
-- one attempt at one surface, on one account, at one moment -- and splitting
-- them means every question about the rate has to join two tables and every
-- new question has to be asked twice.
--
-- took_ms IS THE OTHER HALF. Latency has only ever been measured from a
-- developer's machine through eval:editor (median 3.8s, p95 8.0s, slowest 12s
-- on 2026-08-27). That is our network to the provider, not a contractor's
-- phone on Malaysian mobile through a serverless function. The wait is the
-- thing this route was just given a ceiling for; there is no reason to keep
-- guessing at it once real calls exist.

alter table public.ai_usage
  -- 'ok' as the default so the rows already written keep meaning what they
  -- meant: every one of them is a call that returned.
  add column if not exists outcome text not null default 'ok'
    check (outcome in ('ok', 'failed')),
  add column if not exists took_ms integer;

comment on column public.ai_usage.outcome is
  'ok = the model replied. failed = it did not, and the counts are zero because there is nothing to count.';
comment on column public.ai_usage.took_ms is
  'Wall clock around the model call, from the server. Null when unknown.';

-- The failure rate is asked over a window, so the existing (account, created)
-- index does not serve it -- every such question scans by time first.
create index if not exists ai_usage_created_outcome_idx
  on public.ai_usage (created_at desc, outcome);

create or replace function public.record_ai_usage(
  in_surface text,
  in_model text,
  in_prompt_tokens integer,
  in_completion_tokens integer,
  in_reasoning_tokens integer default null,
  -- Defaulted, so the two callers can be updated one at a time and an older
  -- deploy calling the four-argument shape still writes a row.
  in_outcome text default 'ok',
  in_took_ms integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_rows integer;
begin
  if auth.uid() is null then
    return;
  end if;

  -- No real call comes anywhere near this; the model's context window is the
  -- actual bound and it is far smaller. See 20260827040000 for why a ceiling
  -- exists at all: this function is granted to `authenticated` and therefore
  -- reachable from a browser, because the routes that call it use the caller's
  -- own session rather than a service key.
  if coalesce(in_prompt_tokens, 0) > 2000000
     or coalesce(in_completion_tokens, 0) > 2000000
     or coalesce(in_reasoning_tokens, 0) > 2000000 then
    return;
  end if;

  select count(*) into recent_rows
  from public.ai_usage
  where account_id = auth.uid()
    and created_at > now() - interval '1 hour';

  -- Six times what the editor's own rate limit permits.
  if recent_rows >= 240 then
    return;
  end if;

  insert into public.ai_usage (
    account_id, surface, model, prompt_tokens, completion_tokens, reasoning_tokens,
    outcome, took_ms
  )
  values (
    auth.uid(),
    in_surface,
    left(coalesce(in_model, ''), 64),
    greatest(coalesce(in_prompt_tokens, 0), 0),
    greatest(coalesce(in_completion_tokens, 0), 0),
    case when in_reasoning_tokens is null then null
         else greatest(in_reasoning_tokens, 0) end,
    -- Anything that is not a word we know is recorded as a failure rather than
    -- rejected: this function must never be the reason an edit fails, and a
    -- row landing under the wrong label is a smaller lie than a row that is
    -- silently missing.
    case when in_outcome = 'failed' then 'failed' else 'ok' end,
    -- A whole day is not a plausible model call; a negative one is not a
    -- duration. Dropped to null rather than clamped, for the same reason the
    -- token ceiling drops rather than clamps: a kept number that was invented
    -- is worse than no number.
    case when in_took_ms is null or in_took_ms < 0 or in_took_ms > 3600000
         then null else in_took_ms end
  );
end;
$$;

-- The four-and-five-argument shapes are gone: Postgres keeps them as separate
-- overloads, and two functions with the same name and different ceilings is
-- how a guard gets quietly bypassed later.
drop function if exists public.record_ai_usage(text, text, integer, integer, integer);

revoke execute on function public.record_ai_usage(text, text, integer, integer, integer, text, integer) from public;
grant execute on function public.record_ai_usage(text, text, integer, integer, integer, text, integer) to authenticated;

comment on function public.record_ai_usage(text, text, integer, integer, integer, text, integer) is
  'Records one model call -- successful or not -- for the CALLING account. Reachable from the browser by design, so it drops impossible counts and caps rows per hour.';

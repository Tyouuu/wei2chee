-- THE LEDGER CAN BE WRITTEN TO FROM A BROWSER, SO IT NEEDS A CEILING.
--
-- `record_ai_usage` is security definer with no insert policy, which stops a
-- customer writing a row against somebody ELSE's account. It does not stop
-- them writing nonsense against their own: the function is granted to
-- `authenticated`, and it has to be -- the two routes that call it use the
-- caller's own session, not a service key, so the browser's JWT is what
-- reaches Postgres.
--
-- That leaves one real hole. A customer can call the RPC directly with
-- in_prompt_tokens = 999999999 and poison the only row anyone would use to
-- answer 「这个功能花我多少钱」. Nobody else's numbers move, but the founder's
-- total does, and a total that can be moved by the people being measured is
-- not a total.
--
-- Raised by the other session reviewing the migration, not by me writing it.
--
-- WHERE THE CEILING COMES FROM. The editor route allows 40 calls per hour per
-- account (its own rate limit), and analyze runs at most a handful of attempts
-- at signup. 240 rows an hour is six times the reachable ceiling -- wide enough
-- that no real customer will ever meet it, narrow enough that the table cannot
-- be filled. Per-call token counts are bounded by the model's context window,
-- which is orders of magnitude under 2,000,000.
--
-- OVER THE LINE MEANS DROPPED, NOT CLAMPED. Clamping would keep a row whose
-- number is invented; dropping keeps the ledger honest and loses nothing real,
-- because a real call cannot get here. And it stays SILENT either way -- see
-- lib/portal/ai-usage.ts: accounting must never be the reason an edit fails in
-- front of a customer.

create or replace function public.record_ai_usage(
  in_surface text,
  in_model text,
  in_prompt_tokens integer,
  in_completion_tokens integer,
  in_reasoning_tokens integer default null
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
  -- actual bound and it is far smaller.
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
    account_id, surface, model, prompt_tokens, completion_tokens, reasoning_tokens
  )
  values (
    auth.uid(),
    in_surface,
    left(coalesce(in_model, ''), 64),
    greatest(coalesce(in_prompt_tokens, 0), 0),
    greatest(coalesce(in_completion_tokens, 0), 0),
    case when in_reasoning_tokens is null then null
         else greatest(in_reasoning_tokens, 0) end
  );
end;
$$;

revoke execute on function public.record_ai_usage(text, text, integer, integer, integer) from public;
grant execute on function public.record_ai_usage(text, text, integer, integer, integer) to authenticated;

comment on function public.record_ai_usage(text, text, integer, integer, integer) is
  'Records one model call for the CALLING account. Reachable from the browser by design -- the routes use the caller''s session -- so it drops impossible counts and caps rows per hour.';

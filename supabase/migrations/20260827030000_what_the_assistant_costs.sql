-- WHAT THE ASSISTANT COSTS.
--
-- Every AI call in this product is spent on the founder's own OpenAI key: the
-- questionnaire analysis at signup, and every sentence typed into the editor.
-- There is auth in front of both and a rate limit on the editor -- and there
-- has never been anywhere that records what a call cost. He pays the bill and
-- cannot see what produced it, so the answer to 「这个功能花我多少钱」 is a
-- number nobody in this repo can currently produce.
--
-- WHAT IS NOT STORED, DELIBERATELY. No prompt, no reply, no page content, no
-- instruction the owner typed. This table answers 「多少」 and nothing else --
-- a business owner's description of his own trade is his, and a usage ledger
-- is the wrong place for it to accumulate. Everything here is a count.

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users(id) on delete cascade,
  -- Which call: 'analyze' is the questionnaire at signup, 'edit' is a sentence
  -- typed into the editor. They have very different shapes -- one is once per
  -- customer, the other is once per thought -- so a single total would hide
  -- which of the two is actually spending the money.
  surface text not null check (surface in ('analyze', 'edit')),
  model text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  -- Reasoning tokens are billed as output and are invisible in the reply, so a
  -- count that leaves them out under-reports exactly the setting we run at
  -- (reasoning_effort high). Nullable because a model that does not reason
  -- returns nothing here, and 0 would be a claim rather than an absence.
  reasoning_tokens integer,
  created_at timestamptz not null default now()
);

comment on table public.ai_usage is
  'One row per model call. Counts only -- never prompts, replies or page content.';

create index if not exists ai_usage_account_created_idx
  on public.ai_usage (account_id, created_at desc);

alter table public.ai_usage enable row level security;

-- A customer may read their own usage and nothing else. No insert policy at
-- all: rows arrive through the function below, which resolves the account from
-- auth.uid() itself, so a browser cannot write a row against somebody else's
-- account or invent numbers against its own.
drop policy if exists ai_usage_select_own on public.ai_usage;
create policy ai_usage_select_own on public.ai_usage
  for select using (account_id = auth.uid());

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
begin
  -- Signed out means nothing to attribute. Silently doing nothing is right
  -- here: usage accounting must never be the reason an edit fails in front of
  -- a customer.
  if auth.uid() is null then
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

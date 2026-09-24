-- 改回来：20260925020000 故意弄坏的全部撤销，恢复 20260925010000 的版本。
drop policy if exists "BROKEN read all" on public.day_closings;
drop policy if exists "BROKEN insert all" on public.day_closings;
drop policy if exists "BROKEN update all" on public.day_closings;
drop policy if exists "BROKEN delete all" on public.day_closings;
create policy "day closings are read by money-seers" on public.day_closings
  for select using (public.sees_money(project_id));
create unique index if not exists day_closings_one_live_per_day
  on public.day_closings (project_id, closing_date)
  where voided_at is null;

create or replace function public.lock_day_closing(
  in_project_id uuid,
  in_closing_date date,
  in_counts jsonb,
  in_float_cents bigint,
  in_expected_cash_cents bigint,
  in_gross_cents bigint,
  in_outflows_cents bigint,
  in_settlements jsonb,
  in_checklist jsonb,
  in_note text,
  in_idempotency_key uuid default null
)
returns public.day_closings
language plpgsql
security definer
set search_path = public
as $$
declare
  norm jsonb := '{}'::jsonb;
  counted bigint := 0;
  k text;
  v text;
  existing public.day_closings;
  row public.day_closings;
  who text;
  sett jsonb := coalesce(in_settlements, '[]'::jsonb);
  chk jsonb := coalesce(in_checklist, '[]'::jsonb);
  cnt jsonb := coalesce(in_counts, '{}'::jsonb);
begin
  if not public.sees_money(in_project_id) then
    raise exception 'closing the day is for the owner';
  end if;
  if in_closing_date is null or in_closing_date > public.today_myt() then
    raise exception 'you can only close today or an earlier day';
  end if;

  -- 按了两下：同一把钥匙回原来那一份，不多开一份
  if in_idempotency_key is not null then
    select * into existing from public.day_closings
     where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then
      return existing;
    end if;
  end if;

  if jsonb_typeof(cnt) <> 'object' then
    raise exception 'the count must be a list of notes and how many of each';
  end if;
  for k, v in select key, value from jsonb_each_text(cnt) loop
    if k not in ('100', '50', '20', '10', '5', '1') then
      raise exception 'RM % is not a note this count knows about', k;
    end if;
    if v !~ '^[0-9]{1,6}$' then
      raise exception 'a count must be a whole number of notes';
    end if;
    if v::bigint > 0 then
      norm := norm || jsonb_build_object(k, v::bigint);
      counted := counted + k::bigint * v::bigint * 100;
    end if;
  end loop;

  if in_float_cents is null or in_float_cents < 0 then
    raise exception 'the float cannot be negative';
  end if;
  if coalesce(in_expected_cash_cents, -1) < 0
     or coalesce(in_gross_cents, -1) < 0
     or coalesce(in_outflows_cents, -1) < 0 then
    raise exception 'a total cannot be negative';
  end if;
  if jsonb_typeof(sett) <> 'array' or jsonb_array_length(sett) > 50 then
    raise exception 'the settlements must be a short list';
  end if;
  if jsonb_typeof(chk) <> 'array' or jsonb_array_length(chk) > 20 then
    raise exception 'the checklist must be a short list';
  end if;

  select * into existing from public.day_closings
   where project_id = in_project_id and closing_date = in_closing_date and voided_at is null;
  if found then
    raise exception 'that day is already closed -- reopen it first if the count was wrong';
  end if;

  -- 名字从登入的身分里取，不是页面传来的（页面传来的可以写成任何人）
  who := split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1);

  insert into public.day_closings (
    project_id, closing_date, counts, counted_cents, float_cents,
    expected_cash_cents, gross_cents, outflows_cents, settlements, checklist,
    note, locked_by, locked_by_name, idempotency_key
  ) values (
    in_project_id, in_closing_date, norm, counted, in_float_cents,
    in_expected_cash_cents, in_gross_cents, in_outflows_cents, sett, chk,
    left(btrim(coalesce(in_note, '')), 2000), auth.uid(), who, in_idempotency_key
  )
  returning * into row;

  return row;

exception
  when unique_violation then
    -- 两个分页同时按：输的那一个拿到赢的那一份，或者一句人话
    if in_idempotency_key is not null then
      select * into row from public.day_closings
       where project_id = in_project_id and idempotency_key = in_idempotency_key;
      if found then
        return row;
      end if;
    end if;
    raise exception 'that day is already closed -- reopen it first if the count was wrong';
end;
$$;

revoke execute on function public.lock_day_closing(uuid, date, jsonb, bigint, bigint, bigint, bigint, jsonb, jsonb, text, uuid) from public;
grant execute on function public.lock_day_closing(uuid, date, jsonb, bigint, bigint, bigint, bigint, jsonb, jsonb, text, uuid) to authenticated;

create or replace function public.reopen_day_closing(
  in_id uuid,
  in_reason text default ''
)
returns public.day_closings
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.day_closings;
begin
  select * into row from public.day_closings
   where id = in_id and public.sees_money(project_id);
  if not found then
    raise exception 'no such closing in your business';
  end if;

  -- 已经重开过的：原样回，不再标一次（按两下不改掉第一次的时间跟原因）
  if row.voided_at is not null then
    return row;
  end if;

  update public.day_closings
     set voided_at = now(),
         voided_by = auth.uid(),
         void_reason = left(btrim(coalesce(in_reason, '')), 500)
   where id = in_id
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.reopen_day_closing(uuid, text) from public;
grant execute on function public.reopen_day_closing(uuid, text) to authenticated;

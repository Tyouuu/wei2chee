-- 改回来：20260911840000 弄坏的那一行撤销掉，恢复 20260911830000 的版本。
create or replace function public.use_credit(
  in_project_id uuid,
  in_party_id uuid,
  in_amount_cents bigint,
  in_reason text default '',
  in_idempotency_key uuid default null
)
returns stored_value_moves
language plpgsql
security definer
set search_path = public
as $$
declare
  made public.stored_value_moves;
  left_over bigint;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your business';
  end if;
  if coalesce(in_amount_cents, 0) <= 0 then
    raise exception 'say how much was used';
  end if;

  perform 1 from public.directory_entries
   where id = in_party_id and project_id = in_project_id
   for update;
  if not found then
    raise exception 'that person is not in your directory';
  end if;

  if in_idempotency_key is not null then
    select * into made from public.stored_value_moves
     where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then return made; end if;
  end if;

  select coalesce(sum(case when direction = 'in' then amount_cents
                           else -amount_cents end), 0)
    into left_over
    from public.stored_value_moves
   where project_id = in_project_id and party_id = in_party_id;
  if left_over < in_amount_cents then
    raise exception 'she only has % sen of gift credit left', left_over;
  end if;

  insert into public.stored_value_moves
    (project_id, party_id, direction, amount_cents, reason,
     created_by, idempotency_key)
  values (in_project_id, in_party_id, 'out', in_amount_cents,
          left(btrim(coalesce(in_reason, '')), 200), auth.uid(), in_idempotency_key)
  returning * into made;
  return made;

exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into made from public.stored_value_moves
       where project_id = in_project_id and idempotency_key = in_idempotency_key;
      if found then return made; end if;
    end if;
    raise;
end;
$$;

-- 🔴 同一个坑，第二次撞到——这次是钱，不是库存。
--
-- `use_credit` 先 `select sum(...)` 算出「她还剩多少」，再检查够不够、
-- 才插一笔 `out`。两笔并发的「用掉 RM X」（两个柜台同时替她结帐、
-- 或者一次网路重试撞上原本那次）都会读到同一个「还剩多少」，
-- 都通过检查、都插进去——她能用掉的钱变成实际拥有的两倍。
-- 跟 20260911540000 那次 `count_stock` 的坑一模一样的形状：
-- 读一个会变的聚合数、检查、再写，中间没有锁。
--
-- 顺手补一个从来没做过的检查：`in_party_id` today 没有验证过属於
-- 这一家——补上，而它同时就是要锁的那一行（`directory_entries`
-- 一个客人只有一行，锁它就是真的排队：先到的把整支做完才放手）。
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

  /* 🔴 锁这一位客人，不是锁流水——`stored_value_moves` 只加不改，
     锁现有的行锁不住「等一下要插进来的新那一行」，跟 count_stock
     那次一模一样的坑。`directory_entries` 一个客人只有一行，
     锁它才是真的排队。顺手补上从来没做过的「这个人是不是这家的」。 */
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

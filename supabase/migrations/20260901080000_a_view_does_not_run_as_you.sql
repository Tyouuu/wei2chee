-- supabase/migrations/20260901080000_a_view_does_not_run_as_you.sql
--
-- Two things 20260901070000 got wrong. Neither was findable by reading it, and
-- `supabase db push` reported success on both.
--
-- ── 🔴 ① A VIEW DOES NOT RUN AS THE CALLER ────────────────────────────────
--
-- `stock_on_hand` was written with this comment beside it:
--
--     A view runs as the CALLER, so RLS on the two tables underneath decides
--     what it returns -- which is exactly right and is why no policy is
--     written here.
--
-- That is false. In Postgres a view executes with the privileges of its OWNER
-- unless `security_invoker` is set, and migrations run as `postgres`. So the
-- view read straight past row-level security on both tables underneath it.
--
-- MEASURED, as a second real customer with a real session:
--
--     PASS  别人看不到我的货            (catalog_items -- RLS held)
--     PASS  别人也动不了我的货          (move_stock  -- the function held)
--     FAIL  连算出来的那张表也看不到 — 4  (stock_on_hand -- FOUR ROWS)
--
-- One business read another business's shelf. That is the worst class of
-- defect this product can have, it shipped in a file whose own comment
-- asserted the opposite, and the only reason it did not reach anybody is that
-- every RPC gets called for real before it counts as done (重点 26).
--
-- ⚠️ AND IT IS A CLASS, NOT AN INSTANCE. This is the first view in the schema.
-- Every future one needs the same flag, so the guard added alongside this
-- migration asserts it of every view in `public` rather than of this one.
--
-- ── ② `next_doc_no` HAD NEVER HEARD OF A CATALOG ─────────────────────────
--
-- It asks 「is this a pipeline module or a ledger module」 and raises otherwise,
-- so every movement failed with `no numbered table for module: inventory` --
-- and eight of the twenty-four assertions failed behind that one line.
--
-- The list is in three places inside that one function (the guard, the seed,
-- and the collision check) and each needed the third branch. Rewritten whole
-- rather than patched, because plpgsql resolves names when it RUNS and a
-- half-edited function is the shape 20260831060000 already exists to fix.

create or replace view public.stock_on_hand
with (security_invoker = true)
as
  select
    i.id as item_id,
    i.project_id,
    i.module_key,
    i.name,
    i.unit,
    i.location,
    i.reorder_at,
    coalesce(sum(m.qty) filter (where m.direction = 'in'), 0)
      - coalesce(sum(m.qty) filter (where m.direction = 'out'), 0) as on_hand,
    max(m.moved_on) as last_moved_on,
    count(m.id) as moves
  from public.catalog_items i
  left join public.stock_moves m on m.item_id = i.id
  where i.archived_at is null
  group by i.id;

comment on view public.stock_on_hand is
  'The derived total. `security_invoker = true` is load-bearing: without it this view reads past RLS and one business sees another''s shelf -- measured, 4 rows. Never write to it; write a movement.';

grant select on public.stock_on_hand to authenticated;

-- ── AND THE COUNTER LEARNS THE THIRD SHAPE ────────────────────────────────

create or replace function public.default_doc_prefix(key text)
returns text
language sql
immutable
as $$
  select case key
    when 'quotations' then 'QT'
    when 'orders' then 'SO'
    when 'projects' then 'PJ'
    when 'tasks' then 'TK'
    when 'purchases' then 'PO'
    when 'payments' then 'RC'
    when 'expenses' then 'EX'
    when 'commission' then 'CM'
    /* 库存. A movement is a voucher: somebody has to be able to point at it
       next month and ask what happened to those sixteen bags. */
    when 'inventory' then 'ST'
    else 'DOC'
  end;
$$;

create or replace function public.next_doc_no(in_project_id uuid, in_module_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  my_prefix text;
  v_yr text := to_char(public.today_myt(), 'YYYY');
  n bigint;
  seed bigint;
  candidate text;
  like_pattern text;
  attempts integer := 0;
begin
  if not (
    public.is_pipeline_module(in_module_key)
    or public.is_ledger_module(in_module_key)
    or public.is_catalog_module(in_module_key)
  ) then
    raise exception 'no numbered table for module: %', in_module_key;
  end if;

  select prefix into my_prefix
  from public.project_doc_prefixes
  where project_id = in_project_id and module_key = in_module_key;

  my_prefix := coalesce(my_prefix, public.default_doc_prefix(in_module_key));
  like_pattern := my_prefix || '-' || v_yr || '-%';

  loop
    attempts := attempts + 1;
    if attempts > 50 then
      /* Fifty taken numbers in a row means something is writing doc_no behind
         the counter's back. Failing here is right: the alternative -- issuing
         a duplicate -- is the one thing an accounting number may never be. */
      raise exception 'could not find a free document number for % after % tries', in_module_key, attempts;
    end if;

    /* The fast path, and what makes concurrency safe: a single UPDATE takes a
       row lock, so a second caller waits, re-reads and gets n+1. Measured
       before this existed: 8 simultaneous presses wrote 6 payments. */
    update public.doc_counters
       set last_no = doc_counters.last_no + 1, updated_at = now()
     where doc_counters.project_id = in_project_id
       and doc_counters.module_key = in_module_key
       and doc_counters.yr = v_yr
    returning doc_counters.last_no into n;

    if not found then
      /* First document of this module this year -- or the first since this
         counter existed. Seeded from what has ALREADY been issued, so a
         business with rows from before today continues from where it was
         rather than restarting at 0001 on top of its own receipts. */
      if public.is_pipeline_module(in_module_key) then
        select coalesce(max(substring(doc_no from '[0-9]+$')::bigint), 0) into seed
        from public.pipeline_records
        where project_id = in_project_id and module_key = in_module_key
          and doc_no like like_pattern and doc_no ~ '-[0-9]+$';
      elsif public.is_ledger_module(in_module_key) then
        select coalesce(max(substring(doc_no from '[0-9]+$')::bigint), 0) into seed
        from public.ledger_entries
        where project_id = in_project_id and module_key = in_module_key
          and doc_no like like_pattern and doc_no ~ '-[0-9]+$';
      else
        /* stock_moves carries no module_key -- a movement belongs to an ITEM,
           and the item carries it. Joined rather than duplicated, because a
           second copy of the module on every movement is a second thing that
           can disagree with the first. */
        select coalesce(max(substring(m.doc_no from '[0-9]+$')::bigint), 0) into seed
        from public.stock_moves m
        join public.catalog_items i on i.id = m.item_id
        where m.project_id = in_project_id and i.module_key = in_module_key
          and m.doc_no like like_pattern and m.doc_no ~ '-[0-9]+$';
      end if;

      insert into public.doc_counters (project_id, module_key, yr, last_no)
      values (in_project_id, in_module_key, v_yr, seed)
      on conflict (project_id, module_key, yr) do nothing;

      /* Round again. Whether this call seeded it or lost the race to one that
         did, the UPDATE above is now the single place a number comes from. */
      continue;
    end if;

    candidate := my_prefix || '-' || v_yr || '-' || lpad(n::text, 4, '0');

    /* Taken by something that did not come through here -- an authenticated
       session can still insert a doc_no directly. Skip it and let the counter
       carry past rather than raise in the caller's face. */
    if public.is_pipeline_module(in_module_key) then
      perform 1 from public.pipeline_records
       where project_id = in_project_id and module_key = in_module_key and doc_no = candidate;
    elsif public.is_ledger_module(in_module_key) then
      perform 1 from public.ledger_entries
       where project_id = in_project_id and module_key = in_module_key and doc_no = candidate;
    else
      perform 1 from public.stock_moves
       where project_id = in_project_id and doc_no = candidate;
    end if;
    if not found then
      return candidate;
    end if;
  end loop;
end;
$$;

comment on function public.next_doc_no(uuid, text) is
  'The next document number for one project, module and year: QT-2026-0042, RC-2026-0007, ST-2026-0011. Comes from a locked counter row, never from counting documents. Knows three shapes -- pipeline, ledger, catalog -- and every new numbered shape has to be added in all three branches here.';

revoke execute on function public.next_doc_no(uuid, text) from public;
grant execute on function public.next_doc_no(uuid, text) to authenticated;

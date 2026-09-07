-- 🔴 收紧：一张已经出过菜的单，行不给整批换掉。
--
-- 20260908040000 把 served_qty 放上 record_lines，而 set_record_lines 是
-- **整批换**（全删再全插）—— 所以一张单每加一碟菜，已经出的那几碟会归零，
-- 厨房重做一次，而画面上什么都不会讲。任务 93 付过同一次学费。
--
-- ⚠️ 这是三步里的最后一步（重点 31：先「加」→ 再「放宽」→「收紧」单独放最后）。
-- ⚠️ 这一支是从 20260905380000 —— **最后一次定义它的那个档案** —— 原样抽出来的，
--    只加那一段，不是照记忆重打（整支重写咬过三次）。

create or replace function public.set_record_lines(
  in_record_id uuid,
  in_lines jsonb
)
returns setof public.record_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  mine boolean;
  item jsonb;
  i integer := 0;
  received integer;
  is_en boolean;
  plated integer;
  proj uuid;
  the_item uuid;
  the_price bigint;
  the_qty numeric;
  the_amount bigint;
  went_out boolean;
begin
  /* works_here, not account_id: a site supervisor writes the lines of a job
     too. The money functions are the ones that still ask sees_money. */
  select exists (
    select 1 from public.pipeline_records r
    join public.projects p on p.id = r.project_id
    where r.id = in_record_id and public.works_here(p.id)
  ) into mine;
  if not mine then
    raise exception 'no such document in your project';
  end if;

  select r.project_id into proj
    from public.pipeline_records r where r.id = in_record_id;

  /* 🔴 20260901110000 加的那一条，一个字都没改：货已经动过的单，行就锁了。
     ⚠️ 而它问的是 `against_id = 这张单`，**没有问方向** —— 所以它今天
     自动把「已经出货的单」一起锁住了，不用另外写一条。 */
  select count(*) into received
  from public.stock_moves where against_id = in_record_id;

  if received > 0 then
    select p.system_language = 'en' into is_en
      from public.pipeline_records r
      join public.projects p on p.id = r.project_id
     where r.id = in_record_id;
    /* 🔴 讲清楚是**进**了还是**出**了。
       原本只有一句「已经进了库存」，因为原本只有收货会动它。
       050000 让出货也会动它，而我在那一支里把两种情况合并成了一句
       「已经在库存里动过了」—— 那一句两边都不精确，
       而**一句讲错方向的拒绝比一句笼统的更糟**：他会去找一张
       根本不存在的进货记录。（顺带：`check-records` 第 722 条当场红了，
       因为它守的就是那句话要讲人话。） */
    select bool_or(m.direction = 'out') into went_out
      from public.stock_moves m where m.against_id = in_record_id;

    if is_en then
      if went_out then
        raise exception
          'The goods on this order have already left your stock, so its lines cannot be changed. Record what actually happened as a stock movement instead.';
      else
        raise exception
          'The goods on this order are already in your stock, so its lines cannot be changed. Record what actually happened as a stock movement instead.';
      end if;
    else
      if went_out then
        raise exception
          '这张单的货已经出了库存，行就不能再改了。要更正就记一笔进或出。';
      else
        raise exception
          '这张单的货已经进了库存，行就不能再改了。要更正就记一笔进或出。';
      end if;
    end if;
  end if;

  /* 🔴 20260908050000 加的一条**收紧**（重点 31：最危险，所以单独做、放最后）。
     这一支是**整批换**（全删再全插），所以一张已经出过菜的单每加一碟，
     那几碟已经出的会归零，**厨房重做一次，而画面上什么都不会讲**。
     那正是任务 93 付过学费的那个形状。

     ⚠️ 爆炸半径量过：served_qty 到处都预设 0，只有 serve_line 写它 ——
     所以这一条只会在**餐饮那种已经出过菜的单**上开火，
     其他每一个行业一个字都不会变。

     出路讲得出来：加菜用 append_record_line（20260908040000），
     它一个字都不会动到已经在的那几行。 */
  select count(*) into plated
  from public.record_lines where record_id = in_record_id and served_qty > 0;

  if plated > 0 then
    select p.system_language = 'en' into is_en
      from public.pipeline_records r
      join public.projects p on p.id = r.project_id
     where r.id = in_record_id;
    if is_en then
      raise exception
        'Food on this order has already gone out, so its lines cannot be replaced. Add another line instead.';
    else
      raise exception
        '这张单已经出过菜了，行就不能整批换掉。要加菜就多加一行。';
    end if;
  end if;

  if jsonb_typeof(coalesce(in_lines, 'null'::jsonb)) <> 'array' then
    raise exception 'lines must be an array';
  end if;

  /* Twenty is a document; two hundred is an import, and an import is a
     different feature with a different set of questions. */
  if jsonb_array_length(in_lines) > 60 then
    raise exception 'too many lines on one document';
  end if;

  delete from public.record_lines where record_id = in_record_id;

  for item in select * from jsonb_array_elements(in_lines)
  loop
    if coalesce(btrim(item->>'description'), '') = '' then
      raise exception 'every line needs a description';
    end if;

    /* ── 这一行指的是架上哪一件 ──────────────────────────────────────
       可选。给了就要是**这一家自己的货品** —— 一行指向别人家货品的单，
       在画面上完全正常，而按下出货那一刻它会去动别人的架子。 */
    the_item := nullif(item->>'item_id', '')::uuid;
    the_price := nullif(item->>'unit_price_cents', '')::bigint;
    the_qty := nullif(item->>'qty', '')::numeric;
    the_amount := nullif(item->>'amount_cents', '')::bigint;

    if the_item is not null then
      perform 1 from public.catalog_items
        where id = the_item and project_id = proj and archived_at is null;
      if not found then
        raise exception 'that item is not on your shelf';
      end if;

      /* 🔴 卖价第一次真的被读到。`price_cents` 从 20260901070000 就在，
         而在今天之前**没有一个地方读过它** —— 第二十次「能力有、线没接」。

         ⚠️ **只在他没有自己写价钱的时候用**。目录上的价是他平常卖的价；
         这一单谈的价是这一单的。谈好的那个永远赢 ——
         一个会把他谈好的价盖掉的目录，他第二天就不敢用了。 */
      if the_price is null then
        select c.price_cents into the_price
          from public.catalog_items c where c.id = the_item;
      end if;
    end if;

    /* 两个都没给、而算得出来的时候才算。
       ⚠️ `amount_cents` 的注解写着「它存的是**谈好**的那个数」——
       所以这里只填空白，不覆盖：一个当天给的折扣不是 qty × price。 */
    if coalesce(the_amount, 0) = 0 and the_qty is not null and the_price is not null then
      the_amount := round(the_qty * the_price)::bigint;
    end if;

    insert into public.record_lines (
      record_id, project_id, description, qty, unit,
      unit_price_cents, amount_cents, sort_order, note, extra, item_id,
      /* 盒子上印的那两样。供应商的单上写着，而收货就是一批货出生的地方。 */
      batch_code, expiry_on
    ) values (
      in_record_id,
      /* Overwritten by the trigger; a value is needed for the not-null. */
      '00000000-0000-0000-0000-000000000000'::uuid,
      left(btrim(item->>'description'), 300),
      the_qty,
      left(coalesce(btrim(item->>'unit'), ''), 30),
      the_price,
      coalesce(the_amount, 0),
      i,
      left(coalesce(item->>'note', ''), 500),
      coalesce(item->'extra', '{}'::jsonb),
      the_item,
      nullif(left(btrim(coalesce(item->>'batch_code', '')), 60), ''),
      nullif(item->>'expiry_on', '')::date
    );
    i := i + 1;
  end loop;

  /* An emptied list has to put the total back under the owner's control
     rather than leaving the last computed sum standing as if it were typed. */
  if jsonb_array_length(in_lines) = 0 then
    update public.pipeline_records set amount_cents = null, updated_at = now()
     where id = in_record_id;
  end if;

  return query
    select * from public.record_lines
     where record_id = in_record_id
     order by sort_order;
end;
$$;

-- 把「开单顺手挂车」那一段原样搬回去。
--
-- 20260906690000 拿掉它之后，三条红，而第三条才是重点：
--     **那张挂不上车的单存下来了** —— 不报错、不讲，
--     到下一次他打那个车牌才发现历史少了一次。
--
-- ⚠️ 从 20260906680000 原样抽出来，不是照记忆重打。

drop function if exists public.add_pipeline_record(uuid, text, text, text, bigint, text, date, date, jsonb, uuid, uuid, uuid, uuid, uuid, integer);

create or replace function public.add_pipeline_record(
  in_project_id uuid,
  in_module_key text,
  in_title text default '',
  in_party text default '',
  in_amount_cents bigint default null,
  in_stage text default null,
  in_issued_on date default null,
  in_due_on date default null,
  in_extra jsonb default '{}'::jsonb,
  in_idempotency_key uuid default null,
  in_party_id uuid default null,
  in_site_address_id uuid default null,
  in_branch_id uuid default null,
  /* 🔴 哪一台车 · 几公里。**最后而且有预设**，
     所以既有的每一个呼叫端一个字都不用改。 */
  in_vehicle_id uuid default null,
  in_odometer_km integer default null
)
returns public.pipeline_records
language plpgsql
security definer
set search_path = public
as $$
declare
  mine boolean;
  row public.pipeline_records;
  first_stage text;
  the_party uuid;
  is_en boolean;
  site_owner uuid;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your project';
  end if;

  if not public.is_pipeline_module(in_module_key) then
    raise exception 'not a pipeline module: %', in_module_key;
  end if;

  /* 别人家的分店挂不上来。跟工地那一条同一类：一个指错地方的连结，
     画面上完全正常，而月底那张分店报表是错的。 */
  if not public.branch_is_ours(in_project_id, in_branch_id) then
    raise exception 'that branch is not in this project';
  end if;

  if in_idempotency_key is not null then
    select * into row from public.pipeline_records
    where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then
      return row;
    end if;
  end if;

  if in_party_id is not null then
    perform 1 from public.directory_entries
      where id = in_party_id
        and project_id = in_project_id
        and module_key = public.directory_side(in_module_key);
    if not found then
      raise exception 'that party is not on this side of the book';
    end if;
    the_party := in_party_id;
  else
    the_party := public.party_by_name(
      in_project_id, in_party, public.directory_side(in_module_key)
    );
  end if;

  if in_site_address_id is not null then
    select a.party_id into site_owner
    from public.directory_addresses a
    where a.id = in_site_address_id and a.project_id = in_project_id;
    if site_owner is null then
      raise exception 'no such address in your project';
    end if;
    if the_party is null then
      raise exception 'pick the customer before the site';
    end if;
    if site_owner <> the_party then
      raise exception 'that address belongs to somebody else';
    end if;
  end if;

  if in_stage is null or btrim(in_stage) = '' then
    if in_module_key = 'purchases' then
      select p.system_language = 'en' into is_en
        from public.projects p where p.id = in_project_id;
      first_stage := case when is_en then 'Ordered' else '开了单' end;
    else
      select case when p.system_language = 'en'
                  then coalesce(ar.after_workflow_en, ar.after_workflow)
                  else ar.after_workflow
             end ->> 0
        into first_stage
        from public.projects p
        join public.accounts a on a.id = p.account_id
        join public.analysis_results ar on ar.lead_id = a.lead_id
       where p.id = in_project_id;
    end if;
  end if;

  insert into public.pipeline_records (
    project_id, module_key, doc_no, title, party, party_id, amount_cents, stage,
    issued_on, due_on, extra, idempotency_key, site_address_id, branch_id
  ) values (
    in_project_id,
    in_module_key,
    public.next_doc_no(in_project_id, in_module_key),
    left(coalesce(in_title, ''), 200),
    left(coalesce(in_party, ''), 200),
    the_party,
    in_amount_cents,
    left(coalesce(nullif(btrim(coalesce(in_stage, '')), ''), coalesce(first_stage, '')), 60),
    coalesce(in_issued_on, public.today_myt()),
    in_due_on,
    coalesce(in_extra, '{}'::jsonb),
    in_idempotency_key,
    in_site_address_id,
    in_branch_id
  )
  returning * into row;

  /* 🔴 开单跟挂车是同一件事 —— `walk:workshop` 量出来的那一件。
     柜台那一句话本来就是一句：「WA 1234 A，六万二，洗油」。

     ⚠️ 走的是 **`set_record_vehicle` 同一支** —— 里程往回走要挡、
     那台车要是这一家的，那几条守卫只有一份（重点 23）。
     ⚠️ 摆在 return 之前，所以里程被挡下来的时候
     **整张单一起回滚** —— 一张挂不上车的单存下来，
     比拒绝更难发现。 */
  if in_vehicle_id is not null or in_odometer_km is not null then
    perform public.set_record_vehicle(
      row.id, in_vehicle_id, in_odometer_km, false
    );
    select * into row from public.pipeline_records where id = row.id;
  end if;

  return row;

exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into row from public.pipeline_records
      where project_id = in_project_id and idempotency_key = in_idempotency_key;
      if found then
        return row;
      end if;
    end if;
    raise;
end;
$$;

revoke execute on function public.add_pipeline_record(uuid, text, text, text, bigint, text, date, date, jsonb, uuid, uuid, uuid, uuid, uuid, integer) from public, anon;
grant execute on function public.add_pipeline_record(uuid, text, text, text, bigint, text, date, date, jsonb, uuid, uuid, uuid, uuid, uuid, integer) to authenticated;

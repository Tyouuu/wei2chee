-- 那张单讲得出自己是哪一个工地的。
--
-- 20260903060000 建了地址跟 `pipeline_records.site_address_id`，
-- **而没有任何一支写入函式收得下它** —— 那就是这个仓库最常犯的那个错，
-- 而且是同一支迁移自己制造出来的。这一支把线接上。
--
-- ⚠️ 加一个参数会**造出一支新函式**，而 Postgres 新函式的 EXECUTE 预设是
-- 给 PUBLIC 的（20260901040000 白纸黑字写下的那一条）。所以：
--   ① 先 drop 旧签名，不然两支重载并存，而没有人知道呼叫的是哪一支
--   ② 明确 revoke public, anon 再 grant authenticated
--
-- ⚠️ 而且两支都要收 —— 人按的那颗按钮跟 AI 走的是同一支
-- （[重点 23] AI 平权）。只加在 add 上，等於「加一单」填得了工地、
-- 「改这一单」改不了，而那个不一致他会在第二天发现。

drop function if exists public.add_pipeline_record(
  uuid, text, text, text, bigint, text, date, date, jsonb, uuid, uuid
);
drop function if exists public.update_pipeline_record(
  uuid, text, text, bigint, text, date, date, jsonb, uuid, boolean, boolean
);

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
  in_site_address_id uuid default null
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

  /* 🔴 别人的地址，挂不上这一张单。
     跟 20260903030000 挡「别的单上的一期」是同一类：一个指错了地方的连结，
     画面上看起来完全正常，而师傅会开去另一个客户的工地。 */
  if in_site_address_id is not null then
    select a.party_id into site_owner
    from public.directory_addresses a
    where a.id = in_site_address_id and a.project_id = in_project_id;
    if site_owner is null then
      raise exception 'no such address in your project';
    end if;
    /* 没有客户就没有工地。一张挂着地址、却讲不出是谁的单，
       在画面上看起来完全正常，而它是一个没有主人的地址。 */
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
    issued_on, due_on, extra, idempotency_key, site_address_id
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
    in_site_address_id
  )
  returning * into row;

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

create or replace function public.update_pipeline_record(
  in_id uuid,
  in_title text default null,
  in_party text default null,
  in_amount_cents bigint default null,
  in_stage text default null,
  in_issued_on date default null,
  in_due_on date default null,
  in_extra jsonb default null,
  in_party_id uuid default null,
  in_clear_party boolean default false,
  in_clear_due_on boolean default false,
  in_site_address_id uuid default null,
  in_clear_site boolean default false
)
returns public.pipeline_records
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.pipeline_records;
  the_party uuid;
  site_owner uuid;
begin
  select * into row from public.pipeline_records r
   where r.id = in_id
     and public.works_here(r.project_id);
  if not found then
    raise exception 'no such record in your project';
  end if;

  if in_party_id is not null then
    perform 1 from public.directory_entries
      where id = in_party_id
        and project_id = row.project_id
        and module_key = public.directory_side(row.module_key);
    if not found then
      raise exception 'that party is not on this side of the book';
    end if;
    the_party := in_party_id;
  elsif in_clear_party then
    the_party := null;
  elsif in_party is not null and btrim(in_party) is distinct from btrim(row.party) then
    the_party := public.party_by_name(
      row.project_id, in_party, public.directory_side(row.module_key)
    );
  else
    the_party := row.party_id;
  end if;

  /* 同一条：别人的地址挂不上这一张单。
     ⚠️ 上面那一整段是从 20260903010000 **一字不改**抄下来的。
     整支重写的时候照抄，只加要加的 —— 我第一版凭印象重写了它，
     三个地方跟原本不一样（他把标题清空的时候原本会真的清空，
     我的版本会当成「不要动」）。20260831080000 那次整支重写
     漏抄 `unique_violation` 是同一件事的另一半。 */
  if in_site_address_id is not null then
    select a.party_id into site_owner
    from public.directory_addresses a
    where a.id = in_site_address_id and a.project_id = row.project_id;
    if site_owner is null then
      raise exception 'no such address in your project';
    end if;
    /* 没有客户就没有工地。一张挂着地址、却讲不出是谁的单，
       在画面上看起来完全正常，而它是一个没有主人的地址。 */
    if the_party is null then
      raise exception 'pick the customer before the site';
    end if;
    if site_owner <> the_party then
      raise exception 'that address belongs to somebody else';
    end if;
  end if;

  update public.pipeline_records set
    title = coalesce(left(btrim(in_title), 200), title),
    party = coalesce(left(btrim(in_party), 200), party),
    party_id = the_party,
    amount_cents = coalesce(in_amount_cents, amount_cents),
    stage = coalesce(left(btrim(in_stage), 60), stage),
    issued_on = coalesce(in_issued_on, issued_on),
    /* 明确讲要清掉才清掉。其余照旧：null = 不要动。 */
    due_on = case when in_clear_due_on then null else coalesce(in_due_on, due_on) end,
    /* 同一个形状：他把工地拿掉，就要真的拿掉。少了这一句，
       一个工地挂上去就永远拿不下来（20260903010000 那个日子的坑）。 */
    site_address_id = case
                        when in_clear_site then null
                        else coalesce(in_site_address_id, site_address_id)
                      end,
    extra = coalesce(in_extra, extra)
  where id = in_id
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.add_pipeline_record(
  uuid, text, text, text, bigint, text, date, date, jsonb, uuid, uuid, uuid
) from public, anon;
grant execute on function public.add_pipeline_record(
  uuid, text, text, text, bigint, text, date, date, jsonb, uuid, uuid, uuid
) to authenticated;

revoke execute on function public.update_pipeline_record(
  uuid, text, text, bigint, text, date, date, jsonb, uuid, boolean, boolean, uuid, boolean
) from public, anon;
grant execute on function public.update_pipeline_record(
  uuid, text, text, bigint, text, date, date, jsonb, uuid, boolean, boolean, uuid, boolean
) to authenticated;

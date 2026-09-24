-- 改回来：20260925050000 故意弄坏的全部撤销，恢复 20260925040000 的版本。
drop policy if exists "BROKEN read all" on public.lookbook_works;
drop policy if exists "BROKEN insert all" on public.lookbook_works;
drop policy if exists "BROKEN update all" on public.lookbook_works;
drop policy if exists "BROKEN delete all" on public.lookbook_works;
create policy "lookbook works are read by whoever works there" on public.lookbook_works
  for select using (public.works_here(project_id));

create or replace function public.add_lookbook_work(
  in_project_id uuid,
  in_title text,
  in_category text default '',
  in_level text default '',
  in_formula text default '',
  in_note text default '',
  in_tags text[] default '{}',
  in_stylist_id uuid default null,
  in_photo_path text default '',
  in_idempotency_key uuid default null
)
returns public.lookbook_works
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.lookbook_works;
  row public.lookbook_works;
  clean_tags text[] := '{}';
  t text;
  path text := btrim(coalesce(in_photo_path, ''));
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your business';
  end if;

  -- 按了两下：同一把钥匙回原来那一份
  if in_idempotency_key is not null then
    select * into existing from public.lookbook_works
     where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then
      return existing;
    end if;
  end if;

  if coalesce(btrim(in_title), '') = '' then
    raise exception 'give the look a name';
  end if;

  if in_stylist_id is not null then
    perform 1 from public.directory_entries
     where id = in_stylist_id and project_id = in_project_id and module_key = 'staff';
    if not found then
      raise exception 'that stylist is not on your team';
    end if;
  end if;

  -- 照片：路径必须在这一家的 lookbook 资料夹里，而且档案真的传上去了
  -- （不然一条指向不存在的档案的路径，画面上就是一张破掉的图）
  if path <> '' then
    if length(path) > 200
       or path like '%..%'
       or position((in_project_id::text || '/lookbook/') in path) <> 1 then
      raise exception 'that photo does not belong to this business';
    end if;
    perform 1 from storage.objects where bucket_id = 'job-photos' and name = path;
    if not found then
      raise exception 'that photo was not uploaded';
    end if;
  end if;

  foreach t in array coalesce(in_tags, '{}'::text[]) loop
    t := left(btrim(coalesce(t, '')), 40);
    continue when t = '';
    if not exists (select 1 from unnest(clean_tags) c where lower(c) = lower(t)) then
      clean_tags := clean_tags || t;
    end if;
  end loop;
  if cardinality(clean_tags) > 8 then
    raise exception 'at most 8 tags on a look';
  end if;

  insert into public.lookbook_works (
    project_id, title, category, level, formula, note, tags,
    stylist_id, photo_path, created_by, idempotency_key
  ) values (
    in_project_id,
    left(btrim(in_title), 120),
    left(btrim(coalesce(in_category, '')), 60),
    left(btrim(coalesce(in_level, '')), 12),
    left(btrim(coalesce(in_formula, '')), 1000),
    left(btrim(coalesce(in_note, '')), 300),
    clean_tags,
    in_stylist_id, path, auth.uid(), in_idempotency_key
  )
  returning * into row;

  return row;

exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into row from public.lookbook_works
       where project_id = in_project_id and idempotency_key = in_idempotency_key;
      if found then
        return row;
      end if;
    end if;
    raise;
end;
$$;

revoke execute on function public.add_lookbook_work(uuid, text, text, text, text, text, text[], uuid, text, uuid) from public;
grant execute on function public.add_lookbook_work(uuid, text, text, text, text, text, text[], uuid, text, uuid) to authenticated;

create or replace function public.set_lookbook_work_archived(
  in_id uuid,
  in_archived boolean
)
returns public.lookbook_works
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.lookbook_works;
begin
  select * into row from public.lookbook_works
   where id = in_id and public.works_here(project_id);
  if not found then
    raise exception 'no such look in your business';
  end if;

  update public.lookbook_works
     set archived_at = case when in_archived then coalesce(archived_at, now()) else null end
   where id = in_id
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.set_lookbook_work_archived(uuid, boolean) from public;
grant execute on function public.set_lookbook_work_archived(uuid, boolean) to authenticated;

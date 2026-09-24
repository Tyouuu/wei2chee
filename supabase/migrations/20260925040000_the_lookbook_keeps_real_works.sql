-- 作品集——沙龙 Lookbook 那一页的六张示例卡换成真的作品
-- （[任务 415] 第 1 项，他 2026-09-24 拍板 `1 2 4 都要去做吧`，之前他说过
-- `可以留着吧 当作一个卖点`）。
--
-- 那一页原本只有六张设计自带的示例：照片是别人的、配方是编的、
-- 按「Add Hairstyle Case」只弹一句「还没接」。一间沙龙的作品集是
-- 她给客人看的东西——这一张表让她自己的作品进得去、翻得到。
--
-- ── 读了什么、抄了什么 ────────────────────────────────────────────────
--   没有可读的开源沙龙作品集结构（Fresha / Vagaro / Booksy 都是闭源）。
--   **设计本身就是规格**：每一张卡 = 一张照片 + 名字 + 分类 + 明度 + 配方 +
--   师傅 + 标签 + 一行说明。表照着卡上真的有的东西建。
--   照片的存法**抄我们自己已经做对的那一套**（20260904010000 · 疗程照片）：
--   私人的桶、存路径不存网址、签出来的网址会过期。
--
-- ── 不抄设计里的什么（[重点 34]：手写簿上写不写得下这一格）─────────────
--   · 「Bangsar Studio Tier 1」那种地点、「WT-601」那种编号 —— 没有人会为一张
--     作品填一个位置跟一个编号（编号要一整套发号机制，而它答不了任何问题）
--   · 「#MochaVelvet」标签 —— 是名字的另一种写法，不是另一个事实
--   照片可以没有（名字才是必填的一格）；不做编辑，写错了收起来重新加
--   （编辑要一支新函式加一份新验证，而收起来重加一样答得了「她的作品集里有什么」）。
--
-- ── 🔴 照片是私人的，不是官网的 ───────────────────────────────────────
--   作品里是**客人的脸**。放进 `site-photos`（公开读）等於「拿到网址的人都看得到」。
--   所以用 `job-photos`（private，`works_here` 才读得到，路径第一段是那一家）——
--   跟疗程照片同一个桶同一组政策，一条新政策都不加。
--   要放上她的官网、要问过客人（`may_show` 那一套），是另一个决定，这里不做。
--
-- ── 🔴 `stylist_id` 故意不带外键 ──────────────────────────────────────
--   `projects` 跟 `directory_entries` 都 cascade 到这张表，再加一条
--   `directory_entries` set null，就是 20260905830000 讲的那种「两条 cascade
--   父路」（`follow_ups` 那次整个帐号删不掉）。这一栏只是「谁做的」，
--   跟 `_by` 那批同一条理由：写的时候在函式里验（是这一家的师傅），
--   师傅被删了就只是少一个名字。`check:account-deletion` 那一路故意带着
--   一份作品走过。

create table if not exists public.lookbook_works (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  category text not null default '',
  -- 明度，照她自己写的（6.1 · 10.2 · L8）；页面上只拿整数部分去分档
  level text not null default '',
  formula text not null default '',
  -- 卡片标题底下那一行小字
  note text not null default '',
  tags text[] not null default '{}',
  stylist_id uuid,
  -- 桶里的路径（`<project_id>/lookbook/<uuid>.<ext>`），不是网址：网址会过期
  photo_path text not null default '',
  -- 收起来，不删——照片档案还留在桶里
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  idempotency_key uuid,

  constraint lookbook_works_title_not_blank check (btrim(title) <> ''),
  constraint lookbook_works_few_tags check (cardinality(tags) <= 8)
);

comment on table public.lookbook_works is
  'One finished look in a salon''s lookbook: photo (private job-photos bucket, path not URL), name, category, lift level, colour formula, stylist, tags. Archived, never deleted. See 20260925040000.';

create index if not exists lookbook_works_project_idx
  on public.lookbook_works (project_id, created_at desc)
  where archived_at is null;

create unique index if not exists lookbook_works_idem_idx
  on public.lookbook_works (project_id, idempotency_key)
  where idempotency_key is not null;

alter table public.lookbook_works enable row level security;

-- 站在这家店里做事的人（老板跟师傅）都看得到——那是给客人看的东西，不是钱。
create policy "lookbook works are read by whoever works there" on public.lookbook_works
  for select using (public.works_here(project_id));

-- 🔴 没有 insert/update/delete 的 policy——只有底下这两支写得进去。

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

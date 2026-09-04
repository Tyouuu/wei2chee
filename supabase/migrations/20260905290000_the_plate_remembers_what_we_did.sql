-- 一台车，一个车牌，跟它做过的每一件事。
--
-- ── 为什么排这一件 ──────────────────────────────────────────────────────
--
-- `find:prospects` 扫吉隆坡 2,266 家，**车厂跟汽车配件排最前面，而且全部
-- 没有官网**。而一间车厂柜台上真正在问的只有一句：
--
--   **「WA 1234 A —— 这台车上次什么时候来，做了什么，几公里？」**
--
-- 那四样今天一样都记不了。
--
-- ── 🔴 先读他们的，然后**不抄** ──────────────────────────────────────────
--
-- ERPNext 的 `Vehicle` doctype 读了原文：**28 栏，6 栏必填**
-- （车牌 · 厂牌 · 型号 · **last_odometer** · 燃料种类 · 单位），
-- 另外还有保险公司 · 保单号 · 碳排检验日 · 车身号 · 车价 · 颜色 ·
-- 几个轮子 · 几个门 · **employee**。
--
-- **那是车队模块，不是车厂模块** —— 它假设那台车是**你自己的**
-- （所以才连到员工、才要保单）。一间车厂的车是**客人的**。
--
-- 抄三样：车牌 · 车是什么 · 里程。**不抄二十五样。**
-- 加一样他们没有的：**车主**。
--
-- ⚠️ 而 `last_odometer` 是他们**必填而且存起来**的一栏 ——
-- 这里不存。里程是**一次到访的读数**，不是一台车的属性：
-- 存起来的那个数字，在任何人打错一次之后就永远是错的，
-- 而算出来的（历史上最后一笔）改一行就对了。
-- 跟架上有几件 · 过期 · 帐龄 · 保养到期日同一条判断。
--
-- ── 🔴 车牌要认得出「wa 1234 a」跟「WA1234A」是同一台 ────────────────────
--
-- 他在柜台上打字，客人在念给他听。**一个大小写跟空格分得开两台车的系统，
-- 会让同一台车在库里变成三台**，而「上次做了什么」就永远查不到。
-- 所以另存一个洗过的 key，唯一的是它，不是他打的那串字。
-- 他打的那串字原样留着 —— 印在单上的要是他写的。

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 车主。**可以空** —— 一台车会换手，而且散客不一定进名册。
     set null 不是 cascade：车主删了，那台车的维修历史还在。 */
  party_id uuid references public.directory_entries(id) on delete set null,

  /* 他打的那串字。印在单上的是这个。 */
  plate text not null,

  /* 洗过的那一串，只拿来认人。 */
  plate_key text generated always as (
    upper(regexp_replace(coalesce(plate, ''), '[^A-Za-z0-9]', '', 'g'))
  ) stored,

  /* 车是什么。**一栏，不是三栏** —— 他写的是「Perodua Myvi 1.3」，
     不是一张有厂牌、型号、变速箱的表格。ERPNext 那三栏必填，
     而一个刚接手一台旧车的师傅答不出型号年份。 */
  descr text not null default '',
  made_year integer,

  /* 他自己的保养间隔，公里。空的时候我们不猜 ——
     一个凭空写下的 10,000 km 是我们替他做的一个决定。 */
  service_every_km integer check (service_every_km is null or service_every_km > 0),

  note text not null default '',
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  idempotency_key uuid,

  constraint vehicles_plate_not_blank check (btrim(plate) <> ''),
  constraint vehicles_idem unique (project_id, idempotency_key)
);

/* 同一家店里，一个车牌只有一台车。收起来的不算 ——
   他可以把一台卖掉的车收起来，然后同一个车牌新登记一台。 */
create unique index if not exists vehicles_plate_idx
  on public.vehicles (project_id, plate_key)
  where archived_at is null;

create index if not exists vehicles_party_idx
  on public.vehicles (project_id, party_id) where party_id is not null;

alter table public.vehicles enable row level security;

drop policy if exists vehicles_read on public.vehicles;
create policy vehicles_read on public.vehicles
  for select using (public.works_here(project_id));

comment on table public.vehicles is
  'A customer''s car. NOT ERPNext''s Vehicle, which is a fleet record of your own vehicles (employee, insurance policy, carbon check) -- three of its 28 fields survive here. The odometer is deliberately not stored: it is a reading taken on a visit, not a property of the car. See 20260905290000.';
comment on column public.vehicles.plate_key is
  'The plate with case and punctuation washed out, for matching only. He types 「wa 1234 a」 and finds the car he serviced last year. What gets printed is `plate`, what he wrote.';

-- ── 那一张单属於哪一台车，进厂时几公里 ────────────────────────────────────
alter table public.pipeline_records
  add column if not exists vehicle_id uuid,
  add column if not exists odometer_km integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pipeline_records_vehicle_fkey'
  ) then
    alter table public.pipeline_records
      add constraint pipeline_records_vehicle_fkey
      foreign key (vehicle_id) references public.vehicles(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'pipeline_records_odometer_sane'
  ) then
    alter table public.pipeline_records
      add constraint pipeline_records_odometer_sane
      check (odometer_km is null or (odometer_km >= 0 and odometer_km <= 3000000));
  end if;
end $$;

create index if not exists pipeline_records_vehicle_idx
  on public.pipeline_records (vehicle_id, issued_on desc)
  where vehicle_id is not null;

comment on column public.pipeline_records.odometer_km is
  'The reading when the car came in. On the visit, never on the car -- a stored 「last odometer」 is wrong forever the first time somebody mistypes it.';

-- ── 触发器：那台车要属於这一家 ────────────────────────────────────────────
create or replace function public.vehicles_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  if new.party_id is not null then
    select d.project_id into owner_project
    from public.directory_entries d where d.id = new.party_id;
    if owner_project is distinct from new.project_id then
      raise exception 'that owner is not in this business''s directory';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists vehicles_own_project_trg on public.vehicles;
create trigger vehicles_own_project_trg
  before insert or update on public.vehicles
  for each row execute function public.vehicles_own_project();

-- ── 登记一台车 ────────────────────────────────────────────────────────────
create or replace function public.add_vehicle(
  in_project_id uuid,
  in_plate text,
  in_party_id uuid default null,
  in_descr text default '',
  in_made_year integer default null,
  in_service_every_km integer default null,
  in_note text default '',
  in_idempotency_key uuid default null
)
returns public.vehicles
language plpgsql
security definer
set search_path = public
as $$
declare
  made public.vehicles;
  washed text;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your business';
  end if;
  if coalesce(btrim(in_plate), '') = '' then
    raise exception 'a car needs a plate';
  end if;

  washed := upper(regexp_replace(in_plate, '[^A-Za-z0-9]', '', 'g'));

  /* 已经登记过了就把同一台还给他。**这不是一个错误** ——
     一台熟客的车每半年就会再进来一次，而他不该为此先去查一遍。 */
  select * into made from public.vehicles v
  where v.project_id = in_project_id
    and v.plate_key = washed
    and v.archived_at is null;
  if made.id is not null then
    return made;
  end if;

  begin
    insert into public.vehicles (
      project_id, party_id, plate, descr, made_year,
      service_every_km, note, created_by, idempotency_key
    ) values (
      in_project_id, in_party_id, left(btrim(in_plate), 40),
      left(btrim(coalesce(in_descr, '')), 120), in_made_year,
      in_service_every_km, left(btrim(coalesce(in_note, '')), 1000),
      auth.uid(), in_idempotency_key
    )
    returning * into made;
  exception
    when unique_violation then
      select * into made from public.vehicles v
      where v.project_id = in_project_id
        and (v.plate_key = washed
             or (in_idempotency_key is not null
                 and v.idempotency_key = in_idempotency_key))
      order by v.archived_at nulls first
      limit 1;
  end;

  return made;
end;
$$;

revoke execute on function public.add_vehicle(uuid, text, uuid, text, integer, integer, text, uuid)
  from public, anon;
grant execute on function public.add_vehicle(uuid, text, uuid, text, integer, integer, text, uuid)
  to authenticated;

comment on function public.add_vehicle(uuid, text, uuid, text, integer, integer, text, uuid) is
  'Register a car, or hand back the one already registered under that plate. Returning the existing one is not an error -- a regular customer''s car comes back every six months. See 20260905290000.';

create or replace function public.update_vehicle(
  in_vehicle_id uuid,
  in_plate text default null,
  in_party_id uuid default null,
  in_clear_party boolean default false,
  in_descr text default null,
  in_made_year integer default null,
  in_service_every_km integer default null,
  in_clear_service_every_km boolean default false,
  in_note text default null
)
returns public.vehicles
language plpgsql
security definer
set search_path = public
as $$
declare
  car public.vehicles;
begin
  select * into car from public.vehicles where id = in_vehicle_id;
  if car.id is null then
    raise exception 'no such vehicle';
  end if;
  if not public.works_here(car.project_id) then
    raise exception 'not your vehicle';
  end if;

  update public.vehicles
  set plate = coalesce(nullif(btrim(coalesce(in_plate, '')), ''), plate),
      party_id = case when in_clear_party then null
                      else coalesce(in_party_id, party_id) end,
      descr = coalesce(in_descr, descr),
      made_year = coalesce(in_made_year, made_year),
      /* 跟 20260903010000 学的：一个值填进去就永远拿不掉，是一个真的 bug。 */
      service_every_km = case when in_clear_service_every_km then null
                              else coalesce(in_service_every_km, service_every_km) end,
      note = coalesce(in_note, note),
      updated_at = now()
  where id = in_vehicle_id
  returning * into car;

  return car;
end;
$$;

revoke execute on function public.update_vehicle(
  uuid, text, uuid, boolean, text, integer, integer, boolean, text) from public, anon;
grant execute on function public.update_vehicle(
  uuid, text, uuid, boolean, text, integer, integer, boolean, text) to authenticated;

create or replace function public.set_vehicle_archived(
  in_vehicle_id uuid,
  in_archived boolean default true
)
returns public.vehicles
language plpgsql
security definer
set search_path = public
as $$
declare
  car public.vehicles;
begin
  select * into car from public.vehicles where id = in_vehicle_id;
  if car.id is null then
    raise exception 'no such vehicle';
  end if;
  if not public.works_here(car.project_id) then
    raise exception 'not your vehicle';
  end if;

  update public.vehicles
  set archived_at = case when in_archived then now() else null end,
      updated_at = now()
  where id = in_vehicle_id
  returning * into car;

  return car;
end;
$$;

revoke execute on function public.set_vehicle_archived(uuid, boolean) from public, anon;
grant execute on function public.set_vehicle_archived(uuid, boolean) to authenticated;

-- ── 🔴 把一张单挂到一台车上，并记下里程 ──────────────────────────────────
--
-- 里程往回走要挡。**这不是一个假想的输入错误**：
-- 450,000 打成 45,000（或者反过来）是柜台上最常发生的一件事，
-- 而它一旦进去，之后每一次「下一次几公里保养」都是错的。
--
-- ⚠️ **而它有一个真的例外**：仪表板换过。所以给一个出口，
-- 而不是让他去猜为什么系统不肯收 —— 拒绝那一句自己讲得出该怎么做。
create or replace function public.set_record_vehicle(
  in_record_id uuid,
  in_vehicle_id uuid default null,
  in_odometer_km integer default null,
  in_allow_rollback boolean default false
)
returns public.pipeline_records
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.pipeline_records;
  car public.vehicles;
  seen integer;
begin
  select * into rec from public.pipeline_records where id = in_record_id;
  if rec.id is null then
    raise exception 'no such document';
  end if;
  if not public.works_here(rec.project_id) then
    raise exception 'not your document';
  end if;

  if in_vehicle_id is null then
    update public.pipeline_records
    set vehicle_id = null, odometer_km = null, updated_at = now()
    where id = in_record_id
    returning * into rec;
    return rec;
  end if;

  select * into car from public.vehicles where id = in_vehicle_id;
  if car.id is null or car.project_id <> rec.project_id then
    raise exception 'that car is not in this business''s book';
  end if;

  if in_odometer_km is not null and not in_allow_rollback then
    select max(r.odometer_km) into seen
    from public.pipeline_records r
    where r.vehicle_id = car.id
      and r.id <> rec.id
      and r.archived_at is null
      and r.odometer_km is not null;

    if seen is not null and in_odometer_km < seen then
      raise exception
        'this car already read % km. Check the number -- or if the cluster was replaced, say so.',
        seen;
    end if;
  end if;

  update public.pipeline_records
  set vehicle_id = car.id,
      odometer_km = in_odometer_km,
      updated_at = now()
  where id = in_record_id
  returning * into rec;

  return rec;
end;
$$;

revoke execute on function public.set_record_vehicle(uuid, uuid, integer, boolean)
  from public, anon;
grant execute on function public.set_record_vehicle(uuid, uuid, integer, boolean)
  to authenticated;

comment on function public.set_record_vehicle(uuid, uuid, integer, boolean) is
  'Hang a job on a car and note the reading. Refuses a reading lower than one already on file, because a mistyped odometer poisons every future 「due at」 -- and says out loud what to do if the cluster really was replaced. See 20260905290000.';

-- ── 🔴 他在柜台打车牌，整台车的历史跳出来 ────────────────────────────────
--
-- 这一支就是这一整件事的用处，也是[重点 29] 最好的那一种：
-- **他打七个字，其余全部不用打。**
create or replace function public.find_vehicle(
  in_project_id uuid,
  in_plate text
)
returns table (
  vehicle_id uuid,
  plate text,
  descr text,
  made_year integer,
  party_id uuid,
  owner_name text,
  owner_whatsapp text,
  last_seen date,
  last_odometer_km integer,
  visits integer,
  service_every_km integer,
  due_at_km integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  washed text;
begin
  if not public.works_here(in_project_id) then
    return;
  end if;
  washed := upper(regexp_replace(coalesce(in_plate, ''), '[^A-Za-z0-9]', '', 'g'));
  if washed = '' then
    return;
  end if;

  return query
  select v.id, v.plate, v.descr, v.made_year, v.party_id,
         coalesce(d.name, ''), coalesce(d.whatsapp, ''),
         h.last_seen, h.last_km, h.visits,
         v.service_every_km,
         /* 该在几公里再来。**空的时候留空** ——
            我们没有替他决定过保养间隔，就不该印一个数字出来。 */
         case when v.service_every_km is not null and h.last_km is not null
              then h.last_km + v.service_every_km end
  from public.vehicles v
  left join public.directory_entries d on d.id = v.party_id
  cross join lateral (
    select max(r.issued_on) as last_seen,
           (array_agg(r.odometer_km order by r.odometer_km desc nulls last))[1] as last_km,
           count(*)::integer as visits
    from public.pipeline_records r
    where r.vehicle_id = v.id and r.archived_at is null
  ) h
  where v.project_id = in_project_id
    and v.archived_at is null
    /* 打前几个字就找得到 —— 客人念车牌的时候他一边打。 */
    and (v.plate_key = washed or v.plate_key like washed || '%')
  order by (v.plate_key = washed) desc, v.plate
  limit 10;
end;
$$;

revoke execute on function public.find_vehicle(uuid, text) from public, anon;
grant execute on function public.find_vehicle(uuid, text) to authenticated;

comment on function public.find_vehicle(uuid, text) is
  'He types the plate at the counter and the car, its owner, its last visit and its reading come back. Seven characters typed, nothing else. See 20260905290000.';

-- ── 这台车做过什么 ────────────────────────────────────────────────────────
create or replace function public.vehicle_history(in_vehicle_id uuid)
returns table (
  record_id uuid,
  doc_no text,
  title text,
  stage text,
  issued_on date,
  odometer_km integer,
  amount_cents bigint,
  did text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  car public.vehicles;
begin
  select * into car from public.vehicles where id = in_vehicle_id;
  if car.id is null or not public.works_here(car.project_id) then
    return;
  end if;

  return query
  select r.id, r.doc_no, r.title, r.stage, r.issued_on, r.odometer_km, r.amount_cents,
         /* 那一次做了什么 —— 逐项串成一句，因为柜台上要的是一眼看完，
            不是打开每一张单。 */
         coalesce((
           select string_agg(l.description, ' · ' order by l.sort_order)
           from public.record_lines l where l.record_id = r.id
         ), '')
  from public.pipeline_records r
  where r.vehicle_id = in_vehicle_id
    and r.archived_at is null
  order by r.issued_on desc nulls last, r.created_at desc;
end;
$$;

revoke execute on function public.vehicle_history(uuid) from public, anon;
grant execute on function public.vehicle_history(uuid) to authenticated;

-- ── 好久没来的那几台 ──────────────────────────────────────────────────────
--
-- ⚠️ **不按公里判该不该来** —— 我们不知道那台车现在几公里，
-- 而一份照猜出来的里程排出来的名单，会让他打一整天没有用的电话。
-- **多久没来是查得到的事实。**
create or replace function public.vehicles_overdue(
  in_project_id uuid,
  in_months integer default 6
)
returns table (
  vehicle_id uuid,
  plate text,
  descr text,
  owner_name text,
  owner_whatsapp text,
  last_seen date,
  months_since integer,
  last_odometer_km integer,
  due_at_km integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.works_here(in_project_id) then
    return;
  end if;
  if in_months is null or in_months < 1 or in_months > 60 then
    raise exception 'ask for between 1 and 60 months';
  end if;

  return query
  select v.id, v.plate, v.descr,
         coalesce(d.name, ''), coalesce(d.whatsapp, ''),
         h.last_seen,
         (extract(year from age(public.today_myt(), h.last_seen)) * 12
          + extract(month from age(public.today_myt(), h.last_seen)))::integer,
         h.last_km,
         case when v.service_every_km is not null and h.last_km is not null
              then h.last_km + v.service_every_km end
  from public.vehicles v
  left join public.directory_entries d on d.id = v.party_id
  cross join lateral (
    select max(r.issued_on) as last_seen,
           (array_agg(r.odometer_km order by r.odometer_km desc nulls last))[1] as last_km
    from public.pipeline_records r
    where r.vehicle_id = v.id and r.archived_at is null
  ) h
  where v.project_id = in_project_id
    and v.archived_at is null
    /* 从来没进过厂的不算 —— 那是一台刚登记的车，不是一台跑掉的客人。 */
    and h.last_seen is not null
    and h.last_seen <= public.today_myt() - (in_months || ' months')::interval
  order by h.last_seen;
end;
$$;

revoke execute on function public.vehicles_overdue(uuid, integer) from public, anon;
grant execute on function public.vehicles_overdue(uuid, integer) to authenticated;

comment on function public.vehicles_overdue(uuid, integer) is
  'Cars not seen in N months, oldest first. Deliberately by DATE, not by guessed mileage: we do not know what the car reads today, and a list built on a guess wastes a day of phone calls. See 20260905290000.';

-- ── 🔴 它还不是什么 ──────────────────────────────────────────────────────
--
--   · **画面上没有那一格** —— 柜台打车牌那个框是画面那一层
--   · **不会自动提醒** —— 卡在同一条通知管道（[任务 59]）
--   · **没有零件对车型** —— 「这个滤芯配不配 Myvi」要一张对照表，
--     而那是一间卖零件的店才需要的，不是一间修车的店

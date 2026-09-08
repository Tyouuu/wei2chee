-- 上一次帮她做了什么、用了多少、哪一个批号。
--
-- ── 为什么这一格是 medi spa 那一整个行业包的第一件 ──────────────────────
--
-- 他 2026-09-09 讲：`第一個禮拜我會拿著我的demo去上門詢問店家
-- 我要主推的就是saloon跟medi spa`。
--
-- 跟外面比过（2026-09-09 读它们自己的功能页，不是别人写的评测）：
--
--   Zenoti「Injectable Treatment Records」 —— 原文：
--     `Product, units, lot number, treatment areas recorded as structured
--      fields; linked to inventory; audit trail per patient across visits`
--   Aoikumo（马来西亚，我们真正的对手）高阶那一档 ——
--     `Case Notes with Auto-Save, AI Transcription` ·
--     `Photo Capture, Annotation and Collaging` ·
--     `Electronic Forms & Documents（indemnity & consultation form）`
--
-- 🔴 **一间沙龙跟一间 medi spa 差的就是这一层，而我们今天一格都没有。**
-- 沙龙那一边量过，五家都有的八件我们有七件；而 medi spa 那一边
-- 我们是一间**没有病历的诊所** —— 她打开 demo 第一句会问
-- 「我客人的疗程记录在哪里」。
--
-- ── 🔴 挂在**人**身上，不是挂在**那一张单**上 ───────────────────────────
--
-- 照片今天挂在 `pipeline_records` 上（20260904010000）—— 而一间 medi spa
-- 根本不开单，她开的是**预约**。所以照那个形状做，她的每一笔疗程记录
-- 都没有地方挂。
--
-- 而且真正的问题本来就是跨很多次的：**「她上一次打了什么」**
-- —— 那是一个客人的一条线，不是一张单的一个附件。
-- Zenoti 那一句自己写着：`audit trail per patient across visits`。
--
--   `party_id` 必填  —— 一笔不知道是谁的疗程记录没有用
--   `appointment_id` 可选 —— 走进来做的那一次照样记得下
--
-- ── 🔴 用掉的产品**真的从架上少** ───────────────────────────────────────
--
-- Zenoti 那一句的后半段是 `linked to inventory`，而理由是 [重点 29]：
-- 少了它，她要**记两次** —— 一次记在疗程上、一次记在库存上，
-- 而第二次她三个月后就不记了，那本库存从此是假的。
--
-- 而它走的是**人按那颗按钮同一支** `move_stock`（[重点 23]）——
-- 批号 · 效期先出 · 分店 · 防重复 · 序号要讲哪一台，一样都不重写。
--
-- ⚠️ **数量就是那件货自己的单位，不发明第二套。**
-- 她进货进「支」就记「支」，进货进「单位」（一支 100 单位）就记「单位」——
-- 而「三支又十九个单位」那一句 20260904 那一格（一箱几罐）本来就答得了。
--
-- ── 🔴 一笔一笔加，删一笔写一笔反的 —— 不整批换 ─────────────────────────
--
-- 逐项那几支是**整批换**（全删再全插），而那在这里会咬人：
-- 20260908050000 已经为同一件事装过一条守卫（出过菜的单不给整批换掉），
-- 而 [任务 93] 付过学费 —— 整批换让每一行拿到新 id，动过库存的锚点就断了。
--
-- 所以照**退货 · 调拨**那一个形状：加是一次动作，撤销是**写一笔反的**，
-- 两笔都留着。一次真的用在她身上的东西是历史，不是一行可以消失的资料。
--
-- ── 🔴 谁看得到，而这一条要老实讲 ─────────────────────────────────────
--
-- `works_here`，**不是 `sees_money`** —— 做那个疗程的美疗师**必须**看得到
-- 上一次用了什么、有没有过敏，那正是这一整张表存在的理由。
--
-- ⚠️ **代价写出来**：一个美疗师因此读得到每一个客人的疗程史。
-- 今天没有第三种角色（[任务 84] 判过：一个人都还没有两个员工的时候
-- 做权限表格是照想像做的），而它同时是 PDPA 2024 修正案下最敏感的一类资料
-- （[任务 136]：资料处理者第一次直接负责，最高 RM 1,000,000 / 三年）。
-- **第二个员工出现那天，这一条要单独收紧一次。**
--
-- 🔴 而钱那条线守得住：**这张表上一个金额都没有**。
-- 跟 `service_packages` 同一条 —— 师傅看得到次数，看不到价钱。
--
-- ⚠️ 而它**不是一份病历**：没有诊断、没有处方、没有医疗判断。
-- 它记的是「她这一次做了什么、用了什么、谁做的」。
-- 处方那一层（Zenoti 的 e-prescription）我们没有，这一格也不打算做。

create table if not exists public.treatment_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 🔴 必填。见档头 —— 一笔不知道是谁的疗程记录没有用。
     `restrict`：一个有疗程记录的客人删不掉。 */
  party_id uuid not null references public.directory_entries(id) on delete restrict,

  /* 哪一次。可选 —— 走进来做的那一次照样记得下。
     `set null`：那一笔预约收起来了，这一次真的做过的事还在。 */
  appointment_id uuid references public.appointments(id) on delete set null,

  done_on date not null default public.today_myt(),

  /* 做了什么 —— **他自己的词**（Hydrafacial · 洗面 · 激光第三次），
     跟 `stage` `category` 同一条：不给一份我们发明的清单。 */
  what text not null,

  /* 部位。Zenoti 那一句里的 `treatment areas`。可以空 —— 一次洗面没有部位。 */
  area text not null default '',

  /* 谁做的 —— 他自己师傅名册上的那一行。 */
  staff_id uuid references public.directory_entries(id) on delete set null,

  note text not null default '',

  /* 🔴 收起来，不删掉。一次真的做过的疗程是历史。 */
  archived_at timestamptz,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint treatment_notes_what_not_blank check (btrim(what) <> '')
);

comment on table public.treatment_notes is
  'A visit note that hangs on the customer, not on a document. See the file header.';

create index if not exists treatment_notes_party_idx
  on public.treatment_notes (party_id, done_on desc, created_at desc);
create index if not exists treatment_notes_project_idx
  on public.treatment_notes (project_id, done_on desc);

alter table public.treatment_notes enable row level security;

drop policy if exists "treatment_notes_members" on public.treatment_notes;
create policy "treatment_notes_members" on public.treatment_notes
  for all to authenticated
  using (public.works_here(project_id))
  with check (public.works_here(project_id));

-- 用了什么。一次可以两样（一支 Botox ＋ 一支填充）。
create table if not exists public.treatment_products (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.treatment_notes(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  item_id uuid not null references public.catalog_items(id) on delete restrict,
  /* 哪一批 —— Zenoti 那一句里的 `lot number`。
     可以空：不管批号的货（一瓶精油）本来就没有。 */
  batch_id uuid references public.stock_batches(id) on delete restrict,

  qty numeric(14, 3) not null,
  /* 那件货自己的单位，抄下来 —— 明年他把那件货改名，这一笔上
     写的还是当时那个单位。跟 `party` / `party_id` 同一条。 */
  unit text not null default '',

  /* 🔴 从架上出去的那一笔。少了它，撤销的时候没有东西可以反过来写。 */
  move_id uuid references public.stock_moves(id) on delete set null,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint treatment_products_qty_positive check (qty > 0)
);

comment on table public.treatment_products is
  'What a visit used up. Every line really left the shelf (move_id).';

create index if not exists treatment_products_note_idx
  on public.treatment_products (note_id, created_at);

alter table public.treatment_products enable row level security;

drop policy if exists "treatment_products_members" on public.treatment_products;
create policy "treatment_products_members" on public.treatment_products
  for all to authenticated
  using (public.works_here(project_id))
  with check (public.works_here(project_id));

-- 那两张表的 project_id 要跟它上一层一样 —— 20260906 那一族同一个形状。
create or replace function public.treatment_own_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  owner uuid;
begin
  /* 公司都不在了、或者这一栏根本没有动，就放行 —— cascade 那一刻没有
     登入身分，而 20260906260000 跟 20260906390000 为同一件事付过两次学费
     （一个帐号因此删不掉）。 */
  if tg_op = 'UPDATE' and new.project_id is not distinct from old.project_id then
    return new;
  end if;

  if tg_table_name = 'treatment_notes' then
    select p.project_id into owner
      from public.directory_entries p where p.id = new.party_id;
  else
    select n.project_id into owner
      from public.treatment_notes n where n.id = new.note_id;
  end if;

  if owner is null then
    return new;
  end if;

  new.project_id := owner;
  return new;
end;
$fn$;

drop trigger if exists treatment_notes_own_project_trg on public.treatment_notes;
create trigger treatment_notes_own_project_trg
  before insert or update on public.treatment_notes
  for each row execute function public.treatment_own_project();

drop trigger if exists treatment_products_own_project_trg on public.treatment_products;
create trigger treatment_products_own_project_trg
  before insert or update on public.treatment_products
  for each row execute function public.treatment_own_project();

-- ── 写一笔 ────────────────────────────────────────────────────────────────

create or replace function public.add_treatment_note(
  in_party_id uuid,
  in_what text,
  in_appointment_id uuid default null,
  in_done_on date default null,
  in_area text default '',
  in_staff_id uuid default null,
  in_note text default ''
)
returns public.treatment_notes
language plpgsql
security definer
set search_path = public
as $fn$
declare
  proj uuid;
  row public.treatment_notes;
begin
  select p.project_id into proj
    from public.directory_entries p
   where p.id = in_party_id and public.works_here(p.project_id);
  if proj is null then
    raise exception 'that person is not in your directory';
  end if;

  if btrim(coalesce(in_what, '')) = '' then
    raise exception 'say what was done';
  end if;

  /* 那一次预约要是同一家的 —— 少了这一条，一笔疗程记录挂得到别人的预约上。 */
  if in_appointment_id is not null
     and not exists (
       select 1 from public.appointments a
        where a.id = in_appointment_id and a.project_id = proj
     ) then
    raise exception 'that booking is not in this business';
  end if;

  if in_staff_id is not null
     and not exists (
       select 1 from public.directory_entries s
        where s.id = in_staff_id and s.project_id = proj
          and s.module_key = 'staff' and s.archived_at is null
     ) then
    raise exception 'that person is not on your staff list';
  end if;

  insert into public.treatment_notes
    (project_id, party_id, appointment_id, done_on, what, area, staff_id, note, created_by)
  values (
    proj,
    in_party_id,
    in_appointment_id,
    coalesce(in_done_on, public.today_myt()),
    left(btrim(in_what), 200),
    left(btrim(coalesce(in_area, '')), 120),
    in_staff_id,
    left(coalesce(in_note, ''), 2000),
    auth.uid()
  )
  returning * into row;

  return row;
end;
$fn$;

create or replace function public.update_treatment_note(
  in_id uuid,
  in_what text default null,
  in_area text default null,
  in_staff_id uuid default null,
  in_note text default null,
  in_done_on date default null,
  in_clear_staff boolean default false,
  in_archived boolean default null
)
returns public.treatment_notes
language plpgsql
security definer
set search_path = public
as $fn$
declare
  row public.treatment_notes;
begin
  select * into row from public.treatment_notes
   where id = in_id and public.works_here(project_id);
  if row.id is null then
    raise exception 'no such treatment note in your business';
  end if;

  if in_staff_id is not null
     and not exists (
       select 1 from public.directory_entries s
        where s.id = in_staff_id and s.project_id = row.project_id
          and s.module_key = 'staff' and s.archived_at is null
     ) then
    raise exception 'that person is not on your staff list';
  end if;

  update public.treatment_notes set
    what = case
             when in_what is null then what
             /* 空的不准洗掉 —— 那条 check 会挡，而挡出来的是一句资料库的话。 */
             when btrim(in_what) = '' then what
             else left(btrim(in_what), 200)
           end,
    area = coalesce(left(btrim(in_area), 120), area),
    staff_id = case when in_clear_staff then null
                    else coalesce(in_staff_id, staff_id) end,
    note = coalesce(left(in_note, 2000), note),
    done_on = coalesce(in_done_on, done_on),
    archived_at = case
                    when in_archived is null then archived_at
                    when in_archived then coalesce(archived_at, now())
                    else null
                  end,
    updated_at = now()
  where id = in_id
  returning * into row;

  return row;
end;
$fn$;

-- ── 用掉一样东西 ──────────────────────────────────────────────────────────

create or replace function public.add_treatment_product(
  in_note_id uuid,
  in_item_id uuid,
  in_qty numeric,
  in_batch_id uuid default null,
  in_branch_id uuid default null,
  in_idempotency_key uuid default null
)
returns public.treatment_products
language plpgsql
security definer
set search_path = public
as $fn$
declare
  note public.treatment_notes;
  item public.catalog_items;
  mv public.stock_moves;
  row public.treatment_products;
begin
  select * into note from public.treatment_notes
   where id = in_note_id and public.works_here(project_id);
  if note.id is null then
    raise exception 'no such treatment note in your business';
  end if;

  select * into item from public.catalog_items
   where id = in_item_id and project_id = note.project_id;
  if item.id is null then
    raise exception 'that item is not on your shelf';
  end if;

  if coalesce(in_qty, 0) <= 0 then
    raise exception 'say how much was used';
  end if;

  /* 🔴 走人按那颗按钮同一支（[重点 23]）—— 批号 · 效期先出 · 分店 ·
     序号要讲哪一台，一样都不重写。 */
  mv := public.move_stock(
    in_item_id := in_item_id,
    in_direction := 'out',
    in_qty := in_qty,
    in_reason := left(note.what, 60),
    in_against_id := null,
    in_moved_on := note.done_on,
    in_note := '',
    in_idempotency_key := in_idempotency_key,
    in_branch_id := in_branch_id,
    in_batch_id := in_batch_id
  );

  insert into public.treatment_products
    (note_id, project_id, item_id, batch_id, qty, unit, move_id, created_by)
  values (
    in_note_id, note.project_id, in_item_id, in_batch_id,
    in_qty, coalesce(item.unit, ''), mv.id, auth.uid()
  )
  returning * into row;

  return row;
end;
$fn$;

-- 打错了：写一笔反的，两笔都留着。跟退货 · 调拨同一个形状。
create or replace function public.drop_treatment_product(in_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  row public.treatment_products;
  mv public.stock_moves;
begin
  select * into row from public.treatment_products
   where id = in_id and public.works_here(project_id);
  if row.id is null then
    raise exception 'no such line on that treatment note';
  end if;

  if row.move_id is not null then
    select * into mv from public.stock_moves where id = row.move_id;
    if mv.id is not null then
      perform public.move_stock(
        in_item_id := row.item_id,
        in_direction := 'in',
        in_qty := row.qty,
        in_reason := mv.reason,
        in_moved_on := public.today_myt(),
        in_batch_id := row.batch_id
      );
    end if;
  end if;

  delete from public.treatment_products where id = in_id;
  return true;
end;
$fn$;

-- ── 读回来 ────────────────────────────────────────────────────────────────

-- 她上一次做了什么。**这一支就是她站在客人面前会开的那一页。**
create or replace function public.treatment_notes_of(
  in_party_id uuid,
  in_limit int default 20
)
returns table (
  id uuid,
  done_on date,
  what text,
  area text,
  note text,
  staff_name text,
  archived boolean,
  products jsonb
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    n.id,
    n.done_on,
    n.what,
    n.area,
    n.note,
    coalesce(s.name, ''),
    n.archived_at is not null,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'id', tp.id,
                   'item', ci.name,
                   'qty', tp.qty,
                   'unit', tp.unit,
                   /* 🔴 盒子上印的那一串 —— 那是 Zenoti 那一句里的 lot number，
                      而它是她被问「你用的是哪一批」时唯一答得出来的东西。 */
                   'batch', coalesce(b.code, '')
                 )
                 order by tp.created_at
               )
          from public.treatment_products tp
          join public.catalog_items ci on ci.id = tp.item_id
          left join public.stock_batches b on b.id = tp.batch_id
         where tp.note_id = n.id
      ),
      '[]'::jsonb
    )
  from public.treatment_notes n
  left join public.directory_entries s on s.id = n.staff_id
  where n.party_id = in_party_id
    and public.works_here(n.project_id)
  order by n.done_on desc, n.created_at desc
  limit greatest(1, least(coalesce(in_limit, 20), 200));
$fn$;

grant execute on function public.add_treatment_note(uuid, text, uuid, date, text, uuid, text) to authenticated;
grant execute on function public.update_treatment_note(uuid, text, text, uuid, text, date, boolean, boolean) to authenticated;
grant execute on function public.add_treatment_product(uuid, uuid, numeric, uuid, uuid, uuid) to authenticated;
grant execute on function public.drop_treatment_product(uuid) to authenticated;
grant execute on function public.treatment_notes_of(uuid, int) to authenticated;

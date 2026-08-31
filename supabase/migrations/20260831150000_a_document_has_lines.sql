-- supabase/migrations/20260831150000_a_document_has_lines.sql
--
-- 逐项明细. A document is a list of things with quantities and prices, and
-- until now every one of ours was a single typed total.
--
-- ── I WAS WRONG, AND BY MY OWN RULE ───────────────────────────────────────
--
-- 20260831110000 declined to build this, citing 任务 41: 「一次＝个案，两次＝
-- 形状」 -- a shape is earned by seeing the same need twice. It then treated
-- 进货单 as the FIRST time.
--
-- It is at least the third. 报价单 has needed lines since the day it shipped:
-- a renovation quote is 拆除 RM 3,000 · 泥水 RM 12,000 · 油漆 RM 5,000, and
-- ours stored 「RM 20,000」. 订单 the same. The rule said build it; I read the
-- rule as permission to wait.
--
-- ── AND THERE IS A HARDER REASON THAN THE RULE ────────────────────────────
--
-- LHDN's MyInvois makes them MANDATORY. Read from the SDK's own field table:
-- at line level, Classification, Description, Unit Price, Tax Type, Tax
-- Amount, Subtotal and Total Excluding Tax are all [1-1]. Quantity and
-- Measurement are the only optional ones.
--
-- e-Invoice is 及格线 rather than 加分项 (重点 18). A product that cannot hold
-- a line item cannot produce a legal invoice in this country, so this is not a
-- feature that waits for a second opinion.
--
-- ── WHAT IS DELIBERATELY LIGHTER THAN ERPNext ─────────────────────────────
--
-- Their Purchase Order Item has 107 fields and REQUIRES `item_code` -- a link
-- to an Item master. A line cannot exist there without a catalogue entry.
--
-- Ours cannot require that: `catalog` is still a drawing (shape-state.ts), and
-- a contractor quoting 「拆除旧厨房」 is not selling a catalogue item -- it is a
-- description of work. So the line is what a person actually writes on a quote:
-- what it is, how many, at what price. The link to a catalogue item is added
-- when catalog is real, by the same test party_id passed: it is answerable
-- afterwards.
--
-- ⚠️ WHAT E-INVOICE WILL STILL NEED, so it is not rediscovered: `classification`
-- (an LHDN code list) and the tax pair. Both are answerable later -- a business
-- that is not SST-registered charged no tax, and that is knowable from the
-- date. Neither is guessed now.

create table if not exists public.record_lines (
  id uuid primary key default gen_random_uuid(),

  /* The document this line belongs to. Cascade: a line has no meaning without
     its document, and there is nothing to keep. */
  record_id uuid not null references public.pipeline_records(id) on delete cascade,

  /* Denormalised so RLS can be written against it without a join on every
     read -- the same trick project_id plays on every other table here. Kept
     honest by a trigger below rather than by hope. */
  project_id uuid not null references public.projects(id) on delete cascade,

  /* WHAT IT IS. The only thing a line cannot be without: MyInvois calls it
     「Description of Product or Service」 and marks it [1-1]. */
  description text not null,

  /* HOW MANY. Optional in MyInvois and optional here, and for the same reason:
     「拆除旧厨房」 is one job, not three of something.

     Numeric rather than a float: 2.5 tonnes of sand must add up exactly, and a
     float does not. Scale 3 because this market sells in halves and quarters,
     not in millionths. */
  qty numeric(14, 3),

  /* 包 · 箱 · 尺 · 平方尺 · 趟. The business's own word, never an enum -- the
     same decision as `stage`, and this one has a market reason too: a
     wholesaler buys in 箱 and sells in 罐, which is a conversion nobody can
     express through a fixed list (任务 61). */
  unit text not null default '',

  /* Sen, like every other money column here. Null when the line is priced as a
     lump rather than per unit. */
  unit_price_cents bigint,

  /* THE LINE'S OWN MONEY, and it is stored rather than computed on read.

     Computed would be tidier and it would be wrong: a line can be
     「防水工程 RM 4,500」 with no quantity and no unit price at all, and a
     discount agreed on the day is a real thing that qty × price cannot
     express. So the app may compute it and this column holds what was agreed. */
  amount_cents bigint not null default 0,

  /* The order he wrote them in. A quotation read back in a different order is
     a different quotation. */
  sort_order integer not null default 0,

  note text not null default '',

  /* This business's own per-line fields. Never used for arithmetic. */
  extra jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.record_lines is
  'The lines of one pipeline document -- 报价单 · 订单 · 进货单. Lighter than ERPNext''s 107-field Purchase Order Item on purpose: no item_code, because a contractor quoting 「拆除旧厨房」 is describing work rather than selling a catalogue entry. See the header of 20260831150000.';
comment on column public.record_lines.amount_cents is
  'What was agreed for this line. Stored rather than computed: a lump-sum line has no quantity, and a discount given on the day is not qty x price.';
comment on column public.record_lines.qty is
  'numeric, not float: 2.5 tonnes of sand has to add up exactly. Optional -- MyInvois marks Quantity [0-1] too.';

create index if not exists record_lines_doc_idx
  on public.record_lines (record_id, sort_order);

-- ── WHO CAN SEE IT ────────────────────────────────────────────────────────
-- Row level, keyed through project_id like every other table here, so an
-- application mistake cannot show one business's prices to another. A price
-- list is the most portable thing a competitor could want.

alter table public.record_lines enable row level security;

create policy "record_lines_select_own" on public.record_lines
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = record_lines.project_id
        and projects.account_id = auth.uid()
    )
  );

create policy "record_lines_insert_own" on public.record_lines
  for insert with check (
    exists (
      select 1 from public.projects
      where projects.id = record_lines.project_id
        and projects.account_id = auth.uid()
    )
  );

create policy "record_lines_update_own" on public.record_lines
  for update using (
    exists (
      select 1 from public.projects
      where projects.id = record_lines.project_id
        and projects.account_id = auth.uid()
    )
  );

create policy "record_lines_delete_own" on public.record_lines
  for delete using (
    exists (
      select 1 from public.projects
      where projects.id = record_lines.project_id
        and projects.account_id = auth.uid()
    )
  );

-- ── THE LINE'S PROJECT IS ITS DOCUMENT'S PROJECT ──────────────────────────
--
-- Denormalised columns are only safe when something keeps them true. Without
-- this a client could insert a line naming ITS OWN project id while pointing
-- at somebody else's document -- the policy above would pass, and the line
-- would appear on a stranger's quotation.

create or replace function public.record_lines_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  select project_id into owner_project
  from public.pipeline_records where id = new.record_id;
  if owner_project is null then
    raise exception 'no such document';
  end if;
  new.project_id := owner_project;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists record_lines_own_project_trg on public.record_lines;
create trigger record_lines_own_project_trg
  before insert or update on public.record_lines
  for each row execute function public.record_lines_own_project();

-- ── THE DOCUMENT'S TOTAL IS THE SUM OF ITS LINES ──────────────────────────
--
-- ⚠️ WHY A TRIGGER AND NOT A COMPUTED READ. `pipeline_records.amount_cents` is
-- already live and already read by six things: the table projection, the
-- overview tiles, the ranking, the share chart, the edit form and the console.
-- Changing it into something computed would mean changing all six, and any one
-- of them missed would disagree with the others about a customer's money.
--
-- So the column keeps its meaning and the trigger keeps it true.
--
-- ⚠️ AND A DOCUMENT WITH NO LINES KEEPS ITS TYPED TOTAL. That is not a
-- fallback, it is the normal case for everything written before today and for
-- a job quoted as one number. The trigger only speaks when there are lines.

create or replace function public.record_total_from_lines()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  doc uuid := coalesce(new.record_id, old.record_id);
  total bigint;
  line_count integer;
begin
  select coalesce(sum(amount_cents), 0), count(*)
    into total, line_count
    from public.record_lines where record_id = doc;

  if line_count > 0 then
    update public.pipeline_records
       set amount_cents = total, updated_at = now()
     where id = doc;
  end if;

  return null;
end;
$$;

drop trigger if exists record_lines_total_trg on public.record_lines;
create trigger record_lines_total_trg
  after insert or update or delete on public.record_lines
  for each row execute function public.record_total_from_lines();

-- ── WRITING THEM ──────────────────────────────────────────────────────────
--
-- One call replaces the whole list, rather than three calls to add, edit and
-- remove. A document's lines are edited as a BLOCK -- he opens the quotation,
-- changes two prices, deletes a row, adds another, and saves once -- and three
-- separate operations would let a half-applied edit exist, which for a
-- quotation means a total nobody agreed to.

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
begin
  select exists (
    select 1 from public.pipeline_records r
    join public.projects p on p.id = r.project_id
    where r.id = in_record_id and p.account_id = auth.uid()
  ) into mine;
  if not mine then
    raise exception 'no such document in your project';
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
    insert into public.record_lines (
      record_id, project_id, description, qty, unit,
      unit_price_cents, amount_cents, sort_order, note, extra
    ) values (
      in_record_id,
      /* Overwritten by the trigger; a value is needed for the not-null. */
      '00000000-0000-0000-0000-000000000000'::uuid,
      left(btrim(item->>'description'), 300),
      nullif(item->>'qty', '')::numeric,
      left(coalesce(btrim(item->>'unit'), ''), 30),
      nullif(item->>'unit_price_cents', '')::bigint,
      coalesce(nullif(item->>'amount_cents', '')::bigint, 0),
      i,
      left(coalesce(item->>'note', ''), 500),
      coalesce(item->'extra', '{}'::jsonb)
    );
    i := i + 1;
  end loop;

  /* An emptied list has to put the total back under the owner's control
     rather than leaving the last computed sum standing as if it were typed.
     The trigger stays silent on zero lines, on purpose, so this says it. */
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

revoke execute on function public.set_record_lines(uuid, jsonb) from public;
grant execute on function public.set_record_lines(uuid, jsonb) to authenticated;

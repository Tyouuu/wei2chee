-- 报价单有效期 —— 这一支只补一件：他删得掉那个日子。
--
-- ── 先讲清楚什么本来就有 ────────────────────────────────────────────────
--
-- `pipeline_records.due_on` 从 20260830040000 建表那天就在，`add_pipeline_record`
-- 跟 `update_pipeline_record` 两支都收 `in_due_on` —— 2026-09-03 grep 全 app，
-- **零个 TypeScript 读它或写它**。这个仓库第十六次「能力有、线没接」。
--
-- 所以「报价有效期」不需要新栏位，也不需要新表。缺的是浏览器那一条线，
-- 那一条在 lib/portal/record-validity.ts 跟表单里接。
--
-- ── 这一支要修的那一个真的洞 ────────────────────────────────────────────
--
-- update_pipeline_record 写的是：
--
--     due_on = coalesce(in_due_on, due_on)
--
-- null 的意思是「这一栏不要动」—— 对每一栏都是对的，除了这一栏：
-- **一个日子一旦填进去就永远拿不掉。** 老板填了 10 月 3 日，客人说不用赶，
-- 他想把那个日子清掉 —— 他清不掉。表单送 null，函式读成「不要动」。
--
-- 这跟 party 那一栏是同一个形状，而 party 已经有答案了：`in_clear_party`。
-- 照抄它，不发明第二种做法。
--
-- ⚠️ 为什么不用「送一个空字串代表清掉」那种便宜写法：date 收不到空字串，
-- 而拿一个哨兵日期（1900-01-01）当「没有」，是把一个假资料写进他的书里。
--
-- ── 签名变了，所以旧的那一支要 drop ────────────────────────────────────
--
-- 多一个参数 = 一个新的重载，`create or replace` 产生不了它，两支会同时存在，
-- 而 PostgREST 挑哪一支不由我们决定。check:doc-numbers 那条守卫守的就是这个。

drop function if exists public.update_pipeline_record(
  uuid, text, text, bigint, text, date, date, jsonb, uuid, boolean
);

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
  in_clear_due_on boolean default false
)
returns public.pipeline_records
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.pipeline_records;
  the_party uuid;
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

  update public.pipeline_records set
    title = coalesce(left(btrim(in_title), 200), title),
    party = coalesce(left(btrim(in_party), 200), party),
    party_id = the_party,
    amount_cents = coalesce(in_amount_cents, amount_cents),
    stage = coalesce(left(btrim(in_stage), 60), stage),
    issued_on = coalesce(in_issued_on, issued_on),
    /* 明确讲要清掉才清掉。其余照旧：null = 不要动。 */
    due_on = case when in_clear_due_on then null else coalesce(in_due_on, due_on) end,
    extra = coalesce(in_extra, extra)
  where id = in_id
  returning * into row;

  return row;
end;
$$;

-- 谁可以打这一支：跟 20260901040000 讲的一样，登入的人，而且函式自己
-- 用 works_here() 挡住不是这一家的人。匿名的永远不行。
revoke execute on function public.update_pipeline_record(
  uuid, text, text, bigint, text, date, date, jsonb, uuid, boolean, boolean
) from public, anon;
grant execute on function public.update_pipeline_record(
  uuid, text, text, bigint, text, date, date, jsonb, uuid, boolean, boolean
) to authenticated;

comment on column public.pipeline_records.due_on is
  'The date on this document: 报价单 = 有效期, 订单/工程/任务 = 期限, 进货单 = 预计到货. '
  'Whether it has PASSED is computed at read time (lib/portal/record-validity.ts), never stored -- '
  'a stored flag lies on the day the job did not run.';

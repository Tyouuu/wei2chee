-- 那个「最多让他欠多少」的格子，要有地方去。
--
-- 20260904060000 加了 `directory_entries.credit_limit_cents`，
-- 而**两支写入函式一个都收不下它** —— 表单上那一格他打了字，
-- 保存的时候整个被丢掉。
--
-- **一个吞掉他打的字的格子，比没有那一格糟得多**：没有那一格，
-- 他知道系统不管这件事；有那一格而它吞掉，他以为写好了。
-- 这个仓库自己的话（[任务 81]）：
-- 「收一个看不回来的输入就是吞掉他打的字」。
--
-- ⚠️ 加参数 = 一支新函式，而新函式的 EXECUTE 预设给 PUBLIC
-- （20260901040000）。所以照那一支的规矩：先 drop 旧签名，再明确 grant。

drop function if exists public.update_directory_entry(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, jsonb
);

create or replace function public.update_directory_entry(
  in_id uuid,
  in_name text default null,
  in_kind text default null,
  in_contact_person text default null,
  in_phone text default null,
  in_whatsapp text default null,
  in_email text default null,
  in_address text default null,
  in_region text default null,
  in_reg_no text default null,
  in_tax_id text default null,
  in_status text default null,
  in_note text default null,
  in_extra jsonb default null,
  in_credit_limit_cents bigint default null,
  /* 他把那一格清空，就是「不设上限」—— 而 null 的意思是「这一栏不要动」。
     同一个形状：20260903010000 的日期、20260903070000 的工地，
     两个都栽在少了这一句上。 */
  in_clear_credit_limit boolean default false
)
returns public.directory_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.directory_entries;
begin
  select * into row from public.directory_entries d
   where d.id = in_id
     and public.works_here(d.project_id);
  if not found then
    raise exception 'no such entry in your project';
  end if;

  if in_name is not null and btrim(in_name) = '' then
    raise exception 'a directory entry needs a name';
  end if;

  /* 🔴 额度是钱。一个师傅改得了客户的电话，改不了「他最多能欠多少」——
     那一个数字是老板对这家客户的判断，而它决定今天那一车出不出去。 */
  if (in_credit_limit_cents is not null or in_clear_credit_limit)
     and not public.sees_money(row.project_id) then
    raise exception 'only the owner sets a credit limit';
  end if;

  /* ⚠️ 底下那一段是从 20260901010000 一字不改抄下来的，只加了额度那一行。
     整支重写的时候照抄，只加要加的 —— 20260903070000 那次凭印象重写，
     三个地方跟原本不一样。 */
  update public.directory_entries set
    name = coalesce(left(btrim(in_name), 200), name),
    kind = case when lower(btrim(coalesce(in_kind, ''))) in ('person', 'company')
                then lower(btrim(in_kind)) else kind end,
    contact_person = coalesce(left(btrim(in_contact_person), 200), contact_person),
    phone = coalesce(left(btrim(in_phone), 40), phone),
    whatsapp = coalesce(left(btrim(in_whatsapp), 40), whatsapp),
    email = coalesce(left(btrim(in_email), 200), email),
    address = coalesce(left(btrim(in_address), 400), address),
    region = coalesce(left(btrim(in_region), 120), region),
    reg_no = coalesce(left(btrim(in_reg_no), 60), reg_no),
    tax_id = coalesce(left(btrim(in_tax_id), 60), tax_id),
    status = coalesce(left(btrim(in_status), 60), status),
    note = coalesce(left(in_note, 2000), note),
    credit_limit_cents = case
                           when in_clear_credit_limit then null
                           else coalesce(in_credit_limit_cents, credit_limit_cents)
                         end,
    extra = coalesce(in_extra, extra)
  where id = in_id
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.update_directory_entry(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, bigint, boolean
) from public, anon;
grant execute on function public.update_directory_entry(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, bigint, boolean
) to authenticated;

/* ⚠️ `add_directory_entry` **故意不收它**。一个还没有开过任何一张单的
   新客户，没有「他欠我多少」这件事可以判断 —— 而一个开户的时候就要他
   想清楚额度的表单，会让他随便填一个数字进去。
   他要设的时候，去那个客户自己那一页设。 */

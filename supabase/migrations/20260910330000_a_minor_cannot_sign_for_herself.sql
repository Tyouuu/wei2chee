-- 未成年人——没有出生日期就没有监护人签名。
--
-- —— 为什么（任务 341 零之四，最后一个）────────────────────
--
-- 年龄法令 1971：未满 18 岁是未成年人，她自己签的同意书没有法律效力。
-- 而青少年做暗疮、镭射在马来西亚是常规生意。`date_of_birth` 跟 `photo_consent`
-- 在仓库里之前都是零个命中。Pabau 出的是一份可以列印的 PDF 范本
-- （父母签名栏）——整个市场只做到「印一张纸」，没有人做成软件里的守卫。
--
-- ── 加，不是重写 ─────────────────────────────────────────────────────────
--
-- 两栏：`directory_entries.date_of_birth（update_directory_entry 加一个参数）`
-- 和 `consent_signatures` 上一个新回答——公开的那一页现在告诉它自己
-- `requires_guardian`，`sign_consent` 加一个必填时才接的参数。
--
-- ❗ 不编年龄：不知道生日日期的人（今天几乎每个客人都是）——就照常让她自己签，
-- 不假装知道她多大。八字都没有而拦住一张同意书，比放行一个没人听过的规矩更贵（[重点 33]）。
--
-- `photo_consent` 那半不在这一支里——前后照片同意已经有自己的机制
-- （20260909100000），再加一栏会是同一件事两个答案。

alter table public.directory_entries
  add column if not exists date_of_birth date;

comment on column public.directory_entries.date_of_birth is
  'Known only when she told us. Drives whether a consent form needs a guardian signature (sign_consent). Unknown means treated as an adult -- guessing her age is worse than not asking. See 20260910330000.';

drop function if exists public.update_directory_entry(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, bigint, boolean
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
  in_clear_credit_limit boolean default false,
  in_date_of_birth date default null
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
    extra = coalesce(in_extra, extra),
    date_of_birth = coalesce(in_date_of_birth, date_of_birth)
  where id = in_id
  returning * into row;

  return row;
end;
$$;

drop function if exists public.public_consent_form(uuid);

create or replace function public.public_consent_form(in_ref uuid)
returns table (
  business_name text,
  style text,
  palette text,
  system_language text,
  person_name text,
  form_name text,
  form_body text,
  can_sign boolean,
  requires_guardian boolean,
  signed_at timestamptz,
  signed_name text,
  signed_note text
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  sig public.consent_signatures;
  proj public.projects;
  person public.directory_entries;
begin
  if in_ref is null then
    return;
  end if;

  select * into sig from public.consent_signatures s where s.share_ref = in_ref;
  if sig.id is null then
    return;
  end if;

  select * into proj from public.projects p where p.id = sig.project_id;
  if proj.id is null then
    return;
  end if;

  select * into person from public.directory_entries d where d.id = sig.party_id;

  return query
  select
    coalesce(proj.business_name, ''),
    proj.style,
    proj.palette,
    proj.system_language,
    coalesce(person.name, ''),
    sig.form_name,
    sig.form_body,
    sig.signed_at is null,
    (person.date_of_birth is not null
       and person.date_of_birth > (current_date - interval '18 years')::date),
    sig.signed_at,
    sig.signed_name,
    sig.signed_note;
end;
$fn$;

drop function if exists public.sign_consent(uuid, text, text);

create or replace function public.sign_consent(
  in_ref uuid,
  in_name text,
  in_note text default '',
  in_as_guardian boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  sig public.consent_signatures;
  minor boolean;
begin
  if coalesce(btrim(in_name), '') = '' then
    return 'incomplete';
  end if;
  if length(in_name) > 120 or length(coalesce(in_note, '')) > 1000 then
    return 'too_long';
  end if;
  if in_ref is null then
    return 'not_found';
  end if;

  select * into sig from public.consent_signatures s where s.share_ref = in_ref;
  if sig.id is null then
    return 'not_found';
  end if;

  /* 🔴 签过了就不给再动。一次签名是一个承诺，不是一个设定。 */
  if sig.signed_at is not null then
    return 'signed';
  end if;

  /* 🔴 未满十八岁，她自己签的同意书没有法律效力（年龄法令 1971）。
     不知道生日——不编，照常让她签（[重点 33]）。 */
  select (d.date_of_birth is not null
            and d.date_of_birth > (current_date - interval '18 years')::date)
    into minor
    from public.directory_entries d where d.id = sig.party_id;
  if coalesce(minor, false) and not in_as_guardian then
    return 'guardian_required';
  end if;

  update public.consent_signatures
  set signed_at = now(),
      signed_name = left(btrim(in_name), 120),
      signed_note = left(btrim(coalesce(in_note, '')), 1000),
      updated_at = now()
  where id = sig.id;

  return 'ok';
end;
$fn$;

revoke execute on function public.update_directory_entry(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, bigint, boolean, date
) from public, anon;
grant execute on function public.update_directory_entry(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, bigint, boolean, date
) to authenticated;

revoke execute on function public.public_consent_form(uuid) from public;
grant execute on function public.public_consent_form(uuid) to anon, authenticated;

revoke execute on function public.sign_consent(uuid, text, text, boolean) from public;
grant execute on function public.sign_consent(uuid, text, text, boolean) to anon, authenticated;

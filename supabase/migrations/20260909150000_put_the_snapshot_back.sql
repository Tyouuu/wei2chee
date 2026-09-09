-- 把快照原样搬回去（20260909140000 弄坏的那一段）。
--
-- ⚠️ **原样从 20260909130000 抽出来的，不是照记忆重打**
-- —— [重点 31](../docs/founder-points.md) 第一条：整支重写漏掉一段守卫，
-- 这个仓库被咬过三次。
--
-- 弄坏那一版红出来的正是它坏掉时的样子：
--   FAIL  读得到那一份文字
--   FAIL  而它是发出去那一刻那一份，不是今天的范本
--   FAIL  🔴 签完回去看，读到的还是她当时签的那一份
--
-- 也就是**客人打开那条连结，读到的是老板今天改过的措辞** ——
-- 而她昨天读的、签的是另一版。一份会跟着范本变的证据不是证据。

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
    sig.signed_at,
    sig.signed_name,
    sig.signed_note;
end;
$fn$;

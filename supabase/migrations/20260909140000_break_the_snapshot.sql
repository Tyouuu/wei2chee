-- 🔴 故意弄坏，看它红。下一支（20260909150000）原样搬回去。
--
-- 弄坏的是**快照**，而它是 20260909130000 那一整张表唯一存在的理由。
--
-- 而这里装回去的正是一个天真的实作会写的东西：
-- 「内容已经在 `consent_forms` 上了，何必在每一份签署上再存一次」——
-- 於是那一页去 join 范本，读**今天**的措辞。
--
-- 它坏起来没有任何东西会讲：不报错、画面正常、老板那一边照旧读得到
-- 她签的那一份（那一栏还在表上）。**只有客人手上那条连结在说谎。**
--
-- ⚠️ 单独推一次 —— 弄坏跟改回去在同一次推送里，红的那一刻没有人看得到
-- （[任务 160] 付过这一次学费）。
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
  tpl public.consent_forms;
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
  select * into tpl from public.consent_forms f where f.id = sig.form_id;

  return query
  select
    coalesce(proj.business_name, ''),
    proj.style,
    proj.palette,
    proj.system_language,
    coalesce(person.name, ''),
    /* 🔴 坏在这两行：读的是**今天的范本**，不是她被发到手上的那一份。 */
    coalesce(tpl.name, sig.form_name),
    coalesce(tpl.body, sig.form_body),
    sig.signed_at is null,
    sig.signed_at,
    sig.signed_name,
    sig.signed_note;
end;
$fn$;

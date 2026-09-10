-- 🔴 故意弄坏：拿掉「未满十八岁要监护人」那一段，看 check:consent 红不红。
-- 单独推这一支，看过红了再用 20260910350000 原样放回去（不是重打）。

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

  if sig.signed_at is not null then
    return 'signed';
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

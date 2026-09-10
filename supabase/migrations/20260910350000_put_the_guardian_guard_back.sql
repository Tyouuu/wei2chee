-- 放回去——原样从 20260910330000 抽出来，不是重打。看过 20260910340000 红过。

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

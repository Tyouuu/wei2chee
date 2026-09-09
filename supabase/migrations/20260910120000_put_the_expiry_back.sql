-- 把 20260910110000 拿掉的那一段搬回去。
--
-- ⚠️ **原样从 20260910100000 抽出来**（[重点 31] 第 1 条）。
--
-- 弄坏那一版红出来的（`check:makeup`）：
--   FAIL  🔴 过期的用不了
--   FAIL  🔴 而且它讲得出几时过的（不是光秃秃一句用不了）

create or replace function public.use_lesson_credit(
  in_id uuid,
  /* 🔴 补在哪一堂。必填 —— 见档头。 */
  in_lesson_id uuid
)
returns public.lesson_credits
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.lesson_credits;
  lesson public.appointments;
begin
  select * into row from public.lesson_credits c
   where c.id = in_id and public.works_here(c.project_id);
  if row.id is null then
    raise exception 'no such owed lesson in your business';
  end if;
  if row.used_on is not null then
    raise exception 'that one was already made up';
  end if;

  select * into lesson from public.appointments where id = in_lesson_id;
  if lesson.id is null or lesson.project_id <> row.project_id then
    raise exception 'no such lesson in your business';
  end if;

  /* ⚠️ **过期的不给用，而讲得出它几时过的** —— 一句「用不了」
     配一个日子，跟一句光秃秃的「用不了」，家长的反应差很远。 */
  if row.expires_on is not null and row.expires_on < public.today_myt() then
    raise exception 'that one expired on %', row.expires_on;
  end if;

  update public.lesson_credits
     set used_on = public.today_myt(), used_lesson_id = in_lesson_id
   where id = in_id
  returning * into row;
  return row;
end;
$$;


revoke execute on function public.use_lesson_credit(uuid, uuid) from public, anon;
grant execute on function public.use_lesson_credit(uuid, uuid) to authenticated;

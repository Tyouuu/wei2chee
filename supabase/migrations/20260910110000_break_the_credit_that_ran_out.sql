-- 🔴 故意弄坏，看它红（[重点 31] 第 3 条）。**单独推一次**。
--
-- 拿掉的是「过期的用不了」。
--
-- 坏起来的样子：一间中心讲好「补课三个月内有效」，而一张一年前的
-- 欠课照样补得成 —— **白送一堂课，而且是它自己讲过不送的那一堂**。
-- ⚠️ 画面上完全正常：划掉了、名单少一个、没有任何东西会红。
-- 20260910120000 把它原样搬回去。

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
  /* 🔴 弄坏的就是这一段：过期照样给用。 */

  update public.lesson_credits
     set used_on = public.today_myt(), used_lesson_id = in_lesson_id
   where id = in_id
  returning * into row;
  return row;
end;
$$;


revoke execute on function public.use_lesson_credit(uuid, uuid) from public, anon;
grant execute on function public.use_lesson_credit(uuid, uuid) to authenticated;

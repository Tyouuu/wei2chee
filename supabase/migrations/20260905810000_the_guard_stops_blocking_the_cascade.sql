-- 那条守卫不再挡住整家公司被删掉。
--
-- ── 洞是尺子当场抓到的，而且是任务 129 那一类的第二次 ──────────────────────
--
--   🔴 删不掉那个临时帐号 …：Database error deleting user
--
-- `follow_ups_own_project` 写的是 `before insert or update`。
-- 而删一个 auth 使用者的时候，`created_by` / `done_by` 那两条外键是
-- `on delete set null` —— **那是一次 UPDATE**，它会触发这条守卫；
-- 而那一刻专案跟单据已经在同一句里被 cascade 掉了，於是
-- `belongs is null` -> `raise` -> **整句删除被挡下来**。
--
-- ⚠️ 任务 129 就是这个：六条守卫让一个 auth 使用者删不掉，
-- 而我清理的时候连他的示范帐号一起炸了。**这是第二次，形状一模一样。**
--
-- ── 两个改动，各挡一半 ────────────────────────────────────────────────────
--
-- ① 触发器只在**那两栏真的被写**的时候跑（`update of project_id, record_id`）。
--    它存在的理由就是挡「我的跟进挂到别人的单上」，而那只可能在写那两栏时发生。
--    `created_by` 被设成 null 跟它一点关系都没有。
--
-- ② 就算真的跑到了，**公司都不在了就放行** —— 没有人要读那本帐。
--    抄的是 20260905740000 那一段（期间锁的删除分支）。

create or replace function public.follow_ups_own_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  belongs uuid;
  still_there boolean;
begin
  /* ② 公司都不在了就放行 —— 这一句要排在前面，不然下面那一句
     会在 cascade 中途把整句删除挡下来。 */
  select exists (select 1 from public.projects p where p.id = new.project_id)
    into still_there;
  if not still_there then
    return new;
  end if;

  select r.project_id into belongs
  from public.pipeline_records r where r.id = new.record_id;
  if belongs is null or belongs <> new.project_id then
    raise exception 'that document is not in this project';
  end if;
  return new;
end;
$fn$;

/* ① 只在那两栏被写的时候跑。 */
drop trigger if exists follow_ups_own_project_trg on public.follow_ups;
create trigger follow_ups_own_project_trg
  before insert or update of project_id, record_id on public.follow_ups
  for each row execute function public.follow_ups_own_project();

comment on function public.follow_ups_own_project() is
  'A follow-up belongs to the project its document belongs to. Fires only when those two columns are actually written, and stands aside once the project is gone -- otherwise it blocks the cascade that deletes an account, which is task 129 all over again. See 20260905810000.';

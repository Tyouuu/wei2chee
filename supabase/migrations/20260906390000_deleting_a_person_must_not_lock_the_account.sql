-- 🔴 那张新表第一次跑就把一个帐号锁住了 —— 第三次同一个形状。
--
-- `check:messages` 三十三条全过，然后收尾印:
--     🔴 删不掉那个临时帐号 877d17e1…：Database error deleting user
--
-- 怎么发生的，跟 [任务 129] · [任务 213] 一模一样：
--   删一个使用者 → `messages.sent_by references auth.users(id) on delete set null`
--   对那一行发一次 **update** → 守卫开火 → 它问 `sees_money(project_id)`，
--   而那一刻**没有登入身分**（`auth.uid()` 是 null）→ raise
--   → **整句删除被挡下来**，而画面上只看得到一句 `Database error deleting user`。
--
-- 🔴 而 20260906260000 那一段放行救不了这一支，理由要写清楚:
--   那一段问的是「**公司还在不在**」。删一个师傅的时候，
--   老板那一家好好的 —— 所以它正确地不放行，然后撞在权限检查上。
--   那十支之所以没事，是因为**它们的 UPDATE 分支根本不检查权限**
--   （它们只顺手推导 project_id）；而我这一支照 `nudge_snoozes` 写，
--   而 `nudge_snoozes` 的 `by_who` 从来没有被真的删过一次。
--
-- 修法比再加一个 exists 窄，也更准:
--   **UPDATE 不再问「这一家是不是你的」，改成问「这一行有没有换过一家」。**
--   插进去那一刻已经问过了；而一行讯息不可以搬到另一家去，那才是这里真正要守的。
--   ⚠️ 而这张表**没有 update 的 policy**，所以外面的人本来就 update 不了它 ——
--   走得到这一段的只有那几支 security definer 跟资料库自己的 cascade。

create or replace function public.messages_own_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.project_id is distinct from old.project_id then
      raise exception 'a message cannot move to another project';
    end if;
    return new;
  end if;
  if not public.sees_money(new.project_id) then
    raise exception 'that project is not yours';
  end if;
  return new;
end;
$$;

create or replace function public.message_settings_own_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.project_id is distinct from old.project_id then
      raise exception 'that switch cannot move to another project';
    end if;
    return new;
  end if;
  if not public.sees_money(new.project_id) then
    raise exception 'that project is not yours';
  end if;
  return new;
end;
$$;

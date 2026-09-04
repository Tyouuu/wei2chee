-- 故意把它弄回坏的，看那三条守卫红。
-- 一个没有人看过它红的守卫，等於没有守卫 —— 而这一条守的是一个
-- 已经上线过的洞，所以更要看过。
-- 20260904260000 马上把它修回去。两份都留在历史里，因为它们就是那个证据。
create or replace function public.sees_money(in_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_role(in_project_id) = 'owner';
$$;

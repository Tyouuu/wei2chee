-- 这一轮安全排查（20260911570000～710000）抓到的真错，留一把常驻的尺
-- 挡住它以后再发生一次——`ALTER DEFAULT PRIVILEGES` 那条路验证过没有
-- 真的生效（20260911710000），所以挡法不是靠一条资料库设定默默生效，
-- 是靠这一支函式，被 `npm run check` 每次真的跑一次。
--
-- 只有老板看得到，理由跟 console_* 一样：这份清单列的是函式名字跟
-- 权限状态，不是营业资料，但也没有理由给客户看这个仓库的内部结构。
create or replace function public.security_grant_audit()
returns table (fn_name text, fn_args text, is_trigger boolean, public_can_execute boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_founder() then
    raise exception 'not permitted';
  end if;

  return query
  select p.proname::text,
         pg_get_function_identity_arguments(p.oid),
         (p.prorettype = 'trigger'::regtype),
         has_function_privilege('public', p.oid, 'EXECUTE')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef = true
  order by p.proname;
end;
$$;
revoke execute on function public.security_grant_audit() from public;
grant execute on function public.security_grant_audit() to authenticated;

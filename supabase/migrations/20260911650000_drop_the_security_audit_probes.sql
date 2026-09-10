-- 用完即丢：这一批探针只是为了这一次安全排查（20260911570000～640000）
-- 直接问系统目录真话，不是产品的一部分，全部拿掉。
drop function if exists public.probe_rls_coverage();
drop function if exists public.probe_secdef_functions();
drop function if exists public.probe_public_schema_privileges();
drop function if exists public.probe_schema_create_privilege();
drop function if exists public.probe_fn_grants(text[]);
drop function if exists public.probe_public_role_grants();
drop function if exists public.probe_raw_acl();

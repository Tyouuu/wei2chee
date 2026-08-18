-- supabase/migrations/20260818130000_revoke_rpc_execute_from_anon.sql
--
-- Fixes a permission gap left by 20260818120000_customer_portal_schema.sql:
-- `revoke execute on function ... from public` does NOT revoke the `anon`
-- role's own direct EXECUTE grant. Supabase provisions every project with
-- `alter default privileges in schema public grant execute on functions to
-- anon, authenticated, service_role`, which runs at `create function` time
-- and grants EXECUTE directly to the named `anon` role -- entirely separate
-- from the implicit grant-to-everyone that `revoke ... from public` (the
-- PUBLIC pseudo-role) removes. Revoking from `public` was never going to
-- touch a grant made directly to `anon`.
--
-- This was not exploitable in practice (auth.uid() is null for anon
-- callers, and both functions' `where account_id = auth.uid()` clauses
-- never match null), but the prior migration's comment claimed a
-- protection that wasn't actually in effect, and this is the access-control
-- boundary later tasks build on -- it needs to be real, not
-- accidentally-safe.

revoke execute on function public.set_project_style(text) from anon;
revoke execute on function public.save_project_page(text, jsonb) from anon;

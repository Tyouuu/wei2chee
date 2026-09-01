-- supabase/migrations/20260901040000_say_out_loud_who_may_run_them.sql
--
-- 20260901010000 re-declared six writers to ask `works_here()` instead of
-- `account_id = auth.uid()`, and did not restate who may execute them.
-- `pipeline-rpc.test.ts` went red on exactly that:
--
--     is reachable by a signed-in customer and nobody else
--
-- ── IT IS NOT A LIVE HOLE, AND IT IS STILL A REAL BUG ─────────────────────
--
-- `create or replace` on an UNCHANGED signature keeps the existing privileges,
-- so nothing was granted to anybody today -- verified by check:records (86) and
-- check:staff (43) both passing against the pushed schema.
--
-- The bug is what happens next. A future re-declaration that adds one
-- parameter creates a NEW function, and a new function in Postgres has
-- `EXECUTE` granted to PUBLIC by default. The next person reads the newest
-- migration to see who may call it, finds no answer there, and ships an
-- anonymous write path into a table of somebody's customers.
--
-- That is precisely what the guard was defending, so the answer is to say it
-- rather than to relax the guard.
--
-- ⚠️ `anon` is never granted any of these. A stranger with the public key must
-- not be able to write a row into a business's book, and the only reason to
-- write `revoke ... from public` next to every grant is that PUBLIC includes
-- anon.

revoke execute on function public.add_pipeline_record(
  uuid, text, text, text, bigint, text, date, date, jsonb, uuid, uuid
) from public;
grant execute on function public.add_pipeline_record(
  uuid, text, text, text, bigint, text, date, date, jsonb, uuid, uuid
) to authenticated;

revoke execute on function public.update_pipeline_record(
  uuid, text, text, bigint, text, date, date, jsonb, uuid, boolean
) from public;
grant execute on function public.update_pipeline_record(
  uuid, text, text, bigint, text, date, date, jsonb, uuid, boolean
) to authenticated;

revoke execute on function public.set_pipeline_archived(uuid, boolean) from public;
grant execute on function public.set_pipeline_archived(uuid, boolean) to authenticated;

revoke execute on function public.set_record_lines(uuid, jsonb) from public;
grant execute on function public.set_record_lines(uuid, jsonb) to authenticated;

revoke execute on function public.update_directory_entry(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, jsonb
) from public;
grant execute on function public.update_directory_entry(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, jsonb
) to authenticated;

revoke execute on function public.set_directory_archived(uuid, boolean) from public;
grant execute on function public.set_directory_archived(uuid, boolean) to authenticated;

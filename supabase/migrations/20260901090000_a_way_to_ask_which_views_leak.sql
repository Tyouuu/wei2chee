-- supabase/migrations/20260901090000_a_way_to_ask_which_views_leak.sql
--
-- A checker cannot read `pg_views` through PostgREST, so it could not have
-- caught the leak in 20260901080000 even if somebody had thought to look.
-- This is the question, asked once, so the guard beside it covers every view
-- this schema will ever have rather than the one that happened to be wrong.
--
-- ⚠️ WHY IT IS SAFE TO EXPOSE. It returns two columns -- a view's name and
-- whether it is set to run as its caller. No row of anybody's data passes
-- through it, and a business learning that a view exists learns nothing it
-- could not learn by reading the API's own schema.

create or replace function public.views_without_invoker()
returns table (view_name text, leaks boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.relname::text,
         coalesce(
           (select option_value = 'false'
              from pg_options_to_table(c.reloptions)
             where option_name = 'security_invoker'),
           true
         )
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v';
$$;

comment on function public.views_without_invoker() is
  'Every view in public, and whether it reads past row-level security. A view runs as its OWNER unless security_invoker is set, and its owner is postgres -- which is how stock_on_hand served one business four rows of another business''s shelf. Asked by check:isolation.';

revoke execute on function public.views_without_invoker() from public;
grant execute on function public.views_without_invoker() to authenticated;

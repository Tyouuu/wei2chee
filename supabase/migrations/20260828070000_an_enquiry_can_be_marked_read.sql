-- supabase/migrations/20260828070000_an_enquiry_can_be_marked_read.sql
--
-- `site_enquiries.status` has had three states since the day the table was
-- written, and the column's own comment says what they are for:
--
--   -- 'new' until the owner opens it. Deliberately three states and not a
--   -- workflow: this table is an inbox, and the moment it tries to be a
--   -- pipeline it is competing with the customer's own 报价单 page.
--
-- Nothing has ever written it. No RPC, no update, no control anywhere in the
-- app — grep the repository and the only hit outside this migration is the
-- CHECK constraint. Every enquiry is 'new' for ever.
--
-- WHY THAT MATTERS MORE THAN IT SOUNDS. The rail carries a count badge beside
-- 官网来的询价, and the home screen carries one too. Both count every row the
-- project has ever had. So the badge is not "you have something to look at", it
-- is "you have had customers", and at twenty enquiries it says 20 whether or
-- not the twentieth was read. The one arrow in this product that genuinely
-- moves — a stranger fills in the public site and it lands in the owner's
-- system — ends in a number that stops meaning anything the moment it works.
--
-- WHY AN RPC AND NOT AN RLS UPDATE POLICY. There is no update policy on this
-- table and adding one would let a customer write any column on their own
-- enquiries — including `answers`, which is what a real person typed, and
-- `lands_in`, which decides where it goes. A function that flips exactly one
-- column, for exactly the caller's own project, cannot be talked into anything
-- else.
--
-- WHY IT MARKS ALL OF THEM AND TAKES NO ARGUMENT. This is the schema's own
-- reading: 'new' until the owner OPENS IT, and what they open is the list. A
-- per-row call would need the caller to hand in ids, which is a chance to hand
-- in somebody else's. 'done' stays untouched and stays for a control the owner
-- presses on purpose.

create or replace function public.mark_site_enquiries_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  if auth.uid() is null then
    raise exception 'not permitted';
  end if;

  update public.site_enquiries e
  set status = 'read'
  from public.projects p
  where p.id = e.project_id
    and p.account_id = auth.uid()
    and e.status = 'new';

  get diagnostics touched = row_count;
  return touched;
end;
$$;

revoke execute on function public.mark_site_enquiries_read() from anon;
grant execute on function public.mark_site_enquiries_read() to authenticated;

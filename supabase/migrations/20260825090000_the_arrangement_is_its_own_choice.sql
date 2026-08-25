-- 排法 — change how the page is arranged without changing the register.
--
-- WHY. Durable's Layout sheet is 「Try a different layout set」: the theme stays
-- and the page rearranges. The founder marked it 拿 on 2026-08-25, and it is
-- the half of DASHBOARD_COMPOSITION that was missing — the compositions have
-- existed since that morning and were welded to the register, so the only way
-- to get 台账's table-first arrangement was to become 台账 and give up your own
-- colours, type and density.
--
-- WHY FIVE NAMED ARRANGEMENTS AND NOT SEVENTEEN. There is one composition per
-- register, but they are not seventeen different ideas — they are five, held
-- by three or four registers each: the table first, four figures and a chart,
-- one big number, today's work first, a board. Offering seventeen would ask
-- an owner to choose between 台账's arrangement and 印's without telling him
-- they are the same shape, which is a menu that punishes reading it.
--
-- WHY NULLABLE. NULL is 「跟我的风格走」 — the register's own arrangement, which
-- is what every account has today and what most should keep. It is a different
-- state from having chosen the arrangement that happens to match, exactly as
-- project_pages.sort_order is (migration 20260825080000).

alter table public.projects
  add column if not exists layout text;

alter table public.projects
  drop constraint if exists projects_layout_check;

alter table public.projects
  add constraint projects_layout_check
  check (layout is null or layout in ('table', 'console', 'hero', 'today', 'board'));

comment on column public.projects.layout is
  'Named arrangement for the generated dashboard, or NULL to follow the register''s own. '
  'See LAYOUT_SETS in lib/templates/industry-template.ts.';

create or replace function public.set_project_layout(new_layout text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_layout is not null
     and new_layout not in ('table', 'console', 'hero', 'today', 'board') then
    raise exception 'invalid layout: %', new_layout;
  end if;

  update public.projects
  set layout = new_layout, updated_at = now()
  where account_id = auth.uid();

  if not found then
    raise exception 'project not found';
  end if;
end;
$$;

revoke execute on function public.set_project_layout(text) from public;
grant execute on function public.set_project_layout(text) to authenticated;

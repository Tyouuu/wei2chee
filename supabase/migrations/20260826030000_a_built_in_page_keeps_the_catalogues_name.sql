-- A built-in page stops being christened in Chinese by the analysis.
--
-- 「不是這個英文 是我的平台裡面用英文」 -- 2026-08-26.
--
-- WHAT THE RAIL ACTUALLY SAID, on an English system:
--
--     Overview · 报价单 · Projects · Payments · Clients · Website
--
-- Five English and one Chinese, and no setting anywhere would fix it.
--
-- WHY. `project_pages.title` is the customer's own name for a page and wins
-- over everything, which is right -- it is what the rename control writes.
-- But provisioning also fills it, from the analysis's `recommended[].label`,
-- and the analysis is generated in Chinese because that is the language the
-- OWNER is interviewed in. So a business whose SYSTEM language is English was
-- handed a page permanently titled 报价单 by a step that was never asking what
-- language the system should speak.
--
-- The catalogue already answers this correctly. lib/portal/module-catalog.ts
-- carries `label` and `labelEn` for all seventeen keys, and `pageNavLabel`
-- picks by system language -- which is why the other five were English. The
-- title simply overrode it.
--
-- THE FIX IS TO STOP STORING A TITLE THE CATALOGUE ALREADY KNOWS. A title
-- exists for two things: a page the customer renamed, and a page the analysis
-- invented that the catalogue has no word for. Neither is a built-in key. So
-- built-ins now come through with title NULL and take the catalogue's word in
-- whichever language the system speaks.

-- ---------------------------------------------------------------------------
-- 1. Existing rows
-- ---------------------------------------------------------------------------
-- ONLY where the stored title is exactly the catalogue's own Chinese label for
-- that key. A customer who renamed 报价单 to 「工程报价」 chose those words, and
-- clearing that would be this migration doing the same kind of damage it exists
-- to undo. Nothing here touches a custom page: those keys are not in the list.
with catalogue(page_key, zh) as (
  values
    ('dashboard', '总览'), ('customers', '客户'), ('payments', '收款'),
    ('quotations', '报价单'), ('orders', '订单'), ('bookings', '预约'),
    ('projects', '项目'), ('tasks', '任务'), ('reconciliation', '对账'),
    ('commission', '佣金'), ('expenses', '开销'), ('reports', '报表'),
    ('ranking', '排名'), ('suppliers', '供应商'), ('staff', '员工'),
    ('inventory', '库存'), ('website', '官网')
)
update public.project_pages p
   set title = null
  from catalogue c
 where p.page_key = c.page_key
   and trim(p.title) = c.zh;

-- ---------------------------------------------------------------------------
-- 2. New signups
-- ---------------------------------------------------------------------------
-- Re-declares the provisioning trigger from 20260822040000 with ONE line
-- changed: the title is stored only for a key the catalogue does not know.
-- Everything else -- the module list, the forced website page, the ordering --
-- is carried over unchanged.
create or replace function public.provision_project_pages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_project_id uuid := new.id;
  industry_slug text;
  recommended jsonb;
  page_keys text[];
  page_titles jsonb := '{}'::jsonb;
  each_page_key text;
  idx int := 0;
begin
  select i.slug into industry_slug
    from public.industries i
   where i.id = new.industry_id;

  select a.result -> 'modules' -> 'recommended'
    into recommended
    from public.analyses a
   where a.project_id = new_project_id
   order by a.created_at desc
   limit 1;

  if recommended is not null and jsonb_typeof(recommended) = 'array' then
    select array_agg(m.key)
    into page_keys
    from (
      select distinct jsonb_array_elements(recommended) ->> 'key' as key
    ) m
    where m.key in (
      'dashboard', 'customers', 'payments',
      'quotations', 'orders', 'bookings', 'projects', 'tasks',
      'reconciliation', 'commission', 'expenses', 'reports',
      'ranking', 'suppliers', 'staff', 'inventory',
      'website'
    );

    -- THE ONE CHANGE. A label is kept only for a key the catalogue has no word
    -- for -- a page the analysis invented, like 「员工排班」. For a built-in the
    -- catalogue already holds both languages, and storing the analysis's
    -- Chinese here freezes the page into it forever.
    select jsonb_object_agg(m.key, m.label)
    into page_titles
    from (
      select distinct on (e ->> 'key')
        e ->> 'key' as key,
        nullif(trim(e ->> 'label'), '') as label
      from jsonb_array_elements(recommended) e
    ) m
    where m.label is not null
      and m.key not in (
        'dashboard', 'customers', 'payments',
        'quotations', 'orders', 'bookings', 'projects', 'tasks',
        'reconciliation', 'commission', 'expenses', 'reports',
        'ranking', 'suppliers', 'staff', 'inventory',
        'website'
      );
  end if;

  if page_keys is null or array_length(page_keys, 1) is null then
    page_keys := public.pages_for_industry(industry_slug);
    page_titles := '{}'::jsonb;
  end if;

  if not ('website' = any(page_keys)) then
    page_keys := page_keys || 'website';
  end if;

  foreach each_page_key in array page_keys
  loop
    insert into public.project_pages (project_id, page_key, sort_order, title)
    values (
      new_project_id,
      each_page_key,
      idx,
      nullif(page_titles ->> each_page_key, '')
    );
    idx := idx + 1;
  end loop;

  return new;
end;
$$;

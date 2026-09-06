-- 🔴 故意弄坏：加一支参数不照惯例的函式，看那把尺红。
-- **单独推一次**（重点 31 第三条）。下一支 20260906670000 把它删掉。
create or replace function public.probe_bad_naming(p_thing uuid, wants_it boolean)
returns boolean
language sql
stable
as $$ select wants_it and p_thing is not null $$;

grant execute on function public.probe_bad_naming(uuid, boolean) to authenticated;

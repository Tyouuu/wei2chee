-- 🔴 故意让「还没登记 SST」的生意也套得上那个预设税率，**看它红**。[重点 24]
--
-- 坏掉的样子：一间还没登记的装修公司，开出去的单上印着
-- **「SST 8% RM 480.00」** —— 那是一句他没有资格讲的话，
-- 而客人会照那个数字付钱。
--
-- 下一支 20260905630000 换回来。两份都留在历史里。

create or replace function public.set_record_tax(
  in_record_id uuid,
  in_rate numeric default null,
  in_clear boolean default false
)
returns public.pipeline_records
language plpgsql
security definer
set search_path = public
as $fn$
declare
  rec public.pipeline_records;
  prof public.tax_profile;
  use_rate numeric;
begin
  select * into rec from public.pipeline_records where id = in_record_id;
  if rec.id is null or not public.sees_money(rec.project_id) then
    raise exception 'no such document in your project';
  end if;

  if in_clear then
    update public.pipeline_records set tax_rate = null, updated_at = now()
     where id = in_record_id returning * into rec;
    return rec;
  end if;

  select * into prof from public.tax_profile where project_id = rec.project_id;

  /* 没讲税率就用他档案上那个 —— 但**只有在他真的登记过**的时候。
     没登记而套一个 8%，是替他开一张他没有资格开的税单。 */
  use_rate := in_rate;
  if use_rate is null then
    use_rate := coalesce(prof.sst_rate, 8.00);
  end if;

  if use_rate < 0 or use_rate > 100 then
    raise exception 'that is not a rate';
  end if;

  update public.pipeline_records set tax_rate = use_rate, updated_at = now()
   where id = in_record_id returning * into rec;
  return rec;
end;
$fn$;

-- 把「没登记就不给套预设税率」换回来。20260905620000 故意拿掉它，
-- 五条红里最要紧的那一条读起来就是坏掉时的样子：
--
--   FAIL  🔴 所以那份单据上没有税额 —
--         {"taxRate":8,"taxCents":40000,"grossCents":540000}
--
-- 🔴 **一间还没登记的公司，单上印着 SST RM 400，而客人会照那个数字付钱。**
--
-- 内容跟 20260905610000 那一支一模一样。

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
    if coalesce(btrim(prof.sst_no), '') = '' then
      raise exception 'you are not registered for SST, so say the rate explicitly if this one really carries tax';
    end if;
    use_rate := prof.sst_rate;
  end if;

  if use_rate < 0 or use_rate > 100 then
    raise exception 'that is not a rate';
  end if;

  update public.pipeline_records set tax_rate = use_rate, updated_at = now()
   where id = in_record_id returning * into rec;
  return rec;
end;
$fn$;

-- 🔴 故意弄坏，看那三条守卫红。**下一支 migration 立刻把它改回去。**
--
-- 一个没有人看过它红的守卫，等於没有守卫 —— 这个仓库为这一条付过太多次。
-- 弄坏三样：
--   ① 重送的那一条出路（早退）
--   ② 那把防重复的钥匙
--   ③ 只给伺服器那一端的那道锁
--
-- 弄坏之后 `npm run check:payment` 应该报：
--   FAIL  🔴 重送之后还是只有一行
--   FAIL  🔴 登入的人自己结不了帐
create or replace function public.settle_payment_request(
  in_provider text,
  in_provider_ref text,
  in_paid_cents bigint,
  in_method text default '',
  in_payer text default ''
)
returns public.payment_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.payment_requests;
  entry public.ledger_entries;
begin
  select * into req from public.payment_requests
    where provider = btrim(in_provider) and provider_ref = btrim(in_provider_ref)
    for update;

  if not found then
    raise exception 'no such payment request';
  end if;

  /* 🔴 重送的回呼走这一条出去。每一家闸道都会重送，而**不是错误** ——
     所以回那一张已经结好的，不要抛。抛出去的话闸道会再送一次，
     然后再一次，而我们每一次都在告诉它我们坏了。 */

  if coalesce(in_paid_cents, 0) <= 0 then
    update public.payment_requests
      set status = 'failed', paid_at = now()
      where id = req.id
      returning * into req;
    return req;
  end if;

  entry := public.add_ledger_entry_core(
    /* 🔴 null —— 没有人打过这一笔。见档头。 */
    in_actor => null,
    in_project_id => req.project_id,
    in_module_key => 'payments',
    in_direction => 'in',
    /* **真的到帐的那个数字**，不是我们要求的那个。 */
    in_amount_cents => in_paid_cents,
    in_party => left(coalesce(nullif(btrim(in_payer), ''), req.payer), 200),
    in_against_id => req.record_id,
    in_method => left(coalesce(nullif(btrim(in_method), ''), req.provider), 60),
    in_reference => left(req.provider_ref, 120),
    /* 同一张付款要求只会变成同一行钱 —— 就算上面每一道检查都错了，
       core 里那一段 idempotency 会把第二次的还给我们。 */
    in_idempotency_key => null
  );

  update public.payment_requests
    set status = 'paid',
        entry_id = entry.id,
        paid_cents = in_paid_cents,
        paid_at = now(),
        payer = left(coalesce(nullif(btrim(in_payer), ''), payer), 200)
    where id = req.id
    returning * into req;

  return req;
end;
$$;

grant execute on function public.settle_payment_request(text, text, bigint, text, text)
  to authenticated;

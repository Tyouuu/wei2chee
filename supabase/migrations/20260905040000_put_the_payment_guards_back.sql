-- 把 20260905030000 弄坏的三样改回去。
--
-- 弄坏那一支跟这一支**都留在历史里**，因为它们就是那句「我验过了」的证据：
--
--   弄坏之后：FAIL  🔴 重送之后还是只有一行 — **2 行**
--            FAIL  🔴 登入的人自己结不了帐 — 居然让它过了
--
-- 那个「2 行」不是一个测试数字，那是客人的 RM 3,000 被记了两次。
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
  if req.status = 'paid' then
    return req;
  end if;

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
    in_idempotency_key => req.id
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

revoke execute on function public.settle_payment_request(text, text, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.settle_payment_request(text, text, bigint, text, text)
  to service_role;

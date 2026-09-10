-- 故意弄坏：把 sync_payslip_totals 的 public 执行权重新打开，
-- 看 check:security-grants 真的红。单独推、单独跑，看过它红，再改回去。
grant execute on function public.sync_payslip_totals(uuid) to public;

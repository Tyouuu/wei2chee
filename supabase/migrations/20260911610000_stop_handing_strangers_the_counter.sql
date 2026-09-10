-- 🔴 老板要求全面掌握安全指数，逐支扫过全部 349 支 security definer
-- 函式的实际授权状态（不是读迁移档案历史，是直接问 pg_proc 现在真的
-- 授权给谁），抓到四支完全没有身分检查、却对 anon 或 authenticated
-- 开放直接呼叫的——这正是研究调出来的 OWASP API Top 10 第一名
-- （对象级越权 / BOLA）那一类：一支函式只认「这个 id 存在」，
-- 不认「这个 id 是不是打电话的人自己的」。
--
-- 四支都不是给客户端直接打的——8 个内部呼叫端（`add_pipeline_record` ·
-- `open_pay_run` · `set_payslip_earnings` 等等）全部先做过自己的
-- `works_here`/`sees_money` 检查，再从**同一支 security definer 函式**
-- 内部呼叫这四支；而 security definer 函式内部呼叫另一支函式，
-- 走的是拥有者（这个专案的迁移角色）的权限，不需要 `authenticated`
-- 或 `anon` 自己对被呼叫的那一支也有授权。**收回授权，内部呼叫链
-- 一个字不受影响，只堵掉直接绕过去的那条路。**
--
--   · `next_doc_no`——anon 都能打，任何一个没登入的陌生人都能对
--     猜到的 project_id 直接把单号计数器往前推，让那家生意的单号
--     无缘无故跳号（对做电子发票合规的生意，跳号是会被盯上的事）
--   · `ledger_allocations_sync_one` / `recompute_payslip_statutory` /
--     `sync_payslip_totals`——authenticated 就能打，任何一个 Formae
--     的客户（哪怕刚免费注册）都能对猜到的 entry_id / payslip_id
--     直接改另一家生意的对帐分摊或者薪资单数字
--
-- 全部原样留着 `security definer` 跟函式体一个字不动——这不是重写，
-- 是撤销一份从来没有用到过的多余授权（[重点 31] 「加」跟「收紧」
-- 之外的第三种：撤销一个错的授权，而合法呼叫链完全无感）。
revoke execute on function public.next_doc_no(uuid, text) from authenticated, anon;
revoke execute on function public.ledger_allocations_sync_one(uuid) from authenticated, anon;
revoke execute on function public.recompute_payslip_statutory(uuid) from authenticated, anon;
revoke execute on function public.sync_payslip_totals(uuid) from authenticated, anon;

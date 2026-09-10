-- ⚠️ 20260911660000 那一条没有真的生效——用完就丢的测试函式证明了：
-- 建一支什么授权都不给的新函式之后，它的 ACL 照样带着一条空白开头的
-- `=X/postgres`（那就是 public 伪角色的授权，[重点 26] 讲的
-- 「db push 成功证明不了任何事」在这里换了一个形状：一句 ALTER 语句
-- 跑成功，不代表它改到了它想改的那件事）。
--
-- 查 `pg_default_acl` 看到这个专案在建立那天就已经有一条
-- `postgres` 对 `public` schema 底下函式的默认权限规则，明写着
-- `anon`/`authenticated`/`service_role` 各自的授权——这多半是
-- Supabase 建专案时的样板设的。20260911660000 那句
-- `alter default privileges ... revoke execute on functions from public`
-- 没有真的改到那一条既有规则，原因还没查清楚（可能跟 `db push`
-- 走的那条连线在每一句之间怎么处理角色状态有关），不猜、留着当疑点。
--
-- 🔴 所以「以后新函式不会预设开放给 public」这件事**没有做到**，
-- 讲清楚，不要留着一个看起来做了但没做的迁移误导下一个人。
-- 真正能挡住这一类回归的是 `scripts/check-security-grants.mjs`——
-- 一把会在 `npm run check` 里跑的尺，不是一条无声生效与否的资料库设定。
--
-- 顺手清掉这一轮测试用的探针函式。
drop function if exists public.probe_default_priv_test();
drop function if exists public.probe_check_default_priv();
drop function if exists public.probe_current_role();
drop function if exists public.probe_default_acl();
drop function if exists public.probe_test_fn_acl();

-- 🔴 20260910230000 造了同一个洞的第三次形状。
--
-- 20260906300000 已经写过一次：一栏 `references auth.users(id) on delete
-- set null` 会让那个帐号删不掉，原话「资料库的原话（第三支临时探针）:
-- 23503 | insert or update on table "appointments" violates foreign key
-- constraint "appointments_project_id_fkey"」——cascade 把上层表删掉之后，
-- 那句 set null 还是对着已经在被删的那张表发了一次 update，两条队列撞在一起。
--
-- 那一次的修法是「这一栏值不值得留」，答案是不值得（没有人会问
-- 「谁按掉了那个徽章」），所以整栏砍掉。**这一次答案不一样**：
-- `party_alerts.created_by` / `cleared_by` 不是一个徽章，是这整张表存在的
-- 理由的一半——挂的人是谁、收的人是谁，MMC 真的出事要查证的时候要问
-- 这两句话（见 20260910230000 档头）。**砍掉是拿掉功能，不是拿掉多余。**
--
-- 🔴 所以这一次的修法是**延后验证的时机**，不是拿掉这一栏：
-- `deferrable initially deferred` 让这两条外键的检查挪到**交易真的要
-- commit 的那一刻**，而不是 cascade 半路那一下 update 自己的时候。
-- 等到 commit 前，account → project → party_alerts 那条 cascade 删除
-- 已经全部跑完，这一列本来就要被删掉——到时候「这一列还在不在」不再是
-- 一场两条队列谁先谁后的赛跑。
--
-- ⚠️ 对正常的写入路径（`set_party_alert` / `clear_party_alert`）零影响：
-- 那两支本来就是各自一句 `insert` / `update` 收在自己的交易里，
-- 到语句结束前后就会验，跟不 defer 时一样。**只有「同一个交易里先删了
-- 别的东西」这种情况，才会因为延后而不再半路炸掉。**
--
-- 用真的临时帐号复现过：手动把这两栏清成 null，删得掉；不清、
-- 不改这两条约束，删不掉。加了 `deferrable initially deferred` 之后
-- 同一支帐号（种一样的资料）删得掉了，见 check-alerts.mjs 收尾那一段。

alter table public.party_alerts
  alter constraint party_alerts_created_by_fkey deferrable initially deferred;

alter table public.party_alerts
  alter constraint party_alerts_cleared_by_fkey deferrable initially deferred;

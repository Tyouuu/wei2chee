-- 🔴 20260910240000 的做法测过了，没有用 —— 真的种一样的资料再删一次，
-- 一样炸：`Database error deleting user`。`deferrable initially deferred`
-- 理论上会把外键验证挪到交易 commit 那一刻，而实测它没有改变结果，
-- 代表挡在中间的不是「验证时机」，是 Supabase 自己删使用者那条路径本身
-- 的某种子交易边界（`auth.admin.deleteUser` 是它的 Go 服务，不是我们的
-- plpgsql，看不到它内部怎么切交易）。**猜不到就不猜，量到什么就信什么**
-- （[重点 15](../../docs/founder-points.md)）。
--
-- 而 20260906300000 那一次真的有用的做法，不是「延后」，是**拿掉外键本身**：
-- `party_alerts.created_by` / `cleared_by` 从来不是使用者填的值 ——
-- 两支函式都是 `auth.uid()` 自己填进去的（见 20260910230000），从来没有
-- 一条路会写进一个不存在的 id。**外键在这两栏上没有守到任何东西**，
-- 它唯一的效果就是让一个帐号删不掉。
--
-- 跟 `seen_by` 那一次不一样的地方：这一次**不删栏位，只拿掉外键**——
-- 「谁挂的、谁收的」这两句话本身要留着（20260910230000 档头写得很清楚，
-- MMC 真的出事要查证的时候要问这两句），拿掉的只是「这个 id 一定要活在
-- auth.users 里」这条从来没被用到的保证。

alter table public.party_alerts
  drop constraint if exists party_alerts_created_by_fkey;

alter table public.party_alerts
  drop constraint if exists party_alerts_cleared_by_fkey;

comment on column public.party_alerts.created_by is
  'auth.uid() at insert time, no FK -- a foreign key here blocked deleting the account (see 20260906300000 for the first time this shape showed up, 20260910250000 for this one). Never user-supplied, so nothing an FK would have caught.';

comment on column public.party_alerts.cleared_by is
  'auth.uid() at clear time, no FK -- same reason as created_by above.';

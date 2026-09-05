-- 「谁写的」不再让整个帐号删不掉。
--
-- ── 症状 ──────────────────────────────────────────────────────────────────
--
--   🔴 Database error deleting user
--   23503 | insert or update on table "follow_ups"
--          violates foreign key constraint "follow_ups_project_id_fkey"
--
-- 那是任务 129 的形状第二次：一条守卫挡住 cascade，而清理的时候
-- 有人拿正则去扫全库，把示范帐号一起炸掉。
--
-- ── 为什么是这一张表，而不是另外 21 个一样写法的栏位 ──────────────────────
--
-- `created_by` / `done_by` 是 `on delete set null` —— 而**那是一次 UPDATE**，
-- 它会把那一行**每一条外键重新验一遍**。
--
-- 🔴 而 `follow_ups` 是唯一一张有**两条 cascade 父路**的表
-- （`project_id -> projects` 跟 `record_id -> pipeline_records`）。
-- 删一个 auth 使用者的时候，那次 set-null 的 update 撞上一个
-- 正在同一句里被删掉的 `projects` 行 —— 於是 FK 验不过，整句被挡。
-- 另外那 21 个栏位没事，因为它们的表只有一条父路。
--
-- ── 改法：那两栏不再是外键 ────────────────────────────────────────────────
--
-- `record_changes`（20260904020000）早就做过一模一样的判断，而且写下来了：
--
--   「哪一张表。不是外键 —— 一条历史不可以跟着被它记录的那一行消失，
--     那正好是它最该讲话的时候。」
--
-- **「谁写的」是一件已经发生过的事。** 那个人离职、帐号被删掉，
-- 不会让「他 9 月 5 日写了这一句」变成没发生过。
-- 拿掉那两条外键，那次 set-null 的 update 就整个不存在了 ——
-- 🔴 **改的是让它不要发生，不是让它失败得好看一点。**
--
-- ⚠️ 栏位、资料、画面一个字都没变；变的只有「资料库要不要替我们看着它」。

alter table public.follow_ups
  drop constraint if exists follow_ups_created_by_fkey,
  drop constraint if exists follow_ups_done_by_fkey;

comment on column public.follow_ups.created_by is
  'Who wrote it. Deliberately NOT a foreign key: it is a fact about the past, and a set-null on it re-validates every other key on the row, which deadlocks the cascade that deletes an account. Same judgement as record_changes. See 20260905830000.';
comment on column public.follow_ups.done_by is
  'Who did it. Not a foreign key, same reason as created_by. See 20260905830000.';

-- ── 拆掉那支探针 ──────────────────────────────────────────────────────────
--
-- 20260905820000 是来问话的，问完就走。一支留在 schema 里、
-- 能删任何一个 auth 使用者的函式，不该在没有人需要它的时候还开着。

drop function if exists public.probe_delete_user_2(uuid);

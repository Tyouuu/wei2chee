-- 一家公司要走得掉。
--
-- ── 怎么发现的 ────────────────────────────────────────────────────────────
--
-- 佣金那一轮跑完，我去数了一下资料库：**46 个帐号里 45 个是我自己的
-- 测试帐号**，而每一支脚本跑完都印着「临时帐号删掉了」。
--
-- 拿一个去删，读到的是：`Database error deleting user`。
-- **那些脚本每一支都把错误吞掉**（`.catch(() => {})`），所以那句话讲了三个星期。
--
-- ⚠️ 而它不只是我的垃圾：`console_overview` 的 `customers_total` 数的就是
-- `accounts`，所以[老板自己那张后台](docs/founder-tasks.md#43)
-- **回报他有 45 个客户**，而他有 3 个付过钱的。
-- 那张后台存在的理由就是让他拿真数字决定下一件做什么
-- （[任务 43](docs/founder-tasks.md#43)）—— 一个读错的仪器比没有仪器糟。
--
-- ── 根因：`restrict` 跟 `no action` 差在什么时候检查 ──────────────────────
--
--   `restrict`    **马上**查。就算那几行在同一句里也要被删掉，它照样拦
--   `no action`   **等这一句做完**才查。同一句里一起消失的，它放行
--
-- 删一个 auth 使用者会往下 cascade：accounts → projects → directory_entries
-- 跟 pipeline_records 一起。而 `pipeline_records.party_id` 是 `restrict`，
-- 於是整句被拦下来 —— **一家公司永远关不掉。**
--
-- ── 那几条 restrict 本来在守什么，要保住 ──────────────────────────────────
--
-- 20260831080000 写得很清楚：**「一个有帐的客户不准删，只准收起来」** ——
-- 因为去年那张单上写着他的名字。那条规矩是对的，而且这次改动**一点都没有动它**：
-- 单独删一个客户，`no action` 一样会在句尾拦下来。
-- `check:records` 里那一条「有单的客户删不掉」就是那条规矩的守卫，
-- 而它在这次改动之后照样是绿的 —— 那才是证据。
--
-- 变的只有一件：**整家一起删的时候放行。**
--
-- ⚠️ 这一支**没有**给任何人一颗「删掉这家公司」的按钮，而且故意不给。
-- 关一家公司是我们在後台做的事（要先让他汇出，见[任务 64](docs/founder-tasks.md#64)）。
-- 这里修的是「做得到」，不是「谁做得了」。

-- ── 走单跟钱身上的「这是谁」 ──────────────────────────────────────────────

alter table public.pipeline_records
  drop constraint if exists pipeline_records_party_id_fkey;
alter table public.pipeline_records
  add constraint pipeline_records_party_id_fkey
  foreign key (party_id) references public.directory_entries(id);

alter table public.ledger_entries
  drop constraint if exists ledger_entries_party_id_fkey;
alter table public.ledger_entries
  add constraint ledger_entries_party_id_fkey
  foreign key (party_id) references public.directory_entries(id);

-- ── 冲正指着被它冲掉的那一笔 ──────────────────────────────────────────────
--
-- 同一条：一笔被冲正过的钱不准单独删（那会留下一张指着空气的冲正单），
-- 而整本帐一起走的时候两笔一起消失。

alter table public.ledger_entries
  drop constraint if exists ledger_entries_adjusts_id_fkey;
alter table public.ledger_entries
  add constraint ledger_entries_adjusts_id_fkey
  foreign key (adjusts_id) references public.ledger_entries(id);

-- ── 预约身上的客人跟师傅 ──────────────────────────────────────────────────

alter table public.appointments
  drop constraint if exists appointments_party_id_fkey;
alter table public.appointments
  add constraint appointments_party_id_fkey
  foreign key (party_id) references public.directory_entries(id);

alter table public.appointments
  drop constraint if exists appointments_staff_id_fkey;
alter table public.appointments
  add constraint appointments_staff_id_fkey
  foreign key (staff_id) references public.directory_entries(id);

-- ── 每一笔进出指着那个货品 ────────────────────────────────────────────────
--
-- 同一条，而且这一条更硬：架上有几个是这几笔加起来的，
-- 单独删掉那个货品会让一串进出指着空气。整家一起走的时候一起消失。

alter table public.stock_moves
  drop constraint if exists stock_moves_item_id_fkey;
alter table public.stock_moves
  add constraint stock_moves_item_id_fkey
  foreign key (item_id) references public.catalog_items(id);

comment on constraint pipeline_records_party_id_fkey on public.pipeline_records is
  'NO ACTION, not RESTRICT: deleting one party that has documents still fails at end of statement (the rule from 20260831080000 is intact), but deleting the whole business in one cascade now succeeds. RESTRICT checked immediately and made an account impossible to close. See 20260904160000.';

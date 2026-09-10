-- 帐号删不掉那个坑，扫过一遍——[任务 350] 讲的「值得抽时间扫一遍」那一件。
--
-- ── 为什么现在做（这一晚每一支尺子结尾都印过同一句）──────────────────────
--
-- 「🔴 删不掉那个临时帐号 ... Database error deleting user」——今晚每一支
-- `check:*` 跑完都印这一句，[任务 350] 已经撞过四次同一个根因
-- （`party_alerts` 两栏 · `treatment_notes` 的 `created_by`/`signed_by`），
-- 每次都是单独发现单独修。真登入量过一次最小的重现：**只建一个客户**，
-- 那个帐号就删不掉（`directory_entries.created_by`）。这不是边角情况，
-- 是几乎每一支尺子每一次都在踩的同一颗钉子。
--
-- ── 先探针，量出真的范围，不猜（[重点 26]）───────────────────────────────
--
-- 读 `pg_constraint` 系统目录（不是数迁移史的文字——那会把已经修过的
-- 也数进去）：**47 个外键指着 `auth.users`**，其中 **3 个是真的关系型
-- 外键**（`accounts.id` · `ai_usage.account_id` · `project_members.user_id`，
-- 全部是 `on delete cascade`，删帐号本来就该连着删这些，不能动）；
-- **44 个是 `_by` 类的审计栏位**，全部是 `on delete set null`
-- ——`created_by` · `recorded_by` · `changed_by` · `updated_by` ·
-- `marked_by` · `added_by` · `taken_by` · `handled_by` · `confirmed_by` ·
-- `sent_by` · `said_by` · `by_who` · `invited_by`。
--
-- ── 为什么拿掉外键是安全的（不是收紧，是拿掉一个从来没保护过什么的锁）───
--
-- 这 44 栏**只有一个来源**：函式自己写的 `auth.uid()`，从来不是使用者
-- 传进来的值——一个真的登入过的人，`auth.uid()` 保证有效，栏位不可能
-- 存到一个不存在的 id。这条外键唯一做的事，是在 `auth.users` 那一列
-- 被删的时候，逼资料库**同时**把 44 张表的这些栏位改成 null——
-- 而 Postgres 处理这么多张表的层叠顺序，会跟 Supabase 自己删帐号内部
-- 那一段动作互相卡住，读回来的就是一句含糊的
-- 「Database error deleting user」。
--
-- ── 只拿掉外键约束，栏位、写入的那几支函式一个字不动 ───────────────────
--
-- `auth.uid()` 还是照样填进这些栏位，只是资料库不再替它验证
-- 「这个 id 是不是活在 auth.users 里」——而它本来就一定是。

alter table public.appointment_lines drop constraint if exists appointment_lines_created_by_fkey;
alter table public.appointments drop constraint if exists appointments_recorded_by_fkey;
alter table public.assistant_facts drop constraint if exists assistant_facts_said_by_fkey;
alter table public.booking_rules drop constraint if exists booking_rules_updated_by_fkey;
alter table public.catalog_items drop constraint if exists catalog_items_created_by_fkey;
alter table public.class_attendance drop constraint if exists class_attendance_marked_by_fkey;
alter table public.class_confirmations drop constraint if exists class_confirmations_created_by_fkey;
alter table public.class_groups drop constraint if exists class_groups_created_by_fkey;
alter table public.class_members drop constraint if exists class_members_added_by_fkey;
alter table public.class_slots drop constraint if exists class_slots_created_by_fkey;
alter table public.commission_schemes drop constraint if exists commission_schemes_changed_by_fkey;
alter table public.consent_forms drop constraint if exists consent_forms_created_by_fkey;
alter table public.consent_signatures drop constraint if exists consent_signatures_created_by_fkey;
alter table public.deliveries drop constraint if exists deliveries_created_by_fkey;
alter table public.directory_entries drop constraint if exists directory_entries_created_by_fkey;
alter table public.ledger_entries drop constraint if exists ledger_entries_recorded_by_fkey;
alter table public.lesson_credits drop constraint if exists lesson_credits_created_by_fkey;
alter table public.loyalty_rules drop constraint if exists loyalty_rules_updated_by_fkey;
alter table public.message_settings drop constraint if exists message_settings_updated_by_fkey;
alter table public.messages drop constraint if exists messages_sent_by_fkey;
alter table public.nudge_snoozes drop constraint if exists nudge_snoozes_by_who_fkey;
alter table public.opening_balances drop constraint if exists opening_balances_created_by_fkey;
alter table public.package_uses drop constraint if exists package_uses_recorded_by_fkey;
alter table public.party_requests drop constraint if exists party_requests_handled_by_fkey;
alter table public.payment_requests drop constraint if exists payment_requests_created_by_fkey;
alter table public.project_members drop constraint if exists project_members_invited_by_fkey;
alter table public.reconciliations drop constraint if exists reconciliations_recorded_by_fkey;
alter table public.record_changes drop constraint if exists record_changes_changed_by_fkey;
alter table public.record_photos drop constraint if exists record_photos_taken_by_fkey;
alter table public.rentals drop constraint if exists rentals_created_by_fkey;
alter table public.returns drop constraint if exists returns_recorded_by_fkey;
alter table public.service_contracts drop constraint if exists service_contracts_created_by_fkey;
alter table public.service_packages drop constraint if exists service_packages_created_by_fkey;
alter table public.service_visits drop constraint if exists service_visits_recorded_by_fkey;
alter table public.staff_hours drop constraint if exists staff_hours_created_by_fkey;
alter table public.staff_prices drop constraint if exists staff_prices_updated_by_fkey;
alter table public.statutory_schedules drop constraint if exists statutory_schedules_confirmed_by_fkey;
alter table public.stock_batches drop constraint if exists stock_batches_created_by_fkey;
alter table public.stock_moves drop constraint if exists stock_moves_recorded_by_fkey;
alter table public.stored_value_moves drop constraint if exists stored_value_moves_created_by_fkey;
alter table public.treatment_notes drop constraint if exists treatment_notes_created_by_fkey;
alter table public.treatment_products drop constraint if exists treatment_products_created_by_fkey;
alter table public.vehicles drop constraint if exists vehicles_created_by_fkey;
alter table public.work_days drop constraint if exists work_days_recorded_by_fkey;

-- 探针用完了，拿掉——它们不是产品的一部分。
drop function if exists public.probe_auth_users_fks();
drop function if exists public.probe_auth_users_fks_v2();
drop function if exists public.probe_auth_users_fks_v3();

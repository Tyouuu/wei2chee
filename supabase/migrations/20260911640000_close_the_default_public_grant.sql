-- 🔴 老板要求全面掌握安全指数，逐支扫过全部 353 支 security definer
-- 函式现在真的对谁开放（问 pg_proc.proacl，不是读迁移档案历史），
-- 抓到 Postgres 一条从来没有人明写过的默认行为：**建函式那一刻，
-- EXECUTE 会自动送给 `public` 这个伪角色**（每一个角色都算数，
-- 含 `anon`），除非当时手动 `revoke ... from public`。这个仓库
-- 一直照惯例写 `grant execute ... to authenticated`，却从来没有人
-- 想到要连那一条隐藏的默认授权一起收回。

-- 🔴 而这一条隐藏的默认授权，验证过一次是真的能打穿：
-- `sync_payslip_totals(in_payslip_id uuid)` 那一支撤销了
-- authenticated/anon 的明确授权之后（20260911610000），真登入照样
-- 呼叫成功——因为它当初从来没有明写过 `revoke ... from public`，
-- 逐角色撤销撤不到那一条。任何一个 Formae 的客户，哪怕刚免费注册，
-- 都能对猜到的 payslip id 直接改另一家生意的薪资单数字。

-- 这一批 77 支的共同点：函式体本身没有让「谁在打」这件事完全无关紧要
-- （不是回传型别本身就挡掉直接呼叫的触发器，也不是故意开放给陌生人
-- 用捕获令牌进来的公开端点——那两类核对过 ACL，`anon=` / `authenticated=`
-- 都是明写的直接授权，跟这条隐藏的 public 默认授权无关，这次不动）。
-- 逐一核对过：这 77 支目前**全部**都还留着对 `authenticated` 的明确
-- 直接授权（撤销 public 那一条，合法的呼叫端一个字不受影响）——
-- 只有 `sync_payslip_totals` 一支的合法呼叫端本来就不该走客户端直呼，
-- 已经在 20260911610000 收掉了 authenticated/anon 的直接授权，这一次
-- 补上最后那一条。

-- 照 Supabase 官方生产环境清单原话：「撤销 anon/authenticated 的
-- 默认授权」——这一条把它做完整，连 Postgres 自己那条更早、更隐藏
-- 的默认授权（public 伪角色）一起收回。

revoke execute on function public.add_project_page(requested_key text, new_title text) from public;
revoke execute on function public.add_room(in_project_id uuid, in_name text) from public;
revoke execute on function public.add_treatment_note(in_party_id uuid, in_what text, in_appointment_id uuid, in_done_on date, in_area text, in_staff_id uuid, in_note text) from public;
revoke execute on function public.add_treatment_photo(in_note_id uuid, in_path text, in_stage text, in_caption text, in_may_show boolean) from public;
revoke execute on function public.add_treatment_product(in_note_id uuid, in_item_id uuid, in_qty numeric, in_batch_id uuid, in_branch_id uuid, in_idempotency_key uuid) from public;
revoke execute on function public.add_visit_photo(in_line_id uuid, in_path text, in_stage text, in_caption text, in_may_show boolean) from public;
revoke execute on function public.batches_of(in_item_id uuid) from public;
revoke execute on function public.class_members_own_project() from public;
revoke execute on function public.class_rows_own_project() from public;
revoke execute on function public.class_slots_guard() from public;
revoke execute on function public.commission_schemes_own_project() from public;
revoke execute on function public.commission_tiers_own_project() from public;
revoke execute on function public.consent_own_project() from public;
revoke execute on function public.console_handoffs() from public;
revoke execute on function public.console_leads() from public;
revoke execute on function public.console_overview() from public;
revoke execute on function public.console_project(target_project_id uuid) from public;
revoke execute on function public.console_set_fees(target_project_id uuid, new_dev_fee integer, new_monthly_fee integer) from public;
revoke execute on function public.console_set_note(target_project_id uuid, new_note text) from public;
revoke execute on function public.console_set_stage(target_project_id uuid, new_stage text) from public;
revoke execute on function public.delete_my_account() from public;
revoke execute on function public.deliveries_own_project() from public;
revoke execute on function public.dining_tables_own_project() from public;
revoke execute on function public.directory_addresses_own_project() from public;
revoke execute on function public.drop_treatment_product(in_id uuid) from public;
revoke execute on function public.enforce_period_lock() from public;
revoke execute on function public.follow_ups_own_project() from public;
revoke execute on function public.handle_new_account() from public;
revoke execute on function public.is_founder() from public;
revoke execute on function public.ledger_allocations_own_project() from public;
revoke execute on function public.ledger_allocations_sync() from public;
revoke execute on function public.lessons_due(in_project_id uuid, in_from date, in_until date) from public;
revoke execute on function public.list_page_versions(target_page_key text) from public;
revoke execute on function public.log_record_change() from public;
revoke execute on function public.mark_site_enquiries_read() from public;
revoke execute on function public.message_settings_own_project() from public;
revoke execute on function public.messages_own_project() from public;
revoke execute on function public.my_site_enquiries() from public;
revoke execute on function public.nudge_snoozes_own_project() from public;
revoke execute on function public.nudges_due(in_project_id uuid, in_until date) from public;
revoke execute on function public.open_lesson(in_group_id uuid, in_on date, in_module_key text) from public;
revoke execute on function public.package_uses_own_project() from public;
revoke execute on function public.party_payables(in_project_id uuid) from public;
revoke execute on function public.party_requests_cap() from public;
revoke execute on function public.party_requests_own_project() from public;
revoke execute on function public.pay_terms_are_for_staff() from public;
revoke execute on function public.payslip_lines_changed() from public;
revoke execute on function public.provision_project_pages() from public;
revoke execute on function public.record_lines_own_project() from public;
revoke execute on function public.record_photos_own_project() from public;
revoke execute on function public.record_terms_own_project() from public;
revoke execute on function public.record_total_from_lines() from public;
revoke execute on function public.remove_project_page(target_page_key text) from public;
revoke execute on function public.rentals_own_project() from public;
revoke execute on function public.return_lines_own_project() from public;
revoke execute on function public.returns_own_project() from public;
revoke execute on function public.rooms_free(in_project_id uuid, in_starts_at timestamp with time zone, in_ends_at timestamp with time zone) from public;
revoke execute on function public.rooms_of(in_project_id uuid) from public;
revoke execute on function public.service_contracts_own_project() from public;
revoke execute on function public.service_packages_own_project() from public;
revoke execute on function public.service_visits_own_project() from public;
revoke execute on function public.set_appointment_status(in_id uuid, in_status text) from public;
revoke execute on function public.set_class_slots(in_group_id uuid, in_slots jsonb) from public;
revoke execute on function public.set_photo_may_show(in_id uuid, in_may_show boolean) from public;
revoke execute on function public.set_room_active(in_id uuid, in_active boolean) from public;
revoke execute on function public.staff_hours_own_project() from public;
revoke execute on function public.stock_batches_own_project() from public;
revoke execute on function public.sync_payslip_totals(in_payslip_id uuid) from public;
revoke execute on function public.treatment_notes_of(in_party_id uuid, in_limit integer) from public;
revoke execute on function public.treatment_own_project() from public;
revoke execute on function public.treatment_photos_of(in_note_id uuid) from public;
revoke execute on function public.update_business_identity(new_business_name text, new_owner_name text) from public;
revoke execute on function public.update_treatment_note(in_id uuid, in_what text, in_area text, in_staff_id uuid, in_note text, in_done_on date, in_clear_staff boolean, in_archived boolean) from public;
revoke execute on function public.vehicles_own_project() from public;
revoke execute on function public.visit_photos_of(in_line_id uuid) from public;
revoke execute on function public.who_did_it_columns() from public;
revoke execute on function public.work_days_own_project() from public;

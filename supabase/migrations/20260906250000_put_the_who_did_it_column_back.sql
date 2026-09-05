-- 改回去。
--
-- 弄坏那一版红出来的两条，就是 2026-09-06 之前它真实的样子:
--     22 栏，一栏都不是光秃秃的 uuid — follow_ups.created_by(没有外键)
--     他写下的那一条还在（只是不知道是谁写的了）— 那一栏还是师傅的 id
alter table public.follow_ups
  drop constraint if exists follow_ups_created_by_fkey,
  add constraint follow_ups_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

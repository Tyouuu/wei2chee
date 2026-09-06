-- 第十一个讯号：这个学生连着两堂没来。
--
-- `walk:tuition`（[任务 239](#239)）走完那一趟的收尾写着：
--   🔴 一间补习中心，系统一句话都不会跟他讲 ——
--   十个讯号没有一个认得它。
--
-- 而那两句里只有一句真的缺：
--   「学费还没交」已经有人算 —— 第⑦个讯号（催款）本来就认得
--   一张过了日子而钱没收齐的单，而学费单就是那种单。
--   ⚠️ **我 2026-09-06 跟他讲「两句都没有人算」，那句话错一半**，
--   而拿走一趟量出来之前我不知道 —— `walk:tuition` 现在每一趟都在量它。
--
-- 🔴 一个学生连着两堂没来，就是下个月不来了 ——
-- 而一间补习中心的钱全部在「他下个月还在不在」上面。
--
-- ⚠️ 三件故意不做，每一件都带代价：
--   · **不数「还没点名」的那几堂** —— 空的不是「没来」（[任务 223](#223)）。
--     拿它当缺席，他放假一星期回来每一个学生都在要退学
--   · **不发明天数** —— 数的是「最近那两堂」，不是「三十天内两次」（[任务 220](#220)）
--   · **一堂没来不讲** —— 一堂没来是生病
--
-- ⚠️ 从 20260906580000 —— 最后一次定义它的那个档案 —— **原样抽出来加一段**，
--   不是照记忆重打（重点 31 第一条，这个仓库被咬过三次）。

drop function if exists public.nudges_due(uuid, date);

create or replace function public.nudges_due(
  in_project_id uuid,
  /* 看到哪一天为止。不给就是今天 ＋ 三天 —— 「快到期」本来就要提前讲。 */
  in_until date default null
)
returns table (
  kind text,
  subject_id uuid,
  record_id uuid,
  party text,
  title text,
  due_on date,
  days_late integer,
  amount_cents bigint,
  qty_left numeric,
  qty_floor numeric,
  /* 🔴 上一次跟人家讲这一件事是几时。
     **一个日子，不是一条把讯号压下去的规矩** ——
     「催过之后几天内不再讲」是一个天数，而这一轮刚立过
     不发明天数那条规矩（任务 220）。
     画面上写「三号催过了」，接下来怎么做是他的判断；
     真的不想再看到，`snooze_nudge` 本来就在那里。 */
  last_told_on date
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  cutoff date;
  money boolean;
  today date;
begin
  if not public.works_here(in_project_id) then
    return;
  end if;
  today := public.today_myt();
  cutoff := coalesce(in_until, today + 3);
  money := public.sees_money(in_project_id);

  return query
  with hushed as (
    select s.kind, s.subject_id
    from public.nudge_snoozes s
    where s.project_id = in_project_id and s.until >= today
  ),
  taken as (
    /* 这张单收到多少 —— 跟 `party_debts` 同一条：冲正过的不算。 */
    select a.record_id, sum(a.amount_cents) as got
    from public.ledger_allocations a
    join public.ledger_entries e on e.id = a.entry_id
    where e.project_id = in_project_id
      and e.direction = 'in'
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id)
    group by a.record_id
  ),

  /* ① 报价快到期，而且还没变成钱。
     「已确认」是他自己的词，测不了 —— **收到钱没有**是事实，测得了。 */
  quote_expiring as (
    select 'quote_expiring'::text as kind, r.id as subject_id, r.id as record_id,
           coalesce(r.party, '') as party, coalesce(r.title, '') as title,
           r.due_on, coalesce(r.amount_cents, 0)::bigint as amount_cents,
           null::numeric as qty_left, null::numeric as qty_floor
    from public.pipeline_records r
    left join taken t on t.record_id = r.id
    where money
      and r.project_id = in_project_id
      and r.module_key = 'quotations'
      and r.archived_at is null
      and r.due_on is not null
      and r.due_on <= cutoff
      and coalesce(t.got, 0) = 0
  ),

  /* ② 客人按了「同意」，而一分订金都还没进来。
     🔴 这一条是六条链里最贵的那一节 —— 他不知道客人答应了。 */
  agreed_unpaid as (
    select 'agreed_unpaid'::text, r.id, r.id,
           coalesce(r.party, ''), coalesce(r.title, ''),
           r.answered_at::date,
           coalesce(r.amount_cents, 0)::bigint,
           null::numeric, null::numeric
    from public.pipeline_records r
    left join taken t on t.record_id = r.id
    where money
      and r.project_id = in_project_id
      and r.archived_at is null
      and r.answered_at is not null
      and r.answer = 'accepted'
      and coalesce(t.got, 0) = 0
  ),

  /* ③ 保养该去了。**重用 `due_visits`**，不自己再算一次 ——
     同一个问题两个答案，这个仓库栽过至少八次。 */
  contract_due as (
    select 'contract_due'::text, v.contract_id, v.record_id,
           coalesce(v.party, ''), coalesce(v.title, ''),
           v.due_on, null::bigint, null::numeric, null::numeric
    from public.due_visits(in_project_id, null, cutoff) v
    where v.done_on is null
  ),

  /* ④ 套票剩最后一次 —— 那是他打电话叫客人续的那一刻。
     剩 0 次的不讲：那不是「快用完」，那是「用完了」。 */
  package_last as (
    select 'package_last'::text, b.package_id, null::uuid,
           coalesce(d.name, ''), coalesce(b.name, ''),
           b.expires_on, null::bigint,
           b.sessions_left::numeric, null::numeric
    from public.package_balance b
    join public.directory_entries d on d.id = b.party_id
    where b.project_id = in_project_id
      and b.archived_at is null
      and not b.expired
      and b.sessions_left = 1
  ),

  /* ⑤ 补货线破了。`reorder_at` 从建表那天就在，
     而在今天之前**没有任何地方读过它**（第 N 次「能力有、线没接」）。 */
  below_reorder as (
    select 'below_reorder'::text, i.id, null::uuid,
           '', coalesce(i.name, ''),
           null::date, null::bigint,
           coalesce(h.on_hand, 0)::numeric, i.reorder_at::numeric
    from public.catalog_items i
    left join public.stock_on_hand h on h.item_id = i.id
    where i.project_id = in_project_id
      and i.archived_at is null
      and i.reorder_at is not null
      and coalesce(h.on_hand, 0) < i.reorder_at
  ),

  /* ⑥ 🔴 有人在官网上订了，而他还没看过。
     六条链里第一条断掉的第一节就是这一句。
     **`works_here`，不是钱那一边** —— 前台要知道今天谁要来；
     而**按掉它**是老板的事（`mark_bookings_seen`）。
     取消掉的不讲 —— 那不是一件要他做的事。
     过了日子的照讲，而且会排在最前面 ——
     一个他从来没看过、而客人已经白跑一趟的预约，
     比一个明天的预约更要紧。 */
  booking_unseen as (
    select 'booking_unseen'::text, b.id, null::uuid,
           coalesce(b.party, ''), coalesce(b.service, ''),
           (b.starts_at at time zone 'Asia/Kuala_Lumpur')::date,
           null::bigint, null::numeric, null::numeric
    from public.appointments b
    where b.project_id = in_project_id
      and b.source = 'website'
      and b.seen_at is null
      and b.status <> 'cancelled'
  ),

  /* ⑦ 🔴 催款 —— 一期的日子过了，而收到的钱还盖不到那一期。
     **没有发明任何天数。** 三十天、六十天都是别人的惯例；
     他自己写在那张单上的分期表才是他跟客人讲好的话。

     两种来源，照顺序：
       · 有分期表的：今天以前该收的那几期加起来，比对收到多少
       · 没有分期表、而那张单自己有一个日子的：拿那个日子

     ⚠️ 报价单**只在有分期表的时候**才算 —— 一张报价单的 `due_on`
     是**有效期**不是付款日（20260903010000），拿它当逾期
     会把每一张过期的报价单都变成一笔欠款。
     ⚠️ 进货单整个不算 —— 那是我欠人家，不是人家欠我。 */
  due_by_now as (
    select t.record_id,
           sum(
             case
               when t.portion is not null
                 then floor(coalesce(r.amount_cents, 0) * t.portion / 100)
               else coalesce(t.amount_cents, 0)
             end
           )::bigint as should_have,
           min(t.due_on) as oldest
    from public.record_terms t
    join public.pipeline_records r on r.id = t.record_id
    where t.project_id = in_project_id
      and t.due_on is not null
      and t.due_on <= today
    group by t.record_id
  ),
  overdue as (
    select 'payment_overdue'::text as kind, r.id as subject_id, r.id as record_id,
           coalesce(r.party, '') as party, coalesce(r.title, '') as title,
           coalesce(d.oldest, r.due_on) as due_on,
           /* 讲**还差多少**，不是整张单多少 —— 他要打那通电话讲的就是这个数字。 */
           greatest(
             coalesce(d.should_have, coalesce(r.amount_cents, 0))
               - coalesce(t2.got, 0)
               - coalesce(c2.given, 0),
             0
           )::bigint as amount_cents,
           null::numeric as qty_left, null::numeric as qty_floor
    from public.pipeline_records r
    left join due_by_now d on d.record_id = r.id
    left join taken t2 on t2.record_id = r.id
    left join (
      select x.record_id, sum(x.credit_cents) as given
      from public.returns x where x.project_id = in_project_id
      group by x.record_id
    ) c2 on c2.record_id = r.id
    where money
      and r.project_id = in_project_id
      and r.archived_at is null
      and r.module_key <> 'purchases'
      and coalesce(r.amount_cents, 0) > 0
      and (
        d.record_id is not null
        or (r.module_key <> 'quotations' and r.due_on is not null and r.due_on < today)
      )
      and coalesce(d.should_have, coalesce(r.amount_cents, 0))
          - coalesce(t2.got, 0) - coalesce(c2.given, 0) > 0
  ),

  /* ⑧ 借出去的东西该还了。**`works_here`** —— 去把东西要回来的是柜台。 */
  rental_overdue as (
    select 'rental_overdue'::text, n.id, n.record_id,
           coalesce(r.party, ''), coalesce(n.descr, ''),
           n.due_back_on, null::bigint,
           n.qty::numeric, null::numeric
    from public.rentals n
    join public.pipeline_records r on r.id = n.record_id
    where n.project_id = in_project_id
      and n.returned_on is null
      and n.due_back_on is not null
      and n.due_back_on < today
  ),

  /* ⑨ 答应了的介绍费还没给。**钱那一边。**
     它照 `referrals_owing` 算 —— 不自己再算一次，不然同一个问题两个答案。 */
  referral_owing as (
    select 'referral_owing'::text, f.referrer_id, null::uuid,
           coalesce(f.name, ''), ''::text,
           null::date, f.owing_cents,
           null::numeric, null::numeric
    from public.referrals_owing(in_project_id) f
    where money and f.owing_cents > 0
  ),

  /* ⑩ 🔴 经销商自己提交了一笔，而他还没处理。
     那份报告的第⑩条链写着「他**收到**有人提交了 —— 没有通知」。

     ⚠️ **不用加一栏「看过没有」** —— `status = 'open'`
     本来就是那个意思（一按变单就变 'done'）。
     多一栏就是同一件事两个答案。

     `works_here` —— 接一笔经销商要货是柜台的工作；
     金额那一栏照旧按身分挡。 */
  request_open as (
    select 'request_open'::text, q.id, q.record_id,
           coalesce(d.name, ''), coalesce(q.what, ''),
           q.created_at::date, coalesce(q.amount_cents, 0)::bigint,
           q.qty::numeric, null::numeric
    from public.party_requests q
    join public.directory_entries d on d.id = q.party_id
    where q.project_id = in_project_id
      and q.status = 'open'
  ),

  /* ⑫ 🔴 这个学生连着两堂没来。
     `walk:tuition`（任务 239）的收尾写着：
     十个讯号没有一个认得一间补习中心。

     🔴 **只数老师真的点过名的那几堂** ——
     「还没点名」是空的，不是「没来」（[任务 223](#223)
     立过那一条）。拿没点名的堂数当缺席，
     会在他放假一星期之后把每一个学生都报成要退学。

     ⚠️ **两堂不是我发明的天数** ——
     它数的是「最近那两堂」，不是「三十天内」。
     一间一星期一堂的补习班跟一间天天上课的，
     那两堂中间隔多久是他自己的课表决定的。

     `works_here` —— 要打那通电话给家长的就是前台，
     而这一条里面一分钱都没有。 */
  registered as (
    /* 真的点过名的那几堂，每一班自己排，新的在前。 */
    select a.group_id, p.appointment_id, p.starts_at,
           row_number() over (partition by a.group_id order by p.starts_at desc) as nth
    from (
      select distinct t.appointment_id
      from public.class_attendance t
      where t.project_id = in_project_id
    ) p
    join public.appointments a on a.id = p.appointment_id
    where a.project_id = in_project_id
      and a.group_id is not null
      and a.starts_at < now()
  ),
  absent_twice as (
    select 'absent_twice'::text, m.id, null::uuid,
           coalesce(d.name, ''), coalesce(g.name, ''),
           (max(r.starts_at) at time zone 'Asia/Kuala_Lumpur')::date,
           null::bigint,
           count(*)::numeric, null::numeric
    from public.class_members m
    join public.class_groups g on g.id = m.group_id
    join public.directory_entries d on d.id = m.party_id
    join registered r on r.group_id = m.group_id and r.nth <= 2
    join public.class_attendance t
      on t.appointment_id = r.appointment_id and t.party_id = m.party_id
    where m.project_id = in_project_id
      and m.left_on is null
      and g.archived_at is null
      and t.status = 'no_show'
    group by m.id, d.name, g.name
    /* 两堂都没来才算 —— 一堂没来是生病。 */
    having count(*) >= 2
  ),

  all_of as (
    select * from quote_expiring
    union all select * from agreed_unpaid
    union all select * from contract_due
    union all select * from package_last
    union all select * from below_reorder
    union all select * from booking_unseen
    union all select * from overdue
    union all select * from rental_overdue
    union all select * from referral_owing
    union all select * from request_open
    union all select * from absent_twice
  )
  select a.kind, a.subject_id, a.record_id, a.party, a.title, a.due_on,
         /* 逾期是算出来的。没有日子的（补货线 · 套票）没有逾期这回事。 */
         case when a.due_on is not null
              then greatest((today - a.due_on), 0)::integer end,
         case when money then a.amount_cents end,
         a.qty_left, a.qty_floor,
         /* 同一件事（同一种讯号 · 同一个东西）最近一次发出去的那一句。
            只算**真的发出去的**（sent）—— 排在那里等的、
            发不出去的、取消的都不算，不然它会告诉他
            一件没有发生过的事。 */
         (select max((m.sent_at at time zone 'Asia/Kuala_Lumpur')::date)
            from public.messages m
           where m.project_id = in_project_id
             and m.kind = a.kind
             and m.subject_id = a.subject_id
             and m.status = 'sent')
  from all_of a
  where not exists (
    select 1 from hushed s where s.kind = a.kind and s.subject_id = a.subject_id
  )
  /* 逾期的排最前面 —— 他打开那一秒要看的不是「有五件事」，
     是「有一件上个礼拜就该做而你没做」。 */
  order by a.due_on nulls last, a.kind;
end;
$fn$;

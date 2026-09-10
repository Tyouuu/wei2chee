-- 放回去——原样从 20260910600000 抽出来，不是重打。看过 20260910610000 红过。

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
  last_told_on date,
  /* 讲给谁听 —— 只有两种人，因为整个产品只有两种人。
     `messages.audience` 那一栏的两个值，一字不差。 */
  audience text,
  /* 讲给哪一个人。**null = 那一件事没有连到名册上的人**，
     所以发不出去 —— 画面上要讲得出来，不可以假装发得了。 */
  party_id uuid,
  /* 🔴 这一件事该怎么讲 —— **一句写好的话，不是一个代号**。
     `messages.body` 是 not null，所以每一个发讯息的地方都要给一句；
     写在画面那一边，就是十一句话散在十一个地方，
     而送去审核的模板跟真的发出去的那一句会分家。 */
  body text
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
  zh boolean;
  shop text;
begin
  if not public.works_here(in_project_id) then
    return;
  end if;
  today := public.today_myt();
  cutoff := coalesce(in_until, today + 3);
  money := public.sees_money(in_project_id);

  /* 那一句话讲哪一种话，跟**这门生意自己的语言**走，不是跟他的介面走 ——
     收到那一句的是他的客人（重点 13）。 */
  select coalesce(p.system_language, 'en') = 'zh',
         coalesce(nullif(btrim(p.business_name), ''), '')
    into zh, shop
  from public.projects p where p.id = in_project_id;

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
           , r.party_id as party_id
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
           , r.party_id as party_id
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
           , v.party_id as party_id
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
           , b.party_id as party_id
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
           , null::uuid as party_id
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
           , b.party_id as party_id
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
           , r.party_id as party_id
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
           , r.party_id as party_id
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
           , f.referrer_id as party_id
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
           , q.party_id as party_id
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
    select a.group_id, p.appointment_id, a.starts_at,
           row_number() over (partition by a.group_id order by a.starts_at desc) as nth
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
           , m.party_id as party_id
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

  /* ⑬ 🔴 这个客人不来了。
     两个条件都来自他自己的历史 —— 上面档头写着为什么少一个都不行。

     🔴 **呼叫 `party_visits`，不在这里再算一次**（任务 216 的陷阱）。
     那一支自己会 `works_here`，而这里已经过了同一道，所以不会多挡。

     `due_on` 是**照他自己的节奏他该来的那一天**（上一次 ＋ 他平常隔的天数）——
     所以 `days_late` 读起来是「比他自己的节奏晚了几天」，
     而不是一个我发明的期限。逾期的排最前面，那一条自己就成立了。

     `qty_left` / `qty_floor` 借来放**来过几次 · 平常隔几天** ——
     画面上要讲得出「来过 8 次，平常隔 42 天」，
     不然它只是一句「他很久没来了」而没有人判得了那是不是真的。
     （`absent_twice` 借同两栏放缺席堂数，同一个做法。） */
  lapsed as (
    select 'party_lapsed'::text, pv.party_id, null::uuid,
           pv.name, ''::text,
           (pv.last_on + pv.usual_gap_days)::date,
           null::bigint,
           pv.visits::numeric, pv.usual_gap_days::numeric
           , pv.party_id as party_id
    from public.party_visits(in_project_id) pv
    where pv.module_key = 'customers'
      /* 少於三天就没有「平常」—— 那一支回 null，而 null 比不出任何东西，
         所以这一句同时挡掉了「没有节奏的人」。 */
      and pv.usual_gap_days is not null
      and pv.longest_gap_days is not null
      and pv.days_since > pv.usual_gap_days * 2
      and pv.days_since > pv.longest_gap_days
  ),

  /* ⑭ 🔴 接下来三天要来的这一个，同意书一张都还没签过。

     一间 medi spa 跟一间沙龙差的就是这一张纸 —— Aoikumo（马来西亚，
     我们真正的对手）把它放在**最高那一档**：
     `Electronic Forms & Documents（indemnity & consultation form）`。
     而这一件的形状本来就是一个讯号，不是一道墙：
     **挡住她开单，就是替她的诊所发明一条它没有的规矩**（[重点 31]：
     收紧最危险）；讲一句「明天那一个还没签」，她自己会处理。

     🔴 **没有写过范本的生意，这一条整条不存在** —— 一个装修承包商
     的预约上永远不该冒出「同意书没签」。那不是他漏了，是他这一行不签纸。

     ⚠️ **它答的是「一张都没签过」，不是「这一次要签哪一张」。**
     一个签过肉毒同意书的客人来做镭射，这一条不会讲话 ——
     要讲得出那一句，预约上得先知道自己是哪一种疗程，
     而今天预约上只有一行她自己打的字（`service`）。
     **写出来，不要等他发现**（[重点 30] 第 4 步）。 */
  consent_unsigned as (
    select 'consent_unsigned'::text, a.id, null::uuid,
           coalesce(nullif(btrim(d.name), ''), a.party), coalesce(a.service, ''),
           (a.starts_at at time zone 'Asia/Kuala_Lumpur')::date,
           null::bigint, null::numeric, null::numeric
           , a.party_id as party_id
    from public.appointments a
    join public.directory_entries d on d.id = a.party_id
    where a.project_id = in_project_id
      and a.archived_at is null
      and a.kind = 'booking'
      /* 四个值里只有这一个还没发生。做完的 · 没来的 · 取消的都过去了。 */
      and a.status = 'booked'
      and (a.starts_at at time zone 'Asia/Kuala_Lumpur')::date
          between today and cutoff
      and exists (
        select 1 from public.consent_forms f
        where f.project_id = in_project_id and f.archived_at is null
      )
      and not exists (
        select 1 from public.consent_signatures s
        where s.project_id = in_project_id
          and s.party_id = a.party_id
          and s.signed_at is not null
      )
  ),

  /* ⑮ 师傅的执照快到期，或者已经过期了。
     毒药法令 1952 第 19 条只有注册医生可以施用 B 类毒药（肉毒是其中一种），
     MMC 的美容医学指引把责任压在那个医生身上。
     行医执照（LCP）三年一次、执业执照（APC）一年一次，两个都会过期。

     🔴 讯号，不是墙——跟 20260909210000 同一条理由：一间诊所自己知道谁能
     接什么，软件的工作是不让日期被忘记，不是在前台按下去那一刻拦住她。
     ⚠️ 也没有把它绑到某一次预约或疗程上——service/what 都是她自己打的字，
     没有一条可靠的路径把一个自由文字对上一张执照要不要看。绑得住的地方是
     treatment_products.item_id，而那是另一件要不要做的事，这一支先把「快过期」这句话讲出来。 */
  credential_expiring as (
    select 'credential_expiring'::text, s.id, null::uuid,
           coalesce(s.name, ''), coalesce(nullif(s.credential, ''), ''),
           s.credential_expires_on, null::bigint, null::numeric, null::numeric
           , s.id as party_id
    from public.directory_entries s
    where s.project_id = in_project_id
      and s.module_key = 'staff'
      and s.archived_at is null
      and s.credential_expires_on is not null
      and s.credential_expires_on <= cutoff
  ),

  /* ⑯ 皮肤测试过了六个月，而她接下来要来。
     Fresha 自己那句：皮肤测试六个月有效，而且**只警告不挡**——
     只有 Zenoti 跟 Phorest 会挡（而且挡的是前置服务/皮肤测试），其余都是一面红旗，要人自己看。

     🔴 不去猜哪一张预约需要皮肤测试（同样的 service 自由文字问题，任务 341 量过一次）——
     只要她自己的皮肤测试过期了，而且接下来真的有一笔预约，就值得提醒一句——
     哪一项服务需要它，是柜台自己知道的事。 */
  patch_test_stale as (
    select 'patch_test_stale'::text, d.id, null::uuid,
           coalesce(d.name, ''), '',
           min((a.starts_at at time zone 'Asia/Kuala_Lumpur')::date),
           null::bigint, null::numeric, null::numeric
           , d.id as party_id
    from public.directory_entries d
    join public.appointments a on a.party_id = d.id
    where d.project_id = in_project_id
      and d.module_key = 'customers'
      and d.archived_at is null
      and d.patch_test_on is not null
      and d.patch_test_on <= (today - interval '6 months')::date
      and a.project_id = in_project_id
      and a.archived_at is null
      and a.kind = 'booking'
      and a.status = 'booked'
      and (a.starts_at at time zone 'Asia/Kuala_Lumpur')::date between today and cutoff
    group by d.id, d.name
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
    union all select * from lapsed
    union all select * from consent_unsigned
    union all select * from credential_expiring
    union all select * from patch_test_stale
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
             and m.status = 'sent'),
         /* ⑬ 讲给谁听。四件是他自己的事（架上快没货 · 官网来的预约 ·
            该给的介绍费 · 经销商在等），其余七件是要跟他客人讲的。 */
         case when a.kind in ('below_reorder', 'booking_unseen', 'referral_owing', 'request_open', 'consent_unsigned', 'credential_expiring', 'patch_test_stale')
              then 'owner' else 'customer' end,
         a.party_id,
         /* ⑭ 🔴 那一句话。
            ⚠️ **给客人的那几句带着这门生意的名字** —— 一个陌生号码
            传来「你好陈太太，你的报价…」，他的客人不知道那是谁。
            给他自己看的那四句不带（他知道自己是谁）。
            ⚠️ 钱只出现在两句里，而那两句的来源都要求金额大於零，
            所以永远不会印出一个 RM 0.00。 */
         left(
           case when a.kind in ('below_reorder', 'booking_unseen', 'referral_owing', 'request_open', 'consent_unsigned', 'credential_expiring', 'patch_test_stale') then ''
                when shop = '' then ''
                else shop || case when zh then '：' else ': ' end
           end
           ||
           case when zh then
            case a.kind
              when 'quote_expiring' then case when a.due_on < today then '你好' || a.party || '，' || a.title || ' 这张报价 ' || to_char(a.due_on, 'DD/MM/YYYY') || ' 就过期了。还要的话跟我讲一声，我重新报一份给你。' else '你好' || a.party || '，' || a.title || ' 这张报价到 ' || to_char(a.due_on, 'DD/MM/YYYY') || ' 就到期了。还要的话跟我讲一声。' end
              when 'agreed_unpaid' then '你好' || a.party || '，谢谢你确认 ' || a.title || '。订金收到我们就可以排期开工了。'
              when 'contract_due' then '你好' || a.party || '，' || a.title || ' 的保养到期了（' || to_char(a.due_on, 'DD/MM/YYYY') || '）。几时方便过去？'
              when 'package_last' then '你好' || a.party || '，你的 ' || a.title || ' 还剩最后一次。要不要先续？'
              when 'payment_overdue' then '你好' || a.party || '，' || a.title || ' 还有 RM ' || to_char(a.amount_cents / 100.0, 'FM999,999,990.00') || ' 未付，' || to_char(a.due_on, 'DD/MM/YYYY') || ' 到期。麻烦你安排一下。'
              when 'rental_overdue' then '你好' || a.party || '，' || a.title || ' 原本 ' || to_char(a.due_on, 'DD/MM/YYYY') || ' 要还。麻烦你安排一下。'
              when 'absent_twice' then '你好，' || a.party || ' 最近两堂 ' || a.title || ' 都没有来。想跟你了解一下。'
              /* 🔴 一句平的话 —— 没有折扣、没有优惠、也不写「你 X 号就该来了」。
                 前者是替他做一个他没有做过的生意决定；后者对一个客人来说很怪。 */
              when 'party_lapsed' then '你好' || a.party || '，好久不见。有需要的话随时跟我讲一声。'
              when 'below_reorder' then a.title || ' 只剩 ' || rtrim(trim(to_char(a.qty_left, 'FM999,999,990.99')), '.') || '，补货线是 ' || rtrim(trim(to_char(a.qty_floor, 'FM999,999,990.99')), '.') || '。'
              when 'booking_unseen' then '官网来了一个预约：' || a.party || ' · ' || a.title || ' · ' || to_char(a.due_on, 'DD/MM/YYYY') || '，还没看过。'
              when 'referral_owing' then '答应给 ' || a.party || ' 的介绍费 RM ' || to_char(a.amount_cents / 100.0, 'FM999,999,990.00') || ' 还没给。'
              when 'request_open' then a.party || ' 提交了一笔要货：' || a.title || '，还没处理。'
              /* 🔴 这一句**给他自己看**，不给客人 —— 发给客人那一句
                 要带着那条签名的连结，而这一支不产生网址
                 （`/c/<ref>` 住在 `consents_of` 那一边）。
                 发一句「请签同意书」而没有连结，
                 是叫她的客人自己去找一样找不到的东西。 */
              when 'consent_unsigned' then a.party || ' ' || to_char(a.due_on, 'DD/MM/YYYY') || ' 要来' || case when coalesce(a.title, '') <> '' then '（' || a.title || '）' else '' end || '，而同意书还没签。'
              when 'credential_expiring' then a.party || ' 的 ' || a.title || case when a.due_on < today then ' 已经在 ' || to_char(a.due_on, 'DD/MM/YYYY') || ' 过期，要留意她还能不能接那些需要执照的疗程。' else ' 将在 ' || to_char(a.due_on, 'DD/MM/YYYY') || ' 到期。' end
              when 'patch_test_stale' then a.party || ' 的皮肤测试超过六个月了，而她 ' || to_char(a.due_on, 'DD/MM/YYYY') || ' 有一笔预约——要不要先重新测一次？'
            end
           else
            case a.kind
              when 'quote_expiring' then case when a.due_on < today then 'Hi ' || a.party || ', your quote for ' || a.title || ' expired on ' || to_char(a.due_on, 'DD/MM/YYYY') || '. Let me know if you still want it and I will send a fresh one.' else 'Hi ' || a.party || ', your quote for ' || a.title || ' is valid until ' || to_char(a.due_on, 'DD/MM/YYYY') || '. Let me know if you would like to go ahead.' end
              when 'agreed_unpaid' then 'Hi ' || a.party || ', thank you for confirming ' || a.title || '. We can schedule the work once the deposit is in.'
              when 'contract_due' then 'Hi ' || a.party || ', the service for ' || a.title || ' is due (' || to_char(a.due_on, 'DD/MM/YYYY') || '). When would be a good time to come over?'
              when 'package_last' then 'Hi ' || a.party || ', your ' || a.title || ' has one session left. Would you like to top it up?'
              when 'payment_overdue' then 'Hi ' || a.party || ', ' || a.title || ' still has RM ' || to_char(a.amount_cents / 100.0, 'FM999,999,990.00') || ' outstanding, due ' || to_char(a.due_on, 'DD/MM/YYYY') || '. Could you arrange it?'
              when 'rental_overdue' then 'Hi ' || a.party || ', ' || a.title || ' was due back on ' || to_char(a.due_on, 'DD/MM/YYYY') || '. Could you arrange to return it?'
              when 'absent_twice' then 'Hi, ' || a.party || ' has missed the last two ' || a.title || ' lessons. We would like to check in with you.'
              when 'party_lapsed' then 'Hi ' || a.party || ', it has been a while since we last saw you. Just let us know whenever you need us.'
              when 'below_reorder' then a.title || ' is down to ' || rtrim(trim(to_char(a.qty_left, 'FM999,999,990.99')), '.') || ', reorder level ' || rtrim(trim(to_char(a.qty_floor, 'FM999,999,990.99')), '.') || '.'
              when 'booking_unseen' then 'A booking came in from the website: ' || a.party || ' - ' || a.title || ' - ' || to_char(a.due_on, 'DD/MM/YYYY') || '. Not looked at yet.'
              when 'referral_owing' then 'Referral fee of RM ' || to_char(a.amount_cents / 100.0, 'FM999,999,990.00') || ' promised to ' || a.party || ' has not been paid.'
              when 'request_open' then a.party || ' submitted a request: ' || a.title || '. Not handled yet.'
              when 'consent_unsigned' then a.party || ' is booked on ' || to_char(a.due_on, 'DD/MM/YYYY') || case when coalesce(a.title, '') <> '' then ' for ' || a.title else '' end || ', and has not signed a consent form yet.'
              when 'credential_expiring' then a.party || '''s ' || a.title || case when a.due_on < today then ' expired on ' || to_char(a.due_on, 'DD/MM/YYYY') || ' -- worth checking whether she can still take on treatments that need it.' else ' expires on ' || to_char(a.due_on, 'DD/MM/YYYY') || '.' end
              when 'patch_test_stale' then a.party || '''s patch test is over six months old, and she has a booking on ' || to_char(a.due_on, 'DD/MM/YYYY') || ' -- worth redoing it first?'
            end
           end
         , 900)
  from all_of a
  where not exists (
    select 1 from hushed s where s.kind = a.kind and s.subject_id = a.subject_id
  )
  /* 逾期的排最前面 —— 他打开那一秒要看的不是「有五件事」，
     是「有一件上个礼拜就该做而你没做」。 */
  order by a.due_on nulls last, a.kind;
end;
$fn$;

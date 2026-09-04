-- 客人自己在官网上订一个时段。
--
-- ── 🔴 陌生人今天能做的只有两件事 ────────────────────────────────────────
--
-- 我数了资料库里 grant 给 `anon` 的函式，**一共两支**：
--
--   get_public_site       打开那一页看
--   submit_site_enquiry   留一句话
--
-- 就这两件。[任务 96] 8-31 写下来的那一句到今天还是真的：
-- **「里面 18 个模块，外面 1 个动作」。**
--
-- 而那一段正好是这条线唯一缺的一节：
--
--   官网 → **客人自己订** → 系统里出现 → 一按变单 → 付款连结
--        → 钱进来自动记帐（20260905020000）→ 架上自动扣（20260905050000）
--
-- 后面三节这两天做完了。这一支是第一节。
--
-- ── 桌子早就在等这一件 ────────────────────────────────────────────────────
--
-- `appointments`（20260902030000）建的时候就留好了两栏，注解写得很清楚：
--
--   source text ... check (source in ('staff', 'website'))
--   public_ref uuid ... 「官网 booking is the next piece --
--                        but it is issued from the first」
--
-- 而**不准撞时段**那条规矩是一条 exclusion constraint，不是程式里的
-- 先查再写 —— 那正是为这一天准备的：**一个订位页就是两个人同时按的地方**，
-- 他们看着同一个星期六早上仅剩的三个空档。
--
-- ── 🔴 陌生人看得到什么，看不到什么 ──────────────────────────────────────
--
-- `public_booking_slots` 只回**几点到几点被占着**。没有名字、没有服务、
-- 没有 id、没有师傅。一个订位页本来就要显示这个，而多一个字都不给：
-- 一张写着「10:00 陈太太 染发」的公开页面，是把他客人的行踪贴到网上。
--
-- ⚠️ **老实讲它泄漏什么**：一个陌生人看得出这家店有多忙。
-- 每一个订位页都是这样，而这是给得起的代价 —— 不给，客人就订不了。
--
-- ── 三件故意不做 ──────────────────────────────────────────────────────────
--
--   ❌ **不开一个「要不要接网上预约」的开关。** 有预约那一页、官网又上线了，
--      就接得了 —— 询价表格就是这样。一个要先去设定的功能，
--      在「一进来就很方便」这条承诺下等於没有做
--   ❌ **不建客户档案。** [任务 89] 学过：靠名字认人会把钱记到另一个人头上。
--      名字先当字存着，老板动手的时候才认人
--   ❌ **不做营业时间。** 20260902030000 的档头已经判过：
--      「a page that opens on a working-hours form has already broken it」

-- ── 哪几个时段被占着 ──────────────────────────────────────────────────────
create or replace function public.public_booking_slots(
  site_slug text,
  on_day date
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  select p.id into target
  from public.projects p
  where p.site_slug = site_slug and p.site_published = true;

  /* 跟 submit_site_enquiry 同一句：网址不存在跟网站没上线，
     回**一样的东西**。告诉一个陌生人「这个站存在但还没上线」，
     就是在讲别人生意的事。 */
  if target is null then
    return;
  end if;

  /* 只给一天，而且只给近的。让人一次问一整年，
     等於把这家店一整年的行程摊出去。 */
  if on_day is null
     or on_day < public.today_myt() - 1
     or on_day > public.today_myt() + 90 then
    return;
  end if;

  return query
  select a.starts_at, a.ends_at
  from public.appointments a
  where a.project_id = target
    and a.archived_at is null
    /* 取消掉的不占位 —— 那个时段是空的，而画面上要看得出来是空的。 */
    and a.status <> 'cancelled'
    /* 🔴 `kind` 两种都要：休息跟午餐也占着时间。
       只回 booking 会让人订到老板的午休 ——
       而那正是 easyappointments 把两种放同一张表的理由。 */
    and (a.starts_at at time zone 'Asia/Kuala_Lumpur')::date = on_day
  order by a.starts_at;
end;
$$;

revoke execute on function public.public_booking_slots(text, date) from public;
grant execute on function public.public_booking_slots(text, date) to anon, authenticated;

comment on function public.public_booking_slots(text, date) is
  'Busy intervals on one day of one published site. Times only -- never a name, a service or an id. See 20260905120000.';

-- ── 陌生人订一个时段 ──────────────────────────────────────────────────────
--
-- ⚠️ 回一个**字**不是抛例外，跟 `submit_site_enquiry` 一样：
-- 这一支的呼叫者是一个站在别人官网上的人，而一句资料库的错误讯息
-- 对他没有意义，对我们还多泄漏一点东西。
create or replace function public.submit_site_booking(
  site_slug text,
  visitor_name text,
  visitor_contact text,
  wants_from timestamptz,
  wants_to timestamptz,
  wants_service text default '',
  visitor_note text default ''
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  page_key text;
  recent int;
  fresh uuid;
begin
  if coalesce(btrim(visitor_name), '') = '' or coalesce(btrim(visitor_contact), '') = '' then
    return 'incomplete';
  end if;

  /* 上限写在这一支里面，不是写在 API 那一层 ——
     这一支就是那扇门，而一个只挡在门的一边的上限不是上限。 */
  if length(visitor_name) > 120 or length(visitor_contact) > 120
     or length(coalesce(wants_service, '')) > 120
     or length(coalesce(visitor_note, '')) > 1000 then
    return 'too_long';
  end if;

  if wants_from is null or wants_to is null or wants_to <= wants_from then
    return 'bad_time';
  end if;

  /* 一段合理的长度。八小时以上的「预约」不是预约，是有人在乱按。 */
  if wants_to - wants_from > interval '8 hours' then
    return 'bad_time';
  end if;

  /* 过去订不了，太远也订不了 —— 跟看空档那一支同一个窗口。 */
  if wants_from < now() then
    return 'past';
  end if;
  if wants_from > now() + interval '90 days' then
    return 'too_far';
  end if;

  select p.id into target
  from public.projects p
  where p.site_slug = site_slug and p.site_published = true;
  if target is null then
    return 'not_found';
  end if;

  /* 这一家有没有一页在收预约。**没有就不是「坏了」，是这家不接预约** ——
     一个装修承包商的官网上不该有订时段。 */
  select pp.page_key into page_key
  from public.project_pages pp
  where pp.project_id = target and public.is_calendar_module(pp.page_key)
  order by pp.sort_order nulls last
  limit 1;
  if page_key is null then
    return 'not_found';
  end if;

  /* 洗版。跟询价同一条：**按 project 数，不记 IP** ——
     记一个陌生人的 IP 是为了挡洗版而收集他的行踪。 */
  select count(*) into recent
  from public.appointments a
  where a.project_id = target
    and a.source = 'website'
    and a.created_at > now() - interval '1 minute';
  if recent >= 5 then
    return 'too_many';
  end if;

  fresh := gen_random_uuid();

  begin
    insert into public.appointments (
      project_id, module_key, kind, starts_at, ends_at,
      party, service, status, source, public_ref, note, extra
    ) values (
      target,
      page_key,
      'booking',
      wants_from,
      wants_to,
      left(btrim(visitor_name), 200),
      left(btrim(coalesce(wants_service, '')), 120),
      'booked',
      'website',
      fresh,
      left(btrim(coalesce(visitor_note, '')), 1000),
      /* 🔴 联络方式放 `extra`，而那一栏**画面上看得到**
         （`live-rows.ts` 的 `extraCells`）。收一个看不回来的输入
         就是吞掉他打的字（[任务 81] 立过这一条）。 */
      jsonb_build_object('contact', left(btrim(visitor_contact), 120))
    );
  exception
    /* 🔴 撞了。**这是常态不是错误** —— 两个人看着同一个星期六早上
       仅剩的三个空档，同时按下去。那条 exclusion constraint 拒绝第二个，
       而他要读到的是「这个时段刚被订走了」，不是一句资料库的话。 */
    when exclusion_violation then
      return 'taken';
    when unique_violation then
      return 'taken';
  end;

  /* 那一串是他以后要改或者取消这一次预约用的 ——
     叫一个人为了取消剪发去注册一个帐号，正是 no-show 的来源
     （20260902030000 从 easyappointments 抄的那一条）。 */
  return 'ok:' || fresh::text;
end;
$$;

revoke execute on function public.submit_site_booking(
  text, text, text, timestamptz, timestamptz, text, text
) from public;
grant execute on function public.submit_site_booking(
  text, text, text, timestamptz, timestamptz, text, text
) to anon, authenticated;

comment on function public.submit_site_booking(text, text, text, timestamptz, timestamptz, text, text) is
  'A stranger books a slot from a published site. Returns a word, never an exception -- the caller is a member of the public. A clash returns 「taken」 because two people pressing at once is the normal case on a booking page. See 20260905120000.';

-- 每个行业三套风格，客户自己换
--
-- 老板 2026-08-27：`所以我才说做每个行业三套风格 客户也可以去更换到最适合自己的
-- 风格设计`。
--
-- 20260826080000 gave each trade exactly ONE register, and that was the right
-- fix for the problem it had: eight trades reached eight of fourteen registers
-- and six were unreachable. But one recommendation is not a choice. An owner
-- who does not like what he is handed has no second thing to look at, and the
-- gallery is not an answer -- nobody browses fourteen pages before they have
-- decided they want a website at all.
--
-- Three is the number the market uses. Wix, Webflow and Squarespace all open a
-- category on a small hand rather than on one card or on everything.
--
-- ── HOW THE THREE WERE CHOSEN ───────────────────────────────────────────────
--
-- First is the same recommendation as before -- the register whose thesis IS
-- that trade. Second and third are the two nearest ARGUMENTS, not the two
-- nearest colours: a salon owner who does not want the photo wall is choosing
-- between 「the ordinary answer」 and 「the shop sign」, and both are real
-- alternatives for a salon. A register nobody would sensibly pick for a trade
-- is not in that trade's hand.
--
-- Stored as an ordered array; the first element stays the default so nothing
-- about provisioning changes. `style_recommendation` is left in place and in
-- sync for any caller that has not moved yet.

alter table public.industries
  add column if not exists style_choices text[];

-- Every entry must be a register that exists. is_known_register is the one
-- list, in one place -- see 20260827070000.
create or replace function public.industries_choices_are_known()
returns trigger
language plpgsql
as $$
declare
  s text;
begin
  if new.style_choices is null then
    return new;
  end if;
  if array_length(new.style_choices, 1) is null or array_length(new.style_choices, 1) < 1 then
    raise exception 'style_choices must name at least one register';
  end if;
  foreach s in array new.style_choices loop
    if not public.is_known_register(s) then
      raise exception 'invalid register in style_choices: %', s;
    end if;
  end loop;
  -- The first choice IS the recommendation; keeping them in one place is what
  -- stopped `industries` going three days stale in August.
  new.style_recommendation := new.style_choices[1];
  return new;
end;
$$;

drop trigger if exists industries_choices_are_known on public.industries;
create trigger industries_choices_are_known
  before insert or update on public.industries
  for each row execute function public.industries_choices_are_known();

-- ── 八个行业，各三套 ────────────────────────────────────────────────────────
--
--   装修/承包商   台账 first: the page reads like a quotation, which is what
--                 this customer is actually asking for. Then 满图 for the
--                 contractor whose portfolio is the pitch, then 图纸.
update public.industries set style_choices = array['ledger','hearth','blueprint'] where slug = 'renovation';

--   服务型公司   瑞士 first: a document. Then 图纸, then 台账 for the firm that
--                 quotes per job.
update public.industries set style_choices = array['swiss','blueprint','ledger'] where slug = 'services';

--   美容/沙龙    满图 first: the result is the sale. Then 招牌 for the shop on
--                 a street, then 图纸.
update public.industries set style_choices = array['hearth','signboard','blueprint'] where slug = 'beauty';

--   餐饮/F&B     满图 first: food is photographs. Then 招牌 -- a kopitiam IS a
--                 shopfront -- then 图纸.
update public.industries set style_choices = array['hearth','signboard','blueprint'] where slug = 'fnb';

--   零售/门店    招牌 first: colour read from the street. Then 满图, then 中台
--                 for the shop that is really a counter.
update public.industries set style_choices = array['signboard','hearth','counter'] where slug = 'retail';

--   批发/分销    中台 first: the counter screen. Then 台账 for terms and
--                 prices, then 图纸.
update public.industries set style_choices = array['counter','ledger','blueprint'] where slug = 'wholesale';

--   教育/补习    图纸 first: a nervous parent wants clarity. Then 柔和's old
--                 audience goes to 满图 (a classroom photographs well), then
--                 瑞士 for the centre that sells results.
update public.industries set style_choices = array['blueprint','hearth','swiss'] where slug = 'education';

--   其他         图纸 first, then the two that make the fewest assumptions.
update public.industries set style_choices = array['blueprint','ledger','hearth'] where slug = 'other';

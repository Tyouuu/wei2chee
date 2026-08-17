alter table reference_cases
  add column anonymous_name_zh text,
  add column anonymous_name_en text,
  add column highlights_zh jsonb,
  add column highlights_en jsonb;

update reference_cases set
  anonymous_name_zh = '一家 12 人装修公司',
  anonymous_name_en = 'A 12-person renovation company',
  highlights_zh = '["每月追款时间从 8 小时降到 1 小时","漏单从每月 2-3 单降到接近 0"]'::jsonb,
  highlights_en = '["Monthly payment follow-up time dropped from 8 hours to 1 hour","Missed orders dropped from 2-3/month to nearly zero"]'::jsonb
where anonymous_name = '一家 12 人装修公司';

update reference_cases set
  anonymous_name_zh = '行业典型场景',
  anonymous_name_en = 'Industry-typical scenario',
  highlights_zh = '["典型场景，非真实客户案例"]'::jsonb,
  highlights_en = '["Typical scenario, not a real client case"]'::jsonb
where anonymous_name = '行业典型场景';

alter table reference_cases
  alter column anonymous_name_zh set not null,
  alter column anonymous_name_en set not null,
  alter column highlights_zh set not null,
  alter column highlights_en set not null;

alter table reference_cases
  drop column anonymous_name,
  drop column highlights;

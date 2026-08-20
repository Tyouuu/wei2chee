insert into industries (slug, name_zh, name_en, has_verified_discovery, labels, default_workflow, suggested_modules, style_recommendation) values
('renovation', '装修/承包商', 'Renovation / Contractor', true,
  '{"customer":"客户","order":"项目","staff":"师傅"}',
  '["Customer","Quotation","Approval","Deposit","Project","Milestone","Final Payment"]',
  '["Customer","Quotation","Project","Payment"]', 'ledger'),
('retail', '零售/门店', 'Retail', true,
  '{"customer":"顾客","order":"订单","staff":"店员"}',
  '["Customer","Order","Payment"]',
  '["Customer","Quotation","Payment"]', 'blueprint'),
('beauty', '美容/沙龙', 'Beauty / Salon', true,
  '{"customer":"顾客","order":"预约","staff":"美容师"}',
  '["Customer","Booking","Service","Payment"]',
  '["Customer","Project","Payment"]', 'hearth'),
('wholesale', '批发/分销', 'Wholesale / Distribution', true,
  '{"customer":"客户","order":"订单","staff":"业务员"}',
  '["Customer","Quotation","Order","Payment"]',
  '["Customer","Quotation","Payment"]', 'ledger'),
('services', '服务型公司', 'Professional Services', true,
  '{"customer":"客户","order":"项目","staff":"顾问"}',
  '["Customer","Quotation","Project","Payment"]',
  '["Customer","Project","Payment"]', 'ledger'),
('fnb', '餐饮/F&B', 'F&B', false,
  '{"customer":"顾客","order":"订单","staff":"员工"}',
  '["Customer","Order","Payment"]',
  '["Customer","Payment"]', 'hearth'),
('education', '教育/补习', 'Education / Tuition', false,
  '{"customer":"家长","order":"报名","staff":"老师"}',
  '["Customer","Enrollment","Payment"]',
  '["Customer","Project","Payment"]', 'hearth'),
('other', '其他', 'Other', false,
  '{"customer":"客户","order":"订单","staff":"员工"}',
  '["Customer","Quotation","Project","Payment"]',
  '["Customer","Project","Payment"]', 'blueprint');

insert into reference_cases (industry_id, is_verified, anonymous_name_zh, anonymous_name_en, pain_points, modules, workflow, highlights_zh, highlights_en, source)
select id, true, '一家 12 人装修公司', 'A 12-person renovation company',
  '["Customer information scattered across WhatsApp and Excel","Project updates depend on WhatsApp","Payment follow-up is manual"]',
  '["Customer Management","Quotation System","Project Management","Site Update","Payment Tracking","AI Assistant"]',
  '["Customer","Quotation","Approval","Deposit","Project","Milestone","Final Payment"]',
  '["每月追款时间从 8 小时降到 1 小时","漏单从每月 2-3 单降到接近 0"]',
  '["Monthly payment follow-up time dropped from 8 hours to 1 hour","Missed orders dropped from 2-3/month to nearly zero"]',
  'internal'
from industries where slug = 'renovation';

insert into reference_cases (industry_id, is_verified, anonymous_name_zh, anonymous_name_en, pain_points, modules, workflow, highlights_zh, highlights_en, source)
select id, false, '行业典型场景', 'Industry-typical scenario',
  '["订单靠纸本记录","高峰期漏单","没有会员复购数据"]',
  '["Customer Management","Order Tracking","Payment"]',
  '["Customer","Order","Payment"]',
  '["典型场景，非真实客户案例"]',
  '["Typical scenario, not a real client case"]',
  'inferred'
from industries where slug = 'fnb';

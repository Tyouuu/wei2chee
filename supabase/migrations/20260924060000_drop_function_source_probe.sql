-- 探针用完就丢（20260924010000 建的）。它回的是函式原始码，只有 service_role
-- 打得到，但没有理由让它在库里多待一天。跟 20260912110000 同一个做法。
drop function if exists public.probe_function_source(text);

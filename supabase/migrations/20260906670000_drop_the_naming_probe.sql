-- 把那支故意不照惯例的探针删掉。
--
-- 20260906660000 加了它之后，`check:naming` 当场红，而且指名道姓：
--     probe_bad_naming → p_thing wants_it
-- 那就是这一把尺要挡的东西：**一支还没有人呼叫的新函式，现在改是免费的。**
drop function if exists public.probe_bad_naming(uuid, boolean);

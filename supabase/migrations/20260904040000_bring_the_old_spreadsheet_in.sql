-- 把他本来那份 Excel 搬进来。
--
-- ── 为什么这一格是刚需 ────────────────────────────────────────────────────
--
-- [任务 113] 实查十二家同行的时候量到一句：**73% 的中小企业还在用试算表**，
-- 而那才是我们真正的对手。DualEntry 拿了 US$90M，头条就是「24 小时把你的
-- 旧系统搬完」。
--
-- 而我们今天给他的是一个**空的系统**：他六年的客户名单躺在 Excel 里，
-- 第一天打开我们的东西看到的是零行，然后他要一行一行打进去。
-- **那不是一个开始用的门槛，那是一个不用的理由。**
--
-- ── 读的是谁的表 ──────────────────────────────────────────────────────────
--
-- Frappe 的 `Data Import` doctype 原文（GitHub API）。18 栏，抄三样：
--
--   ✅ **`skipped_rows`** —— 一张「哪几行没进去、为什么」的清单。
--      **这是整支最重要的一件**：五百行里第 237 行日期打错，
--      要进去 499 行、然后告诉他第 237 行怎么了 ——
--      **不是整批失败，也不是默默跳过。**
--   ✅ `download_template` —— 给他一份表头就是他自己栏名的范本
--   ✅ 分隔符自动判断（Excel 复製出来是 tab，档案是逗号）
--
--   ❌ **`import_type: Update Existing` 不抄。** 用一份 CSV 去更新既有的
--      五百行，是把五百行静静盖掉的方法，而他到下个月才会发现。
--      **只进新的。** 要改哪一行，去那一行自己那一页改（而且会被记进
--      20260904020000 那本帐）。
--   ❌ Google Sheets 网址 · 寄不寄信 · 排队 —— 那是他们那个规模的东西
--
-- ── 🔴 走的是人按的那一支，不是 insert ───────────────────────────────────
--
-- [重点 23] AI 平权那一条讲的是「不准有 AI 专用的写入路径」，而它真正的
-- 意思更宽：**同一件事只能有一条路**。一支自己 insert 的批次汇入，
-- 会绕过单号、绕过对方连结、绕过防重复、绕过第一个阶段 ——
-- 而那四样全部住在 `add_pipeline_record` 里。
--
-- 所以这一支**在回圈里呼叫那三支本来就有的函式**。慢一点，
-- 而「快」从来不是这里的问题：五百行一次，一年一次。

create or replace function public.import_records(
  in_project_id uuid,
  in_module_key text,
  in_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  shape text;
  item jsonb;
  i integer := 0;
  ok_count integer := 0;
  failures jsonb := '[]'::jsonb;
  why text;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your project';
  end if;

  if jsonb_typeof(coalesce(in_rows, 'null'::jsonb)) <> 'array' then
    raise exception 'rows must be an array';
  end if;
  /* 五百行一批。浏览器那边分批送 —— 一次五千行的请求，
     在工地的 4G 上就是一次逾时，而他不知道进去了几行。 */
  if jsonb_array_length(in_rows) > 500 then
    raise exception 'that is more than 500 rows in one go';
  end if;

  shape := case
             when public.is_pipeline_module(in_module_key) then 'pipeline'
             when public.is_directory_module(in_module_key) then 'directory'
             when public.is_ledger_module(in_module_key) then 'ledger'
           end;
  if shape is null then
    raise exception 'nothing can be imported into %', in_module_key;
  end if;

  for item in select * from jsonb_array_elements(in_rows)
  loop
    i := i + 1;
    begin
      /* 🔴 呼叫的是人按那颗按钮走的同一支。见档头。
         ⚠️ **具名参数**，不是照顺序。我第一版照顺序写，三支里两支是错的：
         名册那一支把 `region` 摆在 `address` 前面（真实的顺序反过来），
         而钱那一支整串都对不上（它的第三个参数是 direction，不是金额）。
         照顺序写的呼叫，读起来跟对的一模一样，而它会把区域存进地址栏。 */
      if shape = 'pipeline' then
        perform public.add_pipeline_record(
          in_project_id := in_project_id,
          in_module_key := in_module_key,
          in_title := coalesce(item->>'title', ''),
          in_party := coalesce(item->>'party', ''),
          in_amount_cents := nullif(item->>'amount_cents', '')::bigint,
          in_stage := nullif(item->>'stage', ''),
          in_issued_on := nullif(item->>'issued_on', '')::date,
          in_due_on := nullif(item->>'due_on', '')::date,
          in_extra := coalesce(item->'extra', '{}'::jsonb),
          /* 每一行自己的钥匙，浏览器那边从那一批的钥匙加行号推出来 ——
             他按了两次「汇入」，第二次一行都不会重复。 */
          in_idempotency_key := nullif(item->>'idempotency_key', '')::uuid
        );
      elsif shape = 'directory' then
        perform public.add_directory_entry(
          in_project_id := in_project_id,
          in_module_key := in_module_key,
          in_name := coalesce(item->>'name', ''),
          in_kind := nullif(item->>'kind', ''),
          in_contact_person := coalesce(item->>'contact_person', ''),
          in_phone := coalesce(item->>'phone', ''),
          in_whatsapp := coalesce(item->>'whatsapp', ''),
          in_email := coalesce(item->>'email', ''),
          in_address := coalesce(item->>'address', ''),
          in_region := coalesce(item->>'region', ''),
          in_reg_no := coalesce(item->>'reg_no', ''),
          in_tax_id := coalesce(item->>'tax_id', ''),
          in_status := coalesce(item->>'status', ''),
          in_note := coalesce(item->>'note', ''),
          in_extra := coalesce(item->'extra', '{}'::jsonb),
          in_idempotency_key := nullif(item->>'idempotency_key', '')::uuid
        );
      else
        perform public.add_ledger_entry(
          in_project_id := in_project_id,
          in_module_key := in_module_key,
          in_direction := nullif(item->>'direction', ''),
          in_amount_cents := coalesce(nullif(item->>'amount_cents', '')::bigint, 0),
          in_party := coalesce(item->>'party', ''),
          in_entry_on := nullif(item->>'entry_on', '')::date,
          in_method := coalesce(item->>'method', ''),
          in_reference := coalesce(item->>'reference', ''),
          in_note := coalesce(item->>'note', ''),
          in_extra := coalesce(item->'extra', '{}'::jsonb),
          in_idempotency_key := nullif(item->>'idempotency_key', '')::uuid
        );
      end if;
      ok_count := ok_count + 1;
    exception
      when others then
        /* 🔴 一行坏掉，其余照进。这是抄 Frappe `skipped_rows` 的那一件，
           而且是整支最重要的一件。

           ⚠️ plpgsql 的 EXCEPTION 区块自己就是一个 savepoint，所以坏掉的
           那一行**只回滚它自己**。这一句要写下来，因为看起来像整支会一起倒。 */
        why := sqlerrm;
        failures := failures || jsonb_build_object('row', i, 'why', left(why, 300));
    end;
  end loop;

  return jsonb_build_object(
    'ok', ok_count,
    'failed', failures,
    'total', jsonb_array_length(in_rows)
  );
end;
$$;

revoke execute on function public.import_records(uuid, text, jsonb) from public, anon;
grant execute on function public.import_records(uuid, text, jsonb) to authenticated;

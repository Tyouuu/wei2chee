/**
 * 一个班十个学生，一次开十张学费单 —— 用真的登入身分打一次每一支。
 *
 * 🔴 这一支的靶只有一个：**他按第二下会怎样。**
 * 一间补习中心每个月开一次学费，而他在手机上按两下就是每个学生两张单 ——
 * 而那会让「谁还没交」全部错，那正是这一整支要答的那一句。
 * ② 那一段就是它。
 *
 * ⚠️ 而 ④ 那一段是这一支真正学到的东西：一个**中途插班**的学生
 * 照样拿得到他自己那一张 —— 而那不是我写的一段逻辑，是那把幂等钥匙
 * （班 · 月份 · 学生）自己给的。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaways, dropThrowawayOnExit } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const stamp = Date.now();
const bad = [];
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
};

const people = [];
async function person(tag) {
  const email = `fee-${tag}-${stamp}@formae.test`;
  const password = `Fee-${stamp}-x!`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`signIn(${tag}): ${e2.message}`);
  people.push(data.user.id);
  return { id: data.user.id, email, client };
}
dropThrowawayOnExit(admin, () => people);

/* 🔴 一句不看错误的写入，跟一句没有写过的写入，在报告里长得一模一样。 */
async function say(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
}
const refused = async (client, fn, args) => {
  const { error } = await client.rpc(fn, args);
  return error?.message ?? "";
};

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "ledger" });
  for (const k of ["bookings", "customers", "orders", "payments"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const teacher = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Miss Tan",
  });
  const kids = {};
  for (const n of ["Ah Meng", "Ah Hui", "Ah Seng", "Ah Lim"]) {
    kids[n] = await say(C, "add_directory_entry", {
      in_project_id: P, in_module_key: "customers", in_name: n,
    });
  }

  const grp = await say(C, "add_class_group", {
    in_project_id: P, in_module_key: "bookings",
    in_name: "中四数学 · 星期三 4pm", in_staff_id: teacher.id,
  });
  for (const n of Object.keys(kids)) {
    await say(C, "enrol_in_class", { in_group_id: grp.id, in_party_id: kids[n].id });
  }

  const period = new Date().toISOString().slice(0, 7);
  const bill = (extra = {}) =>
    say(C, "bill_class", {
      in_group_id: grp.id,
      in_module_key: "orders",
      in_amount_cents: 18000,
      in_title: "September fees",
      ...extra,
    });

  /* ── ① 一次开四张 ──────────────────────────────────────────── */
  console.log("\n① 一个班四个学生，按一次");
  const first = (await bill())[0];
  check("开了四张", first.made === 4, JSON.stringify(first));
  check("一张都不是上次开的", first.again === 0, String(first.again));
  check("一共 RM 720", Number(first.total_cents) === 72000, String(first.total_cents));
  check("月份跟着开单那一天走", first.period === period, first.period);

  const { data: rows1 } = await C
    .from("pipeline_records")
    .select("id, doc_no, party_id, amount_cents, title")
    .eq("project_id", P).eq("module_key", "orders");
  check("资料库里真的有四张", (rows1 ?? []).length === 4, String((rows1 ?? []).length));
  check(
    "四张四个单号",
    new Set((rows1 ?? []).map((r) => r.doc_no)).size === 4,
    JSON.stringify((rows1 ?? []).map((r) => r.doc_no)),
  );
  check(
    "🔴 每一张连到那个学生，不是一串字",
    (rows1 ?? []).every((r) => r.party_id) &&
      new Set((rows1 ?? []).map((r) => r.party_id)).size === 4,
    JSON.stringify((rows1 ?? []).map((r) => r.party_id)),
  );
  check(
    "抬头是他讲的那一句",
    (rows1 ?? []).every((r) => r.title === "September fees"),
    JSON.stringify((rows1 ?? []).map((r) => r.title)),
  );

  /* ── ② 🔴 他在手机上按两下 ─────────────────────────────────── */
  console.log("\n② 🔴 按第二下");
  const second = (await bill())[0];
  check("🔴 一张都不多开", second.made === 0, JSON.stringify(second));
  check("而且讲得出四张是上次开的", second.again === 4, String(second.again));
  const { count: after2 } = await C
    .from("pipeline_records")
    .select("id", { count: "exact", head: true })
    .eq("project_id", P).eq("module_key", "orders");
  check("资料库里还是四张", after2 === 4, String(after2));

  /* ── ③ 走了的学生 ─────────────────────────────────────────── */
  console.log("\n③ 一个学生走了");
  await say(C, "leave_class", { in_group_id: grp.id, in_party_id: kids["Ah Lim"].id });
  const third = (await bill())[0];
  check("🔴 走了的那个不再开单", third.made === 0 && third.again === 3, JSON.stringify(third));
  check("而且讲得出跳过一个", third.skipped === 1, String(third.skipped));
  const { data: roster } = await C.rpc("class_roster", { in_group_id: grp.id });
  check(
    "他照旧留在名册上（走了不删）",
    (roster ?? []).some((r) => r.party_id === kids["Ah Lim"].id),
    JSON.stringify((roster ?? []).map((r) => r.student ?? r.name)),
  );

  /* ── ④ 🔴 中途插班 ────────────────────────────────────────── */
  console.log("\n④ 🔴 十号插班的那一个");
  const late = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ah Boy",
  });
  await say(C, "enrol_in_class", { in_group_id: grp.id, in_party_id: late.id });
  const fourth = (await bill())[0];
  check("🔴 他拿到一张，别人一张都不多", fourth.made === 1, JSON.stringify(fourth));
  check("而前面三个还是上次那几张", fourth.again === 3, String(fourth.again));
  const { count: after4 } = await C
    .from("pipeline_records")
    .select("id", { count: "exact", head: true })
    .eq("project_id", P).eq("module_key", "orders");
  check("一共五张", after4 === 5, String(after4));

  /* ── ⑤ 谁还没交 ───────────────────────────────────────────── */
  console.log("\n⑤ 谁还没交");
  const due0 = await say(C, "class_fees_due", { in_group_id: grp.id });
  check("四个人在这个月的单上", (due0 ?? []).length === 4, String((due0 ?? []).length));
  check(
    "🔴 走了的那个不在里面",
    !(due0 ?? []).some((r) => r.party_id === kids["Ah Lim"].id),
    JSON.stringify((due0 ?? []).map((r) => r.student)),
  );
  check(
    "一个人欠 RM 180",
    (due0 ?? []).every((r) => Number(r.owed_cents) === 18000),
    JSON.stringify((due0 ?? []).map((r) => r.owed_cents)),
  );

  const oneJob = (rows1 ?? []).find((r) => r.party_id === kids["Ah Meng"].id);
  await say(C, "add_ledger_entry", {
    in_project_id: P,
    in_module_key: "payments",
    in_direction: "in",
    in_amount_cents: 10000,
    in_party: "Ah Meng",
    in_party_id: kids["Ah Meng"].id,
    in_against_id: oneJob.id,
  });
  const due1 = await say(C, "class_fees_due", { in_group_id: grp.id });
  const meng = (due1 ?? []).find((r) => r.party_id === kids["Ah Meng"].id);
  check("收了 RM 100，那一行写着收到 100", Number(meng?.paid_cents) === 10000, JSON.stringify(meng));
  check("还欠 RM 80", Number(meng?.owed_cents) === 8000, String(meng?.owed_cents));

  /* 🔴 同一个问题两个答案 —— 这一条是这一支最要紧的守卫。 */
  const debts = await say(C, "party_debts", { in_project_id: P });
  const mengDebt = (debts ?? []).find((d) => d.party_id === kids["Ah Meng"].id);
  check(
    "🔴 跟「谁欠我钱」给的是同一个数字",
    Number(mengDebt?.owed_cents ?? mengDebt?.owing_cents) === 8000,
    JSON.stringify(mengDebt),
  );

  /* ── ⑥ 补开上个月 ─────────────────────────────────────────── */
  console.log("\n⑥ 补开上个月");
  const back = (await bill({ in_period: "2026-01" }))[0];
  check("另一批单，不跟这个月的撞", back.made === 4, JSON.stringify(back));
  check("而且它讲得出是哪一个月", back.period === "2026-01", back.period);
  const janDue = await say(C, "class_fees_due", { in_group_id: grp.id, in_period: "2026-01" });
  check("那一个月自己一张清单", (janDue ?? []).length === 4, String((janDue ?? []).length));

  /* ── ⑦ 拒绝 ───────────────────────────────────────────────── */
  console.log("\n⑦ 拒绝");
  check(
    "没讲金额要挡下来",
    (await refused(C, "bill_class", {
      in_group_id: grp.id, in_module_key: "orders", in_amount_cents: null,
    })).includes("how much"),
    await refused(C, "bill_class", {
      in_group_id: grp.id, in_module_key: "orders", in_amount_cents: null,
    }),
  );
  check(
    "不是走单的那一页要挡下来",
    (await refused(C, "bill_class", {
      in_group_id: grp.id, in_module_key: "customers", in_amount_cents: 18000,
    })).includes("does not hold documents"),
  );
  await say(C, "update_class_group", { in_group_id: grp.id, in_archived: true });
  const shut = await refused(C, "bill_class", {
    in_group_id: grp.id, in_module_key: "orders", in_amount_cents: 18000,
  });
  check("收起来的班开不了单，而且讲得出出路", shut.includes("take it back out"), shut);
  await say(C, "update_class_group", { in_group_id: grp.id, in_archived: false });

  /* ── ⑨ 🔴 老师 ───────────────────────────────────────────────
     `class_fees_due` 第一版我写成 `works_here` —— 一个老师因此读得到
     每一个学生欠多少学费。20260909200000 收紧成 `sees_money`。

     ⚠️ 而**控制组不是装饰**（[任务 125] 的教训）：一句被挡下来的呼叫，
     跟一句参数写错的呼叫，回的都是一个错误。**老板用一模一样的呼叫
     读得到**，才让上面那一句「读不到」是「被挡下来」而不是「我问错了」。 */
  console.log("\n⑨ 🔴 老师");
  const teach = await person("teacher");
  await say(C, "add_project_member", { in_email: teach.email });

  const denied = await refused(teach.client, "class_fees_due", { in_group_id: grp.id });
  check(
    "🔴 老师读不到谁还没交学费",
    denied.includes("for the owner"),
    denied || "(它让他读到了)",
  );
  const ownerSees = await say(C, "class_fees_due", { in_group_id: grp.id });
  check(
    "⚠️ 而老板用一模一样的呼叫读得到（不然上面那一条量的是空气）",
    (ownerSees ?? []).length === 4,
    String((ownerSees ?? []).length),
  );

  /* 🔴 而开单那一支**故意不挡他** —— 它底下走的 `add_pipeline_record`
     就是 `works_here`（一个师傅在工地上开得了一张工单，而那张单上
     本来就有金额）。一个函式挡得比它底下那一支还严，
     就是在替资料库发明一条它没有的规矩。 */
  const bossOpen = await refused(teach.client, "bill_class", {
    in_group_id: grp.id, in_module_key: "orders", in_amount_cents: 18000,
    in_period: "2026-02",
  });
  check("而开单那一支不挡他（跟它底下那一支一致）", bossOpen === "", bossOpen);

  /* ── ⑪ 🔴 第二个孩子九折 ──────────────────────────────────────
     20260909270000。`bill_class` 一次开十张、十张同一个数字，
     而一间怡保的补习中心**第二个孩子九折**几乎是默认的。

     ⚠️ 用一个**没有开过单的月份**（2026-11），不然量到的是前面几节
     留下来的那几张。 */
  console.log("\n⑪ 🔴 第二个孩子九折");
  const nov = "2026-11";
  const before = await say(C, "class_fees_of", { in_group_id: grp.id });
  check("一开始四个人全部在班价上", (before ?? []).length === 4
    && (before ?? []).every((r) => r.on_class_price), JSON.stringify(before));

  await say(C, "set_class_fee", {
    in_group_id: grp.id, in_party_id: kids["Ah Hui"].id, in_amount_cents: 16200,
  });
  /* 🔴 0 不是 null —— 「这个月不收他的钱」是一句讲出来的话。 */
  await say(C, "set_class_fee", {
    in_group_id: grp.id, in_party_id: late.id, in_amount_cents: 0,
  });
  const mixed = await say(C, "class_fees_of", { in_group_id: grp.id });
  check("🔴 两个人不在班价上了",
    (mixed ?? []).filter((r) => !r.on_class_price).length === 2,
    JSON.stringify(mixed));

  const nine = (await bill({ in_period: nov }))[0];
  check("🔴 开了三张（四个人里一个不收钱）", nine.made === 3, JSON.stringify(nine));
  check("🔴 而且讲得出有一个免费的（不是静静少一张）",
    nine.free === 1, String(nine.free));
  check("一共 RM 522（180 ＋ 162 ＋ 180）",
    Number(nine.total_cents) === 52200, String(nine.total_cents));

  const novDue = await say(C, "class_fees_due", { in_group_id: grp.id, in_period: nov });
  const hui = (novDue ?? []).find((r) => r.party_id === kids["Ah Hui"].id);
  check("🔴 九折那一个的单上是 RM 162",
    Number(hui?.amount_cents) === 16200, String(hui?.amount_cents));
  check("🔴 不收钱那一个根本没有单",
    !(novDue ?? []).some((r) => r.party_id === late.id),
    JSON.stringify((novDue ?? []).map((r) => r.student)));
  check("剩下两个还是 RM 180",
    (novDue ?? []).filter((r) => Number(r.amount_cents) === 18000).length === 2,
    JSON.stringify((novDue ?? []).map((r) => r.amount_cents)));

  /* 🔴 改了价钱**不会改已经开出去的单** —— 单已经给了家长，
     系统偷偷改掉它上面的数字比不改更糟。 */
  await say(C, "set_class_fee", {
    in_group_id: grp.id, in_party_id: kids["Ah Hui"].id, in_amount_cents: 9000,
  });
  const redo = (await bill({ in_period: nov }))[0];
  check("🔴 再按一次，一张都不多开", redo.made === 0 && redo.again === 3,
    JSON.stringify(redo));
  const novDue2 = await say(C, "class_fees_due", { in_group_id: grp.id, in_period: nov });
  const hui2 = (novDue2 ?? []).find((r) => r.party_id === kids["Ah Hui"].id);
  check("🔴 而那一张开出去的单还是 RM 162（改价不改单）",
    Number(hui2?.amount_cents) === 16200, String(hui2?.amount_cents));

  /* 清掉 = 放回班价，跟设成 0 是两件事。 */
  await say(C, "set_class_fee", {
    in_group_id: grp.id, in_party_id: kids["Ah Hui"].id,
  });
  const cleared = await say(C, "class_fees_of", { in_group_id: grp.id });
  check("🔴 清掉就回到班价（不是变成 0）",
    (cleared ?? []).find((r) => r.party_id === kids["Ah Hui"].id)?.on_class_price === true,
    JSON.stringify(cleared));
  check("而讲过「不收钱」那一个还是 0",
    Number((cleared ?? []).find((r) => r.party_id === late.id)?.fee_cents) === 0,
    JSON.stringify((cleared ?? []).find((r) => r.party_id === late.id)));

  /* 拒绝的每一种。 */
  check("🔴 负数挡下来",
    (await refused(C, "set_class_fee", {
      in_group_id: grp.id, in_party_id: kids["Ah Hui"].id, in_amount_cents: -100,
    })).includes("less than nothing"), "居然让它过了");
  check("🔴 不在这个班的学生挡下来",
    (await refused(C, "set_class_fee", {
      in_group_id: grp.id, in_party_id: teacher.id, in_amount_cents: 100,
    })).includes("not in this class"), "居然让它过了");

  /* 🔴 老师 —— 定价是老板的事（跟 `set_commission_tiers` 同一条）。
     ⚠️ 控制组在下面一条：老板用一模一样的呼叫做得到。 */
  check("🔴 老师改不了学费",
    (await refused(teach.client, "set_class_fee", {
      in_group_id: grp.id, in_party_id: kids["Ah Hui"].id, in_amount_cents: 100,
    })).includes("for the owner"), "它让他改了");
  check("🔴 老师也读不到谁交多少",
    (await refused(teach.client, "class_fees_of", { in_group_id: grp.id }))
      .includes("for the owner"), "它让他读到了");
  check("⚠️ 而老板用一模一样的呼叫做得到（不然上面两条量的是空气）",
    (await say(C, "class_fees_of", { in_group_id: grp.id })).length === 4,
    "老板自己也读不到");

  /* ── ⑫ 🔴 报名费 · 教材费 —— 一次过的那几笔 ──────────────────
     2026-09-10 的深度研究把「报名费 · 押金 · 教材费」列成补习那边第三件。
     而量出来三件里**两件已经做得到**：

       · 押金 —— `financial_position` 本来就把它分开算（现金 100 ·
         **其中押金 100**），收入是零。一笔没有分摊的钱就是他欠家长的钱
       · 教材费 · 报名费 —— **跟学费一模一样的那一按**，只是那一轮不叫「月份」。
         钥匙是 `md5(班 · 那一轮 · 学生)`，而**「那一轮」是他自己的一串字** ——
         所以 `2026-教材` 跟 `2026-09` 一样管用，按第二下照样不多开

     🔴 **所以这一节不是新功能，是把一个假设变成一个读数**
     （[重点 34](../docs/founder-points.md)：先问手写簿上有没有那一格）。 */
  console.log("\n⑫ 🔴 教材费：同一按，不同的那一轮");
  /* 🔴 **这一段第一次跑就掀出一件真的**：那时候没有 `in_use_own_fee`，
     於是一个学费九折的学生，教材费被开成**他那个九折的数字** ——
     一个没有人讲过的价钱。20260910160000 给了那个开关，预设保持旧行为。

     ⚠️ 而这里的道具是前面几节留下来的：四个在班的学生里，
     一个讲过「不收钱」（`fee_cents = 0`），一个已经走了。 */
  const books = (await say(C, "bill_class", {
    in_group_id: grp.id, in_module_key: "orders", in_amount_cents: 8000,
    in_title: "教材费 · Add Maths", in_period: "2026-教材",
    in_use_own_fee: false,
  }))[0];
  check("🔴 一按开给全班四个（大家一样价，不看各自的学费）",
    books?.made === 4, JSON.stringify(books));
  check("而那一轮叫他自己那串字", books?.period === "2026-教材", String(books?.period));
  check("🔴 一共 RM 320 —— 四个人乘 80，一个折扣都没套上去",
    Number(books?.total_cents) === 32000, String(books?.total_cents));
  check("🔴 而「不收钱」那一个照样要买课本（那是她的决定，不是我们的）",
    books?.free === 0, String(books?.free));

  /* 🔴 而同一按不给那个开关的时候，学生自己的价照旧管用 —— 那是月费的样子。 */
  const own = (await say(C, "bill_class", {
    in_group_id: grp.id, in_module_key: "orders", in_amount_cents: 8000,
    in_title: "补习费 · 十月", in_period: "2026-10",
  }))[0];
  check(
    "🔴 不给开关 → 月费那一轮照旧跟着学生走（一个免费，所以只开三张）",
    own?.made === 3 && own?.free === 1,
    JSON.stringify(own),
  );

  const twice = (await say(C, "bill_class", {
    in_group_id: grp.id, in_module_key: "orders", in_amount_cents: 8000,
    in_title: "教材费 · Add Maths", in_period: "2026-教材",
    in_use_own_fee: false,
  }))[0];
  check("🔴 按第二下一张都不多开", twice?.made === 0 && twice?.again === 4,
    JSON.stringify(twice));
  const sept = await say(C, "class_fees_due", { in_group_id: grp.id, in_period: period });
  check(
    "🔴 而那一个月的学费一分都没有被碰到（每一轮各算各的）",
    (sept ?? []).length === 4,
    JSON.stringify((sept ?? []).map((r) => r.amount_cents)),
  );

  /* ── ⑩ 别人家 ─────────────────────────────────────────────── */
  console.log("\n⑧ 别人家");
  const other = await person("other");
  check(
    "别人家开不了我的班",
    (await refused(other.client, "bill_class", {
      in_group_id: grp.id, in_module_key: "orders", in_amount_cents: 18000,
    })).includes("no such class"),
  );
  check(
    "别人家读不到我的学费清单",
    (await refused(other.client, "class_fees_due", { in_group_id: grp.id })).includes("no such class"),
  );
} catch (e) {
  console.log("\n🔴", e?.message ?? e);
  bad.push("跑不完");
} finally {
  await dropThrowaways(admin, people);
  console.log(`\n判：${bad.length === 0 ? "全部过" : `${bad.length} 条没过`}`);
  process.exitCode = bad.length === 0 ? 0 : 1;
}

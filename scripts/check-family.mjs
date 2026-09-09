/**
 * 一个家长三个孩子一笔钱 —— 真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的四条：
 *   · **单上写的还是孩子的名字，而帐算在妈妈头上** —— 两样都要对
 *   · 帐龄上是**一个家庭一笔钱**，不是三个不相干的欠款人
 *   · **只准一层** —— 一个圈上的帐永远算不完
 *   · 兄弟姐妹折扣照旧一个学生一个价（两件事并存，不是互相取代）
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaways } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .replace(/\r/g, "")
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
  const email = `fam-${tag}-${stamp}@formae.test`;
  const password = `Fam-${stamp}-x!`;
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
const say = async (client, fn, args) => {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
};
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

  const mum = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Madam Lim",
  });
  const kids = {};
  for (const n of ["Lim Wei Jie", "Lim Wei Xin", "Lim Wei Ling"]) {
    kids[n] = await say(C, "add_directory_entry", {
      in_project_id: P, in_module_key: "customers", in_name: n,
    });
  }
  const teacher = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Miss Tan",
  });
  const grp = await say(C, "add_class_group", {
    in_project_id: P, in_module_key: "bookings",
    in_name: "中四数学", in_staff_id: teacher.id,
  });
  for (const n of Object.keys(kids)) {
    await say(C, "enrol_in_class", { in_group_id: grp.id, in_party_id: kids[n].id });
  }

  console.log("\n① 没有指定的时候，单算他自己");
  const alone = await say(C, "family_of", { in_party_id: kids["Lim Wei Jie"].id });
  check("一家就他一个", alone.length === 1 && alone[0]?.is_payer === true,
    JSON.stringify(alone));

  console.log("\n② 🔴 三个孩子挂到妈妈身上");
  for (const n of Object.keys(kids)) {
    await say(C, "set_bill_payer", { in_party_id: kids[n].id, in_payer_id: mum.id });
  }
  const fam = await say(C, "family_of", { in_party_id: kids["Lim Wei Xin"].id });
  check("🔴 从孩子那一端问，四个人都在", fam.length === 4, String(fam.length));
  check("而且第一个是付钱的那一位",
    fam[0]?.name === "Madam Lim" && fam[0]?.is_payer === true, JSON.stringify(fam[0]));
  const fromMum = await say(C, "family_of", { in_party_id: mum.id });
  check("🔴 从妈妈那一端问，拿到同一份",
    fromMum.length === 4
      && JSON.stringify(fromMum.map((r) => r.name)) === JSON.stringify(fam.map((r) => r.name)),
    JSON.stringify(fromMum.map((r) => r.name)));

  console.log("\n③ 🔴 开一次全班的学费");
  /* 老二九折 —— 兄弟姐妹折扣跟「算给谁」是两件事，两件都要成立。 */
  await say(C, "set_class_fee", {
    in_group_id: grp.id, in_party_id: kids["Lim Wei Xin"].id, in_amount_cents: 16200,
  });
  const made = (await say(C, "bill_class", {
    in_group_id: grp.id, in_module_key: "orders", in_amount_cents: 18000,
    in_title: "Sept fees", in_period: "2026-09",
  }))[0];
  check("开了三张", made?.made === 3, JSON.stringify(made));
  check("一共 RM 522（180 ＋ 162 ＋ 180）",
    Number(made?.total_cents) === 52200, String(made?.total_cents));

  const { data: bills } = await C
    .from("pipeline_records").select("party, party_id, amount_cents")
    .eq("project_id", P).eq("module_key", "orders");
  check(
    "🔴 三张单上写的都是**孩子**的名字",
    (bills ?? []).every((b) => /Wei/.test(String(b.party))),
    JSON.stringify((bills ?? []).map((b) => b.party)),
  );
  check(
    "🔴 而三张都算在**妈妈**头上",
    (bills ?? []).length === 3 && (bills ?? []).every((b) => b.party_id === mum.id),
    JSON.stringify((bills ?? []).map((b) => b.party_id)),
  );

  console.log("\n④ 🔴 帐龄上是一个家庭，不是三个欠款人");
  const owed = await say(C, "party_debts", { in_project_id: P });
  /* ⚠️ 那一支回的是 `party_id`，**没有名字那一栏** ——
     我第一版拿 `r.party` 去比，拿到 undefined。又一次猜名字。 */
  check("🔴 名单上只有一个欠款人", owed.length === 1, JSON.stringify(owed));
  check("是妈妈", owed[0]?.party_id === mum.id, String(owed[0]?.party_id));
  check(
    "🔴 而她欠的是三张加起来（RM 522）",
    Number(owed[0]?.owed_cents) === 52200,
    String(owed[0]?.owed_cents),
  );

  console.log("\n⑤ 妈妈付一笔，分摊到三张");
  const paid = await say(C, "add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 52200, in_party: "Madam Lim", in_party_id: mum.id,
  });
  /* ⚠️ 第二个参数叫 `in_rows`，不是 `in_allocations` —— 又一次猜参数名。 */
  const { data: full } = await C
    .from("pipeline_records").select("id, amount_cents")
    .eq("project_id", P).eq("module_key", "orders");
  await say(C, "set_payment_allocations", {
    in_entry_id: paid.id,
    in_rows: (full ?? []).map((b) => ({
      record_id: b.id, amount_cents: Number(b.amount_cents),
    })),
  });
  const after = await say(C, "party_debts", { in_project_id: P });
  check("🔴 一笔钱付完三张，名单空了", after.length === 0,
    JSON.stringify(after.map((r) => [r.party, r.owed_cents])));

  console.log("\n⑥ 🔴 只准一层");
  check("🔴 算给自己 → 挡下来",
    (await refused(C, "set_bill_payer", {
      in_party_id: mum.id, in_payer_id: mum.id,
    })).includes("themselves"), "居然让它过了");
  check(
    "🔴 挂到一个已经挂在别人身上的人 → 挡下来",
    (await refused(C, "set_bill_payer", {
      in_party_id: teacher.id, in_payer_id: kids["Lim Wei Jie"].id,
    })).includes("already billed to somebody else"),
    "居然让它过了",
  );
  check(
    "🔴 已经在替别人付钱的，不给再挂到第三个人 → 挡下来（成圈）",
    (await refused(C, "set_bill_payer", {
      in_party_id: mum.id, in_payer_id: teacher.id,
    })).includes("already billed to this person"),
    "居然让它过了",
  );

  console.log("\n⑦ 拿掉那一格");
  await say(C, "set_bill_payer", { in_party_id: kids["Lim Wei Ling"].id });
  const smaller = await say(C, "family_of", { in_party_id: mum.id });
  check("🔴 拿掉之后那一家剩三个", smaller.length === 3,
    JSON.stringify(smaller.map((r) => r.name)));

  console.log("\n⑧ 别人家");
  const other = await person("other");
  check("🔴 别人家改不了我的",
    !!(await refused(other.client, "set_bill_payer", {
      in_party_id: kids["Lim Wei Jie"].id, in_payer_id: mum.id,
    })), "他改了");
  check("🔴 别人家问不了我的一家人",
    !!(await refused(other.client, "family_of", { in_party_id: mum.id })),
    "他问到了");
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}

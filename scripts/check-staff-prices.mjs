/**
 * 同一样服务，不同的人不同的价钱 —— 拿真的登入身分打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的三条：
 *   · **空着的那一格是「跟原价走」，不是「不给做」**
 *   · **0 是真的**（学徒洗头不收钱），而 null 是「擦掉这一格」
 *   · 那个数字讲得出**是他定的还是原价** —— 讲不出理由的数字他不会信
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
  const email = `sp-${tag}-${stamp}@formae.test`;
  const password = `Sp-${stamp}-x!`;
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
  await C.rpc("set_project_style", { new_style: "hearth" });
  for (const k of ["inventory", "staff", "customers", "bookings"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const cut = await say(C, "add_catalog_item", {
    in_project_id: P, in_module_key: "inventory",
    in_name: "洗剪吹", in_unit: "次", in_price_cents: 3800,
  });
  const junior = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Ah Ming",
  });
  const sifu = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Sifu",
  });

  console.log("\n① 一格都还没写的时候");
  const base = (await say(C, "price_for", { in_item_id: cut.id }))[0];
  check("没指人 → 原价 RM 38", Number(base?.price_cents) === 3800, String(base?.price_cents));
  check("而且讲得出这是原价，不是谁的价", base?.theirs === false, String(base?.theirs));
  const before = (await say(C, "price_for", {
    in_item_id: cut.id, in_staff_id: junior.id,
  }))[0];
  check(
    "🔴 指了一位而那一格空着 → 照样原价（空 ≠ 不给做）",
    Number(before?.price_cents) === 3800 && before?.theirs === false,
    JSON.stringify(before),
  );

  console.log("\n② 写一格：Ah Ming 剪 18");
  await say(C, "set_staff_price", {
    in_item_id: cut.id, in_staff_id: junior.id, in_price_cents: 1800,
  });
  const his = (await say(C, "price_for", {
    in_item_id: cut.id, in_staff_id: junior.id,
  }))[0];
  check("🔴 他的价是 RM 18", Number(his?.price_cents) === 1800, String(his?.price_cents));
  check("🔴 而且讲得出这是他自己的价", his?.theirs === true, String(his?.theirs));
  const other = (await say(C, "price_for", {
    in_item_id: cut.id, in_staff_id: sifu.id,
  }))[0];
  check(
    "🔴 而师傅那一格没写，所以还是原价 —— 一格只影响一个人",
    Number(other?.price_cents) === 3800 && other?.theirs === false,
    JSON.stringify(other),
  );

  console.log("\n③ 🔴 0 跟 null 是两句话");
  await say(C, "set_staff_price", {
    in_item_id: cut.id, in_staff_id: sifu.id, in_price_cents: 0,
  });
  const free = (await say(C, "price_for", {
    in_item_id: cut.id, in_staff_id: sifu.id,
  }))[0];
  check(
    "🔴 0 是「这一位做这一样不收钱」—— 而且它是他定的，不是退回原价",
    Number(free?.price_cents) === 0 && free?.theirs === true,
    JSON.stringify(free),
  );
  await say(C, "set_staff_price", { in_item_id: cut.id, in_staff_id: sifu.id });
  const wiped = (await say(C, "price_for", {
    in_item_id: cut.id, in_staff_id: sifu.id,
  }))[0];
  check(
    "🔴 不给数字 = 擦掉那一格，回到原价 RM 38",
    Number(wiped?.price_cents) === 3800 && wiped?.theirs === false,
    JSON.stringify(wiped),
  );

  console.log("\n④ 一个人一样服务只有一个价");
  await say(C, "set_staff_price", {
    in_item_id: cut.id, in_staff_id: junior.id, in_price_cents: 2200,
  });
  const { count } = await C
    .from("staff_prices").select("id", { count: "exact", head: true })
    .eq("item_id", cut.id).eq("staff_id", junior.id);
  check("🔴 改价是改那一格，不是多一格", count === 1, `${count} 格`);
  const now = (await say(C, "price_for", {
    in_item_id: cut.id, in_staff_id: junior.id,
  }))[0];
  check("而且读回来是新的那个 RM 22", Number(now?.price_cents) === 2200,
    String(now?.price_cents));

  console.log("\n⑤ 整张表");
  const list = await say(C, "staff_price_list", { in_project_id: P });
  check("🔴 只列不一样的那几格（师傅擦掉了，所以只有一格）",
    list.length === 1 && list[0]?.staff_name === "Ah Ming",
    JSON.stringify(list.map((r) => [r.staff_name, r.price_cents])));

  console.log("\n⑥ 拒绝的每一种");
  check("负数挡下来",
    (await refused(C, "set_staff_price", {
      in_item_id: cut.id, in_staff_id: junior.id, in_price_cents: -1,
    })).includes("less than nothing"), "居然让它过了");
  check("不是这家店的人挡下来",
    (await refused(C, "set_staff_price", {
      in_item_id: cut.id, in_staff_id: P, in_price_cents: 100,
    })).includes("does not work here"), "居然让它过了");

  console.log("\n⑦ 🔴 定价是老板的事");
  const crew = await person("crew");
  await say(C, "add_project_member", { in_email: crew.email });
  check("🔴 美发师改不了价目表",
    (await refused(crew.client, "set_staff_price", {
      in_item_id: cut.id, in_staff_id: junior.id, in_price_cents: 1,
    })).includes("for the owner"), "它让她改了");
  check("🔴 整张价目表她也读不到",
    (await say(crew.client, "staff_price_list", { in_project_id: P })).length === 0,
    "她读到了");
  check("⚠️ 而老板同一个呼叫读得到（不然上面那一条量的是空气）",
    list.length === 1, String(list.length));
  /* 🔴 而**问一格价钱**她读得到 —— 柜台要讲得出「师傅剪三十八」。
     跟 20260909350000 那一条同一个分法：一个客人的数字给柜台，
     整张表给老板。 */
  const asksCounter = (await say(crew.client, "price_for", {
    in_item_id: cut.id, in_staff_id: junior.id,
  }))[0];
  check(
    "🔴 但她问得出「这一位这一样多少钱」（柜台每天要讲的那一句）",
    Number(asksCounter?.price_cents) === 2200,
    JSON.stringify(asksCounter),
  );

  console.log("\n⑧ 别人家");
  const stranger = await person("other");
  check("🔴 别人家写不了我的价",
    !!(await refused(stranger.client, "set_staff_price", {
      in_item_id: cut.id, in_staff_id: junior.id, in_price_cents: 1,
    })), "他写了");
  check("🔴 别人家问不了我的价",
    !!(await refused(stranger.client, "price_for", { in_item_id: cut.id })),
    "他问到了");
  check("🔴 别人家读不到我的价目表",
    (await say(stranger.client, "staff_price_list", { in_project_id: P })).length === 0,
    "他读到了");
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}

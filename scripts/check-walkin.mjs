/**
 * 走单客人轮到谁 —— 真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的三条：
 *   · 谁等最久（或者从来没接过）就排第一个 —— **算出来，不是存起来的**
 *   · 「接了」这个动作把她排到队尾，不用搬动任何一份清单
 *   · 步出轮子的（吃饭 · 在忙）不算，回来了按一下就回到队伍里
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
  const email = `walkin-${tag}-${stamp}@formae.test`;
  const password = `Walkin-${stamp}-x!`;
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
  await C.rpc("add_project_page", { requested_key: "staff", new_title: "Staff" });

  const amy = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Amy",
  });
  const fara = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Fara",
  });

  console.log("\n① 两个都还没接过 —— 排第一个的是先建那个（同一批打平用名字排）");
  const queue1 = await say(C, "walkin_queue_of", { in_project_id: P });
  check("两个都在队伍里", queue1.length === 2, JSON.stringify(queue1.map((r) => r.name)));
  check("两个都还没接过（null）", queue1.every((r) => r.last_walkin_at === null),
    JSON.stringify(queue1));
  const next1 = await say(C, "next_for_walkin", { in_project_id: P });
  check("下一个是 Amy（名字排在前面）", next1?.name === "Amy", next1?.name);

  console.log("\n② 🔴 Amy 接了 —— 她排到队尾去");
  const taken = await say(C, "take_walkin_turn", { in_staff_id: amy.id });
  check("记得进去", !!taken?.last_walkin_at, "还是空的");
  const next2 = await say(C, "next_for_walkin", { in_project_id: P });
  check("🔴 下一个换成 Fara（Fara 还没接过）", next2?.name === "Fara", next2?.name);

  console.log("\n③ Fara 也接了 —— 现在轮回 Amy（她等得比较久）");
  await new Promise((r) => setTimeout(r, 1100));
  await say(C, "take_walkin_turn", { in_staff_id: fara.id });
  const next3 = await say(C, "next_for_walkin", { in_project_id: P });
  check("🔴 轮回 Amy（她上一次接客比 Fara 早）", next3?.name === "Amy", next3?.name);

  console.log("\n④ 🔴 新来的师傅不用排到队尾 —— null 排在所有人前面");
  const jas = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Jasmine",
  });
  const next4 = await say(C, "next_for_walkin", { in_project_id: P });
  check("下一个是 Jasmine（新来的，从来没接过）", next4?.name === "Jasmine", next4?.name);

  console.log("\n⑤ 🔴 她去吃饭了 —— 不算她，回来了再算她");
  const off = await say(C, "set_walkin_available", {
    in_staff_id: jas.id, in_available: false,
  });
  check("记下去了", off?.walkin_available === false, off?.walkin_available);
  const queue2 = await say(C, "walkin_queue_of", { in_project_id: P });
  check("🔴 队伍里看不到她了", !queue2.some((r) => r.id === jas.id),
    JSON.stringify(queue2.map((r) => r.name)));
  const next5 = await say(C, "next_for_walkin", { in_project_id: P });
  check("下一个换回 Amy（Jasmine 不算了）", next5?.name === "Amy", next5?.name);

  const back = await say(C, "set_walkin_available", {
    in_staff_id: jas.id, in_available: true,
  });
  check("回来了", back?.walkin_available === true, back?.walkin_available);
  const next6 = await say(C, "next_for_walkin", { in_project_id: P });
  check("🔴 又轮到 Jasmine 了（她还是从来没接过）", next6?.name === "Jasmine", next6?.name);

  console.log("\n⑥ 别管顾客，别管钱 —— 只答「谁」，跟拒绝的那几种");
  check("🔴 换成客人会被拒绝（不是员工列表上的人）",
    !!(await refused(C, "take_walkin_turn", { in_staff_id: (await say(C, "add_directory_entry", {
      in_project_id: P, in_module_key: "customers", in_name: "Mrs Ong",
    })).id })), "居然让它过了");
  await say(C, "set_walkin_available", { in_staff_id: amy.id, in_available: false });
  await say(C, "set_walkin_available", { in_staff_id: fara.id, in_available: false });
  await say(C, "set_walkin_available", { in_staff_id: jas.id, in_available: false });
  const empty = await say(C, "next_for_walkin", { in_project_id: P });
  /* ⚠️ 一支回单一笔（不是 setof）的函式，没有配到行的时候，
     PostgREST 给的是一个每一栏都是 null 的物件，不是 JS 的 null——
     跟别的 `returns public.directory_entries` 同一个形状。 */
  check("🔴 一个都不在轮子里的时候，答不出下一个（不硬凑一个答案）",
    empty?.id == null, JSON.stringify(empty));

  console.log("\n⑦ 别人家");
  const other = await person("other");
  check("🔴 别人家问不到我的队伍", (await say(other.client, "walkin_queue_of", {
    in_project_id: P,
  })).length === 0, "他看到了");
  check("🔴 别人家排不了我师傅的队", !!(await refused(other.client, "take_walkin_turn", {
    in_staff_id: amy.id,
  })), "他排上了");
  check("🔴 别人家答不出我的下一个", !!(await refused(other.client, "next_for_walkin", {
    in_project_id: P,
  })), "他答出来了");
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}

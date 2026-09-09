/**
 * 助手记得住他讲过的话 —— 拿真的登入身分打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的四条：
 *   · **只加不覆盖** —— 他改口了是多一条，旧那一条留着
 *   · 同一句话讲两次**不会变成两条**
 *   · `landed` **只往上走** —— 做成过的那一句不会被后来一句嘴上的话降回去
 *   · 别人家一条都读不到、也写不进
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
  const email = `mem-${tag}-${stamp}@formae.test`;
  const password = `Mem-${stamp}-x!`;
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
  const mem = () => say(C, "assistant_memory", { in_project_id: P });

  console.log("\n① 一开始它什么都不记得");
  check("干净的帐号，一条都没有", (await mem()).length === 0,
    JSON.stringify(await mem()));

  console.log("\n② 记一句");
  const one = await say(C, "remember_this", {
    in_project_id: P, in_body: "Madam Chong 的名字不要翻成中文",
    in_page_key: "payments",
  });
  check("记得进去", !!one?.id, "记不进去");
  const back = await mem();
  check("读得回来，而且是原话", back[0]?.body === "Madam Chong 的名字不要翻成中文",
    back[0]?.body);
  check("讲得出他在哪一页讲的", back[0]?.page_key === "payments", back[0]?.page_key);
  check("而且知道它还没有从一次真的动作上来", back[0]?.landed === false,
    String(back[0]?.landed));

  console.log("\n③ 🔴 同一句话讲两次");
  const again = await say(C, "remember_this", {
    in_project_id: P, in_body: "  madam chong 的名字不要翻成中文  ",
  });
  check("🔴 拿回原来那一条（大小写跟空白不算另一句）", again?.id === one.id,
    `${again?.id} ⟂ ${one.id}`);
  check("🔴 名单上还是一条", (await mem()).length === 1,
    String((await mem()).length));

  console.log("\n④ 🔴 做成过的那一句排前面，而且只往上走");
  await say(C, "remember_this", {
    in_project_id: P, in_body: "合发那家都是三十天付款", in_landed: true,
  });
  const two = await mem();
  check("🔴 做成过的那一条排在最前面", two[0]?.body === "合发那家都是三十天付款",
    JSON.stringify(two.map((r) => r.body)));
  /* 🔴 同一句话再讲一次，这一次没有做成 —— 它不可以被降回去。
     一句「做成过」的话被后来一句嘴上的话降级，就是让最后一次呼叫赢。 */
  await say(C, "remember_this", {
    in_project_id: P, in_body: "合发那家都是三十天付款", in_landed: false,
  });
  const still = (await mem()).find((r) => r.body === "合发那家都是三十天付款");
  check("🔴 后来一句嘴上的话不会把它降回去", still?.landed === true,
    String(still?.landed));

  console.log("\n⑤ 🔴 他改口 —— 只加不覆盖");
  await say(C, "remember_this", {
    in_project_id: P, in_body: "合发那家改成十四天付款", in_landed: true,
  });
  const three = await mem();
  check("🔴 新那一句进来了", three.some((r) => r.body === "合发那家改成十四天付款"),
    JSON.stringify(three.map((r) => r.body)));
  check("🔴 而旧那一句还在（没有被静静改写）",
    three.some((r) => r.body === "合发那家都是三十天付款"),
    JSON.stringify(three.map((r) => r.body)));

  console.log("\n⑥ 别再记着了");
  const gone = await say(C, "forget_that", { in_id: one.id });
  check("按得掉", !!gone?.archived_at, "按不掉");
  check("🔴 名单上少一条", (await mem()).length === 2, String((await mem()).length));
  const { data: kept } = await C
    .from("assistant_facts").select("id").eq("id", one.id);
  check("🔴 而那一行还在表上（按掉不是删掉）", (kept ?? []).length === 1,
    `${kept?.length}`);

  console.log("\n⑦ 拒绝的每一种");
  check("空的挡下来",
    (await refused(C, "remember_this", { in_project_id: P, in_body: "   " }))
      .includes("say what to remember"), "居然让它过了");
  check("太长挡下来",
    (await refused(C, "remember_this", {
      in_project_id: P, in_body: "x".repeat(401),
    })).includes("too long"), "居然让它过了");

  console.log("\n⑧ 🔴 别人家");
  const other = await person("other");
  check("🔴 别人家一条都读不到", (await say(other.client, "assistant_memory", {
    in_project_id: P,
  })).length === 0, "他读到了");
  check("🔴 别人家写不进来",
    !!(await refused(other.client, "remember_this", {
      in_project_id: P, in_body: "偷偷塞一句",
    })), "他写进来了");
  check("🔴 别人家也按不掉我的",
    !!(await refused(other.client, "forget_that", { in_id: one.id })),
    "他按掉了");
  const { data: peek } = await other.client
    .from("assistant_facts").select("id").eq("project_id", P);
  check("🔴 那张表他也读不到", (peek ?? []).length === 0, `${peek?.length}`);

  /* 🔴 一个师傅呢 —— 他也在用那个助手，而这张表是 `works_here`。
     ⚠️ 这一条**不是漏掉，是决定**（见 20260909300000 的档头）：
     「我讲的『装好了』是指师傅走了」就该记得住。代价写在那里。 */
  console.log("\n⑨ 师傅（这是一个决定，不是漏掉）");
  const crew = await person("crew");
  await say(C, "add_project_member", { in_email: crew.email });
  check("师傅读得到（故意的）",
    (await say(crew.client, "assistant_memory", { in_project_id: P })).length === 2,
    "他读不到");
  check("师傅也写得进（故意的）",
    !!(await say(crew.client, "remember_this", {
      in_project_id: P, in_body: "装好了是指师傅走了，不是收了钱",
    }))?.id, "他写不进");
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}

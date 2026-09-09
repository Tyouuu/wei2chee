/**
 * 一次来访做了哪几样、谁做的 —— 拿真的登入身分打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的三条：
 *   · **谁收了钱**跟**谁做了活**是两个数字，而且它们本来就不一样
 *     （柜台一个人收全部，而活是三个人做的）
 *   · 只数**做完的**那几次 —— 一个还没来的客人身上的抽成是一个愿望
 *   · 那一位要真的是他店里的人 —— 只收编号，不靠名字配人（[任务 89]）
 *
 * ⚠️ 而这一整张表**没有时长、没有段** —— 他 2026-09-10 拍板的
 * （[重点 34]：手写簿上没有的，这里也不要有）。所以这里也不量那些。
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
  const email = `vl-${tag}-${stamp}@formae.test`;
  const password = `Vl-${stamp}-x!`;
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
  for (const k of ["bookings", "customers", "staff", "payments"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const { data: today } = await admin.rpc("today_myt");
  const month = String(today).slice(0, 7);
  const at = (daysBack, hour) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - daysBack);
    d.setUTCHours(hour - 8);
    return d.toISOString();
  };

  const junior = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Ah Girl",
  });
  const senior = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Sifu",
  });
  const her = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Tan",
  });

  /** 一笔已经过去的来访，讲好它的结局。 */
  const visit = async (daysBack, hour, status) => {
    const id = await say(C, "add_appointment", {
      in_project_id: P, in_module_key: "bookings",
      in_starts_at: at(daysBack, hour), in_ends_at: at(daysBack, hour + 2),
      in_party: "Mrs Tan", in_party_id: her.id, in_service: "Cut and colour",
    });
    if (status) await say(C, "set_appointment_status", { in_id: id, in_status: status });
    return id;
  };

  console.log("\n① 一次来访，三行，两个人做");
  const one = await visit(3, 10, null);
  const wash = await say(C, "add_visit_line", {
    in_appointment_id: one, in_service: "洗", in_staff_id: junior.id,
    in_price_cents: 1200,
  });
  await say(C, "add_visit_line", {
    in_appointment_id: one, in_service: "剪", in_staff_id: senior.id,
    in_price_cents: 3800,
  });
  await say(C, "add_visit_line", {
    in_appointment_id: one, in_service: "染", in_staff_id: senior.id,
    in_price_cents: 18000,
  });
  const lines = await say(C, "visit_lines_of", { in_appointment_id: one });
  check("三行都在", lines.length === 3, String(lines.length));
  check("顺序照他打进去的", lines.map((r) => r.service).join(",") === "洗,剪,染",
    JSON.stringify(lines.map((r) => r.service)));
  check("🔴 谁做的，一行一个名字",
    lines[0]?.staff_name === "Ah Girl" && lines[1]?.staff_name === "Sifu",
    JSON.stringify(lines.map((r) => r.staff_name)));

  console.log("\n② 空着的那两格，各自是一句话");
  const walkIn = await say(C, "add_visit_line", {
    in_appointment_id: one, in_service: "头皮护理",
  });
  check("🔴 还没派人 → 那一格是空的（不是逼他当场指一个）",
    walkIn?.staff_id === null, String(walkIn?.staff_id));
  check("🔴 还没讲价 → 那一格是 null，不是 0",
    walkIn?.price_cents === null, String(walkIn?.price_cents));
  const free = await say(C, "add_visit_line", {
    in_appointment_id: one, in_service: "洗（免费）", in_price_cents: 0,
  });
  check("而 0 是「这一样不收钱」—— 跟没讲不一样",
    Number(free?.price_cents) === 0, String(free?.price_cents));

  console.log("\n③ 拒绝的每一种");
  check("空的服务挡下来",
    (await refused(C, "add_visit_line", { in_appointment_id: one, in_service: "  " }))
      .includes("say what was done"), "居然让它过了");
  check("负数挡下来",
    (await refused(C, "add_visit_line", {
      in_appointment_id: one, in_service: "剪", in_price_cents: -1,
    })).includes("less than nothing"), "居然让它过了");
  check("🔴 不是这家店的人挡下来（只收编号，不靠名字配人）",
    (await refused(C, "add_visit_line", {
      in_appointment_id: one, in_service: "剪", in_staff_id: P,
    })).includes("does not work here"), "居然让它过了");

  console.log("\n④ 打错的那一行删得掉");
  await say(C, "drop_visit_line", { in_id: free.id });
  check("删掉了", (await say(C, "visit_lines_of", { in_appointment_id: one })).length === 4,
    String((await say(C, "visit_lines_of", { in_appointment_id: one })).length));
  check("删第二次讲一句人话",
    (await refused(C, "drop_visit_line", { in_id: free.id })).includes("no such line"),
    "居然让它过了");

  console.log("\n⑤ 🔴 谁做了多少钱的活");
  /* 上面那一次还没结束 —— 先讲它做完了。 */
  await say(C, "set_appointment_status", { in_id: one, in_status: "done" });
  /* 一次没来的，底下照样有行 —— 而它不该算进去。 */
  const missed = await visit(2, 14, "no_show");
  await say(C, "add_visit_line", {
    in_appointment_id: missed, in_service: "染", in_staff_id: senior.id,
    in_price_cents: 50000,
  });

  const did = await say(C, "visit_earnings", { in_project_id: P, in_month: month });
  const sifu = did.find((r) => r.name === "Sifu");
  const girl = did.find((r) => r.name === "Ah Girl");
  check("🔴 师傅做了 RM 218（38 ＋ 180）",
    Number(sifu?.did_cents) === 21800, String(sifu?.did_cents));
  check("🔴 学徒做了 RM 12", Number(girl?.did_cents) === 1200, String(girl?.did_cents));
  check(
    "🔴 而那一次没来的 RM 500 一分都没有算进去（抽成不是愿望）",
    Number(sifu?.did_cents) === 21800,
    `师傅变成 ${sifu?.did_cents}`,
  );
  check("还没派人那一行不挂在任何人头上",
    did.every((r) => r.name === "Sifu" || r.name === "Ah Girl"),
    JSON.stringify(did.map((r) => r.name)));

  console.log("\n⑥ 🔴 「谁收了钱」跟「谁做了活」是两个数字");
  /* 柜台一个人把整笔钱收了，而活是两个人做的 —— 一间沙龙每天的样子。 */
  await say(C, "add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 23000, in_party: "Mrs Tan", in_party_id: her.id,
    in_done_by: junior.id,
  });
  const took = await say(C, "staff_earnings", { in_project_id: P, in_month: month });
  const tookGirl = took.find((r) => r.name === "Ah Girl");
  check("柜台那一位收了 RM 230（整笔）",
    Number(tookGirl?.earned_cents) === 23000, String(tookGirl?.earned_cents));
  check(
    "🔴 而她自己只做了 RM 12 —— 两个问题两个答案，不是同一个数字的两份",
    Number(girl?.did_cents) === 1200 && Number(tookGirl?.earned_cents) === 23000,
    `做 ${girl?.did_cents} · 收 ${tookGirl?.earned_cents}`,
  );

  console.log("\n⑦ 🔴 美发师看得到活，看不到钱");
  const crew = await person("crew");
  await say(C, "add_project_member", { in_email: crew.email });
  check("🔴 她看得到这一次做了哪几样（那是她的活）",
    (await say(crew.client, "visit_lines_of", { in_appointment_id: one })).length === 4,
    "她看不到");
  check("🔴 而「谁做了多少钱」她读不到（那一支回的是钱）",
    (await say(crew.client, "visit_earnings", { in_project_id: P, in_month: month }))
      .length === 0,
    "她读到了");
  check("⚠️ 而老板同一个呼叫读得到（不然上面那一条量的是空气）",
    did.length === 2, String(did.length));
  check("🔴 而她照样记得下一行（做完了要能记）",
    (await refused(crew.client, "add_visit_line", {
      in_appointment_id: one, in_service: "吹",
    })) === "", "它把她挡下来了");

  console.log("\n⑧ 别人家");
  const other = await person("other");
  check("🔴 别人家记不进我的来访",
    !!(await refused(other.client, "add_visit_line", {
      in_appointment_id: one, in_service: "剪",
    })), "他记进来了");
  check("🔴 别人家读不到我的那几行",
    (await say(other.client, "visit_lines_of", { in_appointment_id: one })).length === 0,
    "他读到了");
  check("🔴 别人家删不了我的",
    !!(await refused(other.client, "drop_visit_line", { in_id: wash.id })), "他删了");
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}

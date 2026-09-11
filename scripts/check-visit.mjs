/**
 * 「来了」那一下 —— 一颗按钮做两件，用真的登入身分打一次每一支。
 *
 * 一间沙龙一天二十个客人。「来了」按一次、扣套票再按一次，
 * 那是**一天多按二十次**（[重点 29](../docs/founder-points.md)）。
 *
 * 🔴 而这一支真正要守的是**它什么时候不动手**:
 *   [任务 89](../docs/founder-tasks.md#89) 量过，代价写在那里 ——
 *   **靠猜省他的字，会把钱记到另一个人头上。**
 *   所以两张套票的时候不动 · 只剩过期那一张的时候不动 ·
 *   没连到人的时候不动 —— 每一次都讲得出为什么，让他自己按。
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
  const email = `vis-${tag}-${stamp}@formae.test`;
  const password = `Vis-${stamp}-x!`;
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
dropThrowawayOnExit(admin, () => people[people.length - 1]);

/* 每一次都换一个钟头，不然那条「同一个人同一个时间只准一次」会挡。 */
let slot = 0;
const when = () => {
  slot += 1;
  const s = new Date(Date.now() + slot * 2 * 3600e3);
  const e = new Date(s.getTime() + 3600e3);
  return [s.toISOString(), e.toISOString()];
};
const ymd = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "ledger" });
  for (const k of ["bookings", "customers", "staff"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }
  const mk = async (name) => {
    const { data } = await C.rpc("add_directory_entry", {
      in_project_id: P, in_module_key: "customers", in_name: name,
    });
    return data;
  };
  const one = await mk("Mrs Lim");
  const two = await mk("Mrs Tan");
  const none = await mk("Mrs Wong");
  const old = await mk("Mrs Ong");

  const book = async (party) => {
    const [s, e] = when();
    const { data, error } = await C.rpc("add_appointment", {
      in_project_id: P, in_module_key: "bookings",
      in_starts_at: s, in_ends_at: e,
      in_party: party ? "someone" : "walk in",
      in_party_id: party ? party.id : null,
      in_service: "洗剪吹",
    });
    if (error) throw new Error(`add_appointment: ${error.message}`);
    return data;
  };

  /* ── ① 🔴 只有一张能用的套票 → 顺手扣一次 ──────────────────── */
  console.log("\n① 🔴 一张套票 → 按「来了」顺手扣一次");
  const { data: pack1, error: pe } = await C.rpc("add_service_package", {
    in_party_id: one.id, in_name: "洗剪吹 ×10", in_sessions_total: 10,
  });
  check("套票卖得出去", !pe && !!pack1?.id, pe?.message);

  const a1 = await book(one);
  const { data: r1, error: re } = await C.rpc("set_appointment_status", {
    in_id: a1, in_status: "done",
  });
  const got = r1?.[0];
  check("按得下去", !re && !!got, re?.message);
  check("🔴 套票真的少了一次", got?.why === "used", `${got?.why}`);
  check("🔴 而且当场讲得出还剩几次（不讲就是静静扣掉）",
    got?.sessions_left === 9, `${got?.sessions_left}`);
  check("讲得出扣的是哪一张", got?.package_name === "洗剪吹 ×10",
    `${got?.package_name}`);
  check("状态本身照旧写进去了",
    (await admin.from("appointments").select("status").eq("id", a1).single())
      .data?.status === "done",
    "状态没写进去");

  const { data: r1b } = await C.rpc("set_appointment_status", {
    in_id: a1, in_status: "done",
  });
  check("🔴 按两下只少一次", r1b?.[0]?.sessions_left === 9,
    `${r1b?.[0]?.sessions_left}`);
  const { data: uses1 } = await admin
    .from("package_uses").select("id").eq("package_id", pack1.id);
  check("那张套票底下只有一行", (uses1 ?? []).length === 1, `${uses1?.length}`);

  /* ── ② 🔴 两张套票 → 不动，让他自己挑 ───────────────────────── */
  console.log("\n② 🔴 两张套票 → 不动");
  const { data: pack2a } = await C.rpc("add_service_package", {
    in_party_id: two.id, in_name: "洗剪吹 ×10", in_sessions_total: 10,
  });
  const { data: pack2b } = await C.rpc("add_service_package", {
    in_party_id: two.id, in_name: "染发 ×5", in_sessions_total: 5,
  });
  const a2 = await book(two);
  const { data: r2 } = await C.rpc("set_appointment_status", {
    in_id: a2, in_status: "done",
  });
  check("🔴 两张的时候不猜", r2?.[0]?.why === "many_packages", `${r2?.[0]?.why}`);
  /* 🔴 只问这两张自己的套票，不要问整张表——那张表是全库共用的，
     几个星期测试下来早就有别的帐号留下的行，问整张表永远过不了。 */
  const { data: uses2 } = await admin
    .from("package_uses").select("id, package_id")
    .in("package_id", [pack2a.id, pack2b.id]);
  check("🔴 而且两张一次都没有少", (uses2 ?? []).length === 0, JSON.stringify(uses2));

  /* ── ③ 一张都没有 ───────────────────────────────────────────── */
  console.log("\n③ 一张都没有");
  const a3 = await book(none);
  const { data: r3 } = await C.rpc("set_appointment_status", {
    in_id: a3, in_status: "done",
  });
  check("讲一张都没有", r3?.[0]?.why === "no_package", `${r3?.[0]?.why}`);
  check("没有扣任何东西", r3?.[0]?.used_package_id === null,
    `${r3?.[0]?.used_package_id}`);

  /* ── ④ 🔴 只剩过期那一张 → 不替他扣，但也不挡他 ────────────── */
  console.log("\n④ 🔴 只剩过期那一张");
  const { data: expired, error: expErr } = await C.rpc("add_service_package", {
    in_party_id: old.id, in_name: "脸部护理 ×5", in_sessions_total: 5,
    in_sold_on: ymd(-40), in_expires_on: ymd(-10),
  });
  check("道具：那张过期的套票真的存进去了", !expErr && !!expired?.id, expErr?.message);
  const a4 = await book(old);
  const { data: r4 } = await C.rpc("set_appointment_status", {
    in_id: a4, in_status: "done",
  });
  check("🔴 讲的是「只剩过期的那一张」，不是「一张都没有」",
    r4?.[0]?.why === "expired_only", `${r4?.[0]?.why}`);
  check("没有替他扣", r4?.[0]?.used_package_id === null,
    `${r4?.[0]?.used_package_id}`);
  const { error: manualErr } = await C.rpc("use_package_session", {
    in_package_id: expired.id,
  });
  check("🔴 控制组：他自己按照旧扣得下去（过期不挡那一条没有变）",
    !manualErr, manualErr?.message);

  /* ── ⑤ 没连到人 ─────────────────────────────────────────────── */
  console.log("\n⑤ 没连到人");
  const a5 = await book(null);
  const { data: r5 } = await C.rpc("set_appointment_status", {
    in_id: a5, in_status: "done",
  });
  check("讲这一单没有连到人", r5?.[0]?.why === "no_party", `${r5?.[0]?.why}`);

  /* ── ⑥ 不是「来了」的时候，一次都不动 ───────────────────────── */
  console.log("\n⑥ 不是「来了」的时候");
  const { data: pack6 } = await C.rpc("add_service_package", {
    in_party_id: none.id, in_name: "护理 ×3", in_sessions_total: 3,
  });
  const a6 = await book(none);
  for (const st of ["no_show", "cancelled", "booked"]) {
    const { data } = await C.rpc("set_appointment_status", {
      in_id: a6, in_status: st,
    });
    check(`「${st}」不扣套票`, data?.[0]?.why === "not_done", `${data?.[0]?.why}`);
  }
  const { data: uses6 } = await admin
    .from("package_uses").select("id").eq("package_id", pack6.id);
  check("🔴 那张套票一次都没有少", (uses6 ?? []).length === 0, `${uses6?.length}`);

  /* ── ⑦ 用完的那一张不算「能用」───────────────────────────────── */
  console.log("\n⑦ 用完的那一张");
  for (let i = 0; i < 3; i += 1) {
    await C.rpc("use_package_session", {
      in_package_id: pack6.id, in_idempotency_key: crypto.randomUUID(),
    });
  }
  const a7 = await book(none);
  const { data: r7 } = await C.rpc("set_appointment_status", {
    in_id: a7, in_status: "done",
  });
  check("🔴 用完了就不算她有套票", r7?.[0]?.why === "no_package",
    `${r7?.[0]?.why}`);

  /* ── ⑧ 别人家 ───────────────────────────────────────────────── */
  console.log("\n⑧ 别人家");
  const other = await person("other");
  const O = other.client;
  await O.rpc("set_project_style", { new_style: "ledger" });
  const { error: crossErr } = await O.rpc("set_appointment_status", {
    in_id: a1, in_status: "cancelled",
  });
  check("🔴 动不了别人家那一单", !!crossErr, "居然让它过了");

  /* ── ⑨ 🔴 套票跨店共用——[任务 396] 查过：地基本来就有，是记错了 ──
     `service_packages` / `package_uses` / `use_package_session` 从
     建表那天起就没有 branch_id 这一栏，多分店架构（branches）今晚
     count_stock/count_till 都验过是真的在跑——两件事合起来，套票
     天生就是全 project 共用，不是绑死一间店。这里真登入验证一次，
     不是猜。 */
  console.log("\n⑨ 🔴 套票跨店共用");
  const { data: kl } = await C.rpc("add_branch", { in_project_id: P, in_name: "KL" });
  const { data: pj } = await C.rpc("add_branch", { in_project_id: P, in_name: "PJ" });
  const { data: roamer } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Roamer",
  });
  const { data: crossPack } = await C.rpc("add_service_package", {
    in_party_id: roamer.id, in_name: "洗剪吹 ×10", in_sessions_total: 10,
  });
  const { error: klErr } = await C.rpc("use_package_session", {
    in_package_id: crossPack.id, in_note: "used at KL",
  });
  check("🔴 KL 分店用得掉", !klErr, klErr?.message);
  const { error: pjErr } = await C.rpc("use_package_session", {
    in_package_id: crossPack.id, in_note: "used at PJ",
  });
  check("🔴 同一张套票，PJ 分店也用得掉", !pjErr, pjErr?.message);
  const { data: crossUses } = await admin
    .from("package_uses").select("id").eq("package_id", crossPack.id);
  check("🔴 两间店各用一次，一共少两次", (crossUses ?? []).length === 2,
    `${crossUses?.length}`);

  console.log(
    bad.length ? `\n判：${bad.length} 条没过\n  ${bad.join("\n  ")}`
      : `\n判：全部过（${people.length} 个用完就删的帐号）`,
  );
} catch (err) {
  console.error(`\n🔴 尺子自己炸了：${err?.message ?? err}`);
  bad.push("尺子炸了");
} finally {
  await dropThrowaways(admin, people);
  process.exit(bad.length ? 1 : 0);
}

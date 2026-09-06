/**
 * 车厂：一个车牌，跟它做过的每一件事。**用真的登入身分打。**
 *
 * ⚠️ 这一支真正在守的两件：
 *
 *   ① **「wa 1234 a」跟「WA1234A」是同一台车** ——
 *      分得开，同一台车就会在库里变成三台，而历史永远查不到
 *   ② **里程往回走要挡** —— 450,000 打成 45,000 是柜台最常发生的一件事，
 *      而它一旦进去，之后每一次「下一次几公里」都是错的
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

const failed = [];
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failed.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const made = [];
const day = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function signIn(cred) {
  const as = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await as.auth.signInWithPassword(cred);
  if (error) throw new Error(`sign-in: ${error.message}`);
  return as;
}

async function person(tag) {
  const cred = { email: `veh-${tag}-${Date.now()}@formae.test`, password: `Veh-${Date.now()}-x!` };
  const { data: user, error } = await admin.auth.admin.createUser({
    email: cred.email, password: cred.password, email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  made.push(user.user.id);
  return { cred, id: user.user.id, as: await signIn(cred) };
}

try {
  const boss = await person("boss");
  const c = boss.as;
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  for (const k of ["orders", "customers"]) {
    await c.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const { data: owner } = await c.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mr Lim",
    in_whatsapp: "016-777 1234",
  });

  /* ── ① 登记一台车 ──────────────────────────────────────────────────── */
  console.log("\n① 登记一台车");
  const { data: car, error: cErr } = await c.rpc("add_vehicle", {
    in_project_id: P, in_plate: "WA 1234 A", in_party_id: owner.id,
    in_descr: "Perodua Myvi 1.3", in_made_year: 2018, in_service_every_km: 10000,
  });
  check("登记得了", !cErr && !!car?.id, cErr?.message);
  check("他打的那串字原样留着（印在单上的是它）", car?.plate === "WA 1234 A", `${car?.plate}`);

  const { data: same } = await c.rpc("add_vehicle", {
    in_project_id: P, in_plate: "wa1234a",
  });
  check("🔴 「wa1234a」是同一台车，不是第二台", same?.id === car.id, `${same?.id}`);
  const { data: same2 } = await c.rpc("add_vehicle", {
    in_project_id: P, in_plate: "wa-1234-a",
  });
  check("🔴 中间加横杠也是同一台", same2?.id === car.id, `${same2?.id}`);
  const { data: allCars } = await admin
    .from("vehicles").select("id").eq("project_id", P);
  check("库里就一台", (allCars ?? []).length === 1, `${allCars?.length}`);

  const { error: blankErr } = await c.rpc("add_vehicle", { in_project_id: P, in_plate: "  " });
  check("没有车牌要挡", !!blankErr, "空车牌收下了");

  /* ── ② 柜台打车牌 ──────────────────────────────────────────────────── */
  console.log("\n② 他在柜台打车牌");
  const { data: found } = await c.rpc("find_vehicle", { in_project_id: P, in_plate: "wa 1234 a" });
  check("找得到", (found ?? []).length === 1 && found[0].vehicle_id === car.id,
    `${found?.length}`);
  check("🔴 车主跟他的 WhatsApp 一起出来（他要打的就是这一通）",
    found?.[0]?.owner_name === "Mr Lim" && (found?.[0]?.owner_whatsapp ?? "").includes("016"),
    `${found?.[0]?.owner_name} · ${found?.[0]?.owner_whatsapp}`);
  const { data: partial } = await c.rpc("find_vehicle", { in_project_id: P, in_plate: "wa12" });
  check("打前几个字就找得到（客人念他一边打）", (partial ?? []).length === 1,
    `${partial?.length}`);
  check("还没进过厂，上次是空的、里程是空的",
    !found?.[0]?.last_seen && found?.[0]?.last_odometer_km === null,
    `${found?.[0]?.last_seen} · ${found?.[0]?.last_odometer_km}`);
  check("🔴 还没有里程，「该在几公里」就留空（不猜）",
    found?.[0]?.due_at_km === null, `${found?.[0]?.due_at_km}`);

  /* ── ③ 第一次进厂 ──────────────────────────────────────────────────── */
  console.log("\n③ 第一次进厂：45,000 km");
  const { data: job1 } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders",
    in_title: "Service", in_party: "Mr Lim", in_party_id: owner.id,
    in_issued_on: day(-400), in_amount_cents: 28000,
  });
  await c.rpc("set_record_lines", {
    in_record_id: job1.id,
    in_lines: [
      { description: "Engine oil 5W-40", qty: "4", unit: "L", unit_price_cents: "3500" },
      { description: "Oil filter", qty: "1", unit: "pc", unit_price_cents: "3500" },
    ],
  });
  const { data: hung, error: hErr } = await c.rpc("set_record_vehicle", {
    in_record_id: job1.id, in_vehicle_id: car.id, in_odometer_km: 45000,
  });
  check("挂得上那台车", !hErr && hung?.vehicle_id === car.id, hErr?.message);

  const { data: after1 } = await c.rpc("find_vehicle", { in_project_id: P, in_plate: "WA1234A" });
  check("🔴 里程是**算出来的**（历史上最后一笔），不是存在车上的一栏",
    after1?.[0]?.last_odometer_km === 45000, `${after1?.[0]?.last_odometer_km}`);
  check("该在 55,000 km 再来", after1?.[0]?.due_at_km === 55000, `${after1?.[0]?.due_at_km}`);
  check("来过一次", after1?.[0]?.visits === 1, `${after1?.[0]?.visits}`);

  /* ── ④ 🔴 里程往回走 ───────────────────────────────────────────────── */
  console.log("\n④ 🔴 里程往回走");
  const { data: job2 } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders",
    in_title: "Second service", in_party: "Mr Lim", in_party_id: owner.id,
    in_issued_on: day(-200),
  });
  const { error: backErr } = await c.rpc("set_record_vehicle", {
    in_record_id: job2.id, in_vehicle_id: car.id, in_odometer_km: 4500,
  });
  check("🔴 4,500 挡下来了（45,000 少打一个零）", !!backErr, "收下了一个往回走的里程");
  check("🔴 而且讲得出该怎么做",
    /cluster|check the number/i.test(backErr?.message ?? ""), `${backErr?.message}`);
  check("被挡下来之后，那张单还是没有车",
    (await admin.from("pipeline_records").select("vehicle_id").eq("id", job2.id).single())
      .data?.vehicle_id === null, "居然挂上去了");

  const { error: swapErr } = await c.rpc("set_record_vehicle", {
    in_record_id: job2.id, in_vehicle_id: car.id, in_odometer_km: 4500,
    in_allow_rollback: true,
  });
  check("🔴 仪表板真的换过 —— 讲一声就收（那是真的会发生的事）", !swapErr, swapErr?.message);
  /* 收拾回来：这一次真的是 52,000。 */
  await c.rpc("set_record_vehicle", {
    in_record_id: job2.id, in_vehicle_id: car.id, in_odometer_km: 52000,
    in_allow_rollback: true,
  });

  const { data: after2 } = await c.rpc("find_vehicle", { in_project_id: P, in_plate: "WA1234A" });
  check("🔴 改一行就对了（因为它是算出来的，不是存起来的）",
    after2?.[0]?.last_odometer_km === 52000 && after2?.[0]?.due_at_km === 62000,
    `${after2?.[0]?.last_odometer_km} · ${after2?.[0]?.due_at_km}`);

  /* ── ⑤ 这台车做过什么 ──────────────────────────────────────────────── */
  console.log("\n⑤ 这台车做过什么");
  const { data: hist } = await c.rpc("vehicle_history", { in_vehicle_id: car.id });
  check("两次都在", (hist ?? []).length === 2, `${hist?.length}`);
  check("最近的排最前面", hist?.[0]?.odometer_km === 52000, `${hist?.[0]?.odometer_km}`);
  check("🔴 一眼看得出那一次做了什么（不用打开每一张单）",
    (hist ?? []).some((h) => (h.did ?? "").includes("Oil filter")),
    JSON.stringify(hist?.map((h) => h.did)));

  /* ── ⑥ 好久没来的 ──────────────────────────────────────────────────── */
  console.log("\n⑥ 好久没来的那几台");
  const { data: cold } = await c.rpc("vehicles_overdue", { in_project_id: P, in_months: 6 });
  check("六个月没来的名单上有它", (cold ?? []).length === 1 && cold[0].vehicle_id === car.id,
    `${cold?.length}`);
  check("算得出几个月没来", (cold?.[0]?.months_since ?? 0) >= 6, `${cold?.[0]?.months_since}`);
  const { data: cold24 } = await c.rpc("vehicles_overdue", { in_project_id: P, in_months: 24 });
  check("问两年没来的就没有它", (cold24 ?? []).length === 0, `${cold24?.length}`);

  const { data: fresh } = await c.rpc("add_vehicle", {
    in_project_id: P, in_plate: "VBA 88",
  });
  const { data: coldAgain } = await c.rpc("vehicles_overdue", { in_project_id: P, in_months: 6 });
  check("🔴 一台刚登记、从来没进过厂的车不算「跑掉的客人」",
    !(coldAgain ?? []).some((r) => r.vehicle_id === fresh.id),
    JSON.stringify(coldAgain?.map((r) => r.plate)));
  const { error: rangeErr } = await c.rpc("vehicles_overdue", { in_project_id: P, in_months: 999 });
  check("问一个荒谬的区间会被挡", !!rangeErr, "收下了 999 个月");

  /* ── ⑦ 收起来 ──────────────────────────────────────────────────────── */
  console.log("\n⑦ 卖掉了，收起来");
  await c.rpc("set_vehicle_archived", { in_vehicle_id: fresh.id, in_archived: true });
  const { data: goneFind } = await c.rpc("find_vehicle", { in_project_id: P, in_plate: "VBA88" });
  check("收起来就不在柜台的清单上", (goneFind ?? []).length === 0, `${goneFind?.length}`);
  const { data: reborn } = await c.rpc("add_vehicle", { in_project_id: P, in_plate: "VBA 88" });
  check("🔴 同一个车牌可以重新登记一台新的（车换手了）",
    reborn?.id && reborn.id !== fresh.id, `${reborn?.id}`);

  /* 车主删了，车跟历史还在。 */
  await c.rpc("update_vehicle", { in_vehicle_id: car.id, in_clear_party: true });
  const { data: orphan } = await c.rpc("find_vehicle", { in_project_id: P, in_plate: "WA1234A" });
  check("没有车主的车照样查得到，历史照样在",
    (orphan ?? []).length === 1 && orphan[0].last_odometer_km === 52000,
    `${orphan?.[0]?.last_odometer_km}`);

  /* 保养间隔清得掉（一个填进去就拿不掉的值是一个真的 bug）。 */
  await c.rpc("update_vehicle", { in_vehicle_id: car.id, in_clear_service_every_km: true });
  const { data: noInterval } = await c.rpc("find_vehicle", { in_project_id: P, in_plate: "WA1234A" });
  check("保养间隔清得掉，「该在几公里」跟着变空",
    noInterval?.[0]?.service_every_km === null && noInterval?.[0]?.due_at_km === null,
    `${noInterval?.[0]?.due_at_km}`);

  /* ── ⑧ 师傅 ────────────────────────────────────────────────────────── */
  console.log("\n⑧ 师傅");
  const worker = await person("worker");
  await c.rpc("add_project_member", { in_email: worker.cred.email });
  const w = await signIn(worker.cred);
  const { data: wFind } = await w.rpc("find_vehicle", { in_project_id: P, in_plate: "WA1234A" });
  check("🔴 师傅查得到车（那是他一天的工作，不是钱）",
    (wFind ?? []).length === 1, `${wFind?.length}`);
  const { data: wHist } = await w.rpc("vehicle_history", { in_vehicle_id: car.id });
  check("师傅也看得到历史", (wHist ?? []).length === 2, `${wHist?.length}`);

  /* ── ⑨b 🔴 开单的时候顺手挂上车跟里程 ─────────
     `walk:workshop`（[任务 234](../docs/founder-tasks.md#234)）量出来的那一件：
     一台车进厂，柜台本来就是一句话。 */
  console.log("\n⑨b 🔴 开单顺手挂车");
  const { data: oneGo, error: oneErr } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "One press",
    in_party: "Mr Ong", in_amount_cents: 12_000,
    in_vehicle_id: car.id, in_odometer_km: 99_000,
  });
  check("🔴 一次就把车跟里程都挂上去",
    !oneErr && oneGo?.vehicle_id === car.id && Number(oneGo?.odometer_km) === 99_000,
    oneErr?.message ?? `${oneGo?.vehicle_id} / ${oneGo?.odometer_km}`);
  /* 🔴 而那一段走的是 `set_record_vehicle` 同一支 ——
     里程往回走那条守卫只有一份，这一条在量它还在。 */
  const { error: rollErr } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "Rolled back",
    in_party: "Mr Ong", in_amount_cents: 12_000,
    in_vehicle_id: car.id, in_odometer_km: 9_900,
  });
  check("🔴 里程往回走，连那张单一起挡下来", !!rollErr,
    "居然让它过了");
  const { data: ghost } = await c
    .from("pipeline_records").select("id").eq("project_id", P).eq("title", "Rolled back");
  check("🔴 而且那张单没有存下来（一张挂不上车的单比拒绝难发现）",
    (ghost ?? []).length === 0, `${ghost?.length} 张`);

  /* ── ⑨ 别人家 ──────────────────────────────────────────────────────── */
  console.log("\n⑨ 别人家");
  const other = await person("other");
  const { data: oFind } = await other.as.rpc("find_vehicle", {
    in_project_id: P, in_plate: "WA1234A",
  });
  check("别人家查不到这一家的车", (oFind ?? []).length === 0, `${oFind?.length}`);
  const { data: oHist } = await other.as.rpc("vehicle_history", { in_vehicle_id: car.id });
  check("别人家看不到历史", (oHist ?? []).length === 0, `${oHist?.length}`);
  const { data: oRaw } = await other.as.from("vehicles").select("id").eq("project_id", P);
  check("别人家直接读那张表也读不到", (oRaw ?? []).length === 0, `${oRaw?.length}`);
  const { error: oAdd } = await other.as.rpc("add_vehicle", {
    in_project_id: P, in_plate: "XYZ 1",
  });
  check("别人家登记不了车到这一家", !!oAdd, "居然登记得了");
} finally {
  const stuck = await dropThrowaways(admin, made);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
}

console.log(`\n判：${failed.length === 0 ? "全过" : `${failed.length} 条没过`}`);
process.exit(failed.length ? 1 : 0);

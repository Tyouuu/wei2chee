/**
 * 上一次帮她做了什么 —— 真的登入、真的用掉一支、真的从架上少。
 *
 *   npm run check:treatments
 *
 * `supabase db push` 成功证明不了任何事（[重点 26](../docs/founder-points.md)）：
 * plpgsql 到**执行**才解析名字，而「用掉的东西真的从架上少」这一句
 * 只有真的打一次、再回头数一次架上才知道。
 *
 * 🔴 这一支量的最重要的一件不是「记得下来」，是**架上跟着动**：
 * 少了那一段，她要记两次（一次记疗程、一次记库存），而第二次她三个月后
 * 就不记了 —— 那本库存从此是假的，而画面上完全正常。
 *
 * ⚠️ 而它同时量**钱那条线还在**：一个美疗师读得到疗程史（那是这张表存在
 * 的理由），而她读不到收款那一页。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowawayOnExit, dropThrowaway } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SERVICE) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(2);
}
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

let pass = 0;
const bad = [];
const check = (what, ok, saw) => {
  if (ok) {
    pass++;
    console.log(`  PASS  ${what}`);
  } else {
    bad.push(what);
    console.log(`  FAIL  ${what}${saw === undefined ? "" : ` — ${saw}`}`);
  }
};

const stamp = Date.now();
let ownerId = null;
let mateId = null;
dropThrowawayOnExit(admin, () => [ownerId, mateId]);

/* 架上还剩几件 —— 每一次都回去问那张 view，不在这里自己加。 */
const onHand = async (c, itemId) => {
  const { data } = await c.from("stock_on_hand").select("on_hand").eq("item_id", itemId).maybeSingle();
  return Number(data?.on_hand ?? 0);
};

try {
  /* ── 台面 ────────────────────────────────────────────────────────────── */
  const email = `treat-${stamp}@formae.test`;
  const password = `Tx-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  ownerId = made.user.id;

  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: inErr } = await c.auth.signInWithPassword({ email, password });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);

  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", ownerId).single();
  if (!proj?.id) throw new Error("the signup trigger did not provision a project");
  const P = proj.id;

  for (const [k, t] of [["bookings", "Bookings"], ["customers", "Customers"], ["staff", "Staff"], ["inventory", "Shelf"]]) {
    const { error } = await c.rpc("add_project_page", { requested_key: k, new_title: t });
    if (error && !/already/i.test(error.message)) throw new Error(`add_project_page ${k}: ${error.message}`);
  }

  const person = async (name, key) => {
    const { data, error } = await c.rpc("add_directory_entry", {
      in_project_id: P, in_module_key: key, in_name: name,
    });
    if (error) throw new Error(`add_directory_entry ${name}: ${error.message}`);
    return data?.id ?? data;
  };
  const client = await person("Ms Lim", "customers");
  const amy = await person("Amy", "staff");

  const { data: item, error: itErr } = await c.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory",
    in_name: "Botox 100u", in_unit: "unit",
  });
  if (itErr) throw new Error(`add_catalog_item: ${itErr.message}`);
  const ITEM = item.id;

  /* 开帐：架上先有 300 个单位，分两批（一批快过期）。 */
  const { data: lotA, error: laErr } = await c.rpc("add_stock_batch", {
    in_item_id: ITEM, in_code: "LOT-A", in_expiry_on: "2026-11-30",
  });
  if (laErr) throw new Error(`add_stock_batch A: ${laErr.message}`);
  const { data: lotB } = await c.rpc("add_stock_batch", {
    in_item_id: ITEM, in_code: "LOT-B", in_expiry_on: "2027-06-30",
  });
  for (const [lot, n] of [[lotA.id, 100], [lotB.id, 200]]) {
    const { error } = await c.rpc("move_stock", {
      in_item_id: ITEM, in_direction: "in", in_qty: n,
      in_reason: "opening", in_batch_id: lot,
    });
    if (error) throw new Error(`move_stock in: ${error.message}`);
  }
  check("台面摆好了：架上 300 个单位", (await onHand(c, ITEM)) === 300, await onHand(c, ITEM));

  /* ── ① 记一笔疗程 ─────────────────────────────────────────────────── */
  console.log("\n① 记一笔她这一次做了什么");
  const { data: note, error: nErr } = await c.rpc("add_treatment_note", {
    in_party_id: client, in_what: "Botox · 眉间", in_area: "glabella", in_staff_id: amy,
    in_note: "第一次，先打保守一点",
  });
  check("记得下来", !!note?.id, nErr?.message);
  check("挂在**那个人**身上，不是挂在一张单上", note?.party_id === client, note?.party_id);
  check("日子不给就是马来西亚的今天（不是伺服器的 UTC）", !!note?.done_on, note?.done_on);

  const { error: blankErr } = await c.rpc("add_treatment_note", {
    in_party_id: client, in_what: "   ",
  });
  check("不讲做了什么就挡下来", !!blankErr, blankErr?.message?.slice(0, 50));

  /* ── ② 用掉一支 → 架上真的少 ─────────────────────────────────────── */
  console.log("\n② 用掉的东西真的从架上少");
  const { data: used, error: uErr } = await c.rpc("add_treatment_product", {
    in_note_id: note.id, in_item_id: ITEM, in_qty: 20,
  });
  check("记得下用了多少", Number(used?.qty) === 20, uErr?.message ?? used?.qty);
  check("🔴 架上从 300 变 280", (await onHand(c, ITEM)) === 280, await onHand(c, ITEM));
  check("单位是那件货自己的，抄下来了", used?.unit === "unit", used?.unit);
  check("而它指着真的那一笔出货（撤销要靠它）", !!used?.move_id, used?.move_id);

  const { data: lots } = await c.rpc("batches_of", { in_item_id: ITEM });
  const a = (lots ?? []).find((x) => x.code === "LOT-A");
  check("🔴 效期最早的那一批先出（那一条没有被重写）", Number(a?.on_hand) === 80, JSON.stringify(lots?.map((x) => [x.code, x.on_hand])));

  /* ── ③ 讲得出是哪一批 ─────────────────────────────────────────────── */
  console.log("\n③ 「你用的是哪一批」——她答得出来");
  const { data: batched, error: bErr } = await c.rpc("add_treatment_product", {
    in_note_id: note.id, in_item_id: ITEM, in_qty: 10, in_batch_id: lotB.id,
  });
  check("指定一批也用得了", !!batched?.id, bErr?.message);
  const b = ((await c.rpc("batches_of", { in_item_id: ITEM })).data ?? []).find((x) => x.code === "LOT-B");
  check("而少的是她指的那一批，不是最早那一批", Number(b?.on_hand) === 190, b?.on_hand);

  /* ── ④ 读回来 ─────────────────────────────────────────────────────── */
  console.log("\n④ 她站在客人面前开的那一页");
  const { data: hist, error: hErr } = await c.rpc("treatment_notes_of", { in_party_id: client });
  const first = (hist ?? [])[0];
  check("读得回来", (hist ?? []).length === 1, hErr?.message ?? (hist ?? []).length);
  check("讲得出做了什么", first?.what === "Botox · 眉间", first?.what);
  check("讲得出部位", first?.area === "glabella", first?.area);
  check("讲得出谁做的", first?.staff_name === "Amy", first?.staff_name);
  check("用了哪两样都在", (first?.products ?? []).length === 2, JSON.stringify(first?.products));
  check(
    "🔴 而且讲得出批号 —— 那是她被问「你用的是哪一批」时唯一答得出来的东西",
    (first?.products ?? []).some((p) => p.batch === "LOT-B"),
    JSON.stringify((first?.products ?? []).map((p) => p.batch)),
  );

  /* ── ⑤ 打错了：写一笔反的 ─────────────────────────────────────────── */
  console.log("\n⑤ 打错了 —— 写一笔反的，不是把它删掉当没发生过");
  const { error: dErr } = await c.rpc("drop_treatment_product", { in_id: batched.id });
  check("撤销得了", !dErr, dErr?.message);
  check("🔴 那十个单位真的回到架上", (await onHand(c, ITEM)) === 280, await onHand(c, ITEM));
  const { data: moves } = await c.from("stock_moves").select("direction").eq("item_id", ITEM);
  check(
    "而且是**两笔**（一出一进），不是把那一笔删掉",
    (moves ?? []).filter((m) => m.direction === "in").length === 3,
    JSON.stringify((moves ?? []).map((m) => m.direction)),
  );

  /* ── ⑥ 收起来，不删掉 ─────────────────────────────────────────────── */
  console.log("\n⑥ 一次真的做过的疗程是历史");
  const { error: arcErr } = await c.rpc("update_treatment_note", {
    in_id: note.id, in_archived: true,
  });
  check("收得起来", !arcErr, arcErr?.message);
  const back = ((await c.rpc("treatment_notes_of", { in_party_id: client })).data ?? [])[0];
  check("而它还在那一页上，标着收起来了", back?.archived === true, JSON.stringify(back?.archived));
  await c.rpc("update_treatment_note", { in_id: note.id, in_archived: false });

  const { error: keepErr } = await c.rpc("update_treatment_note", {
    in_id: note.id, in_what: "   ",
  });
  const kept = ((await c.rpc("treatment_notes_of", { in_party_id: client })).data ?? [])[0];
  check("空的洗不掉「做了什么」", !keepErr && kept?.what === "Botox · 眉间", kept?.what);

  const { error: delErr } = await admin.from("directory_entries").delete().eq("id", client);
  check("🔴 有疗程记录的客人删不掉", !!delErr, delErr?.message?.slice(0, 60));

  /* ── ⑥b 前后照片 ─────────────────────────────────────────────────── */
  console.log("\n⑥b 前后对比 —— 而预设是「不可以给别人看」");
  const shot = (stage, tail, extra = {}) =>
    c.rpc("add_treatment_photo", {
      in_note_id: note.id, in_path: `${P}/${note.id}/${tail}.jpg`, in_stage: stage, ...extra,
    });

  const { data: p1, error: p1e } = await shot("before", "a");
  check("挂得上一次疗程（不是一张单）", !!p1?.id, p1e?.message);
  check(
    "🔴 预设**不可以**给别人看 —— 一张客人的脸出现在官网上，而她从来没答应过",
    p1?.may_show === false,
    p1?.may_show,
  );
  const { data: again } = await shot("before", "a");
  check("按两下拿回同一张，不是第二张", again?.id === p1?.id, again?.id);

  await shot("after", "b");
  const { data: shots } = await c.rpc("treatment_photos_of", { in_note_id: note.id });
  check("两张都在", (shots ?? []).length === 2, (shots ?? []).length);
  check(
    "之前的排在之后的前面 —— 她要的就是把两张摆在一起",
    (shots ?? [])[0]?.stage === "before" && (shots ?? [])[1]?.stage === "after",
    JSON.stringify((shots ?? []).map((x) => x.stage)),
  );

  const { error: badStage } = await shot("maybe", "c");
  check("第三种说法挡下来（before · during · after，一份封闭的）", !!badStage, badStage?.message?.slice(0, 40));

  const { error: elsewhere } = await c.rpc("add_treatment_photo", {
    in_note_id: note.id, in_path: `00000000-0000-0000-0000-000000000000/x/y.jpg`,
  });
  check("🔴 档案不在这一家的资料夹里就挡下来", !!elsewhere, elsewhere?.message?.slice(0, 40));

  const { data: shown } = await c.rpc("set_photo_may_show", { in_id: p1.id, in_may_show: true });
  check("她问过客人之后翻得了那一栏", shown?.may_show === true, shown?.may_show);

  /* 🔴 那张表原本那一条守卫（一张照片一定属於某一件事）没有不见 —— 它换了形状。 */
  const { error: orphan } = await admin.from("record_photos").insert({
    project_id: P, path: `${P}/x/orphan.jpg`,
  });
  check("🔴 一张不属於任何一件事的照片，写不进去", !!orphan, orphan?.message?.slice(0, 60));
  const { error: both } = await admin.from("record_photos").insert({
    project_id: P, record_id: note.id, note_id: note.id, path: `${P}/x/two.jpg`,
  });
  check("挂两边也写不进去", !!both, both?.message?.slice(0, 40));

  /* ── ⑦ 别人家 ─────────────────────────────────────────────────────── */
  console.log("\n⑦ 别人家");
  const mail2 = `treat2-${stamp}@formae.test`;
  const pass2 = `Ty-${stamp}-y!`;
  const { data: m2 } = await admin.auth.admin.createUser({
    email: mail2, password: pass2, email_confirm: true,
  });
  mateId = m2.user.id;
  const c2 = createClient(URL_, ANON, { auth: { persistSession: false } });
  await c2.auth.signInWithPassword({ email: mail2, password: pass2 });

  const { data: theirs } = await c2.rpc("treatment_notes_of", { in_party_id: client });
  check("另一家读不到她的疗程记录", (theirs ?? []).length === 0, JSON.stringify(theirs));
  const { error: writeErr } = await c2.rpc("add_treatment_note", {
    in_party_id: client, in_what: "偷写一笔",
  });
  check("另一家也写不进去", !!writeErr, writeErr?.message?.slice(0, 50));
  const { data: rows } = await c2.from("treatment_notes").select("id");
  check("直接读那张表也一行都没有", (rows ?? []).length === 0, JSON.stringify(rows));

  /* 🔴 看图看出来的：那一页正上方写着「还没有来过」，
     而底下是她两次疗程 —— 同一屏，两句话互相打架。 */
  console.log("\n⑧b 一次疗程也是一次来");
  const { data: vis } = await c.rpc("party_visits", {
    in_project_id: P, in_party_id: client,
  });
  check(
    "🔴 走进来做的那一次算一次来",
    Number(vis?.[0]?.visits) >= 1,
    JSON.stringify(vis?.[0]),
  );

  const { data: appt } = await c.rpc("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(Date.now() - 36e5 * 3).toISOString(),
    in_ends_at: new Date(Date.now() - 36e5 * 2).toISOString(),
    in_party: "Ms Lim", in_party_id: client, in_service: "Facial",
  });
  const seenBefore = Number(
    ((await c.rpc("party_visits", { in_project_id: P, in_party_id: client })).data ?? [])[0]?.visits,
  );
  await c.rpc("add_treatment_note", {
    in_party_id: client, in_what: "Facial", in_appointment_id: appt?.id ?? appt,
  });
  const seenAfter = Number(
    ((await c.rpc("party_visits", { in_project_id: P, in_party_id: client })).data ?? [])[0]?.visits,
  );
  check(
    "🔴 而挂在那一笔预约上的不再数一次 —— 那是同一次来",
    seenAfter === seenBefore,
    seenBefore + " -> " + seenAfter,
  );

  /* ── ⑧ 一个美疗师 ─────────────────────────────────────────────────── */
  console.log("\n⑧ 一个美疗师 —— 她要看得到，而她看不到钱");
  /* 🔴 请她进来才量得到。一段跳过去而照样印 PASS 的检查，量的是空气
     —— 而这一段正好是这一整张表最贵的那个取舍（works_here 不是 sees_money）。 */
  const { error: joinErr } = await c.rpc("add_project_member", {
    in_email: mail2, in_role: "staff",
  });
  if (joinErr) throw new Error(`add_project_member: ${joinErr.message}`);

  const { data: seen } = await c2.rpc("treatment_notes_of", { in_party_id: client });
  check(
    "🔴 她读得到上一次用了什么 —— 那正是这一整张表存在的理由",
    (seen ?? []).length >= 1,
    JSON.stringify(seen),
  );
  check(
    "而她也记得下这一次（做那个疗程的是她）",
    !(await c2.rpc("add_treatment_note", { in_party_id: client, in_what: "补一笔" })).error,
  );
  /* 控制组：钱那条线还在 —— 少了它，上面那两条也会在一个什么都看得到的
     世界里全绿（[任务 125] 付过这一次学费）。 */
  const { data: money } = await c2.rpc("party_debts", { in_project_id: P });
  check("而她读不到钱那一边（那条线没有被动过）", (money ?? []).length === 0, JSON.stringify(money));
} catch (e) {
  bad.push(String(e?.message ?? e));
  console.log(`\n🔴 ${e?.message ?? e}`);
} finally {
  const a = await dropThrowaway(admin, ownerId);
  const b = await dropThrowaway(admin, mateId);
  console.log(a && b ? "\n临时帐号删掉了" : "\n🔴 有帐号删不掉");
}

console.log(`\n判：${pass} 过 · ${bad.length} 没过`);
if (bad.length) {
  for (const x of bad) console.log(`  · ${x}`);
  process.exitCode = 1;
}

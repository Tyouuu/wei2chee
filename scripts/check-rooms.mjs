/**
 * 一间 medi spa 订的是房间 —— 真的登入、真的排、真的撞一次。
 *
 *   npm run check:rooms
 *
 * `supabase db push` 成功证明不了任何事：plpgsql 到**执行**才解析名字，
 * 而排他约束要真的撞过才知道它挡的是哪一件
 * （[重点 26](../docs/founder-points.md)）。
 *
 * 🔴 它量的重点不是「挡不挡得住」，是**挡住之后那句话讲的是哪一件** ——
 * 「Amy 那个时间有人了」跟「那间房那个时间有人了」，她下一步做的事完全
 * 不一样（换一个人 · 换一间房）。一句笼统的「那个时间被占了」会让她两件
 * 都试一次。
 *
 * ⚠️ 而这一支同时是那条「加，不是收紧」的证据：最后一段是**控制组** ——
 * 一间不用房间的店，同一个时间照旧排得进去。
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

try {
  /* ── 台面 ────────────────────────────────────────────────────────────── */
  const email = `rooms-${stamp}@formae.test`;
  const password = `Rm-${stamp}-x!`;
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

  const { error: pgErr } = await c.rpc("add_project_page", {
    requested_key: "bookings", new_title: "Bookings",
  });
  if (pgErr) throw new Error(`add_project_page: ${pgErr.message}`);

  const person = async (name) => {
    const { data, error } = await c.rpc("add_directory_entry", {
      in_project_id: P, in_module_key: "staff", in_name: name,
    });
    if (error) throw new Error(`add_directory_entry ${name}: ${error.message}`);
    return data?.id ?? data;
  };
  const amy = await person("Amy");
  const jas = await person("Jasmine");

  const day = new Date();
  day.setDate(day.getDate() + 2);
  const at = (h, m = 0) => {
    const d = new Date(day);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const book = (over = {}) =>
    c.rpc("add_appointment", {
      in_project_id: P, in_module_key: "bookings",
      in_starts_at: at(10), in_ends_at: at(11),
      in_party: "客人", in_service: "面部护理", ...over,
    });

  /* ── ① 开一间房 ───────────────────────────────────────────────────── */
  console.log("\n① 开一间房");
  const { data: r1, error: r1Err } = await c.rpc("add_room", {
    in_project_id: P, in_name: "1 号房",
  });
  check("老板开得了一间房", !!r1?.id, r1Err?.message);
  const { data: r2 } = await c.rpc("add_room", { in_project_id: P, in_name: "激光室" });
  check("第二间也开得了", !!r2?.id && r2.id !== r1?.id);

  const { data: again } = await c.rpc("add_room", { in_project_id: P, in_name: "1 号房" });
  check("同一个名字再打一次，拿回原本那一间（不是报错）", again?.id === r1?.id, again?.id);

  const { data: list } = await c.rpc("rooms_of", { in_project_id: P });
  check("列得出来，两间", (list ?? []).length === 2, JSON.stringify(list));

  const { error: blankErr } = await c.rpc("add_room", { in_project_id: P, in_name: "   " });
  check("没有名字的房开不了", !!blankErr, blankErr?.message?.slice(0, 50));

  /* ── ② 排进一间房 ──────────────────────────────────────────────────── */
  console.log("\n② 排进一间房");
  const a = await book({ in_staff_id: amy, in_room_id: r1.id });
  check("排得进去", !!a.data, a.error?.message);

  const { data: row } = await admin
    .from("appointments").select("room_id").eq("id", a.data).single();
  check("那一笔真的挂在那一间房上", row?.room_id === r1.id, row?.room_id);

  /* ── ③ 🔴 同一间房不准排两个人，而那句话要讲得出是房间 ───────────── */
  console.log("\n③ 同一间房，同一个时间");
  /* ⚠️ 换一个师傅 —— 不然先撞到的是**师傅**那一条，量到的就不是这一件。 */
  const clash = await book({ in_staff_id: jas, in_room_id: r1.id, in_starts_at: at(10, 30), in_ends_at: at(11, 30) });
  check("挡下来了", !!clash.error, clash.data);
  check(
    "🔴 而且讲的是**房间**，不是笼统的「那个时间被占了」",
    /room/i.test(clash.error?.message ?? ""),
    clash.error?.message,
  );

  /* ── ④ 而师傅那一条照旧讲师傅 —— 两句分得开才有用 ─────────────────── */
  console.log("\n④ 同一个师傅，两间不同的房");
  const sameStaff = await book({ in_staff_id: amy, in_room_id: r2.id, in_starts_at: at(10, 15), in_ends_at: at(11, 15) });
  check("也挡下来了", !!sameStaff.error, sameStaff.data);
  check(
    "🔴 而它讲的**不是**房间 —— 两句话分得开",
    !!sameStaff.error && !/room/i.test(sameStaff.error.message ?? ""),
    sameStaff.error?.message,
  );

  /* ── ⑤ 换一间房、换一个人，同一个钟头照样排得进 ───────────────────── */
  console.log("\n⑤ 换一间房");
  const other = await book({ in_staff_id: jas, in_room_id: r2.id, in_service: "激光" });
  check("同一个时间、另一间房、另一个人 —— 排得进去", !!other.data, other.error?.message);

  /* ── ⑥ 取消掉的那一笔放开它的房 ───────────────────────────────────── */
  console.log("\n⑥ 取消掉的放开那一间房");
  const { error: cxErr } = await c.rpc("set_appointment_status", {
    in_id: a.data, in_status: "cancelled",
  });
  check("取消得了", !cxErr, cxErr?.message);
  /* ⚠️ 用 Amy 不是 Jasmine —— Jasmine 十点那一笔在第 ⑤ 段排进去了，
     拿她来试会先撞到**师傅**那一条，量到的就不是这一件。第一次跑就红过。 */
  const afterCancel = await book({ in_staff_id: amy, in_room_id: r1.id });
  check("那一间房那个时段空回来了", !!afterCancel.data, afterCancel.error?.message);

  /* ── ⑦ 挡起来的时段照样占着那一间房 ───────────────────────────────── */
  console.log("\n⑦ 挡起来的时段");
  const blocked = await book({
    in_kind: "block", in_party: "", in_service: "", in_room_id: r2.id,
    in_starts_at: at(14), in_ends_at: at(15), in_note: "消毒",
  });
  check("挡得起来（一个 block 不用写客人）", !!blocked.data, blocked.error?.message);
  const intoBlock = await book({
    in_staff_id: amy, in_room_id: r2.id, in_starts_at: at(14, 30), in_ends_at: at(15, 30),
  });
  check("而那段时间那一间房排不进去", !!intoBlock.error, intoBlock.data);

  /* ── ⑧ 三点还有哪一间房 ───────────────────────────────────────────── */
  console.log("\n⑧ 那个钟头哪一间房空着");
  const { data: free, error: freeErr } = await c.rpc("rooms_free", {
    in_project_id: P, in_starts_at: at(14), in_ends_at: at(15),
  });
  check("答得出来", Array.isArray(free) && free.length === 2, freeErr?.message);
  const laser = (free ?? []).find((x) => x.name === "激光室");
  const one = (free ?? []).find((x) => x.name === "1 号房");
  check("挡起来的那一间写着有人", laser?.busy === true, JSON.stringify(laser));
  check("而且讲得出是什么占着（消毒）", (laser?.busy_with ?? "").includes("消毒"), laser?.busy_with);
  check("另一间是空的", one?.busy === false, JSON.stringify(one));

  /* ── ⑨ 别人家的房 · 关掉的房 ──────────────────────────────────────── */
  console.log("\n⑨ 挡不该排的");
  const { data: closed } = await c.rpc("set_room_active", { in_id: r2.id, in_active: false });
  check("关得掉", closed?.active === false, JSON.stringify(closed));
  const intoClosed = await book({
    in_staff_id: amy, in_room_id: r2.id, in_starts_at: at(18), in_ends_at: at(19),
  });
  check("关掉的房排不进去", !!intoClosed.error, intoClosed.data);
  await c.rpc("set_room_active", { in_id: r2.id, in_active: true });

  const { data: stillList } = await c.rpc("rooms_of", { in_project_id: P });
  check("关掉不是删掉 —— 它还在名单上", (stillList ?? []).length === 2);

  /* ── ⑩ 另一家 ─────────────────────────────────────────────────────── */
  console.log("\n⑩ 另一家公司");
  const mateEmail = `rooms-mate-${stamp}@formae.test`;
  const matePass = `Rm-${stamp}-y!`;
  const { data: mate, error: mateErr } = await admin.auth.admin.createUser({
    email: mateEmail, password: matePass, email_confirm: true,
  });
  if (mateErr) throw new Error(`createUser mate: ${mateErr.message}`);
  mateId = mate.user.id;
  const m = createClient(URL_, ANON, { auth: { persistSession: false } });
  await m.auth.signInWithPassword({ email: mateEmail, password: matePass });
  const { data: mp } = await admin
    .from("projects").select("id").eq("account_id", mateId).single();

  const { data: theirs } = await m.rpc("rooms_of", { in_project_id: P });
  check("别人家的房他列不出来", (theirs ?? []).length === 0, JSON.stringify(theirs));

  const { error: crossErr } = await m.rpc("add_appointment", {
    in_project_id: mp.id, in_module_key: "bookings",
    in_starts_at: at(10), in_ends_at: at(11),
    in_party: "客人", in_room_id: r1.id,
  });
  check("排不进别人家的房", !!crossErr, crossErr?.message?.slice(0, 60));

  /* ── ⑪ 🔴 控制组：不用房间的店，一个字都没变 ─────────────────────── */
  console.log("\n⑪ 控制组 —— 一间不用房间的店");
  const noRoomA = await book({ in_staff_id: amy, in_starts_at: at(20), in_ends_at: at(21) });
  const noRoomB = await book({ in_staff_id: jas, in_starts_at: at(20), in_ends_at: at(21) });
  check("两个师傅同一个钟头、都没讲房间 —— 照旧排得进去",
    !!noRoomA.data && !!noRoomB.data,
    `${noRoomA.error?.message ?? "ok"} / ${noRoomB.error?.message ?? "ok"}`);
  const sameOne = await book({ in_staff_id: amy, in_starts_at: at(20, 30), in_ends_at: at(21, 30) });
  check("而同一个师傅照旧挡得住（那一条没有被动过）", !!sameOne.error, sameOne.data);

  /* ── ⑫ 有预约的房删不掉 ───────────────────────────────────────────── */
  console.log("\n⑫ 用过的房删不掉");
  const { error: delErr } = await admin.from("rooms").delete().eq("id", r1.id);
  check("删不掉 —— 去年在那一间房做过的预约还挂着", !!delErr, delErr?.message?.slice(0, 60));
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

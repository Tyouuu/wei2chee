/**
 * 作品集——沙龙 Lookbook 那一页的作品表（[任务 415] 第 1 项，
 * 20260925040000）。用真的登入身分打每一支——`db push` 成功证明不了任何事
 * （[重点 26]）。
 *
 * 守的是：
 *   ① 一份作品存下来的样子：名字跟字段修剪过、标签去重去空白、师傅跟照片都
 *      落在这一家
 *   ② 输入被挡：没名字 · 别家的师傅 · 不是师傅的人 · 别家的照片 · 没传上去的
 *      照片 · 路径想逃出资料夹 · 超过八个标签
 *   ③ 按两下：同一把钥匙回同一份
 *   ④ 老板跟师傅都写得了；别人家的写不了、读不到、收不起来
 *   ⑤ 收起来是标记不是删掉；表本身没有直接写的路
 *   ⑥ 🔴 照片在私人的桶里：这一家的人签得出网址，别人签不出、也传不进这一家的资料夹
 *   ⑦ 🔴 删掉一位师傅，她的作品还在（`stylist_id` 故意没有外键）；
 *      删整个帐号带着作品走得通
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

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** 删掉一个帐号不会删它在桶里的档案——测试传上去的照片要自己收（不留垃圾在私人的桶里）。 */
async function removeFolders(admin, folders) {
  for (const folder of folders) {
    const { data } = await admin.storage.from("job-photos").list(folder);
    if (data?.length) await admin.storage.from("job-photos").remove(data.map((f) => `${folder}/${f.name}`));
  }
}

const folders = [];
const people = [];
async function person(tag) {
  const email = `lkb-${tag}-${stamp}@formae.test`;
  const password = `Lkb-${stamp}-x!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  people.push(data.user.id);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`signIn(${tag}): ${e2.message}`);
  return { id: data.user.id, email, client };
}

/** 用他自己的登入传一张照片进 job-photos（桶那一边的 RLS 才是真的边界）。 */
const upload = (who, path) =>
  who.client.storage.from("job-photos").upload(path, PNG, { contentType: "image/png", upsert: false });

try {
  const boss = await person("boss");
  const { data: proj } = await admin.from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  folders.push(`${P}/lookbook`, `${P}/somewhere-else`);
  const C = boss.client;
  await C.rpc("add_project_page", { requested_key: "staff", new_title: "" });
  await C.rpc("add_project_page", { requested_key: "customers", new_title: "" });

  const { data: amy } = await C.rpc("add_directory_entry", { in_project_id: P, in_module_key: "staff", in_name: "Amy" });
  const { data: guest } = await C.rpc("add_directory_entry", { in_project_id: P, in_module_key: "customers", in_name: "A Guest" });

  const other = await person("other");
  const { data: oproj } = await admin.from("projects").select("id").eq("account_id", other.id).single();
  const OP = oproj.id;
  await other.client.rpc("add_project_page", { requested_key: "staff", new_title: "" });
  const { data: theirStylist } = await other.client.rpc("add_directory_entry", { in_project_id: OP, in_module_key: "staff", in_name: "Their Stylist" });

  const staff = await person("staff");
  const added = await C.rpc("add_project_member", { in_email: staff.email });
  check("前提：员工加进来了", !added.error, added.error?.message);

  const work = (over = {}, client = C, project = P) =>
    client.rpc("add_lookbook_work", { in_project_id: project, in_title: "Smoky Mocha Melt", ...over });
  const photoPath = () => `${P}/lookbook/${crypto.randomUUID()}.png`;

  /* ── ① 一份完整的作品 ─────────────────────────────────────── */
  console.log("\n① 存一份作品");
  const p1 = photoPath();
  const up1 = await upload(boss, p1);
  check("前提：照片传得上去（老板自己的登入，自己那一家的资料夹）", !up1.error, up1.error?.message);
  const { data: w1, error: e1 } = await work({
    in_title: "  Smoky Mocha Melt  ", in_category: " Balayage ", in_level: " 6.1 ",
    in_formula: " Majirel 6.1 (35g) + 20 vol ", in_note: " cool ash finish ",
    in_tags: ["  Warm ", "warm", "", "Copper", "WARM", "   "],
    in_stylist_id: amy.id, in_photo_path: p1,
  });
  check("存得下去", !e1 && !!w1?.id, e1?.message);
  check("🔴 名字跟各栏前后空白修剪过", w1?.title === "Smoky Mocha Melt" && w1?.category === "Balayage" && w1?.level === "6.1" && w1?.formula === "Majirel 6.1 (35g) + 20 vol" && w1?.note === "cool ash finish", JSON.stringify(w1));
  check("🔴 标签去空白、去重复（大小写不同算重复）、去空的：[Warm, Copper]", JSON.stringify(w1?.tags) === JSON.stringify(["Warm", "Copper"]), JSON.stringify(w1?.tags));
  check("师傅跟照片都记下来了", w1?.stylist_id === amy.id && w1?.photo_path === p1, JSON.stringify([w1?.stylist_id, w1?.photo_path]));
  check("🔴 谁加的是登入的人（不是页面传的）", w1?.created_by === boss.id, `${w1?.created_by}`);
  check("还没收起来", w1?.archived_at === null, `${w1?.archived_at}`);

  /* ── ② 只有名字也行 ───────────────────────────────────────── */
  console.log("\n② 只有名字");
  const { data: w2, error: e2 } = await work({ in_title: "Just a name" });
  check("🔴 只有名字也存得下去（照片、师傅、配方都是选填）", !e2 && w2?.title === "Just a name" && w2?.photo_path === "" && w2?.stylist_id === null && w2?.tags?.length === 0 && w2?.formula === "", e2?.message ?? JSON.stringify(w2));

  /* ── ③ 输入被挡 ───────────────────────────────────────────── */
  console.log("\n③ 输入被挡");
  // 数一家有几份。查询自己失败要炸出来，不能当成 0（那会把一次网络抖动读成「多了 N 份」）。
  const countWorks = async (project) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await admin.from("lookbook_works").select("id", { count: "exact", head: true }).eq("project_id", project);
      if (!r.error && typeof r.count === "number") return r.count;
      await new Promise((res) => setTimeout(res, 400));
    }
    throw new Error("数不出有几份作品（查询一直失败）");
  };
  const rejects = async (name, over, client = C, project = P) => {
    const before = await countWorks(project);
    const { error } = await work(over, client, project);
    const after = await countWorks(project);
    check(`🔴 ${name}`, !!error && after === before, error ? `多了 ${after - before} 份（错误：${error.message}）` : "居然让它过了");
  };
  await rejects("没写名字", { in_title: "" });
  await rejects("名字全是空白", { in_title: "   " });
  await rejects("师傅是别人家的", { in_stylist_id: theirStylist.id });
  await rejects("师傅编号是编出来的", { in_stylist_id: crypto.randomUUID() });
  await rejects("「师傅」其实是一位客人（不是这一家的师傅）", { in_stylist_id: guest.id });
  await rejects("照片路径在别人家的资料夹里", { in_photo_path: `${OP}/lookbook/${crypto.randomUUID()}.png` });
  const outside = `${P}/somewhere-else/${crypto.randomUUID()}.png`;
  await upload(boss, outside);
  await rejects("照片路径在这一家但不在 lookbook 资料夹里（哪怕档案真的存在）", { in_photo_path: outside });
  await rejects("路径想用 .. 逃出资料夹", { in_photo_path: `${P}/lookbook/../${crypto.randomUUID()}.png` });
  await rejects("照片路径写了但档案根本没传上去", { in_photo_path: photoPath() });
  await rejects("九个标签", { in_tags: ["a", "b", "c", "d", "e", "f", "g", "h", "i"] });
  const { data: w3 } = await work({
    in_title: "T".repeat(300), in_category: "C".repeat(200), in_level: "L".repeat(50),
    in_formula: "F".repeat(3000), in_note: "N".repeat(1000), in_tags: ["x".repeat(100)],
  });
  check("过长的字截断而不是整份挡掉（她写了一大段配方不该丢）",
    w3?.title?.length === 120 && w3?.category?.length === 60 && w3?.level?.length === 12 && w3?.formula?.length === 1000 && w3?.note?.length === 300 && w3?.tags?.[0]?.length === 40,
    JSON.stringify([w3?.title?.length, w3?.category?.length, w3?.level?.length, w3?.formula?.length, w3?.note?.length, w3?.tags?.[0]?.length]));

  /* ── ④ 按两下 ─────────────────────────────────────────────── */
  console.log("\n④ 按两下");
  const key = crypto.randomUUID();
  const { data: k1 } = await work({ in_title: "Twice", in_idempotency_key: key });
  const { data: k2, error: k2e } = await work({ in_title: "Twice", in_idempotency_key: key });
  check("🔴 同一把钥匙第二次不报错，回的是第一份", !k2e && k1?.id && k2?.id === k1.id, k2e?.message ?? `${k1?.id} vs ${k2?.id}`);
  const { data: kRows } = await admin.from("lookbook_works").select("id").eq("project_id", P).eq("title", "Twice");
  check("🔴 库里只有一份", kRows?.length === 1, `${kRows?.length}`);

  /* ── ⑤ 谁写得了 ───────────────────────────────────────────── */
  console.log("\n⑤ 员工 · 别人家");
  const { data: sw, error: swErr } = await work({ in_title: "By the stylist" }, staff.client);
  check("员工（站在这家店里做事的人）加得了作品", !swErr && sw?.created_by === staff.id, swErr?.message);
  const { data: staffRead } = await staff.client.from("lookbook_works").select("id").eq("project_id", P);
  check("员工读得到这一家的作品", (staffRead ?? []).length >= 3, `${staffRead?.length}`);

  const { error: crossAdd } = await work({ in_title: "Stolen" }, other.client, P);
  check("🔴 别人家的老板加不进我这一家", !!crossAdd, "居然让它过了");
  const { data: crossRead } = await other.client.from("lookbook_works").select("id").eq("project_id", P);
  check("🔴 别人家的老板读不到我的作品", (crossRead ?? []).length === 0, `${crossRead?.length}`);
  const { error: crossArchive } = await other.client.rpc("set_lookbook_work_archived", { in_id: w1.id, in_archived: true });
  check("🔴 别人家的老板收不起我的作品", !!crossArchive, "居然让它过了");
  const { data: stillLive } = await admin.from("lookbook_works").select("archived_at").eq("id", w1.id).single();
  check("那一下没有动到它", stillLive?.archived_at === null, `${stillLive?.archived_at}`);
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: anonAdd } = await anon.rpc("add_lookbook_work", { in_project_id: P, in_title: "Nobody" });
  check("🔴 没登入的人加不了", !!anonAdd, "居然让它过了");

  /* ── ⑥ 收起来 ─────────────────────────────────────────────── */
  console.log("\n⑥ 收起来");
  const { data: a1, error: a1e } = await C.rpc("set_lookbook_work_archived", { in_id: w2.id, in_archived: true });
  check("收得起来", !a1e && !!a1?.archived_at, a1e?.message);
  const { data: a1again } = await C.rpc("set_lookbook_work_archived", { in_id: w2.id, in_archived: true });
  check("🔴 收两次：第一次的时间不被改掉", a1again?.archived_at === a1?.archived_at, `${a1again?.archived_at} vs ${a1?.archived_at}`);
  const { data: kept } = await admin.from("lookbook_works").select("id, title").eq("id", w2.id);
  check("🔴 那一份还在库里——是标记，不是删掉", kept?.length === 1, `${kept?.length}`);
  const { data: back } = await C.rpc("set_lookbook_work_archived", { in_id: w2.id, in_archived: false });
  check("放得回来", back?.archived_at === null, `${back?.archived_at}`);
  const { data: staffArchive, error: saErr } = await staff.client.rpc("set_lookbook_work_archived", { in_id: sw.id, in_archived: true });
  check("员工也收得起来（那是作品集，不是钱）", !saErr && !!staffArchive?.archived_at, saErr?.message);

  /* ── ⑦ 表本身没有写的路 ───────────────────────────────────── */
  console.log("\n⑦ 直接写表");
  const { error: directInsert } = await C.from("lookbook_works").insert({ project_id: P, title: "Sneaky" });
  check("🔴 老板自己也不能绕过函式直接塞一份（照片、师傅就没有人验了）", !!directInsert, "居然让它过了");
  await C.from("lookbook_works").update({ title: "Renamed" }).eq("id", w1.id);
  const { data: unchanged } = await admin.from("lookbook_works").select("title").eq("id", w1.id).single();
  check("🔴 直接改一份改不动", unchanged?.title === "Smoky Mocha Melt", `${unchanged?.title}`);
  await C.from("lookbook_works").delete().eq("id", w1.id);
  const { data: notDeleted } = await admin.from("lookbook_works").select("id").eq("id", w1.id);
  check("🔴 直接删不掉", notDeleted?.length === 1, `${notDeleted?.length}`);

  /* ── ⑧ 照片在私人的桶里 ───────────────────────────────────── */
  console.log("\n⑧ 照片");
  const { data: signedOwn, error: signedOwnErr } = await C.storage.from("job-photos").createSignedUrl(p1, 60);
  check("这一家的老板签得出那张照片的网址", !signedOwnErr && !!signedOwn?.signedUrl, signedOwnErr?.message);
  const { data: signedStaff } = await staff.client.storage.from("job-photos").createSignedUrl(p1, 60);
  check("这一家的员工也签得出", !!signedStaff?.signedUrl);
  const { data: signedOther } = await other.client.storage.from("job-photos").createSignedUrl(p1, 60);
  check("🔴 别人家的老板签不出我的照片网址", !signedOther?.signedUrl, `${signedOther?.signedUrl?.slice(0, 40)}`);
  const upOther = await other.client.storage.from("job-photos").upload(`${P}/lookbook/${crypto.randomUUID()}.png`, PNG, { contentType: "image/png" });
  check("🔴 别人家的老板传不进我这一家的资料夹", !!upOther.error, "居然让它过了");
  const res = await fetch(signedOwn.signedUrl);
  check("签出来的网址真的拿得到那张图（不是一个空壳网址）", res.ok && (await res.arrayBuffer()).byteLength === PNG.length, `${res.status}`);

  /* ── ⑨ 师傅被删、整个帐号被删 ─────────────────────────────── */
  console.log("\n⑨ 删掉师傅 · 删掉帐号");
  const { error: delStylistErr } = await admin.from("directory_entries").delete().eq("id", amy.id);
  check("前提：师傅那一格删得掉", !delStylistErr, delStylistErr?.message);
  const { data: afterStylist } = await admin.from("lookbook_works").select("id, stylist_id, title").eq("id", w1.id);
  check("🔴 师傅删了，她的作品还在（只是少一个名字，不是连作品一起没了）", afterStylist?.length === 1 && afterStylist[0].title === "Smoky Mocha Melt", JSON.stringify(afterStylist));

  const { error: delAcctErr } = await admin.auth.admin.deleteUser(boss.id);
  check("🔴 带着几份作品把整个帐号删掉：删得掉", !delAcctErr, delAcctErr?.message);
  const { data: gone } = await admin.from("lookbook_works").select("id").eq("project_id", P);
  check("作品跟着帐号一起清掉了", (gone ?? []).length === 0, `${gone?.length}`);
  people.splice(people.indexOf(boss.id), 1);

  console.log(
    bad.length ? `\n判：${bad.length} 条没过\n  ${bad.join("\n  ")}` : `\n判：全部过（${people.length + 1} 个用完就删的帐号）`,
  );
} catch (err) {
  console.error(`\n🔴 尺子自己炸了：${err?.message ?? err}`);
  bad.push("尺子炸了");
} finally {
  await removeFolders(admin, folders);
  await dropThrowaways(admin, people);
  process.exit(bad.length ? 1 : 0);
}

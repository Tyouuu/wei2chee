/**
 * 沙龙的 Lookbook & Formulas——作品表接上了（[任务 415] 第 1 项，
 * 20260925040000）。真登入、真资料库、真浏览器、真的传一张照片进私人的桶。
 *
 * ── 为什么（2026-09-25）────────────────────────────────────────────────
 *
 * 这一页原来是六张设计自带的示例卡（别人的照片、编的配方），
 * 「Add Hairstyle Case」只弹一句「还没接」。现在每一张卡是她自己存的作品。
 *
 * 验：
 *   A 还没有作品：三张带「Example」标签的示例卡，不能按任何动作（Apply to Ticket
 *     会把一个编出来的配方写进真客人的 note）
 *   B 用画面真的加一份（带照片）：照片真的进了私人的桶、签出来的网址真的载得出图、
 *     标签去重、师傅落在她名下；示例卡消失
 *   C 分类 · 搜寻 · 肤色 · 明度 · 排序 全部是从真资料算的
 *   D Present Look 全屏（不带配方）· 复制 · Apply to Ticket 接在原来的 note 后面
 *   E 移除要先问一句，收起来不删；分类的数字跟着变
 *   F 出错：没名字 · 九个标签（照片留着重试，取消就把它收回去，不留孤儿档）
 *   G 重新载入还在；师傅（员工）也看得到、加得了
 *
 * 用完就删。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";

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

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".screenshots/lookbook-real";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。`);
  process.exit(2);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

let userId = null;
dropThrowawayOnExit(admin, () => userId);

const pass = [];
const fail = [];
const ok = (m) => { pass.push(m); console.log(`  PASS  ${m}`); };
const no = (m, got) => { fail.push(m); console.log(`  FAIL  ${m}${got === undefined ? "" : ` — ${got}`}`); };
const check = (m, cond, got) => (cond ? ok(m) : no(m, got));
const until = async (fn, ms = 30000) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await fn().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
};

/** 删掉一个帐号不会删它在桶里的档案——测试传上去的照片要自己收（不留垃圾在私人的桶里）。 */
async function removeFolders(admin, folders) {
  for (const folder of folders) {
    const { data } = await admin.storage.from("job-photos").list(folder);
    if (data?.length) await admin.storage.from("job-photos").remove(data.map((f) => `${folder}/${f.name}`));
  }
}

let browser;
let lookbookFolder = null;
try {
  const stamp = Date.now();
  const email = `look-${stamp}@formae.test`;
  const password = `Lk-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email, password });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");
  const pid = proj.id;
  lookbookFolder = `${pid}/lookbook`;

  for (const k of ["customers", "staff"]) await api.rpc("add_project_page", { requested_key: k, new_title: "" });
  const guest = await api.rpc("add_directory_entry", { in_project_id: pid, in_module_key: "customers", in_name: "Lookbook-Test Guest" });
  if (guest.error) throw new Error(`guest: ${guest.error.message}`);
  await admin.from("directory_entries").update({ note: "Allergic to ammonia" }).eq("id", guest.data.id);
  const amy = await api.rpc("add_directory_entry", { in_project_id: pid, in_module_key: "staff", in_name: "Lookbook-Test Amy" });
  if (amy.error) throw new Error(`amy: ${amy.error.message}`);

  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1700, height: 1300 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  let alerts = 0;
  page.on("dialog", (d) => { alerts += 1; d.dismiss().catch(() => {}); });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  const goLookbook = () => page.goto(`${BASE}/en/salon-preview/lookbook`, { waitUntil: "networkidle", timeout: 180000 });
  const cards = () => page.getByTestId("lookbook-card");
  const titles = async () => (await cards().locator("h2").allInnerTexts()).map((t) => t.trim());
  const works = async () =>
    (await admin.from("lookbook_works").select("*").eq("project_id", pid).order("created_at", { ascending: true })).data ?? [];
  const photoFiles = async () => (await admin.storage.from("job-photos").list(`${pid}/lookbook`)).data?.filter((f) => f.name) ?? [];

  // 一张真的图（渐层），不是一格 1×1 的点
  const photo = async () => {
    const b64 = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 800; c.height = 1000;
      const x = c.getContext("2d");
      const g = x.createLinearGradient(0, 0, 800, 1000);
      g.addColorStop(0, "#5a3b2b"); g.addColorStop(0.55, "#a6774f"); g.addColorStop(1, "#e2c29b");
      x.fillStyle = g; x.fillRect(0, 0, 800, 1000);
      return c.toDataURL("image/png").split(",")[1];
    });
    return { name: "look.png", mimeType: "image/png", buffer: Buffer.from(b64, "base64") };
  };

  /** 在打开的面板里填一份。 */
  const fill = async (f) => {
    const panel = page.getByRole("dialog", { name: "Add a hairstyle case" });
    if (f.title !== undefined) await panel.getByLabel("Name of the look").fill(f.title);
    if (f.category !== undefined) await panel.getByLabel("Category").fill(f.category);
    if (f.level !== undefined) await panel.getByLabel("Lift level").fill(f.level);
    if (f.stylist !== undefined) await panel.getByLabel("Done by").selectOption({ label: f.stylist });
    if (f.formula !== undefined) await panel.getByLabel("Formula").fill(f.formula);
    if (f.note !== undefined) await panel.getByLabel("One line about it").fill(f.note);
    if (f.tags !== undefined) await panel.getByLabel("Tags").fill(f.tags);
    if (f.photo) await panel.getByLabel("Photo of the look").setInputFiles(f.photo);
    return panel;
  };
  const openAdd = async () => {
    await page.getByRole("button", { name: "Add Hairstyle Case" }).click();
    await page.getByRole("dialog", { name: "Add a hairstyle case" }).waitFor();
  };
  const submitAdd = async () => page.getByRole("dialog", { name: "Add a hairstyle case" }).getByRole("button", { name: "Add to Lookbook" }).click();

  // ═══ A 还没有作品 ═══
  console.log("\nA 还没有作品：三张示例卡");
  await goLookbook();
  check("🔴 空的时候有一句话讲清楚：「Your lookbook is empty」", await page.getByTestId("lookbook-empty").isVisible());
  check("🔴 三张示例卡，每一张都带「Example」标签", (await cards().count()) === 3 && (await cards().filter({ hasText: "Example" }).count()) === 3);
  check("🔴 示例卡上没有任何动作：Present Look · Apply to Ticket · Copy · 移除 一个都没有",
    (await page.getByRole("button", { name: "Present Look" }).count()) === 0 && (await page.getByRole("button", { name: "Apply to Ticket" }).count()) === 0 &&
    (await page.getByRole("button", { name: "Copy" }).count()) === 0 && (await page.getByRole("button", { name: /^Remove / }).count()) === 0);
  check("页头写着 Examples、底下写「3 Example Looks」", /Examples/i.test(await page.locator("body").innerText()) && /3 Example Looks/i.test(await page.getByTestId("lookbook-count").innerText()));
  await page.screenshot({ path: `${OUT}/1-empty.png`, fullPage: true });

  // ═══ B 用画面真的加一份（带照片）═══
  console.log("\nB 加一份作品");
  await openAdd();
  const panel = await fill({
    title: "Smoky Mocha Melt", category: "Balayage", level: "6.1", stylist: "Lookbook-Test Amy",
    formula: "Majirel 6.1 (35g) + 20 vol", note: "Cool ash finish, low regrowth",
    tags: "Warm undertone, Fine hair, fine hair", photo: await photo(),
  });
  check("选了照片之后面板上出现预览图", (await panel.locator("img[alt='Chosen look']").count()) === 1);
  await page.screenshot({ path: `${OUT}/2-add-panel.png` });
  await submitAdd();
  await until(async () => (await page.getByRole("dialog", { name: "Add a hairstyle case" }).count()) === 0);
  check("存好之后面板关了，出现「Added …」的确认", /Added "Smoky Mocha Melt"/.test(await page.getByTestId("lookbook-flash").innerText().catch(() => "")));
  await until(async () => (await page.getByTestId("lookbook-empty").count()) === 0);
  check("🔴 示例卡消失了，只剩她自己的这一张", (await cards().count()) === 1 && (await titles())[0] === "Smoky Mocha Melt" && (await cards().first().getAttribute("data-example")) === null, JSON.stringify(await titles()));
  const rows1 = await works();
  const w1 = rows1[0];
  check("🔴 库里真的有这一份：分类 · 明度 · 配方 · 一句话 · 师傅 都对", rows1.length === 1 && w1.category === "Balayage" && w1.level === "6.1" && w1.formula === "Majirel 6.1 (35g) + 20 vol" && w1.note === "Cool ash finish, low regrowth" && w1.stylist_id === amy.data.id, JSON.stringify(w1));
  check("🔴 标签去掉了重复的（Fine hair 写了两次只留一个）", JSON.stringify(w1?.tags) === JSON.stringify(["Warm undertone", "Fine hair"]), JSON.stringify(w1?.tags));
  check("🔴 照片在私人的桶里，路径是这一家的 lookbook 资料夹", w1?.photo_path?.startsWith(`${pid}/lookbook/`) === true, w1?.photo_path);
  const dl = await admin.storage.from("job-photos").download(w1.photo_path);
  check("🔴 档案真的在桶里，而且比原图小（浏览器先缩过）", !dl.error && dl.data.size > 0 && dl.data.size < (await photo()).buffer.length, `${dl.error?.message} ${dl.data?.size}`);
  const img = cards().first().locator("img").first();
  check("🔴 卡片上的图是签出来的私人网址（不是公开网址）", /\/object\/sign\/job-photos\//.test((await img.getAttribute("src")) ?? ""), await img.getAttribute("src"));
  check("🔴 那张图真的载得出来（不是一个破图）", await until(async () => await img.evaluate((el) => el.complete && el.naturalWidth > 0)));
  const cardText = await cards().first().innerText();
  check("卡片上：分类 · L6.1 · 师傅 · 标签 · 配方 都画出来了", /Balayage/.test(cardText) && /L6\.1/.test(cardText) && /Lookbook-Test Amy/.test(cardText) && /Warm undertone/.test(cardText) && /Majirel 6\.1/.test(cardText), cardText);
  check("底下写「1 Saved Look」", /1 Saved Look\b/i.test(await page.getByTestId("lookbook-count").innerText()));

  // ═══ C 再加两份，跑筛选 ═══
  console.log("\nC 分类 · 搜寻 · 肤色 · 明度 · 排序");
  await openAdd();
  await fill({ title: "Just Curls", category: "Perms & Curls", level: "L5", tags: "Neutral undertone" });
  await submitAdd();
  await until(async () => (await cards().count()) === 2);
  await openAdd();
  await fill({ title: "Copper Glaze", category: "Balayage", level: "7.43", stylist: "Lookbook-Test Amy", formula: "Igora 7-77 (30g)", tags: "Warm" });
  await submitAdd();
  await until(async () => (await cards().count()) === 3);
  check("三份都进来了，默认最新的在最前", JSON.stringify(await titles()) === JSON.stringify(["Copper Glaze", "Just Curls", "Smoky Mocha Melt"]), JSON.stringify(await titles()));
  const noPhotoCard = cards().filter({ hasText: "Just Curls" });
  check("🔴 没有照片的那一张画的是「No photo yet」的格子，不是破图", /No photo yet/.test(await noPhotoCard.innerText()) && (await noPhotoCard.locator("img").count()) === 0);
  check("🔴 没有配方的那一张不画配方框、「Apply to Ticket」是灰的（没东西可接）", !/Lab Formula/.test(await noPhotoCard.innerText()) && (await noPhotoCard.getByRole("button", { name: "Apply to Ticket" }).isDisabled()));
  await page.screenshot({ path: `${OUT}/3-gallery.png`, fullPage: true });

  const chipCounts = async () => (await page.locator("button", { hasText: /^(All Swatches|Balayage|Perms & Curls)\s*\d+$/ }).allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  check("🔴 分类那一排的数字是从真作品算的：All 3 · Balayage 2 · Perms & Curls 1", JSON.stringify(await chipCounts()) === JSON.stringify(["All Swatches 3", "Balayage 2", "Perms & Curls 1"]), JSON.stringify(await chipCounts()));
  await page.locator("button", { hasText: /^Perms & Curls\s*1$/ }).click();
  check("点分类：只剩 Just Curls", JSON.stringify(await titles()) === JSON.stringify(["Just Curls"]), JSON.stringify(await titles()));
  await page.locator("button", { hasText: /^All Swatches\s*3$/ }).click();
  await page.getByLabel("Search the lookbook").fill("copper");
  check("搜寻「copper」：找到名字里有的那一张", JSON.stringify(await titles()) === JSON.stringify(["Copper Glaze"]), JSON.stringify(await titles()));
  await page.getByLabel("Search the lookbook").fill("amy");
  check("🔴 搜寻「amy」：连师傅的名字也搜得到（她的两张）", (await titles()).length === 2, JSON.stringify(await titles()));
  await page.getByLabel("Search the lookbook").fill("majirel");
  check("搜寻配方里的字「majirel」", JSON.stringify(await titles()) === JSON.stringify(["Smoky Mocha Melt"]), JSON.stringify(await titles()));
  await page.getByLabel("Search the lookbook").fill("");

  await page.getByRole("button", { name: "warm", exact: true }).click();
  check("🔴 Skin Undertone「Warm」：标签里有 warm 的两张（Smoky · Copper）", (await titles()).length === 2 && !(await titles()).includes("Just Curls"), JSON.stringify(await titles()));
  check("按钮变成按下的样子（aria-pressed）", (await page.getByRole("button", { name: "warm", exact: true }).getAttribute("aria-pressed")) === "true");
  await page.getByRole("button", { name: "warm", exact: true }).click();
  check("再按一次取消，三张都回来", (await titles()).length === 3);
  await page.getByRole("button", { name: "neutral", exact: true }).click();
  check("「Neutral」：只有 Just Curls", JSON.stringify(await titles()) === JSON.stringify(["Just Curls"]), JSON.stringify(await titles()));
  await page.getByRole("button", { name: "neutral", exact: true }).click();

  await page.getByRole("button", { name: "Level 6 · Dark Blonde" }).click();
  check("🔴 Lift Level 6：明度写着 6.1 的那一张（整数部分算）", JSON.stringify(await titles()) === JSON.stringify(["Smoky Mocha Melt"]), JSON.stringify(await titles()));
  await page.getByRole("button", { name: "Level 7 · Medium Blonde" }).click();
  check("换成 Level 7：7.43 的 Copper Glaze", JSON.stringify(await titles()) === JSON.stringify(["Copper Glaze"]), JSON.stringify(await titles()));
  await page.getByRole("button", { name: "Level 5 · Light Brown" }).click();
  check("Level 5：写成「L5」的 Just Curls 也算", JSON.stringify(await titles()) === JSON.stringify(["Just Curls"]), JSON.stringify(await titles()));
  await page.getByRole("button", { name: "warm", exact: true }).click();
  check("两个条件一起用：Level 5 又要 warm，没有一张", (await cards().count()) === 0 && (await page.getByTestId("lookbook-no-match").isVisible()));
  await page.screenshot({ path: `${OUT}/4-no-match.png` });
  await page.getByRole("button", { name: "Clear filters" }).click();
  check("「Clear filters」全部清掉，三张都回来", (await titles()).length === 3 && (await page.getByRole("button", { name: "warm", exact: true }).getAttribute("aria-pressed")) === "false");

  await page.getByLabel("Sort looks").selectOption("az");
  check("排序 Name A to Z", JSON.stringify(await titles()) === JSON.stringify(["Copper Glaze", "Just Curls", "Smoky Mocha Melt"]), JSON.stringify(await titles()));
  await page.getByLabel("Sort looks").selectOption("oldest");
  check("排序 Oldest First：最早加的在最前", JSON.stringify(await titles()) === JSON.stringify(["Smoky Mocha Melt", "Just Curls", "Copper Glaze"]), JSON.stringify(await titles()));
  await page.getByLabel("Sort looks").selectOption("newest");

  // ═══ D 全屏 · 复制 · 接到客人的单上 ═══
  console.log("\nD Present Look · Copy · Apply to Ticket");
  await cards().filter({ hasText: "Smoky Mocha Melt" }).getByRole("button", { name: "Present Look" }).click();
  const presenter = page.getByTestId("lookbook-presenter");
  await presenter.waitFor();
  const presenterText = await presenter.innerText();
  check("🔴 全屏显示：名字 · 分类 · 一句话 · 标签 · 师傅", /Smoky Mocha Melt/.test(presenterText) && /Balayage/.test(presenterText) && /Cool ash finish/.test(presenterText) && /Warm undertone/.test(presenterText) && /Lookbook-Test Amy/.test(presenterText), presenterText);
  check("🔴 全屏不带配方（那是给客人看的，配方是店里的手艺）", !/Majirel/.test(presenterText));
  check("🔴 全屏的照片真的载得出来", await until(async () => await presenter.locator("img").first().evaluate((el) => el.complete && el.naturalWidth > 0)));
  await page.screenshot({ path: `${OUT}/5-presenter.png` });
  const first = (await presenter.innerText()).match(/(\d) \/ 3/)?.[0];
  await page.keyboard.press("ArrowRight");
  const second = (await presenter.innerText()).match(/(\d) \/ 3/)?.[0];
  check("🔴 右箭头键翻到下一张（1 / 3 → 2 / 3 之类，页码变了）", first !== second, `${first} → ${second}`);
  await page.keyboard.press("Escape");
  check("Esc 关掉全屏", (await presenter.count()) === 0);

  const smoky = cards().filter({ hasText: "Smoky Mocha Melt" });
  await smoky.getByRole("button", { name: "Copy" }).click();
  await page.waitForTimeout(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
  check("🔴 Copy 真的把那一张的配方写进剪贴簿", clip === "Majirel 6.1 (35g) + 20 vol", clip);
  check("按钮换成「Copied」", /Copied/.test(await smoky.innerText()));

  await smoky.getByRole("button", { name: "Apply to Ticket" }).click();
  await until(async () => ((await admin.from("directory_entries").select("note").eq("id", guest.data.id).single()).data?.note ?? "").includes("Smoky Mocha Melt"));
  const applied1 = (await admin.from("directory_entries").select("note").eq("id", guest.data.id).single()).data?.note;
  check("🔴 Apply to Ticket 把配方接在她原本的 note 后面，原本那句没被盖掉", applied1 === "Allergic to ammonia\n[Smoky Mocha Melt] Majirel 6.1 (35g) + 20 vol", JSON.stringify(applied1));
  await cards().filter({ hasText: "Copper Glaze" }).getByRole("button", { name: "Apply to Ticket" }).click();
  await until(async () => ((await admin.from("directory_entries").select("note").eq("id", guest.data.id).single()).data?.note ?? "").includes("Copper Glaze"));
  const applied2 = (await admin.from("directory_entries").select("note").eq("id", guest.data.id).single()).data?.note;
  check("🔴 再接第二张：接在第一张后面，不是从旧的原文重来（前一张没被盖掉）", applied2 === "Allergic to ammonia\n[Smoky Mocha Melt] Majirel 6.1 (35g) + 20 vol\n[Copper Glaze] Igora 7-77 (30g)", JSON.stringify(applied2));

  // ═══ E 移除：先问一句，收起来不删 ═══
  console.log("\nE 移除");
  await smoky.getByRole("button", { name: "Remove Smoky Mocha Melt" }).click();
  check("🔴 按垃圾桶不是直接删：先问「Remove this look?」", await page.getByTestId("lookbook-confirm-remove").isVisible());
  await page.screenshot({ path: `${OUT}/6-confirm-remove.png` });
  await page.getByTestId("lookbook-confirm-remove").getByRole("button", { name: "Keep" }).click();
  check("按「Keep」：什么都没动", (await cards().count()) === 3 && (await works()).every((w) => w.archived_at === null));
  await smoky.getByRole("button", { name: "Remove Smoky Mocha Melt" }).click();
  await page.getByTestId("lookbook-confirm-remove").getByRole("button", { name: "Remove", exact: true }).click();
  await until(async () => (await cards().count()) === 2);
  check("移掉之后画面上少一张，出现「Removed …」", /Removed "Smoky Mocha Melt"/.test(await page.getByTestId("lookbook-flash").innerText().catch(() => "")) && (await cards().count()) === 2);
  const afterRemove = await works();
  check("🔴 库里那一份还在，只是标了收起来的时间（照片档案也还在桶里）", afterRemove.length === 3 && !!afterRemove.find((w) => w.title === "Smoky Mocha Melt")?.archived_at && (await photoFiles()).length === 1, JSON.stringify(afterRemove.map((w) => [w.title, !!w.archived_at])));
  check("🔴 分类那一排的数字跟着变：All 2 · Balayage 1 · Perms & Curls 1", JSON.stringify(await chipCounts()) === JSON.stringify(["All Swatches 2", "Balayage 1", "Perms & Curls 1"]), JSON.stringify(await chipCounts()));

  // ═══ F 出错 ═══
  console.log("\nF 出错");
  await openAdd();
  await submitAdd();
  check("🔴 没写名字按存：讲一句「Give the look a name first.」，面板还开着", /Give the look a name first/.test(await page.getByTestId("lookbook-add-error").innerText()) && (await page.getByRole("dialog", { name: "Add a hairstyle case" }).count()) === 1);
  const filesBefore = (await photoFiles()).length;
  await fill({ title: "Too Many Tags", tags: "a, b, c, d, e, f, g, h, i", photo: await photo() });
  await submitAdd();
  await until(async () => (await page.getByTestId("lookbook-add-error").count()) === 1 && /at most 8 tags/i.test(await page.getByTestId("lookbook-add-error").innerText()));
  check("🔴 九个标签：讲数据库那句人话「At most 8 tags on a look.」，面板还开着、打的字还在", /At most 8 tags/.test(await page.getByTestId("lookbook-add-error").innerText()) && (await page.getByRole("dialog", { name: "Add a hairstyle case" }).getByLabel("Name of the look").inputValue()) === "Too Many Tags");
  check("这时候照片已经传上去了（等他改完标签重试，不重传）", (await photoFiles()).length === filesBefore + 1, `${filesBefore} → ${(await photoFiles()).length}`);
  await page.screenshot({ path: `${OUT}/7-error.png` });
  await page.getByRole("dialog", { name: "Add a hairstyle case" }).getByLabel("Tags").fill("a, b, c");
  await submitAdd();
  await until(async () => (await page.getByRole("dialog", { name: "Add a hairstyle case" }).count()) === 0);
  await until(async () => (await cards().count()) === 3);
  check("🔴 改成三个标签再按：存进去了，用的是刚才那一张照片（桶里只多一个档案，不是两个）", (await photoFiles()).length === filesBefore + 1 && (await works()).some((w) => w.title === "Too Many Tags" && w.photo_path !== ""), `${(await photoFiles()).length}`);

  await openAdd();
  await fill({ title: "Abandoned", tags: "a, b, c, d, e, f, g, h, i", photo: await photo() });
  await submitAdd();
  await until(async () => (await photoFiles()).length === filesBefore + 2);
  await page.getByRole("dialog", { name: "Add a hairstyle case" }).getByRole("button", { name: "Cancel" }).click();
  await until(async () => (await photoFiles()).length === filesBefore + 1);
  check("🔴 存失败之后按 Cancel：刚才传上去的那张照片被收回来了（不留一个没有人看得到的孤儿档）", (await photoFiles()).length === filesBefore + 1 && !(await works()).some((w) => w.title === "Abandoned"), `${(await photoFiles()).length}`);

  // ═══ G 重新载入 · 师傅 ═══
  console.log("\nG 重新载入 · 师傅登入");
  await goLookbook();
  check("🔴 整页重新载入：作品都还在（从库里读回来的），移掉的那张没有回来", JSON.stringify((await titles()).sort()) === JSON.stringify(["Copper Glaze", "Just Curls", "Too Many Tags"]), JSON.stringify(await titles()));
  const reloadedImg = cards().filter({ hasText: "Too Many Tags" }).locator("img").first();
  check("重新载入之后照片重新签了网址，照样载得出来", await until(async () => await reloadedImg.evaluate((el) => el.complete && el.naturalWidth > 0)));
  await page.screenshot({ path: `${OUT}/8-reloaded.png`, fullPage: true });

  const staffEmail = `look-staff-${stamp}@formae.test`;
  const staffPassword = `Ls-${stamp}-x!`;
  const { data: staffUser, error: staffMkErr } = await admin.auth.admin.createUser({ email: staffEmail, password: staffPassword, email_confirm: true });
  if (staffMkErr) throw new Error(`createUser staff: ${staffMkErr.message}`);
  const memberAdd = await api.rpc("add_project_member", { in_email: staffEmail });
  if (memberAdd.error) throw new Error(`add_project_member: ${memberAdd.error.message}`);
  const staffPage = await (await browser.newContext({ viewport: { width: 1700, height: 1300 } })).newPage();
  await staffPage.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await staffPage.fill('input[type="email"]', staffEmail);
  await staffPage.fill('input[type="password"]', staffPassword);
  await staffPage.click('button[type="submit"]');
  await staffPage.waitForURL(/portal/, { timeout: 180000 }).catch(() => {});
  await staffPage.goto(`${BASE}/en/salon-preview/lookbook`, { waitUntil: "networkidle", timeout: 180000 });
  check("🔴 师傅（员工）看得到这家的作品集，不是空的、也不是示例卡", (await staffPage.getByTestId("lookbook-card").count()) === 3 && (await staffPage.getByTestId("lookbook-empty").count()) === 0);
  check("🔴 师傅那边照片也载得出来（他自己的登入签的网址）", await until(async () => await staffPage.getByTestId("lookbook-card").filter({ hasText: "Too Many Tags" }).locator("img").first().evaluate((el) => el.complete && el.naturalWidth > 0)));
  await staffPage.getByRole("button", { name: "Add Hairstyle Case" }).click();
  const staffPanel = staffPage.getByRole("dialog", { name: "Add a hairstyle case" });
  await staffPanel.getByLabel("Name of the look").fill("By the stylist");
  await staffPanel.getByRole("button", { name: "Add to Lookbook" }).click();
  await until(async () => (await works()).some((w) => w.title === "By the stylist"));
  const byStaff = (await works()).find((w) => w.title === "By the stylist");
  check("🔴 师傅加得了作品，记的是师傅自己的登入", byStaff?.created_by === staffUser.user.id, `${byStaff?.created_by}`);
  await staffPage.screenshot({ path: `${OUT}/9-staff.png`, fullPage: true });
  admin.auth.admin.deleteUser(staffUser.user.id).catch(() => {});

  check("🔴 整个过程一个 alert() 都没弹（错误都是画面上的一行字）", alerts === 0, String(alerts));
} finally {
  if (browser) await browser.close();
  if (lookbookFolder) await removeFolders(admin, [lookbookFolder]);
  await dropThrowaway(admin, userId);
}

console.log(`\n判：${pass.length} 过 · ${fail.length} 没过`);
if (fail.length) {
  console.log("🔴 " + fail.join("\n🔴 "));
  process.exit(1);
}
console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那几张图`);

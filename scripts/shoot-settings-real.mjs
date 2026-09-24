/**
 * Tenant Settings（沙龙的第十四张，[任务 415] 第 3 项）——真登入、真资料库、真浏览器。
 *
 * 他贴的设计里，下面这些底下真的有东西，接上了：店名 / 老板名、官网地址 ＋ 有没有发布、
 * 分店、谁在这里做事、这家用哪几页（侧栏读的就是这一份）、放飞机订金规矩、集点卡。
 * 没有东西的（SST 那格、WhatsApp 那一页、硬件那一页、分店的地址跟椅数）没有画，
 * 因为一个存不进任何地方的开关在设定页上是一句谎话。
 *
 * 验：
 *   A 打开是真的：侧栏那一行是真连结、写着「All changes saved」、按钮灰的
 *   B 改店名：出现「Unsaved changes」，⌘S 存进去，侧栏跟着换名字
 *   C 官网地址：不合规的、保留的、被别人占了的各讲一句人话；**店名照样存进去**（每一组各存各的）；
 *      合规的存进去；发布了的站改地址有警告
 *   D 页：关掉一页，侧栏那一行真的消失；开回来，回来；资料库里那一页已经被别处拿掉了，再关一次讲得出哪一页失败
 *   E 规矩：只填一半被挡；填两个存进去、重新载入还在；写错的讲人话；清空存成没有
 *   F Discard 退回去；收据预览跟着打的店名变
 *   G 分店：加 · 重名不多开 · 关 · 开回来 · 标签数字跟着变
 *   H 团队：加一个真的帐号 · 加不存在的讲人话 · 加自己讲人话 · 关掉 / 开回来；谁看得到什么是从侧栏那一份规矩读的
 *   I 员工：整页只有一句话，没有保存键；员工自己也写不进去（资料库拒绝）
 *
 * 用完就删。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaways, dropThrowawayOnExit } from "./lib/throwaway.mjs";

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
const OUT = ".screenshots/settings-real";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。`);
  process.exit(2);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const created = [];
dropThrowawayOnExit(admin, () => created);

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

async function makeUser(tag, stamp) {
  const email = `set-${tag}-${stamp}@formae.test`;
  const password = `St-${stamp}-x!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  created.push(data.user.id);
  return { id: data.user.id, email, password };
}

let browser;
try {
  const stamp = Date.now();
  const boss = await makeUser("boss", stamp);
  const { error: inErr } = await api.auth.signInWithPassword({ email: boss.email, password: boss.password });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  const pid = proj.id;
  for (const k of ["customers", "bookings", "inventory", "staff"]) await api.rpc("add_project_page", { requested_key: k, new_title: "" });
  await api.rpc("update_business_identity", { new_business_name: "Kedai Test Salon", new_owner_name: "Amy Owner" });

  const project = async () => (await admin.from("projects").select("business_name, owner_name, site_slug, site_published").eq("id", pid).single()).data;
  const pageKeys = async () => ((await admin.from("project_pages").select("page_key").eq("project_id", pid)).data ?? []).map((r) => r.page_key);
  const bookingRow = async () => (await admin.from("booking_rules").select("*").eq("project_id", pid).maybeSingle()).data;
  const loyaltyRow = async () => (await admin.from("loyalty_rules").select("*").eq("project_id", pid).maybeSingle()).data;
  const branchRows = async () => (await admin.from("branches").select("*").eq("project_id", pid).order("created_at")).data ?? [];

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1200 } });
  const page = await ctx.newPage();
  let alerts = 0;
  page.on("dialog", (d) => { alerts += 1; d.dismiss().catch(() => {}); });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', boss.email);
  await page.fill('input[type="password"]', boss.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  const go = () => page.goto(`${BASE}/en/salon-preview/settings`, { waitUntil: "networkidle", timeout: 180000 });
  const state = () => page.getByTestId("settings-state").innerText();
  const saveTop = () => page.getByTestId("settings-save-top");
  const tab = (name) => page.getByRole("tab", { name });
  const sidebarLabels = async () => (await page.locator("aside nav a").allInnerTexts()).map((t) => t.trim());
  const hasRow = async (label) => (await sidebarLabels()).some((t) => t.includes(label));
  const clickSave = async () => { await saveTop().click(); await until(async () => !/Saving/.test(await saveTop().innerText())); };

  // ═══ A 打开是真的 ═══
  console.log("\nA 打开");
  await go();
  check("🔴 侧栏「Tenant Settings」是一条真的连结，而且是亮着的这一行", (await page.locator("aside a[href='/en/salon-preview/settings']").count()) === 1);
  check("标题跟四个分页签（不画 WhatsApp 跟硬件那两个：底下没有东西）", /Store Settings/.test(await page.locator("h1").innerText()) && (await page.getByRole("tab").count()) === 4 && (await tab("General").getAttribute("aria-selected")) === "true", await page.getByRole("tab").allInnerTexts().then((a) => a.join("|")));
  check("一开始是「All changes saved」，保存键是灰的", /All changes saved/.test(await state()) && (await saveTop().isDisabled()));
  check("🔴 店名 · 老板名是真的读回来的", (await page.getByLabel("Brand name").inputValue()) === "Kedai Test Salon" && (await page.getByLabel("Owner name").inputValue()) === "Amy Owner");
  const p0 = await project();
  check("官网地址读的是库里那一个，前面那一截是这台主机的 /s/", (await page.locator("#settings-site-slug").inputValue()) === (p0.site_slug ?? "") && /\/s\/$/.test(await page.locator("#settings-site-slug").locator("xpath=preceding-sibling::span").innerText()), p0.site_slug);
  check("🔴 还没发布：写「Not published yet」", /Not published yet/.test(await page.getByTestId("settings-site-state").innerText()));
  check("币别 · 一天怎么算是读出来的事实，不是开关", /MYR/.test(await page.locator("body").innerText()) && /UTC\+8/.test(await page.locator("body").innerText()));
  check("三个页的开关都是开的（这家有预约 · 库存 · 师傅三页）", (await page.getByRole("switch").evaluateAll((els) => els.map((e) => e.getAttribute("aria-checked")))).join() === "true,true,true");
  check("头上那颗绿药丸写着店名（还没有分店）", /Kedai Test Salon/.test(await page.locator("h1").locator("xpath=following::span[contains(@class,'rounded-full')][1]").innerText().catch(() => "")));
  await page.screenshot({ path: `${OUT}/1-general.png`, fullPage: true });

  // ═══ B 改店名 ═══
  console.log("\nB 改店名 · ⌘S");
  await page.getByLabel("Brand name").fill("Kedai Test Salon & Spa");
  check("🔴 一改就变成「Unsaved changes」，保存键亮了", /Unsaved changes/.test(await state()) && (await saveTop().isEnabled()));
  await page.keyboard.press("Control+s");
  await until(async () => (await project()).business_name === "Kedai Test Salon & Spa");
  check("🔴 ⌘S / Ctrl+S 真的存进库里了", (await project()).business_name === "Kedai Test Salon & Spa", (await project()).business_name);
  check("老板名没被动到（存名字那一支是两个一起送的，没改的要原样送回去）", (await project()).owner_name === "Amy Owner", (await project()).owner_name);
  await until(async () => /All changes saved/.test(await state()));
  check("存完回到「All changes saved」，旁边写「Saved」", /All changes saved/.test(await state()) && (await page.getByTestId("settings-saved").count()) === 1);
  check("🔴 侧栏上头的店名跟着换了", await until(async () => /Kedai Test Salon & Spa/i.test(await page.locator("aside").first().innerText())));
  const slugAfterName = (await project()).site_slug;
  check("🔴 存店名的时候，还是系统自己编的那个网址跟着新店名变了（数据库的规矩），而画面上那一格读回来了，不留着旧的",
    slugAfterName === "kedai-test-salon-spa" && (await page.locator("#settings-site-slug").inputValue()) === slugAfterName, `${slugAfterName} / ${await page.locator("#settings-site-slug").inputValue()}`);

  // ═══ C 官网地址 ═══
  console.log("\nC 官网地址（每一组各存各的）");
  await page.getByLabel("Brand name").fill("Kedai Test Salon Two");
  await page.locator("#settings-site-slug").fill("no good");
  await clickSave();
  const slugAfterSecondName = (await project()).site_slug;
  const errSlug = () => page.getByTestId("settings-error-slug").innerText().catch(() => "");
  check("🔴 地址里有空格：讲「3 到 40 个字母 数字 连字号」这一句", /3 to 40 letters/.test(await errSlug()), await errSlug());
  check("🔴 而店名照样存进去了（地址失败不拖累店名）", (await project()).business_name === "Kedai Test Salon Two", (await project()).business_name);
  check("地址还留在框里、还是「Unsaved changes」（没存的就是没存的）", (await page.locator("#settings-site-slug").inputValue()) === "no good" && /Unsaved changes/.test(await state()));
  await page.locator("#settings-site-slug").fill("admin");
  await clickSave();
  check("保留的地址：讲「That address is reserved」", /reserved/.test(await errSlug()), await errSlug());
  const takenSlug = `taken-${stamp}`;
  const other = await makeUser("other", stamp);
  const { data: otherProj } = await admin.from("projects").select("id").eq("account_id", other.id).single();
  await admin.from("projects").update({ site_slug: takenSlug }).eq("id", otherProj.id);
  await page.locator("#settings-site-slug").fill(takenSlug);
  await clickSave();
  check("🔴 被别人占了的：讲「Someone else already has that address」", /already has that address/.test(await errSlug()), await errSlug());
  check("库里自己的地址没被动（还是存店名那一下改成的那一个，不是 admin、不是别人的）", (await project()).site_slug === slugAfterSecondName, (await project()).site_slug);
  const mine = `kedai-${stamp}`;
  await page.locator("#settings-site-slug").fill(mine.toUpperCase());
  await clickSave();
  check("🔴 合规的（大小写自己变小写）存进去了", (await project()).site_slug === mine, (await project()).site_slug);
  check("错误那一行不见了、回到 All changes saved", (await page.getByTestId("settings-error-slug").count()) === 0 && /All changes saved/.test(await state()));
  await admin.from("projects").update({ site_published: true }).eq("id", pid);
  await go();
  check("🔴 发布了之后重新载入：写「Published」", /Published/.test(await page.getByTestId("settings-site-state").innerText()) && !/Not published/.test(await page.getByTestId("settings-site-state").innerText()));
  await page.locator("#settings-site-slug").fill(`${mine}-2`);
  check("🔴 发布了的站改地址：当场警告「会弄坏已经发出去的连结」", /breaks any link/.test(await page.locator("body").innerText()));
  await page.screenshot({ path: `${OUT}/2-slug-warning.png` });
  await page.getByTestId("settings-discard").click();
  check("Discard 把地址退回去、警告不见了", (await page.locator("#settings-site-slug").inputValue()) === mine && !/breaks any link/.test(await page.locator("body").innerText()));

  // ═══ D 页 ═══
  console.log("\nD 页（侧栏读的就是这一份）");
  check("前提：侧栏现在有师傅、预约、套票、库存那几行", (await hasRow("Stylists & Staff")) && (await hasRow("Appointments & Flow")) && (await hasRow("Packages & Plans")) && (await hasRow("Salon Stock & Orders")), (await sidebarLabels()).join("|"));
  await page.getByRole("switch", { name: "Stylists & staff" }).click();
  check("开关一动就是 Unsaved，还没写库", /Unsaved/.test(await state()) && (await pageKeys()).includes("staff"));
  await clickSave();
  check("🔴 存了：库里那一页真的拿掉了", !(await pageKeys()).includes("staff"), (await pageKeys()).join());
  check("🔴 侧栏那一行真的消失了（别的行原样）", await until(async () => !(await hasRow("Stylists & Staff")) && (await hasRow("Salon Stock & Orders"))), (await sidebarLabels()).join("|"));
  await page.getByRole("switch", { name: "Appointments & schedule" }).click();
  await clickSave();
  check("🔴 关预约：预约那一行消失，套票会员那一行还在（会员费靠收款页，不靠预约）", await until(async () => !(await hasRow("Appointments & Flow")) && (await hasRow("Packages & Plans"))), (await sidebarLabels()).join("|"));
  await page.getByRole("switch", { name: "Appointments & schedule" }).click();
  await page.getByRole("switch", { name: "Stylists & staff" }).click();
  await clickSave();
  check("🔴 开回来：预约跟师傅两行回来了，套票会员一直都在", await until(async () => (await hasRow("Appointments & Flow")) && (await hasRow("Packages & Plans")) && (await hasRow("Stylists & Staff"))), (await sidebarLabels()).join("|"));
  check("库里三页都在", ["bookings", "inventory", "staff"].every(async (k) => (await pageKeys()).includes(k)) && (await pageKeys()).includes("staff") && (await pageKeys()).includes("bookings"));
  // 这一页在别处已经被拿掉了，这里的开关还以为它开着
  await api.rpc("remove_project_page", { target_page_key: "inventory" });
  await page.getByRole("switch", { name: "Salon stock & orders" }).click();
  await clickSave();
  const pagesErr = await page.getByTestId("settings-error-pages").innerText().catch(() => "");
  check("🔴 页在别处已经没了、这里再关：讲得出是哪一页失败（Salon stock & orders: …）", /Salon stock & orders/.test(pagesErr) && /not found/i.test(pagesErr), pagesErr);
  await page.getByRole("switch", { name: "Salon stock & orders" }).click();
  check("开关拨回原样：又回到 All changes saved（没有留着一个其实没动的「未保存」）", /All changes saved/.test(await state()));
  await api.rpc("add_project_page", { requested_key: "inventory", new_title: "" });

  // ═══ E 规矩 ═══
  console.log("\nE 放飞机订金 · 集点");
  await tab("Booking & Loyalty").click();
  check("一开始两张卡都是「Not set」（不替他编一个数字）", /Not set/.test(await page.getByTestId("settings-booking-effect").innerText()) && /Not set/.test(await page.getByTestId("settings-loyalty-effect").innerText()));
  await page.getByLabel("After this many no-shows").fill("2");
  await clickSave();
  check("🔴 只填一半：讲「Set both numbers, or leave both empty」，库里没写", /Set both numbers/.test(await page.getByTestId("settings-error-booking").innerText().catch(() => "")) && (await bookingRow()) === null);
  await page.getByLabel("Deposit (RM)").fill("-5");
  await clickSave();
  check("订金是负数被挡", /ringgit/.test(await page.getByTestId("settings-error-booking").innerText().catch(() => "")));
  await page.getByLabel("After this many no-shows").fill("0");
  await page.getByLabel("Deposit (RM)").fill("50");
  await clickSave();
  check("没来次数是 0 被挡", /1 to 20/.test(await page.getByTestId("settings-error-booking").innerText().catch(() => "")));
  await page.getByLabel("After this many no-shows").fill("2");
  await page.getByLabel("Deposit (RM)").fill("50");
  check("填好两个：下面那一句当场讲出这条规矩（只是建议，你们决定）", /After 2 no-shows.*RM 50/.test(await page.getByTestId("settings-booking-effect").innerText()));
  await page.getByLabel("Visits for one reward").fill("99");
  await clickSave();
  check("🔴 集点 99 被挡（1 到 50）", /1 to 50/.test(await page.getByTestId("settings-error-loyalty").innerText().catch(() => "")));
  check("🔴 而订金那一组照样存进去了：2 次 · RM 50", (await bookingRow())?.no_show_deposit_after === 2 && Number((await bookingRow())?.default_deposit_cents) === 5000, JSON.stringify(await bookingRow()));
  check("集点没写", (await loyaltyRow()) === null);
  await page.getByLabel("Visits for one reward").fill("10");
  await clickSave();
  check("🔴 集点 10 存进去了", (await loyaltyRow())?.stamps_needed === 10, JSON.stringify(await loyaltyRow()));
  await page.screenshot({ path: `${OUT}/3-rules.png`, fullPage: true });
  await go();
  await tab("Booking & Loyalty").click();
  check("🔴 整页重新载入：三个数字都读回来（2 · 50 · 10）", (await page.getByLabel("After this many no-shows").inputValue()) === "2" && (await page.getByLabel("Deposit (RM)").inputValue()) === "50" && (await page.getByLabel("Visits for one reward").inputValue()) === "10");
  await page.getByLabel("After this many no-shows").fill("");
  await page.getByLabel("Deposit (RM)").fill("");
  await page.getByLabel("Visits for one reward").fill("");
  await clickSave();
  check("🔴 全清空再存：库里存成「没有」（null），不是 0", (await bookingRow())?.no_show_deposit_after === null && (await bookingRow())?.default_deposit_cents === null && (await loyaltyRow())?.stamps_needed === null, JSON.stringify([await bookingRow(), await loyaltyRow()]));

  // ═══ F Discard · 收据预览 ═══
  console.log("\nF Discard · 收据预览");
  await tab("General").click();
  await page.getByLabel("Brand name").fill("Live Name Test");
  await page.getByRole("button", { name: "View Slip Sample" }).click();
  check("🔴 收据预览上的店名跟着打的字变（没存也变）", (await page.getByTestId("settings-slip-name").innerText()) === "Live Name Test");
  check("预览上写着「Sample figures」（不假装是真的一笔）", /Sample figures/i.test(await page.getByTestId("settings-slip").innerText()));
  await page.screenshot({ path: `${OUT}/4-slip.png`, fullPage: true });
  await page.getByTestId("settings-discard").click();
  check("🔴 Discard：店名退回去，预览也退回去，状态回到 saved", (await page.getByLabel("Brand name").inputValue()) === "Kedai Test Salon Two" && (await page.getByTestId("settings-slip-name").innerText()) === "Kedai Test Salon Two" && /All changes saved/.test(await state()));
  await page.getByRole("button", { name: "Hide Slip Sample" }).click();
  check("再按一次收起来", (await page.getByTestId("settings-slip").count()) === 0);

  // ═══ G 分店 ═══
  console.log("\nG 分店");
  await tab(/Branch Locations/).click();
  check("没有分店：讲「This shop is one location」", await page.getByTestId("settings-branches-empty").isVisible());
  await page.getByRole("button", { name: "Add Branch" }).click();
  check("名字空着，「Add」是灰的", await page.getByRole("button", { name: "Add", exact: true }).isDisabled());
  await page.getByLabel("Branch name").fill("Bangsar");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await until(async () => (await page.getByTestId("settings-branch").count()) === 1);
  check("🔴 加了一间：卡片出现，B1，Open，库里真的有", (await page.getByTestId("settings-branch").count()) === 1 && /B1/.test(await page.getByTestId("settings-branch").first().innerText()) && /Open/.test(await page.getByTestId("settings-branch").first().innerText()) && (await branchRows()).length === 1);
  check("头上药丸换成分店名，分页签写「(1)」", /Bangsar/.test(await page.locator("h1").locator("xpath=following::span[contains(@class,'rounded-full')][1]").innerText().catch(() => "")) && (await tab(/Branch Locations/).innerText()).includes("(1)"));
  await page.getByRole("button", { name: "Add Branch" }).click();
  await page.getByLabel("Branch name").fill("Bangsar");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await until(async () => (await page.getByTestId("settings-branch-note").count()) === 1);
  check("🔴 同名再加一次：讲「You already have a branch called」，库里还是一间", /already have a branch called "Bangsar"/.test(await page.getByTestId("settings-branch-note").innerText()) && (await branchRows()).length === 1);
  await page.getByLabel("Branch name").fill("Puchong");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await until(async () => (await page.getByTestId("settings-branch").count()) === 2);
  check("第二间进来了，头上写「2 branches open」", (await page.getByTestId("settings-branch").count()) === 2 && /2 branches open/.test(await page.locator("h1").locator("xpath=following::span[contains(@class,'rounded-full')][1]").innerText().catch(() => "")));
  await page.getByRole("button", { name: "Close Puchong" }).click();
  await until(async () => (await branchRows()).find((b) => b.name === "Puchong")?.active === false);
  check("🔴 关掉 Puchong：库里 active = false（不是删掉），卡片写 Closed，按钮变「Reopen」", (await branchRows()).length === 2 && (await until(async () => /Closed/.test(await page.getByTestId("settings-branch").nth(1).innerText()) && (await page.getByRole("button", { name: "Reopen Puchong" }).count()) === 1)));
  await page.getByRole("button", { name: "Reopen Puchong" }).click();
  await until(async () => (await branchRows()).find((b) => b.name === "Puchong")?.active === true);
  check("开回来", (await branchRows()).find((b) => b.name === "Puchong")?.active === true);
  await page.screenshot({ path: `${OUT}/5-branches.png`, fullPage: true });

  // ═══ H 团队 ═══
  console.log("\nH 谁在这里做事");
  await tab(/Team & Access/).click();
  check("第一行是老板自己（邮箱 · Owner · Active）", (await page.getByTestId("settings-member").count()) === 1 && (await page.getByTestId("settings-member").first().innerText()).includes(boss.email) && /Owner/.test(await page.getByTestId("settings-member").first().innerText()));
  await page.getByLabel("Add a person by email").fill(`nobody-${stamp}@formae.test`);
  await page.getByRole("button", { name: "Add person" }).click();
  await until(async () => (await page.getByTestId("settings-team-error").count()) === 1);
  check("🔴 加一个还没有帐号的：讲「no account yet — they sign up first」", /no account yet/.test(await page.getByTestId("settings-team-error").innerText()), await page.getByTestId("settings-team-error").innerText().catch(() => ""));
  await page.getByLabel("Add a person by email").fill(boss.email);
  await page.getByRole("button", { name: "Add person" }).click();
  await until(async () => /owner already/.test(await page.getByTestId("settings-team-error").innerText().catch(() => "")));
  check("加自己：讲「you are the owner already」", /owner already/.test(await page.getByTestId("settings-team-error").innerText().catch(() => "")));
  const crew = await makeUser("crew", stamp);
  await page.getByLabel("Add a person by email").fill(crew.email);
  await page.getByRole("button", { name: "Add person" }).click();
  await until(async () => (await page.getByTestId("settings-member").count()) === 2);
  check("🔴 加一个真的帐号：多一行 Staff · Active，讲「can now sign in」，输入框清空", (await page.getByTestId("settings-member").count()) === 2 && (await page.getByTestId("settings-member").nth(1).innerText()).includes(crew.email) && /Staff/.test(await page.getByTestId("settings-member").nth(1).innerText()) && /can now sign in/.test(await page.getByTestId("settings-team-note").innerText()) && (await page.getByLabel("Add a person by email").inputValue()) === "");
  const memberActive = async () => (await admin.from("project_members").select("active").eq("project_id", pid).eq("user_id", crew.id).single()).data?.active;
  check("库里那一行 active = true", (await memberActive()) === true);
  await page.getByRole("button", { name: `Turn off ${crew.email}` }).click();
  await until(async () => (await memberActive()) === false);
  check("🔴 Turn off：库里 active = false，画面写 Off，按钮变 Turn on", (await memberActive()) === false && (await until(async () => (await page.getByRole("button", { name: `Turn on ${crew.email}` }).count()) === 1)));
  await page.getByRole("button", { name: `Turn on ${crew.email}` }).click();
  await until(async () => (await memberActive()) === true);
  check("Turn on 回来", (await memberActive()) === true);
  const ownerText = await page.getByTestId("settings-role-owner").innerText();
  const staffText = await page.getByTestId("settings-role-staff").innerText();
  check("🔴 谁能开什么是从侧栏那份规矩读的：老板那一栏有「Reports & Rankings · End of Day Cash · Tenant Settings」，员工那一栏没有",
    /Reports & Rankings/.test(ownerText) && /End of Day Cash/.test(ownerText) && /Tenant Settings/.test(ownerText) && !/Reports & Rankings|End of Day Cash|Tenant Settings/.test(staffText) && /Register & Checkout/.test(staffText), `${ownerText} || ${staffText}`);
  await page.screenshot({ path: `${OUT}/6-team.png`, fullPage: true });
  check("🔴 改动历史不在侧栏了，而是这一页里一张卡：老板点得到", (await hasRow("System Audit Log")) === false && (await page.getByTestId("settings-audit-link").count()) === 1);
  await page.getByTestId("settings-audit-link").click();
  await page.waitForURL(/salon-preview\/audit-log/, { timeout: 60000 });
  await page.getByRole("heading", { name: /Activity & Change History/ }).waitFor({ timeout: 60000 });
  check("🔴 点进去是改动历史那一页，侧栏亮的是「Tenant Settings」，面包屑第一格是可以点回来的「SETTINGS」",
    (await page.locator("aside a", { hasText: "Tenant Settings" }).count()) === 1
      && (await page.locator("main a", { hasText: "SETTINGS" }).count()) === 1);
  await page.screenshot({ path: `${OUT}/6b-audit-from-settings.png` });
  await page.locator("main a", { hasText: "SETTINGS" }).click();
  await page.waitForURL(/salon-preview\/settings/, { timeout: 60000 });
  check("面包屑点回来落在设置页", /Store Settings/.test(await page.locator("h1").innerText()));

  // ═══ I 员工 ═══
  console.log("\nI 员工登入");
  const staffPage = await (await browser.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  await staffPage.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await staffPage.fill('input[type="email"]', crew.email);
  await staffPage.fill('input[type="password"]', crew.password);
  await staffPage.click('button[type="submit"]');
  await staffPage.waitForURL(/portal/, { timeout: 180000 }).catch(() => {});
  await staffPage.goto(`${BASE}/en/salon-preview/settings`, { waitUntil: "networkidle", timeout: 180000 });
  const staffBody = await staffPage.locator("body").innerText();
  check("🔴 员工打开：整页只有一句「only visible to the business owner」", /only visible to the business owner/.test(staffBody) && !/Brand name/.test(staffBody));
  check("没有保存键、没有分页签", (await staffPage.getByTestId("settings-save-top").count()) === 0 && (await staffPage.getByRole("tab").count()) === 0);
  await staffPage.goto(`${BASE}/en/salon-preview/overview`, { waitUntil: "networkidle", timeout: 180000 });
  const staffLabels = (await staffPage.locator("aside nav a").allInnerTexts()).map((t) => t.trim());
  check("🔴 员工的侧栏上没有「Tenant Settings」这一行", !staffLabels.some((t) => t.includes("Tenant Settings")), staffLabels.join("|"));
  const staffApi = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await staffApi.auth.signInWithPassword({ email: crew.email, password: crew.password });
  const sb = await staffApi.rpc("set_booking_rules", { in_project_id: pid, in_no_show_deposit_after: 1, in_default_deposit_cents: 100 });
  const sbr = await staffApi.rpc("add_branch", { in_project_id: pid, in_name: "Sneaky" });
  const sl = await staffApi.rpc("set_loyalty_rule", { in_project_id: pid, in_stamps_needed: 3 });
  check("🔴 员工自己直接打资料库也写不进去（订金规矩 · 开分店 · 集点都被拒）", !!sb.error && !!sbr.error && !!sl.error && (await bookingRow())?.no_show_deposit_after === null && (await branchRows()).length === 2, JSON.stringify([sb.error?.message, sbr.error?.message, sl.error?.message]));

  check("🔴 整个过程一个 alert() 都没弹", alerts === 0, String(alerts));
} finally {
  if (browser) await browser.close();
  await dropThrowaways(admin, created);
}

console.log(`\n判：${pass.length} 过 · ${fail.length} 没过`);
if (fail.length) {
  console.log("🔴 " + fail.join("\n🔴 "));
  process.exit(1);
}
console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那几张图`);

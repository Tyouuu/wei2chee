/**
 * 经销商自己那条连结 —— 用眼睛看，而且走两边。
 *
 * 重点 7l。`check:party-portal` 42 条真的呼叫全过，而它答不了两件事：
 * **他发不发得出那条连结**，跟**经销商打不打得开它**。
 *
 * 🔴 那六支函式 20260905680000 就是真的了，而到 2026-09-05 为止
 * **画面上一个入口都没有**（grep 全 app = 0）。
 * 一条没有人发得出去的连结，跟一条不存在的连结是同一件事。
 *
 * 这一段走的就是那条线的两头：
 *   老板开一条 -> 复制得了 -> **另一个浏览器分页（没有登入）打得开** ->
 *   他自己送一笔 -> 老板的收件匣看得到 -> 一按变成一张有单号的单 ->
 *   经销商那一边看得到「已经开单了」 -> 关掉 -> 当场打不开
 *
 * ⚠️ 用完就删的帐号。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".screenshots/party-portal";
mkdirSync(OUT, { recursive: true });

const stamp = Date.now();
const EMAIL = `pp-${stamp}@formae.test`;
const PASSWORD = `Pp-${stamp}-x!`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const bad = [];
let userId = null;
let browser;
const say = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
};

try {
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await admin.from("projects").select("id").eq("account_id", userId).single();
  const P = proj.id;
  await admin.from("projects").update({ business_name: "Vibe Mobile Trading" }).eq("id", P);

  /* 一个下游经销商（在名册上是客户），跟一个师傅 —— 师傅那一个是控制组：
     他有登入，走里面那条路，所以那一段**不该画**。 */
  await api.rpc("add_project_page", { requested_key: "staff", new_title: null });
  const { data: dealer, error: dErr } = await api.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Sunrise Mobile Sdn Bhd",
  });
  if (dErr) throw new Error(`add_directory_entry: ${dErr.message}`);
  const { data: crew } = await api.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Aida",
  });

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });
  const hide = () => page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

  /* ① 那颗按钮在，而且师傅那一页没有。 */
  await page.goto(`${BASE}/en/portal/customers/${dealer.id}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  await hide();
  await page.screenshot({ path: `${OUT}/1-before.png`, fullPage: true });
  console.log("拍到  1-before");
  const before = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const openBtn = page.getByRole("button", { name: /^Open a link for them$/i });
  say("🔴 客户那一页上有一颗「开一条连结」", (await openBtn.count()) === 1, `${await openBtn.count()} 颗`);
  say("还没送过东西的时候讲得出来，不是一片空白",
    /have not sent anything yet/i.test(before), before.slice(0, 400));

  await page.goto(`${BASE}/en/portal/staff/${crew.id}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);
  const staffText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  /* 控制组：师傅那一页不画 —— open_party_portal 自己就会拒绝一个 staff，
     而画一颗按下去一定失败的按钮，正是这个仓库禁的那一种。 */
  say("师傅那一页上没有这一段（控制组）", !/Their own link/i.test(staffText), staffText.slice(0, 300));

  /* ② 按下去，连结出来了。 */
  await page.goto(`${BASE}/en/portal/customers/${dealer.id}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /^Open a link for them$/i }).click();
  await page.waitForTimeout(3500);
  await hide();
  await page.screenshot({ path: `${OUT}/2-link.png`, fullPage: true });
  console.log("拍到  2-link");
  const link = await page.getByLabel("Their link").inputValue();
  say("🔴 画面上真的给得出那条连结", /\/p\/[0-9a-f-]{36}$/i.test(link), `读到「${link}」`);
  const { data: row } = await api
    .from("directory_entries").select("portal_ref").eq("id", dealer.id).maybeSingle();
  say("而且那不是他那一行的 id", row?.portal_ref && row.portal_ref !== dealer.id, `${row?.portal_ref}`);
  say("复制那颗在", (await page.getByRole("button", { name: /^Copy$/i }).count()) === 1, "没有");

  /* ③ 🔴 没有登入的那一边 —— 一个全新的浏览器情境，没有任何 cookie。 */
  const outside = await browser.newContext();
  const dealerPage = await outside.newPage();
  await dealerPage.goto(link, { waitUntil: "networkidle", timeout: 180000 });
  await dealerPage.waitForTimeout(2000);
  await dealerPage.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await dealerPage.screenshot({ path: `${OUT}/3-dealer.png`, fullPage: true });
  console.log("拍到  3-dealer");
  const dealerText = (await dealerPage.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 没有登入的人打得开那条连结", /Sunrise Mobile Sdn Bhd/.test(dealerText), dealerText.slice(0, 300));
  say("看得到是哪一家的", /Vibe Mobile Trading/.test(dealerText), dealerText.slice(0, 300));
  /* 🔴 漏不漏。这一段比功能重要 —— 一条带着走的连结，看得到什么就是它的爆炸半径。 */
  say("看不到那个师傅", !/Aida/.test(dealerText), dealerText.slice(0, 400));
  say("看不到任何一个 id",
    !new RegExp(dealer.id, "i").test(await dealerPage.content()), "id 印在页面上");

  /* ④ 他自己送一笔。 */
  /* ⚠️ **先等它接上事件再填。** 第一版在页面还没接上之前就 fill，
     React 一重画那句话就没了，於是「送出去」永远是灰的 ——
     而那看起来完全像产品把按钮做死了。填完先读回来确认。 */
  const box = dealerPage.getByRole("textbox").first();
  await box.waitFor({ state: "visible", timeout: 60000 });
  await dealerPage.waitForTimeout(1500);
  await box.fill("下一批卡帮我留 200 张");
  await dealerPage.waitForTimeout(300);
  say("那句话真的打进去了", (await box.inputValue()).includes("200"), `读回「${await box.inputValue()}」`);
  await dealerPage.getByRole("button", { name: /^Send$/i }).click({ timeout: 30000 });
  await dealerPage.waitForTimeout(3500);
  await dealerPage.screenshot({ path: `${OUT}/4-sent.png`, fullPage: true });
  console.log("拍到  4-sent");
  const sentText = (await dealerPage.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 他自己送得出一笔", /留 200 张/.test(sentText), sentText.slice(0, 400));
  const { data: inbox } = await api.rpc("party_requests_of", { in_project_id: P });
  say("而且资料库里真的有那一笔", (inbox ?? []).length === 1, `${(inbox ?? []).length} 笔`);

  /* ⚠️ **「一页都没有」那个状态在这个帐号上造不出来** —— 它开局就有
     报价单跟订单两页。那一条（没有走单的页就不画那颗按钮、而且讲得出
     为什么）改用元件测试量：`party-portal-panel.test.tsx`。
     🔴 而它本来在这里是**因为我的 bug 才过的** —— 我把 `sort_order`
     写成 `position`，整个查询报错、静静回 null，於是那颗按钮永远不画。
     一条因为产品坏了而变绿的断言，比没有那一条更糟。 */

  /* 加一页走单的，那颗才该出现。 */
  const { error: ordErr } = await api.rpc("add_project_page", {
    requested_key: "orders", new_title: null,
  });
  if (ordErr && !String(ordErr.message).includes("exists")) {
    throw new Error(`add_project_page(orders): ${ordErr.message}`);
  }

  /* ⑤ 老板的收件匣看得到，一按变单。 */
  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  await hide();
  await page.screenshot({ path: `${OUT}/5-inbox.png`, fullPage: true });
  console.log("拍到  5-inbox");
  const inboxText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 老板那一页上看得到他送的那一笔", /留 200 张/.test(inboxText), inboxText.slice(0, 400));
  const turn = page.getByRole("button", { name: /^Open it as /i });
  say("而且有一颗「开成一张单」", (await turn.count()) === 1, `${await turn.count()} 颗`);

  await turn.click();
  await page.waitForTimeout(4000);
  await hide();
  await page.screenshot({ path: `${OUT}/6-turned.png`, fullPage: true });
  console.log("拍到  6-turned");
  const { data: after } = await api.rpc("party_requests_of", {
    in_project_id: P, in_open_only: false,
  });
  const one = (after ?? [])[0];
  say("🔴 一按真的开出一张单", one?.status === "done" && !!one?.record_id, JSON.stringify(one));
  say("而且有单号 —— 走的是人按的那一支", !!one?.doc_no, `${one?.doc_no}`);
  /* ⚠️ 重新载入再读 —— `router.refresh()` 回来之前就读，
     读到的是按下去之前那一版，而那一条红看起来像画面没有更新。 */
  await page.reload({ waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  const turnedText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("画面上讲得出开成了哪一张",
    /Already opened as [A-Z]{2}-\d{4}-\d{4}/.test(turnedText), turnedText.slice(0, 500));

  /* ⑥ 经销商那一边也看得到 —— 一笔送进去之后没有下文，他会再送一次。 */
  await dealerPage.reload({ waitUntil: "networkidle", timeout: 180000 });
  await dealerPage.waitForTimeout(1200);
  const dealerAfter = (await dealerPage.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 经销商自己也看得到已经开单了，而且是哪一张",
    /Opened as [A-Z]{2}-\d{4}-\d{4}/.test(dealerAfter), dealerAfter.slice(0, 400));

  /* ⑦ 关掉 —— 当场打不开，而他送过的那几笔一笔不少。 */
  await page.getByRole("button", { name: /^Close this link$/i }).click();
  await page.waitForTimeout(3500);
  await dealerPage.reload({ waitUntil: "networkidle", timeout: 180000 });
  await dealerPage.waitForTimeout(1200);
  await dealerPage.screenshot({ path: `${OUT}/7-closed.png`, fullPage: true });
  console.log("拍到  7-closed");
  const shut = (await dealerPage.locator("body").innerText()).replace(/\s+/g, " ");
  say("🔴 关掉之后当场打不开", /not in use/i.test(shut), shut.slice(0, 300));
  const { data: stillThere } = await api.rpc("party_requests_of", {
    in_project_id: P, in_open_only: false,
  });
  say("而他送过的那几笔一笔不少", (stillThere ?? []).length === 1, `${(stillThere ?? []).length} 笔`);

  /* ⑧ 手机上 —— 经销商是拿手机开那条连结的。 */
  /* ⚠️ 关掉再开会**换一条新号码**（那正是「收得回来」的意思）——
     所以旧的那条网址是死的。第一版拿旧的去拍，拍回来是
     「这条连结不能用了」，而那看起来像整件事坏了。 */
  const { data: newRef } = await api.rpc("open_party_portal", { in_party_id: dealer.id });
  const freshLink = `${BASE}/p/${newRef}`;
  const phone = await outside.newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(freshLink, { waitUntil: "networkidle", timeout: 180000 });
  await phone.waitForTimeout(1200);
  await phone.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await phone.screenshot({ path: `${OUT}/8-phone-390.png`, fullPage: true });
  console.log("拍到  8-phone-390");
  const scrolls = await phone.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  say("手机上不用左右滑", !scrolls, "会横滑");
  const small = await phone.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("button, input, textarea")) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.height < 40) out.push(`${el.tagName}=${Math.round(r.height)}`);
    }
    return out;
  });
  say("手机上每一颗都按得稳（≥40px）", small.length === 0, small.join(" · "));
  say("手机上真的开得起来，不是「不能用了」",
    /Sunrise Mobile Sdn Bhd/.test((await phone.locator("body").innerText())),
    (await phone.locator("body").innerText()).slice(0, 200));

  /* 🔴 **这一条是用眼睛看那张图看出来的，尺子当时一条都没红。**
     `/p/` 在 app/[locale]/ 外面，而第一版**没有自己的根 layout** ——
     於是一行 CSS 都没载入：整页衬线字、没有边框、没有间距，
     而每一个 class 都还好好写在那里，什么都没报错。
     一个经销商在手机上打开它，看到的是一张坏掉的纸。
     量法挑两个 Tailwind 真的生效才会有的值 —— 版心的宽，跟那颗按钮的底色。 */
  const painted = await phone.evaluate(() => {
    const lum = (css) => {
      const m = String(css).match(/[\d.]+/g);
      if (!m || m.length < 3) return null;
      const [r, g, b] = m.map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };
    const main = document.querySelector("main");
    const h1 = document.querySelector("h1");
    return {
      maxWidth: main ? getComputedStyle(main).maxWidth : "none",
      ground: lum(getComputedStyle(document.body).backgroundColor),
      ink: h1 ? lum(getComputedStyle(h1).color) : null,
    };
  });
  /* 🔴 **第一版只问「有没有样式」，而那两个值是对的、画面是坏的** ——
     近黑底配近黑字，因为 globals.css 那块地是 Formae 的深色壳。
     所以量的换成**读不读得出来**：地跟字要真的分得开。 */
  say("🔴 那一页读得出来 —— 地跟字分得开",
    painted.maxWidth !== "none" &&
      painted.ground !== null && painted.ink !== null &&
      Math.abs(painted.ground - painted.ink) > 0.4,
    JSON.stringify(painted));

} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  bad.push(err.message);
} finally {
  if (userId) await dropThrowaway(admin, userId);
  console.log("\n(临时帐号删掉了)");
  if (browser) await browser.close();
}

console.log(`\n判：${bad.length} 项没过`);
for (const b of bad) console.log(`  · ${b}`);
process.exit(bad.length ? 1 : 0);

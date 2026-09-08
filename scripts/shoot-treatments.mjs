/**
 * 她做过什么 —— 真的登入、真的传一张照片、真的用眼睛看一次。
 *
 *   npm run shoot:treatments
 *
 * 🔴 资料库那一层 `check:treatments` 已经量过 41 条。这一支量的是**另一件**：
 * 那几支函式到不到得了她眼前（[重点 7l](../docs/founder-points.md)：
 * 数字全绿而画面是坏的，这个仓库发生过十几次）。
 *
 * ⚠️ 而它走的是**整条线**，不是只按那一支 RPC：
 * 上传到私有的桶 → 挂在那一次疗程上 → 页面把网址签出来 → 图真的画出来。
 * 少了最后两段，一张挂得上去而画不出来的照片跟没有一样。
 */
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import sharp from "sharp";
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
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const OUT = ".screenshots/treatments";
mkdirSync(OUT, { recursive: true });

let pass = 0;
const bad = [];
const check = (what, ok, saw) => {
  if (ok) { pass++; console.log(`  PASS  ${what}`); }
  else { bad.push(what); console.log(`  FAIL  ${what}${saw === undefined ? "" : ` — ${saw}`}`); }
};

/* 🔴 一张**真的**画得出来的 jpeg。
   第一版用一串手抄的 base64 —— 浏览器解不开，两张图 naturalWidth 都是 0，
   而画面上那两个灰方块跟一条签坏的网址长得一模一样。
   `sharp` 本来就在依赖里，让它产生一张，不要自己抄。 */
const JPEG = await sharp({
  create: { width: 240, height: 240, channels: 3, background: { r: 214, g: 196, b: 186 } },
}).jpeg().toBuffer();

const stamp = Date.now();
let ownerId = null;
let browser = null;
dropThrowawayOnExit(admin, () => ownerId);

try {
  /* ── 台面：一间 medi spa ─────────────────────────────────────────────── */
  const { data: ind } = await admin
    .from("industries").select("id").eq("slug", "beauty").single();
  const { data: lead } = await admin
    .from("leads").insert({ industry_id: ind.id, language: "en", answers: {} })
    .select("id").single();

  const email = `treatshot-${stamp}@formae.test`;
  const password = `Ts-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { lead_id: lead.id },
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  ownerId = made.user.id;

  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", ownerId).single();
  const P = proj.id;
  await admin.from("projects").update({ business_name: "Lumiere Medi Spa" }).eq("id", P);

  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password });

  const say = async (fn, args) => {
    const { data, error } = await c.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data;
  };

  const client = await say("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ms Lim",
  });
  const CLIENT = client?.id ?? client;
  const amy = await say("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Amy",
  });

  const item = await say("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory",
    in_name: "Botox 100u", in_unit: "unit",
  });
  const lot = await say("add_stock_batch", {
    in_item_id: item.id, in_code: "BX-2411", in_expiry_on: "2027-03-31",
  });
  await say("move_stock", {
    in_item_id: item.id, in_direction: "in", in_qty: 300,
    in_reason: "opening", in_batch_id: lot.id,
  });

  /* 两次疗程 —— 一段一笔的历史，不是一笔。 */
  const older = await say("add_treatment_note", {
    in_party_id: CLIENT, in_what: "Hydrafacial", in_area: "full face",
    in_staff_id: amy?.id ?? amy,
    in_done_on: new Date(Date.now() - 86400e3 * 40).toISOString().slice(0, 10),
  });
  const note = await say("add_treatment_note", {
    in_party_id: CLIENT, in_what: "Botox", in_area: "glabella",
    in_staff_id: amy?.id ?? amy, in_note: "Slightly conservative on the first pass.",
  });
  await say("add_treatment_product", {
    in_note_id: note.id, in_item_id: item.id, in_qty: 20,
  });

  /* 🔴 真的传两张进私有的桶。 */
  for (const [tail, stage, may] of [["before", "before", false], ["after", "after", true]]) {
    const path = `${P}/${note.id}/${tail}.jpg`;
    const { error: upErr } = await c.storage
      .from("job-photos").upload(path, JPEG, { contentType: "image/jpeg", upsert: true });
    if (upErr) throw new Error(`upload ${tail}: ${upErr.message}`);
    await say("add_treatment_photo", {
      in_note_id: note.id, in_path: path, in_stage: stage, in_may_show: may,
    });
  }

  /* ── 打开那一页 ──────────────────────────────────────────────────────── */
  browser = await chromium.launch();
  for (const [w, h, tag] of [[1400, 950, "1400"], [390, 844, "390"]]) {
    const page = await browser.newPage({
      viewport: { width: w, height: h }, deviceScaleFactor: 2,
    });
    await page.goto("http://localhost:3000/en/login", {
      waitUntil: "domcontentloaded", timeout: 90000,
    });
    await page.waitForSelector("input[type=email]", { timeout: 60000 });
    await page.fill("input[type=email]", email);
    await page.fill("input[type=password]", password);
    await page.click("button[type=submit]");
    await page.waitForURL(/\/portal/, { timeout: 240000 });

    await page.goto(`http://localhost:3000/en/portal/customers/${CLIENT}`, {
      waitUntil: "domcontentloaded", timeout: 120000,
    });
    await page.waitForSelector("text=What she has had done", { timeout: 90000 });
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });

    const body = await page.evaluate(() => document.body.innerText);
    if (tag === "1400") {
      check("那一段真的画出来了", body.includes("What she has had done"));
      check("两次都在，上一次的排在最上面",
        body.indexOf("Botox") < body.indexOf("Hydrafacial"),
        `${body.indexOf("Botox")} / ${body.indexOf("Hydrafacial")}`);
      check("讲得出用了多少", /Used\s+Botox 100u — 20 unit/.test(body), body.match(/Used[^\n]*/)?.[0]);
      check("🔴 讲得出哪一批 —— 她被问的时候答得出来",
        body.includes("BX-2411"), body.match(/Batch[^\n]*/)?.[0]);
      check("讲得出谁做的", body.includes("By Amy"));
      /* 🔴 看图看出来的：正上方写着「还没有来过」，而底下是她两次疗程。
         同一屏两句话互相打架，比两者都糟（[任务 80]）。 */
      check(
        "🔴 而正上方那一段不再写「还没有来过」",
        !body.includes("Nothing yet"),
        body.split("\n").filter((l) => l.includes("Nothing")).join(" | "),
      );
      check("🔴 那一张不给看的，画面上讲了出来", body.includes("Stays in the record"));
      check("而给看的那一张不一样", body.includes("She agreed this may be shown"));

      /* 🔴 图真的画出来了 —— 网址是签出来的，签错了就是两个破图，
         而画面上跟「还没传照片」长得一模一样。

         ⚠️ 等的是 `src` 不是 `currentSrc`：一张还没开始载的图 `currentSrc`
         是空字串，於是那个筛出来是**空集合**，而 `every()` 对空集合是 true
         —— 一把在等空集合的尺，跟一把等到了的尺长得一模一样。 */
      await page.waitForFunction(
        () => {
          const xs = [...document.querySelectorAll('img[src*="job-photos"]')];
          return xs.length > 0 && xs.every((i) => i.complete && i.naturalWidth > 0);
        },
        undefined,
        { timeout: 30000 },
      ).catch(() => {});
      const drawn = await page.evaluate(() =>
        [...document.querySelectorAll('img[src*="job-photos"]')].map((i) => i.naturalWidth));
      check("🔴 两张照片真的画出来了（签出来的网址是好的）",
        drawn.length === 2 && drawn.every((n) => n > 0), JSON.stringify(drawn));
    }

    /* 🔴 他 2026-09-09 讲「太长了吧」—— 所以量它。
       参考那一页把宽度用掉了，我们本来把十五段叠在一条 450px 的窄栏里。 */
    const tall = await page.evaluate(() => document.body.scrollHeight);
    console.log(`    ${tag} 整页高：${tall}px`);

    const wide = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 1);
    check(`${tag} 不横滚`, !wide);

    await page.screenshot({
      path: `${OUT}/customer-${tag}.jpg`, type: "jpeg", quality: 82, fullPage: true,
    });
    await page.close();
  }

  /* 一间不记疗程的店，那一段一个像素都不画。 */
  const plain = await say("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mr Ong",
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  await page.goto("http://localhost:3000/en/login", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("input[type=email]", { timeout: 60000 });
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/portal/, { timeout: 240000 });
  await page.goto(`http://localhost:3000/en/portal/customers/${plain?.id ?? plain}`, {
    waitUntil: "domcontentloaded", timeout: 120000,
  });
  await page.waitForTimeout(2500);
  const plainBody = await page.evaluate(() => document.body.innerText);
  check("🔴 一个还没做过任何疗程的客人，那一段整段不画",
    !plainBody.includes("What she has had done"));
  await page.close();
} catch (e) {
  bad.push(String(e?.message ?? e));
  console.log(`\n🔴 ${e?.message ?? e}`);
} finally {
  if (browser) await browser.close();
  const gone = await dropThrowaway(admin, ownerId);
  console.log(gone ? "\n临时帐号删掉了" : "\n🔴 删不掉");
}

console.log(`\n判：${pass} 过 · ${bad.length} 没过`);
if (bad.length) {
  for (const x of bad) console.log(`  · ${x}`);
  process.exitCode = 1;
}

/**
 * 拍一张手写单 → 变成他帐上一张有逐项明细的单。
 *
 * ── 他 2026-09-10 拿 Tofu 的截图来问 ──────────────────────────────────────
 *
 *     `我们是不是可以做到这样了？`
 *
 * 那张截图是一张**手写的**茶餐室单子（「OLD MOTHER HEN」，中英夹杂，
 * 九行明细），被读成单号 · 日期 · 供应商 · 九行。
 *
 * 🔴 **这一支存在的理由是：零件全部在，而没有人把它们串起来试过一次。**
 *   · 私人的桶 ＋ 那颗回形针（20260909160000 · 任务 315）
 *   · 模型真的看得到图（`check:work-ai` 第 ⑩ 段，读得出图上那个编出来的字）
 *   · 开一张单（`add_table_row` → `add_pipeline_record`）
 *   · 一张单摆得下好几行（`add_record_line`，任务 327）
 *   · 一轮回得了最多十二个动作
 *
 * **五样都绿，而「拍一张变一张单」从来没有量过。**
 * 任务 60 第 2 条从 2026-08-29 就写着这一件是「全世界小生意唯一真在用的
 * AI 功能」—— 而它一直是一行任务，不是一个读数。
 *
 * ⚠️ **这张图不是真的手写。** 它是用字体画出来的、歪一点、中英夹杂 ——
 * 所以这一支**过了只证明那条线是通的**，不证明它读得懂 Ah Girl 的字。
 * 真的手写要拿真的照片跑一次，而那是他上门那天才有的东西。
 * **写出来，不要等他发现。**
 *
 * 要开着 `npm run dev`。
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { dropThrowaway } from "./lib/throwaway.mjs";
import { openAllPages } from "./lib/seed-demo.mjs";

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
const OUT = ".screenshots/from-photo";
mkdirSync(OUT, { recursive: true });
const EMAIL = `photo-${Date.now()}@formae.test`;
const PASSWORD = `Photo-${Date.now()}-x!`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
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

let browser;
let userId;

async function say(page, sentence) {
  const open = page.locator('[data-work-ai="closed"]');
  if (await open.count()) await open.first().click();
  const box = page.locator('[data-work-ai="open"] textarea').first();
  await box.waitFor({ timeout: 30000 });
  await box.fill(sentence);
  await page
    .locator('[data-work-ai="open"]')
    .getByRole("button", { name: /change it/i })
    .first()
    .click({ timeout: 30000 });
  await page
    .locator("[data-work-ai-said]")
    .first()
    .waitFor({ timeout: 180000 })
    .catch(() => {});
  return (
    await page.locator("[data-work-ai-said]").first().innerText().catch(() => "")
  ).trim();
}

/* 一张歪歪的茶餐室单子。⚠️ 见档头：**这不是真的手写**。
   每一行故意给一点随机的倾斜跟位移，中英夹杂，价钱右对齐 ——
   那是他那张截图上那一张的形状。 */
const ITEMS = [
  ["招牌鸡饭 Chicken rice", "16.00"],
  ["炒粿条 Char kuey teow", "12.00"],
  ["马来风光 Kangkung belacan", "12.00"],
  ["咸蛋鸡 Salted egg chicken", "28.00"],
  ["白饭 Rice x4", "6.00"],
  ["Teh ais", "6.60"],
];
function billSvg() {
  const rows = ITEMS.map(([what, amt], i) => {
    const y = 250 + i * 76;
    const tilt = (i % 2 === 0 ? -1 : 1) * (0.6 + (i % 3) * 0.5);
    const dx = (i % 3) * 6;
    return `<g transform="rotate(${tilt} 60 ${y})">
      <text x="${60 + dx}" y="${y}" font-family="Comic Sans MS, Segoe Script, cursive"
            font-size="40" fill="#1b3a8f">${what}</text>
      <text x="820" y="${y}" font-family="Comic Sans MS, Segoe Script, cursive"
            font-size="40" fill="#1b3a8f" text-anchor="end">${amt}</text>
    </g>`;
  }).join("");
  return `<svg width="900" height="820" xmlns="http://www.w3.org/2000/svg">
    <rect width="900" height="820" fill="#fdfcf4"/>
    <text x="450" y="90" font-family="Comic Sans MS, Segoe Script, cursive" font-size="52"
          font-weight="bold" text-anchor="middle" fill="#b3261e">SRI MURNI 小食店</text>
    <text x="60" y="160" font-family="Comic Sans MS, Segoe Script, cursive" font-size="34"
          fill="#1b3a8f">Table 3 · 10/09/2026</text>
    <line x1="50" y1="190" x2="850" y2="190" stroke="#1b3a8f" stroke-width="3"/>
    ${rows}
    <line x1="50" y1="720" x2="850" y2="720" stroke="#1b3a8f" stroke-width="3"/>
    <text x="60" y="780" font-family="Comic Sans MS, Segoe Script, cursive" font-size="44"
          font-weight="bold" fill="#b3261e">JUMLAH</text>
    <text x="840" y="780" font-family="Comic Sans MS, Segoe Script, cursive" font-size="44"
          font-weight="bold" text-anchor="end" fill="#b3261e">80.60</text>
  </svg>`;
}

try {
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", userId).single();
  const P = proj.id;
  await openAllPages(api);

  const paper = await sharp(Buffer.from(billSvg())).jpeg({ quality: 92 }).toBuffer();

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  await page.goto(`${BASE}/en/portal/orders`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);

  console.log("\n① 那颗回形针在，而且收得下这张图");
  const openIt = page.locator('[data-work-ai="closed"]');
  if (await openIt.count()) await openIt.first().click();
  check("🔴 单据那一页上有那颗回形针",
    (await page.locator("[data-work-ai-shot]").count()) > 0, "找不到");
  await page
    .locator('[data-work-ai="open"] input[type="file"]')
    .first()
    .setInputFiles({ name: "bill.jpg", mimeType: "image/jpeg", buffer: paper });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/1-attached.png` });

  /*
    🔴 **先单独量「它有没有看到图」，再量「它写不写得进去」。**

    ⚠️ 第一版我把这一条写成「它回的那句话里有没有提到六行」——
    而那是在量**模型怎么措辞**，不是在量一个事实：跑两次拿到两种讲法，
    一次提了六行，一次没提，而两次它都读到了图。
    **把作者期望的说法当成正确答案，尺子就不再量产品，开始量作者**
    （[任务 23](../docs/founder-tasks.md#23) 那一条的原话）。

    现在问的是**只有看了图才答得出的两样**：店名，跟那个不好猜的 6.60。
  */
  console.log("\n② 🔴 先看它读不读得到这张图");
  /* ⚠️ 第一版我问「最小的金额」，而它答 6.00 —— **6.00 本来就比 6.60 小**。
     那一条红的是我，不是产品（今晚第三次：[重点 31] 最后一段）。
     现在问的是**指名那一行** —— 一个只有看了图才答得出的数字。 */
  const read = await say(
    page,
    "Look at the bill I attached. What is the shop name at the top, and what amount is written for Teh ais?",
  );
  console.log(`        它讲了：${read.split(String.fromCharCode(10)).join(" / ").slice(0, 240)}`);
  check("🔴 店名读到了（SRI MURNI）", /murni/i.test(read), read.slice(0, 200));
  check("🔴 Teh ais 那一行读对了（6.60）", /6\.60/.test(read), read.slice(0, 200));

  console.log("\n②b 🔴 同一张图，第二轮还在不在");
  /*
    🔴 **量出来：不在。** 而它自己讲得很清楚 ——
    `I can open the order, but I can't see the bill's individual line items
     and amounts here—please attach the bill again.`

    而**先问一句再叫它开单，正好是他真的会做的事**。
    所以这一条不是挑毛病，它就是他的用法。
  */
  const again = await say(page, "From that same bill, what amount is written for Teh ais?");
  console.log(`        它讲了：${again.split(String.fromCharCode(10)).join(" / ").slice(0, 240)}`);
  check(
    "🔴 不用重新附一次，它还讲得出那一行",
    /6\.60/.test(again),
    again.slice(0, 200),
  );

  /* 重新附一次 —— 下面那一段要量的是「写得不写得进去」，不是上面这一条。
     两件事混在一条断言里，红的时候分不出是哪一件。 */
  await page
    .locator('[data-work-ai="open"] input[type="file"]')
    .first()
    .setInputFiles({ name: "bill.jpg", mimeType: "image/jpeg", buffer: paper });
  await page.waitForTimeout(2500);

  console.log("\n③ 🔴 「照这张开一张单，逐项都要」");
  const before = await admin
    .from("pipeline_records").select("id", { count: "exact", head: true })
    .eq("project_id", P).eq("module_key", "orders");
  const said = await say(
    page,
    "Open an order from this bill for SRI MURNI. Put every line on it with its own amount.",
  );
  console.log(`        它讲了：${said.split(String.fromCharCode(10)).join(" / ").slice(0, 300)}`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/2-said.png` });

  /*
    🔴 **先分开两件事，不然这一段读起来会像「它看不懂手写」——而那是错的。**

    第一次跑（2026-09-10）它回的是：
      `I can't put the bill's six lines with their individual amounts onto a
       new order here because line items can only be added to an order that
       already has a record ID.`

    **它数得出六行** —— 图是读到了。断的是**写**那一边：
    开一张新单跟往单上写明细是两个动作，而第二个要一个还不存在的编号。
    所以这一条单独量「它有没有看到图」，让红的那几条只讲写的那一半。
  */
  const { data: rows } = await admin
    .from("pipeline_records").select("id, party, title, amount_cents")
    .eq("project_id", P).eq("module_key", "orders")
    .order("created_at", { ascending: false });
  const fresh = (rows ?? [])[0];
  check(
    "🔴 他帐上真的多了一张单",
    (rows ?? []).length === (before.count ?? 0) + 1,
    `${before.count} → ${rows?.length}`,
  );
  check(
    "而且是那一家的名字（图上读来的）",
    /murni/i.test(String(fresh?.party ?? "") + String(fresh?.title ?? "")),
    `party="${fresh?.party}" title="${fresh?.title}"`,
  );

  console.log("\n④ 🔴 逐项进去了没有");
  const { data: lines } = await admin
    .from("record_lines").select("description, amount_cents, qty")
    .eq("record_id", fresh?.id ?? "00000000-0000-0000-0000-000000000000");
  const got = lines ?? [];
  console.log(`        进去 ${got.length} 行：${got.map((l) => `${l.description}=${l.amount_cents}`).join(" · ").slice(0, 300)}`);
  check("🔴 明细真的写进去了", got.length > 0, "一行都没有");
  check(
    `🔴 六行都在（图上有 ${ITEMS.length} 行）`,
    got.length === ITEMS.length,
    `只有 ${got.length} 行`,
  );
  /* 🔴 一个不好猜的数字 —— 它读到了，就只有一种可能：它真的看了那张图。 */
  const odd = got.find((l) => Number(l.amount_cents) === 660);
  check(
    "🔴 那一行 RM 6.60 读对了（一个猜不出来的数字）",
    !!odd,
    JSON.stringify(got.map((l) => l.amount_cents)),
  );
  const salted = got.find((l) => /salted|咸蛋/i.test(String(l.description ?? "")));
  check(
    "🔴 中英夹杂那一行也读对了（咸蛋鸡 · RM 28）",
    !!salted && Number(salted.amount_cents) === 2800,
    JSON.stringify(got.map((l) => l.description)),
  );

  console.log("\n⑤ 🔴 总额是资料库加出来的，不是它讲的");
  const sum = got.reduce((n, l) => n + Number(l.amount_cents ?? 0), 0);
  check(
    `🔴 单上的总额 = 那几行加起来（RM ${(sum / 100).toFixed(2)}）`,
    Number(fresh?.amount_cents) === sum && sum > 0,
    `单上 ${fresh?.amount_cents} ⟂ 行加起来 ${sum}`,
  );
} catch (e) {
  failed.push(`threw: ${e.message}`);
  console.error(e);
} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
  console.log(
    failed.length
      ? `\n🔴 ${failed.length} 条红:\n${failed.map((f) => `  · ${f}`).join("\n")}\n`
      : "\n全部绿。\n",
  );
  process.exit(failed.length ? 1 : 0);
}

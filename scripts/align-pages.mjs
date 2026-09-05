/* 每一页都跟它对应的那一页比 —— 我们的 vs 他挑的那一套（arhamkhnz）。
 *
 *   npm run align:pages                 # 全部
 *   npm run align:pages -- quotations   # 只比一页
 *
 * ── 为什么要有它 ──────────────────────────────────────────────────────────
 *
 * 老板 2026-09-05：`你要每一个页面都是要尽可能借鉴其他人的做法
 * 看看我们还有哪里可以改进`。
 *
 * `align:admin` 只比**总览**那一页（六套风格各比各的参考）。而工作台
 * 2026-09-04 收敛成一套之后，真正该问的问题换了：**我们那十四页，
 * 每一页对上他们哪一页，差在哪。**
 *
 * ── 两边用同一支探针，这一条不能省 ────────────────────────────────────────
 *
 * 他们那一边只有**图**（`.screenshots/upstream/up-*.png`，2026-08-26 拍的；
 * 而他们线上那个 demo 现在有两页已经 404 了 —— 见[任务 119](../docs/founder-tasks.md)，
 * 那份本地备份就是这条尺还跑得动的唯一原因）。
 *
 * 所以两边都走 `probe-image.mjs` —— **从像素量，不是一边读 DOM 一边看图**。
 * 这个仓库栽过：`align` 的「段内留白」报 8% 对 1%，查出来是行内元素对块级元素
 * ——**量法的差异被当成了设计的差异**。
 *
 * ⚠️ **数字只能否决，不能通过**（[重点 24](../docs/founder-points.md)）。
 * 过不过看它写出来的那张并排图。
 *
 * ⚠️ **参考图读不到就是失败，不是通过。**
 *
 * 🔴 **而它 2026-09-05 换掉了它量的那个帐号，两个理由。**
 *
 * ① **它一直在打一张冻住的页。** 编辑器有自动保存（任何改动之后 2.5 秒），
 *    而这把尺自己在开编辑器 —— 於是它跑过的每一页都被存进
 *    `project_pages.layout_json`，而 `page.tsx` 只要那一栏有东西就读它、
 *    不再问产生器。**组件层的改动照样生效（所以没有人发现），而
 *    「这一页有哪几块」的改动永远到不了这把尺。**
 *
 * ② 🔴 **而更要紧的是：那个 demo 帐号只开了六页，也只有七笔记录。**
 *    於是 报表 · 库存 · 预约 · 供应商 四页**从来没有被量过**，
 *    而量得到的那几页，「底下一片空」跟「块与块的缝」量到的其实是
 *    **他的记录比参考那个 demo 少** —— 那不是设计的毛病，也永远修不好。
 *    **一个永远不会变绿的读数，没有人会读。**
 *
 * 所以现在开一个**用完就删的帐号**：开满十八页、每一种零件种五行真资料
 * （台面跟 `shoot:pages` 共用同一份 `lib/seed-demo.mjs`），量完删掉。
 *
 * 🔴 **而且量的是他真正看到的那一边**，不是编辑器画布。
 * 参考那十五张是**别人的系统页**，不是别人的建站工具 ——
 * 拿编辑器去比，比到的是我们的工具（[任务 162](../docs/founder-tasks.md)）。
 * 做法跟 `shoot:pages` 一样：先按一次「保存设计」，正门从此是他的系统。
 * ⚠️ 保存的是**排行**那一页 —— 它不在下面的配对表里，
 * 所以十四页照旧从产生器长出来。
 */
import { chromium } from "playwright";
import { measureImage } from "./probe-image.mjs";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { createRequire } from "node:module";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";
import { openAllPages, seedEveryShape } from "./lib/seed-demo.mjs";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const OUT = ".screenshots/align-pages";
const BASE = process.env.ALIGN_BASE || "http://localhost:3000";
const EMAIL = `align-${Date.now()}@formae.test`;
const PASS = `Align-${Date.now()}-x!`;
const MARK = `ZZ${Date.now().toString().slice(-6)}`;
/** 用完就删的那个帐号。**放模组层** —— 「删掉它」有三条路要走得到：
 *  正常跑完 · 抛错 · 被杀。少接一条，就是一次留下不删。 */
let userId = null;
/**
 * 哪一页对哪一页 —— 配对读的是「这一页在回答什么问题」，不是名字。
 * 配对表本身来自[任务 95b](../docs/founder-tasks.md)（逐张看过他们十五页之后配的）。
 */
const PAIRS = [
  ["dashboard",       "up-default",      "总览",     "一屏四张数字卡加图表"],
  /* 🔴 第一版把「报价单清单」配给了他们的 **Create New Invoice** ——
     那是**开一张单**的页，不是清单。於是它报「一屏几块 8 对 3」，
     而那个差异是配错对量出来的，不是设计的差异。
     清单对清单（他们的 Tasks），开单对开单（他们的 Invoice）。 */
  ["quotations",      "up-tasks",        "报价单",   "一张能筛能排能勾的清单"],
  ["quotations/new",  "up-invoice",      "开一张单", "左边填表、右边一张印出来的纸"],
  ["projects",        "up-kanban",       "工程",     "看板：一栏一个阶段"],
  ["customers",       "up-users",        "客户",     "一张带头像跟分面筛选的名册"],
  ["payments",        "up-finance",      "收款",     "钱：数字卡加走势"],
  ["reports",         "up-analytics",    "报表",     "图表为主"],
  ["inventory",       "up-file-manager", "库存",     "一格一格的东西"],
  ["bookings",        "up-productivity", "预约",     "行事历"],
  ["suppliers",       "up-logistics",    "供应商",   "左清单右详情"],
];

/**
 * 🔴 底下那一片空，占整页多少。
 *
 * 第一版没有这一项，於是它对着**每一页底下三分之一的空白**回报
 * 「没有明显不如人的」。而同一份读数里其实已经写着：块与块的缝
 * 他们 38px、我们 **470px**。**讯号在，判语没抓** ——
 * 一把永远说通过的尺，跟一把量不到的尺一样糟。
 *
 * 从底下往上扫，一整列都跟地同色就算空的。
 */
async function tailBlank(png) {
  const img = sharp(png);
  const { width, height } = await img.metadata();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const at = (x, y) => {
    const i = (y * info.width + x) * ch;
    return [data[i], data[i + 1], data[i + 2]];
  };
  /* 🔴 只扫**中间那一段**（30%–70%），两边都一样。
   *
   * 左边是侧栏 —— 我们的占 19%、他们的占 10%，而侧栏上有字，
   * 所以从 x=0 扫会在第一行就撞到「Ranking」那几个字停下来。
   * 实测：一页底下明明空着三分之一，这一项回报 **0.3%**。
   * ⚠️ 而 `probe-image` 那一项「侧栏占多宽」两边都报 0.0% ——
   * **它认不出白侧栏**，所以那个宽度这里拿不到，只能画一条固定的线。
   *
   * 右边是我们自己那颗「用讲的改」的浮动药丸，它让最底下每一行都不是空的。
   * 一个飘在上面的东西不算内容 —— 它盖住的正是这一项要量的那一片。 */
  const X0 = Math.floor(info.width * 0.30);
  const X1 = Math.floor(info.width * 0.70);
  /* 地的颜色取最后一列的中点 —— 那一片如果不是空的，这一项本来就不成立。 */
  const [gr, gg, gb] = at(Math.floor(info.width * 0.5), info.height - 2);
  const same = (p) => Math.abs(p[0] - gr) < 6 && Math.abs(p[1] - gg) < 6 && Math.abs(p[2] - gb) < 6;
  let blank = 0;
  for (let y = info.height - 1; y >= 0; y--) {
    let flat = true;
    /* 每 16 个像素取一次 —— 够抓到一条线或一个字，而不用扫两千万个点。 */
    for (let x = X0; x < X1; x += 16) {
      if (!same(at(x, y))) { flat = false; break; }
    }
    if (!flat) break;
    blank++;
  }
  return { blank, height: info.height, pct: (blank / info.height) * 100 };
}

const nf = (v, d = 0) => (v == null || Number.isNaN(v) ? "—" : Number(v).toFixed(d));

/** 一行差异。`worse` 只标出**我们明显不如人**的那一边，不标「不一样」。 */
function row(label, theirs, ours, judge) {
  const verdict = judge ? judge(theirs, ours) : "";
  return { label, theirs, ours, verdict };
}

async function main() {
  const want = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const pairs = want.length ? PAIRS.filter((p) => want.includes(p[0])) : PAIRS;
  if (!pairs.length) {
    console.log("没有这一页。有的是：", PAIRS.map((p) => p[0]).join(" "));
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });

  /* ── 一个用完就删的帐号：开满十八页，每一种零件五行真资料 ──────────── */
  loadEnv({ path: ".env.local" });
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const api = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  /* 🔴 被 Ctrl-C、被杀、或者输出接给 `head` 的时候 `finally` 不会跑 ——
     而那一次留下的是一个种了几十笔记录的帐号，混进老板的「客户数」里。 */
  dropThrowawayOnExit(admin, () => userId);

  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASS, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASS });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");
  /* 🔴 没挑过风格的帐号，每一页都会被推去 `/style-select` ——
     而第一版漏了这一行，报出来的是「找不到那颗保存按钮」。
     工作台那一边穿的是 SYSTEM_REGISTER，所以挑哪一套都不影响这把尺量的东西；
     它只决定官网那一页的漆。 */
  await api.rpc("set_project_style", { new_style: "ledger" });
  const { opened } = await openAllPages(api, { quiet: true });
  const seeded = await seedEveryShape(api, proj.id, MARK, opened, { quiet: true, rows: 12, showroom: true });
  console.log(`开了 ${opened.length} 页 · 种了 ${seeded.size} 种零件的真资料`);

  const browser = await chromium.launch();
  /* 🔴 视窗对齐他们那张图：**1400×950，一倍**。
   *
   * 第一版是 1440×1400、两倍，而且拍的是**整个画布**（2784×2604 = 1392×1302）。
   * 他们那一张是 **1400×950 的一屏**。拿「一整页」去比「一屏」，
   * 缝跟块数一定比较大 —— 而第一版就照那个差异报了「缝是他们的 12.4 倍」。
   *
   * **量法的差异被当成设计的差异**，这个仓库栽过：`align` 的段内留白
   * 报 8% 对 1%，查出来是行内元素对块级元素。所以这一次先对齐尺寸，
   * 再看那几项还在不在。 */
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  /* ── 按一次「保存设计」，正门从此是他的系统 ────────────────────────────
     `frontDoor()` 问的是**整套，不是这一页**，所以保存最不起眼的那一页就够。
     ⚠️ 保存的是**排行** —— 它不在配对表里，所以那十四页照旧从产生器长出来。 */
  /* ⚠️ 1400px 上编辑器的工具条会收起来，而 950px 高只看得到一部分 ——
     所以这一步先撑大视窗，按完再缩回去量。第一版就是在 1400×950 上
     找不到那个 `More`，而报出来的是「找不到画布」。 */
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto(`${BASE}/en/portal/ranking?design=1`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(3000);
  /* ⚠️ `More▾` 是一个 `<summary>`，不是 button —— 拿 role 找它找不到。
     哪一天那颗按钮搬回顶栏，底下那一句照样按得到，所以这里不判它在不在。 */
  const more = page.locator("summary", { hasText: /^More/ }).first();
  if (await more.count()) {
    await more.click({ timeout: 30000 });
    await page.waitForTimeout(400);
  }
  await page.getByRole("button", { name: /save design/i }).first().click({ timeout: 60000 });
  await page.waitForTimeout(3500);
  await page.setViewportSize({ width: 1400, height: 950 });
  console.log("按过一次「Save design」——量的是他的系统，不是编辑器\n");

  let failed = 0;
  let skipped = 0;
  const report = [];

  for (const [key, refName, zh, whatItIs] of pairs) {
    const refPath = `.screenshots/upstream/${refName}.png`;
    /* 参考图读不到就是失败 —— 一把「量不到就沉默」的尺，跟一把说
       「你没问题」的尺长得一模一样。 */
    if (!existsSync(refPath)) {
      console.log(`🔴 ${zh}：参考图不在 ${refPath}`);
      failed++;
      continue;
    }

    /* ⚠️ `networkidle` 在开发服务器上等不到 —— 热更新那条连线永远开着，
       而每一页第一次打开都要现编译。实测：同一支跑两次，第一次在
       `quotations/new` 上等满 180 秒挂掉，第二次过 ——
       **那不是那一页坏了，是这条等法在这个环境下不成立。**
       改成等 DOM，然后自己给它一段时间落定（底下本来就有 5 秒）。 */
    const resp = await page.goto(`${BASE}/en/portal/${key}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    /* 「这个帐号没有开这一页」跟「画布坏了」是两件事，而第一版把两件事报成
       同一句。判它的是**回码**，不是页面上有没有某几个字 —— 这个仓库被
       「grep 一句话」骗过：那句 404 的字在每一页的原始码里都有。 */
    if (resp && resp.status() === 404) {
      console.log(`
== ${zh}  ←  ${refName}`);
      console.log(`  ⚪ 这个 demo 帐号没有开这一页 —— 换一个有它的帐号才量得到`);
      skipped++;
      continue;
    }
    await page.waitForTimeout(5000);
    /* 那张「这是一份草稿」的黑卡故意不记住（换一页它就回来），而它固定在
       右上角 —— 而参考页的右上角是有东西的。不关掉那一角永远比不了。 */
    await page.getByRole("button", { name: /got it, hide this/i }).first().click({ timeout: 3000 }).catch(() => {});
    /* 指标停在原地，编辑器会画那条橘色的「＋ 加一段」，横过整页 ——
       那是我们的家具，不是设计。 */
    /* 开发时那颗红色的「2 Issues」会印在图的左下角 —— 客户永远看不到它，
       而它在并排图上看起来像我们页面自己的东西。 */
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    await page.mouse.move(4, 4);
    await page.waitForTimeout(600);

    /* 整个视窗 —— 他的系统就是整页，而参考那十五张也是整屏（含他们的侧栏）。 */
    const root = page.locator("body");
    if (!(await root.count())) {
      console.log(`🔴 ${zh}：找不到画布`);
      failed++;
      continue;
    }
    /* 裁到一屏，跟他们那张一样 —— 不是整页。 */
    const oursPng = `${OUT}/${key.replace("/", "-")}-ours.png`;
    const box = await root.boundingBox();
    if (!box) { console.log(`🔴 ${zh}：量不到画布的位置`); failed++; continue; }
    await page.screenshot({
      path: oursPng,
      clip: {
        x: box.x,
        y: Math.max(0, box.y),
        width: Math.min(box.width, 1400 - box.x),
        height: Math.min(box.height, 950 - Math.max(0, box.y)),
      },
    });

    const theirs = await measureImage(refPath);
    const ours = await measureImage(oursPng);
    const theirTail = await tailBlank(refPath);
    const ourTail = await tailBlank(oursPng);

    /* 判语只讲**我们明显不如人**的那一边。「不一样」不是问题 ——
       这一套是我们的，不是他们的。 */
    const rows = [
      /* 🔴 这一项只在**一块都读不出来**的时候才判（2026-09-05）。
       *
       * 两个理由，两个都是量出来的：
       *
       * ① **底下空的时候它讲的是同一件事** —— 一页短，块自然少。
       *    把同一个毛病算两次，「明显不如人」那个数字就是实际的两倍。
       *
       * ② 🔴 **它在我们这一边看不见细线。** 我们的卡是**白卡压白地**
       *    （照他们那一套抄的，`isGround` 的门槛是 5 阶明度），所以侦测器
       *    认得出来的只有**文字连成的那几段**。实测：六页完全不同的页面
       *    ——总览 · 工程 · 客户 · 收款 · 报表 · 供应商——**六页全部报「我们 2」**。
       *    一个对六张不同的图回同一个数字的读数，不是在量块。
       *
       * 所以留下的只有**一块都读不出来**那一种（`≤ 1`）：那时候它讲的是
       * 「这一页整片连在一起，没有任何分段」，而那件事它看得见。
       * ⚠️ 照旧印出来 —— 印出来是资料，判语才是结论。 */
      row("一屏几块", theirs.bands, ours.bands, (t, o) =>
        ourTail.pct < 12 && o <= 1 && t >= 4 ? `🔴 整页读不出任何分段` : ""),
      row("每一块多高", `${nf(theirs.bandMedian)}px`, `${nf(ours.bandMedian)}px`, () => ""),
      row("卡片", theirs.cards, ours.cards, (t, o) => (t >= 3 && o === 0 ? `🔴 他们有卡片，我们一张都没有` : "")),
      row("一行最多几张", theirs.perRowMax, ours.perRowMax, (t, o) =>
        t >= 3 && o <= 1 ? `🔴 他们一行 ${t} 张，我们一行一张` : ""),
      row("有颜色的面积", `${nf(theirs.colour, 1)}%`, `${nf(ours.colour, 1)}%`, (t, o) => {
        const T = parseFloat(t), O = parseFloat(o);
        return O > T * 3 && O > 7 ? `🔴 我们花太多` : "";
      }),
      row("地的颜色", theirs.ground, ours.ground, () => ""),
      row("侧栏占多宽", `${nf(theirs.rail * 100, 1)}%`, `${nf(ours.rail * 100, 1)}%`, () => ""),
      /* 🔴 这一项是这把尺第一次跑就该有、而我漏掉的那一项。 */
      row("底下那一片空", `${nf(theirTail.pct, 1)}%`, `${nf(ourTail.pct, 1)}%`, () => {
        if (ourTail.pct < 12) return "";
        if (ourTail.pct > theirTail.pct + 10) return `🔴 底下 ${nf(ourTail.pct, 0)}% 是空的`;
        return "";
      }),
      /* 🔴 同上，而且更严：**两块的时候「中位数」就是那唯一一个数**。
         我们那一边读到 2 块（见上面那一段为什么），所以这一项量到的是
         「那两段文字中间隔多远」—— 而那中间正好是工具条跟表头。
         实测：一张看图完全正常的看板报「缝是他们的 11.2 倍」。
         四块以上才是一个中位数，才判。 */
      row("块与块的缝", `${nf(theirs.gap)}px`, `${nf(ours.gap)}px`, (t, o) => {
        const T = parseFloat(t), O = parseFloat(o);
        if (ourTail.pct >= 12) return "";
        if (ours.bands < 4 || theirs.bands < 4) return "";
        return T > 0 && O > T * 2.5 ? `🔴 缝是他们的 ${nf(O / T, 1)} 倍` : "";
      }),
    ];

    const bad = rows.filter((r) => r.verdict);
    report.push({ key, zh, refName, whatItIs, rows, bad });

    console.log(`\n== ${zh}  ←  ${refName}   ${whatItIs}`);
    for (const r of rows) {
      console.log(
        `  ${String(r.label).padEnd(14)} 他们 ${String(r.theirs).padEnd(12)} 我们 ${String(r.ours).padEnd(12)} ${r.verdict}`,
      );
    }
    console.log(bad.length ? `  → ${bad.length} 项明显不如人` : `  → 没有明显不如人的`);

    /* 并排图 —— 数字只能否决，看图才算通过。 */
    const sheet = `${OUT}/${key.replace("/", "-")}.jpg`;
    const [a, b] = [await sharp(refPath).metadata(), await sharp(oursPng).metadata()];
    const H = Math.max(a.height, b.height);
    await sharp({ create: { width: a.width + b.width + 24, height: H, channels: 3, background: "#111" } })
      .composite([{ input: refPath, left: 0, top: 0 }, { input: oursPng, left: a.width + 24, top: 0 }])
      .jpeg({ quality: 78 })
      .toFile(sheet);
  }

  await dropThrowaway(admin, userId);

  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  const total = report.reduce((n, r) => n + r.bad.length, 0);
  console.log(`\n判：${report.length} 页 · ${total} 项明显不如人 · ${failed} 页量不到`);
  console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那几张并排图`);
  await browser.close();
  if (failed) process.exit(1);
}

main().catch(async (err) => {
  /* 抛错也要删 —— 一个留下来的临时帐号会混进老板那张「客户数」里，
     而[任务 196](../docs/founder-tasks.md) 就是这样来的。 */
  try {
    loadEnv({ path: ".env.local" });
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    await dropThrowaway(admin, userId);
  } catch {}
  console.error(err);
  process.exit(1);
});

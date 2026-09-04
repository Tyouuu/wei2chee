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
 * 🔴 **而它还会打一张冻住的页，2026-09-05 抓到的。**
 *
 * 编辑器有自动保存（任何改动之后 2.5 秒），而**这把尺自己在开编辑器** ——
 * 於是它跑过的每一页都被存进 `project_pages.layout_json`，而 `page.tsx`
 * 只要那一栏有东西就读它、不再问产生器。
 *
 * 结果：**组件层的改动照样生效（所以没有人发现），而「这一页有哪几块」
 * 的改动永远到不了这把尺。** 实测那天 demo 有五页是冻住的
 * （报价单 · 工程 · 收款 · 官网 · 客户），而这把尺量过其中四页，
 * 一本正经地印出读数。同一件事[任务 138](../docs/founder-tasks.md)
 * 在总览那一页上抓过一次，那时候的修法是清掉那一页。
 *
 * 所以现在**开跑之前先问资料库**：哪几页是冻住的，印出来。
 * ⚠️ 它不自己清 —— 一个冻住的版面里可能有客户真的改过的字，
 * 而清掉是一个决定，不是一个 merge（`check:upstream` 同一条）。
 */
import { chromium } from "playwright";
import { measureImage } from "./probe-image.mjs";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const OUT = ".screenshots/align-pages";
const BASE = process.env.ALIGN_BASE || "http://localhost:3000";
const EMAIL = process.env.DEMO_EMAIL || "tianyou.demo@formae.test";
const PASS = process.env.DEMO_PASSWORD || "FormaeDemo2026!";
const OURS_ROOT = '[class*="_PuckCanvas-root"]';
/** 借走的版面暂存在这里。**在动资料库之前先写它**，见 `borrowGeneratedPages`。 */
const STASH = "scratchpad/_borrowed.json";
/** 借出去的那几页。**放在模组层**，因为「还回去」有三条路要走得到它：
 *  正常跑完 · 抛错 · Ctrl-C。少接一条，就是一次借了不还。 */
let loan = { borrowed: [], restore: async () => {}, ok: true };

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
  /* 地的颜色取最后一列的中点 —— 那一片如果不是空的，这一项本来就不成立。 */
  const [gr, gg, gb] = at(Math.floor(info.width * 0.35), info.height - 2);
  const same = (p) => Math.abs(p[0] - gr) < 6 && Math.abs(p[1] - gg) < 6 && Math.abs(p[2] - gb) < 6;
  let blank = 0;
  for (let y = info.height - 1; y >= 0; y--) {
    let flat = true;
    /* 每 16 个像素取一次 —— 够抓到一条线或一个字，而不用扫两千万个点。 */
    /* 🔴 只看左边七成。右下角浮着我们自己那颗「用讲的改」的药丸，
       它让**最底下每一行都不是空的**，於是第一版对着一整片空白回报 0%。
       一个飘在上面的东西不算内容 —— 它盖住的正是这一项要量的那一片。 */
    for (let x = 0; x < Math.floor(info.width * 0.7); x += 16) {
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

/** 🔴 把冻住的那几页**借出来**：量之前清成产生器那一版，量完原样放回去。
 *
 *  为什么不是「印一句警告就算了」（那是这把尺 2026-09-05 早上的版本）——
 *  一句警告只是把问题转述给读的人，而读的人没有办法在跑之前先清一页、
 *  跑完再填回去。**结果就是每一次跑都在量一张过期的页，然后每一次都读到
 *  同一句警告。** 一把每跑一次都喊一次狼的尺没有人看
 *  （`check:upstream` 因为同一件事被修过）。
 *
 *  ⚠️ 而「不自己清」那条顾虑是真的：一个冻住的版面里可能有客户真的改过的字。
 *  所以这里不是**清掉**，是**借走**：
 *
 *    1. 先把原本那几张版面**写到磁碟上**（在动资料库之前，不是之后）
 *    2. 才清成 `{}`
 *    3. 量完 / 出错 / 被 Ctrl-C，一律写回去，然后把磁碟上那份删掉
 *
 *  第 1 步的顺序是重点：跑到一半断电，那份存档还在 `_borrowed.json`，
 *  下一次跑会先看到它并且**拒绝再借**，叫人先还回去。
 *  一个「清了、还没还」的中间状态如果没有留下痕迹，它跟「本来就是空的」
 *  在资料库里长得一模一样 —— 而这个仓库栽在这个形状上至少四次。
 *
 *  ⚠️ 它只碰这一个 demo 帐号的 project（`DEMO_EMAIL`），而且是直接写表
 *  （service role），不走 `save_project_page` —— 所以**不会产生版本记录**，
 *  借跟还在他的「改动历史」上都不留一行。那是对的：那两次写入不是他做的。
 *
 *  ⚠️ 实测：借完再还，那一栏**一个字节都没变，连 `updated_at` 都没被推**
 *  （那一栏没有触发器，直接写表不会动它）。所以借跟还在他那边不留痕迹 ——
 *  而这一句是量出来的，不是推出来的：我第一版写的是「updated_at 会被推到今天」。
 */
async function borrowGeneratedPages(keys) {
  const noop = { borrowed: [], restore: async () => {}, ok: true };
  let db, projectId;
  try {
    loadEnv({ path: ".env.local" });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return { ...noop, ok: false };
    db = createClient(url, key);
    const { data: acct } = await db.from("accounts").select("id").eq("email", EMAIL).maybeSingle();
    if (!acct) return { ...noop, ok: false };
    const { data: proj } = await db.from("projects").select("id").eq("account_id", acct.id).limit(1).maybeSingle();
    if (!proj) return { ...noop, ok: false };
    projectId = proj.id;
  } catch {
    return { ...noop, ok: false };
  }

  /* 上一次跑借走了、还没还 —— 先还，不要再借一次。 */
  if (existsSync(STASH)) {
    const held = JSON.parse(readFileSync(STASH, "utf8"));
    for (const r of held.rows) {
      await db.from("project_pages").update({ layout_json: r.layout_json }).eq("project_id", held.projectId).eq("page_key", r.page_key);
    }
    rmSync(STASH);
    console.log(`↩️ 上一次跑没有还回去，已经还了 ${held.rows.length} 页：${held.rows.map((r) => r.page_key).join(" · ")}`);
  }

  /* `quotations/new` 那种子页没有自己的一行，看它的母页。 */
  const wanted = [...new Set(keys.map((k) => k.split("/")[0]))];
  const { data, error } = await db
    .from("project_pages")
    .select("page_key,layout_json")
    .eq("project_id", projectId)
    .in("page_key", wanted);
  if (error || !data) return { ...noop, ok: false };

  const rows = data.filter((r) => JSON.stringify(r.layout_json ?? {}).length > 40);
  if (!rows.length) return noop;

  writeFileSync(STASH, JSON.stringify({ projectId, at: new Date().toISOString(), rows }, null, 1));
  for (const r of rows) {
    await db.from("project_pages").update({ layout_json: {} }).eq("project_id", projectId).eq("page_key", r.page_key);
  }

  let returned = false;
  const restore = async () => {
    if (returned) return;
    returned = true;
    for (const r of rows) {
      await db.from("project_pages").update({ layout_json: r.layout_json }).eq("project_id", projectId).eq("page_key", r.page_key);
    }
    if (existsSync(STASH)) rmSync(STASH);
    console.log(`\n↩️ 借走的 ${rows.length} 页已经原样放回去：${rows.map((r) => r.page_key).join(" · ")}`);
  };
  return { borrowed: rows.map((r) => r.page_key), restore, ok: true };
}

async function main() {
  const want = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const pairs = want.length ? PAIRS.filter((p) => want.includes(p[0])) : PAIRS;
  if (!pairs.length) {
    console.log("没有这一页。有的是：", PAIRS.map((p) => p[0]).join(" "));
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });

  /* 🔴 先把冻住的那几页借出来 —— 量产生器那一版，量完放回去。见档头。 */
  loan = await borrowGeneratedPages(pairs.map((p) => p[0]));
  if (!loan.ok) {
    console.log("⚠️ 连不上资料库，借不了冻住的那几页 —— 下面的读数可能量的是一张存过的版面。");
  } else if (loan.borrowed.length) {
    console.log(`📄 借走 ${loan.borrowed.length} 页存过的版面，量的是产生器那一版：${loan.borrowed.join(" · ")}`);
  }
  /* Ctrl-C 也要还。`restore` 自己挡重复，所以三条路都可以叫它。 */
  const bail = () => { void loan.restore().finally(() => process.exit(130)); };
  process.once("SIGINT", bail);
  process.once("SIGTERM", bail);

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

    const resp = await page.goto(`${BASE}/en/portal/${key}?design=1`, { waitUntil: "networkidle", timeout: 180000 });
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

    /* `/new` 那几页不是编辑器画布，是一张普通的页 —— 拿整个视窗。 */
    const isCanvas = !key.includes("/");
    const root = isCanvas ? page.locator(OURS_ROOT).first() : page.locator("body");
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
      row("一屏几块", theirs.bands, ours.bands, (t, o) =>
        o < t / 2 ? `🔴 只有他们的一半` : ""),
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
      row("块与块的缝", `${nf(theirs.gap)}px`, `${nf(ours.gap)}px`, (t, o) => {
        const T = parseFloat(t), O = parseFloat(o);
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

  await loan.restore();

  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  const total = report.reduce((n, r) => n + r.bad.length, 0);
  console.log(`\n判：${report.length} 页 · ${total} 项明显不如人 · ${failed} 页量不到`);
  console.log(`→ ${OUT}/  ⚠️ 现在去用眼睛看那几张并排图`);
  await browser.close();
  if (failed) process.exit(1);
}

main().catch(async (err) => {
  /* 抛错也要还 —— 一次借了不还，下一次跑读到的就是一张空的页，
     而那跟「这个客户还没建过这一页」在资料库里长得一模一样。 */
  await loan.restore();
  console.error(err);
  process.exit(1);
});

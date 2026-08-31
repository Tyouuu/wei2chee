/**
 * 反复对齐 —— one register's page beside the template it copies, section by
 * section, both read out of the DOM.
 *
 * 老板 2026-08-27: 「还是抄的不完整 你自己用眼睛去看 完全不对啊 就是你再次对齐看看」
 * then 「等下做剩下的几套都是要反复对齐」.
 *
 * ── WHY A SCRIPT AND NOT AN EYEballing ───────────────────────────────────
 *
 * Three rounds of 「抄得不完整」 were spent fixing whichever difference happened
 * to be in the crop he sent. Putting both pages side by side proved the real
 * problem was structural and invisible in any crop: our 服务 sat where their
 * SECOND section is, so every section below it was one slot out of step the
 * whole way down. No amount of looking at the bottom of the page finds that.
 *
 * What it prints is the thing to look at, not a score:
 *   · both section lists, in order, with heights and photograph counts
 *   · every h1/h2 with its computed size  (this is how 32px vs 50px was found)
 *   · a side-by-side JPG with a rule drawn at every section boundary
 *
 * 用眼睛看的是那张图。数字只是用来找出「哪一段对错了」。
 *
 *   npm run align -- hearth
 */
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { config } from "dotenv";
import fs from "node:fs";
import { execSync } from "node:child_process";

config({ path: ".env.local" });
config();

/* Which template each register copies whole. See docs/founder-tasks.md 33. */
const REF = {
  hearth: "https://www.wix.com/demone2/a-reynolds",
  /* 改了 2026-08-27: Wright & Taylor is a paint COLOUR CONSULTANT -- pretty,
     but a boutique adviser. Newel is an actual residential remodeling
     contractor, which is the trade 台账 is for. Found by opening Wix's
     `industrial` category, which I had never opened and which is entirely our
     market: remodeling, plumbing, auto service, construction. */
  ledger: "https://www.wix.com/demone2/wh-newel",
  swiss: "https://www.wix.com/demone2/wh-leah",
  blueprint: "https://www.wix.com/demone2/wh-law-firm-2",
  signboard: "https://www.wix.com/demone2/brasserie",
  counter: "https://www.wix.com/demone2/wh-kurofude-rest",
  /* The three added 2026-08-27 to fix a MEASURED defect, not to have more:
     with six registers, 图纸 sat in seven of the eight trades' hands and two
     pairs of trades were handed an identical three. Both gaps were on the same
     side -- four of the six argue with FACTS and only one each argues with the
     WORK or with the SIGN. See docs/founder-tasks.md 35. */
  /* 服务 had no register built for it: its three were all 「facts」 registers
     with not one photograph of a workman, while 14 of the 19 Malaysian trade
     sites measured in 任务 26 lead with one. */
};

/* ── `--probe <网址>` —— 拿一个没见过的模版试尺子 ─────────────────────────
   老板 2026-08-31:「loop到真的能成功的打造出一个完美的尺子出来
   可以应对任何的别人的官网模板」.

   「能对付任何模版」这句话，在只跑过七个页面（六个 Wix ＋ 一个 Framer）之前
   是**推翻不了的**。这个模式让尺子可以指着任何一个网址跑，**不切风格、
   不碰资料库、不动 demo project** —— 它只读参考那一边，把它读出来的结构印出来。

   读得出东西 ≠ 读对了。所以它印的是**能拿去跟截图对照的东西**：几段、
   每段多高多少张图、版心、字级、颜色，外加一张整页图。破绽是用眼睛找的。 */
if (process.argv.includes("--probe")) {
  const target = process.argv[process.argv.indexOf("--probe") + 1];
  if (!target || !/^https?:/.test(target)) {
    console.error("用法: npm run align -- --probe <网址>");
    process.exit(1);
  }
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  let ok = true;
  try {
    const res = await p.goto(target, { waitUntil: "domcontentloaded", timeout: 90000 });
    if (!res || res.status() >= 400) { console.error(`🔴 ${target} 回 ${res ? res.status() : "没有回应"}`); ok = false; }
  } catch (e) {
    console.error(`🔴 载不到 ${target}：${String(e.message).split(String.fromCharCode(10))[0]}`);
    ok = false;
  }
  if (!ok) {
    /* ⚠️ 载不到要吼出来。一个空的页面读起来跟「这一页很简单」一模一样，
       而这个仓库被「量不到却印一个漂亮数字」的尺子骗过至少四次。 */
    await b.close();
    process.exit(1);
  }
  await settlePage(p, 7000);

  const secs = await p.evaluate(readSections, null);
  const shape = await p.evaluate(readShape, null);
  const type = await p.evaluate(readType);
  const shots = await p.evaluate(readShots, null);
  const declared = await p.evaluate(readDeclared, null);
  const chars = await p.evaluate(readChars, null);

  const host = new URL(target).host.replace(/[^a-z0-9]+/gi, "-");
  fs.mkdirSync(".screenshots/align", { recursive: true });
  const file = `.screenshots/align/probe-${host}.jpg`;
  await p.screenshot({ path: file, fullPage: true, type: "jpeg", quality: 82 });

  console.log(String.fromCharCode(10) + target);
  console.log(`  段数 ${secs.length}   整页高 ${secs.reduce((a, x) => a + x.h, 0)}px   照片 ${shots.length}   看得见的字 ${chars}`);
  console.log(`  标题 ${(type.heads?.[0]?.px) ?? "?"}px  正文 ${type.bodyPx ?? "?"}px  圆角 ${declared?.radius ?? "?"}`);
  const sum = (bs) => `${bs.filter((x) => x.kind === "图").length}图 ${bs.filter((x) => x.kind === "钮").length}钮 ${bs.filter((x) => x.kind === "字").length}字`;
  secs.forEach((sec, i) => console.log(`  第${i + 1}段  ${String(sec.h).padStart(5)}px  ${sum(shape[i] ?? [])}`));

  /* 自检跟正式那条同一套：读出来的东西对不对得上整页 —— 数字漂亮而
     一半的页面没读到，正是这把尺犯过最贵的错。 */
  const inSecs = (shape ?? []).flat();
  const lostPics = shots.length - inSecs.filter((b) => b.kind === "图").length;
  if (secs.length < 3) {
    console.log("  🔴 读到的段太少 —— 这个 DOM 尺子看不懂。底下是它实际长什么样：");
    /* ⚠️ 读不懂的时候要**把 DOM 印出来**，不要只说读不懂。
       不然每遇到一个新平台，我都得另外手写一支探针去看它的结构 ——
       那正是[重点 25](../docs/founder-points.md) 里「一天十几轮」的来源。 */
    const tree = await p.evaluate(() => {
      const out = [];
      const walk = (el, d) => {
        if (d > 3) return;
        for (const c of el.children) {
          const r = c.getBoundingClientRect();
          if (r.height < 60) continue;
          const cls = String(c.className || "").split(" ").filter(Boolean).slice(0, 3).join(".");
          out.push(`${"  ".repeat(d)}${c.tagName.toLowerCase()}${c.id ? "#" + c.id : ""}${cls ? "." + cls : ""}  ${Math.round(r.width)}x${Math.round(r.height)}`);
          walk(c, d + 1);
        }
      };
      walk(document.body, 0);
      return out.slice(0, 26);
    });
    for (const l of tree) console.log("     " + l);
  }
  if (lostPics > 1) console.log(`  🔴 有 ${lostPics} 张照片不属於任何一段 —— 分段规则漏了这一种排法`);
  /* ⚠️ **分段的线不准穿过一张照片。**
     老板 2026-08-31 的 loop：Squarespace 的 mojave 模版，五条线里四条落在
     真的段界上，第一条**切在第一屏那张大图的中间** —— 照片的下半跟 Mission
     被归成同一段。数字看起来完全正常（5 段、5130px、3 张图），
     而分段是错的。**一条穿过照片的线，就是这一段的边界找错了**，
     那是一条不用看内容也判得了的规则。 */
  {
    const edges = secs.map((x) => x.top).slice(1);
    const cut = shots.filter((sh) => edges.some((e) => e > sh.top + 8 && e < sh.top + sh.h - 8));
    if (cut.length)
      console.log(`  🔴 有 ${cut.length} 张照片被段界切开 —— 那一段的边界找错了（照片顶 ${cut.map((c) => c.top).join(" · ")}）`);
  }
  /* ⚠️ 漏了多少不够，要讲**漏到哪里去了**。
     2026-08-31：重新采集之后自检第一次跑得起来，blueprint 的参考报
     「2008 个字，各段装下 1115 —— 漏了 44%」。三套风格都这样，
     而它们每一段的比较都是拿这份残缺的资料做的。
     只说「漏了 44%」的话，下一个人还是得从头查一遍。 */
  {
    const acct = await p.evaluate(() => {
      const own = (el) => { let t = ""; for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue; return t.trim(); };
      const PAGE = document.documentElement.getBoundingClientRect().width || 1440;
      let total = 0, tooNarrow = 0, offscreen = 0, hidden = 0, tiny = 0;
      const narrow = [];
      for (const el of document.body.querySelectorAll("*")) {
        const t = own(el);
        if (t.length < 2) continue;
        /* ⚠️ 分母只算**看得见的字**。第一版把隐藏的也算进去，於是 Wix 那一页
           报「421472/424019 被挡在门外」—— 那 42 万是它藏起来的手机版跟脚本，
           一个真正的读者一个字都看不到。**一个把不存在的东西算进分母的比例，
           读起来像天塌了，其实什么都没讲。** */
        if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) { hidden += t.length; continue; }
        total += t.length;
        const r = el.getBoundingClientRect();
        if (r.height < 10) { tiny += t.length; continue; }
        if (r.right < PAGE * 0.02 || r.left > PAGE * 0.98) { offscreen += t.length; continue; }
        if (r.width < PAGE * 0.03) { tooNarrow += t.length; if (narrow.length < 4) narrow.push(`${Math.round(r.width)}px「${t.slice(0, 14)}」`); }
      }
      return { total, tooNarrow, offscreen, hidden, tiny, narrow };
    });
    const gone = acct.tooNarrow + acct.offscreen + acct.tiny;
    if (gone > acct.total * 0.05)
      console.log(`  ⚠️ 字被挡在门外 ${gone}/${acct.total}：太窄(<3%页宽) ${acct.tooNarrow} · 画面外 ${acct.offscreen} · 太矮 ${acct.tiny}（另有 ${acct.hidden} 个字是藏起来的，不算）` +
        (acct.narrow.length ? String.fromCharCode(10) + "     太窄的样本：" + acct.narrow.join(" · ") : ""));
  }
  console.log(`  整页图 → ${file}`);
  await b.close();
  process.exit(0);
}

/* ── 选好了模版、还没开始建的 ────────────────────────────────────────────
   ⚠️ **不放在 REF 里**，而 REF 是 `align:all` 读风格名单的地方。
   老板 2026-08-31:「mosaic / nocturne / shelf / crew 这些是什么 我有叫你去建
   新的风格吗？」—— 跑一次全部会印出四行 🔴，读起来像四套坏掉的风格，
   而它们是**还没建的四个位子**：零个 token 档、零个 composition、
   资料库的约束里也没有它们。

   一份「参考清单」应该只放**正在量的东西**。计划放在
   [任务 35](../docs/founder-tasks.md)，那里写着为什么是这四个
   （量出来 A「作品说话」只有 1 套而 4 个行业需要，C「招牌说话」只有 1 套而 3 个需要）。
   在报告里给它们开特例是修错地方 —— 源头是它们不该在那份名单里。

   ⚠️ 老板拍板的是**「24 套」这个数字**（任务 37）；具体是哪四套、配哪个模版，
   是我提的，还没有单独过他的眼。 */
const PLANNED = {
  mosaic: "https://www.wix.com/demone2/wh-beauty-shop",
  nocturne: "https://www.wix.com/demone2/kaito-ramen-den",
  shelf: "https://www.wix.com/demone2/wagora",
  crew: "https://plumbzo.framer.website/",
};

const register = process.argv[2] || "hearth";
const url = REF[register];
if (!url) {
  console.error(`no reference for ${register}. known: ${Object.keys(REF).join(", ")}`);
  process.exit(1);
}

const PROJECT = process.env.DEMO_PROJECT_ID || "37f2b188-5899-48ab-8650-11cefa5f98d2";
const OUT = ".screenshots/align";
fs.mkdirSync(OUT, { recursive: true });

/* ── 一次只准跑一个 ────────────────────────────────────────────────────────
   十套共用同一个 demo project：这支脚本会把它切成要量的那一套，量完切回去。
   两个一起跑，第二个的切换会把第一个正在拍的页面换掉 —— 拍回来的是**别人的
   公司名、别人的配色**，而报告照样一项一项印，读起来跟对的一模一样。

   ⚠️ 这件事发生过两次，第二次是我自己：批次还在跑的时候手动跑了一支去看新的
   自检。两次都靠**拍完之后的复查**才发现 —— 那道关是对的，但它太晚：
   两分钟的采集作废，而且**只有其中一个进程知道**。另一个拿到的是一份被污染、
   却没有任何地方说它被污染过的报告。

   所以这里再加一把**开跑前**的锁。它不取代那道复查（锁挡得住两个 npm，挡不住
   有人在 Studio 里手改），两道一起才完整。 */
const LOCK = `${OUT}/.busy`;
try {
  fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, register, at: new Date().toISOString() }), { flag: "wx" });
} catch (e) {
  if (e.code !== "EEXIST") throw e;
  let held = {};
  try { held = JSON.parse(fs.readFileSync(LOCK, "utf8")); } catch { /* 锁写坏了也要讲得出话 */ }
  /* 上一次被 Ctrl-C 掉的锁不该挡住今天 —— 那个进程还在不在，问系统，不要猜。 */
  let alive = false;
  try { process.kill(held.pid, 0); alive = true; } catch { alive = false; }
  if (alive) {
    console.error(`
🔴 已经有一个 align 在跑（pid ${held.pid} · ${held.register} · ${held.at}）。
   十套共用同一个 demo project，两个一起跑会互相把页面换掉 ——
   拍回来的是别人的公司名跟别人的配色，而报告照样印得像真的。
   等它跑完，或者 npm run align:all（那支是一个接一个跑的）。`);
    process.exit(1);
  }
  console.log(`  上一次的锁没清干净（pid ${held.pid} 已经不在了），接手。`);
  fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, register, at: new Date().toISOString() }));
}
const dropLock = () => { try { fs.unlinkSync(LOCK); } catch { /* 已经没了就算了 */ } };
process.on("exit", dropLock);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { dropLock(); process.exit(130); });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const layouts = JSON.parse(fs.readFileSync(".screenshots/photos/per-trade.json", "utf8"));

/* ⚠️ The editor autosaves. Snapshot the demo project and put it back, or every
   run quietly rewrites the founder's own preview site. */
const { data: project } = await db
  .from("projects").select("style,palette,site_slug").eq("id", PROJECT).single();
const { data: page } = await db
  .from("project_pages").select("layout_json").eq("project_id", PROJECT).eq("page_key", "website").single();

const restore = async () => {
  await db.from("projects").update({ style: project.style, palette: project.palette }).eq("id", PROJECT);
  await db.from("project_pages").update({ layout_json: page.layout_json })
    .eq("project_id", PROJECT).eq("page_key", "website");
};

/* ⚠️ 写完要读回来。这两行是整份报告的前提：量的那一页到底是不是这一套风格。

   写失败（RLS 拦下、字段名打错、这个 register 还没进 is_known_register）
   supabase-js **不会抛**，它把错误放在回传的 error 里。没有人看那个 error，
   下一步就照样去量 —— 量到的是上一套风格的页面，而报告会一本正经地印出
   五十项读数，每一项都是关於另一套风格的。

   一份对着错的东西量出来的报告，比没有报告危险：它看起来完全正常。 */
{
  const { error: e1 } = await db.from("projects").update({ style: register, palette: null }).eq("id", PROJECT);
  const { error: e2 } = await db.from("project_pages").update({ layout_json: layouts[register] })
    .eq("project_id", PROJECT).eq("page_key", "website");
  const { data: back } = await db.from("projects").select("style").eq("id", PROJECT).single();
  if (e1 || e2 || back?.style !== register) {
    console.error(`
🔴 这一次测量不算数：没能把 demo 站切到 ${register}。`);
    if (e1) console.error("   projects: " + e1.message);
    if (e2) console.error("   project_pages: " + e2.message);
    if (back && back.style !== register) console.error(`   写完读回来还是 ${back.style} —— 量出来的会是那一套。`);
    await restore();
    process.exit(1);
  }
}

const browser = await chromium.launch();

/* Sections: the outermost full-width children taller than a caption. Nesting
   differs between the two pages, so the rule is 「outermost at each top」 rather
   than a selector, which would only ever fit one of them. */
/* Passed to page.evaluate as real functions, not as eval'd strings: the first
   version built them as template literals and one escape level was lost, so
   `\s` became `s` and every letter s was stripped out of the printed text. */
/* ── 找「装着那些段的那个盒子」 ─────────────────────────────────────────────
   老板 2026-08-31:「可以应对任何的别人的官网模板」. 第一个没见过的模版就把
   旧规则打破了：`tailark.com` 有一条 168px 的侧栏，於是它的 `<main>` 只有
   1267px —— **视窗的 88%**，而旧规则要求「宽度 ≥ 视窗的 90%」。
   **段数 0。** 任何有侧栏、有外壳、有最大宽度的页面都会这样。

   所以改成从 body 往下走，一层一层问：这一层里有没有**一个又高又宽的孩子**？
   有就走进去；看到**两个以上又高又宽的孩子**就停 —— 那一层就是段的清单。
   「宽」比的是**父层的宽**，不是视窗的宽，所以侧栏跟外壳不再是问题。

   ⚠️ 这一支是**后备**，不是替换。六套已经量过的参考照旧走原本那条选择器，
   读到的段数一个都不会变 —— 换掉它等於让所有存下来的快照失去可比性，
   而那是这把尺唯一的记性。只有原本那条读到少於三段时才用这一支。 */
function readSections(rootSel) {
  /* ⚠️ 写在里面，不写在外面：这个函式是**整段源码送进浏览器**执行的，
     模组层的辅助函式在那边不存在（档头那句「Passed to page.evaluate as real
     functions」讲的就是这件事）。第一版写在外面，当场 ReferenceError。 */
  const sectionHost = () => {
  const big = (el, parent) => {
    const r = el.getBoundingClientRect(), pr = parent.getBoundingClientRect();
    return r.height >= 90 && r.width >= Math.max(200, pr.width * 0.6);
  };
  let node = document.body;
  for (let d = 0; d < 10; d++) {
    const kids = [...node.children].filter((c) => big(c, node));
    if (kids.length !== 1) break;
    node = kids[0];
  }
  return node;
};
  const root = rootSel ? document.querySelector(rootSel) : null;
  let node = root;
  if (node) while (node && node.children.length <= 2) node = node.children[0];
  let pool = node ? [...node.children] : [...document.querySelectorAll("section,div[id^='comp-']")];
  if (!node) {
    const enough = pool.filter((e) => {
      const r = e.getBoundingClientRect();
      return r.height >= 90 && r.width >= window.innerWidth * 0.9;
    });
    if (enough.length < 3) pool = [...sectionHost().children];
  }
  /* Wix nests wrappers, so 「outermost at each position」 is the rule, and it
     needs the boxes sorted tallest-first at each top or an inner wrapper wins.
     Two ways this went wrong before: without sorting the reference came back
     as 14 sections with six printed twice; rejecting anything that merely
     STARTS inside a taken box swallowed five real siblings and left 5. Only a
     box fully inside another is the same section. */
  const boxes = pool
    .map((e) => {
      const r = e.getBoundingClientRect();
      return { e, top: Math.round(r.top + scrollY), h: Math.round(r.height), w: Math.round(r.width) };
    })
    /* 宽度比的是**这一层最宽的那个**，不是视窗 —— 有侧栏的页面上，
       视窗的 90% 是一个没有任何东西达得到的门槛。 */
    .filter((x, _i, all) => x.h >= 90 && (node || x.w >= Math.max(...all.map((y) => y.w)) * 0.9))
    .sort((a, b) => a.top - b.top || b.h - a.h);

  /* ⚠️ 「一个盒子完全在另一个里面」挡得住包装层，挡不住**并排叠着的两层**。

     Parker & Brown 的第一屏在 DOM 里是两个兄弟：一个满边的背景图，一个压在
     它上面的导航＋标题。两个都不在对方里面，於是尺子把一屏切成两段 —— 模版
     变成「第1段只有一张图」「第2段是导航加字」，而我们那一屏是一段。从那里
     开始每一段都错位一格，段数、配对、逐段结构、逐段底色、段内的气全部跟着错。

     判断的依据是**上下有没有重叠**：两块在页面上盖住同一片垂直空间，人看到的
     就是一段。重叠超过矮的那一块的六成就并起来。 */
  /* ⚠️ 被包住的那一个要**并进去**，不能丢掉。

     原本这里是 `continue` —— 理由是「一个盒子完全在另一个的上下范围里，
     那是同一段的包装层」。包装层丢掉没差，它的内容已经在外层里了。
     但**并排叠着的兄弟**也会落在同一个范围里：Newel 的第一屏是一个 1440×891
     的照片 comp，跟导航 comp 是兄弟，而它整个落在导航那一段的上下范围内。
     丢掉它，那张满边的照片就从这一段消失 —— 於是尺子报「模版 满边的段 0/7」
     「最宽的图 20%」，那 20% 是他们的 logo。

     **照那份报告改，我会去拆掉我们那张对的满边第一屏。**
     一把看不见半个页面的尺，会把人送去改做对的地方。 */
  const out = [];
  for (const { e, top, h } of boxes) {
    const inside = out.find((o) => top >= o.top && top + h <= o.top + o.h);
    if (inside) { inside.els.push(e); continue; }
    const hit = out.find((o) => {
      const over = Math.min(top + h, o.top + o.h) - Math.max(top, o.top);
      return over > Math.min(h, o.h) * 0.6;
    });
    if (hit) {
      hit.top = Math.min(hit.top, top);
      hit.h = Math.max(hit.top + hit.h, top + h) - hit.top;
      hit.els.push(e);
      continue;
    }
    out.push({ top, h, els: [e] });
  }
  return out
    .sort((a, b) => a.top - b.top)
    .map(({ top, h, els }) => ({
      top,
      h,
      img: els.reduce((n, e) => n + e.querySelectorAll("img,video").length, 0),
      text: els.map((e) => (e.innerText || "").trim()).join(" ").split(/\s+/).join(" ").slice(0, 64),
    }));
}

/* ── 结构 SHAPE：一段的「里面」有哪些盒子 ───────────────────────────────────

   老板 2026-08-29, 看完六张对照图：「是准确了 可是还不是100%」·
   「我问你有什么解决方法吗 是skills不好用还是什么」.

   不是 skill 的问题。这个档案量的是**整页级**（几段 · 每段多高 · 几张照片 ·
   字多大 · 每段底色），design-md-generator 抽的是 **token 级**（颜色 · 字级 ·
   间距 · 动效）。那一天剩下的每一个差异都落在这两层中间：

     · 他们的导航浮在照片上，我们是照片上面另一条
     · 他们的照片缩在版心里、上面空一段气，我们满边贴着字
     · 他们那一段右边有一颗描边药丸，我们从来没画过
     · 他们的按钮方角，我们圆角
     · 他们的标题贴着页缘、左边距 0，我们有版心边距

   五件里没有一件会改变段高或照片张数，所以尺子印 0，而画面一眼就看得出不像。
   量不到的东西不会因为看得够久就被看到 —— 那一整天就是这个循环。

   所以这里量的是一段**里面有哪些盒子**：每个盒子是图 / 按钮 / 字，左右占这一段
   宽的百分之几、上下在哪、圆角多少。然后一段对一段比。

   ⚠️ 它不判「好不好看」，它判「有没有这个东西、在不在同一个位置」。
   两边的 DOM 完全不同（Wix 的包装层套五层），所以认的是**角色**不是标签，
   而且只收看得见、够大的盒子 —— 一个 4px 的分隔线不是这一段的结构。 */
function readShape(rootSel) {
  const root = rootSel ? document.querySelector(rootSel) : null;
  let node = root;
  if (node) while (node && node.children.length <= 2) node = node.children[0];
  /* 跟 readSections 同一条后备：有侧栏／有外壳的页面上，「宽度 ≥ 视窗的 90%」
     是一个没有任何东西达得到的门槛。**两支必须用同一条规则** —— 不然
     secs 讲七段、shape 讲两段，而报告把它们当成同一份分段。 */
  const host = () => {
    const big = (el, parent) => {
      const r = el.getBoundingClientRect(), pr = parent.getBoundingClientRect();
      return r.height >= 90 && r.width >= Math.max(200, pr.width * 0.6);
    };
    let n = document.body;
    for (let d = 0; d < 10; d++) {
      const kids = [...n.children].filter((c) => big(c, n));
      if (kids.length !== 1) break;
      n = kids[0];
    }
    return n;
  };
  let pool = node ? [...node.children] : [...document.querySelectorAll("section,div[id^='comp-']")];
  if (!node) {
    const enough = pool.filter((e) => {
      const r = e.getBoundingClientRect();
      return r.height >= 90 && r.width >= window.innerWidth * 0.9;
    });
    if (enough.length < 3) pool = [...host().children];
  }
  const secs = pool
    .map((e) => {
      const r = e.getBoundingClientRect();
      return { e, top: Math.round(r.top + scrollY), h: Math.round(r.height), w: Math.round(r.width) };
    })
    /* 宽度比的是**这一层最宽的那个**，不是视窗 —— 有侧栏的页面上，
       视窗的 90% 是一个没有任何东西达得到的门槛。 */
    .filter((x, _i, all) => x.h >= 90 && (node || x.w >= Math.max(...all.map((y) => y.w)) * 0.9))
    .sort((a, b) => a.top - b.top || b.h - a.h);
  /* 跟 readSections 同一套并段规则 —— 两边不同就等於 shape 跟 secs 各自
     在讲不同的分段，而报告把它们当成同一份。 */
  const kept = [];
  for (const b of secs) {
    const inside = kept.find((o) => b.top >= o.top && b.top + b.h <= o.top + o.h);
    if (inside) { inside.els.push(b.e); continue; }
    const hit = kept.find((o) => {
      const over = Math.min(b.top + b.h, o.top + o.h) - Math.max(b.top, o.top);
      return over > Math.min(b.h, o.h) * 0.6;
    });
    if (hit) {
      hit.top = Math.min(hit.top, b.top);
      hit.h = Math.max(hit.top + hit.h, b.top + b.h) - hit.top;
      hit.els.push(b.e);
      continue;
    }
    kept.push({ top: b.top, h: b.h, els: [b.e] });
  }
  kept.sort((a, b) => a.top - b.top);

  const PAGE = document.documentElement.getBoundingClientRect().width || 1440;
  /* ⚠️ 「这个元素看不看得见」不能只问这个元素。
     老板 2026-08-30:「用眼睛找完全部错误 然后去修好尺子」.

     Newel 第4段六张照片上，尺子读到「01」「The Nelson’s Project」——
     照片上一个字都没有。查下去：字的祖先 `span._details_` 是
     **opacity: 0** 的 hover 浮层。而 opacity **不继承计算值** —— 子元素自己
     的 computed opacity 还是 1，所以只问元素自己的旧写法，永远看不到它。

     我昨天照这个读数，在我们的照片上压了工程编号 —— **凭一个看不见的东西，
     在我们的页面上造了一个他们没有的东西。** 当时的修法是几何的（整个落在
     一张排在后面的图里就算埋掉），那只修掉了一个实例；真正的原因是这个，
     而它一次修掉一整类：祖先的 opacity、祖先的 visibility、display 链。

     `contentVisibilityAuto` 故意不开：整页截图时视窗外的东西会被判成「跳过」，
     那会让下半页整段消失 —— 跟 `animation-timeline: view()` 那次同一个坑。 */
  const vis = (el) => {
    if (typeof el.checkVisibility === "function")
      return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05;
  };
  /* 一个盒子算「按钮」的条件：它是可以点的，有自己的底或框，而且高度像一个控件。
     Wix 的按钮是 <a> 套一个 <span>，我们的是 <a> 自己 —— 认背景/边框比认标签准。 */
  const isButton = (el) => {
    if (!el.matches("a,button,[role=button]")) return false;
    const r = el.getBoundingClientRect();
    if (r.height < 24 || r.height > 96 || r.width < 60) return false;
    const cs = getComputedStyle(el);
    const painted = cs.backgroundColor && !/(^rgba\(0, 0, 0, 0\)$|transparent)/.test(cs.backgroundColor);
    const framed = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0;
    return painted || framed;
  };
  const ownText = (el) => {
    let t = "";
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    return t.trim();
  };

  /* ── 每一个看得见的盒子都要归到某一段，按它在页面上的位置 ────────────────
     ⚠️ 以前是走「各段元素的子孙」（`sec.els.flatMap(...querySelectorAll)`），
     而那假设了「页面上每一块都是某一段的子孙」。Wix 不是这样排的：它有窄的
     comp 是那些段的**兄弟**，於是那里面的东西谁也装不到。瑞士 的参考因此有
     两张照片掉在所有段之外 —— 尺子自己的自检抓到的。

     段本来就是**页面上的一段垂直范围**。所以改成：把 root 底下所有看得见的
     盒子走一遍，每一个按它的**垂直中心**落在哪一段的范围里，就归哪一段。
     这样「有东西不是任何一段的子孙」这一整类问题不再存在，而不是修掉一个实例。 */
  /* ⚠️ **段与段之间不可以有缝。**
     老板 2026-08-31 那一轮，尺子自己的自检抓到：blueprint 的参考「这一页
     2008 个字，各段装下 1115 —— 漏了 44%」，hearth 跟 counter 也一样。
     原因是段的范围照它们各自的**盒子**取，而盒子之间有垂直的空隙；
     落在空隙里的东西**不属於任何一段**，於是它既不算他们的、也没人跟它比。

     这跟 Squarespace 那条线切进照片是同一个病的两面：**DOM 的盒子不等於
     这一页画出来的那一带**（VIPS 那个演算法讲的就是这件事）。

     所以指派用的范围**互相接上**：两段之间那条缝从中点切开，第一段往上吃到
     页顶，最后一段往下吃到页底。⚠️ 只有**指派用的范围**接上，
     每一段**回报的高度照旧** —— 跟「量大小用盒子、量位置用墨迹」同一条：
     两个用途，两个数字，不要合成一个。 */
  const pageH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const ranges = kept.map((k, i) => {
    const prev = kept[i - 1], next = kept[i + 1];
    const from = prev ? Math.round((prev.top + prev.h + k.top) / 2) : 0;
    const to = next ? Math.round((k.top + k.h + next.top) / 2) : pageH;
    return { ...k, from: Math.min(from, k.top), to: Math.max(to, k.top + k.h), pool: [] };
  });
  for (const el of root ? root.querySelectorAll("*") : document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.height < 8) continue;
    const mid = r.top + scrollY + r.height / 2;
    const hit = ranges.find((k) => mid >= k.from && mid < k.to);
    if (hit) hit.pool.push(el);
  }

  return ranges.map((sec) => {
    const sr = { top: sec.top - scrollY, height: sec.h };
    const boxes = [];
    let seqN = 0;
    /* ⚠️ 一块「字」的宽度，量的应该是**字真的画到哪里**，不是它那个盒子多宽。
       老板 2026-08-31:「段内的缝 …那不是设计差异」— 他讲对了，而我查出来的
       原因是：Wix 把每一行字包在 `<span>`（行内，盒子就是字宽），我们用 `<p>`
       （块级，盒子是整栏宽）。**同一句话，两个宽度**，於是「段内的缝」量到
       他们 8% 我们 1%，而两页的排版一模一样。我差点去改栏距。

       `Range.getClientRects()` 给的是**字的行盒**，行内块级都一样 ——
       这是浏览器自己的答案，不是哪个套件的（查过：视觉回归那一类
       reg-suit / jest-image-snapshot / odiff 全部比的是**图片**，
       答不了「这一块字实际占多宽」）。 */
    const inkRect = (el) => {
      try {
        const rg = document.createRange();
        rg.selectNodeContents(el);
        const rs = [...rg.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
        if (!rs.length) return null;
        const left = Math.min(...rs.map((r) => r.left)), right = Math.max(...rs.map((r) => r.right));
        const top = Math.min(...rs.map((r) => r.top)), bottom = Math.max(...rs.map((r) => r.bottom));
        return { left, top, width: right - left, height: bottom - top, right, bottom };
      } catch { return null; }
    };
    const push = (el, kind, extra) => {
      /* ⚠️ 两个问题，两个矩形，不能共用一个。
         「这个东西够不够大、在不在画面上」问的是**它那个盒子**；
         「它画到哪里」问的是**墨迹**。第一版两个都用墨迹，於是
         「01」「24/7」这种短字的墨迹只有几十像素，被 3% 那道门槛
         当成装饰丢掉 —— 尺子自己的自检当场红：「模版分段漏字 · 漏图」。 */
      const box = el.getBoundingClientRect();
      if (box.width < PAGE * 0.03 || box.height < 10) return;
      if (box.right < PAGE * 0.02 || box.left > PAGE * 0.98) return;
      const r = (kind === "字" ? inkRect(el) : null) ?? box;
      if (r.width < 1 || r.height < 1) return;
      /* ⚠️ 画面外的东西不算这一段的内容。
         満図 的参考回报过「字 -93–-73」「字 102–121」—— 那是轮播里还没转到的
         那几张，人一眼都看不到。它们会灌水「几栏字」，也会把版心的左右边界
         拉到负数。看不到的东西不是这一页的设计。 */
      
      const x0 = Math.round((r.left / PAGE) * 100);
      const x1 = Math.round(((r.left + r.width) / PAGE) * 100);
      const y0 = Math.round(((r.top - sr.top) / Math.max(1, sr.height)) * 100);
      const y1 = Math.round(((r.top + r.height - sr.top) / Math.max(1, sr.height)) * 100);
      /* 同一个盒子被包了五层，五层的矩形一样 —— 只留一个。 */
      if (boxes.some((b) => b.kind === kind && Math.abs(b.x0 - x0) <= 1 && Math.abs(b.y0 - y0) <= 1 && Math.abs(b.x1 - x1) <= 1)) return;
      /* ⚠️ 每个盒子记下**它是谁**。
         老板 2026-08-31:「就是能不能更快的让你去提升这个办法 现在太慢了」.
         一次 align 45 秒不是瓶颈 —— 瓶颈是「这一项为什么红」尺子答不了，
         於是每查一件事都要另外手写一支探针（今天写了三支），而每支探针
         自己又要错两轮才写对。盒子带着自己的身分，报告就直接指得出元素，
         `--why` 把它印出来。 */
      const cls = String(el.className || "").split(" ").filter((c) => c && !c.startsWith("[") && !c.startsWith("@")).slice(0, 2).join(".");
      const marks = ["bleed", "fill", "toned", "cells", "wide", "columnHeading"].filter((k) => el.dataset[k] !== undefined).map((k) => `[${k}]`).join("");
      const sel = `${el.tagName.toLowerCase()}${marks}${cls ? "." + cls : ""}`.slice(0, 56);
      /* ⚠️ 记下**像素**的宽高，不只百分比。
         2026-08-31：自检问「各段装下几张图」的时候，拿的是 readShape 的图，
         而 readShape 对 <img> 没有尺寸下限、readShots 有（120×90）。
         两个数字根本不在数同一群东西 —— 满図 报「6 张 · 装下 9 张」，我照那个
         差额写了一句「段界穿过它」的诊断，而多出来的其实是图标跟小 logo。
         **一句听起来很有道理的解释，配一个错的数字。** */
      boxes.push({ kind, x0, x1, y0, y1, pw: Math.round(box.width), ph: Math.round(box.height),
        seq: seqN++, pos: getComputedStyle(el).position, sel, ...extra });
    };

    for (const el of sec.pool) {
      if (!vis(el)) continue;
      if (el.matches("img,video")) { push(el, "图"); continue; }
      /* ⚠️ 背景图也是图，而这一行以前不存在。

         台账 抄的 Newel，第一屏那张满边的照片是 CSS 的 background-image，不是
         <img>。盒子读不到它，於是尺子回报「模版 满边的段 0/7」「最宽的图 20%」
         —— 那个 20% 是他们的 **logo**。照这份报告去改，我会把我们那张对的
         满边第一屏拆掉，去追一个他们其实也有的东西。

         **一把看不见半个页面的尺，会把人送去拆掉做对的地方。**
         这是今天最危险的一个洞，而它是在准备动手改页面的时候才现形的。 */
      const bg = getComputedStyle(el).backgroundImage || "";
      if (bg.includes("url(")) {
        const r0 = el.getBoundingClientRect();
        /* 够大才算 —— 图标、纹理、装饰性的小图不是这一段的图。
           而且里面不能已经有一张真的 <img>，否则同一块地方数两次。 */
        if (r0.width >= PAGE * 0.12 && r0.height >= 80 && !el.querySelector("img,video")) {
          push(el, "图");
          continue;
        }
      }
      if (isButton(el)) {
        const rad = Math.round(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
        push(el, "钮", { rad: rad >= 40 ? "丸" : rad >= 3 ? "圆" : "方" });
        continue;
      }
      const t = ownText(el);
      if (t.length >= 2) push(el, "字", { px: Math.round(parseFloat(getComputedStyle(el).fontSize)), n: t.length });
    }
    /* ── 被图片整个盖住的字，人看不到 ────────────────────────────────────
       老板 2026-08-30:「用眼睛找完全部错误 然后去修好尺子」.

       Newel 第4段的六张照片上**一个字都没有** —— 而尺子报「字 x5-50 y15-17」，
       正好落在第一张图的框里。那些字在 DOM 里、CSS 也说可见（不是 none、
       不是 hidden、opacity 是 1），但它们**在图片后面**，没有人看得到。

       我照着那个读数把工程编号压到我们的照片上 —— **凭一个看不见的东西，
       在我们的页面上造了一个他们没有的东西。** 一把把看不见的算成看得见的尺，
       会指挥人去无中生有。

       所以：一个字块如果被同一段里的某一张图**完全盖住**，就不算。
       「完全」是必要的：他们别的段里，字确实压在图上（第7段的 logo 旁边），
       那种是部分重叠，留着。 */
    /* ⚠️ 「在图的框里」不等於「被图盖住」。第一版只比几何，於是把**我们第一屏
       压在照片上的大标题**也判成埋掉了 —— 自检当场红：「我们分段漏字」。
       那句标题在照片上面，是看得见的。

       要判的是**谁画在上面**：一个静态定位的字块，如果整个落在一张**排在它
       后面**的图里，那张图会盖住它；而定位过的（relative / absolute）字块是
       被刻意抬起来的，压在图上就是设计。 */
    const pics = boxes.filter((b) => b.kind === "图");
    const buried = (b) =>
      b.kind === "字" &&
      b.pos === "static" &&
      pics.some(
        (p2) =>
          b.x0 >= p2.x0 && b.x1 <= p2.x1 && b.y0 >= p2.y0 && b.y1 <= p2.y1 && p2.seq > b.seq,
      );
    /* ⚠️ 一颗按钮上的字不是一栏字，它是那颗按钮。
       Wix 的按钮是 <a> 套 <span>，我们的 <a> 自己带字 —— 於是同一颗
       「View All」按钮，他们多出一个字块、我们没有。第4段因此报「几栏 5对3」，
       而两边的排版一模一样。**假差异会把人送去改一件本来没坏的东西。** */
    const btns = boxes.filter((b) => b.kind === "钮");
    const labelled = (b) =>
      b.kind === "字" &&
      btns.some((k) => b.x0 >= k.x0 - 1 && b.x1 <= k.x1 + 1 && b.y0 >= k.y0 - 1 && b.y1 <= k.y1 + 1);
    for (let k = boxes.length - 1; k >= 0; k--)
      if (buried(boxes[k]) || labelled(boxes[k])) boxes.splice(k, 1);

    /* 一段里的字块常常几十个（每一行一个）—— 按「左边缘 + 字级」并成一栏，
       那才是排版上的一个东西。 */
    const merged = [];
    for (const b of boxes.sort((a, b2) => a.y0 - b2.y0 || a.x0 - b2.x0)) {
      const same = b.kind === "字" && merged.find((m) => m.kind === "字" && Math.abs(m.x0 - b.x0) <= 2 && m.px === b.px && b.y0 - m.y1 <= 4);
      if (same) {
        same.y1 = Math.max(same.y1, b.y1);
        same.x1 = Math.max(same.x1, b.x1);
        same.n = (same.n || 0) + (b.n || 0);
        continue;
      }
      merged.push(b);
    }
    return merged;
  });
}

/* ── 字体 TYPE ─────────────────────────────────────────────────────────────
   SIZE WAS NEVER THE WHOLE AXIS, and reading only the size is what let 満図
   ship 「抄完了」 while wearing the wrong typeface. 2026-08-28, side by side at
   native size: A. Reynolds sets its headings AND its body in a serif; ours was
   a geometric sans throughout. The ruler said 90/50 vs 83/51 and passed it.

   重点 7i names 字体 as one of five axes; a face is the loudest half of that
   axis and it was the half nobody measured. So: family, weight, tracking and
   line height, for headings and for body text — because a page can copy its
   headings and still read as somebody else's if the paragraphs are wrong. */
function readType() {
  const face = (el) => {
    const s = getComputedStyle(el);
    /* The FIRST family is the one that applies; the rest of the stack is what
       happens when it fails to load. Quotes stripped so 「"Playfair Display"」
       and 「Playfair Display」 compare equal. */
    const fam = (s.fontFamily || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
    return {
      fam,
      px: Math.round(parseFloat(s.fontSize)),
      w: s.fontWeight,
      lh: Math.round(parseFloat(s.lineHeight) || 0),
      ls: (parseFloat(s.letterSpacing) || 0).toFixed(2),
      /* Serif or not cannot be read off the computed style — it is a property
         of the font file. Measured instead: render one glyph in the page's own
         face and again in a known serif and a known sans, and see which it
         matches. This is the standard font-detection trick and it is the only
         thing here that answers 「衬线还是无衬线」 without a human looking. */
      /* ── 衬线还是无衬线，以及它到底有没有出现在画面上 ──────────────────
         ⚠️ THIS IS THE FIELD THAT STOPPED THIS RULER LYING, 2026-08-28.

         It reported A. Reynolds as a serif page. I looked at the screenshot,
         agreed, and told the founder their design is serif and ours is wrong.
         It is not. `helvetica-w01-light` came back from document.fonts with
         status "error": the webfont could not be fetched from this machine, so
         the browser fell back to Times and BOTH the measurement and the
         picture showed serifs that are not in their design. Their real faces —
         neue-haas-grotesk-display-pro and helvetica — are grotesks, and ours
         already was one. A whole typeface change was one sentence away from
         being made on the strength of a failed download.

         So availability is measured FIRST, and the shape only reported when
         the face is actually on screen. The test is the standard one: set the
         family with monospace behind it, and again with monospace alone. If
         the widths are identical the family resolved to nothing. */
      ...(() => {
        /* family 这个参数现在带字重跟字级，所以下面不再自己补 `100px`。 */
        const w = (family, text) => {
          const c = document.createElement("canvas").getContext("2d");
          c.font = family;   /* 呼叫端已经把字重跟字级放进去了 */
          return c.measureText(text).width;
        };
        const probe = "WWWMMMiiilllQQQ@@@";
        const here = w(`100px "${fam}", monospace`, probe) !== w("100px monospace", probe);
        /* ⚠️ NO SERIF/SANS VERDICT IS PRINTED, and that is deliberate.
           A wide-over-narrow glyph ratio was tried: Georgia 3.09, Times 3.13,
           Arial 4.02 — clean. Then the fonts this product actually uses were
           measured and it collapsed: Geist, a sans, came back 3.338;
           Newsreader, a serif, 3.374. The metric cannot separate them, and a
           ruler that prints a confident wrong answer is worse than one that
           prints the family name and lets the eye decide. The eye has the
           picture; give it the name and whether the name reached the screen. */
        /* ── 字体真正能判的三件 ────────────────────────────────────────
           名字判不了 —— 我们不可能用 Wix 的授权字体，两边的名字永远不一样，
           所以那一格永远是「印出来给眼睛看」。但「像不像」真正吃的不是名字：

             · 衬线还是无衬线 —— 用一串会长出衬线的字母对一串不会的，比宽度
             · 字宽（窄体还是宽体）—— 同一串字画出来多宽，除以字级
             · 大小写处理 —— 全大写、字距拉开，是同一个字体的两张脸

           这三件量得到，而且是这一层真的在打架的东西。
           ⚠️ 只有在字真的载入了（here）的时候才算数 —— 一个 fallback 到
           Times 的量测，量的是这台机器，不是那一页。 */
        const wt0 = s.fontWeight || "400";
        const serifRun = w(`${wt0} 100px "${fam}", monospace`, "IHMTEFL");
        const plainRun = w(`${wt0} 100px "${fam}", monospace`, "ooeecc");
        const widthOf = w(`${wt0} 100px "${fam}", monospace`, "HHHHHHHHHH") / 1000;

        /* ── 字体的「种类」还有两根轴，而且两根都量得到 ────────────────────
           老板 2026-08-29: 「字体的种类呢？」

           名字判不了（我们不可能用他们的授权字体），衬线跟字宽已经在判了。
           剩下这两件才是同一个字级下「看起来完全不同」的原因：

           · **小写多高（x-height / 大写高）** —— 同样 40px，一个 x 高的字体
             看起来大一号、密一号；一个 x 矮的看起来秀气、松。它是两页放在
             一起最先分得出来的一件，而字级、字重、字距全部可以一模一样。
           · **墨量** —— 宣告的 font-weight 两边都写 400，画出来的粗细可以差
             很多（Newsreader 的 400 跟 Archivo 的 400 不是同一种黑）。把一串
             字画进画布数暗像素，量的是它真正有多重，不是它自称多重。 */
        const wt = s.fontWeight || "400";
        const metrics = (text) => {
          const c = document.createElement("canvas").getContext("2d");
          c.font = `${wt} 100px "${fam}", monospace`;
          const m = c.measureText(text);
          return m.actualBoundingBoxAscent || 0;
        };
        const capH = metrics("H");
        const xH = metrics("x");

        const inkOf = () => {
          const cv = document.createElement("canvas");
          cv.width = 400; cv.height = 140;
          const c = cv.getContext("2d", { willReadFrequently: true });
          c.fillStyle = "#fff"; c.fillRect(0, 0, 400, 140);
          c.fillStyle = "#000";
          c.font = `${wt} 100px "${fam}", monospace`;
          c.textBaseline = "alphabetic";
          c.fillText("Hamburgefons", 4, 110);
          const d = c.getImageData(0, 0, 400, 140).data;
          let dark = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i] < 128) dark++;
          return dark / (400 * 140);
        };

        /* ── 笔画的粗细对比 ────────────────────────────────────────────────
           老板 2026-08-31，看着放大的两个标题：「用的字不一样」。三根轴全绿，
           而他一眼看出来 —— 因为那三根量的是**比例**跟**总墨量**，量不到
           **一笔之内粗细变不变**。

             他们  竖笔粗、横笔细，末端外扩（Optima 那一类）
             我们  从头到尾一样粗（Geist）

           一套粗细均匀的黑体可以同时满足「字宽比 1.21 · 小写多高 0.74 ·
           墨量 0.093」而看起来完全是另一套字。

           量法：把一个大写 O 画进画布，量**中间那一横**穿过左右竖笔的厚度，
           跟**中间那一竖**穿过上下横笔的厚度，取比值。
           均匀的黑体接近 1.0，对比强的接近 1.5 以上。 */
        const contrast = (() => {
          const S = 200;
          const cv = document.createElement("canvas");
          cv.width = S; cv.height = S;
          const g = cv.getContext("2d", { willReadFrequently: true });
          g.fillStyle = "#fff"; g.fillRect(0, 0, S, S);
          g.fillStyle = "#000";
          g.font = `${wt} 160px "${fam}", monospace`;
          g.textBaseline = "middle"; g.textAlign = "center";
          g.fillText("O", S / 2, S / 2);
          const d2 = g.getImageData(0, 0, S, S).data;
          const dark = (x, y) => d2[(y * S + x) * 4] < 128;
          /* 一条线上有几段连续的黑 —— 取最长的那一段，那就是笔画的厚度。 */
          const run = (pts) => {
            let best = 0, cur = 0;
            for (const on of pts) { cur = on ? cur + 1 : 0; if (cur > best) best = cur; }
            return best;
          };
          const stem = run(Array.from({ length: S }, (_, x) => dark(x, S / 2 | 0)));
          const bar = run(Array.from({ length: S }, (_, y) => dark(S / 2 | 0, y)));
          return stem && bar ? +(Math.max(stem, bar) / Math.min(stem, bar)).toFixed(2) : 0;
        })();

        return {
          here,
          contrast: here ? contrast : 0,
          serifish: here ? +(serifRun / plainRun).toFixed(3) : 0,
          widthish: here ? +widthOf.toFixed(3) : 0,
          xish: here && capH ? +(xH / capH).toFixed(3) : 0,
          inkish: here ? +inkOf().toFixed(4) : 0,
        };
      })(),
    };
  };
  const heads = [...document.querySelectorAll("h1,h2")]
    .filter((h) => (h.innerText || "").trim())
    .map((h) => ({ t: (h.innerText || "").trim().slice(0, 26), ...face(h) }));
  /* Body: the paragraphs that actually carry prose, not a two-word label. */
  const bodyEls = [...document.querySelectorAll("p,li")]
    .filter((e) => (e.innerText || "").trim().split(/\s+/).length >= 8)
    .filter((e) => parseFloat(getComputedStyle(e).fontSize) >= 12)
    .slice(0, 40);
  const body = [...document.querySelectorAll("p,li")]
    /* ⚠️ 12px 以下的不算正文。瑞士的参考页回报正文 10px，我们 16px，判成对不上 —
       那 10px 是页脚的法务小字，它页面上真正的正文跟我们一样。一个把最小的字
       当成正文的样本，量的是那一页的免责声明。 */
    .filter((e) => (e.innerText || "").trim().split(/\s+/).length >= 8)
    .filter((e) => parseFloat(getComputedStyle(e).fontSize) >= 12)
    .slice(0, 40)
    .map(face);
  const commonest = (arr, key) => {
    const m = {};
    for (const x of arr) m[x[key]] = (m[x[key]] || 0) + 1;
    /* 平手的时候取大的那个。中台 只凑得出两个样本 —— 26px 的第一屏副标跟 13px
       的一行全大写标签 —— 一比一，而 Object.entries 对数字样的键是由小到大，
       所以它安静地选了 13，把一行标签判成了这一页的正文。
       平手不是「小的赢」，平手是「这把尺问错了」；下面 bodyN < 3 会报量不到。 */
    const best = Object.entries(m).sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))[0];
    return best ? best[0] : "—";
  };
  return {
    heads,
    bodyFam: commonest(body, "fam"),
    bodyPx: commonest(body, "px"),
    bodyLh: commonest(body, "lh"),
    bodyHere: body.length ? body.filter((b) => b.here).length > body.length / 2 : null,
    bodyN: body.length,
    bodySamples: bodyEls.slice(0, 12).map((e, i) => `${body[i]?.px}px  ${(e.innerText || "").trim().slice(0, 34)}`),
  };
}

/* ── 照片：几张、多大、什么比例 ───────────────────────────────────────────
   老板 2026-08-28: 「图片的大小 也是要注意」.

   The section list counts photographs and the anatomy reads the group they sit
   in; neither says how BIG one is, and 「1img」 is equally true of a 1440×810
   band and of a thumbnail. Five of the six references are pages whose pictures
   ARE the argument, so they are not copied until the pictures are the size
   theirs are. */
/* 这一页总共有多少看得见的字。规则跟 readShape 里的 ownText 一模一样 ——
   两边规则不同，比出来的差就是规则的差，不是页面的差。 */
function readChars(rootSel) {
  const root = rootSel ? document.querySelector(rootSel) : document.body;
  if (!root) return 0;
  const PAGE = document.documentElement.getBoundingClientRect().width || 1440;
  let n = 0;
  for (const el of root.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) <= 0.05) continue;
    const r = el.getBoundingClientRect();
    if (r.right < PAGE * 0.02 || r.left > PAGE * 0.98) continue;
    let t = "";
    for (const c of el.childNodes) if (c.nodeType === 3) t += c.nodeValue;
    t = t.trim();
    if (t.length >= 2) n += t.length;
  }
  return n;
}

/* ── 宣告的字体档，跟这一页最常用的圆角 ─────────────────────────────────────
   老板 2026-08-30:「那个skills 有好东西 我们也可以加在我的尺子上」·
   「全部放在一起的话 我们只要测量一个就好 就不需要每次都要量那个」.

   design-md-generator 读**声明层**（CSS 里写了什么），align 读**渲染层**
   （画出来是什么）。渲染层在一件事上必然失灵：**那套字载不下来的时候**。
   満図 的参考就是这样 —— A. Reynolds 的 webfont 在这台机器拿不到，浏览器退回
   系统字，於是「大写比小写宽 · 小写多高 · 墨量 · 字宽 · 字重」五格全部量不到。
   而 skill 抽出来的 @font-face 清单写得清清楚楚：

       helveticaneuew01-45ligh   Helvetica Neue 45 Light
       din-next-w01-light        DIN Next Light

   整页是 Light，我们同一个位子是 700。**那一格我猜了，而档案清单读得到。**

   并进这里而不是留在两个工具里，是因为两把尺要分两次跑、两份输出、两次
   对照，而它们讲的是同一页。

   ⚠️ 这两项**印出来给眼睛看，不判**：字体名字两边永远不一样（我们不可能用
   Wix 的授权字体），圆角在两套 token 系统之间也不是同一个刻度。
   它们是「据以决定」的资料，不是「据以判决」的读数。 */
function readDeclared(rootSel) {
  const faces = [];
  let blocked = 0;
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      blocked++;
      continue;
    }
    for (const r of rules || []) {
      if (r.type !== 5) continue;
      const fam = (r.style?.fontFamily || "").replace(/['"]/g, "").trim();
      const wt = (r.style?.fontWeight || "").trim();
      if (fam && !faces.some((f) => f.fam === fam)) faces.push({ fam, wt });
    }
  }
  /* 最常用的圆角 —— 按「有几个看得见的元素用它」算，不按声明次数：
     一条声明一次然后被继承一百次的规则，跟一条写一百次的规则，在页面上是
     同一件事。skill 的颜色排名就是栽在这一点上（任务 39）。 */
  const root = rootSel ? document.querySelector(rootSel) : document.body;
  const tally = {};
  for (const el of (root || document.body).querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 20) continue;
    const px = Math.round((parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0) * 100) / 100;
    if (!Number.isFinite(px) || px <= 0 || px > 400) continue;
    tally[px] = (tally[px] || 0) + 1;
  }
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  return { faces: faces.slice(0, 8), blocked, radius: top ? `${top[0]}px ×${top[1]}` : "没有圆角" };
}

function readShots(rootSel) {
  const root = rootSel ? document.querySelector(rootSel) : document.body;
  if (!root) return [];
  /* 背景图也算一张照片 —— 见 readShape 里那段注解。这里漏掉它，
     「满宽的 / 半幅的 / 最高一张 / 长宽比 / 照片张数」五项一起错。 */
  const W0 = document.documentElement.getBoundingClientRect().width || 1440;
  const backdrops = [...root.querySelectorAll("*")].filter((e) => {
    const bg = getComputedStyle(e).backgroundImage || "";
    if (!bg.includes("url(")) return false;
    const r = e.getBoundingClientRect();
    return r.width >= W0 * 0.12 && r.height >= 80 && !e.querySelector("img,video");
  });
  return [...root.querySelectorAll("img,video"), ...backdrops]
    .map((e) => {
      const r = e.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top + scrollY) };
    })
    /* Below a thumbnail it is a logo, an icon or a spacer — counting those
       would drown the numbers that matter. */
    .filter((x) => x.w >= 120 && x.h >= 90)
    .sort((a, b) => a.top - b.top)
    .map((x) => ({ ...x, ratio: +(x.w / x.h).toFixed(2), share: +(x.w / W0).toFixed(3) }));
}

/* ── 每一段的解剖 ─────────────────────────────────────────────────────────
   The other thing size could not see. 満図's second section is 「Our Expertise」
   — FIVE BORDERED CARDS ON A GREY PANEL, 3 then 2, each with a small icon.
   Ours was a numbered list of four lines. Both are 「a section with a heading」
   and the section list printed them as equals.

   So for each section: what colour it is painted, how much air it has top and
   bottom, and — the part that matters — the repeated group inside it, because
   一排卡片 / 一列清单 / 一张大图 are three different skeletons wearing the same
   height. */
function readAnatomy(rootSel) {
  const root = rootSel ? document.querySelector(rootSel) : null;
  let node = root;
  if (node) while (node && node.children.length <= 2) node = node.children[0];
  const pool = node ? [...node.children] : [...document.querySelectorAll("section,div[id^='comp-']")];
  const boxes = pool
    .map((e) => {
      const r = e.getBoundingClientRect();
      return { e, top: Math.round(r.top + scrollY), h: Math.round(r.height), w: Math.round(r.width) };
    })
    /* 宽度比的是**这一层最宽的那个**，不是视窗 —— 有侧栏的页面上，
       视窗的 90% 是一个没有任何东西达得到的门槛。 */
    .filter((x, _i, all) => x.h >= 90 && (node || x.w >= Math.max(...all.map((y) => y.w)) * 0.9))
    .sort((a, b) => a.top - b.top || b.h - a.h);
  const taken = [];
  const hex = (raw) => {
    const m = (raw || "").match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x));
    if (p.length > 3 && !p[3]) return null;
    return "#" + p.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  };
  /* What colour the section actually IS.
     Three ways a section gets its colour and all three have to be read, or the
     answer is 「—」 for every section, which is what the first version returned
     for the whole reference: Wix paints with a filled DIV stretched inside the
     section, not with a background on the section itself. So: the element's
     own background, else a child that covers it, else the first ancestor that
     declares one. */
  const painted = (el) => {
    const own = hex(getComputedStyle(el).backgroundColor);
    if (own) return own;
    const box = el.getBoundingClientRect();
    if (box.width && box.height) {
      for (const k of el.querySelectorAll("*")) {
        const c = hex(getComputedStyle(k).backgroundColor);
        if (!c) continue;
        const r = k.getBoundingClientRect();
        if (r.width * r.height >= box.width * box.height * 0.8) return c;
      }
    }
    let n = el.parentElement;
    while (n) {
      const c = hex(getComputedStyle(n).backgroundColor);
      if (c) return c;
      n = n.parentElement;
    }
    return "—";
  };
  const out = [];
  for (const { e, top, h } of boxes) {
    if (taken.some((o) => top >= o.top && top + h <= o.top + o.h)) continue;
    taken.push({ top, h });
    /* THE REPEATED GROUP. Walk down looking for the deepest container whose
       children are several boxes of the same width — that is a card row, a
       list, or a gallery, and which of the three it is shows in their shape. */
    let best = null;
    const walk = (n, depth) => {
      if (depth > 14) return;  // Wix nests ten wrappers deep; six stopped on them
      const kids = [...n.children].filter((k) => k.getBoundingClientRect().height > 24);
      if (kids.length >= 2) {
        const r = kids.map((k) => k.getBoundingClientRect());
        const w0 = Math.round(r[0].width);
        const same = r.every((x) => Math.abs(Math.round(x.width) - w0) <= 6);
        const perRow = new Set(r.map((x) => Math.round(x.top))).size;
        if (same && w0 > 90) {
          const cs = getComputedStyle(kids[0]);
          const cand = {
            n: kids.length,
            rows: perRow,
            cols: Math.round(kids.length / Math.max(1, perRow)),
            w: w0,
            bg: hex(cs.backgroundColor) || "透明",
            border: parseFloat(cs.borderTopWidth) ? `${Math.round(parseFloat(cs.borderTopWidth))}px` : "无框",
            radius: Math.round(parseFloat(cs.borderTopLeftRadius)) || 0,
            img: kids[0].querySelectorAll("img,svg,video").length,
          };
          if (!best || cand.n > best.n || (cand.n === best.n && cand.w < best.w)) best = cand;
        }
      }
      for (const k of kids) walk(k, depth + 1);
    };
    walk(e, 0);
    const cs = getComputedStyle(e);
    const im = e.querySelector("img,video");
    out.push({
      top,
      h,
      bg: painted(e),
      padTop: Math.round(parseFloat(cs.paddingTop)) || 0,
      padBottom: Math.round(parseFloat(cs.paddingBottom)) || 0,
      group: best,
      imgRadius: im ? Math.round(parseFloat(getComputedStyle(im).borderTopLeftRadius)) || 0 : null,
      text: (e.innerText || "").trim().split(/\s+/).join(" ").slice(0, 30),
    });
  }
  return out.sort((a, b) => a.top - b.top);
}

/* ── 动效 · 留白 · 颜色（带稳定性分层）──────────────────────────────────────

   The three axes 重点 7i names that `npm run align` could not see. Read off the
   LIVE page with getComputedStyle rather than out of the CSS text: the computed
   value is what actually applies, and it works on any URL — which matters,
   because design-md-generator normalises a URL to its domain root and nine of
   our ten references live on a path under wix.com.

   The stability scoring below is design-md-generator's method (MIT, and a
   method is not copyrightable) with ONE signal replaced. Theirs asks 「on how
   many PAGES does this colour appear」, which needs a crawl of five to eight
   pages. We measure one page, so ours asks 「in how many SECTIONS」 — the same
   question at the scale we work at. A colour in every section is the skeleton;
   a colour in one section is this month's poster.
*/
function readAxes(rootSel) {
  const root = rootSel ? document.querySelector(rootSel) : document.body;
  if (!root) return null;

  const count = (arr) => {
    const m = {};
    for (const v of arr) m[v] = (m[v] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };

  /* ── 动效 ─────────────────────────────────────────────────────────────── */
  const durations = [];
  const easings = [];
  const animations = new Map();
  const moved = new Set();
  for (const el of document.querySelectorAll("*")) {
    const s = getComputedStyle(el);
    for (const d of (s.transitionDuration || "").split(",")) {
      const t = d.trim();
      const ms = t.endsWith("ms") ? parseFloat(t) : parseFloat(t) * 1000;
      if (ms > 0) durations.push(Math.round(ms));
    }
    for (const f of (s.transitionTimingFunction || "").split(/,(?![^(]*\))/)) {
      const v = f.trim();
      if (v) easings.push(v);
    }
    for (const p of (s.transitionProperty || "").split(",")) {
      const v = p.trim();
      if (v && v !== "all" && v !== "none") moved.add(v);
    }
    if (s.animationName && s.animationName !== "none") {
      for (const n of s.animationName.split(",")) {
        const name = n.trim();
        if (name && name !== "none") animations.set(name, (animations.get(name) || 0) + 1);
      }
    }
  }
  const tierOf = (ms) =>
    ms < 100 ? "micro" : ms < 200 ? "small" : ms < 350 ? "medium" : ms < 600 ? "large" : "xl";
  const tiers = {};
  for (const ms of durations) {
    const k = tierOf(ms);
    if (!tiers[k]) tiers[k] = { values: new Set(), n: 0 };
    tiers[k].values.add(ms);
    tiers[k].n++;
  }

  /* Whether the page honours 减少动效. Reading the stylesheets is the only way
     to see a media query that is not currently matching. Cross-origin sheets
     throw on .cssRules, and that is not a failure — it is a sheet we cannot
     see, and saying so is better than reporting false. */
  let reducedMotion = false;
  let sheetsRead = 0;
  let sheetsBlocked = 0;
  for (const sheet of document.styleSheets) {
    try {
      const rules = sheet.cssRules || [];
      sheetsRead++;
      for (const rule of rules) {
        if (rule.conditionText && /prefers-reduced-motion/.test(rule.conditionText)) {
          reducedMotion = true;
        }
      }
    } catch {
      sheetsBlocked++;
    }
  }

  /* ── 留白 ─────────────────────────────────────────────────────────────── */
  const pads = [];
  const gaps = [];
  for (const el of root.querySelectorAll("*")) {
    if (el.getBoundingClientRect().width < 40) continue;
    const s = getComputedStyle(el);
    for (const v of [s.paddingTop, s.paddingBottom]) {
      const n = Math.round(parseFloat(v));
      if (n >= 4 && n <= 400) pads.push(n);
    }
    for (const v of [s.rowGap, s.columnGap]) {
      const n = Math.round(parseFloat(v));
      if (n >= 4 && n <= 400) gaps.push(n);
    }
  }
  /* The base unit is the largest step most of the values are multiples of —
     4 on almost every modern site, 5 or 8 on some. */
  /* ⚠️ The first version tested every value it had collected and came back with
     「基数 1px」 for both pages, which is the answer you get when the sample
     includes computed values that were never authored -- a 9px padding that is
     really 0.5625rem of an inherited font size, a 41px gap that is a percentage
     of a flexible row. Those are consequences, not decisions.

     So: round to the nearest pixel, keep only values a person would plausibly
     have typed (>= 8px), and require the divisor to explain three quarters of
     them. Reported as 「量不出来」 rather than 1 when nothing does -- 1px is not
     a base unit, it is a failure to find one. */
  const authored = pads.concat(gaps).filter((n) => n >= 8);
  let base = 0;
  for (const cand of [8, 6, 5, 4, 3, 2]) {
    if (authored.length >= 8 && authored.filter((n) => n % cand === 0).length / authored.length > 0.75) {
      base = cand;
      break;
    }
  }

  /* ── 颜色 + 四层稳定性 ────────────────────────────────────────────────── */
  const sections = [];
  {
    let node = root;
    while (node && node.children.length <= 2) node = node.children[0];
    for (const e of node ? node.children : []) {
      if (e.getBoundingClientRect().height >= 60) sections.push(e);
    }
  }
  const seen = new Map();
  /* ⚠️ WEIGHTED BY PAINTED AREA, NOT BY HOW MANY ELEMENTS DECLARE IT.

     The first version counted declarations, and on its first run it classified
     台账's own ground -- #45372a, the colour of the entire page -- as
     「content」, with the signals 「只在 1 段出现 · 只拿来铺底 · 只出现 2 次」.
     All three were true of the DECLARATION and false of the PAGE: we paint the
     ground once on the wrapper and inherit it, while Wix repaints it on every
     section, so the same design decision scored 8 on one page and -35 on the
     other.

     A ruler whose reading depends on how the CSS was authored is measuring the
     author, not the page. Background now counts the element's share of the
     viewport width squared-ish (area / 10000 px²), which is what the eye sees;
     text and border keep counting occurrences, because a hairline's area is
     not what makes it structural. */
  const note = (raw, kind, el) => {
    if (!raw || raw === "none") return;
    const m = raw.match(/rgba?\(([^)]+)\)/);
    if (!m) return;
    const parts = m[1].split(",").map((x) => parseFloat(x));
    const r = parts[0];
    const g = parts[1];
    const b = parts[2];
    const a = parts.length > 3 ? parts[3] : 1;
    if (!a) return;
    const hex =
      "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    if (!seen.has(hex)) {
      seen.set(hex, { hex, rgb: [r, g, b], n: 0, usedAs: {}, inSections: new Set() });
    }
    const t = seen.get(hex);
    const r2 = el.getBoundingClientRect();
    const weight = kind === "bg" ? Math.max(1, Math.round((r2.width * r2.height) / 10000)) : 1;
    t.n += weight;
    t.usedAs[kind] = (t.usedAs[kind] || 0) + weight;
    /* A section counts if the painted box CONTAINS it as well as if it sits
       inside it -- the page wrapper contains all of them. */
    const box = el.getBoundingClientRect();
    for (let i = 0; i < sections.length; i++) {
      const sb = sections[i].getBoundingClientRect();
      const inside = sections[i].contains(el);
      const covers = kind === "bg" && box.top <= sb.top + 2 && box.bottom >= sb.bottom - 2;
      if (inside || covers) t.inSections.add(i);
    }
  };
  /* Backgrounds are scanned from the DOCUMENT, not from the frame: our ground
     is painted on the StyleScope wrapper, which is an ANCESTOR of .ds-site, so
     scanning inside the frame missed the single most-seen colour on the page.
     Text and borders stay inside the frame -- the browser chrome around it is
     not the design. */
  for (const el of document.body.querySelectorAll("*")) note(getComputedStyle(el).backgroundColor, "bg", el);
  for (const el of root.querySelectorAll("*")) {
    const s = getComputedStyle(el);
    note(s.color, "text", el);
    note(s.borderTopColor, "border", el);
  }
  const pageArea = Math.max(1, document.body.scrollHeight * root.clientWidth);

  /* Which colours somebody gave a NAME to. A named colour is a decision; an
     unnamed one may be a one-off. */
  const declared = new Set();
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules || []) {
        const st = rule.style;
        if (!st) continue;
        for (let i = 0; i < st.length; i++) {
          const p = st[i];
          if (p.startsWith("--")) declared.add(st.getPropertyValue(p).trim().toLowerCase());
        }
      }
    } catch {
      /* cross-origin */
    }
  }

  const total = Math.max(1, sections.length);
  const colours = [...seen.values()]
    .map((t) => {
      const signals = [];
      let score = 0;
      const cover = t.inSections.size / total;
      if (cover >= 0.8) {
        score += 30;
        signals.push("每一段都有 " + Math.round(cover * 100) + "%");
      } else if (cover >= 0.5) {
        score += 20;
        signals.push("过半的段 " + Math.round(cover * 100) + "%");
      } else if (cover < 0.2) {
        score -= 20;
        signals.push("只在 " + t.inSections.size + " 段出现");
      }

      const dims = Object.keys(t.usedAs).length;
      if (t.usedAs.text || t.usedAs.border) {
        score += 25;
        signals.push("当文字或边框");
      }
      if (dims >= 3) {
        score += 15;
        signals.push(dims + " 种用途");
      }
      if (dims === 1 && t.usedAs.bg) {
        score -= 15;
        signals.push("只拿来铺底");
      }

      if (declared.has(t.hex) || declared.has("rgb(" + t.rgb.join(", ") + ")")) {
        score += 20;
        signals.push("有变量名");
      }

      if (t.n >= 500) {
        score += 20;
        signals.push("出现 " + t.n + " 次");
      } else if (t.n >= 50) {
        score += 10;
        signals.push("出现 " + t.n + " 次");
      } else if (t.n <= 5) {
        score -= 20;
        signals.push("只出现 " + t.n + " 次");
      }

      const r = t.rgb[0];
      const g = t.rgb[1];
      const b = t.rgb[2];
      if (Math.max(r, g, b) - Math.min(r, g, b) <= 25) {
        score += 10;
        signals.push("无彩色");
      }

      /* ⚠️ AREA OVERRIDES EVERY OTHER SIGNAL.

         The scoring signals above all ask 「how was this written?」 — how many
         elements declare it, whether it also colours text, whether it has a
         variable name. Those are good proxies on a page whose CSS repeats
         itself, and they are wrong on a page built out of tokens: our ground
         is authored ONCE and inherited, so it scored 「只在 1 段出现 · 只拿来铺底」
         and came back as 「content」 — the colour of the entire page, filed as
         this month's poster.

         Painted area cannot be gamed by authoring style. A colour covering a
         third of the page IS the design, however few rules declare it. */
      const areaShare = (t.usedAs.bg || 0) * 10000 / pageArea;
      if (areaShare >= 0.33) { score = Math.max(score, 60); signals.push("铺满 " + Math.round(areaShare * 100) + "% 的页面"); }
      else if (areaShare >= 0.08) { score = Math.max(score, 30); signals.push("铺了 " + Math.round(areaShare * 100) + "% 的页面"); }

      const layer =
        score >= 60 ? "infrastructure" : score >= 30 ? "system" : score >= 0 ? "campaign" : "content";
      return {
        area: Math.round(areaShare * 100),
        hex: t.hex,
        n: t.n,
        usedAs: t.usedAs,
        sections: t.inSections.size,
        layer,
        score,
        signals,
      };
    })
    .sort((a, b) => b.n - a.n);

  return {
    motion: {
      tiers: Object.entries(tiers)
        .map(([k, v]) => ({ tier: k, ms: [...v.values].sort((a, b) => a - b), n: v.n }))
        .sort((a, b) => a.ms[0] - b.ms[0]),
      easings: count(easings).slice(0, 4),
      properties: [...moved].slice(0, 8),
      animations: [...animations.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
      reducedMotion,
      sheetsRead,
      sheetsBlocked,
    },
    space: {
      baseUnit: base,
      sample: (() => {
        const m = {};
        for (const n of pads.concat(gaps)) m[n] = (m[n] || 0) + 1;
        return Object.entries(m).map(([k, v]) => [Number(k), v]).sort((a, b) => b[1] - a[1]).slice(0, 20);
      })(),
      padScale: [...new Set(pads)].sort((a, b) => a - b).slice(0, 14),
      gapScale: [...new Set(gaps)].sort((a, b) => a - b).slice(0, 14),
      topPads: count(pads).slice(0, 5),
    },
    colours: colours.slice(0, 12),
    sectionCount: sections.length,
  };
}

/* ── 动效 MOTION：真的动了什么，不是宣告了什么 ─────────────────────────────

   老板 2026-08-29: 「动效只量了「宣告了什么」，没量「真的动了什么」…
   你看看要这么去修」.

   readAxes 读的是 CSS 文本里的 transition-duration 跟 easing —— 那是**写了
   什么**。一条写了 400ms 的 transition，可能挂在一个从来不变的属性上；一段
   滚动进场，可能整页只有第一屏有。两者印出来的数字一模一样。

   这里量的是**位置真的变了多少**，做法是把页面当成一个访客来用：

     · 进场：先滚到顶，记下还在视窗外那些块的 opacity 跟 transform；把它们滚
       进视窗、等它演完，再记一次。变了的就是会进场的块，位移是量出来的 px。
     · hover：用真的鼠标停在第一颗按钮跟第一张图上（CSS 的 :hover 只有真的
       指针触发得了，dispatchEvent 不行），前后各读一次 transform / 阴影 /
       底色 / filter。

   ⚠️ 它量不到「好不好看」，只量「有没有动、动多远」。判断一套风格的动效对不对
   还是眼睛的事（重点 7c）。 */
async function probeMotion(p, rootSel) {
  try {
    /* 回到顶端，让还没进场的块回到它们的起点。reload 比 scrollTo(0) 干净：
       已经播过一次的进场动画不会倒带。 */
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2600);

    const before = await p.evaluate((sel) => {
      const root = sel ? document.querySelector(sel) : document.body;
      if (!root) return [];
      const vh = window.innerHeight;
      const out = [];
      let i = 0;
      for (const el of root.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        /* 只看还在视窗下面、而且够大的块 —— 第一屏的东西已经演完了。 */
        if (r.top < vh + 40 || r.height < 60 || r.width < 200) continue;
        el.setAttribute("data-motion-probe", String(i));
        const cs = getComputedStyle(el);
        out.push({ i, op: Number(cs.opacity), tf: cs.transform, top: Math.round(r.top + scrollY) });
        i++;
        if (i >= 60) break;
      }
      return out;
    }, rootSel);

    for (let y = 0; y < 12; y++) {
      await p.evaluate((k) => window.scrollTo(0, k * window.innerHeight * 0.7), y);
      await p.waitForTimeout(260);
    }
    await p.waitForTimeout(1200);

    const after = await p.evaluate(() =>
      [...document.querySelectorAll("[data-motion-probe]")].map((el) => {
        const cs = getComputedStyle(el);
        return { i: Number(el.getAttribute("data-motion-probe")), op: Number(cs.opacity), tf: cs.transform };
      }),
    );

    const shift = (a, b) => {
      /* ⚠️ 「none」不是「量不到」，是「没有位移」—— 当成单位矩阵。

         第一版在这里回传一个常数 60，理由是「none → matrix 也是动」。跑出来
         台账 · 图纸 · 満図 三套整整齐齐都是「位移 60px」—— 那不是量出来的，
         那是我自己写的哨兵，印出来跟一个真的读数一模一样。这个仓库反覆栽在
         同一件事上：一把坏掉的尺照样印出一个看起来可信的数字。 */
      const num = (t) => (t && t !== "none" ? t.replace(/^matrix\w*\(|\)$/g, "").split(",").map(Number) : [1, 0, 0, 1, 0, 0]);
      const A = num(a), B = num(b);
      const ax = A.length === 6 ? A[4] : A[12], ay = A.length === 6 ? A[5] : A[13];
      const bx = B.length === 6 ? B[4] : B[12], by = B.length === 6 ? B[5] : B[13];
      return Math.round(Math.hypot((bx ?? 0) - (ax ?? 0), (by ?? 0) - (ay ?? 0)));
    };
    const byI = new Map(after.map((x) => [x.i, x]));
    let entered = 0, faded = 0, maxShift = 0;
    for (const b of before) {
      const a = byI.get(b.i);
      if (!a) continue;
      const d = shift(b.tf, a.tf);
      const fade = a.op - b.op > 0.15;
      if (fade) faded++;
      if (d >= 4 || fade) entered++;
      maxShift = Math.max(maxShift, d);
    }

    /* hover —— 真的把指针停上去。 */
    const hover = async (sel) => {
      const h = await p.$(sel);
      if (!h) return null;
      const read = () => h.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          tf: cs.transform, sh: cs.boxShadow, bg: cs.backgroundColor, fl: cs.filter, op: cs.opacity,
          /* 反应多快也是动效的一部分：120ms 的抬起跟 600ms 的抬起，
             一个像按钮一个像幻灯片。 */
          ms: Math.round(Math.max(0, ...String(cs.transitionDuration || "0s").split(",")
            .map((v) => (v.includes("ms") ? parseFloat(v) : parseFloat(v) * 1000) || 0))),
        };
      });
      try {
        /* ⚠️ 不要用 locator.hover() —— 它会做「这个元素点得到吗」的检查，
           Wix 的页面上面盖着一层全屏包装，检查过不了就抛，於是模版那一栏印
           「量不到」。而那不是真的量不到，是我们自己不肯把指针移过去。
           直接把鼠标移到它的中心：CSS 的 :hover 本来就是「指针在这个点上」，
           盖住了就是盖住了 —— 那也是一个诚实的答案。 */
        await h.evaluate((el) => el.scrollIntoView({ block: "center" }));
        await p.waitForTimeout(400);
        const box = await h.boundingBox();
        if (!box) return null;
        const a = await read();
        await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await p.waitForTimeout(700);
        const b = await read();
        const bits = [];
        if (shift(a.tf, b.tf) >= 2 || (a.tf !== b.tf && a.tf !== "none")) bits.push("变形");
        if (a.sh !== b.sh) bits.push("阴影");
        if (a.bg !== b.bg) bits.push("底色");
        if (a.fl !== b.fl) bits.push("滤镜");
        if (Math.abs(Number(a.op) - Number(b.op)) > 0.05) bits.push("淡");
        return bits.length ? `${bits.join("+")} ${b.ms || a.ms}ms` : "不动";
      } catch {
        return null;
      }
    };
    /* ⚠️ 「第一个 a[href]」不是「第一颗按钮」。Wix 的页面第一个连结是顶栏里
       一个透明的文字连结，停上去当然什么都不动，而那一格会印出「量不到」或者
       「不动」—— 两个都是假的。用跟 readShape 同一条规则挑：可以点的、有自己
       的底或框、高度像一个控件。挑到了就在它身上做记号再 hover。 */
    const tagged = await p.evaluate((sel) => {
      const root = sel ? document.querySelector(sel) : document.body;
      if (!root) return { btn: false, img: false };
      let btn = false, img = false;
      for (const el of root.querySelectorAll("a,button,[role=button]")) {
        const r = el.getBoundingClientRect();
        if (r.height < 24 || r.height > 96 || r.width < 60) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        const painted = cs.backgroundColor && !/(^rgba\(0, 0, 0, 0\)$|transparent)/.test(cs.backgroundColor);
        const framed = parseFloat(cs.borderTopWidth) > 0;
        if (!painted && !framed) continue;
        el.setAttribute("data-hover-probe", "btn");
        btn = true;
        break;
      }
      for (const el of root.querySelectorAll("img")) {
        const r = el.getBoundingClientRect();
        if (r.width < 200 || r.height < 120) continue;
        el.setAttribute("data-hover-probe", "img");
        img = true;
        break;
      }
      /* ── 第三、四种：卡片跟纯文字连结 ──────────────────────────────────
         以前只试一颗按钮跟一张图。卡片抬起来、连结画底线，是这一层最常见的
         两种反应，而两种都没试过 —— 任务 28 明明写着「卡片 hover 抬起」，
         从来没有一行验证过它真的抬。 */
      let card = false, link = false;
      for (const el of root.querySelectorAll("li,article,figure,div")) {
        const r = el.getBoundingClientRect();
        if (r.width < 200 || r.width > 700 || r.height < 140) continue;
        const cs = getComputedStyle(el);
        const painted = cs.backgroundColor && !/(^rgba\(0, 0, 0, 0\)$|transparent)/.test(cs.backgroundColor);
        const framed = parseFloat(cs.borderTopWidth) > 0;
        if (!painted && !framed) continue;
        el.setAttribute("data-hover-probe", "card");
        card = true;
        break;
      }
      for (const el of root.querySelectorAll("a[href]")) {
        const r = el.getBoundingClientRect();
        if (r.height < 12 || r.height > 40 || r.width < 40) continue;
        if (el.getAttribute("data-hover-probe")) continue;
        const cs = getComputedStyle(el);
        const painted = cs.backgroundColor && !/(^rgba\(0, 0, 0, 0\)$|transparent)/.test(cs.backgroundColor);
        if (painted) continue;   // 那是按钮，上面已经试过
        el.setAttribute("data-hover-probe", "link");
        link = true;
        break;
      }
      return { btn, img, card, link };
    }, rootSel);
    /* ⚠️ 「这一页没有卡片」不是一个 hover 的答案，是「这一题问不了」。
       中台 的页面本来就没有卡片（它的主张就是不用卡片），而尺子拿
       「不动」对「没有卡片」判成不及格 —— 那是在骂它做对的事。
       问不了就回 null，走「量不到」那条路。 */
    const btn = tagged.btn ? await hover('[data-hover-probe="btn"]') : null;
    const img = tagged.img ? await hover('[data-hover-probe="img"]') : null;
    const card = tagged.card ? await hover('[data-hover-probe="card"]') : null;
    const link = tagged.link ? await hover('[data-hover-probe="link"]') : null;

    return { probed: before.length, entered, faded, maxShift, btn, img, card, link };
  } catch {
    return null;
  }
}

/* ── 把一页真的载完 —— **两支共用同一份** ────────────────────────────────
   老板 2026-08-31:「再修」. 追[任务 81](../docs/founder-tasks.md) 那条线索时
   量到的：同一个网址，`--probe` 读到段里有 7 张图，`align` 只读到 3 张。
   两支呼叫的是同一个 `readShape`，**差别在怎么把那一页载完** ——
   probe 滚一轮，shoot 滚两轮＋等每张图 decode＋等字体。

   **一个跟尺子载法不同的诊断工具，诊断的是另一页。** 所以抽成一份，
   两支都用它；以后改载法只有一个地方，也不会再出现「probe 说没事、
   正式那条说有事」这种自己跟自己对不上的情况。 */
async function settlePage(p, wait) {
  await p.addStyleTag({ content: "nextjs-portal,[data-nextjs-toolbar]{display:none!important}" }).catch(() => {});
  await p.waitForTimeout(wait);
  await p.evaluate(async () => {
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, pass === 0 ? 240 : 130));
      }
    }
    window.scrollTo(0, 0);
    /* 图要真的解码完 —— complete 只说「请求结束了」，naturalWidth 才说
       「里面真的有一张图」。 */
    /* ⚠️ decode() 可以永远不返回 —— 一张 loading="lazy" 的图，滚过去又滚回来
       之后既不解码也不失败，那个 promise 就一直挂着。.catch() 接的是「拒绝」，
       接不了「不回来」。实测：390px 的客户官网 12 张图，卡在这里超过五分钟。
       所以每一张给 1.5 秒上限，到了就算了 —— 我们要的是「尽量都载完」，
       不是「保证全部载完」。 */
    await Promise.all(
      [...document.images].map((im) =>
        Promise.race([
          im.decode ? im.decode().catch(() => {}) : Promise.resolve(),
          new Promise((r) => setTimeout(r, 1500)),
        ]),
      ),
    );
    if (document.fonts && document.fonts.ready) await document.fonts.ready.catch(() => {});
  });
  await p.waitForTimeout(2500);

  /* ── 滚到「不再变」为止，不是滚固定的两轮 ──────────────────────────────
     老板 2026-08-31:「再修」. blueprint 的参考拍回来**少了整个第一屏的大标题、
     少了副标、少了按钮、少了团队照片** —— 内容挤在左边（版心 2%–59%），
     「正文」量到 81px（只剩大字看得见），44% 的字掉在段外。
     而同一个网址用 `--probe` 载，那些东西全部都在。

     两支的载法统一之后数字还是不一样，所以**不是载法不同，是载得够不够**：
     滚固定的轮数，等於赌这一页的进场动画在第几轮跑完。Wix 这一页赌输了。

     所以改成**量到稳为止**：滚一轮 → 数一次看得见的字 → 再滚一轮 → 再数，
     两次一样才算载完，最多五轮。
     ⚠️ 五轮还在变就**说出来**（下面 auditCapture 会拒绝），不要静静地拿
     第五轮那一份去算 —— 那正是这一次的形状。 */
  /* ⚠️ 每一步等多久，是这一整条里最贵的一个数字。
     A. Reynolds（満図 的参考）两次都拍回半张 ——「Our Expertise」底下一整片
     空白。它的内容是滚到才载入的，而每格 120ms 不够它回来。
     放慢到 300ms、放到八轮：一轮多花几秒，换一份不用重拍的采集。
     ⚠️ 仍然会有拍不到的时候，那就该拒绝 —— 慢不是保证，只是把赌注变小。 */
  let last = -1, stable = 0;
  for (let pass = 0; pass < 8 && stable < 2; pass++) {
    const n = await p.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 300));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 700));
      let c = 0;
      for (const el of document.body.querySelectorAll("*")) {
        if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        for (const nd of el.childNodes) if (nd.nodeType === 3) c += (nd.nodeValue || "").trim().length;
      }
      return c;
    });
    stable = n === last ? stable + 1 : 0;
    last = n;
  }
  await p.waitForTimeout(600);
}

async function shoot(target, rootSel, wait, file, width = 1440, withMotion = true) {
  const p = await browser.newPage({ viewport: { width, height: width < 500 ? 844 : 1100 } });
  await p.goto(target, { waitUntil: "domcontentloaded", timeout: 90000 });
  await settlePage(p, wait);
  const secs = await p.evaluate(readSections, rootSel);
  const type = await p.evaluate(readType);
  const axes = await p.evaluate(readAxes, rootSel);
  const anat = await p.evaluate(readAnatomy, rootSel);
  const shots = await p.evaluate(readShots, rootSel);
  /* 影片是一个版面决定，不是一张照片。満図 的参考第5段整段是一段自动播放的
     背景影片（「Play Background Video」），我们那一段是一张静态照片 —— 段高
     一样、张数一样（video 也被算成一张），六项全绿，而一段会动的画面跟一张
     不会动的照片是两个东西。 */
  const vids = await p.evaluate((sel) => {
    const root = sel ? document.querySelector(sel) : document.body;
    if (!root) return 0;
    return [...root.querySelectorAll("video")].filter((v) => {
      const r = v.getBoundingClientRect();
      return r.width >= 200 && r.height >= 120;
    }).length;
  }, rootSel);
  /* ⚠️ 载不出来的图，长得像一张照片。
     老板 2026-08-31:「10以下 你想办法去修好」。修 満図 的时候把第3段裁成原尺寸
     用眼睛看 —— 他们那一段右边**是一个破图框**（白底加一个小图标），而尺子把它
     当成一张 40% 宽的照片在比，报「最宽的图 100%对40%」。
     **一个失败的 <img> 有宽有高、进得了段、算得进张数**，每一项跟图有关的读数
     都被它拉走，而报告读起来跟对的一模一样。
     （这跟半张的采集是同一家：眼睛一眼看得到，尺子每一项都绿。） */
  const broken = await p.evaluate((sel) => {
    const root = sel ? document.querySelector(sel) : document.body;
    if (!root) return [];
    return [...root.querySelectorAll("img")]
      .filter((i) => i.complete && i.naturalWidth === 0)
      .map((i) => {
        const r = i.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), src: (i.currentSrc || i.src || "").slice(-48) };
      })
      .filter((x) => x.w >= 60 && x.h >= 60);
  }, rootSel);
  const shape = await p.evaluate(readShape, rootSel);
  const chars = await p.evaluate(readChars, rootSel);
  const declared = await p.evaluate(readDeclared, rootSel);
  await p.screenshot({ path: `${OUT}/${file}.jpg`, fullPage: true, type: "jpeg", quality: 80 });
  const move = withMotion ? await probeMotion(p, rootSel) : null;
  await p.close();
  return { secs, type, axes, anat, shots, shape, move, vids, chars, declared, broken, file };
}

/* ── 验收这一次采集，不过就拒绝 ──────────────────────────────────────────────
   一段「空白」的定义：它里面一个盒子都没有（readShape 走完什么都没收到），
   而它却有 200px 以上的高。那是一段还没载入的内容，不是一段留白的设计 ——
   留白的设计里至少有一行字。 */
/* ── 这一份采集完不完整 ──────────────────────────────────────────────────
   老板 2026-08-31:「再修」. blueprint 的参考拍回来少了整个第一屏的大标题、
   副标、按钮跟团队照片 —— 而 `auditCapture` 放行了，因为它只查「有没有哪一段
   是**完全**空的」，而那一页每一段都还有东西。**一份半空的采集，长得跟一份好的
   一模一样。**

   ⚠️ 而且它是**不稳定**的：单独跑 blueprint 拍得到（16 项），
   六套连着跑就拍不到（24 项，而且漏的字数一个不差）。所以答案不是
   「再多滚几轮」—— 多滚只是把赌注加大。答案是**验收，不过就重来，
   再不过就拒绝**：这把尺的规矩一直是「宁可大声拒绝，不要安静地给错答案」。

   判准用**字**不用图：一张图漏了看得出来，一整段字漏了看不出来 ——
   它只会让版心、字级、几栏全部小一号，每一项都还印得像真的。 */
function captureThin(r) {
  const all = r.chars || 0;
  if (all < 400) return null;
  const held = (r.shape ?? []).reduce(
    (n, bs) => n + bs.reduce((m, b) => m + (b.kind === "字" ? b.n || 0 : 0), 0), 0);
  return held / all < 0.8 ? Math.round((1 - held / all) * 100) : null;
}

function auditCapture(who, r) {
  const blank = [];
  const body = (l, secsL) => (secsL.length && secsL[0].h < 120 ? l.slice(1) : l);
  const secs = body(r.secs, r.secs);
  const shape = body(r.shape ?? [], r.secs);
  for (let i = 0; i < secs.length; i++) {
    if (secs[i].h >= 200 && (!shape[i] || shape[i].length === 0)) blank.push(i + 1);
  }
  return blank;
}

try {
  /* ── 模版那一边冻起来 ────────────────────────────────────────────────────
     参考页是活的：Wix 会改版、网速会抖、Cloudflare 会挡。每一次跑都重新爬，
     等於每一次的「模版」都可能是不同的一份 —— 我们改了什么、还是它变了什么，
     分不出来。

     所以采集一次、验收一次、存成快照，之后只重新量**我们自己那一边**。
     模版不再是变数，我们的页面才是。顺便一次跑从两页变一页。

     快照带日期，而且每一次都印出来 —— 一份三个月前的参考不该安静地当成今天的。
     要重新采集：npm run align -- <风格> --refresh */
  const REFRESH = process.argv.includes("--refresh");
  const SKIP_PHONE = process.argv.includes("--desktop");
  const WHY = process.argv.includes("--why");
  const refFile = `${OUT}/${register}-ref.json`;
  let theirs = null;
  let theirsPhone = null;
  if (!REFRESH && fs.existsSync(refFile)) {
    const snap = JSON.parse(fs.readFileSync(refFile, "utf8"));
    /* ⚠️ 快照里没有截图 —— 截图在 <风格>-ref.jpg，逐段颜色跟差异图读的是它。
       只检查 JSON 在不在，就会出现「量到的是 8-29 那一份、看到的是别天那一张」
       甚至根本没有那一张。两半必须同时在，缺一半就重来。 */
    const jpgOk = fs.existsSync(`${OUT}/${register}-ref.jpg`);
    if (snap.url === url && snap.phone && jpgOk) {
      theirs = snap.data;
      theirsPhone = snap.phone;
      console.log(`参考快照 ${String(snap.at).slice(0, 10)} 采集（要重来：加 --refresh）`);
    } else if (snap.url === url && !jpgOk) {
      console.log("参考快照在，但那张截图不见了 —— 重新采集。");
    }
  }
  if (!theirs) {
    theirs = await shoot(url, null, 7000, `${register}-ref`);
    {
      /* 半空就重来一次。第二次还是半空，就不要往下算了 ——
         从一份残缺的参考算出来的每一项读数，都会印得跟对的一模一样。 */
      let thin = captureThin(theirs);
      if (thin !== null) {
        console.log(`  ⚠️ 参考拍得不完整（${thin}% 的字不在任何一段里）—— 重拍一次`);
        theirs = await shoot(url, null, 7000, `${register}-ref`);
        thin = captureThin(theirs);
      }
      if (thin !== null) {
        console.error(`
🔴 这一次测量不算数：${url} 连拍两次都不完整（${thin}% 的字不在任何一段里）。
   多半是它的进场动画没跑完就拍了。看一眼 ${OUT}/${register}-ref.jpg —— 少了什么一眼就知道。`);
        await browser.close();
        process.exit(1);
      }
    }
    const blank = auditCapture("模版", theirs);
    /* ALIGN_FORCE_AUDIT=1 强迫它红一次 —— 一个没有人看过它红的守卫等於没有守卫。 */
    if (blank.length > (process.env.ALIGN_FORCE_AUDIT ? -1 : 1)) {
      console.error(`
🔴 这一次采集不算数：模版那一页有 ${blank.length} 段是空的（第 ${blank.join(" · ")} 段）。`);
      console.error("   一段有高度却一个盒子都没有，是它还没载入 —— 不是它的设计。");
      console.error("   从一份没载完的参考算出来的每一个数字都是错的，而且会印成「过关」。");
      console.error(`   看一眼 ${OUT}/${register}-ref.jpg 再决定：网速、Cloudflare、还是那一页真的改了。`);
      await restore();
      await browser.close();
      process.exit(1);
    }
    /* 手机也采一份。他自己量的 19 家马来西亚 SME 里 15 家第一屏就给 WhatsApp，
       因为客人在手机上 —— 而这个宽度我们一次都没量过，抄的一直只有桌面那一套。 */
    theirsPhone = await shoot(url, null, 7000, `${register}-ref-390`, 390, false);
    /* 手机那一份也要验 —— 只验桌面，等於「桌面拒绝、手机照收」，
       而手机那一份正好是最容易载不完的（一页更长、图更多）。 */
    const blankP = auditCapture("模版手机", theirsPhone);
    if (blankP.length > 1) {
      console.error(`
🔴 模版的手机那一份有 ${blankP.length} 段是空的（第 ${blankP.join(" · ")} 段）—— 这一次采集不算数。`);
      await restore();
      await browser.close();
      process.exit(1);
    }
    fs.writeFileSync(
      refFile,
      JSON.stringify({ url, at: new Date().toISOString(), data: theirs, phone: theirsPhone }),
    );
    console.log(`参考重新采集了（桌面 + 手机），存成 ${refFile}`);
  }
  const ours = await shoot(`http://localhost:3000/s/${project.site_slug}`, ".ds-site", 2500, `${register}-ours`);
  /* `--desktop`：在改桌面那几根轴的时候，手机那一遍是纯等待。
     省下来大约一半的时间，而**手机的那几项会印「没量」不是「过关」** ——
     一把跳过一项却回报绿的尺，这个仓库被骗过四次。 */
  const oursPhone = SKIP_PHONE
    ? null
    : await shoot(`http://localhost:3000/s/${project.site_slug}`, ".ds-site", 2500, `${register}-ours-390`, 390, false);

  /* ⚠️ 量完再读一次风格 —— 开头那一次挡不住「量到一半被人改掉」。
     2026-08-31 实测：我把五套丢到背景跑，又在前台跑 ledger。开头写 ledger、
     读回来是 ledger、守卫放行；接着另一个进程把同一个 demo project 切成别的
     风格，我们拍到的是**那一套的页面**，而报告一本正经地印了六十项台账的读数。
     手机那张图是洋红色的、公司名是别人的、一张照片都没有 —— 而三项检查
     只是「转红」，没有任何一项说「这一份不算数」。

     一次写、一次读，防的是写失败；**量完再读一次**，防的是量的过程中它被换掉。
     两次都要，而且这一次要在拍完之后。 */
  {
    const { data: still } = await db.from("projects").select("style").eq("id", PROJECT).single();
    if (still?.style !== register) {
      console.error(`
🔴 这一次测量不算数：拍完之后 demo 站已经不是 ${register} 了（现在是 ${still?.style}）。
   多半是同时有第二个 align 在跑 —— 十套共用同一个 project，不能并行。`);
      await restore();
      process.exit(1);
    }
  }

  {
    /* 我们自己这一边也验 —— dev server 重编到一半被读到，长得跟一段没载入的
       参考一模一样，而那一次的每一个数字都是错的。 */
    const blank = auditCapture("我们", ours);
    if (blank.length > 1) {
      console.error(`
🔴 这一次采集不算数：我们那一页有 ${blank.length} 段是空的（第 ${blank.join(" · ")} 段）。`);
      console.error("   多半是 dev server 还在重编。等一下再跑一次。");
      await restore();
      await browser.close();
      process.exit(1);
    }
  }

  /* ── 一份差异清单，不是一份读数 ────────────────────────────────────────────
     老板 2026-08-28: 「那就重写全部的尺子 确保能复刻到一模一样」「如果复刻不到
     就补尺子 看看到底哪里没有测量好」.

     The old report printed both sides and left the comparing to whoever read
     it, which is how four registers shipped with matching section counts and
     entirely different colours: nothing in the output ever said 「这一项不一样」.

     Every line below is a CHECK with a verdict. A check that cannot be made
     says 量不到 rather than passing quietly — an unmeasured axis is where the
     next difference will hide, and the founder's instruction is that the gap
     itself is the finding. */
  const marks = [];
  const check = (axis, name, theirsV, oursV, ok) => {
    marks.push({ axis, name, ok });
    const flag = ok === null ? "?" : ok ? "OK" : "XX";
    console.log(
      `  ${flag}  ${name.padEnd(16)} 模版 ${String(theirsV).padEnd(30)} 我们 ${oursV}`,
    );
  };
  const near = (a, b, tol) => Math.abs(a - b) <= tol;

  /* ── 两边都量不到 ≠ 两边一样 ────────────────────────────────────────────
     整份报告的落款写着「量不到不是过关」，而这些检查自己在违反它：
       · 时长   两边都读不到 → dominant() 各回 0 → near(0, 0, 90) → 过关
       · 缓动   两边都读不到 → "—" === "—" → 过关
       · 减少动效 两边 axes 都是 undefined → Boolean 相等 → 过关
       · 段间最大 / 满宽的 / 最高一张 / 手机最宽的图 —— 全部 0 对 0 → 过关
     一页被 Cloudflare 挡住、一份 CSS 读不到，整个动效轴会安静地全绿。
     judge() 把「没有值」跟「值一样」分开：缺一边就回 null。 */
  const judge = (a, b, ok) => (a === 0 || a === "—" || a === undefined || a === null ||
                               b === 0 || b === "—" || b === undefined || b === null ? null : ok);

  const row = (s, i) => `${String(i + 1).padStart(2)}  ${String(s.h).padStart(5)}px  ${String(s.img).padStart(2)}img  ${s.text}`;
  const sum = (l) => l.reduce((a, s) => a + s.h, 0);
  console.log(`\n参考 ${url}\n${theirs.secs.map(row).join("\n")}\n  = ${theirs.secs.length} 段 ${sum(theirs.secs)}px`);
  console.log(`\n我们 ${register}\n${ours.secs.map(row).join("\n")}\n  = ${ours.secs.length} 段 ${sum(ours.secs)}px`);

  /* ── 1 版面 LAYOUT ─────────────────────────────────────────────────────── */
  console.log("\n版面 LAYOUT");
  /* ⚠️ 顶栏不算一段。Wix folds its navigation into the first section's box and
     ours is a sibling, so an identical page reads as 「他们 6 段，我们 7 段」 — a
     difference the ruler was creating rather than finding. Anything under 120px
     at the very top is chrome. */
  const bodySecs = (l) => (l.length && l[0].h < 120 ? l.slice(1) : l);
  const ts = bodySecs(theirs.secs);
  const os_ = bodySecs(ours.secs);
  /* ⚠️ 这一项以前是 near(±1) —— 而下面的「配得上的段」问的是同一件事，
     问得还更准（它知道多出来的是哪一段）。瑞士 7 段对 8 段：这一项判过，
     那一项判不过。同一份报告里两个相反的答案，人只会读到其中一个。
     所以这里只印不判，判交给「配得上的段」。 */
  check("版面", "段数", ts.length, os_.length, null);
  check("版面", "整页高", `${sum(theirs.secs)}px`, `${sum(ours.secs)}px`,
    near(sum(theirs.secs), sum(ours.secs), sum(theirs.secs) * 0.25));
  /* ── 段均高 —— 最晚才量到的一项，而它是最大的那个差 ────────────────────────
     老板 2026-08-28，看完三张对照图：「根本不一样哦 简直不能说是模版抄出来的」·
     「我叫你对齐的东西 你完全没有去对齐啊」. He was right and nothing in the
     checklist could see it: 段数 matched, 整页高 was inside tolerance, 段间 was
     0 on both sides — and their sections were two and a half times as tall as
     ours. A page of the same eight arguments in thin strips is not that page.

         招牌  他们段均 1434px  我们 617px   2.3 倍
         图纸        900        549        1.6
         台账 / 瑞士 / 中台                  1.3

     Height per section is where a reference's air actually lives, and it was
     the one number nobody had asked for. */
  const mean = (l) => (l.length ? Math.round(l.reduce((a, s) => a + s.h, 0) / l.length) : 0);
  check("版面", "段均高", `${mean(ts)}px`, `${mean(os_)}px`,
    judge(mean(ts), mean(os_), mean(os_) / (mean(ts) || 1) >= 0.8));

  /* ── 逐段的高度，一段对一段 ────────────────────────────────────────────────
     老板 2026-08-29, holding up 台账 while this checklist reported 0 差异:
     「你自己用眼睛看 一样吗」. It was not. Their Recent Projects is 2198px of tidy
     grid; ours had become 4442px of enormous tiles — TWICE their section — and
     every check passed, because 段均高 is an average and one section at double
     size hides inside it when the others are short.

     An average is not a comparison. Each section is compared to its opposite
     number now, and a section more than 40% out is a failure on its own. */
  /* ── 段落配对：按内容配，不按位置配 ────────────────────────────────────
     ⚠️ 这一段之前是 `ts[i]` 对 `os_[i]` —— 硬按位置。只要我们多一段，从那里
     开始后面全部错位，而尺子照样一段一段比下去。

     招牌 就是活的例子：我们七段、他们六段，我们第6段是**询价表格**，被拿去
     跟他们的**页脚**比。那个「段均高 不及格」有一半是这样造出来的**假差异**，
     同时它把真差异藏起来了 —— 我们的页脚从头到尾没有跟他们的页脚比过。

     一个假差异比没有差异更糟：它会把人送去修一件本来没坏的东西。

     所以配对用序列比对（跟基因序列同一套 DP）：允许一边多出一段，代价是一个
     缺口。相似度看的是**这一段是什么**（几张图 · 几颗钮 · 几栏字 · 相对高度），
     不是它排第几。 */
  const featOf = (sec, shp, total) => ({
    img: sec.img ?? 0,
    btn: (shp ?? []).filter((b) => b.kind === "钮").length,
    col: (shp ?? []).filter((b) => b.kind === "字").length,
    hr: total ? sec.h / total : 0,
  });
  const sim = (a, b) => {
    /* 张数差得越远越不像；高度按比例比，因为两页的总高不一样。 */
    const near01 = (x, y, span) => 1 - Math.min(1, Math.abs(x - y) / span);
    return (
      0.42 * near01(a.img, b.img, 6) +
      0.18 * near01(a.btn, b.btn, 4) +
      0.14 * near01(a.col, b.col, 8) +
      0.26 * near01(a.hr, b.hr, 0.22)
    );
  };
  const pairSections = (T, O, TS2, OS2) => {
    const tot = (l) => l.reduce((x, y) => x + y.h, 0) || 1;
    const A = T.map((x, i) => featOf(x, TS2[i], tot(T)));
    const B = O.map((x, i) => featOf(x, OS2[i], tot(O)));
    const GAP = -0.42;   // 空一段的代价：低於它就宁可配一个不像的
    const m = A.length, n = B.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    const bt = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(""));
    for (let i = 1; i <= m; i++) { dp[i][0] = dp[i - 1][0] + GAP; bt[i][0] = "u"; }
    for (let j = 1; j <= n; j++) { dp[0][j] = dp[0][j - 1] + GAP; bt[0][j] = "l"; }
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const d = dp[i - 1][j - 1] + sim(A[i - 1], B[j - 1]);
        const u = dp[i - 1][j] + GAP;
        const l = dp[i][j - 1] + GAP;
        dp[i][j] = Math.max(d, u, l);
        bt[i][j] = dp[i][j] === d ? "d" : dp[i][j] === u ? "u" : "l";
      }
    }
    const out = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      const move = i === 0 ? "l" : j === 0 ? "u" : bt[i][j];
      if (move === "d") { out.push([i - 1, j - 1]); i--; j--; }
      else if (move === "u") { out.push([i - 1, null]); i--; }
      else { out.push([null, j - 1]); j--; }
    }
    return out.reverse();
  };
  const bodyOf = (l, secsL) => (secsL.length && secsL[0].h < 120 ? l.slice(1) : l);
  const TSHAPE = bodyOf(theirs.shape ?? [], theirs.secs);
  const OSHAPE = bodyOf(ours.shape ?? [], ours.secs);
  const pairs = pairSections(ts, os_, TSHAPE, OSHAPE);
  const paired = pairs.filter(([a, b]) => a !== null && b !== null);
  if (paired.length !== pairs.length) {
    const extraT = pairs.filter(([a, b]) => a !== null && b === null).map(([a]) => a + 1);
    const extraO = pairs.filter(([a, b]) => a === null && b !== null).map(([, b]) => b + 1);
    check("版面", "配得上的段", `${ts.length} 段`, `${os_.length} 段`,
      false);
    if (extraT.length) console.log(`      模版多出来：第 ${extraT.join(" · ")} 段（我们没有对应的）`);
    if (extraO.length) console.log(`      我们多出来：第 ${extraO.join(" · ")} 段（模版没有对应的）`);
  }

  for (const [i, j] of paired) {
    const a = ts[i].h;
    const b = os_[j].h;
    const ok = a === 0 || (b / a >= 0.6 && b / a <= 1.6);
    const name = i === j ? `第${i + 1}段高` : `第${i + 1}段高(配我们第${j + 1}段)`;
    if (!ok) check("版面", name, `${a}px`, `${b}px`, false);
    else marks.push({ axis: "版面", name, ok: true });
  }

  /* ⚠️ 这一项以前数的是 secs 里的 img —— 那是「页面上所有的 <img>」，图标、
     logo、间隔用的透明图全部算进去。而下面「照片 SHOTS」那一段数的是
     ≥120×90 的。同一份报告里两个「一张照片」的定义，印出两个不同的数字。
     一份报告只能有一个定义，取会拍到东西的那个。 */
  check("照片", "照片张数", theirs.shots.length, ours.shots.length,
    near(theirs.shots.length, ours.shots.length, 3));

  /* ── 2 照片 SHOTS —— 大小，不只是张数 ──────────────────────────────────── */
  const band = (l) => ({
    wide: l.filter((x) => (x.share ?? x.w / 1440) >= 0.83).length,
    half: l.filter((x) => (x.share ?? x.w / 1440) >= 0.35 && (x.share ?? x.w / 1440) < 0.83).length,
    small: l.filter((x) => (x.share ?? x.w / 1440) < 0.35).length,
    tallest: l.length ? Math.max(...l.map((x) => x.h)) : 0,
  });
  const bt = band(theirs.shots);
  const bo = band(ours.shots);
  console.log("\n照片 SHOTS");
  check("照片", "满宽的", bt.wide, bo.wide,
    theirs.shots.length && ours.shots.length ? near(bt.wide, bo.wide, 1) : null);
  check("照片", "半幅的", bt.half, bo.half,
    theirs.shots.length && ours.shots.length ? near(bt.half, bo.half, 2) : null);
  /* ±220px 是绝对值：在一张 1000px 的照片上是 22%，在一张 300px 的上是 73%。
     一把在小的地方特别松的尺，正好在最容易出错的地方失效。 */
  check("照片", "最高一张", `${bt.tallest}px`, `${bo.tallest}px`,
    judge(bt.tallest, bo.tallest, Math.abs(bt.tallest - bo.tallest) / (bt.tallest || 1) <= 0.22));
  /* ── 长宽比：一张 4:3 靠着一段字，跟一张 21:9 满边压过去，是两个设计 ──────
     以前只数张数、量宽度跟最高的那一张。「1img」对一张 1440×810 的横幅跟一张
     缩图一样成立，而 16/9 跟 4/3 摆在同一个位子上是两种节奏。
     取中位数，不取平均 —— 一张满边的长条会把平均整个拉走。 */
  const midRatio = (l) => {
    const a = l.map((x) => x.ratio).filter(Boolean).sort((x, y) => x - y);
    return a.length ? a[Math.floor(a.length / 2)] : 0;
  };
  const rt = midRatio(theirs.shots), ro = midRatio(ours.shots);
  check("照片", "长宽比", rt ? rt.toFixed(2) : "量不到", ro ? ro.toFixed(2) : "量不到",
    rt && ro ? Math.abs(rt - ro) <= 0.35 : null);
  console.log(`      模版 ${theirs.shots.slice(0, 7).map((x) => `${x.w}×${x.h}`).join(" ") || "无"}`);
  console.log(`      我们 ${ours.shots.slice(0, 7).map((x) => `${x.w}×${x.h}`).join(" ") || "无"}`);

  /* ── 3 字体 TYPE ───────────────────────────────────────────────────────── */
  const h1 = (t) => (t.heads[0] || {});
  console.log("\n字体 TYPE");
  check("字体", "标题字体", h1(theirs.type).fam ?? "—", h1(ours.type).fam ?? "—", null);
  /* ⚠️ 字体档案在这台机器上载不载得到，直接决定下面三项算的是那一页还是这台
     机器。载不到的时候浏览器退回 Times，量出来的宽窄比讲的是 Times。
     所以先把这件事印出来 —— 一个被降级的量测，不该跟一个正常的量测长得一样。 */
  const loaded = (t) => (t.heads?.[0] ? (t.heads[0].here ? "载到了" : "载不到（退回系统字）") : "—");
  check("字体", "字体档载入", loaded(theirs.type), loaded(ours.type), null);
  /* 渲染层量不到的时候，声明层还答得出来 —— 満図 五格全空就是这一格补上的。 */
  const faceList = (d) =>
    !d ? "量不到"
      : d.faces.length
        ? d.faces.slice(0, 3).map((f) => `${f.fam}${f.wt && f.wt !== "normal" ? " " + f.wt : ""}`).join(" · ") +
          (d.faces.length > 3 ? ` …共${d.faces.length}` : "")
        : d.blocked ? `读不到（${d.blocked} 张跨域）` : "没有 @font-face";
  check("字体", "宣告的字体档", faceList(theirs.declared), faceList(ours.declared), null);
  /* ⚠️ 这一项以前叫「衬线/无衬线」，而它量不了那件事。

     它算的是 width("IHMTEFL") / width("ooeecc") —— 大写那一串比圆的小写那一串
     宽多少。那是**字形的比例**，不是有没有衬线。2026-08-30 差点照它把 台账 的
     标题从衬线换成无衬线：它报「模版 1.21」，而我们手上唯一命中 1.21 的是
     Noto Sans SC（1.24）。原尺寸裁图一看，Newel 的「Recent Projects」R 的脚、
     j 的头都有清楚的衬线 —— **那是一套衬线体，而这个数字说它不是。**

     一个名字说得比它量得多的读数，比没有读数危险：它会被当成它宣称的那件事
     去用。所以改名叫它真正量的东西，并且写下来「衬线要用眼睛看」。 */
  const serif = (t) => Number(t.heads?.[0]?.serifish) || 0;
  const sT = serif(theirs.type), sO = serif(ours.type);
  check("字体", "大写比小写宽", sT ? sT.toFixed(2) : "量不到", sO ? sO.toFixed(2) : "量不到",
    judge(sT, sO, Math.abs(sT - sO) / sT <= 0.09));
  /* 笔画的粗细对比 —— 一笔之内粗细变不变。比例跟墨量都对得上的两套字，
     可以在这一根上差一倍：均匀的黑体接近 1.0，对比强的 1.5 以上。 */
  const ctr = (t) => Number(t.heads?.[0]?.contrast) || 0;
  const cT = ctr(theirs.type), cO = ctr(ours.type);
  check("字体", "笔画对比", cT || "量不到", cO || "量不到",
    judge(cT, cO, Math.abs(cT - cO) / cT <= 0.15));
  /* 小写多高 —— 同一个字级下看起来大一号还是秀气一号，就是这个比例。 */
  const xh = (t) => Number(t.heads?.[0]?.xish) || 0;
  const xT = xh(theirs.type), xO = xh(ours.type);
  check("字体", "小写多高", xT ? xT.toFixed(2) : "量不到", xO ? xO.toFixed(2) : "量不到",
    judge(xT, xO, Math.abs(xT - xO) / xT <= 0.08));
  /* 墨量 —— 画出来真正有多重，不是 font-weight 自称多重。 */
  const ink = (t) => Number(t.heads?.[0]?.inkish) || 0;
  const iT = ink(theirs.type), iO = ink(ours.type);
  check("字体", "墨量", iT ? iT.toFixed(3) : "量不到", iO ? iO.toFixed(3) : "量不到",
    judge(iT, iO, Math.abs(iT - iO) / iT <= 0.16));
  /* 名字判不了（我们不可能用他们的授权字体），字宽判得了。
     窄体跟宽体在同一个字级上是两页不同的东西 —— 招牌 的参考是压缩体。 */
  const wid = (t) => Number(t.heads?.[0]?.widthish) || 0;
  const wt = wid(theirs.type), wo = wid(ours.type);
  check("字体", "标题字宽", wt || "量不到", wo || "量不到",
    wt && wo ? Math.abs(wt - wo) / wt <= 0.12 : null);
  /* 同样：±12px 在 263px 的招牌标题上是 5%，在一个 40px 的标题上是 30%。 */
  check("字体", "标题字级", `${h1(theirs.type).px}px`, `${h1(ours.type).px}px`,
    (() => {
      const a = h1(theirs.type).px || 0, b = h1(ours.type).px || 0;
      return a === 0 ? null : Math.abs(a - b) / a <= 0.12;
    })());
  /* 字距 —— readType 从写出来那天就在收 ls，一行都没有拿它比过。
     它是这一层最看得出来的一件：Toulouse 的店名字距拉到 0.1em 以上，
     一个字距 0 的同名同级同重的标题，看起来是另一个牌子。
     用 em 比不用 px 比 —— 99px 上的 2px 跟 40px 上的 2px 不是同一件事。 */
  const track = (t) => {
    const h = t.heads?.[0];
    const px = Number(h?.px) || 0;
    const ls = Number(h?.ls);
    return px && Number.isFinite(ls) ? +(ls / px).toFixed(3) : null;
  };
  const kT = track(theirs.type), kO = track(ours.type);
  check("字体", "标题字距", kT === null ? "量不到" : `${kT}em`, kO === null ? "量不到" : `${kO}em`,
    kT === null || kO === null ? null : Math.abs(kT - kO) <= 0.015);
  /* ⚠️ 宣告的字重印出来，但不判 —— 「墨量」问的是同一件事，问得更准。
     两个不同的字体，同一个 400 可以差五倍黑（招牌 的参考 0.044 对我们 0.213）；
     而 台账 现在是他们 400、我们 200，画出来 0.093 对 0.094 —— 一样。
     判宣告的那个数字，会把一个**画面已经对上**的页面判成不及格，
     然后把人送去把它改回不一样。判结果，不判宣告。 */
  check("字体", "标题字重", h1(theirs.type).w ?? "—", h1(ours.type).w ?? "—", null);
  /* ── 级差：h2 是 h1 的几分之几 ─────────────────────────────────────────
     h1 量了，h2 没量。而「层级感」不是最大那个字多大，是**大字跟中字差多少**：
     72 → 32 是一个陡的阶梯，72 → 56 是一个平的，两页的 h1 可以一模一样。 */
  const step = (t) => {
    const h1px = Number(t.heads[0]?.px) || 0;
    const h2 = t.heads.slice(1).map((x) => Number(x.px)).filter(Boolean);
    if (!h1px || !h2.length) return 0;
    h2.sort((a, b) => b - a);
    return +(h2[0] / h1px).toFixed(2);
  };
  const st = step(theirs.type), so = step(ours.type);
  check("字体", "级差 h2/h1", st || "量不到", so || "量不到",
    st && so ? Math.abs(st - so) <= 0.16 : null);
  check("字体", "正文字体", theirs.type.bodyFam, ours.type.bodyFam, null);
  if (process.env.ALIGN_DEBUG) {
    console.log("      模版样本 " + (theirs.type.bodySamples || []).join(" | "));
    console.log("      我们样本 " + (ours.type.bodySamples || []).join(" | "));
  }
  /* ⚠️ 样本少於三段就不判。一页上只有两段够长的文字，「最常见的正文字级」量的
     不是这一页的正文，是这两段里比较小的那一个 —— 而它一样会印出一个数字，
     跟一把好尺印出来的一模一样。少於三段本身也是一个读数：这一页几乎没有
     可以读的整段文字，那件事该用眼睛看，不该由这一行冒充回答。 */
  const thinSample = (theirs.type.bodyN ?? 0) < 3 || (ours.type.bodyN ?? 0) < 3;
  /* ── 行距：readType 从写出来那天就收了 bodyLh，没有一行拿它比过 ────────
     它是这个仓库第 N 次「能力有、线没接」。行距是一段字读起来松还是紧，
     跟字级同一个量级的决定：17px/1.4 跟 17px/1.9 是两页不同的东西。 */
  const lh = (t) => {
    const v = parseFloat(t.bodyLh);
    const px = parseFloat(t.bodyPx);
    return v && px ? +(v / px).toFixed(2) : 0;
  };
  const lt = lh(theirs.type), lo = lh(ours.type);
  check("字体", "行距", lt || "量不到", lo || "量不到",
    lt && lo ? Math.abs(lt - lo) <= 0.28 : null);
  /* ── 整页的字级：按**字数**加权的中位数 ────────────────────────────────
     老板 2026-08-30，看着台账的对照图（尺子说只差 5 项）:「你自己看一下」.
     他是对的 —— 那一页读起来比模版淡一号，而每一项检查都过了。

     「正文字级」只取**八个字以上的整段**。一页上占最多字数的那一级往往不是
     整段：清单的每一行、栏位的标签、卡片下面那句说明。台账 实测：

         模版 17px×1066字 · 25px×252 · 16px×223
         我们 15px×612字  · 19px×206 · 16px×179

     「正文字级」抽到的是我们那个 19px 的副标，报 17 对 19，过关；而整页
     真正铺出来的那一级是 15px，从来没有被比过。**页面看起来淡不淡，取决于
     绝大多数的字有多大，不是取决于最长那一段有多大。**

     按字数加权，不按块数：一个 56px 的标题只有 6 个字，不该跟一段 200 字的
     说明一样重。 */
  {
    const bodyOf2 = (l, secsL) => (secsL.length && secsL[0].h < 120 ? l.slice(1) : l);
    const weighted = (cap) => {
      const all = [];
      for (const bs of bodyOf2(cap.shape ?? [], cap.secs))
        for (const b of bs) if (b.kind === "字" && b.px) for (let k = 0; k < (b.n || 1); k++) all.push(b.px);
      if (!all.length) return 0;
      all.sort((a, b) => a - b);
      return all[Math.floor(all.length / 2)];
    };
    const wT = weighted(theirs), wO = weighted(ours);
    check("字体", "整页字级", wT ? `${wT}px` : "量不到", wO ? `${wO}px` : "量不到",
      judge(wT, wO, Math.abs(wT - wO) / wT <= 0.08));
  }
  check("字体", "正文字级", `${theirs.type.bodyPx}px`, `${ours.type.bodyPx}px`,
    thinSample ? null : near(Number(theirs.type.bodyPx) || 0, Number(ours.type.bodyPx) || 0, 3));
  if (thinSample) {
    console.log(`      （够长的整段文字：模版 ${theirs.type.bodyN} 段 · 我们 ${ours.type.bodyN} 段 —— 少於三段，这一项不判）`);
  }
  /* ── 逐段正文字级 ──────────────────────────────────────────────────────
     老板 2026-08-31，裁成原尺寸看第2段：他们的正文读起来明显比我们的大 ——
     **而上面每一项字体检查都是绿的**（整页 17 对 18、正文 17 对 18、
     级差 h2/h1 0.57 对 0.56）。

     因为它们量的是**整页的中位数**，而整页一样、逐段不一样是完全可能的：
     实测台账 —— 第2段两边都是 56/17（真的一样，我眼睛看错了，是他们那段
     文字长七行、我们两行），而**第3段他们的清单是 25px、我们 17px**，
     **第1段他们的副标是一行 28px 的标语、我们是三行 21px 的段落**。
     一页里两段差 8px，中位数一个都没动。

     这跟 align-palette.py 档头写的是同一个错，一字不差：
     「40% 白 25% 深」既可以是白底两条深带，也可以是深底两条白带 ——
     两个数字一样，两个设计相反。**颜色那一轴改成逐段量了，字级没有。**

     量法跟整页那一项同一条规则（按**字数**加权取中位，不是按块），
     只是单位换成一段。差三成以上才点名 —— 一两个像素是内容长短的事。 */
  {
    const bodyOf = (bs) => {
      const t = bs.filter((b) => b.kind === "字" && b.px && b.n);
      if (!t.length) return null;
      const rows = t.map((b) => [b.px, b.n]).sort((a, b) => a[0] - b[0]);
      const tot = rows.reduce((a, r) => a + r[1], 0);
      let acc = 0;
      for (const [px, n] of rows) { acc += n; if (acc >= tot / 2) return px; }
      return rows[rows.length - 1][0];
    };
    /* ⚠️ 有些段里根本没有正文，而这一项叫「正文字级」。
       招牌 第5段：**19 个字，全部 225px**。尺子拿它去比我们那一段的 17px，
       报「225对16px」—— 那不是正文差了 13 倍，那是一边是招牌上的一个词、
       一边是一段说明。同一个形状还有 图纸 第5段（81px）跟 瑞士 第5段（41px）。
       判法：一段的中位字级如果超过**它自己那一页**正文的两倍，那一段就是
       展示型的，没有正文可以比 —— 讲「量不到」，不讲「不一样」。
       ⚠️ 门槛不是拿来调数字的：把它放宽到能盖掉真的差异（招牌第3段 28对17、
       图纸第7段 16对21）就是在买分数。两倍这条线只盖得住「一个词」那一类。 */
    const pageBody = (shp) => {
      const all = [];
      for (const bs of shp ?? []) for (const b of bs)
        if (b.kind === "字" && b.px) for (let k = 0; k < (b.n || 1); k++) all.push(b.px);
      if (!all.length) return 0;
      all.sort((x, y) => x - y);
      return all[Math.floor(all.length / 2)];
    };
    const pbT = pageBody(TSHAPE), pbO = pageBody(OSHAPE);
    const off = [], skipped = [];
    for (const [a, b] of paired) {
      const bt = bodyOf(TSHAPE[a] ?? []), bo = bodyOf(OSHAPE[b] ?? []);
      if (!bt || !bo) continue;
      if ((pbT && bt > pbT * 2) || (pbO && bo > pbO * 2)) { skipped.push(a + 1); continue; }
      if (Math.abs(bt - bo) / bt > 0.3) off.push(`第${a + 1}段 ${bt}对${bo}px`);
    }
    if (skipped.length) console.log(`      （第${skipped.join(" · 第")}段整段是展示型的字，没有正文可以比 —— 不判）`);
    check("字体", "逐段正文字级", off.length ? "不一样" : "每一段都对得上",
      off.length ? off.join(" · ") : "每一段都对得上", off.length === 0);
  }

  if (h1(theirs.type).here === false) {
    console.log("      ⚠️ 模版的字这台机器没载入到 —— 上面那两行字体名是宣告的，不是画面上的");
  }

  /* ── 4 颜色 COLOR —— 面积，不是声明次数 ───────────────────────────────── */
  /* ── 结构 SHAPE：一段里面有哪些盒子，一段对一段 ──────────────────────────
     老板 2026-08-29: 「是准确了 可是还不是100%」. 剩下的每一个差异都在一段的
     里面，而上面每一项量的都是一段的外面。readShape 的注解写了那五个实例。

     判什么：这一段有几个图 / 几颗按钮 / 几栏字，配对得上的那些左右位置差多少。
     不判什么：好不好看、字写什么、照片拍的是什么。 */
  /* ⚠️ 这一项以前只印不判，而且**没有写理由** —— 另外两个只印不判的（段数 ·
     标题字重）都写着「同一个问题下面那一项问得更准」，这一项什么都没有。
     报告尾巴自己警告过「量不到不是过关，下一个差异就藏在那几项里」，
     而它印出来的正是一个真差异：**模版 没有圆角 · 我们 5.1px ×7**。
     台账 抄的那一页是方角的，我们七个元素是圆的 —— 眼睛看得到，没有人判。

     判法：把「没有圆角」读成 0，差 2px 以内算同一个决定。
     两边都量不到就回 null（judge 会处理），不算过关。 */
  {
    const rad = (d) => {
      const v = d?.radius;
      if (!v) return null;
      if (String(v).includes("没有圆角")) return 0;
      const m = String(v).match(/([0-9.]+)px/);
      return m ? Number(m[1]) : null;
    };
    const rT = rad(theirs.declared), rO = rad(ours.declared);
    /* ⚠️ 这里**不能用 `judge()`**：它把 0 当成「量不到」，而那对张数、字级是对的
       （0 张照片多半是没量到），对圆角是错的 —— **0 是一个真的读数：方角**。
       台账 的参考正好是 0，第一版套了 judge，整项就静静回到「量不到」。
       同一个 0，在不同的轴上意思不一样；一个通用的「空值」规则挡不住这件事。 */
    check("结构", "最常用的圆角", theirs.declared?.radius ?? "量不到", ours.declared?.radius ?? "量不到",
      rT === null || rO === null ? null : Math.abs(rT - rO) <= 2);
  }

  console.log("\n结构 SHAPE  （一段里面有哪些盒子，图 · 钮 · 字）");
  {
    /* ── 尺子的自检：分段之后，照片有没有掉在段外 ────────────────────────
       老板 2026-08-30: 「重点是都还没修好那个尺子 尺子都不准怎么去量」.

       今天两个洞是同一个形状：**页面上真的有那个东西，而分段之后它不在任何
       一段里**。一个是 CSS 背景图，一个是「被包住就丢掉」的兄弟层。两个都不是
       想出来的，是准备照着报告改页面的时候才撞到的。

       所以不再靠撞：readShots 数这一页有几张够大的照片，readShape 数分段之后
       各段里装了几张。对不上就是有东西掉在段外 —— 那一块的每一项读数都是错的，
       而它印出来跟对的一模一样。

       ⚠️ 它只查得到「图」。字跟按钮掉了它看不见 —— 写清楚，不要拿它当成
       「什么都没漏」的证明。 */
    /* ⚠️ 两项都是**永远印**，绿的也印。
       2026-08-31：六套跑完，六份报告里一个「漏字」「漏图」都没有 —— 而那两句
       长得跟「量过了，没漏」一模一样，也跟「这两项根本没跑」一模一样。
       任务 81 那一次就是这样过去的：**一把量不到的尺回报的是沉默，不是警报。**
       自检自己变成沉默的那一刻，它就不再是自检了。 */
    /* 只数够得上 readShots 那道门槛（120×90）的 —— 两边要数同一群东西，
       否则差额讲的是「两把尺不一样」，不是「这一页漏了什么」。 */
    /* 载不出来的图，永远印，绿的也印 —— 见 shoot() 里那段注解。 */
    for (const [who, cap] of [["模版", theirs], ["我们", ours]]) {
      const bk = cap.broken;
      if (!Array.isArray(bk)) {
        console.log(`  --  ${who}载不出来的图  这份采集是旧的，没有这一栏 —— 加 --refresh 重新采集`);
        marks.push({ axis: "结构", name: `${who}载不出来的图`, ok: null });
      } else if (bk.length) {
        console.log(`  XX  ${who}载不出来的图  ${bk.length} 张 —— 每一项跟图有关的读数都被它拉走`);
        for (const b of bk.slice(0, 4)) console.log(`      ${b.w}×${b.h}  …${b.src}`);
        marks.push({ axis: "结构", name: `${who}载不出来的图`, ok: false });
      } else {
        console.log(`  OK  ${who}载不出来的图  0 张`);
        marks.push({ axis: "结构", name: `${who}载不出来的图`, ok: true });
      }
    }
    const bigPic = (b) => b.kind === "图" && (b.pw ?? 999) >= 120 && (b.ph ?? 999) >= 90;
    const inBoxes = (shp) => (shp ?? []).reduce((n2, bs) => n2 + bs.filter(bigPic).length, 0);
    for (const [who, cap] of [["模版", theirs], ["我们", ours]]) {
      const all = cap.shots.length;
      const held = inBoxes(cap.shape);
      /* ⚠️ 两个方向都要问。
         2026-08-31 这两句刚改成绿的也印，招牌第一次跑就吐出「这一页 14 张，
         各段装下 15 张」——**装下的比整页有的还多**。一张图跨在段界上，被上下
         两段各算一次。原本的判断是 `all - held > 1`，负的那一边永远是绿的。
         重复算不是小数点问题：它代表分段**不是一个乾净的切分**，而每一段的
         「几栏 · 顺序 · 底色」全部建立在「这一段装了哪些盒子」上面。 */
      const okImg = all - held <= 1 && held - all <= 1;
      /* 两个方向讲的是两件事，而且「多出来」有两个可能的原因，尺子分不出来 ——
         所以只讲**读数**，不讲**原因**。（写死一个猜出来的原因，正是上一版
         把「图标被算进去」讲成「段界穿过它」的那次。） */
      const why = held > all ? ` —— 多算了 ${held - all} 张：段界穿过它，或者同一块地方被数了两次`
        : all > held ? ` —— ${all - held} 张掉在段外` : "";
      console.log(`  ${okImg ? "OK" : "XX"}  ${who}分段漏图  这一页 ${all} 张，各段装下 ${held} 张${why}`);
      marks.push({ axis: "结构", name: `${who}分段漏图`, ok: okImg });

      /* 字才是页面上的大面积。图漏一张看得出来，字漏一整段看不出来 ——
         它只会让「几栏」「顺序」「版心」全部小一号，每一项都还是印得像真的。 */
      const chAll = cap.chars || 0;
      const chHeld = (cap.shape ?? []).reduce(
        (n2, bs) => n2 + bs.reduce((m, b) => m + (b.kind === "字" ? b.n || 0 : 0), 0), 0);
      if (chAll <= 400) {
        /* 一页不到 400 个字，比例算不准 —— 说「量不到」，不要说「没漏」。 */
        console.log(`  --  ${who}分段漏字  这一页只有 ${chAll} 个字 —— 太少，比例不判`);
        marks.push({ axis: "结构", name: `${who}分段漏字`, ok: null });
      } else {
        const pct = Math.round((chHeld / chAll) * 100);
        const okCh = chHeld / chAll >= 0.8;
        console.log(`  ${okCh ? "OK" : "XX"}  ${who}分段漏字  这一页 ${chAll} 个字，各段装下 ${chHeld} 个（${pct}%）`
          + (okCh ? "" : ` —— 漏了 ${100 - pct}%`));
        marks.push({ axis: "结构", name: `${who}分段漏字`, ok: okCh });
      }
    }
  }
  {
    const TS = TSHAPE;
    const OS = OSHAPE;
    const line = (bs) =>
      bs
        .slice(0, 9)
        .map((b) => (b.kind === "钮" ? `钮${b.rad}` : b.kind) + ` ${b.x0}–${b.x1}`)
        .join("  ") || "（空）";
    const count = (bs, k) => bs.filter((b) => b.kind === k).length;
    /* ── 版心：内容从页面的百分之几开始，到百分之几结束 ──────────────────
       这一条是这把尺第一次跑就抓到的、而且最大的一件：瑞士 整页的内容跑
       7%–93%，我们 14%–86%。两边各差 7 个点，那不是某一段的事，是版心
       本身窄了 200px。段高一样、张数一样、字级一样，所以以前每一项都过。 */
    /* ⚠️ 满边的段要拿出来另外算。
       一段铺满整页（0%–100%）是一个设计决定，不是「版心很宽」。混在一起取
       中位数，台账 就回报「我们 0%–100%」—— 那讲的是它有一半的段是满边的，
       不是它的版心。两件事，两行。 */
    const isBleed = (bs) => Math.min(...bs.map((b) => b.x0)) <= 2 && Math.max(...bs.map((b) => b.x1)) >= 98;
    const bleeds = (SS) => SS.filter((bs) => bs.length && isBleed(bs)).length;
    const edge = (SS) => {
      const l = [], r = [];
      for (const bs of SS) {
        if (!bs.length || isBleed(bs)) continue;
        l.push(Math.min(...bs.map((b) => b.x0)));
        r.push(Math.max(...bs.map((b) => b.x1)));
      }
      if (!l.length) return null;
      l.sort((a, b) => a - b); r.sort((a, b) => a - b);
      return [l[Math.floor(l.length / 2)], r[Math.floor(r.length / 2)]];
    };
    const et = edge(TS), eo = edge(OS);
    check("结构", "版心", et ? `${et[0]}%–${et[1]}%` : "全部满边", eo ? `${eo[0]}%–${eo[1]}%` : "全部满边",
      et && eo ? Math.abs((et[1] - et[0]) - (eo[1] - eo[0])) <= 6 : null);
    check("结构", "满边的段", `${bleeds(TS)}/${TS.length}`, `${bleeds(OS)}/${OS.length}`,
      Math.abs(bleeds(TS) - bleeds(OS)) <= 1);

    /* 用同一份配对 —— 结构以前也是按位置比的，招牌 的询价表格被拿去跟他们的
       页脚比结构，比出来的每一条都是假的。 */
    for (const [pi, pj] of pairs) {
      const t = pi === null ? null : TS[pi];
      const o = pj === null ? null : OS[pj];
      const i = pi ?? pj;
      const tag = pi !== null && pj !== null && pi !== pj ? `第${pi + 1}段(配我们第${pj + 1}段)` : `第${(pi ?? pj) + 1}段`;
      if (!t || !o) {
        console.log(`  --  ${tag}  ` + (!t ? "模版没有这一段" : "我们没有这一段"));
        marks.push({ axis: "结构", name: `${tag}结构`, ok: null });
        continue;
      }
      /* 一段里几十栏字是内容长短的事，不是设计的事 —— 只判图跟按钮的个数，
         字那一栏印出来给眼睛看。张数差一个之内算对上：一张图被包成两个盒子、
         或者他们多一行小字，都不该判成「结构不同」。 */
      const dImg = Math.abs(count(t, "图") - count(o, "图"));
      const dBtn = Math.abs(count(t, "钮") - count(o, "钮"));
      /* 圆角是形状不是装饰：方角的按钮跟药丸是两个设计（重点 7c）。 */
      const rads = (bs) => [...new Set(bs.filter((b) => b.kind === "钮").map((b) => b.rad))].sort().join("");
      const dRad = count(t, "钮") && count(o, "钮") && rads(t) !== rads(o);
      /* 最宽的那张图占这一段多宽 —— 满边（≥96%）跟缩在版心里（≈90%）
         是两个决定，而两个都不改变段高，所以上面每一项都看不到。 */
      const widest = (bs) => bs.filter((b) => b.kind === "图").reduce((m, b) => Math.max(m, b.x1 - b.x0), 0);
      const dSpan = widest(t) && widest(o) ? Math.abs(widest(t) - widest(o)) : 0;
      /* ── 顺序 ────────────────────────────────────────────────────────────
         ⚠️ 上面每一项都在数「有几个」，没有一项在问「什么顺序」。

         中台 第1段就是这样跑掉的：他们是 标题 → 一排资料 → 满边照片，我们是
         标题 → 照片 → 一排资料。张数一样、圆角一样、最宽的图一样宽 —— 六项
         全绿，而那是两个不同的开场。**顺序就是设计**，我是裁图用眼睛看出来的。

         把这一段里的盒子按上下排好，只留种类，连着的同种压成一个：
           模版 字→钮→图    我们 字→图→钮
         比的是这一串。连着的压成一个是必要的 —— 一段里有六行字是内容长短的
         事，不是设计的事。 */
      /* ⚠️ 并排的两块没有先后，而按 y0 精确排序会给它们一个。
         台账 第3段：他们的照片跟标题并排，照片的顶比标题高几个像素，於是
         他们排出「图→字」，我们排出「字→图」—— 同一个设计，两个顺序，
         尺子判不及格。那不是页面的差别，是排序规则在挑边。

         ⚠️ 第一版是「每 6 个百分点归成一行」，而它**没有修好这一条** ——
         2026-08-31 同一段又判一次不及格：他们 图 y0=0 · 字 y0=6（两个桶），
         我们 图 y0=3 · 字 y0=3（同一个桶）。**同一个设计，两个答案**，
         差别只在他们的照片比标题高了 6%。一个固定的桶宽，永远会有一对
         刚好跨在桶边上的东西。

         所以改成问**它们的垂直范围有没有重叠** —— 那才是「并排」的定义，
         而且没有边界可以跨。一张跟整栏文字一样高的照片会跟每一行都重叠，
         於是整块并成一行、按左右读 —— 那正是眼睛读它的方式：先左栏，再右栏。 */
      const seqOf = (bs) => {
        const rows = [];
        for (const b of [...bs].sort((a, b2) => a.y0 - b2.y0)) {
          const hit = rows.find((r) => {
            const over = Math.min(r.y1, b.y1) - Math.max(r.y0, b.y0);
            return over > Math.min(r.y1 - r.y0, b.y1 - b.y0) * 0.5;
          });
          if (hit) { hit.y0 = Math.min(hit.y0, b.y0); hit.y1 = Math.max(hit.y1, b.y1); hit.bs.push(b); }
          else rows.push({ y0: b.y0, y1: b.y1, bs: [b] });
        }
        const ks = rows
          .sort((a, b2) => a.y0 - b2.y0)
          .flatMap((r) => r.bs.sort((a, b2) => a.x0 - b2.x0))
          .map((b) => b.kind);
        return ks.filter((k, i) => k !== ks[i - 1]);
      };
      const sq = seqOf(t), so2 = seqOf(o);
      /* 编辑距离 —— 差一步（多一块或少一块）还算同一个顺序，差两步不算。 */
      const editDist = (a, b) => {
        const m = a.length, n = b.length;
        const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
        for (let j = 0; j <= n; j++) d[0][j] = j;
        for (let i = 1; i <= m; i++)
          for (let j = 1; j <= n; j++)
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        return d[m][n];
      };
      const dSeq = editDist(sq, so2);

      /* ── 有几栏字 ────────────────────────────────────────────────────────
         同样从来没判过。一段两栏字跟一段六栏字是两个排版，而「字」这个种类
         印在报告里、没有一行拿它比过。容差放宽一点（±2）：字块的边界会被
         包装层切开，不像图跟按钮那么干净。 */
      const dCol = Math.abs(count(t, "字") - count(o, "字"));

      const bad = [];
      if (dImg > 1) bad.push(`图 ${count(t, "图")}对${count(o, "图")}`);
      if (dBtn > 1) bad.push(`钮 ${count(t, "钮")}对${count(o, "钮")}`);
      if (dRad) bad.push(`钮的圆角 ${rads(t)}对${rads(o)}`);
      if (dSpan > 12) bad.push(`最宽的图 ${widest(t)}%对${widest(o)}%`);
      if (dSeq > 1) bad.push(`顺序 ${sq.join("→") || "空"} 对 ${so2.join("→") || "空"}`);
      /* ── 几栏 ──────────────────────────────────────────────────────────
         「几栏字」数的是文字**块**，而一栏字会被包装层切成好几块，两边切法
         不一样，所以那个数字判不了（下面留着只印不判）。

         真正想问的是「这一段分成几栏」，而那个问得准：把所有盒子的**左边缘**
         聚起来，相差 5 个百分点以内算同一栏。三栏卡片就是三个左边缘，不管
         每张卡里被切成几块。 */
      const colsOf = (bs) => {
        const xs = [...new Set(bs.map((b) => b.x0))].sort((a, b2) => a - b2);
        const seeds = [];
        for (const x of xs) if (!seeds.some((v) => Math.abs(v - x) <= 5)) seeds.push(x);
        return seeds.length;
      };
      const cT = colsOf(t), cO = colsOf(o);
      if (Math.abs(cT - cO) > 1) bad.push(`几栏 ${cT}对${cO}`);

      /* ⚠️ 「几栏字」印出来，但**先不判**。
         一栏字在 DOM 里会被包装层切成好几块，两边的切法不一样：満図 第1段
         报「2 对 9」、第6段报「10 对 3」，而那两段用眼睛看栏数是一样的。
         一个量不准的数字拿去判，制造的是假差异 —— 而假差异比没有差异更糟，
         它会把人送去改一件本来没坏的东西。
         等 merged 那一段的合并规则够准了再打开。 */
      void dCol;
      const ok = bad.length === 0;
      console.log(`  ${ok ? "OK" : "XX"}  ${tag}  ${ok ? "" : "← " + bad.join(" · ")}`);
      console.log(`        模版 ${line(t)}`);
      console.log(`        我们 ${line(o)}`);
      /* `--why`：这一段不及格的时候，把每个盒子连同**它是哪个元素**一起印。
         没有这一行，「第4段结构 XX」只讲得出「有几个盒子」，讲不出「是谁」——
         而每一次追下去我都要另外手写一支探针。名字印出来，改哪一个当场就知道。 */
      if (WHY && !ok) {
        const dump = (lbl, bs) => {
          console.log(`        ── ${lbl} ──`);
          for (const b of bs)
            console.log(`           ${(b.kind === "钮" ? "钮" + b.rad : b.kind).padEnd(3)} x ${String(b.x0).padStart(3)}–${String(b.x1).padStart(3)}  y ${String(b.y0).padStart(3)}–${String(b.y1).padStart(3)}${b.px ? "  " + b.px + "px×" + (b.n ?? 0) : ""}  ${b.sel ?? "—"}`);
        };
        /* ⚠️ 存下来的参考快照可能比 `sel` 这个字段旧 —— 那时候印出来是一整栏
           「—」，读起来像「他们那些元素没有身分」，而其实是**这份快照太旧**。
           一个看起来像读数的空值，跟一个错的读数一样会误导人。 */
        if (t.length && t.every((b) => !b.sel))
          console.log("        （模版那一栏的元素名是空的 —— 存下来的参考比这个字段旧，跑一次 --refresh）");
        dump("模版", t);
        dump("我们", o);
      }
      marks.push({ axis: "结构", name: `${tag}结构`, ok });
    }
  }

  /* ── 颜色，逐段量，而且判在同一张表里 ────────────────────────────────────
     老板 2026-08-28: 「就是每个颜色 分段去测量」.

     Two holes closed at once. Colour used to be PRINTED and never judged — and
     colour is exactly where four registers went out with matching section
     counts and a different page. And a whole-page average can match while every
     section is wrong: 40% white / 25% dark is equally true of 「a white page
     with two dark bands」 and of 「a dark page with two white bands」, which are
     opposite designs. So the unit is the SECTION, and the verdict lands here
     rather than in a second command nobody runs. */
  try {
    /* ── 照片铺满的那一段，底色是那张照片的，不是这一页设计的 ──────────────
       老板 2026-08-30 这一轮量到：台账 第1段「模版 #3c3228 13% · 我们 #78786e
       5.2%」。那两个颜色一个是他们那栋暖色建筑，一个是我们那间灰厨房 ——
       **比的是两张不同的照片，不是两个不同的设计。** 而且两边的占比都只有
       5–13%，因为一张照片根本没有主色。

       所以照片盖过八成的段，逐段底色回报「看照片」，不判。这不是放水：
       那一格本来就答不了它宣称在答的问题。 */
    const photoLed = new Set();
    {
      const TS2 = TSHAPE, OS2 = OSHAPE;
      const cover = (bs) =>
        bs.filter((b) => b.kind === "图").reduce((m, b) => m + ((b.x1 - b.x0) * (b.y1 - b.y0)) / 100, 0);
      for (const [a, b] of paired) {
        if (cover(TS2[a] ?? []) >= 80 || cover(OS2[b] ?? []) >= 80) photoLed.add(a);
      }
    }
    const pairArg = paired.map(([a, b]) => `${a}:${b}`).join(",");
    const skipArg = [...photoLed].join(",");
    const out = execSync(`python scripts/align-palette.py ${register} --pairs=${pairArg} --photo=${skipArg}`, {
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    console.log("\n颜色 COLOR  （逐段量截图，按铺出来的面积）");
    for (const raw of out.split("\n")) {
      const line = raw.trimEnd();
      if (!line.trim()) continue;
      console.log("  " + line.trim());
      /* ⚠️ 这一行本来写的是 \\s —— 在正则里那是「一个反斜线接一个 s」，
         永远不匹配。於是**逐段颜色的判定从来没有进过总数**：画面上一整排 XX，
         最后那一行结论当它不存在。一把印出差异却不把它算进去的尺比不印更糟 ——
         它同时给了两个答案，而人只会读最后那一行。 */
      const m = /^(OK|XX|--)\s+第(\d+)段/.exec(line.trim());
      if (m) marks.push({ axis: "颜色", name: `第${m[2]}段底色`, ok: m[1] === "OK" ? true : m[1] === "--" ? null : false });
      /* 深浅分布那两行也要进帐 —— 印出来而不判，正是这把尺以前的毛病。 */
      const g = /^(OK|XX)\s+(对比跨度|有颜色的面积)/.exec(line.trim());
      if (g) marks.push({ axis: "颜色", name: g[2], ok: g[1] === "OK" });
    }
  } catch (e) {
    console.log("\n颜色 COLOR  量不到 —— align-palette.py 跑不起来：" + String(e).slice(0, 90));
    marks.push({ axis: "颜色", name: "逐段底色", ok: null });
  }
  console.log("\n颜色 COLOR  （声明层，仅供参考）");
  const stack = (a) => {
    if (!a) return "—";
    const by = {};
    for (const c of a.colours) (by[c.layer] = by[c.layer] || []).push(c.hex);
    return ["infrastructure", "system"].filter((l) => by[l]).map((l) => `${l}: ${by[l].slice(0, 4).join(" ")}`).join(" | ");
  };
  console.log(`      模版 ${stack(theirs.axes)}`);
  console.log(`      我们 ${stack(ours.axes)}`);

  /* ── 5 动效 MOTION ─────────────────────────────────────────────────────── */
  const tiers = (a) => (a ? a.motion.tiers.map((x) => `${x.tier}${x.ms.join("/")}`).join(" ") : "—");
  const ease = (a) => (a && a.motion.easings[0] ? a.motion.easings[0][0] : "—");
  /* ⚠️ 比「最常出现的那一档」，不是比最长的那一档。台账的参考页有一个 600ms 的
     过渡出现十次，跟 200/300ms 出现六十八次 —— 拿最长的去比，我们把主要那一档
     调成跟他们一样之后反而被判成对不上。一页的动效是它重复最多的那个长度。 */
  const dominant = (a) => {
    if (!a || !a.motion.tiers.length) return 0;
    const top = [...a.motion.tiers].sort((x, y) => y.n - x.n)[0];
    return top.ms[Math.floor(top.ms.length / 2)] ?? 0;
  };
  console.log("\n动效 MOTION");
  check("动效", "时长", tiers(theirs.axes), tiers(ours.axes),
    judge(dominant(theirs.axes), dominant(ours.axes), near(dominant(theirs.axes), dominant(ours.axes), 90)));
  check("动效", "缓动", ease(theirs.axes), ease(ours.axes),
    judge(ease(theirs.axes), ease(ours.axes), ease(theirs.axes) === ease(ours.axes)));
  check("动效", "减少动效", theirs.axes?.motion.reducedMotion, ours.axes?.motion.reducedMotion,
    theirs.axes && ours.axes
      ? Boolean(theirs.axes.motion.reducedMotion) === Boolean(ours.axes.motion.reducedMotion)
      : null);

  /* 上面三项读的是**宣告**，下面三项读的是**真的动了什么**。
     一条挂在从来不变的属性上的 400ms transition，跟一段真的会滑进来的区块，
     在上面三项里印出来一模一样。 */
  {
    const t = theirs.move, o = ours.move;
    const enter = (m) =>
      !m ? "量不到" : m.entered === 0 ? `不动（试了 ${m.probed} 块）` : `${m.entered}/${m.probed} 块 · 位移 ${m.maxShift}px${m.faded ? " · 淡入" : ""}`;
    /* 判「有没有」而不是「几块」—— 块数是这一页有多少区段的事。
       位移差 20px 以内算同一种进场：24 跟 32 是同一个手势，24 跟 0 不是。 */
    const has = (m) => Boolean(m && m.entered > 0);
    check("动效", "滚动进场", enter(t), enter(o),
      t && o ? has(t) === has(o) && (!has(t) || Math.abs(t.maxShift - o.maxShift) <= 20) : null);
    check("动效", "有影片", theirs.vids ?? "量不到", ours.vids ?? "量不到",
      theirs.vids === undefined || ours.vids === undefined ? null : theirs.vids === ours.vids);
    check("动效", "按钮 hover", t?.btn ?? "量不到", o?.btn ?? "量不到",
      t?.btn && o?.btn ? t.btn === o.btn : null);
    check("动效", "图片 hover", t?.img ?? "量不到", o?.img ?? "量不到",
      t?.img && o?.img ? t.img === o.img : null);
    check("动效", "卡片 hover", t?.card ?? "量不到", o?.card ?? "量不到",
      t?.card && o?.card ? t.card === o.card : null);
    check("动效", "连结 hover", t?.link ?? "量不到", o?.link ?? "量不到",
      t?.link && o?.link ? t.link === o.link : null);
  }

  /* ── 手机 390 ────────────────────────────────────────────────────────────
     老板 2026-08-29: 「你到9都要」. 第九件，而且是最该做的一件。

     上面每一项都是在 1440 量的。他自己量过的 19 家马来西亚 SME 里 **15 家第一
     屏就给 WhatsApp**，因为客人在手机上；`check:reachable` 也在 390 报过我们
     自己官网三个控件点不到。他们那些模版在 390 是**另一套排版** —— 栏数、图的
     比例、按钮位置全部换 —— 而我们照抄的一直只有桌面那一套。

     只量最决定性的四件：几段、整页多高、内容左右占多宽、最宽的一张图多宽。
     其余的留给眼睛看 <风格>-ours-390.jpg。 */
  console.log(String.fromCharCode(10) + "手机 390");
  {
    const tp = theirsPhone, op = oursPhone;
    if (!tp || !op) {
      check("手机", "手机 390px", "量不到", "量不到", null);
    } else {
      const bodyP = (l, secsL) => (secsL.length && secsL[0].h < 120 ? l.slice(1) : l);
      const tsP = bodyP(tp.secs, tp.secs), osP = bodyP(op.secs, op.secs);
      const sumP = (l) => l.reduce((a, x) => a + x.h, 0);
      check("手机", "手机 段数", tsP.length, osP.length, near(tsP.length, osP.length, 1));
      check("手机", "手机 整页高", `${sumP(tsP)}px`, `${sumP(osP)}px`,
        near(sumP(tsP), sumP(osP), sumP(tsP) * 0.3));
      const edgeP = (SS) => {
        const l = [], r = [];
        for (const bs of SS) {
          if (!bs.length) continue;
          l.push(Math.min(...bs.map((b) => b.x0)));
          r.push(Math.max(...bs.map((b) => b.x1)));
        }
        if (!l.length) return null;
        l.sort((a, b) => a - b); r.sort((a, b) => a - b);
        return [l[Math.floor(l.length / 2)], r[Math.floor(r.length / 2)]];
      };
      const et = edgeP(bodyP(tp.shape ?? [], tp.secs));
      const eo = edgeP(bodyP(op.shape ?? [], op.secs));
      check("手机", "手机 版心", et ? `${et[0]}%–${et[1]}%` : "量不到", eo ? `${eo[0]}%–${eo[1]}%` : "量不到",
        et && eo ? Math.abs((et[1] - et[0]) - (eo[1] - eo[0])) <= 8 : null);
      const widestP = (l) => (l.length ? Math.max(...l.map((x) => x.w)) : 0);
      check("手机", "手机 最宽的图", `${widestP(tp.shots)}px`, `${widestP(op.shots)}px`,
        judge(widestP(tp.shots), widestP(op.shots), near(widestP(tp.shots), widestP(op.shots), 90)));
      check("手机", "手机 照片张数", tp.shots.length, op.shots.length, near(tp.shots.length, op.shots.length, 3));
    }
  }

  /* ── 6 留白 SPACE ──────────────────────────────────────────────────────── */
  const gaps = (secs) => secs.slice(1).map((s2, i2) => s2.top - (secs[i2].top + secs[i2].h));
  const biggestGap = (secs) => Math.max(0, ...gaps(secs).filter((g) => g >= 0));
  console.log("\n留白 SPACE");
  check("留白", "段间最大", `${biggestGap(theirs.secs)}px`, `${biggestGap(ours.secs)}px`,
    near(biggestGap(theirs.secs), biggestGap(ours.secs), 24));
  const inset = (l) => (l.length ? Math.min(...l.map((x) => x.pad ?? 0)) : 0);
  /* ── 段内的气：一段里内容上下各留多少 ──────────────────────────────────
     这一项换掉了「间距基数」，而换掉的理由是量出来的（2026-08-29）。

     基数那一项六套全部回报「量不到」，我原本以为是尺子写坏了。把样本印出来
     才知道是问题本身错了：

       模版（Wix）  15×9  7×8  10×8  27×7  11×6  20×6  32×6  4×4  24×4  8×2  12×2  31×2
       我们         20×19 8×14 96×12 11×8  10×6  31×6  6×4  24×3  9×2  16×2  18×2  23×2

     15 · 7 · 27 · 11 · 31 不是任何东西的倍数。Wix 是**拖出来的**，不是照阶梯
     排出来的，所以那一页根本没有基数。design-md-generator 报得出「基数 4」是
     因为它读**写在 CSS 里的值**；我们读**算出来的值**，而 rem 乘根字号跟
     百分比的行会算出 11 跟 31。同一根轴，两个不同的问题。

     留白在这种页面上真正的决定是：**一段里，内容的上下各空掉这一段的百分之
     几**。它是设计的一部分（他们的 Our Story 是一句话浮在一大片气里），而且
     两边可比 —— readShape 已经把每个盒子相对这一段的 y 位置量出来了。 */
  {
    const bodyAir = (l, secsL) => (secsL.length && secsL[0].h < 120 ? l.slice(1) : l);
    const air = (SS) => {
      const top = [], bot = [];
      for (const bs of SS) {
        if (bs.length < 2) continue;
        top.push(Math.max(0, Math.min(...bs.map((b) => b.y0))));
        bot.push(Math.max(0, 100 - Math.max(...bs.map((b) => b.y1))));
      }
      if (!top.length) return null;
      const mid = (a) => { a.sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
      return [mid(top), mid(bot)];
    };
    /* ── 段内的缝：并排的两块之间留多少 ──────────────────────────────────
       中台 抄的那一页，档头第一句就是「两张照片边到边、**中间没有缝**」，
       而尺子从来没有一项在量缝。留白量的是段跟段之间、段内上下的气，
       并排那一轴一直是空的 —— 而「有没有缝」正是照片墙读起来是一整块
       还是一叠卡片的分界。

       量法：同一行（y0 相差 6 个百分点以内）的相邻两块，右边缘到下一块
       左边缘的距离，取中位数。 */
    const seam = (SS) => {
      const gaps = [];
      for (const bs of SS) {
        const rows = new Map();
        for (const b of bs) {
          const key = Math.round(b.y0 / 6);
          if (!rows.has(key)) rows.set(key, []);
          rows.get(key).push(b);
        }
        for (const row of rows.values()) {
          if (row.length < 2) continue;
          row.sort((a, b2) => a.x0 - b2.x0);
          for (let i = 1; i < row.length; i++) {
            const g = row[i].x0 - row[i - 1].x1;
            if (g >= 0 && g <= 40) gaps.push(g);
          }
        }
      }
      if (!gaps.length) return null;
      gaps.sort((a, b) => a - b);
      return gaps[Math.floor(gaps.length / 2)];
    };
    const gT = seam(bodyAir(theirs.shape ?? [], theirs.secs));
    const gO = seam(bodyAir(ours.shape ?? [], ours.secs));
    check("留白", "段内的缝", gT === null ? "量不到" : `${gT}%`, gO === null ? "量不到" : `${gO}%`,
      gT === null || gO === null ? null : Math.abs(gT - gO) <= 3);

    const at = air(bodyAir(theirs.shape ?? [], theirs.secs));
    const ao = air(bodyAir(ours.shape ?? [], ours.secs));
    check("留白", "段内的气", at ? `上 ${at[0]}% 下 ${at[1]}%` : "量不到", ao ? `上 ${ao[0]}% 下 ${ao[1]}%` : "量不到",
      at && ao ? Math.abs(at[0] - ao[0]) <= 8 && Math.abs(at[1] - ao[1]) <= 8 : null);
    if (process.env.ALIGN_DEBUG) {
      const show = (a) => (a?.space.sample ?? []).map(([v, n]) => `${v}×${n}`).join(" ");
      console.log("      间距样本 模版 " + show(theirs.axes));
      console.log("      间距样本 我们 " + show(ours.axes));
    }
  }

  /* ── 结论 ──────────────────────────────────────────────────────────────── */
  const bad = marks.filter((m) => m.ok === false);
  const unknown = marks.filter((m) => m.ok === null);
  console.log(
    `\n对不上的 ${bad.length} 项：${bad.map((b) => b.name).join(" · ") || "无"}` +
      `\n量不到的 ${unknown.length} 项：${unknown.map((b) => b.name).join(" · ") || "无"}` +
      `\n⚠️ 「量不到」不是「过关」—— 下一个差异就藏在那几项里。`,
  );

  fs.writeFileSync(
    `${OUT}/${register}.json`,
    JSON.stringify({ url, theirs, ours, pairs, marks }, null, 1),
  );

  /* 差异图 —— 只贴判 XX 的那几段，而且在图上把盒子画出来。
     尺子说哪里不对，这一张说它长什么样；重点 3 说最后判的是这一张。 */
  try {
    const out = execSync(`python scripts/align-diff.py ${register}`, {
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    const LF = String.fromCharCode(10);
    console.log(out.trim().split(LF).map((l) => "  " + l.trimEnd()).join(LF));
  } catch (e) {
    console.log("  差异图出不来：" + String(e).slice(0, 90));
  }

  /* ── 验收：清单全绿不算做完 ────────────────────────────────────────────
     老板 2026-08-30:「就是往尺子那边加多一段话就是验收成果 一定要用眼睛去看」.

     这一段不是装饰，是当天付了学费的。台账 第6段那一次：清单上它是**绿的**
     —— 盒子的种类对、顺序对、几栏对。裁成原尺寸一看，他们那一段是**一个有框
     的盒子从中间切两半、右半自己一块深色面板、中间一条通到底的竖线**，我们是
     两栏并排。同一份报告，一个说过关，一个说完全不是同一个设计。

     **尺子量得到「有几个盒子、什么顺序」，量不到「这是一个框里切两半还是两栏
     并排」。** 那一格它连一个可疑的数字都没有给。

     所以每一段都要自己开原尺寸的裁图看过，才准说做完。 */
  const secN = bodySecs(ours.secs).length;
  console.log("");
  console.log("验收 —— 上面全绿也不算做完");
  console.log(`  1. python scripts/align-pairs.py ${register}`);
  console.log(`     → ${OUT}/pairs-${register}/  一段一对，原尺寸，共 ${secN} 张`);
  console.log("  2. 每一张都要自己看过。清单量得到有几个盒子、什么顺序，");
  console.log("     量不到「一个框里切两半」跟「两栏并排」的差别 —— 台账第6段");
  console.log("     那一次它是绿的，而两边根本不是同一个设计。");
  console.log("  3. 眼睛看到而清单没抓到的，当场补成新的一项检查（重点 7l），");
  console.log("     不要只修那一次。");
  console.log("");
  console.log(`差异图 → ${OUT}/${register}-diff.jpg （只有不及格的那几段）`);
  console.log(`对照图 → ${OUT}/${register}.jpg （整页缩图，看全貌用）`);
} finally {
  await browser.close();
  await restore();
}

/**
 * 选了英文，画面上还剩几个中文字。
 *
 * WHY THIS IS A SCRIPT. The founder said 「用英文 不要用華語」, I heard it as "talk
 * to me in English", and he corrected it: 「不是這個英文 是我的平台裡面用英文」. When I
 * finally walked /en/portal by hand on 2026-08-26 there were 386 Chinese
 * strings across eight pages -- on a portal I had already called localised,
 * twice. The reason it survived that long is that nothing FAILS when a Chinese
 * literal renders under an English locale. It just sits there.
 *
 * So this is the gate. It walks the portal in English and counts the CJK.
 *
 * ── WHAT IT DELIBERATELY DOES NOT COUNT ───────────────────────────────────
 *
 * The customer's OWN words. 兴发装修工程, 陈老板, and a real enquiry that reads
 * 「陈先生（真实测试）· 厨房翻新，想问大概多少钱」 are a business's name, an owner's
 * name, and a sentence a human being actually typed. Translating those is not
 * localisation, it is falsifying someone's data. They are matched by
 * OWN_WORDS below and excluded, and anything excluded is PRINTED, so the
 * exclusion list stays something you look at rather than something that hides
 * the count.
 *
 *   npm run check:en            # every page
 *   npm run check:en -- spec    # just this one
 *
 * Needs `npm run dev` on :3000 and the demo account seeded.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

/*
  WHO EACH PAGE HAS TO BE OPENED AS.

  Everything used to be walked as tianyou.demo@formae.test, and that account is
  a CUSTOMER. `is_founder()` is false for it, so every /console route
  calls notFound() -- this script walked eight pages, could not open the ninth
  and tenth at all, and reported zero. On 2026-08-28 the console was opened for
  real for the first time and had Chinese in two columns: the TRADE column
  printed `industries.name_zh` unconditionally, and the FEES column had a 「月」
  welded onto the end of a number in JSX.

  A ruler that returns 0 for a page it cannot open is worse than no ruler. So
  `as` is part of the page list now, and a founder page that fails to open is a
  FAILURE rather than a silent zero.
*/
const PAGES = [
  ["home", "/en/portal", "customer"],
  ["library", "/en/portal/library", "customer"],
  ["sections", "/en/portal/sections", "customer"],
  ["templates", "/en/portal/templates", "customer"],
  ["styles", "/en/portal/styles", "customer"],
  ["spec", "/en/portal/spec", "customer"],
  ["enquiries", "/en/portal/enquiries", "customer"],
  ["account", "/en/portal/account", "customer"],
  /* 加一单. Every label on it is written in this file's COPY block rather than
     coming through next-intl, which is exactly the shape 任务 38 found the
     photo picker in: 15 hardcoded Chinese strings behind two clicks and a
     network request, so this crawler had never opened it. */
  ["new record", "/en/portal/customers/new", "customer"],
  /* 要跟的事（20260905800000）。[任务 177] 量出来的那个洞就是这一行：
     一格功能做完了，而那一页不在这份清单上 —— 於是这把尺看得到画面，
     只是从来没走到那几页。**一格做完，那一页要走得进这份清单。** */
  ["to chase", "/en/portal/today", "customer"],
  /* 帐 · 保养合约 · 薪水 · 税（2026-09-06）。
     同上一行同一个理由：**一格做完，那一页要走得进这份清单**。
     四页里三页只有老板打得开，而这一支本来就是拿老板登入的。 */
  ["books", "/en/portal/books", "customer"],
  ["service contracts", "/en/portal/contracts", "customer"],
  ["pay", "/en/portal/payroll", "customer"],
  ["tax", "/en/portal/tax", "customer"],
  ["plates", "/en/portal/vehicles", "customer"],
  ["shelf life", "/en/portal/expiry", "customer"],
  ["serial numbers", "/en/portal/serials", "customer"],
  ["out on loan", "/en/portal/rentals", "customer"],
  /* 谁欠我钱 · 分店 · 我欠人家的（2026-09-06）。同一条：**一格做完，
     那一页要走得进这份清单** —— 而这三页在今天之前一直没有走进来，
     所以这把尺看得到画面，只是从来没打开过它们。 */
  ["who owes you", "/en/portal/owing", "customer"],
  ["branches", "/en/portal/branches", "customer"],
  ["what you owe", "/en/portal/payables", "customer"],
  ["days worked", "/en/portal/attendance", "customer"],
  ["who is free", "/en/portal/rota", "customer"],
  ["moving stock", "/en/portal/transfers", "customer"],
  ["counter", "/en/portal/counter", "customer"],
  ["classes", "/en/portal/classes", "customer"],
  /* 改这一单. Its URL carries a RECORD id, so the same trap as
     console-customer one level deeper -- and it carries its own hard-coded
     copy block (地址 · 公司注册号 · 冲正 · 收起来), which is precisely the
     shape 任务 38 found the photo picker in. A record is made for it below and
     removed afterwards. */
  ["edit record", null, "customer"],
  /* 🔴 编辑器（2026-09-07）。老板自己拍图点出来的：
     「CHANGE THIS BLOCK · 记录表格」 —— 半句英文半句中文。
     而这把尺从来没有打开过编辑器 —— 那几百个区块名一直是中文的，
     而它们要选中一块才画得出来。⚠️ 所以这一页要多按两下：
     选中一块 → 开那张面板。没按到就是失败，不是「这一页很干净」 */
  ["editor", "/en/portal/dashboard?design=1", "customer"],
  ["console", "/en/console", "founder"],
  ["console-leads", "/en/console/leads", "founder"],
  ["console-law", "/en/console/law", "founder"],
  /* Resolved at run time -- its URL carries a project id, which is exactly why
     it went unmeasured while the other two console screens were fixed twice.
     A page list that can only hold static paths is a page list that silently
     excludes every detail screen in the product. */
  ["console-customer", null, "founder"],
];

/* The customer's own data. Their name, their people, their words. A single
   character is the avatar monogram cut from one of them. */
const OWN_WORDS = [
  /兴发装修工程/, /陈老板/, /陈先生/, /陈太太/, /李先生/,
  /真实测试/, /厨房翻新/, /想问大概多少钱/,
  /Taman/, /装修/, /我的测试系统/,
  /^[一-鿿]$/,
];

/* The one Chinese string that is CORRECT on an English page: the language
   switcher, which names the other language in that language. An English button
   reading 「Chinese」 tells a Chinese reader nothing about what they will get. */
const BY_DESIGN = [/^中文$/];

/* THE SECOND PROJECTION, AND WHY IT IS NOT A LEAK.

   There are two languages in this product and they are set by two different
   things (see docs/founder-points.md 13). `locale` is what Formae speaks to the
   owner -- that is what this script measures. `projects.system_language` is
   what the CUSTOMER'S SYSTEM speaks to their customers, and it governs the page
   names in the rail.

   The founder's own test project is a Chinese system. So on /en/console
   his rail correctly reads 总览 · 客户 · 报价单, and counting those as
   untranslated UI would be measuring the wrong projection -- the fix a red
   number there would push you towards is to translate a customer's system into
   a language they did not choose.

   Read from the catalogue rather than typed out, so a module added tomorrow is
   covered without anyone remembering this file exists. */
const SYSTEM_WORDS = (() => {
  const src = readFileSync("lib/portal/module-catalog.ts", "utf8");
  return [...src.matchAll(/^\s+label: "([^"]+)",$/gm)].map((m) => new RegExp(`^${m[1]}$`));
})();

const only = process.argv.slice(2);
const wanted = only.length ? PAGES.filter(([n]) => only.includes(n)) : PAGES;

mkdirSync(".screenshots/en", { recursive: true });

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, ""),
    ]),
);

/** The most recently touched customer -- the one the founder would have open. */
async function newestCustomerProjectId() {
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data } = await db
    .from("projects")
    .select("id, accounts!inner(role)")
    .eq("accounts.role", "customer")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

const b = await chromium.launch();

/* The customer walk signs in with a password. The founder walk cannot: that
   account is the founder's real email, and this script is not worth changing
   his password over. Same magic-link route shoot-console.mjs uses. */
async function signIn(as) {
  const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
  if (as === "customer") {
    await p.goto("http://localhost:3000/en/login", { waitUntil: "networkidle" });
    await p.fill('input[type="email"]', "tianyou.demo@formae.test");
    await p.fill('input[type="password"]', "FormaeDemo2026!");
    await p.click('button[type="submit"]');
    await p.waitForURL(/portal/, { timeout: 60000 });
    return p;
  }
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: founder } = await db
    .from("accounts").select("email").eq("role", "founder").limit(1).single();
  if (!founder?.email) throw new Error("no founder account -- accounts.role = 'founder' is unset");
  const { data: link, error } = await db.auth.admin.generateLink({
    type: "magiclink",
    email: founder.email,
  });
  if (error) throw new Error(`generateLink failed: ${error.message}`);
  await p.goto(
    `http://localhost:3000/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/en/console`,
    { waitUntil: "networkidle", timeout: 60000 },
  );
  if (!/\/console/.test(p.url())) throw new Error(`founder sign-in landed on ${p.url()}`);
  return p;
}

const pages = {};
const report = {};
let total = 0;

/* One customer record, so 改这一单 has something to open. Written through the
   same RPC the button calls and deleted in the finally below -- a checker that
   leaves rows behind is a checker that changes the thing it measures. */
let scratchRecordId = null;
let scratchCleanup = null;
async function scratchRecord() {
  if (scratchRecordId) return scratchRecordId;
  const asCustomer = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const signIn = await asCustomer.auth.signInWithPassword({
    email: "tianyou.demo@formae.test",
    password: "FormaeDemo2026!",
  });
  if (signIn.error) throw new Error(`scratch record sign-in: ${signIn.error.message}`);
  const { data: project } = await asCustomer.from("projects").select("id").limit(1).single();
  if (!project?.id) return null;
  const { data, error } = await asCustomer.rpc("add_pipeline_record", {
    in_project_id: project.id,
    in_module_key: "quotations",
    in_title: "check:en scratch",
  });
  /* Loudly. A page this crawler cannot open scores zero, and a zero it did
     not earn is the failure this whole file's header is about. */
  if (error) throw new Error(`scratch record: ${error.message}`);
  scratchRecordId = data?.id ?? null;
  /* 🔴 **收尾要接在死掉那条路上，不只是跑完那条路。**
     2026-09-06 这一支中途没跑到底，那一行留在**他的示范帐号**里 ——
     而一笔真的记录会让整桌示例退场（那是 8-30 定的行为），
     所以他打开报价单那一页看到的不是七行示例，是**一行叫
     「check:en scratch」的单**。躺了一天，没有任何东西会讲。

     ⚠️ 而它同时把另一把尺弄红了：`check:table-search` 要表上有两行
     才筛得动，於是它报三条红，而产品一个字都没错。
     **一支尺留下来的垃圾，会在别的地方产生一个假的红。**

     所以 `Ctrl-C` · `SIGTERM` · **接给 `head` 那一种（EPIPE）**都要接 ——
     [任务 196](../docs/founder-tasks.md#196) 就是漏了第三种。 */
  let done = false;
  scratchCleanup = async () => {
    if (done) return;
    done = true;
    await asCustomer.from("pipeline_records").delete().eq("id", scratchRecordId);
  };
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"])
    process.once(sig, () => {
      void scratchCleanup().finally(() => process.exit(130));
    });
  process.once("uncaughtException", (e) => {
    void scratchCleanup().finally(() => {
      console.error(e);
      process.exit(1);
    });
  });
  return scratchRecordId;
}

for (const [name, staticPath, as] of wanted) {
  const path =
    staticPath ??
    (name === "edit record"
      ? `/en/portal/quotations/${await scratchRecord()}`
      : `/en/console/${await newestCustomerProjectId()}`);
  if (path.endsWith("/null")) {
    console.log("    -", name, "skipped: no customer project to open");
    continue;
  }
  pages[as] ??= await signIn(as);
  const p = pages[as];
  await p.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle", timeout: 120000 });
  // The spec page writes its prose with a model call; the libraries render a
  // few hundred live previews. Neither is finished at networkidle.
  await p.waitForTimeout(name === "spec" ? 9000 : name === "console-customer" ? 6000 : name.startsWith("console") ? 2000 : 5000);

  /* 🔴 选中一块，不然编辑器那两块不画.
     AI 面板的抬头跟「改这一块」那张面板的标题，两个都印区块名。 */
  if (name === "editor") {
    const canvas = p.locator("[data-puck-preview] [data-puck-component]").first();
    if (!(await canvas.isVisible().catch(() => false))) {
      throw new Error(`editor: ${path} rendered no canvas -- it would have scored zero`);
    }
    await canvas.click({ force: true });
    await p.waitForTimeout(1200);
    const sheetBtn = p.getByRole("button", { name: /edit text/i }).first();
    if (!(await sheetBtn.isVisible().catch(() => false))) {
      throw new Error("editor: nothing selected -- the block toolbar never appeared");
    }
    await sheetBtn.click();
    await p.waitForTimeout(900);
    /* ⚠️ 换款式 那一栏不是每一块都有（只有一种款式的不画），
       所以它在就按，不在就算了 —— 而上面那一颗是每一块都有的。 */
    const variantBtn = p.getByRole("button", { name: /change shape/i }).first();
    if (await variantBtn.isVisible().catch(() => false)) {
      await variantBtn.click();
      await p.waitForTimeout(1200);
    }
  }

  /* The whole reason the console went unmeasured: notFound() renders a page
     with no Chinese on it, which counts as a clean pass. Refuse to score a
     page we did not actually open. */
  if (as === "founder" && !(await p.locator("h1, h2").first().isVisible().catch(() => false))) {
    throw new Error(`${name}: signed in as founder but ${path} did not render -- is_founder() false?`);
  }
  /* ⚠️ AND THE SAME TRAP ON THE CUSTOMER'S SIDE. 加一单 and 改这一单 both
     notFound() on a page this business does not have, on a shape that is not
     live, or on a record id that is not theirs -- and a 404 has no Chinese on
     it, so it scores a clean zero. The guard above was written for the console
     and stopped at `as === "founder"`; these two are the only customer pages
     that can 404, and they are the two carrying a hand-written copy block. */
  if (
    (name === "new record" || name === "edit record") &&
    !(await p.locator("form").first().isVisible().catch(() => false))
  ) {
    throw new Error(`${name}: ${path} rendered no form -- it 404'd and would have scored zero`);
  }

  // Text NODES, not innerText: a node is the smallest thing a single literal
  // can be, so the count lands on strings rather than on paragraphs.
  const foundRaw = await p.evaluate(() => {
    const out = [];
    const theirs = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const s = (n.textContent || "").trim();
      if (!s || !/[\u4e00-\u9fff]/.test(s)) continue;
      const el = n.parentElement;
      /* 🔴 2026-09-07: this used to ask the DIRECT PARENT for
         `display: none`, which a closed panel does not have -- the panel
         itself is hidden three or four levels up, and every string
         rendered inside it still counted. The editor scored 98 on its
         first run and 84 of those were in panels nobody had opened:
         a whole page of blocks the 加一段 drawer keeps mounted.
         `getClientRects()` asks the only question worth asking -- does
         this text have a box on the page. Scrolled out of view still
         has one; inside a closed dialog does not.
         量到的东西不是画面上的东西 —— 这个仓库第五次。 */
      if (!el) continue;
      const box = el.getBoundingClientRect();
      if (el.getClientRects().length === 0 || box.width === 0 || box.height === 0)
        continue;
      /* Content a person supplied or that was generated for them and shown to
         them, marked at the render site. Skipping the whole SUBTREE (closest,
         not the parent) is deliberate: their words arrive wrapped in our
         spans. */
      if (el && el.closest("[data-their-words]")) {
        theirs.push(s);
        continue;
      }
      out.push(s);
    }
    return { out, theirs };
  });

  const { out: found, theirs: declared } = foundRaw;
  const keep = (s) =>
    OWN_WORDS.some((r) => r.test(s)) ||
    BY_DESIGN.some((r) => r.test(s)) ||
    SYSTEM_WORDS.some((r) => r.test(s));
  const own = [...declared, ...found.filter(keep)];
  const bad = found.filter((s) => !keep(s));
  report[name] = { chinese: bad.length, theirs: own.length, strings: [...new Set(bad)] };
  total += bad.length;

  await p.screenshot({ path: `.screenshots/en/en-${name}.png`, fullPage: true });
  console.log(
    String(bad.length).padStart(4),
    name.padEnd(11),
    own.length ? `(${own.length} of the customer's own, kept)` : "",
  );
  for (const s of [...new Set(bad)].slice(0, 12)) console.log("       ·", s.slice(0, 60));
}

writeFileSync(".screenshots/en/report.json", JSON.stringify(report, null, 2));
await b.close();
/* Put the demo account back. A checker that leaves a row behind changes the
   thing it measures, and the next run reports on its own litter. */
if (scratchCleanup) await scratchCleanup();
console.log("\n", total, "Chinese strings on the English portal");
process.exit(total === 0 ? 0 : 1);

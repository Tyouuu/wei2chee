/**
 * 她签的那一份 —— 真的登入、真的发一条连结、真的用一把没有登入过的浏览器签。
 *
 *   npm run shoot:consent
 *
 * 🔴 资料库那一层 `check:consent` 已经量过 47 条。这一支量的是**另一件**：
 * 那八支函式到不到得了她眼前（[重点 7l](../docs/founder-points.md)：
 * 数字全绿而画面是坏的，这个仓库发生过十几次）。
 * [任务 313] 自己的收尾写着：**「画面上一格都没有 …… 她今天点不到。」**
 *
 * ⚠️ 而它走的是**整条线**，不是只按那几支 RPC：
 *   写一份范本 → 在她那一页上发一份 → 复制那条连结
 *   → **换一把从头到尾没有登入过的浏览器**打开它 → 签
 *   → 回到她那一页，写着签了 → 资料库里也写着签了
 *
 * 🔴 第三步那一句是这一整支的靶：一条只有登入的人打得开的「公开连结」，
 * 跟一条真的公开的连结，在一个已经登入的分页里长得一模一样。
 */
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
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
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".screenshots/consent";
mkdirSync(OUT, { recursive: true });

let pass = 0;
const bad = [];
const check = (what, ok, saw) => {
  if (ok) {
    pass++;
    console.log(`  PASS  ${what}`);
  } else {
    bad.push(what);
    console.log(`  FAIL  ${what}${saw === undefined ? "" : ` — ${saw}`}`);
  }
};

const stamp = Date.now();
let ownerId = null;
let browser = null;
dropThrowawayOnExit(admin, () => ownerId);

/* 那一份字里**故意放一句我们绝对不会自己写的话** —— 它是快照那一条的靶：
   老板改了范本之后，已经发出去的那一份要留着这一句。 */
const BODY_1 = [
  "I understand this treatment carries risks.",
  "",
  "SENTINEL-ORIGINAL-WORDING",
].join("\n");
const BODY_2 = "Completely different wording. SENTINEL-CHANGED-LATER";

/**
 * 🔴 **等 React 接上事件再按。**
 *
 * 第一版是 `domcontentloaded` → 马上填 → 马上按，於是那一下变成一次
 * **原生表单送出**，页面自己重载 —— log 上是三次
 * 「navigated to /en/login」，而画面上跟「密码错了」长得一模一样。
 * [任务 274] 记过同一条，这里是第二次。
 *
 * 所以：等 networkidle（那一刻 React 已经接上）→ 再按 →
 * 而且**按了没走就再按一次** —— 这台机上三个 session 在改同一棵树，
 * 每改一次开发服务器就要重编译（[任务 257]）。
 */
/**
 * 那句话离**离它最近的那一格**有多远（Baymard：讲要什么、贴着那一格）。
 *
 * 🔴 不写死是哪一个框：她那一页只有一个，而范本那一页有四个，
 * 而两处要量的是同一件事。量「那句话的顶」减「它上面那一格的底」——
 * 负的（那句话跑到框上面去了）也算没过。
 */
async function gapToField(page) {
  return page.evaluate(() => {
    const msg = document.querySelector('[role="alert"]');
    if (!msg) return null;
    const top = msg.getBoundingClientRect().top;
    let best = null;
    for (const f of document.querySelectorAll("input, textarea")) {
      const d = top - f.getBoundingClientRect().bottom;
      if (d >= -2 && (best === null || d < best)) best = d;
    }
    return best === null ? null : Math.round(best);
  });
}

async function login(page, email, password) {
  await page
    .goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 })
    .catch(() => page.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded", timeout: 90000 }));
  await page.waitForSelector("input[type=email]", { timeout: 60000 });
  for (let go = 0; go < 3; go++) {
    await page.fill("input[type=email]", email);
    await page.fill("input[type=password]", password);
    await page.click("button[type=submit]");
    const landed = await page
      .waitForURL(/\/(portal|salon-preview)/, { timeout: 90000 })
      .then(() => true, () => false);
    if (landed) return;
    /* 🔴 画面上真的有一句错误讯息 = 产品的事，不要重试掩盖它。 */
    const said = await page.locator('[role="alert"]').first().innerText().catch(() => "");
    if (said.trim()) throw new Error(`登入被拒：${said.trim()}`);
    await page.waitForSelector("input[type=email]", { timeout: 60000 });
  }
  throw new Error("登入按了三次都没有走到 /portal —— 而画面上一句错误讯息都没有");
}

try {
  /* ── 台面：一间 medi spa ─────────────────────────────────────────────── */
  const { data: ind } = await admin
    .from("industries")
    .select("id")
    .eq("slug", "beauty")
    .single();
  const { data: lead } = await admin
    .from("leads")
    .insert({ industry_id: ind.id, language: "en", answers: {} })
    .select("id")
    .single();

  const email = `consentshot-${stamp}@formae.test`;
  const password = `Cs-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { lead_id: lead.id },
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  ownerId = made.user.id;

  const { data: proj } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", ownerId)
    .single();
  const P = proj.id;
  await admin
    .from("projects")
    .update({ business_name: "Lumiere Medi Spa" })
    .eq("id", P);

  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password });
  const say = async (fn, args) => {
    const { data, error } = await c.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data;
  };

  const client = await say("add_directory_entry", {
    in_project_id: P,
    in_module_key: "customers",
    in_name: "Ms Lim",
  });
  const CLIENT = client?.id ?? client;
  /* 🔴 另外一个客人 —— 「一条连结开一份表单」那一条要一个对照组，
     不然那一句「看不到别人的」量的是空气。 */
  const other = await say("add_directory_entry", {
    in_project_id: P,
    in_module_key: "customers",
    in_name: "Mrs Tan",
  });
  await say("add_consent_form", {
    in_project_id: P,
    in_name: "SENTINEL-OTHER-FORM",
    in_body: "Nothing to do with Ms Lim.",
  });

  browser = await chromium.launch();

  /* ── ① 写一份范本（真的在那一页上按） ───────────────────────────────── */
  console.log("\n① 写一份范本");
  const boss = await browser.newPage({
    viewport: { width: 1400, height: 950 },
    deviceScaleFactor: 2,
  });
  await login(boss, email, password);
  await boss.goto(`${BASE}/en/portal/consent`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await boss.waitForSelector("text=Consent forms", { timeout: 90000 });
  await boss.addStyleTag({ content: "nextjs-portal{display:none!important}" });

  /* 🔴 **空着按下去。** [任务 281] 立过这一条，而这一页原本破了它：
     两个框空着的时候那颗按钮是灰的，而画面上一个字都不讲。
     所以先按一次什么都没填的 —— 按钮要按得动，那句话要贴着那一格。 */
  /* ⚠️ **不要去读 `disabled` 那一格** —— 那一刻页面可能还没有 hydrate，
     读到的是伺服器画的那一份。实测：把 disabled 装回去之后那一条照样 PASS，
     而它底下三条全部红 —— **一条有竞态的断言，跟一条什么都没守的断言
     长得一模一样。** 改成量他真正会遇到的那件事：**按不按得下去**。 */
  const clicked = await boss
    .click('button:has-text("Add a form")', { timeout: 8000 })
    .then(() => true, () => false);
  check(
    "🔴 什么都没填，那颗按钮照样按得动",
    clicked,
    clicked ? "" : "它是灰的 —— 点不下去",
  );
  await boss.waitForSelector('[role="alert"]', { timeout: 20000 });
  const bossGap = await gapToField(boss);
  check(
    "🔴 空着按下去，那句话贴着那一格",
    bossGap !== null && bossGap >= 0 && bossGap <= 24,
    `${bossGap}px`,
  );
  check(
    "而且讲的是要什么，不是哪里错了",
    (await boss.$eval('[role="alert"]', (e) => e.textContent ?? "")).includes("what this form is for"),
  );

  await boss.fill('input[aria-label="What this form is for"]', "Botox consent");
  await boss.fill('textarea[aria-label="What she is agreeing to"]', BODY_1);
  await boss.click('button:has-text("Add a form")');
  /* 🔴 **等 innerText，不要等 `text=`。**
     `text=Botox consent` 会配到**那个框里的值** —— 而我刚刚才把那几个字
     打进那个框，所以它在点击被处理之前就已经成立了。
     於是那一句「加好了」在两次跑里给了两个不同的假答案。
     `innerText` 读不到 input 的 value，所以它只会在那一行真的画出来才成立。 */
  await boss
    .waitForFunction(
      () => document.body.innerText.includes("Botox consent"),
      undefined,
      { timeout: 30000 },
    )
    .catch(() => {});
  /* 🔴 **不要拿 waitForSelector 当断言。** 一张图上那一份没有画出来，
     而那一句照样过了 —— 去问画面上真正读得到的字。
     一份加完要他重新整理才看得到的范本，跟一份没有加成功的，
     在他眼前长得一模一样。 */
  const listed = await boss.evaluate(() => {
    const card = document.querySelector("main") ?? document.body;
    const inputs = [...card.querySelectorAll("input, textarea")].map(
      (e) => `<${e.tagName.toLowerCase()}>=${JSON.stringify(e.value)}`,
    );
    return { text: card.innerText, inputs, html: card.innerHTML.includes("Botox consent") };
  });
  check(
    "这一页写得出一份范本，而且当场看得到",
    listed.text.includes("Botox consent"),
    `原始码里有：${listed.html} · 框里装的：${listed.inputs.join(" ")} · 卡上的字：${listed.text.replace(/\s+/g, " ").slice(0, 200)}`,
  );
  check(
    "侧栏上有那一行，而且是选中的",
    Boolean(await boss.$('a[href*="/portal/consent"]')),
  );

  const forms = await c.rpc("consent_forms_of", { in_project_id: P });
  check(
    "资料库里真的有那一份",
    (forms.data ?? []).some((f) => f.name === "Botox consent"),
    JSON.stringify((forms.data ?? []).map((f) => f.name)),
  );
  await boss.screenshot({
    path: `${OUT}/1-forms.jpg`,
    type: "jpeg",
    quality: 82,
    fullPage: true,
  });

  /* ── ② 在她那一页上发一份 ───────────────────────────────────────────── */
  console.log("\n② 在她那一页上发一份");
  await boss.goto(`${BASE}/en/portal/customers/${CLIENT}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  /* 🔴 「Consent」躲在「Account & activity」那个分页签底下（老板要求的
     设计总检，2026-09-12：客户页收成两个分页签，同意书不是默认那一个）——
     先等页签本身画出来，点开它，「Consent」才会真的可见。 */
  await boss.waitForSelector('[role="tab"]:has-text("Account & activity")', { timeout: 90000 });
  await boss.click('[role="tab"]:has-text("Account & activity")');
  await boss.waitForSelector("text=Consent", { timeout: 90000 });
  await boss.addStyleTag({ content: "nextjs-portal{display:none!important}" });

  const before = await boss.evaluate(() => document.body.innerText);
  check("那一段画出来了", before.includes("No consent form sent to her yet."));

  await boss.selectOption('select[aria-label="Which form"]', { label: "Botox consent" });
  await boss.click('button:has-text("Send to her")');
  await boss.waitForSelector('input[aria-label="The link you send her"]', {
    timeout: 60000,
  });

  const link = await boss.inputValue('input[aria-label="The link you send her"]');
  check("画面上给了一条连结", /\/c\/[0-9a-f-]{36}$/.test(link), link);
  const sheets = await c.rpc("consents_of", { in_party_id: CLIENT });
  const sheet = (sheets.data ?? [])[0];
  check("资料库里真的多一行", Boolean(sheet), JSON.stringify(sheets.data));
  check(
    "🔴 那条连结的号码不是那一行的 id —— 所以收得回来",
    sheet && sheet.share_ref !== sheet.id,
    `${sheet?.share_ref} vs ${sheet?.id}`,
  );
  check("还没签，画面上讲的是在等", (await boss.evaluate(() => document.body.innerText)).includes("still waiting"));
  await boss.screenshot({
    path: `${OUT}/2-sent.jpg`,
    type: "jpeg",
    quality: 82,
    fullPage: true,
  });

  /* ── ③ 🔴 换一把从头到尾没有登入过的浏览器 ─────────────────────────── */
  console.log("\n③ 🔴 她自己打开（一把没有登入过的浏览器）");
  const stranger = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const her = await stranger.newPage();
  await her.goto(link, { waitUntil: "domcontentloaded", timeout: 120000 });
  await her.waitForSelector('button:has-text("I agree")', { timeout: 90000 });
  await her.addStyleTag({ content: "nextjs-portal{display:none!important}" });

  const seen = await her.evaluate(() => document.body.innerText);
  check("她读得到那一份字", seen.includes("SENTINEL-ORIGINAL-WORDING"));
  check("而且写着是谁家", seen.includes("Lumiere Medi Spa"));
  check("写着她的名字", seen.includes("Ms Lim"));
  /* 🔴 漏不漏 —— 这一段是这一整件事的理由。 */
  check("🔴 看不到别人那一份表单", !seen.includes("SENTINEL-OTHER-FORM"));
  check("🔴 看不到另一个客人", !seen.includes("Mrs Tan"));
  const html = await her.content();
  check(
    "🔴 一个编号都没有印出来",
    !html.includes(CLIENT) && !html.includes(sheet.id) && !html.includes(P),
    "id / party_id / project_id",
  );
  check(
    "而且不给搜寻引擎收",
    /noindex/i.test(html),
    html.match(/<meta[^>]*robots[^>]*>/i)?.[0],
  );
  await her.screenshot({
    path: `${OUT}/3-hers-390.jpg`,
    type: "jpeg",
    quality: 82,
    fullPage: true,
  });

  /* 空着按下去 —— 那句话要贴着那一格，不是印在最底下（Baymard）。 */
  await her.click('button:has-text("I agree")');
  await her.waitForSelector('[role="alert"]', { timeout: 20000 });
  const gap = await gapToField(her);
  check("🔴 空着按下去，那句话贴着那一格", gap !== null && gap >= 0 && gap <= 24, `${gap}px`);

  await her.getByLabel("Your name").fill("Lim Mei Ling");
  await her.getByLabel("Anything you want to add").fill("Allergic to lidocaine.");
  await her.click('button:has-text("I agree")');
  await her.waitForSelector("text=Signed", { timeout: 60000 });
  const after = await her.evaluate(() => document.body.innerText);
  check("签完那一页自己讲了", after.includes("Signed"));
  check("签完不再给她按第二次", !(await her.$('button:has-text("I agree")')));
  await her.screenshot({
    path: `${OUT}/4-signed-390.jpg`,
    type: "jpeg",
    quality: 82,
    fullPage: true,
  });
  await stranger.close();

  /* ── ④ 资料库那一边 ─────────────────────────────────────────────────── */
  console.log("\n④ 资料库那一边");
  const after2 = ((await c.rpc("consents_of", { in_party_id: CLIENT })).data ?? [])[0];
  check("资料库里写着签了", Boolean(after2?.signed_at), after2?.signed_at);
  check("签的是谁记下来了", after2?.signed_name === "Lim Mei Ling", after2?.signed_name);
  check("她补的那一句留着", (after2?.signed_note ?? "").includes("lidocaine"));

  /* 🔴 老板改范本，她签的那一份一个字都不变 —— 快照那一条的靶。 */
  await say("update_consent_form", { in_id: forms.data[0].id, in_body: BODY_2 });
  const after3 = ((await c.rpc("consents_of", { in_party_id: CLIENT })).data ?? [])[0];
  check(
    "🔴 老板改了措辞，她签的那一份还是当时那一份",
    (after3?.form_body ?? "").includes("SENTINEL-ORIGINAL-WORDING") &&
      !(after3?.form_body ?? "").includes("SENTINEL-CHANGED-LATER"),
    (after3?.form_body ?? "").slice(0, 60),
  );
  /* 而她那条连结打开来读到的，也还是当时那一份。 */
  const again = await browser.newContext();
  const reread = await again.newPage();
  await reread.goto(link, { waitUntil: "domcontentloaded", timeout: 120000 });
  await reread.waitForSelector("text=Signed", { timeout: 60000 });
  const rereadBody = await reread.evaluate(() => document.body.innerText);
  check(
    "🔴 她回去看，读到的还是她当时签的那一份",
    rereadBody.includes("SENTINEL-ORIGINAL-WORDING") &&
      !rereadBody.includes("SENTINEL-CHANGED-LATER"),
  );
  await again.close();

  /* ── ⑤ 老板那一边看得到她签了 ───────────────────────────────────────── */
  console.log("\n⑤ 老板那一边");
  await boss.goto(`${BASE}/en/portal/customers/${CLIENT}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await boss.waitForSelector('[role="tab"]:has-text("Account & activity")', { timeout: 90000 });
  await boss.click('[role="tab"]:has-text("Account & activity")');
  await boss.waitForSelector("text=Signed", { timeout: 90000 });
  await boss.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  const bossBody = await boss.evaluate(() => document.body.innerText);
  check("他那一页写着签了", bossBody.includes("Signed"));
  check("而且写得出是谁签的", bossBody.includes("Lim Mei Ling"));
  check(
    "🔴 签过的那一份不再给他收回去",
    !(await boss.$('button:has-text("Take it back")')),
  );
  await boss.screenshot({
    path: `${OUT}/5-boss-signed.jpg`,
    type: "jpeg",
    quality: 82,
    fullPage: true,
  });

  // 同意书清单那一页：签了一份之后，那一行要写「1 signed」。
  // 🔴 这句字是带 {n} 的模板，页面把它原样交给画面去填数字；如果页面用 t() 去格式化它，
  // 会因为没给 n 而报 FORMATTING_ERROR，那一行就会印一串键名。（2026-09-25 在开发模式的
  // 控制台看到，「2 Issues」）
  await boss.goto(`${BASE}/en/portal/consent`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await boss.waitForSelector("text=Botox consent", { timeout: 90000 });
  const consentList = await boss.evaluate(() => document.body.innerText);
  check("🔴 同意书清单：签了一份的那一行写着「1 signed」，不是一串键名",
    /1 signed/.test(consentList) && !/portal\.consent|consent\.signed/.test(consentList), consentList.slice(0, 300));
  // 回到客户页，下一段（⑥）要在那里发第二条连结。
  await boss.goto(`${BASE}/en/portal/customers/${CLIENT}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await boss.waitForSelector('[role="tab"]:has-text("Account & activity")', { timeout: 90000 });
  await boss.click('[role="tab"]:has-text("Account & activity")');
  await boss.addStyleTag({ content: "nextjs-portal{display:none!important}" });

  /* ── ⑥ 收回一条还没签的 ─────────────────────────────────────────────── */
  console.log("\n⑥ 收回一条还没签的");
  await boss.selectOption('select[aria-label="Which form"]', { index: 0 });
  await boss.click('button:has-text("Send to her")');
  await boss.waitForSelector('input[aria-label="The link you send her"]', {
    timeout: 60000,
  });
  const link2 = await boss.inputValue('input[aria-label="The link you send her"]');
  check("再发一条，是另一条连结", link2 !== link, `${link2} vs ${link}`);

  await boss.click('button:has-text("Take it back")');
  await boss.waitForSelector("text=taken back", { timeout: 60000 });
  const gone = await browser.newContext();
  const dead = await gone.newPage();
  await dead.goto(link2, { waitUntil: "domcontentloaded", timeout: 120000 });
  const deadBody = await dead.evaluate(() => document.body.innerText);
  check("🔴 收回去之后她当场打不开了", deadBody.includes("not in use"), deadBody.slice(0, 80));
  await gone.close();

  /* ── ⑦ 一个不用签什么的生意，那一段照样在（而下拉是空的） ───────────── */
  console.log("\n⑦ 一份范本都没有的时候");
  const plainPage = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  await login(plainPage, email, password);
  /* 把两份都收起来 —— 那就是一间还没写过范本的店的样子。 */
  for (const f of (await c.rpc("consent_forms_of", { in_project_id: P })).data ?? [])
    await say("update_consent_form", { in_id: f.id, in_archived: true });
  await plainPage.goto(`${BASE}/en/portal/customers/${other?.id ?? other}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await plainPage.waitForSelector('[role="tab"]:has-text("Account & activity")', { timeout: 90000 });
  await plainPage.click('[role="tab"]:has-text("Account & activity")');
  await plainPage.waitForSelector("text=Consent", { timeout: 90000 });
  const plainBody = await plainPage.evaluate(() => document.body.innerText);
  check(
    "🔴 一份范本都没有的时候，画的是「去写第一份」，不是一个选不了东西的下拉",
    plainBody.includes("Write the first one") &&
      !(await plainPage.$('select[aria-label="Which form"]')),
  );
  await plainPage.close();
  await boss.close();
} catch (e) {
  bad.push(String(e?.message ?? e));
  console.log(`\n🔴 ${e?.message ?? e}`);
} finally {
  if (browser) await browser.close();
  const cleared = await dropThrowaway(admin, ownerId);
  console.log(cleared ? "\n临时帐号删掉了" : "\n🔴 删不掉");
}

console.log(`\n判：${pass} 过 · ${bad.length} 没过`);
if (bad.length) {
  for (const x of bad) console.log(`  · ${x}`);
  process.exitCode = 1;
}

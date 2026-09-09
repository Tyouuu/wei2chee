/**
 * 他递给助手的那张图 —— 用真的登入、真的桶、真的模型验一次。
 *
 * ── 为什么这一支非有不可（2026-09-09）────────────────────────────────────
 *
 * 老板自己讲他要拿助手做什么：
 *
 *     `好像讀截圖啊 拍照給妳分析啊 上傳invoice啊`
 *
 * 而在 20260909160000 之前，那张 invoice 传上去之后拿到的是
 * `site-photos` 的 `getPublicUrl()` —— 一条**永久、不用登入、任何人打得开**
 * 的网址，指着他供应商开给他的发票。
 *
 * 🔴 **单元测试量不到这一件的任何一段。** 它量的是「模型回了这一坨，我们信
 * 多少」；桶是不是公开的、他自己的登入读不读得回来、别人家读不读得到、
 * route 有没有真的把那张图送到模型眼前 —— 五段全部在网路那一边，
 * 而这个仓库十八次「说了没做」全部掉在那几段里。
 *
 * ⚠️ 最后那一段是这一支最贵的一条：`attachedImage` 静静回 null 的时候，
 * 助手会**照样回答**，只是当作他没有附图 —— 画面上跟成功一模一样。
 * 所以图上印一个**编出来的字**（MERPATI），叫它把标题改成那个字：
 * 回来的字里有它 → 模型真的看到了那张图。
 *
 * 要开着 `npm run dev`。
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
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
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(SB, env.SUPABASE_SERVICE_ROLE_KEY, {
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

const made = [];

async function person(tag) {
  const cred = {
    email: `ask-${tag}-${Date.now()}@formae.test`,
    password: `Ask-${Date.now()}-x!`,
  };
  const { data: user, error } = await admin.auth.admin.createUser({
    email: cred.email,
    password: cred.password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  made.push(user.user.id);
  const as = createClient(SB, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: sErr } = await as.auth.signInWithPassword(cred);
  if (sErr) throw new Error(`sign-in(${tag}): ${sErr.message}`);
  const { data: proj } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", user.user.id)
    .single();
  return { as, cred, userId: user.user.id, projectId: proj?.id };
}

/** 一张印着一个编出来的字的纸。**那个字不可能出现在任何一份训练资料里**，
 *  所以模型讲得出它，就只有一种可能：它真的看到了这张图。 */
const WORD = "MERPATI";
async function wordImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500">
  <rect width="900" height="500" fill="#ffffff"/>
  <text x="450" y="280" font-family="monospace" font-size="96" font-weight="bold"
        text-anchor="middle" fill="#111111">${WORD}</text>
</svg>`;
  return await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

const LAYOUT = {
  content: [{ type: "SiteHero", props: { id: "hero", headline: "兴发装修" } }],
  root: {},
};
const ASK = "把大标题改成图片上印着的那个字，一个字都不要多。";

const run = async () => {
  console.log("\n── 建两家 ＋ 一个师傅 ────────────────────────────────────");
  const boss = await person("boss");
  const other = await person("other");
  const hand = await person("hand");
  check("老板有一家", !!boss.projectId);

  const { error: invErr } = await boss.as.rpc("add_project_member", {
    in_email: hand.cred.email,
    in_role: "staff",
  });
  if (invErr) throw new Error(`add_project_member: ${invErr.message}`);

  console.log("\n── 传一张图给助手 ────────────────────────────────────────");
  const bytes = await wordImage();
  const path = `${boss.projectId}/ask-${randomUUID()}.jpg`;
  const { error: upErr } = await boss.as.storage
    .from("ask-photos")
    .upload(path, bytes, { contentType: "image/jpeg" });
  check("老板传得进去", !upErr, upErr?.message);

  console.log("\n── 🔴 这一段就是这一支存在的理由 ────────────────────────");
  /* 公开的那条网址。桶是 private 的时候它回 400/404，而**不是**那张图。 */
  const pub = await fetch(`${SB}/storage/v1/object/public/ask-photos/${path}`);
  check(
    "🔴 那条公开的网址打不开",
    !pub.ok,
    pub.ok ? `${pub.status} — 任何人拿到这条连结都看得到他的发票` : `${pub.status}`,
  );

  const { data: back, error: dlErr } = await boss.as.storage.from("ask-photos").download(path);
  check("老板用自己的登入读得回来", !dlErr && !!back, dlErr?.message);

  /* 🔴 师傅**读得到**，而这是故意的，跟 `receipts` 不一样：一个师傅拍一张
     工地的照片问助手「这一段怎么排」，跟钱无关，不该被 `sees_money` 挡掉。
     所以这个桶挡的是 `works_here`。 */
  const { data: handRead, error: handErr } = await hand.as.storage
    .from("ask-photos")
    .download(path);
  check("师傅读得到（这个桶挡的是 works_here，不是钱）", !!handRead && !handErr, handErr?.message);

  const { data: otherRead, error: otherErr } = await other.as.storage
    .from("ask-photos")
    .download(path);
  check("别人家读不到", !otherRead || !!otherErr, otherErr ? "" : "他读到了");

  console.log("\n── 🔴 而 site-photos 要保持公开（回归防护）──────────────");
  /* 客户官网上的每一张照片靠的就是它。把这一支写成「所有桶都不准公开」，
     下一个人照着收紧，会把每一个客户的官网照片一次弄不见。 */
  const sitePath = `${boss.projectId}/site-${randomUUID()}.jpg`;
  const { error: sErr } = await boss.as.storage
    .from("site-photos")
    .upload(sitePath, bytes, { contentType: "image/jpeg" });
  check("官网照片传得进 site-photos", !sErr, sErr?.message);
  const sitePub = await fetch(`${SB}/storage/v1/object/public/site-photos/${sitePath}`);
  check("site-photos 还是公开的（客户的官网靠它）", sitePub.ok, `${sitePub.status}`);

  console.log("\n── 源码那一条：不准漂回去 ────────────────────────────────");
  const panel = readFileSync(
    new URL("../app/[locale]/portal/[pageKey]/ai-assistant.tsx", import.meta.url),
    "utf8",
  );
  check("助手那颗回形针不再碰 site-photos", !panel.includes('"site-photos"'));
  /* ⚠️ 找的是**呼叫**（`.getPublicUrl(`），不是那个字 —— 第一版写成找字，
     结果撞到上面那段解释「为什么不再用它」的注解，红了一条假的。
     一把会因为有人写注解而变红的尺，教下一个人去删注解。 */
  check("助手不再拿一条公开的网址", !panel.includes(".getPublicUrl("));
  const route = readFileSync(
    new URL("../app/api/portal/edit/route.ts", import.meta.url),
    "utf8",
  );
  check("route 不再接受一条网址", !/\bimageUrl\b/.test(route));
  check("route 从 ask-photos 下载", route.includes('.from("ask-photos")'));

  console.log("\n── 🔴 模型真的看到那张图了吗 ────────────────────────────");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 90000 });
    await page.fill('input[type="email"]', boss.cred.email);
    await page.fill('input[type="password"]', boss.cred.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/portal/, { timeout: 90000 });

    const res = await page.request.post(`${BASE}/api/portal/edit`, {
      timeout: 180000,
      data: {
        layout: LAYOUT,
        instruction: ASK,
        pages: [{ key: "landing", label: "官网" }],
        imagePath: path,
        pageKey: "landing",
      },
    });
    check("route 认得他的登入", res.status() === 200, `${res.status()}`);
    const seen = JSON.stringify(await res.json().catch(() => ({})));
    check(`🔴 模型讲得出图上那个字（${WORD}）`, seen.toUpperCase().includes(WORD), seen.slice(0, 240));

    /* 🔴 别人家的路径要拿不到东西 —— 而且**不可以**因此整支呼叫失败：
       它该当作他没有附图，照样回答。 */
    const foreign = await page.request.post(`${BASE}/api/portal/edit`, {
      timeout: 180000,
      data: {
        layout: LAYOUT,
        instruction: ASK,
        pages: [{ key: "landing", label: "官网" }],
        imagePath: `${other.projectId}/ask-${randomUUID()}.jpg`,
        pageKey: "landing",
      },
    });
    const fSeen = JSON.stringify(await foreign.json().catch(() => ({})));
    check("别人家的路径不会让整支呼叫掉下去", foreign.status() === 200, `${foreign.status()}`);
    check("🔴 而且模型看不到那个字", !fSeen.toUpperCase().includes(WORD), fSeen.slice(0, 200));
  } finally {
    await browser.close();
  }
};

run()
  .catch((e) => {
    failed.push(`threw: ${e.message}`);
    console.error(e);
  })
  .finally(async () => {
    for (const id of made) {
      const ok = await dropThrowaway(admin, id);
      if (!ok) console.log(`  ⚠️  临时帐号 ${id} 删不掉`);
    }
    console.log(
      failed.length
        ? `\n🔴 ${failed.length} 条红:\n${failed.map((f) => `  · ${f}`).join("\n")}\n`
        : "\n全部绿。\n",
    );
    process.exit(failed.length ? 1 : 0);
  });

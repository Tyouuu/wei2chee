/**
 * 工地的照片 —— 真的传一张进去，用眼睛看。
 *
 * 重点 7l。而这一条比别的更要紧：这一整条线有**五段**，
 * 而这个仓库最常犯的错就是其中一段没接上：
 *
 *   浏览器缩图 → 传进 private 的桶（RLS 挡的是 works_here）
 *   → 写 record_photos（RPC）→ 伺服器签网址 → 画出来
 *
 * 178 条真的呼叫全过，而那 178 条**一段都没走过**上面这五段里的前两段跟后两段
 * —— 它们只打了中间那一支 RPC。
 *
 * ⚠️ 用的是 demo 那个真帐号，所以跑完把单跟照片都删掉（照片跟着单走）。
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { deflateSync } from "node:zlib";

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
const OUT = ".screenshots/job-photos";
mkdirSync(OUT, { recursive: true });

const EMAIL = "tianyou.demo@formae.test";
const PASSWORD = "FormaeDemo2026!";

const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/**
 * 一张 2400×1800 的假照片 —— 一支手机拍出来的尺寸。
 *
 * ⚠️ 第一版画的是 1200×900，而那**比 MAX_EDGE 还小**，所以缩图那一段
 * 什么都不用做、原图照传，然后我的断言报「没有缩图」。
 * **红的是我的道具，不是产品。**（同一天第三次量错东西。）
 *
 * 而且画的是杂讯不是渐层：渐层的 PNG 压得比 webp 还小，
 * 那时候「保住原图」是对的行为，而我会以为它坏了。
 */
function fakePhoto() {
  /* 最小的合法 JPEG 画不出 1200×900，而缩图那一段要一张解得开的图才走得到。
     用 PNG：手写一张纯色的 PNG 比手写 JPEG 短得多，而 accept="image/*" 收它。 */
  const w = 2400, h = 1800;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const off = y * (w * 3 + 1);
    raw[off] = 0;
    for (let x = 0; x < w; x++) {
      /* 一点杂讯，让它压不掉 —— 一张真的工地照片也压不掉。 */
      const n = (x * 2654435761 + y * 40503) >>> 0;
      raw[off + 1 + x * 3] = n & 0xff;
      raw[off + 2 + x * 3] = (n >>> 8) & 0xff;
      raw[off + 3 + x * 3] = (n >>> 16) & 0xff;
    }
  }
  const crcTable = [...Array(256)].map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const cr = Buffer.alloc(4);
    cr.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cr]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const shots = [];
let jobId = null;

let browser;
try {
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();

  const { data: job, error: jErr } = await api.rpc("add_pipeline_record", {
    in_project_id: proj.id, in_module_key: "quotations",
    in_title: "Kitchen strip-out", in_party: "Mr Tan", in_amount_cents: 1_200_000,
  });
  if (jErr) throw new Error(`job: ${jErr.message}`);
  jobId = job.id;

  browser = await chromium.launch();
  const wide = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await wide.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await wide.fill('input[type="email"]', EMAIL);
  await wide.fill('input[type="password"]', PASSWORD);
  await wide.click('button[type="submit"]');
  await wide.waitForURL(/portal/, { timeout: 180000 });

  const say = (name, ok, detail) => {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
    if (!ok) shots.push({ name, stuck: true });
  };

  const url = `/en/portal/quotations/${jobId}`;
  await wide.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 180000 });
  await wide.waitForTimeout(1000);
  await wide.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  const emptyBody = await wide.locator("main").innerText();
  await wide.screenshot({ path: `${OUT}/1-no-photos.png`, fullPage: true });
  console.log("拍到  1-no-photos");
  say("还没有照片的时候，讲的是「还没有照片」不是一片空白",
    /No photos on this job yet/i.test(emptyBody), emptyBody.replace(/\s+/g, " ").slice(0, 300));
  /* 🔴 看图才看到的：一张一期都没写的单，底下一行红字写着
     「这几期加起来跟单上的总数差 RM 12,000」——
     在骂他没做一件他根本没有开始做的事。 */
  say("一期都没写的时候，不会红字骂他分期对不上",
    !/do not add up/i.test(emptyBody), emptyBody.replace(/\s+/g, " ").slice(0, 400));

  /* 🔴 真的传一张。setInputFiles 走的是浏览器那条路 —— 缩图、RLS、RPC、
     签名、渲染，五段一段都不能少。 */
  const source = fakePhoto();
  const sourceBytes = source.byteLength;
  await wide.setInputFiles('input[type="file"]', {
    name: "site.png",
    mimeType: "image/png",
    buffer: source,
  });
  await wide.waitForTimeout(6000);
  await wide.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await wide.screenshot({ path: `${OUT}/2-one-photo.png`, fullPage: true });
  console.log("拍到  2-one-photo");

  const shown = await wide.locator("figure img").count();
  say("传完，那张照片就在画面上（不用他再按保存）", shown === 1, `画面上 ${shown} 张`);

  const { data: rows } = await api
    .from("record_photos").select("id, path").eq("record_id", jobId);
  say("而且资料库里真的有那一行", (rows ?? []).length === 1, `${(rows ?? []).length} 行`);

  /* 🔴 桶是 private 的 —— 不带签名的网址打不开。
     这一条是整支最重要的：那是他客户家里，不是官网。 */
  if ((rows ?? []).length) {
    const bare = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/job-photos/${rows[0].path}`;
    const res = await fetch(bare);
    say("不带签名打不开（桶是 private 的）", !res.ok, `HTTP ${res.status}`);
  }

  /* 🔴 缩图那一段真的跑了吗。2400×1800 的照片超过 MAX_EDGE，
     所以缩完一定比原图小，所以一定走 webp 那一支。
     而且再量一次真的档案大小 —— 副档名只讲它是什么，不讲它多大。 */
  if ((rows ?? []).length) {
    say("浏览器有先缩图（存的是 webp）", /\.webp$/.test(rows[0].path), rows[0].path);
    const { data: blob } = await api.storage.from("job-photos").download(rows[0].path);
    const storedBytes = blob ? (await blob.arrayBuffer()).byteLength : 0;
    say("而且真的变小了（4G 上传得动）",
      storedBytes > 0 && storedBytes < sourceBytes,
      `原图 ${sourceBytes} → 存的 ${storedBytes}`);
  }

  /* 删掉 */
  await wide.getByRole("button", { name: /Remove this photo/i }).first().click();
  await wide.waitForTimeout(4000);
  const left = await wide.locator("figure img").count();
  say("删得掉，而且画面上跟着少一张", left === 0, `还剩 ${left} 张`);
  const { data: after } = await api
    .from("record_photos").select("id").eq("record_id", jobId);
  say("资料库里那一行也没了", (after ?? []).length === 0, `${(after ?? []).length} 行`);

  /* 390：工地上那一支手机 */
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.fill('input[type="email"]', EMAIL);
  await phone.fill('input[type="password"]', PASSWORD);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 180000 });
  await phone.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 180000 });
  await phone.waitForTimeout(1000);
  await phone.setInputFiles('input[type="file"]', {
    name: "site.png", mimeType: "image/png", buffer: fakePhoto(),
  });
  await phone.waitForTimeout(6000);
  await phone.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await phone.screenshot({ path: `${OUT}/3-phone-390.png`, fullPage: true });
  console.log("拍到  3-phone-390");
  const onPhone = await phone.locator("figure img").count();
  say("手机上也传得上", onPhone === 1, `画面上 ${onPhone} 张`);

  /* 那颗「×」在手机上按得到吗 —— 44px。 */
  const box = await phone.getByRole("button", { name: /Remove this photo/i }).first().boundingBox();
  say("手机上那颗删除按得到（≥44px）",
    !!box && box.width >= 44 && box.height >= 44, box ? `${box.width}×${box.height}` : "找不到");
} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  shots.push({ name: err.message, stuck: true });
} finally {
  if (jobId) {
    /* 照片那几行跟着单走（cascade）。桶里的档案自己删。 */
    const { data: left } = await api.from("record_photos").select("path").eq("record_id", jobId);
    if ((left ?? []).length) {
      await api.storage.from("job-photos").remove((left ?? []).map((x) => x.path));
    }
    await api.from("pipeline_records").delete().eq("id", jobId);
  }
  console.log("\n(道具清掉了)");
  if (browser) await browser.close();
}

const bad = shots.filter((s) => s.stuck);
console.log(`\n判：${bad.length} 项没过`);
if (bad.length) for (const b of bad) console.log(`  · ${b.name}`);
process.exit(bad.length ? 1 : 0);

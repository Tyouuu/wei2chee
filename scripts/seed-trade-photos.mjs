/* 重新给某个行业挑一组 demo 照片。
 *
 * 老板 2026-08-30，看着 台账 对 Newel:「还是不能完整的复刻」。骨架对上了而
 * 两页还是两回事，因为照片是两种东西 —— 他们摆完工的房间，我们摆工具跟毛胚。
 * 换的是 TRADE_QUERIES 里的词；这一支把那组词的结果抓下来、传进 storage，
 * 盖掉同名的档案，所以 .screenshots/photos/trade-photos.json 不用改。
 *
 * ⚠️ 存下来的是**我们自己的档案**，不是热连图库的 CDN —— Pixabay 允许下载自存，
 *    Unsplash 不允许（任务 21），这是当初选 Pixabay 的原因之一。
 *
 *   node scripts/seed-trade-photos.mjs renovation
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const src = fs.readFileSync("lib/images/stock.ts", "utf8");
const TRADE_QUERIES = Object.fromEntries(
  [...src.matchAll(/^  ([a-z]+): \[([^\]]+)\],$/gm)].map(([, k, v]) => [
    k,
    [...v.matchAll(/"([^"]+)"/g)].map((m) => m[1]),
  ]),
);

const trade = process.argv[2];
if (!trade) { console.error("用法: node scripts/seed-trade-photos.mjs <行业>"); process.exit(1); }

const MAP = JSON.parse(fs.readFileSync(".screenshots/photos/trade-photos.json", "utf8"));
const slots = Object.keys(MAP[trade] ?? {});
if (!slots.length) { console.error(`${trade} 不在 trade-photos.json 里`); process.exit(1); }

const words = TRADE_QUERIES[trade] ?? [];
const key = process.env.PIXABAY_KEY;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/* 每个词各拿几张，轮流取 —— 一个词包办整面墙，那面墙就只有一种房间。 */
const pool = [];
for (const w of words) {
  const r = await fetch(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(w)}&image_type=photo&orientation=horizontal&per_page=12&safesearch=true&min_width=1200`);
  const j = await r.json();
  pool.push((j.hits ?? []).map((h) => h.largeImageURL || h.webformatURL));
  console.log(`  ${w}  ${(j.hits ?? []).length} 张`);
}
const picks = [];
for (let i = 0; picks.length < slots.length && i < 12; i++)
  for (const list of pool) if (list[i] && picks.length < slots.length) picks.push(list[i]);

for (let i = 0; i < slots.length; i++) {
  const slot = slots[i];
  const url = new URL(MAP[trade][slot]);
  const path = url.pathname.split("/site-photos/")[1];
  const img = await fetch(picks[i], { headers: { "User-Agent": "Mozilla/5.0" } });
  const buf = Buffer.from(await img.arrayBuffer());
  const { error } = await db.storage.from("site-photos").upload(path, buf, { contentType: "image/jpeg", upsert: true });
  console.log(`  ${slot.padEnd(6)} ${error ? "✗ " + error.message : "✓ " + Math.round(buf.length / 1024) + "KB"}`);
}
console.log("完成。跑一次 npx vitest run scripts/demo/per-trade.test.ts 再 align。");

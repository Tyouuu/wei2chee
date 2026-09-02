/* 把 Awwwards 某几个分类的**外站网址**捞出来，一行一个。
 *
 * 拆成两支的理由：`shoot-awwwards.mjs` 每一个站都要开两次、滚五次、拍整页，
 * 24 个站要跑二十分钟；而**筛选只需要网址**。捞完丢给 `pick-site.mjs`。
 *
 * ⚠️ 分类是真的 —— 实测 2026-09-03：`business-corporate` / `restaurant` /
 * `architecture` 各 31 个，彼此重叠 0–1 个；而一个不存在的分类只回 3 个。
 * **所以「31」不是同一份预设名单**，这一点要先验过再用（脚本档头那段警告
 * 讲的就是我上一次没验的后果）。
 *
 * 用法：node scripts/harvest-awwwards.mjs business-corporate restaurant --n 8
 */
import { chromium } from "playwright";
import fs from "node:fs";

const argv = process.argv.slice(2);
const nAt = argv.indexOf("--n");
const N = nAt >= 0 ? Number(argv[nAt + 1]) || 8 : 8;
const outAt = argv.indexOf("--out");
const OUT = outAt >= 0 ? argv[outAt + 1] : "scratchpad/awwwards-urls.txt";
/* 🔴 `nAt + 1` / `outAt + 1` 在旗标**没给**的时候是 `0` —— 於是第一个分类
   永远被排除，而报告一行都不会提它。实测 2026-09-03：跑六个分类，
   `business-corporate` 整个不见，其余五个读数完全正常。
   **一个静静少掉的输入，比一个报错的输入贵得多。**
   （这支脚本的祖宗 `shoot-awwwards.mjs` 档头警告的就是同一个 index 陷阱，
   我换了个形状又踩一次。） */
const skip = new Set([nAt >= 0 ? nAt + 1 : -1, outAt >= 0 ? outAt + 1 : -1]);
const CATS = argv.filter((a, i) => !a.startsWith("--") && !skip.has(i));
if (CATS.length) console.log(`分类：${CATS.join(" · ")}`);
if (!CATS.length) { console.error("用法: node scripts/harvest-awwwards.mjs <分类...> [--n 8]"); process.exit(1); }

const b = await chromium.launch();
const seen = new Set();
const rows = [];

for (const cat of CATS) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  let slugs = [];
  try {
    const r = await p.goto(`https://www.awwwards.com/websites/${cat}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
    if ((r?.status() ?? 0) >= 400) throw new Error(`回 ${r.status()}`);
    await p.waitForTimeout(3000);
    slugs = await p.evaluate(() =>
      [...new Set([...document.querySelectorAll("a[href*='/sites/']")].map((a) => a.href))]
        .filter((h) => /awwwards\.com\/sites\//.test(h)));
  } catch (e) { console.log(`  ${cat}  ⚠️ 读不到 ${String(e.message ?? e).slice(0, 40)}`); }
  await p.close();

  /* 🔴 一个不存在的分类回的**不是 404**，是一页别的东西。实测它只回 3 个提名，
     而真的分类回 31 —— 所以少於 10 个就当成「这个分类不对」，不要拿它的读数
     去凑一份看起来很正常的报告。 */
  if (slugs.length < 10) { console.log(`  ${cat}  ⚠️ 只有 ${slugs.length} 个提名 —— 当成分类不对，跳过`); continue; }
  console.log(`\n════ ${cat}  ${slugs.length} 个提名，取前 ${N}`);

  /* 一次开四个，不要一个一个等。 */
  const pick = slugs.slice(0, N);
  for (let i = 0; i < pick.length; i += 4) {
    const batch = await Promise.all(pick.slice(i, i + 4).map(async (s) => {
      const q = await b.newPage({ viewport: { width: 1440, height: 1000 } });
      let out = null;
      try {
        await q.goto(s, { waitUntil: "domcontentloaded", timeout: 45000 });
        await q.waitForTimeout(1500);
        out = await q.evaluate(() => {
          const a = [...document.querySelectorAll("a")].find(
            (x) => /visit|website/i.test(x.innerText) && x.href.startsWith("http") && !x.href.includes("awwwards"));
          return a ? { url: a.href, title: document.querySelector("h1")?.innerText?.trim() ?? "" } : null;
        });
      } catch { /* 提名页读不到 */ }
      await q.close();
      return { s, out };
    }));
    for (const { s, out } of batch) {
      if (!out?.url) { console.log(`  ${s.split("/").filter(Boolean).pop().padEnd(30)} ← 拿不到外站网址`); continue; }
      const host = new URL(out.url).host.replace(/^www\./, "");
      if (seen.has(host)) continue;
      seen.add(host);
      rows.push(out.url);
      console.log(`  ${out.title.slice(0, 30).padEnd(31)} ${out.url}`);
    }
  }
}
await b.close();

fs.mkdirSync(OUT.replace(/[\\/][^\\/]*$/, ""), { recursive: true });
fs.writeFileSync(OUT, rows.join("\n") + "\n");
console.log(`\n${rows.length} 个网址 → ${OUT}`);
console.log(`下一步：node scripts/pick-site.mjs --from ${OUT}`);

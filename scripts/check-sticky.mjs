/* 钉住的东西不可以比视窗高。
 *
 *   npm run check:sticky
 *
 * ── 这条尺在守哪一个真的错（2026-09-01 眼睛先抓到的） ──────────────────────
 * 三张线稿都是「一段很高 + 里面一块 `sticky min-h-screen`」。量出来那一块在
 * 1440×900 上高 **1084px** —— 溢出 184px。后果不是「有点挤」：
 *   · 段底那条线跟章节标记**永远在画面外**，我加了它，没有人看得到过
 *   · 图的下缘被切掉
 *   · 而**每一项检查都是绿的**，因为没有任何东西在量这件事
 *
 * 一个比视窗高的 `sticky`，就没有「钉住」这回事 —— 它会跟着页面一起走，
 * 而那正是老板讲的「我滑的时候不够流畅」的其中一半。
 *
 * ⚠️ 它量的是**画面上的盒子**（getBoundingClientRect），不是 CSS ——
 * 这个仓库被「量到的东西不是画面上的东西」骗过至少五次。
 *
 * 判准：容器高 ≤ 视窗高 + 1px（次像素）。两个宽度都要过 ——
 * [重点 24](../docs/founder-points.md)：验收在 390 看，不是只看 1440。
 */
import { chromium } from "playwright";

const URL = process.env.BASE_URL ?? "http://localhost:3000/en";
const SIZES = [
  { w: 1440, h: 900 },
  { w: 390, h: 844 },
];

const browser = await chromium.launch();
let bad = 0;
let seen = 0;

for (const { w, h } of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);

  const rows = await page.evaluate(() =>
    [...document.querySelectorAll("[data-chapter]")].flatMap((sec) =>
      [...sec.querySelectorAll(":scope > *")]
        .filter((el) => getComputedStyle(el).position === "sticky")
        .map((el) => ({
          chapter: sec.getAttribute("data-chapter") ?? "?",
          h: Math.round(el.getBoundingClientRect().height),
          vh: window.innerHeight,
        })),
    ),
  );

  /* 一个都没找到 = 这把尺什么都没量，而它会安静地回报成功。
     这个仓库被这个形状骗过好几次（check:registers 回报「0 / 0」然后 exit 0）。 */
  if (rows.length === 0) {
    console.log(`  BAD  ${w}px  一个钉住的区段都没找到 —— 是选择器过期了，不是没问题`);
    bad++;
  }

  for (const r of rows) {
    seen++;
    const ok = r.h <= r.vh + 1;
    if (!ok) bad++;
    console.log(
      `  ${ok ? "ok  " : "BAD "} ${String(w).padStart(4)}px  ${r.chapter.padEnd(24)} 钉住的那块 ${r.h}px / 视窗 ${r.vh}px` +
        (ok ? "" : `  ← 溢出 ${r.h - r.vh}px，段底跟图的下缘看不到`),
    );
  }
  await page.close();
}

await browser.close();
console.log(bad === 0 ? `\n全部装得下（量了 ${seen} 块）` : `\n${bad} 块装不下`);
process.exit(bad === 0 ? 0 : 1);

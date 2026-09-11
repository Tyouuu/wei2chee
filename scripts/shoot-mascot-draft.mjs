/**
 * 老板要求：自己设计一个方向给他看。
 *
 *   node scripts/shoot-mascot-draft.mjs
 *
 * 不是定案，是一份草稿。第一版（纯一颗蛋形的脸）他看完说「太丑了吧
 * 我还是觉得要有形体」——这一版补上身体：脚、手、耳朵三处任何一处
 * 都能让它从「一张脸」变成「一个站得住的角色」，摊三种给他指，
 * 不是我自己先决定要哪一种（[重点 7m]：量大，三个不叫挑，这里量小
 * 是因为这是原创草稿不是抄来的参考，但道理一样——给他选项不是给答案）。
 *
 * 线条语言照抄侧栏那颗 IconSpark（1.8 描边、圆头圆尾、currentColor），
 * 全黑白，配工作台自己的强调色（--color-primary #18181b，见 globals.css）。
 */
import { chromium } from "playwright";
import fs from "node:fs";

const OUT = ".screenshots/mascot-draft";
fs.mkdirSync(OUT, { recursive: true });

const INK = "#18181b";
const PAPER = "#ffffff";

const body = `
  <path d="M60 14
           C 88 14 106 38 106 66
           C 106 100 86 122 60 122
           C 34 122 14 100 14 66
           C 14 38 32 14 60 14 Z"
        fill="${PAPER}" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round" />`;

const face = `
  <circle cx="44" cy="60" r="4.6" fill="${INK}" />
  <circle cx="76" cy="60" r="4.6" fill="${INK}" />
  <path d="M50 80 Q60 85 70 80" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round" />`;

// 三种「形体」的加法，全部只加在同一个身体上，不改身体本身
const variants = [
  {
    label: "A · 只加两只脚（站得住）",
    extra: `
      <path d="M40 118 q-4 10 -12 12" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round" />
      <path d="M80 118 q4 10 12 12" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round" />`,
  },
  {
    label: "B · 脚 + 两只小手（比出一个动作）",
    extra: `
      <path d="M40 118 q-4 10 -12 12" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round" />
      <path d="M80 118 q4 10 12 12" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round" />
      <path d="M15 70 Q2 62 4 48" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round" />
      <path d="M105 70 Q118 60 112 46" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round" />`,
  },
  {
    label: "C · 脚 + 两只小耳朵（比较像一个宠物）",
    extra: `
      <path d="M40 118 q-4 10 -12 12" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round" />
      <path d="M80 118 q4 10 12 12" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round" />
      <path d="M38 20 C 30 6 20 4 14 10 C 22 16 26 22 32 28 Z" fill="${PAPER}" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round" />
      <path d="M82 20 C 90 6 100 4 106 10 C 98 16 94 22 88 28 Z" fill="${PAPER}" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round" />`,
  },
];

function cell({ label, extra }) {
  return `
  <div class="cell">
    <svg viewBox="-10 -10 140 150" width="200" height="215">
      ${body}
      ${face}
      ${extra}
    </svg>
    <div class="label">${label}</div>
  </div>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8" /><style>
  body { margin:0; background:#f4f4f5; font-family: system-ui, -apple-system, sans-serif; padding:40px; }
  h1 { font-size:15px; color:#52525b; font-weight:600; margin:0 0 6px; }
  p { font-size:12px; color:#a1a1aa; margin:0 0 28px; }
  .row { display:flex; gap:24px; }
  .cell { background:#fff; border:1px solid #e4e4e7; border-radius:16px; padding:16px 20px 14px;
          display:flex; flex-direction:column; align-items:center; }
  .label { font-size:12px; color:#71717a; margin-top:8px; text-align:center; }
</style></head><body>
  <h1>第二版——补上形体，同一个身体，三种加法</h1>
  <p>身体本身没有变，差别只在脚／手／耳朵三处加了哪几处</p>
  <div class="row">
    ${variants.map(cell).join("")}
  </div>
</body></html>`;

fs.writeFileSync(`${OUT}/draft2.html`, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 320 }, deviceScaleFactor: 2 });
await page.goto(`file://${process.cwd()}/${OUT}/draft2.html`.replace(/\\/g, "/"), { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/pick2.jpg`, fullPage: true });
await browser.close();

console.log(`${OUT}/pick2.jpg`);

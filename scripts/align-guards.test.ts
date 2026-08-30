import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* ── 尺子不准再犯的错 ──────────────────────────────────────────────────────
 *
 * 老板 2026-08-30:「然后把全部常用的错误写进去尺子 尺子不能再犯还是什么的」.
 *
 * 这一天在 align 自己身上抓到十几个 bug，而它们不是十几件事，是**几种形状**
 * 重复出现。写一份清单没有用 —— 清单会被后来的人跳过。所以这里把**查得到的
 * 那几种**做成会红的测试，读的是尺子自己的原始码。
 *
 * ⚠️ 它查不到什么，写清楚：它查的是「有没有再写出同一个形状」，不是「这次量
 * 得对不对」。量得对不对只有拿它去改一次页面才知道 —— 今天最凶的三个洞
 * （背景图看不见 · 兄弟层被丢掉 · 只走子孙）全部是那样现形的。
 */
const MJS = readFileSync("scripts/align-site.mjs", "utf8");
const PY = readFileSync("scripts/align-palette.py", "utf8");
const lines = MJS.split("\n");

/** 去掉注解 —— 注解里写着「以前是 \s」这种句子，那是纪录不是代码。 */
const code = lines
  .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
  .join("\n");

describe("尺子不准再犯", () => {
  /* ① 正则里的双反斜线。
     `/^(OK|XX)\s+第/` 在正则里是「一个反斜线接一个 s」，永远不匹配 ——
     逐段颜色的判定因此从来没有进过总数：画面一排 XX，结论当它不存在。 */
  it("正则里没有两个反斜线接 s / d 这种永远不匹配的写法", () => {
    /* ⚠️ 这个守卫第一版自己写错了：它用一个正则去找正则，而那一层转义写成了
       「一个反斜线」，於是把每一个**正确**的写法都判成错。一个把对的判成错的
       守卫，跟一个把错的判成对的一样没用 —— 而且更烦，因为人会去关掉它。
       改成用字元码组一个明确的三字元字串，没有第二层转义可以出错。 */
    const B = String.fromCharCode(92);
    const bad = lines.filter(
      (l) =>
        !/^\s*(\/\/|\/\*|\*)/.test(l) &&
        (l.includes(B + B + "s") || l.includes(B + B + "d")) &&
        /\.exec\(|\.test\(|\.match\(/.test(l),
    );
    expect(bad, bad.join(String.fromCharCode(10))).toEqual([]);
  });

  /* ② 写死的桌面宽度。
     readSections 曾经要求一段 `w >= 1300` 才算数。390px 的页面上没有任何
     东西有 1300 宽，於是模版回报「段数 0 · 整页高 0px」—— 一个长得像读数的
     空答案。门槛要问「有没有铺满这一页」，不是「有没有 1300 宽」。 */
  it("没有把桌面宽度写死当门槛", () => {
    const bad = lines.filter(
      (l) => !/^\s*(\/\/|\/\*|\*)/.test(l) && /[><]=?\s*(1[2-4]\d{2})\b/.test(l) && /width|\.w\b|innerWidth/.test(l),
    );
    expect(bad, bad.join("\n")).toEqual([]);
  });

  /* ③ 常数冒充读数。
     位移那一格曾经在 transform 是 `none` 的时候回传常数 60，三套整整齐齐
     印出「位移 60px」—— 那是我写的哨兵，印出来跟真读数一模一样。
     量不到就回 null 走「量不到」，不要回一个看起来可信的数字。 */
  it("量测函式不会在量不到的时候回一个常数", () => {
    const bad = lines.filter(
      (l) => !/^\s*(\/\/|\/\*|\*)/.test(l) && /return\s+[1-9]\d{1,}\s*;/.test(l) && !/length|index|slice|padStart/.test(l),
    );
    expect(bad, bad.join("\n")).toEqual([]);
  });

  /* ④ 同一个问题两个答案。
     「段数」用 ±1 判过、「配得上的段」判不过；「照片张数」数所有 <img>、
     「照片 SHOTS」只数 ≥120×90。一份报告里两个相反的答案，人只读最后一行。 */
  it("没有两项检查叫同一个名字", () => {
    const names = [...code.matchAll(/check\(\s*"[^"]+"\s*,\s*"([^"]+)"/g)].map((m) => m[1]);
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    expect([...new Set(dup)], `重复的项目名：${dup.join(" · ")}`).toEqual([]);
  });

  /* ⑤ 两边都量不到 = 判过关。
     時长（dominant() 各回 0 → near(0,0,90) → true）、缓动（"—" === "—"）、
     减少动效（undefined === undefined）…… 八项。一页被 Cloudflare 挡住，
     整根动效轴会安静地全绿。judge() 就是为这件事写的。 */
  it("judge() 还在，而且被用着", () => {
    expect(code).toMatch(/const judge = \(/);
    expect((code.match(/judge\(/g) ?? []).length).toBeGreaterThan(6);
  });

  /* ⑥ 一个永远不会红的检查。
     `check(..., true)` 是一句宣告，不是一次量测。要嘛给条件，要嘛给 null。 */
  it("没有 check(..., true) 这种永远过关的项目", () => {
    expect(code).not.toMatch(/check\([^)]*,\s*true\s*\)/);
  });

  /* ⑦ decode() 会永远不返回。
     一张 loading="lazy" 的图滚过去又滚回来之后既不解码也不失败。
     .catch() 接得了「拒绝」，接不了「不回来」。 */
  it("decode() 有时间上限", () => {
    if (!/\.decode\(/.test(code)) return;
    const near = code.slice(Math.max(0, code.indexOf(".decode(") - 400), code.indexOf(".decode(") + 400);
    expect(near, "decode() 必须跟一个 timeout race").toMatch(/Promise\.race/);
  });

  /* ⑧ 拒绝，而不是给一个错的答案。
     参考页没载完、写库没切到这一套风格 —— 两种都会让整份报告在讲另一页。 */
  it("参考没载完、风格没切到，都会 exit 1", () => {
    expect(code).toMatch(/auditCapture/);
    expect((code.match(/process\.exit\(1\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  /* ⑨ 验收那一段不准拿掉。
     清单全绿不算做完 —— 台账第6段那一次它是绿的，而两边根本不是同一个设计。 */
  it("报告结尾还印着「用眼睛看」的验收步骤", () => {
    expect(MJS).toMatch(/验收 —— 上面全绿也不算做完/);
    expect(MJS).toMatch(/align-pairs\.py/);
  });

  /* ⑩ 逐段颜色那一支也要守同一条：照片铺满的段答不了「配色一不一样」。 */
  it("逐段颜色会跳过照片铺满的段", () => {
    expect(PY).toMatch(/photo_led/);
    expect(PY).toMatch(/照片铺满这一段/);
  });
});

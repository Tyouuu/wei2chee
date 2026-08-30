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
  /* ⑪ 看不看得见，要问整条祖先链。
     2026-08-31：Newel 第4段六张照片上，尺子读到「01」「The Nelson's Project」——
     照片上一个字都没有。那些字的祖先 `span._details_` 是 opacity:0 的 hover
     浮层，而 **opacity 不继承计算值**，所以只问元素自己的写法永远看不到它。
     我照那个读数在我们的照片上压了工程编号 —— 凭一个看不见的东西，
     在我们的页面上造了一个他们没有的东西。 */
  it("「看得见」问的是整条祖先链，不是元素自己", () => {
    expect(MJS).toMatch(/checkVisibility/);
    expect(MJS).toMatch(/opacityProperty:\s*true/);
  });

  /* ⑫ 顺序要按眼睛读的顺序，不按 DOM，也不按一个固定的桶宽。
     台账第3段判过两次不及格：两边都是「左边一栏字，右边一张照片」，而他们的
     照片比标题高 6%，我们的齐平 —— 一个固定桶宽永远会有一对刚好跨在桶边上的
     东西。并排的定义是**垂直范围有没有重叠**，那没有边界可以跨。 */
  it("顺序按垂直重叠分行，不按固定桶宽", () => {
    const fn = MJS.slice(MJS.indexOf("const seqOf ="), MJS.indexOf("const seqOf =") + 900);
    expect(fn).not.toMatch(/y0\s*\/\s*\d/);
    expect(fn).toMatch(/Math\.min\(r\.y1, b\.y1\)/);
  });

  /* ⑬ 一颗按钮上的字不是一栏字。
     Wix 的按钮是 <a> 套 <span>，我们的 <a> 自己带字 —— 同一颗按钮，他们多出
     一个字块。第4段因此报「几栏 5对3」，而两边的排版一模一样。 */
  it("按钮自己的字不算一栏字", () => {
    expect(MJS).toMatch(/labelled/);
  });
  /* ⑭ 量完要再读一次风格。
     2026-08-31：我把五套丢到背景跑、又在前台跑 ledger —— 开头写 ledger、
     读回来是 ledger、守卫放行，接着另一个进程把同一个 demo project 切走，
     拍到的是别人的页面。报告印了六十项「台账」的读数，而手机那张图是洋红色的、
     公司名是别人的、一张照片都没有。三项检查只是「转红」，没有一项说这一份
     不算数。一次写一次读防的是写失败；量完再读一次，防的是量到一半被换掉。 */
  it("拍完之后会再确认一次 demo 站还是这一套风格", () => {
    const after = MJS.slice(MJS.indexOf("-ours-390"));
    expect(after).toMatch(/select\("style"\)/);
    expect(after).toMatch(/这一次测量不算数：拍完之后/);
  });
  /* ⑮ 跳过一项要印「没量」，不准印「过关」。
     `--desktop` 省掉手机那一遍是为了改桌面轴的时候快一半；一把跳过一项却
     回报绿的尺，这个仓库被骗过四次。手机那一段拿不到读数时走 `量不到`。 */
  it("--desktop 跳过手机，手机那几项印「量不到」不是绿的", () => {
    expect(MJS).toMatch(/SKIP_PHONE/);
    const blk = MJS.slice(MJS.indexOf("手机 390"));
    expect(blk).toMatch(/if \(!tp \|\| !op\)/);
    expect(blk).toMatch(/"手机 390px", "量不到", "量不到", null/);
  });

  /* ⑯ 存下来的参考快照比某个字段旧的时候，要讲出来。
     一整栏「—」读起来像「他们那些元素没有身分」，而其实是快照太旧 ——
     一个看起来像读数的空值，跟一个错的读数一样会误导人。 */
  it("参考快照比 sel 旧的时候会讲出来", () => {
    expect(MJS).toMatch(/存下来的参考比这个字段旧/);
  });
  /* ⑰ 一项检查交白卷（写死 null），必须在这里写下**为什么它答不了**。
     2026-08-31：`最常用的圆角` 只印不判、连一句理由都没有，而它印着一个真的
     差异 —— 模版没有圆角、我们 5.1px 铺在七个元素上。它就坐在报告尾巴那句
     「量不到不是过关，下一个差异就藏在那几项里」讲的地方，坐了好几天。
     另外两个只印不判的都写了理由（同一个问题下面那一项问得更准），
     所以缺理由不是惯例，是漏掉。名单只能缩短；要加新的，先在这里写理由。 */
  it("每一项交白卷的检查都在这里写下了理由", () => {
    const BLANK: Record<string, string> = {
      段数: "下面的「配得上的段」问同一件事，问得更准（它知道多出来的是哪一段）",
      标题字体: "两边永远不同名 —— 他们的字有授权，我们用不了，判名字等於判一件做不到的事",
      字体档载入: "只是说明上面那两行是宣告的还是画面上的",
      宣告的字体档: "清单，不是读数",
      标题字重: "同一个 400 在两个字体上可以差五倍黑；判「墨量」，不判宣告的数字",
      正文字体: "同 标题字体",
      "手机 390px": "两边有一边没拍到手机 —— 这是拒绝作答，不是过关",
    };
    const found = [...MJS.matchAll(/check\("[^"]+",\s*"([^"]+)"[^;]*?,\s*null\s*\)\s*;/g)].map((m) => m[1]);
    for (const name of found) expect(Object.keys(BLANK)).toContain(name);
    expect(found.length).toBeLessThanOrEqual(Object.keys(BLANK).length);
  });
});

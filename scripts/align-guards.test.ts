import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
const ALL = readFileSync("scripts/align-all.mjs", "utf8");
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
  /* ⑱ 跑子集不准把整份快照写掉。
     2026-08-31：我跑了几次 `align:all -- ledger`，每一次都把快照写成「只有
     ledger」；再跑全部的时候，另外五套全部回报「第一次量」——
     **这张表唯一的用处就是记得上一次，而它把上一次弄丢了。** */
  it("align:all 跑子集会合并快照，不会覆盖", () => {
    expect(ALL).toMatch(/\.\.\.\(before\.regs \?\? \{\}\)/);
  });

  /* ⑲ 「尺子长出一根新轴」跟「页面坏了」在表上不能长得一样。
     加了「逐段正文字级」跟「最常用的圆角」之后六套每一套都 +1~+2，
     而那跟任何一个页面都无关。快照记下**见过哪些检查**才分得开。 */
  it("新加的检查会讲成「尺子新加」，不算页面新红", () => {
    expect(ALL).toMatch(/seen:/);
    expect(ALL).toMatch(/尺子新加/);
  });

  /* ⑳ 分段规则不准把宽度门槛钉在视窗上。
     `tailark.com` 有一条 168px 侧栏，於是它的 main 只有视窗的 88% ——
     旧规则「宽度 ≥ 视窗的 90%」让整页读到 **0 段**。任何有侧栏、有外壳、
     有最大宽度的模版都会这样，而尺子要能对付任何模版。 */
  it("分段的宽度门槛比的是这一层最宽的，不是视窗", () => {
    expect(MJS).not.toMatch(/node \|\| x\.w >= window\.innerWidth \* 0\.9/);
    expect(MJS).toMatch(/Math\.max\(\.\.\.all\.map\(\(y\) => y\.w\)\) \* 0\.9/);
  });

  /* ㉑ `--probe` 载不到就要 exit 1。
     一个空页面读起来跟「这一页很简单」一模一样。 */
  it("--probe 载不到一个网址会拒绝，不会印一份漂亮的空报告", () => {
    const blk = MJS.slice(MJS.indexOf('--probe'), MJS.indexOf('--probe') + 3000);
    expect(blk).toMatch(/载不到/);
    expect(blk).toMatch(/process\.exit\(1\)/);
  });
  /* ㉒ 分段的线不准穿过一张照片。
     Squarespace 的 mojave 模版：五条线四条对，第一条切在第一屏那张大图中间 ——
     数字看起来完全正常（5 段 · 5130px · 3 张图），而分段是错的。
     一条穿过照片的线不用看内容就判得了，所以尺子要自己讲出来。 */
  it("--probe 会说出「段界切开了照片」", () => {
    expect(MJS).toMatch(/张照片被段界切开/);
  });
  /* ㉓ 一块字的宽度量的是**墨迹**，不是它那个盒子。
     Wix 把每行字包在行内的 span（盒子＝字宽），我们用块级的 p（盒子＝整栏宽）
     —— 同一句话两个宽度，「段内的缝」因此报他们 8% 我们 1%，而两页排版一样。
     `Range.getClientRects()` 是浏览器自己的答案；视觉回归那一整类比的是图片，
     答不了这件事。 */
  it("字块的宽度用 Range 的行盒，不用元素的盒子", () => {
    expect(MJS).toMatch(/getClientRects/);
    expect(MJS).toMatch(/inkRect/);
  });

  /* ㉔ 「够不够大」跟「画到哪里」是两个问题，不能共用一个矩形。
     第一版两个都用墨迹，「01」「24/7」这种短字被 3% 那道门槛当成装饰丢掉，
     尺子自己的自检当场红「模版分段漏字 · 漏图」。 */
  it("大小的门槛用元素的盒子判，几何用墨迹", () => {
    const blk = MJS.slice(MJS.indexOf("const push = (el, kind, extra)"), MJS.indexOf("const push = (el, kind, extra)") + 900);
    expect(blk).toMatch(/const box = el\.getBoundingClientRect\(\)/);
    expect(blk).toMatch(/box\.width < PAGE \* 0\.03/);
    expect(blk).toMatch(/kind === "字" \? inkRect\(el\) : null/);
  });
  /* ㉕ 载页面要**载到不再变为止**，不准滚固定的轮数。
     blueprint 的参考拍回来少了整个第一屏的大标题、副标、按钮跟团队照片；
     版心量到 2%–59%、正文量到 81px、44% 的字掉在段外 —— 而
     `auditCapture` 没有拒绝，因为没有哪一段是**完全**空的。
     滚固定轮数等於赌这一页的进场动画在第几轮跑完，Wix 那一页赌输了。 */
  it("载页面滚到看得见的字不再变，不是滚固定轮数", () => {
    const blk = MJS.slice(MJS.indexOf("async function settlePage"), MJS.indexOf("async function shoot("));
    expect(blk).toMatch(/stable/);
    /* ⚠️ 守的是**机制**，不是那个数字。上限从 5 改成 8（A. Reynolds 要更慢的
       那一轮）的时候，这条断言红了 —— 而它红得没有道理：轮数上限是天花板，
       「滚到不再变」才是这条规矩。守一个常数，等於每次调参都要来改守卫一次，
       改久了就会有人把守卫改成永远绿的。 */
    expect(blk).toMatch(/stable < 2/);
    expect(blk).toMatch(/pass < \d+ && stable < 2/);
  });

  /* ㉖ probe 跟正式那条必须用**同一份**载页面的程序。
     一个跟尺子载法不同的诊断工具，诊断的是另一页 —— 那正是这一次
     「probe 说 7 张图、align 说 3 张」花掉的那几轮。 */
  it("probe 跟 shoot 共用同一支 settlePage", () => {
    expect((MJS.match(/settlePage\(p,/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
  /* ㉗ 采集不完整要**重拍一次，再不过就拒绝**。
     blueprint 的参考少了整个第一屏的大标题、副标、按钮跟团队照片，而
     auditCapture 放行了 —— 它只查「有没有哪一段是完全空的」，那一页每一段
     都还有东西。**一份半空的采集长得跟一份好的一模一样。**
     而且它不稳定：单独跑拍得到，六套连着跑就拍不到。所以答案不是多滚几轮
     （那只是把赌注加大），是宁可大声拒绝，不要安静地给错答案。 */
  it("参考拍得不完整会重拍，两次都不完整就 exit 1", () => {
    expect(MJS).toMatch(/function captureThin/);
    expect(MJS).toMatch(/重拍一次/);
    expect(MJS).toMatch(/连拍两次都不完整/);
  });

  /* ㉘ 自检要**永远印**，绿的也印。
     2026-08-31：六套跑完，没有一份报告出现「漏字」「漏图」—— 而那份沉默有两种
     读法，「量过了没漏」跟「这两项根本没跑」，两种长得一模一样。
     任务 81 那一次它真的漏了 44%，报告也是安静的，安静了三天。
     **一把只在坏的时候说话的自检，说不出「我还活着」。** */
  it("分段漏字 · 漏图 绿的时候也要印出读数", () => {
    const blk = MJS.slice(MJS.indexOf("const inBoxes ="), MJS.indexOf("const TS = TSHAPE"));
    // 不准再有「只在坏的时候才印」的形状
    expect(blk).not.toMatch(/if \(all - held > 1\) \{/);
    expect(blk).toMatch(/okImg \? "OK" : "XX"/);
    expect(blk).toMatch(/okCh \? "OK" : "XX"/);
    // 字太少的时候要说「不判」，不准算成过关
    expect(blk).toMatch(/太少，比例不判/);
    expect(blk).toMatch(/name: `\$\{who\}分段漏字`, ok: null/);
  });

  /* ㉙ 分段漏图要**两个方向**都问，而且两边要数**同一群东西**。
     招牌第一次印出读数就是「这一页 14 张，各段装下 15 张」——`all - held > 1`
     那一边永远看不到它。
     ⚠️ 而第一版补上之后我犯了更糟的一个：给差额配了一句「段界穿过它」的诊断。
     查下去 readShape 对 <img> **没有尺寸下限**、readShots 有（120×90）——
     多出来的大半是图标跟小 logo。**一句听起来很有道理的解释，配一个错的数字。**
     所以两件事一起守：同一道门槛，以及不准写死一个没证明过的原因。 */
  it("分段漏图 两个方向都问，而且跟 readShots 同一道门槛", () => {
    const blk = MJS.slice(MJS.indexOf("const bigPic ="), MJS.indexOf("const TS = TSHAPE"));
    expect(blk).toMatch(/held - all <= 1/);
    expect(blk).toMatch(/>= 120/);
    expect(blk).toMatch(/>= 90/);
    // 只讲读数，不讲原因
    expect(blk).not.toMatch(/被两段各算了一次/);
    expect(blk).toMatch(/或者同一块地方被数了两次/);
  });

  /* ㉚ 两个 align 不准同时跑。
     十套共用一个 demo project：第二个的切换会把第一个正在拍的页面换掉，
     拍回来的是别人的公司名跟别人的配色，而报告照样一项一项印。
     发生过两次，第二次是我自己 —— 而两次都只有其中一个进程知道。
     开跑前的锁挡两个 npm；拍完之后的复查挡在 Studio 里手改的。两道都要在。 */
  it("开跑前有锁，而且死掉的锁会被接手", () => {
    expect(MJS).toMatch(/已经有一个 align 在跑/);
    expect(MJS).toMatch(/flag: "wx"/);            // 存在就失败，不是覆盖
    expect(MJS).toMatch(/process\.kill\(held\.pid, 0\)/); // 问系统那个进程还在不在
    expect(MJS).toMatch(/上一次的锁没清干净/);
    expect(MJS).toMatch(/SIGINT/);                 // Ctrl-C 也要放开
    // 拍完之后的复查不准被这把锁取代
    expect(MJS).toMatch(/拍完之后 demo 站已经不是/);
  });

  /* ㉛ 载不出来的图要**每一次都印**。
     把 満図 第3段裁成原尺寸用眼睛看，他们右边那一格是一个**破图框** ——
     而尺子把它当成一张 40% 宽的照片在比，报「最宽的图 100%对40%」。
     一个失败的 <img> 有宽有高、进得了段、算得进张数，跟图有关的每一项读数
     都被它拉走，而报告读起来跟对的一模一样。
     ⚠️ 旧的快照没有这一栏 —— 那要说「量不到」，不准当成「0 张」。 */
  it("载不出来的图 每一次都印，旧快照说量不到不说 0", () => {
    expect(MJS).toMatch(/naturalWidth === 0/);
    expect(MJS).toMatch(/载不出来的图  0 张/);
    expect(MJS).toMatch(/这份采集是旧的，没有这一栏/);
    // 破图不该被大小过滤悄悄丢掉，但也不该把 16px 的图标算进来
    expect(MJS).toMatch(/x\.w >= 60 && x\.h >= 60/);
  });

  /* ㉜ 「一个正文尺寸」是一根**风格轴**，不是一个全域改动。
     每一份参考都靠一级撑起半页以上（招牌 75% · 中台 90%），我们碎成三级。
     但 图纸 的参考真的有两级（18px 48% + 16px 27%）—— 一刀切会把它抄成
     另一页。所以这一条守的是「它可以被单独关掉」，不是「大家都要收」。 */
  it("steps 一个正文尺寸 是 opt-in，而且不收 xs/micro", () => {
    const css = readFileSync(resolve("app/globals.css"), "utf8");
    const blk = css.slice(css.indexOf('[data-steps="one"]'), css.indexOf('[data-steps="one"]') + 700);
    expect(blk).toMatch(/--text-lg: var\(--text-base\)/);
    expect(blk).toMatch(/--text-sm: var\(--text-base\)/);
    expect(blk).not.toMatch(/--text-xs: var\(--text-base\)/);
    expect(blk).not.toMatch(/--text-micro: var\(--text-base\)/);
    const comp = readFileSync(resolve("lib/templates/site-composition.ts"), "utf8");
    expect(comp).toMatch(/steps\?: "one"/);
    // 图纸 必须留着两级，而且理由要写在旁边
    /* 只切 图纸 自己那一段 —— 600 个字元会切进下一套，而下一套是有 steps 的。 */
    const bpStart = comp.indexOf("  blueprint: {");
    const bp = comp.slice(bpStart, comp.indexOf("\n  },", bpStart));
    /* 锚在行首 —— 那段注解自己就写着「故意没有 steps: "one"」，
       不锚的话守卫会被它要守的那句解释打败。 */
    expect(bp).not.toMatch(/^\s*steps: "one",/m);
    expect(bp).toMatch(/两级/);
  });

  /* ㉝ 「逐段正文字级」不准拿展示型的字当正文。
     招牌 第5段是 **19 个字、全部 225px** —— 一个招牌上的词。尺子拿它比我们
     那一段的 17px，报「225对16px」，读起来像正文差了 13 倍。
     ⚠️ 而这条规矩最容易被拿来买分数：门槛一放宽就会盖掉真的差异
     （招牌第3段 28对17、图纸第7段 16对21）。所以守两件：门槛是「自己那一页
     正文的两倍」这个**相对**量，而且跳过的段要**印出来**，不准安静地少判一段。 */
  it("逐段正文字级 跳过没有正文的段，而且把跳过的印出来", () => {
    const blk = MJS.slice(MJS.indexOf("const pageBody ="), MJS.indexOf("const pageBody =") + 1400);
    expect(blk).toMatch(/pbT \* 2/);
    expect(blk).toMatch(/pbO \* 2/);
    expect(blk).toMatch(/没有正文可以比 —— 不判/);
    // 门槛必须是相对页面正文，不准写成一个绝对 px
    expect(blk).not.toMatch(/> 40/);
  });
});

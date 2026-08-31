"use client";

import { useTranslations } from "next-intl";
import { LineScene, Stroke, circle, Mark } from "./line-scene";

/**
 * 三张线稿，讲完整个产品 —— consider.digital 的做法落在我们的东西上。
 *
 * ── 2026-09-01 整个重画。老板：「不够有特点」「可以设计的比较有故事感」──────
 * 回去逐格看模版，差别一句话讲得完：**他们画世界，我们画后台。**
 * 他们那八段画的是风机 · 太阳能板 · 冷却塔 · 电塔 · 手机 · 灯泡 · 线框地球；
 * 我们那三张画的是浏览器外框、表格、卡片 —— **全部是介面**，
 * 而一个装修老板对「浏览器外框」没有任何感情。
 *
 * 现在画的是他认得的东西，而且是一条故事线：
 *   01  他的店屋 · 他的货车 · 他讲的那一句 → 一张清单
 *   02  他现在那叠单 · 他的本子 →（箭头）→ 一台机器
 *   03  规格书 · 真的有人在建 · 招牌亮起来 · 陌生人的手机 → 落进来一行
 *
 * 另外两件也是从模版量回来的：**图满幅贴底、站在一条地平线上、底下标名字**，
 * 而且**每一段一个大数字**（他们是 400,000 伏 / 120,000 / 1）。
 * ⚠️ 大数字只能写**真的、而且有守卫盯着的**数（[任务 19](../../docs/founder-tasks.md)：
 * 假的不上线）—— 所以这里只有「2 分钟」「6 套」「RM 500」，
 * 三个都在 pricing-consistency / landing-claims 的守卫里。
 *
 * ⚠️ 机制在 line-scene.tsx，只有一份。这里只描述**画什么**。
 * ⚠️ 论证归线稿，**证据归截图**（三步那一段的真画面）—— 两个不互相取代。
 */

const W = 1200;
/** 地平线。模版的地平线大约在画面 78% 的高度，每一样东西都站在上面。 */
const GROUND = 330;
const VB = `0 0 ${W} 420`;

/** 一间店屋：外墙 + 招牌 + 遮阳篷 + 门 + 窗。马来西亚 SME 的世界就是这个形状。 */
function shoplot(x: number, w: number, top: number) {
  const r = x + w;
  const mid = x + w / 2;
  return (
    `M${x} ${GROUND} V${top} H${r} V${GROUND}` +
    ` M${x + 14} ${top + 14} H${r - 14} V${top + 48} H${x + 14} Z` +
    ` M${x - 8} ${top + 68} H${r + 8}` +
    ` M${mid - 26} ${GROUND} V${GROUND - 64} H${mid + 26} V${GROUND}` +
    ` M${x + 18} ${GROUND - 78} H${x + 54} V${GROUND - 44} H${x + 18} Z`
  );
}

/** 一个人：头 · 身 · 两手 · 两脚。 */
function person(x: number, h = 76) {
  const top = GROUND - h;
  return (
    circle(x, top + 10, 10) +
    ` M${x} ${top + 20} V${GROUND - 26}` +
    ` M${x - 14} ${top + 32} H${x + 14}` +
    ` M${x} ${GROUND - 26} L${x - 11} ${GROUND}` +
    ` M${x} ${GROUND - 26} L${x + 11} ${GROUND}`
  );
}

/* ── 01 他讲的那一句 ─────────────────────────────────────────────────────── */
export function SentenceDrawing() {
  const t = useTranslations("draw1");
  const steps = [t("s1"), t("s2"), t("s3"), t("s4"), t("s5")];

  const base = `M0 ${GROUND} H${W}`;
  const shops = `${shoplot(50, 200, 140)} ${shoplot(272, 200, 108)}`;

  /* 他的货车 —— 车斗 + 车头 + 两个轮子，站在同一条地平线上。 */
  const van =
    `M520 ${GROUND} V240 H700 V${GROUND}` +
    ` M700 268 H734 L756 292 V${GROUND} H700 Z` +
    ` M706 274 H730 V292 H706 Z ` +
    circle(566, GROUND - 14, 14) +
    " " +
    circle(726, GROUND - 14, 14);
  const man = person(812);

  /* 他讲的那一句 —— 一个对话框，尾巴指着他。 */
  const bubble = "M600 12 H1170 V120 H880 L846 152 L852 120 H600 Z";
  const said = [46, 74, 102].map((y, i) => `M628 ${y} H${[1080, 1142, 940][i]}`).join(" ");
  /* 认出来的那几个词 —— 整张图唯一有颜色的地方。 */
  const marks = [700, 880, 1010].map((x) => `M${x} 116 v-26`).join(" ");

  /* 收成一张清单，立在地平线上。 */
  const list =
    `M900 ${GROUND} V184 H1170 V${GROUND} Z` +
    [214, 244, 274, 304].map((y, i) => ` M924 ${y} H${[1146, 1090, 1146, 1062][i]}`).join("");

  return (
    <LineScene
      eyebrow={t("eyebrow")}
      title={t("title")}
      body={t.rich("body", { m: Mark })}
      aside={t("aside")}
      steps={steps}
      figure={t("figure")}
      figureCap={t("figureCap")}
      labels={[t("l1"), t("l2"), t("l3"), t("l4")]}
      viewBox={VB}
    >
      {(stage) => (
        <>
          <Stroke d={base} k={stage(0)} />
          <Stroke d={shops} k={stage(0)} />
          <Stroke d={van} k={stage(1)} />
          <Stroke d={man} k={stage(1)} />
          <Stroke d={bubble} k={stage(2)} />
          <Stroke d={said} k={stage(2)} w={5} />
          <Stroke d={marks} k={stage(3)} w={2} accent />
          <Stroke d={list} k={stage(4)} />
        </>
      )}
    </LineScene>
  );
}

/* ── 02 纸变成一台机器 ───────────────────────────────────────────────────── */
export function SystemDrawing() {
  const t = useTranslations("drawing");
  const steps = [t("s1"), t("s2"), t("s3"), t("s4"), t("s5"), t("s6")];

  const base = `M0 ${GROUND} H${W}`;

  /* 他现在那叠单 —— 三张错开的纸，立在地平线上。 */
  const papers = [0, 1, 2]
    .map((i) => {
      const x = 44 + i * 26;
      const y = 150 + i * 18;
      return (
        `M${x} ${GROUND} V${y} H${x + 150} V${GROUND}` +
        [28, 56, 84].map((d) => ` M${x + 18} ${y + d} H${x + 132 - d / 3}`).join("")
      );
    })
    .join(" ");

  /* 他的本子 —— 摊开的账簿，中间一条书脊。 */
  const book =
    `M320 ${GROUND} L400 292 H540 L620 ${GROUND} Z` +
    ` M470 292 V${GROUND}` +
    [0, 1, 2]
      .map((i) => ` M${404 + i * 6} ${300 + i * 9} H460 M480 ${300 + i * 9} H${536 - i * 6}`)
      .join("");

  const arrow = "M652 250 H744 M722 236 l22 14 -22 14";

  /* 一台机器 —— 萤幕 + 脚 + 底座，站在同一条地平线上。 */
  const machine = `M780 60 H1170 V286 H780 Z M975 286 V312 M886 312 H1064 M886 ${GROUND} H1064`;
  const inside =
    "M780 94 H1170 M876 94 V286" +
    [0, 1, 2, 3].map((i) => ` M${892 + i * 68} 112 h52 v40 h-52 Z`).join("");
  const table =
    "M892 172 H1152 M892 172 V266 M1152 172 V266 M892 266 H1152" +
    [196, 220, 244].map((y) => ` M892 ${y} H1152`).join("") +
    [978, 1064].map((x) => ` M${x} 172 V266`).join("");
  const flow = [0, 1, 2].map((i) => `M${798 + i * 62} 196 h48 v34 h-48 Z`).join(" ");

  return (
    <LineScene
      id="how-built"
      eyebrow={t("eyebrow")}
      title={t("title")}
      body={t.rich("body", { m: Mark })}
      aside={t("aside")}
      steps={steps}
      figure={t("figure")}
      figureCap={t("figureCap")}
      labels={[t("l1"), t("l2"), t("l3")]}
      viewBox={VB}
    >
      {(stage) => (
        <>
          <Stroke d={base} k={stage(0)} />
          <Stroke d={papers} k={stage(0)} />
          <Stroke d={book} k={stage(1)} />
          <Stroke d={arrow} k={stage(2)} />
          <Stroke d={machine} k={stage(3)} />
          <Stroke d={inside} k={stage(4)} />
          <Stroke d={table} k={stage(4)} />
          {/* 整张图只有一个地方有颜色 —— 跟收据那一行同一条规矩。 */}
          <Stroke d={flow} k={stage(5)} w={2} accent />
        </>
      )}
    </LineScene>
  );
}

/* ── 03 交出去，招牌亮起来，客人从那里进来 ───────────────────────────────── */
export function HandoverDrawing() {
  const t = useTranslations("draw3");
  const steps = [t("s1"), t("s2"), t("s3"), t("s4"), t("s5")];

  const base = `M0 ${GROUND} H${W}`;

  /* 你点头的那份规格书 —— 一本立着的册子。 */
  const spec =
    `M40 ${GROUND} V96 H208 V${GROUND} Z M62 96 V${GROUND}` +
    [132, 162, 192, 222, 252].map((y, i) => ` M80 ${y} H${[188, 166, 190, 150, 176][i]}`).join("");

  /* 真的有人去建 —— 两个人加一把梯子。 */
  const crew =
    `${person(268)} ${person(452, 66)}` +
    ` M330 ${GROUND} V150 M392 ${GROUND} V150` +
    [180, 216, 252, 288].map((y) => ` M330 ${y} H392`).join("");

  /* 你的官网上线 —— 店屋加一块亮起来的招牌。 */
  const shop = shoplot(560, 220, 128);
  const litSign = "M574 142 H766 V176 H574 Z";

  /* 陌生人问价钱 —— 一支手机，一段讯号弧连回招牌。 */
  const phone =
    `M1030 ${GROUND} V140 H1150 V${GROUND} Z M1030 168 H1150 M1030 300 H1150` +
    [196, 222, 248].map((y, i) => ` M1052 ${y} H${[1128, 1104, 1120][i]}`).join("");
  const arc = "M1024 210 Q900 150 782 186";

  /* 落成一行记录，在你自己的栏位里 —— 唯一有颜色的一笔。 */
  const row =
    "M560 356 H1150 V404 H560 Z" +
    " M712 356 V404 M900 356 V404 M1040 356 V404" +
    " M584 382 H676 M736 382 H860 M924 382 H1012 M1064 382 H1126";

  return (
    <LineScene
      eyebrow={t("eyebrow")}
      title={t("title")}
      body={t.rich("body", { m: Mark })}
      aside={t("aside")}
      steps={steps}
      figure={t("figure")}
      figureCap={t("figureCap")}
      labels={[t("l1"), t("l2"), t("l3"), t("l4")]}
      viewBox={VB}
    >
      {(stage) => (
        <>
          <Stroke d={base} k={stage(0)} />
          <Stroke d={spec} k={stage(0)} />
          <Stroke d={crew} k={stage(1)} />
          <Stroke d={shop} k={stage(2)} />
          <Stroke d={litSign} k={stage(2)} w={2} accent />
          <Stroke d={phone} k={stage(3)} />
          <Stroke d={arc} k={stage(3)} />
          <Stroke d={row} k={stage(4)} w={2} accent />
        </>
      )}
    </LineScene>
  );
}

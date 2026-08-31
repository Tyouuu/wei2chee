"use client";

import { useTranslations } from "next-intl";
import { LineScene, Stroke } from "./line-scene";

/**
 * 三张线稿，讲完整个产品 —— consider.digital 的 pattern 落在我们的东西上。
 *
 * 老板 2026-08-31:「都做 都做 你不是已经有模版可以去学习了吗」。
 * 那一页八段各一张线稿，整页 48 kB 零张图（[任务 87](../../docs/founder-tasks.md)）。
 * 我们三段：**你讲一句话 → 它长成一套系统 → 交给我们建，客人从官网进来**。
 *
 * ⚠️ 机制在 line-scene.tsx，只有一份。这里只描述**画什么** ——
 * 第一版把滚动进度、分段、dash 归一化全写在这个档案里，再画第二张就要复制一次，
 * 而「一个决定被手写在七个地方」正是今天花掉最多时间的那个错。
 * ⚠️ 论证归线稿，**证据归截图**（三步那一段的四张真画面）—— 两个不互相取代。
 */

const W = 720, H = 460;

/* ── 01 一句话被读懂 ──────────────────────────────────────────────────────── */
export function SentenceDrawing() {
  const t = useTranslations("draw1");
  const steps = [t("s1"), t("s2"), t("s3"), t("s4"), t("s5")];

  /* 一行字 → 切成词 → 认出行业跟动作 → 三张卡 → 收成一张清单 */
  const line = `M40 96 H${W - 40}`;
  const words = [40, 150, 236, 330, 460, 560]
    .map((x, i) => `M${x} 84 h${[92, 70, 78, 112, 84, 120][i]}`)
    .join(" ");
  const ticks = [150, 330, 560].map((x) => `M${x + 20} 120 v22`).join(" ");
  const cards = [0, 1, 2]
    .map((i) => {
      const x = 96 + i * 176;
      return `M${x} 168 h152 v72 h-152 Z M${x + 16} 196 h60 M${x + 16} 218 h96`;
    })
    .join(" ");
  const funnel = [96, 248, 272, 424, 448, 600]
    .map((x) => `M${x} 240 L${W / 2} 316`)
    .join(" ");
  const sheet =
    `M${W / 2 - 150} 316 h300 v104 h-300 Z` +
    [344, 368, 392].map((y, i) => ` M${W / 2 - 128} ${y} h${[168, 224, 140][i]}`).join("");

  return (
    <LineScene eyebrow={t("eyebrow")} title={t("title")} body={t("body")} steps={steps}>
      {(stage) => (
        <>
          <Stroke d={line} k={stage(0)} />
          <Stroke d={words} k={stage(1)} w={6} />
          <Stroke d={ticks} k={stage(2)} accent />
          <Stroke d={cards} k={stage(3)} />
          <Stroke d={funnel} k={stage(4)} />
          <Stroke d={sheet} k={stage(4)} />
        </>
      )}
    </LineScene>
  );
}

/* ── 02 长成一套系统 ─────────────────────────────────────────────────────── */
export function SystemDrawing() {
  const t = useTranslations("drawing");
  const steps = [t("s1"), t("s2"), t("s3"), t("s4"), t("s5"), t("s6")];

  const frame = `M8 8 H${W - 8} V${H - 8} H8 Z`;
  const rail = `M8 44 H${W - 8} M170 44 V${H - 8}`;
  const navs = [80, 108, 136, 164, 192].map((y) => `M28 ${y} H140`).join(" ");
  const tiles = [0, 1, 2, 3]
    .map((i) => {
      const x = 194 + i * 128;
      return `M${x} 72 h112 v72 h-112 Z M${x + 12} 96 h44 M${x + 12} 122 h64`;
    })
    .join(" ");
  const table = [
    `M194 176 H${W - 20} M194 176 V${H - 120} M${W - 20} 176 V${H - 120} M194 ${H - 120} H${W - 20}`,
    `M194 206 H${W - 20}`,
    ...[236, 268, 300].map((y) => `M194 ${y} H${W - 20}`),
    ...[300, 430, 560].map((x) => `M${x} 176 V${H - 120}`),
  ].join(" ");
  const flow = [0, 1, 2, 3, 4]
    .map((i) => {
      const x = 194 + i * 104;
      return `M${x} ${H - 96} h80 v48 h-80 Z` + (i < 4 ? ` M${x + 84} ${H - 72} h16` : "");
    })
    .join(" ");

  return (
    <LineScene id="how-built" eyebrow={t("eyebrow")} title={t("title")} body={t("body")} steps={steps}>
      {(stage) => (
        <>
          <Stroke d={frame} k={stage(0)} />
          <Stroke d={rail} k={stage(1)} />
          <Stroke d={navs} k={stage(1)} />
          <Stroke d={tiles} k={stage(2)} />
          <Stroke d={table} k={stage(3)} />
          <Stroke d={flow} k={stage(4)} />
          {/* 整张图只有一个地方有颜色 —— 跟收据那一行同一条规矩。 */}
          <Stroke d={`M194 ${H - 96} h80 v48 h-80 Z`} k={stage(5)} w={2} accent />
        </>
      )}
    </LineScene>
  );
}

/* ── 03 交出去，客人从官网进来 ───────────────────────────────────────────── */
export function HandoverDrawing() {
  const t = useTranslations("draw3");
  const steps = [t("s1"), t("s2"), t("s3"), t("s4"), t("s5")];

  /* 规格书 → 我们建 → 官网上线 → 陌生人填表 → 落进你系统里的一行 */
  const spec =
    `M40 60 h160 v150 h-160 Z` +
    [92, 116, 140, 164, 188].map((y, i) => ` M60 ${y} h${[104, 84, 118, 70, 96][i]}`).join("");
  const arrow1 = `M208 135 h64 M258 125 l14 10 -14 10`;
  const build =
    `M280 60 h160 v150 h-160 Z M280 92 h160` +
    [0, 1].map((r) => [0, 1].map((c) => ` M${300 + c * 76} ${112 + r * 46} h56 v30 h-56 Z`).join("")).join("");
  const arrow2 = `M448 135 h64 M498 125 l14 10 -14 10`;
  const site = `M520 60 h160 v150 h-160 Z M520 84 h160 M540 104 h120 v52 h-120 Z M540 172 h64 v22 h-64 Z`;
  const drop = `M572 194 V300 M562 288 l10 12 10 -12`;
  const row =
    `M${W / 2 - 200} 316 h400 v40 h-400 Z` +
    ` M${W / 2 - 170} 336 h90 M${W / 2 - 40} 336 h70 M${W / 2 + 80} 336 h60`;
  const into = `M${W / 2} 356 V400 M${W / 2 - 10} 388 l10 12 10 -12`;

  return (
    <LineScene eyebrow={t("eyebrow")} title={t("title")} body={t("body")} steps={steps}>
      {(stage) => (
        <>
          <Stroke d={spec} k={stage(0)} />
          <Stroke d={arrow1} k={stage(1)} />
          <Stroke d={build} k={stage(1)} />
          <Stroke d={arrow2} k={stage(2)} />
          <Stroke d={site} k={stage(2)} />
          <Stroke d={drop} k={stage(3)} accent />
          <Stroke d={row} k={stage(4)} />
          <Stroke d={into} k={stage(4)} accent />
        </>
      )}
    </LineScene>
  );
}

import type { MetadataRoute } from "next";
import { BRAND_NAME, BRAND_TAGLINE_EN } from "@/lib/brand";

/**
 * 手机主画面上那一格。
 *
 * ── 它买到的是什么 ────────────────────────────────────────────────────────
 *
 * 老板 2026-09-04 问「桌面图标」是什么。这一份档案就是那件事的全部技术内容：
 * 客人在手机上按浏览器的「加到主画面」，桌面就多一格图标，点下去**整页打开、
 * 上面那条网址列不见**，看起来跟一个 app 一样 —— 而且不用上架、不用审核、
 * 不用给苹果一年 US$99。
 *
 * `display: "standalone"` 就是「网址列不见」那一句。其余每一栏都是在回答
 * 「那一格长什么样、按下去开哪一页」。
 *
 * ⚠️ 苹果 Safari 26 起**不需要这份档案也能加到主画面**
 * （官方原文：`there are now zero requirements for "installability" in
 * Safari`）。但没有它，iOS 找不到图标就会去**截一张网页的图缩成 180px**
 * ——一片灰。而安卓那颗「装到桌面」的提示，则是**一定要**这份档案才会出现。
 *
 * ── 🔴 一件要老实讲的：这一格的名字对每一个客户都一样 ────────────────────
 *
 * 一个网域只有一份清单档，所以它写的名字是 `Formae`，**不是「兴发装修工程」**。
 * 我 9-04 拿给他看的那张图上写的是他自己的公司名 —— 那要等**每个客户有自己
 * 的网址**（[任务 73](../docs/founder-tasks.md)：`xingfa.<我们的网域>`），
 * 那时候一个客户一个网域，就是一个客户一份清单、一个他自己的名字跟颜色。
 *
 * ⚠️ 试过的一条捷径不成立：让这一份改成动态、读他的登入身分。
 * 浏览器抓清单档**预设不带 cookie**（要 `crossorigin="use-credentials"`，
 * 而那一行是 Next 自己产的、我们改不到），而且 iOS 是**装的那一刻**
 * 把清单存下来的 —— 之后改了也不会变。**所以那是网域的事，不是程式的事。**
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: BRAND_TAGLINE_EN,

    /* 开在他的系统，不是官网 —— 一个装在主画面上的图标，点下去应该是他每天
       在用的那一页。不写语言前缀：`/portal` 会自己转到他的语言，
       写死 `/en/portal` 等於替他选了一种语言。 */
    start_url: "/portal",
    scope: "/",

    /* 「网址列不见」的那一句。`browser` 就是一个书签，等於没做。 */
    display: "standalone",
    orientation: "portrait",

    /* 两个颜色故意不一样，而且各有各的工作：
       · `theme_color` 是安卓状态列的颜色 —— 量出来手机上那条顶栏是
         `rgb(11,13,19)`，所以状态列跟它接得起来。
       · `background_color` 是**开启时那一屏**的底色 —— 它要跟图标自己的底
         一模一样（`app/apple-icon.tsx` 的 `#0a1020`），不然开机那一下
         会看到一个深蓝方块浮在近黑上面。 */
    theme_color: "#0b0d13",
    background_color: "#0a1020",

    /* 先画好的档案，不是会跑的路由 —— 见 scripts/make-icons.mjs 的档头：
       Next 产生的图标网址在正式环境会带杂凑，而一份被快取住的清单里
       写一个会变的网址，就是某一天图标变空白而没有人知道为什么。

       `maskable` 那一张是安卓要的：它会把图标切成自己的形状（圆的 ·
       圆角方的 · 水滴），内容没有缩在中间八成里，「F」的角就会被切掉。 */
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

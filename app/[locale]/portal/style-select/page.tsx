import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server-session";

/**
 * 「挑一套 system style」那一步没有了 —— 这里只剩一条转向。
 *
 * 老板 2026-09-08 看到它的截图：「**沒有這個system style呢 這個已經不要了
 * 舊概念了**」。他讲对了，而它比一句过时的话严重：
 *
 *   · 2026-09-04（[任务 132](../../../../docs/founder-tasks.md)）之后
 *     `projects.style` **只管一个画面**：客户的官网。工作台收敛成一套。
 *   · 而这一页被四个入口硬导过来（portal 首页 · 每一个模块页 · 需求书 · 风格库），
 *     标题写着「Choose your **system** style」，而它那几张预览卡画的是**工作台**
 *     —— 也就是不管他选哪一套都不会变的那一半。
 *   · 实测（`npm run shoot:one-register`，2026-09-08）：**工作台 1 种 · 官网 6 种**。
 *
 * 挑哪一套官网还是一个真的决定，而它有两个还活着的地方：官网那一页的编辑器里
 * 那个换风格的面板，跟 `/portal/styles` 的风格库。所以这一条导去风格库。
 *
 * ⚠️ **档案留着，不删** —— 一条旧网址可能已经在某个人的书签或者一封信里。
 * 而 `style-select-client.tsx` 也留着：它那份比较用的文案是 `/style-picker`
 * 共用的（那一页的注解写着这件事），删掉会一起弄坏那一页。
 */
export default async function StyleSelectPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect("/portal/styles");
}

import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

/**
 * 这个客户的官网该穿哪一套 —— 而**他不用先被问一次**。
 *
 * ── 这个档案关掉的那道门（2026-09-08）─────────────────────────────────────
 *
 * 老板看到那一页的截图：「**沒有這個system style呢 這個已經不要了 舊概念了**」。
 * 他讲对了，而它比一句过时的话严重：
 *
 *   · `projects.style` 从 2026-09-04（[任务 132](../../docs/founder-tasks.md)）
 *     起**只管一个画面**：客户的官网。工作台收敛成一套。
 *   · 而 `if (!project.style) redirect("/portal/style-select")` 挡在**四个入口**上
 *     （portal 首页 · 每一个模块页 · 需求书 · 风格库），
 *     标题写着「Choose your **system** style」，
 *     而那几张预览卡画的是**工作台** —— 也就是不管他选哪一套都不会变的那一半。
 *   · 实测（`npm run shoot:one-register`，2026-09-08）：**工作台 1 种 · 官网 6 种**。
 *
 * 🔴 **一个新客人一进来，被要求挑一样东西，而预览给他看的正好是不会跟着变的。**
 *
 * ── 而那个问题资料库早就答得出来 ─────────────────────────────────────────
 *
 * `industries.style_choices`（migration 20260827080000）**八个行业一个不缺**：
 *
 *     renovation  ledger · hearth · blueprint     services   swiss · blueprint · ledger
 *     retail      signboard · hearth · counter    wholesale  counter · ledger · blueprint
 *     beauty/fnb  hearth · signboard · blueprint  education  blueprint · hearth · swiss
 *
 * 我们在问一个自己已经知道答案的问题，而问的代价是他进不了自己的系统
 * （[重点 29](../../docs/founder-points.md)：能不要他做的动作就不要他做）。
 *
 * ── 三层，为什么是这个顺序 ───────────────────────────────────────────────
 *
 *   1. `projects.style`          他自己挑过的 —— **永远赢**
 *   2. `style_choices[0]`        他这一行的第一顺位（2026-08-27 逐个行业量出来的）
 *   3. `style_recommendation`    更早那一版，只有三个值可选（20260820120000 的约束）
 *   4. `SYSTEM_REGISTER`         连行业都不知道的时候
 *
 * ⚠️ 它**不写资料库**。`projects.style` 留着是 null，而 null 的意思从今天起是
 * 「他还没挑过」，不是「他不能用」—— 一个自己替他写进去的预设，会让
 * 「他挑过了」跟「我们替他猜的」在那一栏里长得一模一样。要写只有一个地方
 * 写得了：他自己按下去那一支 `set_project_style`（[重点 23](../../docs/founder-points.md)）。
 */
type Ctx = { industry?: { slug?: string | null; style_recommendation?: string | null } | null };

/** 只要读得到那几张表就行 —— 不绑 Supabase 的型别，测试才喂得进替身。
 *
 * ⚠️ 是 `PromiseLike` 不是 `Promise`：supabase 那个查询建构器**不是一个完整的
 * Promise**（它 then 得了，而它没有 `catch` / `finally`）。这个仓库为那件事
 * 红过一次（[任务 213](../../docs/founder-tasks.md)：一个挂在建构器上的
 * `.catch()` 从来没有接到东西）。下面用的是 `await` 加 try/catch，那个成立。 */
type Answer = PromiseLike<{ data?: unknown; error?: unknown }>;
/* ⚠️ 收 `unknown` 再往里面转，不是把整个形状写在参数上 —— 写在参数上的时候
   TypeScript 要去比对 supabase 那一支的每一个多载，当场
   「Type instantiation is excessively deep」。 */
type Reader = { rpc: (fn: string) => unknown; from: (table: string) => unknown };
type Table = {
  select: (cols: string) => {
    eq: (col: string, val: string) => { maybeSingle: () => Answer };
  };
};

export async function defaultRegister(
  supabase: Reader,
  chosen?: string | null,
): Promise<StyleName> {
  if (chosen) return chosen as StyleName;

  /* 读不到就用那个常数 —— 一次读失败不可以变成一道挡住他的门，
     而那正是这一整个档案在拆掉的东西。 */
  let slug: string | null = null;
  let older: string | null = null;
  try {
    const { data } = await (supabase.rpc("get_my_business_context") as Answer);
    const ctx = data as Ctx | null;
    slug = ctx?.industry?.slug ?? null;
    older = ctx?.industry?.style_recommendation ?? null;
  } catch {
    return SYSTEM_REGISTER;
  }
  if (!slug) return (older as StyleName) ?? SYSTEM_REGISTER;

  try {
    const { data } = await (supabase.from("industries") as Table)
      .select("style_choices")
      .eq("slug", slug)
      .maybeSingle();
    const first = (data as { style_choices?: string[] | null } | null)?.style_choices?.[0];
    if (first) return first as StyleName;
  } catch {
    /* 掉到底下那两层 */
  }
  return (older as StyleName) ?? SYSTEM_REGISTER;
}

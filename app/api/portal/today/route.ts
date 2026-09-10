import { NextResponse } from "next/server";
import { fetchNudges } from "@/lib/portal/live-answers";
import { systemLangOf } from "@/lib/templates/industry-template";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";

/**
 * 今天有什么要跟 —— **助手自己开口讲的那几句**。
 *
 * ── 🔴 为什么这一支存在（2026-09-10）────────────────────────────────────
 *
 * 系统自己看得出来的讯号有十四种（报价快到期 · 收款逾期 · 低过补货线 ·
 * 预约没人接 · 套票剩最后一次 · 客人很久没来 · 合约到期 · 借出去没还 ·
 * 缺勤两次 · 签了没付 · 介绍费欠着 · 要货单开着 · 同意书还没签 · 学费未收），
 * 而它们 2026-09-06 就算得出来。
 *
 * [任务 321] 让助手**答得出**「今天有什么要跟」。而那一条的收尾自己写着：
 * **它还不会自己开口 —— 现在是他问才答。** [任务 338] 又记了一次。
 *
 * 一个要他先想到该问什么的助手，等於把那十四个讯号锁在一句他不会讲的话
 * 后面。外面那七家（Xero JAX · QuickBooks 的付款代理）差异就在这里：
 * **它们先讲话。** 而我们这一件[任务 316](../../../../../docs/founder-tasks.md#316)
 * 判过是「接一条线，不是建一个功能」——这一支就是那条线。
 *
 * ── 🔴 那句话是资料库写的，这里一个字都不重拼 ───────────────────────────
 *
 * 走 `fetchNudges`（`live-answers.ts`）—— **助手拿去回答那一句用的同一支**，
 * 而它读的是 `nudges_due.body`，跟「今天要跟的」那一页画的是同一份字。
 * 在这里自己拼一句，就是同一件事两个讲法，而他会以为那是两件事。
 *
 * ── 🔴 走他自己的登入，角色由那一支自己判 ───────────────────────────────
 *
 * `nudges_due` 里有几条是 `sees_money` 的（收款逾期 · 学费未收）。
 * 一个师傅打开这块面板，拿回来的本来就该少几条 —— 而那是那一支决定的，
 * 不是这里。所以这里用 `my_workspace` 问「他站在哪一家」，
 * **不问「我拥有的那一家」**（20260901030000 之后师傅也在用这块面板）。
 *
 * ⚠️ **只有他打开那块面板的时候才跑。** 挂在每一页的伺服器渲染上，
 * 就是十七页每一次切换都多一次 `nudges_due` —— 而他多半没有打开助手。
 */

/** 🔴 最多三件。两三件是一张收据，十四件是一份报告 —— 而一份报告他不会读，
 *  那正是助手那一段提示里同一条规矩（「两三个是收据，全部列出来就变成报告」）。 */
const SAY_AT_MOST = 3;

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ lines: [] }, { status: 401 });
  }

  const supabase = await createSessionSupabaseClient();
  const { data: ws } = await supabase.rpc("my_workspace");
  const row = (ws as { project_id: string }[] | null)?.[0];
  if (!row?.project_id) return NextResponse.json({ lines: [] });

  const { data: ctx } = await supabase.rpc("get_my_business_context");
  const lang = systemLangOf(ctx ?? {});

  const nudges = await fetchNudges(supabase, row.project_id, lang);
  /*
    🔴 一件都没有就回空的 —— 面板照旧给那三句现成的。
    这里**不要**回一句「今天没有什么要跟」：那一句要嘛是真的（而他刚开店，
    什么都还没有），要嘛是我们没读到（他是师傅，钱那几条本来就看不到）。
    两种在画面上长得一模一样，而其中一种是在骗他。
  */
  return NextResponse.json({
    lines: nudges.slice(0, SAY_AT_MOST).map((n) => n.line).filter(Boolean),
  });
}

import { notFound, redirect } from "next/navigation";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";
import { LawClient, type Schedule } from "./law-client";

/**
 * 法定费率表。**我们维护的那几张，不是客户的。**
 *
 * ── 为什么它在 console，不在薪资那一页 ─────────────────────────────────
 *
 * `upsert_statutory_schedule` · `confirm_statutory_schedule` 两支的第一句
 * 都是 `is_founder()`（20260904210000）。所以它们**不可能**长在客户的
 * 薪资页上 —— 那里放一颗按钮就是一颗按下去必然被拒绝的按钮。
 * 而薪资那一页的档头 2026-09-06 自己就写着这一句：
 *
 *   「⚠️ 两支故意不给他 … 它们的家在 `/console`，不在这一页。」
 *
 * 这一页就是那个家。在它之前那两支**画面上一个入口都没有**。
 *
 * ── 🔴 而这一页真正要讲清楚的是「两种缺法，两个后果」──────────────────
 *
 *   ① **一份表都没有** → `statutory_lookup` 在**算**那一刻就抛
 *      （'no epf (A) table covers 2026-09-01 -- load the official schedule'）。
 *      薪资单**开不出来**。
 *   ② **装了，没有人核对过** → 薪资单照样算得出来（他看得到数字），
 *      而 `pay_pay_run` 拒绝把钱记进帐上 —— 挡的是钱，不是资讯。
 *
 * 讲混了他会去修错的那一件。而今天这个资料库**一行费率都没有**，
 * 那是 20260904210000 刻意的：我读得到的最完整的一份是 2025-10-01 的快照，
 * 而 2026 年年中 PERKESO 改过。**种一份过期的表比空着糟得多。**
 *
 * ── 几格。零格的表装得进去 ──────────────────────────────────────────────
 *
 * 一份 `statutory_schedules` 的行可以一格 `statutory_brackets` 都没有 ——
 * 那时候它在清单上跟一份完整的表长得一模一样，而 `statutory_lookup`
 * 到发薪那一天才讲「the loaded table is incomplete」。所以格数要读出来。
 *
 * ⚠️ 读法是**一次问全部**再自己数，不是一份表一次 head count：
 * 计划 × 类别 × 版本大概十几份，那样就是十几次往返。
 * 真实的规模是 EPF 三个类别加起来 1,148 格（397 + 372 + 379），
 * 两栏。超过上限就**讲出来**，不印一个悄悄封顶的数字 ——
 * 一个封了顶的计数是一个假的事实。
 */

const BRACKET_CAP = 50000;

export default async function ConsoleLawPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSessionSupabaseClient();
  const { data: founder } = await supabase.rpc("is_founder");
  if (!founder) notFound();

  const [{ data: scheduleRows }, { data: bracketRows }] = await Promise.all([
    supabase
      .from("statutory_schedules")
      .select(
        "id, scheme, part, effective_from, effective_to, source_name, source_url, act, via, rounding, confirmed_at, confirmed_note",
      )
      .order("scheme")
      .order("part")
      .order("effective_from", { ascending: false }),
    supabase
      .from("statutory_brackets")
      .select("schedule_id, wage_to_cents")
      .limit(BRACKET_CAP),
  ]);

  const counted = new Map<string, number>();
  const tailed = new Set<string>();
  for (const b of (bracketRows ?? []) as {
    schedule_id: string;
    wage_to_cents: number | null;
  }[]) {
    counted.set(b.schedule_id, (counted.get(b.schedule_id) ?? 0) + 1);
    /* 没有上限那一格 = 表尾那一行（RM20,000 以上那一段的百分比）。
       它是最容易贴漏的一行，而漏了的症状是「薪水高的那几个人算不出来」。 */
    if (b.wage_to_cents === null) tailed.add(b.schedule_id);
  }

  const schedules: Schedule[] = (
    (scheduleRows ?? []) as Omit<Schedule, "brackets" | "hasTail">[]
  ).map((s) => ({
    ...s,
    brackets: counted.get(s.id) ?? 0,
    hasTail: tailed.has(s.id),
  }));

  /* 🔴 封了顶就讲出来。一个悄悄封顶的计数是一个假的事实 ——
     而这一页存在的理由之一就是「几格」这个数字要能信。 */
  const capped = ((bracketRows ?? []) as unknown[]).length >= BRACKET_CAP;

  return <LawClient schedules={schedules} capped={capped} />;
}

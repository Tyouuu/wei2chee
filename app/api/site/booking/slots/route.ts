import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * 哪几个时段被占着 —— 一个陌生人站在已上线的官网上问的第一句话。
 *
 * ── 为什么它只回时间，不回别的（2026-09-05）─────────────────────────────
 *
 * `public_booking_slots` 只回 `starts_at` / `ends_at`：**没有名字、没有服务、
 * 没有编号、没有师傅**。一张写着「10:00 陈太太 染发」的公开页面，
 * 是把他客人的行踪贴到网上。
 *
 * ⚠️ 而它照旧泄漏一件事，写下来不要假装没有：**看得出这家店有多忙。**
 * 每一个订位页都这样 —— 不给客人看空档，他就订不了。
 *
 * ── 为什么用 anon 钥匙，不用 service key ────────────────────────────────
 *
 * 跟 `/api/site/enquiry` 同一条：这一支被允许做的每一件事都写在那支函式
 * 里面（自己从网址名找到 project · 拒绝没上线的站 · 只给一天 · 只给近的）。
 * service key 唯一多给的能力是「写到任何地方去」，而那正是一个公开端点
 * 绝对不可以够得到的东西。
 *
 * ── 为什么是 GET ────────────────────────────────────────────────────────
 *
 * 它只在读。而且它会被同一个人在同一天里问好几次（换一天、再换一天），
 * 一条 GET 让浏览器自己知道那是同一个问题。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "";
  const day = url.searchParams.get("day") ?? "";

  /* 网址名不在，就没有东西可以问。**跟「这个站还没上线」回一样的东西** ——
     告诉一个陌生人「这个站存在但还没上线」，是在讲别人生意的事。 */
  if (!slug || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ taken: [] });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.rpc("public_booking_slots", {
    p_slug: slug,
    p_day: day,
  });

  if (error) {
    console.error("public_booking_slots failed", error);
    /* 🔴 读不到就说读不到，**不要回一个空阵列** —— 空阵列的意思是
       「这一天整天都空着」，而照那个答案订下去，两个人会订到同一个钟头。 */
    return NextResponse.json({ result: "failed" }, { status: 500 });
  }

  const taken = (data ?? []).map((r: { starts_at: string; ends_at: string }) => ({
    from: r.starts_at,
    to: r.ends_at,
  }));
  return NextResponse.json({ taken });
}

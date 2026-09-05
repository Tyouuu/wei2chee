import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * 客人自己在官网上订一个时段 —— 那条箭头的第四个动词。
 *
 * 在这之前陌生人在整个平台上做得了三件事：看那一页 · 留一句话 ·
 * 打开自己那张单。而 `submit_site_booking`（20260905130000）从写好那天起
 * **画面上一个入口都没有** —— 那一支自己的档头就写着「今天还没有任何地方
 * 呼叫它们」。
 *
 * ── 为什么回的是一个**词**，不是一个 HTTP 状态 ──────────────────────────
 *
 * 跟询价那一条同一句：这里每一种结果都是**一个站在手机前面的人要读的话**。
 * 「这个时段刚被订走了」是一个答案，不是一个错误 —— 而它是这一页最常见的
 * 那一种：两个人看着同一个星期六早上仅剩的三个空档，同时按下去。
 *
 * ── 为什么用 anon 钥匙 ──────────────────────────────────────────────────
 *
 * 这一支被允许做的每一件事都写在那支函式里面：自己从网址名找到 project ·
 * 拒绝没上线的站 · 拒绝没有预约那一页的生意 · 长度上限 · 时段长度上限 ·
 * 过去跟太远都挡 · 一分钟五次 · **而且不记 IP**。
 * service key 唯一多给的是「写到任何地方去」。
 */

/** 那支函式回得出来的每一个词。`ok:<uuid>` 另外认。 */
const WORDS = new Set([
  "incomplete", "too_long", "bad_time", "past", "too_far",
  "not_found", "too_many", "taken",
]);

export async function POST(request: Request) {
  let body: {
    slug?: unknown;
    name?: unknown;
    contact?: unknown;
    from?: unknown;
    to?: unknown;
    service?: unknown;
    note?: unknown;
    /* 没有人看得到、也没有人会填的一格。机器人看到输入框就填,
       所以这里面有东西就是机器人 —— 而它答的是「ok」不是一个错误:
       告诉一个脚本它被抓到了,是在教它换个方式再来。 */
    website?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ result: "bad_request" }, { status: 400 });
  }

  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ result: "ok" });
  }

  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const slug = str(body.slug);
  if (!slug) return NextResponse.json({ result: "not_found" }, { status: 404 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.rpc("submit_site_booking", {
    p_slug: slug,
    visitor_name: str(body.name),
    visitor_contact: str(body.contact),
    wants_from: str(body.from),
    wants_to: str(body.to),
    wants_service: str(body.service),
    visitor_note: str(body.note),
  });

  const word = String(data ?? "");
  /* 🔴 那一串是他以后要改或者取消这一次预约用的 —— 而**这里不回给浏览器**。
     叫一个人为了取消剪发去注册一个帐号是 no-show 的来源；把那一串印在
     页面上，则是把它交给任何一个站在他背后看萤幕的人。
     等那条「客人自己那一页」做出来的时候，它会跟着一封讯息走。 */
  if (word.startsWith("ok:")) return NextResponse.json({ result: "ok" });

  if (error || !WORDS.has(word)) {
    console.error("submit_site_booking failed", error);
    return NextResponse.json({ result: "failed" }, { status: 500 });
  }
  return NextResponse.json({ result: word });
}

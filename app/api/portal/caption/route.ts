import { NextResponse } from "next/server";
import OpenAI from "openai";
import { AI_MODEL } from "@/lib/portal/ai-model";
import { recordAiUsage, type UsageShape } from "@/lib/portal/ai-usage";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";

/**
 * One saved Lookbook look in, a ready-to-post social caption out.
 *
 * ── 🔴 为什么这一支存在（2026-09-26）────────────────────────────────────
 *
 * 老板叫我去参考最近爆火的 SaaS。GlossGenius 2026-07 把整个产品重牌成
 * 「Genius AI」，卖点就是自动帮沙龙写 Instagram/Facebook 文案 —— 而我们的
 * Lookbook（20260925040000）已经存着一份做出来的名字、色阶、配方、标签，
 * 那份资料够写一句文案了，只是从来没有人把它变成字。
 *
 * ── 🔴 配方不进这一支的提示 ─────────────────────────────────────────────
 *
 * `formula`（Majirel 6.1 + Inoa 5.0 那一类）是这家店的手艺，不是要公开发的
 * 东西——把它写进一条公开文案，等於把她的配方送给同一条街上的对手。这一支
 * 只读 title / category / level / note / tags，`formula` 一个字都不查。
 *
 * ── 只读，不写 ────────────────────────────────────────────────────────
 *
 * 这一支不碰任何一张表。它回一段字，落在老板自己的输入框里等他看过再发——
 * 跟 `/api/portal/hear` 同一条纪律：一句机器生成的话，没有人读过就自动
 * 发出去，是这个仓库不准发生的那一类事。
 *
 * ── `lookId` 只用来查，不信它带来的任何别的字 ───────────────────────────
 *
 * 客户端只送一个 id；这一支用他自己的登入（RLS 的 `works_here`）去查那一份
 * 作品，查不到就是「不是这家的」或者「没有这一份」，两种情况回同一句话，
 * 不多讲哪一种——不用猜是不是别家的资料。
 */

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** 一小时几次。写文案不是天天做的事，一天写完六七份作品就该收工了。 */
const CAPTIONS_PER_HOUR = 30;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "signed-out" }, { status: 401 });
  }

  const supabase = await createSessionSupabaseClient();
  const { data: ws } = await supabase.rpc("my_workspace");
  const row = (ws as { project_id: string }[] | null)?.[0];
  if (!row?.project_id) {
    return NextResponse.json({ ok: false, reason: "no-project" }, { status: 400 });
  }

  const limit = await checkRateLimit(`caption:${user.id}`, {
    limit: CAPTIONS_PER_HOUR,
  });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, reason: "too-many" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const lookId = typeof body?.lookId === "string" ? body.lookId : "";
  if (!lookId) {
    return NextResponse.json({ ok: false, reason: "no-look" }, { status: 400 });
  }

  const { data: look } = await supabase
    .from("lookbook_works")
    .select("title, category, level, note, tags")
    .eq("id", lookId)
    .is("archived_at", null)
    .maybeSingle();
  if (!look) {
    return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
  }

  const facts = [
    `Look name: ${look.title}`,
    look.category ? `Technique/category: ${look.category}` : null,
    look.level ? `Lift level: ${look.level}` : null,
    look.note ? `Notes: ${look.note}` : null,
    Array.isArray(look.tags) && look.tags.length > 0 ? `Tags: ${look.tags.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const startedAt = Date.now();
  let text = "";
  let usage: UsageShape = undefined;
  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      /* 这一支不是「读得懂一个装修老板描述他的一天」那种任务
         （AI_REASONING_EFFORT="high" 是为那一支量出来的）——这是一句
         套模板的行销文案，"low" 就够，也比高推理便宜、快。 */
      reasoning_effort: "low",
      messages: [
        {
          role: "system",
          content:
            "You write short, ready-to-post Instagram/Facebook captions for a Malaysian hair " +
            "salon. Write ONE caption, 1-3 short sentences, warm and inviting, ending with 2-4 " +
            "relevant hashtags. No emoji spam (at most 1-2). Never invent a price, a promotion, " +
            "or a claim not given to you. Output the caption text only, nothing else.",
        },
        { role: "user", content: facts },
      ],
    });
    text = completion.choices[0]?.message?.content?.trim() ?? "";
    usage = completion.usage;
  } catch (e) {
    await recordAiUsage(supabase, "caption", AI_MODEL, undefined, {
      outcome: "failed",
      tookMs: Date.now() - startedAt,
    }).catch(() => {});
    return NextResponse.json(
      { ok: false, reason: "model-error", detail: String((e as Error).message).slice(0, 120) },
      { status: 502 },
    );
  }

  await recordAiUsage(supabase, "caption", AI_MODEL, usage, {
    tookMs: Date.now() - startedAt,
  }).catch(() => {});

  if (!text) {
    return NextResponse.json({ ok: false, reason: "empty" }, { status: 200 });
  }

  return NextResponse.json({ ok: true, text });
}

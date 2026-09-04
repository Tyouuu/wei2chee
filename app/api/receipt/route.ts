import { NextResponse } from "next/server";
import OpenAI from "openai";
import { AI_MODEL, AI_REASONING_EFFORT } from "@/lib/portal/ai-model";
import { recordAiUsage, type UsageShape } from "@/lib/portal/ai-usage";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  buildReceiptPrompt,
  receiptJsonSchema,
  receiptTroubleLines,
  toReceiptDraft,
  type ReceiptLang,
  type ReceiptRaw,
} from "@/lib/portal/receipt-read";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";

/**
 * 一张收据的照片进来，几格填好的字出去。
 *
 * ── 🔴 它读，它不写 ───────────────────────────────────────────────────────
 *
 * 这支 route **没有任何一句 insert**。它回的是几格字，按下保存的还是他，
 * 走的还是 `add_ledger_entry` —— 人按的那一支（[重点 23] AI 平权）。
 *
 * 那不是省事：这本帐会被拿去报税，而**一个没有人读过的数字进了帐，
 * 是他月底才会发现的错**。模型读错一个小数点，加上一条自动写入的路径，
 * 就是一笔他从来没看过的钱。
 *
 * ── 🔴 图片不会离开我们这里 ───────────────────────────────────────────────
 *
 * 桶是 private 的，所以「让模型看得到」有两条路：签一个网址给它，
 * 或者把位元组带上去。**选后者。**
 *
 * 一个签出来的网址是**任何拿到那条连结的人都打得开**的东西，而这张图上
 * 印着他的进货价、他的供应商、他一个月的租金。为了省一次下载去产生一条
 * 那样的连结，不划算。所以这里下载、缩小、变成资料本身送上去 ——
 * **全程没有任何一条指向他收据的网址存在过。**
 *
 * ── 只有老板 ──────────────────────────────────────────────────────────────
 *
 * 开销那一页从 20260901010000 起就是 `sees_money`，师傅连网址打进去都打不开。
 * 读一张收据是同一件事，所以这里挡在 `role === "owner"`，而桶的政策
 * （20260905010000）在资料库那一层再挡一次。**两层不是重复** ——
 * route 挡的是这一支，桶挡的是任何一支。
 */

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * 量过了：**一张干净的现金单 3.0 秒**（`npm run check:receipt`，2026-09-04，
 * 真的模型）。留 120 而不是 10，理由讲清楚不要以后有人来收紧它：
 *
 * 那 3.0 秒是一张**我们自己画出来的** SVG —— 白底黑字、正的、字是印刷体。
 * 他手上那一张是**皱的、歪的、灯光不均、而且可能是手写的**，而这个模型在
 * 那种图上会想得久很多。**没有量过那种图的人不该动这个数字。**
 *
 * `check:receipt` 每次跑都印实际几秒。看到它逼近这里就改这里，
 * 不要等它开始被平台掐断 —— 那时候钱已经花掉了，而他读到的是「改不了」。
 */
export const maxDuration = 120;

/** 一小时几张。预设的 5 是给问卷那种「一个陌生人填一次」用的；
 *  老板一次坐下来处理一个月的收据是三十到五十张，5 会在第六张挡住他。 */
const RECEIPTS_PER_HOUR = 60;

/** 送上去之前缩到这个宽。收据上的小字比风景照更需要解析度，所以比官网
 *  那条（1600）不能再小；再大只是把钱花在他手机相机的杂讯上。 */
const WIDTH = 1600;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "signed-out" }, { status: 401 });
  }

  const { path } = (await req.json().catch(() => ({}))) as { path?: string };
  if (!path || typeof path !== "string") {
    return NextResponse.json({ ok: false, reason: "no-path" }, { status: 400 });
  }

  const supabase = await createSessionSupabaseClient();

  /* 他站在哪一家，以及是不是老板。**不问 `account_id = auth.uid()`** ——
     那是 20260901030000 之前的问法，而它的意思是「我拥有的那一家」，
     不是「我正站着的那一家」。 */
  const { data: ws } = await supabase.rpc("my_workspace");
  const row = (ws as { project_id: string; role: string }[] | null)?.[0];
  if (!row?.project_id) {
    return NextResponse.json({ ok: false, reason: "no-project" }, { status: 400 });
  }
  if (row.role !== "owner") {
    return NextResponse.json({ ok: false, reason: "not-yours" }, { status: 403 });
  }
  const projectId = row.project_id;

  /* 路径的第一段就是那一家。桶的政策已经挡了同一件事 ——
     这里再挡一次是为了让**拒绝的理由讲得出来**：储存层拒绝回的是
     「找不到」，而那跟「那不是你的」在画面上长得一样。 */
  if (!path.startsWith(`${projectId}/`) || path.includes("..")) {
    return NextResponse.json({ ok: false, reason: "not-yours" }, { status: 403 });
  }

  const limit = await checkRateLimit(supabase, `receipt:${user.id}`, {
    limit: RECEIPTS_PER_HOUR,
  });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, reason: "too-many" }, { status: 429 });
  }

  /* 用他自己的连线下载。service role 拿得到任何一家的档案，
     而这里要的正好是「资料库替我确认这是他的」。 */
  const { data: blob, error: dlError } = await supabase.storage.from("receipts").download(path);
  if (dlError || !blob) {
    return NextResponse.json({ ok: false, reason: "no-photo" }, { status: 404 });
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());

  /* 缩小之后再送。理由跟官网那条一样是钱，只是花的地方不同：那边花在
     访客的流量上，这边花在每一次呼叫的 token 上。
     ⚠️ **缩不动就送原图** —— sharp 是原生的，而一张送不出去的收据
     比一张大一点的收据糟得多。 */
  let jpeg: Uint8Array = bytes;
  try {
    const sharp = (await import("sharp")).default;
    jpeg = new Uint8Array(
      await sharp(bytes)
        .rotate()
        .resize({ width: WIDTH, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer(),
    );
  } catch {
    // 留原图。见上面那一段。
  }
  const dataUri = `data:image/jpeg;base64,${Buffer.from(jpeg).toString("base64")}`;

  /* ── 他自己用过的那几个词 ────────────────────────────────────────────────
     20260904200000 立过这一条：类别的下拉里只有他打过的词，因为「没有量过
     的行业就不建议」。模型只能从这份清单里挑，挑不到就回 null。
     所以第一次用的时候这份是空的，而那是诚实的，不是坏掉的。 */
  const { data: catRows } = await supabase
    .from("ledger_entries")
    .select("category")
    .eq("project_id", projectId)
    .eq("direction", "out")
    .not("category", "is", null)
    .neq("category", "")
    .limit(500);
  const categories = Array.from(
    new Set(((catRows ?? []) as { category: string | null }[]).map((r) => (r.category ?? "").trim())),
  ).filter(Boolean);

  const { data: proj } = await supabase
    .from("projects")
    .select("system_language")
    .eq("id", projectId)
    .maybeSingle();
  /* 跟系统语言走，不跟他跟我讲话的语言走（[重点 13]：那是三样不同的东西）。 */
  const language: ReceiptLang =
    (proj as { system_language?: string } | null)?.system_language === "zh" ? "zh" : "en";

  const startedAt = Date.now();
  let usage: UsageShape = undefined;
  let raw: ReceiptRaw | null = null;
  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      reasoning_effort: AI_REASONING_EFFORT,
      messages: [
        { role: "system", content: buildReceiptPrompt({ categories, language }) },
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: dataUri } }],
        },
      ],
      response_format: { type: "json_schema", json_schema: receiptJsonSchema },
    });
    usage = completion.usage;
    raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as ReceiptRaw;
  } catch (err) {
    console.error("receipt read failed", err);
  } finally {
    /* 一行，不管读到了没有。**读失败也是花过钱的** ——
       而这一条正是 20260830010000 那次「帐本回报一切正常 100%」的解药：
       一本只记成功的帐，答不了「它是不是坏了」。 */
    await recordAiUsage(supabase, "receipt", AI_MODEL, usage, {
      outcome: raw ? "ok" : "failed",
      tookMs: Date.now() - startedAt,
    });
  }

  if (!raw) {
    /* ⚠️ 讲清楚是**我们**倒了，不是他的照片不好。
       一句「换一张再试」会让他去重拍一张本来没问题的收据。 */
    return NextResponse.json(
      { ok: false, reason: "read-failed", tookMs: Date.now() - startedAt },
      { status: 502 },
    );
  }

  const draft = toReceiptDraft(raw, { categories });
  return NextResponse.json({
    ok: true,
    draft,
    /* 讲给他听的那几句，已经是他系统的语言。UI 只印，不判。 */
    troubleLines: receiptTroubleLines(draft, language),
    tookMs: Date.now() - startedAt,
  });
}

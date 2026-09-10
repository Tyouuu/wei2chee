import { NextResponse } from "next/server";
import OpenAI from "openai";
import { AI_HEAR_MODEL } from "@/lib/portal/ai-model";
import { recordAiUsage, type UsageShape } from "@/lib/portal/ai-usage";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";

/**
 * 他讲的一句话进来，几个字出去。
 *
 * ── 🔴 为什么这一支存在（2026-09-09）────────────────────────────────────
 *
 * 老板交办：`你要去尽量学习国外的一些新的概念`。读回来的那五个里，
 * 这一个的数字最硬：Gartner 说 **2026 年 75%** 的外勤公司会用语音；
 * ServiceTitan 的《2026 行业 AI 报告》说 **12% 已经在用、34% 在试**；
 * Housecall Pro 问 400 多家，**70% 试过、40% 在用**。
 *
 * 而这个仓库量出来是 **零个语音输入**。一个戴着手套、手上带油的师傅，
 * 打不了字 —— 而[重点 19] 早就分清楚了：会打字的是**建造期**那个老板，
 * 每天在工地上的那一个是**运营期**，他手是脏的。
 *
 * ── 🔴 它转成字，它不送出去 ─────────────────────────────────────────────
 *
 * 这一支回的是**几个字**，然后那几个字落在他的输入框里，等他看过再按送出。
 * **不自动执行。** 一句「三千」被听成「一万三」而直接写进他的帐，
 * 是他月底才会发现的错 —— 跟 `/api/receipt` 的档头一字不差的同一条：
 * 一个没有人读过的数字进了帐，就是一笔他从来没看过的钱。
 *
 * ── 🔴 那段声音一个位元组都不留 ─────────────────────────────────────────
 *
 * 图片那一条要先传进桶，因为一张手机照片 3–5MB，塞进 JSON 会把他的手机
 * 网路撑死（见 `ask-photos`，20260909160000）。**声音不是那个形状**：
 * 一段十秒的语音 opus 编码只有几十 KB，直接贴在这次请求里就送得完。
 *
 * 所以这里**不存**：不进桶、不落地、转完就没了。一段他讲他生意的录音，
 * 存起来只会多一个要保护的东西，而它一秒钟之后就没有用了。
 *
 * ── 只有在这一家做事的人 ────────────────────────────────────────────────
 *
 * `works_here`，不是 `sees_money` —— 一个师傅用讲的记一天工，跟钱无关。
 * 权限那一层由他讲完之后打的那一支写入函式挡，跟人按按钮走同一条
 * （[重点 23] AI 平权）。这里只把声音变成字。
 */

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * 量过再改。转一段十秒的语音是**一次上传 ＋ 一次模型呼叫**，
 * 比读一张收据（那一支是 120 秒）轻得多 —— 但他站在工地上，
 * 网路是 4G，而上传那一段的时间不在我们手上。
 */
export const maxDuration = 60;

/** 一小时几次。他一个下午讲二十句是正常的；两百句不是。 */
const HEARS_PER_HOUR = 120;

/**
 * 🔴 一段声音最大几个位元组。
 *
 * 4MB。一段 60 秒的 opus 大约 240KB，所以 4MB 是十几分钟 ——
 * 也就是说这个上限**挡的不是他讲太久，是别人拿它当上传管道**。
 * 讲太久那一件由浏览器那一端自己停（它录到 60 秒就停）。
 */
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * 🔴 转录那一支收到的那一句提示 —— 而它**只放名词，不放规矩**。
 *
 * 这一段是给转录模型的「你大概会听到这些字」，不是给它的命令。
 * 马来西亚这个市场一句话里混三种话（「陈太太 deposit 三千」），
 * 而这几个词是它最容易听错的那几个：单位、货币、我们这几页的名字。
 *
 * ⚠️ **不要在这里教它「顺便帮我整理一下」** —— 一个会顺手改写的转录，
 * 会把他讲的「一万三」整理成「13,000」再整理成别的。他要的是他讲的那句话。
 */
const HINT =
  "Malaysian small business. Mixed English, Malay and Chinese in one sentence is normal. " +
  "Money is RM. Common words: quotation, deposit, invoice, cement, bag, job, " +
  "customer name, 报价, 订金, 收款, 水泥, 包, 师傅. " +
  /* 🔴 马来文的店名 —— 2026-09-09 量出来才加的。
     测试里讲「Kedai **Selera**」，它听成「Kedai **Solera**」，一个母音之差 ——
     而那会在他帐上留下一个不存在的客户，而他下一次搜那个名字搜不到。
     这一行不是装饰：我们卖的这个市场，一半的客户名字长这个样子。 */
  "Malaysian business names sound like: Kedai Selera, Restoran, Warung, Syarikat, " +
  "Sdn Bhd, Enterprise, Trading, Bengkel, Klinik, Jaya, Seri, Maju, Bakti, Hup Seng, " +
  "Ah Seng, Encik, Puan, Kedai Runcit.";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "signed-out" }, { status: 401 });
  }

  const supabase = await createSessionSupabaseClient();
  /* 他站在哪一家。**不问「我拥有的那一家」** —— 那是 20260901030000 之前
     的问法，而师傅用讲的记一天工是这一支存在的一半理由。 */
  const { data: ws } = await supabase.rpc("my_workspace");
  const row = (ws as { project_id: string }[] | null)?.[0];
  if (!row?.project_id) {
    return NextResponse.json({ ok: false, reason: "no-project" }, { status: 400 });
  }

  const limit = await checkRateLimit(`hear:${user.id}`, {
    limit: HEARS_PER_HOUR,
  });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, reason: "too-many" }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const clip = form?.get("clip");
  if (!(clip instanceof Blob)) {
    return NextResponse.json({ ok: false, reason: "no-clip" }, { status: 400 });
  }
  if (clip.size === 0 || clip.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, reason: "bad-size" }, { status: 400 });
  }

  /* 🔴 副档名要跟着真的型别走。那一支照档名判格式，而 `MediaRecorder`
     在安卓 Chrome 给 webm、在 iOS Safari 给 mp4 —— 写死一个副档名，
     两边就有一边永远转不出来，而画面上只看得到「听不清楚」。 */
  const type = (clip.type || "audio/webm").split(";")[0];
  const ext =
    type === "audio/mp4" || type === "audio/x-m4a"
      ? "mp4"
      : type === "audio/mpeg"
        ? "mp3"
        : type === "audio/wav"
          ? "wav"
          : type === "audio/ogg"
            ? "ogg"
            : "webm";

  const startedAt = Date.now();
  let text = "";
  let usage: UsageShape = undefined;
  try {
    const heard = await openai.audio.transcriptions.create({
      model: AI_HEAR_MODEL,
      file: new File([clip], `note.${ext}`, { type }),
      prompt: HINT,
    });
    text = String((heard as { text?: string }).text ?? "").trim();
    usage = (heard as { usage?: UsageShape }).usage;
  } catch (e) {
    /* 🔴 一次失败的呼叫是最值得记的那一笔 —— `ai-usage.ts`
       那段注解写过为什么：不记，帐本答得了「花了多少钱」而
       答不了「它还正常吗」。 */
    await recordAiUsage(supabase, "hear", AI_HEAR_MODEL, undefined, {
      outcome: "failed",
      tookMs: Date.now() - startedAt,
    }).catch(() => {});
    return NextResponse.json(
      { ok: false, reason: "deaf", detail: String((e as Error).message).slice(0, 120) },
      { status: 502 },
    );
  }

  await recordAiUsage(supabase, "hear", AI_HEAR_MODEL, usage, {
    tookMs: Date.now() - startedAt,
  }).catch(() => {});

  /* 🔴 一句空的回来，要讲得出是「没听到」，不是「做完了」。
     一个静静回空字串的转录，会让那个框看起来像没反应过。 */
  if (!text) {
    return NextResponse.json({ ok: false, reason: "nothing-heard" }, { status: 200 });
  }

  return NextResponse.json({ ok: true, text, tookMs: Date.now() - startedAt });
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * 闸道打进来说「这一张付了」。
 *
 * ── 🔴 这一支是那条线上唯一还缺的那一段 ──────────────────────────────────
 *
 * 他要的是一句话：**客人给了钱，系统自己多一行，不用打字。**
 * 三段里前后两段本来就在了 —— 缺的是中间这一段，也就是这个档案。
 *
 * ── 🔴 它自己不写任何东西 ────────────────────────────────────────────────
 *
 * 它把闸道讲的话翻成四个值，然后交给 `settle_payment_request`，
 * 而那一支再交给 `add_ledger_entry_core` —— **跟他手按那颗按钮走的是
 * 同一份逻辑**（单号 · 认人 · 分摊 · 防重复）。
 *
 * 这一条不是洁癖：[重点 23] 禁的就是「为某一条路另写一支比较方便的写入」，
 * 而这个仓库十九次「说了没做」，每一次的形状都是**同一件事有两条路，
 * 只修了一条**。钱这一层再开第二条，代价是他月底对不上帐。
 *
 * ── ⚠️ 那个「接缝」，跟它现在为什么是空的 ────────────────────────────────
 *
 * `readPayload` 就是接缝：一家闸道送来的 JSON 长什么样、签名怎么验，
 * 只有那一家自己的文件讲得准。**我们今天一家都还没开户**
 * （[任务 70] 查过 CHIP · Billplz · toyyibPay 的费率，而开户卡在公司注册），
 * 所以这里**没有假装知道 CHIP 的栏位叫什么** —— 那会变成一段看起来
 * 已经接好、而接上真的闸道那天才发现全错的代码。
 *
 * 今天它收一个中性的形状，而接上任何一家的时候，**只有这一支要改**。
 *
 * ── 🔴 没有密钥就不开门 ──────────────────────────────────────────────────
 *
 * 没设 `PAY_CALLBACK_SECRET` 的时候它回 503，**不是「就先让它过」** ——
 * 一个谁都打得进来的收款回呼，等於任何人都可以往任何一家的帐上写钱。
 */

/** 闸道通常等两三秒就当我们挂了。这一支只做一次资料库呼叫。 */
export const maxDuration = 30;

/** 我们今天认得的几家。**不是写死在资料库那一层** ——
 *  那一栏故意是自由文字，因为他还没选哪一家（见 20260905020000）。 */
const KNOWN = new Set(["chip", "billplz", "toyyibpay", "manual"]);

type Settled = {
  providerRef: string;
  paidCents: number;
  method: string;
  payer: string;
};

/**
 * 接缝：闸道的话 → 四个值。
 *
 * ⚠️ 接上真的闸道的时候，**改的只有这一支**，而且要照那一家文件里的原文写，
 * 不是照印象（[重点 26]）。今天收的是一个中性形状，只够让整条线跑得通。
 */
function readPayload(provider: string, body: Record<string, unknown>): Settled | null {
  const ref = String(body.provider_ref ?? body.reference ?? body.id ?? "").trim();
  if (!ref) return null;

  /* 分，不是令吉。**收「令吉」会在某一家送 "12.50" 的时候变成 12 分。**
     所以只收整数分，读不出来就是读不出来。 */
  const raw = body.paid_cents ?? body.amount_cents ?? body.amount;
  const cents = typeof raw === "string" ? Number(raw) : (raw as number);
  if (!Number.isFinite(cents) || !Number.isInteger(cents) || cents < 0) return null;

  return {
    providerRef: ref,
    paidCents: cents,
    method: String(body.method ?? provider).slice(0, 60),
    payer: String(body.payer ?? body.payer_name ?? "").slice(0, 200),
  };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const secret = process.env.PAY_CALLBACK_SECRET;
  if (!secret) {
    /* 没有密钥就没有门。见档头 —— 这不是一个可以「先放着」的预设。 */
    return NextResponse.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }

  /* ⚠️ 一个共用密钥，不是签名验证。真的闸道用的是 HMAC 签章，
     而那要照那一家的文件写 —— 接上去的时候连同 `readPayload` 一起换。
     在那之前这一条挡得住「随便一个人打进来」，挡不住「有人偷到密钥」。 */
  const given = req.headers.get("x-pay-secret") ?? "";
  if (given !== secret) {
    return NextResponse.json({ ok: false, reason: "bad-secret" }, { status: 401 });
  }

  const provider = (await params).provider?.toLowerCase() ?? "";
  if (!KNOWN.has(provider)) {
    return NextResponse.json({ ok: false, reason: "unknown-provider" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, reason: "bad-body" }, { status: 400 });

  const read = readPayload(provider, body);
  if (!read) {
    return NextResponse.json({ ok: false, reason: "unreadable" }, { status: 400 });
  }

  /* service role：这一支没有 auth.uid() 可以问，而 `settle_payment_request`
     只 grant 给它。它的权力来源是「那一张付款要求存在，而且还没结」。 */
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await db.rpc("settle_payment_request", {
    in_provider: provider,
    in_provider_ref: read.providerRef,
    in_paid_cents: read.paidCents,
    in_method: read.method,
    in_payer: read.payer,
  });

  if (error) {
    /* 🔴 认不得那个编号回 404，**不是 500** —— 闸道对 5xx 会一直重送，
       而一个我们根本没有开过的编号，重送一万次也不会变成认得。 */
    const unknown = /no such payment request/i.test(error.message);
    console.error("settle failed", provider, read.providerRef, error.message);
    return NextResponse.json(
      { ok: false, reason: unknown ? "no-such-request" : "settle-failed" },
      { status: unknown ? 404 : 500 },
    );
  }

  const row = (data ?? null) as { status?: string; entry_id?: string } | null;
  /* 200 就算它本来就已经结掉了 —— 那是重送，而重送是常态不是错误。
     回非 2xx 会让闸道一直重送，然后我们每一次都在告诉它我们坏了。 */
  return NextResponse.json({ ok: true, status: row?.status ?? "paid", entryId: row?.entry_id ?? null });
}

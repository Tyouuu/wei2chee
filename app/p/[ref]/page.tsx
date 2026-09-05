import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAnonSupabaseClient } from "@/lib/supabase/server";
import { RequestForm } from "./request-form";

/**
 * 一个经销商自己那一页 —— 第二个不用登入的画面。
 *
 * ── 为什么它在 app/[locale]/ 外面 ─────────────────────────────────────────
 *
 * 跟 `/s/<slug>` 同一个理由：这一页不是 Formae 在跟老板讲话，是**那门生意
 * 在跟它自己的下游讲话**。一条要发给经销商的连结不该带我们的语言前缀，
 * 而且这里也没有语言可以挑 —— 这一页讲的是那套系统自己的语言。
 * `proxy.ts` 把 `/p/` 排除掉就是为了这个。
 *
 * ── 🔴 它看得到什么，看不到什么 ───────────────────────────────────────────
 *
 * 只有两样：**这家公司叫什么** · **他自己送过的那几笔**。
 * `party_portal`（20260905680000）是这一层唯一的出口，所以要审的是那一支，
 * 不是这里的查询 —— 一个写在这里的查询，下一次改动就可能悄悄放宽。
 *
 * 故意没有的两样，写下来免得下一轮当成漏做：
 *  · **他欠多少** —— `party_statement` 是 sees_money 的。把一个人的整个户口
 *    挂在一条带着走的连结上，是另一个决定：那条连结一外流，
 *    就从「多一笔假请求」变成「他的帐」。
 *  · **他的单走到哪** —— [任务 155] 已经在做，而那是**一张单一个门牌**、
 *    老板自己开的。一条看得到全部单的连结不是它的方便版，是另一个爆炸半径。
 *
 * ⚠️ **那条连结认得出是谁，认不出是本人。** 抄的就是他自己 0042 那一句，
 * 而它**只有在这条连结动不了钱的时候才成立**。哪天要让它付钱，这一条要重想。
 */

export const dynamic = "force-dynamic";

/* 🔴 不给搜寻引擎收。一条发给某一个经销商的连结被 Google 收进去，
   就是这一层唯一真正会漏的方式。 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/* 🔴 **栏位名照那支函式回的，不是照我记得的。**
   第一版写了 `id` / `amount_cents` / `created_at` —— 三个都不存在，
   於是 `created_at.slice()` 当场把整页炸掉，
   而画面上写的是「这一页载不出来」，看起来像连结坏了。
   一支函式回什么，只有打开它读一次才知道（重点 26）。 */
type PortalRequest = {
  what: string;
  qty: number | null;
  amountCents: number | null;
  status: string;
  docNo: string | null;
  askedOn: string;
};

type Portal = {
  found: boolean;
  business?: string;
  you?: string;
  lang?: string;
  requests?: PortalRequest[];
};

const WORDS = {
  en: {
    title: "Send us a request",
    lede: "Type what you need. We will see it and come back to you.",
    yours: "What you have sent",
    none: "Nothing sent yet.",
    /* 「order」是错的一半：他送的那一笔可能开成报价单、订单或者一张工程单
       —— 三种里两种不叫 order。单号自己会讲是哪一张。 */
    done: "Opened as",
    dropped: "Closed",
    open: "With us",
    gone: "This link is not in use.",
    goneLede: "Ask them to send you a new one.",
  },
  zh: {
    title: "跟我们讲一声",
    lede: "写你要的东西。我们看到就回你。",
    yours: "你送过的",
    none: "还没有送过东西。",
    done: "已经开单了",
    dropped: "已经关掉",
    open: "在我们这里",
    gone: "这条连结不能用了。",
    goneLede: "跟他要一条新的。",
  },
} as const;

export default async function PartyPortalPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;

  /* 一个乱猜的号码跟一条关掉的连结，答案是**一模一样**的 ——
     不然这一页就变成一台可以拿来试号码的机器。 */
  const supabase = createAnonSupabaseClient();
  const { data, error } = await supabase.rpc("party_portal", { in_ref: ref });
  if (error) notFound();
  const portal = (data ?? { found: false }) as Portal;

  const lang = portal.lang === "zh" ? "zh" : "en";
  const w = WORDS[lang];

  if (!portal.found) {
    return (
      <main
        lang={lang === "zh" ? "zh-Hans" : "en"}
        className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-2 px-6 py-16"
      >
        <h1 className="text-xl font-semibold text-neutral-900">{w.gone}</h1>
        <p className="text-sm text-neutral-600">{w.goneLede}</p>
      </main>
    );
  }

  const requests = portal.requests ?? [];
  const money = (cents: number | null) =>
    cents == null ? null : `RM ${(Number(cents) / 100).toLocaleString("en-MY")}`;

  return (
    <main
      lang={lang === "zh" ? "zh-Hans" : "en"}
      className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-8 px-6 py-10"
    >
      <header className="flex flex-col gap-1">
        <p className="text-sm text-neutral-500">{portal.business}</p>
        <h1 className="text-xl font-semibold text-neutral-900">{portal.you}</h1>
      </header>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">{w.title}</h2>
          <p className="mt-1 text-sm text-neutral-600">{w.lede}</p>
        </div>
        <RequestForm refId={ref} lang={lang} />
      </section>

      <section className="flex flex-col gap-3 border-t border-neutral-200 pt-6">
        <h2 className="text-base font-semibold text-neutral-900">{w.yours}</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-neutral-600">{w.none}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {requests.map((r, i) => (
              <li key={`${r.askedOn}-${i}`} className="flex flex-col gap-1">
                <p className="text-sm text-neutral-900">{r.what}</p>
                <p className="text-xs text-neutral-500">
                  {(r.askedOn ?? "").slice(0, 10)}
                  {r.qty != null ? ` · ${r.qty}` : ""}
                  {money(r.amountCents) ? ` · ${money(r.amountCents)}` : ""}
                  {" · "}
                  {r.status === "done"
                    ? `${w.done}${r.docNo ? ` ${r.docNo}` : ""}`
                    : r.status === "dropped"
                      ? w.dropped
                      : w.open}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

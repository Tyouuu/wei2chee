import type { Metadata } from "next";
import { createAnonSupabaseClient } from "@/lib/supabase/server";
import { StyleScope } from "@/design-system/editor/style-scope";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { AnswerForm } from "./answer-form";
import { SignForm } from "./sign-form";
import { priceSchedule } from "@/lib/portal/payment-terms";

/**
 * 客人打开他自己那张单 —— 第三个不用登入的画面。
 *
 * ── 为什么它值得一整条网址 ────────────────────────────────────────────────
 *
 * 那四支函式 20260905230000 就做好了，而画面上一个入口都没有：
 * **一条没有人发得出去的连结，跟一条不存在的连结是同一件事。**
 *
 * 而它同时是[任务 155] 那两件事的同一样东西：
 * **①「线上按同意」跟 ③「客人自己看得到这一单」底下是同一页**，
 * 做一次两件一起有。
 *
 * ── 🔴 它穿的是他的漆，不是我们的 ────────────────────────────────────────
 *
 * `public_shared_record` 回 `style` 跟 `palette` —— 屋主打开这一页看到的
 * 应该是**那家装修公司**，不是 Formae。所以这一页套 `StyleScope`，
 * 跟 `/s/<slug>` 同一个做法；根 layout 故意**不铺白底**，
 * 不然会盖掉他选的开场色。
 *
 * ── 🔴 它看得到什么，看不到什么 ───────────────────────────────────────────
 *
 * 那一支挑出来的那几栏，而且**逐项的注解不在里面** ——
 * 「这个我们进价 12」写在那里完全合理，而它绝不可以出现在客人眼前。
 * 20260905240000 故意把它漏出去看那条守卫红过一次，250000 补回来。
 *
 * 看不到：一个 id 都没有 · 这个客人的**其他单** · 成本 · 他欠多少。
 *
 * ── 过期了不准按同意，而且只挡同意 ────────────────────────────────────────
 *
 * [任务 115] 说「过期只讲不挡」，**那一条讲的是老板自己**。
 * 这里按下去的是陌生人，按的是一个**承诺** —— 而一个有效期存在的
 * 全部意义就是过了那天它不再能被接受。
 * 「我要改一点」照旧准：想问一句的人不该没有地方讲。
 */

export const dynamic = "force-dynamic";

/* 🔴 不给搜寻引擎收。一张发给某一个屋主的报价单被 Google 收进去，
   就是这一层唯一真正会漏的方式。 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Line = {
  description: string | null;
  qty: number | null;
  unit: string | null;
  unit_price_cents: number | null;
  amount_cents: number | null;
};
type Term = {
  description: string | null;
  portion: number | null;
  amount_cents: number | null;
  due_on: string | null;
};
type Shared = {
  business_name: string | null;
  style: string | null;
  palette: string | null;
  system_language: string | null;
  module_key: string | null;
  doc_no: string | null;
  title: string | null;
  party: string | null;
  stage: string | null;
  amount_cents: number | null;
  issued_on: string | null;
  due_on: string | null;
  is_expired: boolean | null;
  can_answer: boolean | null;
  answer: string | null;
  answered_at: string | null;
  answered_name: string | null;
  answer_note: string | null;
  site_address: string | null;
  lines: Line[] | null;
  terms: Term[] | null;
  /* 送了几趟（20260905510000）。**门牌是每一趟自己的号码**，
     所以一条签收连结签的是那一趟，不是整张单。 */
  deliveries: Delivery[] | null;
};

type DeliveryLine = {
  description: string | null;
  qty: number | null;
  unit: string | null;
  batch_code: string | null;
  expiry_on: string | null;
};
type Delivery = {
  ref: string;
  run_on: string | null;
  signed_at: string | null;
  signed_name: string | null;
  lines: DeliveryLine[] | null;
};

const WORDS = {
  en: {
    gone: "This link is not in use.",
    goneLede: "Ask them to send you a new one.",
    issued: "Issued",
    validTill: "Valid until",
    expired: "This has expired.",
    site: "Site",
    deliveries: "Deliveries",
    signedBy: "Signed by",
    item: "Item",
    qty: "Qty",
    price: "Price",
    amount: "Amount",
    total: "Total",
    terms: "How it is paid",
    accepted: "Accepted",
    changes: "You asked for a change",
    on: "on",
  },
  zh: {
    gone: "这条连结不能用了。",
    goneLede: "跟他要一条新的。",
    issued: "开单日期",
    validTill: "有效到",
    expired: "这一张过期了。",
    site: "工地",
    deliveries: "送了几趟",
    signedBy: "签收",
    item: "项目",
    qty: "数量",
    price: "单价",
    amount: "金额",
    total: "总共",
    terms: "怎么付",
    accepted: "已经同意",
    changes: "你提了想改的地方",
    on: "於",
  },
} as const;

export default async function SharedRecordPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;

  /* 一个乱猜的号码、一条收回去的连结、一张收起来的单 —— **同一个答案**。 */
  const supabase = createAnonSupabaseClient();
  const { data, error } = await supabase.rpc("public_shared_record", { in_ref: ref });
  const doc = ((data ?? []) as Shared[])[0];

  const lang = doc?.system_language === "zh" ? "zh" : "en";
  const w = WORDS[lang];
  const htmlLang = lang === "zh" ? "zh-Hans" : "en";

  if (error || !doc) {
    return (
      <main
        lang={htmlLang}
        className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-2 bg-white px-6 py-16 text-neutral-900"
      >
        <h1 className="text-xl font-semibold">{w.gone}</h1>
        <p className="text-sm text-neutral-600">{w.goneLede}</p>
      </main>
    );
  }

  const rm = (cents: number | null) =>
    cents == null ? "" : `RM ${(Number(cents) / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const lines = doc.lines ?? [];
  /* 🔴 **分期要印钱，不只印比例。** 资料库存的是他答应的**条件**
     （三成），而金额是算出来的（任务 117：一个存起来的金额，多一行明细
     就当场过期）。所以这里跟老板那一边用**同一支**算术 ——
     两份算术就是两个真相，而这一份是给屋主看的那一份。
     ⚠️ 而屋主最想知道的正好是这个数：**订金要转多少。** */
  const terms = priceSchedule(
    (doc.terms ?? []).map((t) => ({
      description: t.description ?? "",
      portion: t.portion,
      amount_cents: t.amount_cents,
      due_on: t.due_on,
    })),
    doc.amount_cents,
  ).terms;

  return (
    <StyleScope
      register={(doc.style ?? "swiss") as StyleName}
      palette={doc.palette}
      className="ds-ground min-h-[100dvh] [background-color:var(--color-canvas)]"
    >
      <main
        lang={htmlLang}
        className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-10 text-[color:var(--color-on-canvas)]"
      >
        {/* 抬头：他的招牌，不是我们的。 */}
        <header className="flex flex-col gap-1">
          <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
            {doc.business_name}
          </p>
          <h1 className="[font-size:var(--text-hero)] [font-weight:var(--fw-semibold)]">
            {doc.title || doc.doc_no}
          </h1>
          <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
            {doc.doc_no}
            {doc.party ? ` · ${doc.party}` : ""}
            {doc.issued_on ? ` · ${w.issued} ${doc.issued_on}` : ""}
            {doc.due_on ? ` · ${w.validTill} ${doc.due_on}` : ""}
          </p>
          {doc.site_address ? (
            <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
              {w.site}: {doc.site_address}
            </p>
          ) : null}
          {doc.is_expired ? (
            <p className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]">
              {w.expired}
            </p>
          ) : null}
        </header>

        {/* 逐项。⚠️ 那一支不回逐项的注解 —— 「这个我们进价 12」不该给客人看。 */}
        {lines.length ? (
          <section className="overflow-x-auto">
            <table className="w-full [font-size:var(--text-sm)]">
              <thead>
                <tr className="text-left text-[color:var(--color-on-canvas-dim)]">
                  <th className="py-2 pr-3 [font-weight:var(--fw-medium)]">{w.item}</th>
                  <th className="py-2 pr-3 text-right [font-weight:var(--fw-medium)]">{w.qty}</th>
                  <th className="py-2 pr-3 text-right [font-weight:var(--fw-medium)]">{w.price}</th>
                  <th className="py-2 text-right [font-weight:var(--fw-medium)]">{w.amount}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-t [border-color:var(--color-ink-800)]">
                    <td className="py-2 pr-3">{l.description}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {l.qty == null ? "" : `${l.qty}${l.unit ? ` ${l.unit}` : ""}`}
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{rm(l.unit_price_cents)}</td>
                    <td className="py-2 text-right whitespace-nowrap tabular-nums">{rm(l.amount_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <section className="flex items-baseline justify-between border-t pt-4 [border-color:var(--color-ink-800)]">
          <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
            {w.total}
          </span>
          <span className="whitespace-nowrap [font-size:var(--text-stat)] [font-weight:var(--fw-semibold)] tabular-nums">
            {rm(doc.amount_cents)}
          </span>
        </section>

        {/* 怎么付。装修每一张单都有，而它正好是屋主最想看的那一段。 */}
        {terms.length ? (
          <section className="flex flex-col gap-2">
            <h2 className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
              {w.terms}
            </h2>
            <ul className="flex flex-col gap-1">
              {terms.map((t, i) => (
                <li
                  key={i}
                  className="flex justify-between [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]"
                >
                  <span>
                    {t.description}
                    {t.portion != null ? ` · ${t.portion}%` : ""}
                    {t.due_on ? ` · ${t.due_on}` : ""}
                  </span>
                  <span className="whitespace-nowrap tabular-nums">{rm(t.cents)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* 送了几趟。⚠️ 一趟货一条自己的门牌，所以**一条签收连结签的是那一趟**
            —— 一张单分两车出去，第二车要他再签一次，那本来就是对的。
            没有出过货就整段不画：一段永远说同一句话的段落，读起来是没做完。 */}
        {(doc.deliveries ?? []).length ? (
          <section className="flex flex-col gap-3 border-t pt-6 [border-color:var(--color-ink-800)]">
            <h2 className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
              {w.deliveries}
            </h2>
            {(doc.deliveries ?? []).map((d) => (
              <div key={d.ref} className="flex flex-col gap-1">
                <p className={"[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]"}>
                  {d.run_on ?? ""}
                  {(d.lines ?? []).length
                    ? ` · ${(d.lines ?? [])
                        .map((l) =>
                          `${l.description ?? ""}${l.qty == null ? "" : ` ${l.qty}${l.unit ? ` ${l.unit}` : ""}`}`.trim(),
                        )
                        .join(" · ")}`
                    : ""}
                </p>
                {d.signed_at ? (
                  <p className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                    {w.signedBy} {d.signed_name} · {d.signed_at.slice(0, 10)}
                  </p>
                ) : (
                  <SignForm refId={ref} deliveryRef={d.ref} lang={lang} />
                )}
              </div>
            ))}
          </section>
        ) : null}

        {/* 他已经答过了 —— 那时候不画表单，画他答了什么。
            ⚠️ 「同意」换不掉（那是承诺），「我要改一点」换得掉。 */}
        {doc.answer ? (
          <section className="border-t pt-6 [border-color:var(--color-ink-800)]">
            <p className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
              {doc.answer === "accepted" ? w.accepted : w.changes}
              {doc.answered_name ? ` — ${doc.answered_name}` : ""}
              {doc.answered_at ? ` ${w.on} ${doc.answered_at.slice(0, 10)}` : ""}
            </p>
            {doc.answer_note ? (
              <p className="mt-1 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                {doc.answer_note}
              </p>
            ) : null}
          </section>
        ) : null}

        {doc.can_answer ? (
          <section className="border-t pt-6 [border-color:var(--color-ink-800)]">
            <AnswerForm
              refId={ref}
              lang={lang}
              expired={!!doc.is_expired}
              answered={doc.answer}
            />
          </section>
        ) : null}
      </main>
    </StyleScope>
  );
}

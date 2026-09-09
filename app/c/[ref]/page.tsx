import type { Metadata } from "next";
import { StyleScope } from "@/design-system/editor/style-scope";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { createAnonSupabaseClient } from "@/lib/supabase/server";
import { SignForm } from "./sign-form";

/**
 * 她签的那一份表单 —— 第四个不用登入的画面。
 *
 * ── 为什么它在 app/[locale]/ 外面 ─────────────────────────────────────────
 *
 * 跟 `/s/` · `/p/` · `/r/` 同一个理由：这一页不是 Formae 在跟老板讲话，
 * 是**那门生意在跟她的客人讲话**。一条要发给客人的连结不该带我们的
 * 语言前缀，而且这里也没有语言可以挑 —— 这一页讲的是那套系统自己的语言。
 * `proxy.ts` 把 `/c/` 排除掉就是为了这个。
 *
 * ── 🔴 它看得到什么，看不到什么 ───────────────────────────────────────────
 *
 * `public_consent_form`（20260909130000）是这一层唯一的出口，
 * 所以要审的是那一支，不是这里的查询 —— 一个写在这里的查询，
 * 下一次改动就可能悄悄放宽。它回的是：
 * 这家公司的名字跟它自己那套样子 · **她自己的名字** ·
 * 那份表单的名字跟内容 · 她签了没有。
 *
 * 故意没有的，写下来免得下一轮当成漏做：
 *  · **她的疗程记录** —— 那是她最私密的一样东西（[任务 310]）
 *  · **她欠多少** —— `party_statement` 是 sees_money 的
 *  · **她别的同意书** —— **一条连结开一份表单**
 *  · **任何一个编号**
 *
 * ── 🔴 那一份字是快照，不是范本 ───────────────────────────────────────────
 *
 * 她读到的跟她签的必须是同一份 —— 老板今年三月改了措辞，
 * 而她去年十月签的是**当时那一份**。所以这一页印的是
 * `form_body`（发出去那一刻抄下来的），不是那份范本今天的样子。
 * **一份会跟着范本变的证据不是证据。**
 */

export const dynamic = "force-dynamic";

/* 🔴 不给搜寻引擎收。一条发给某一个客人的连结被 Google 收进去，
   就是这一层唯一真正会漏的方式 —— 而这一份上面有她的名字。 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/* 🔴 **栏位名照那支函式回的，不是照我记得的。**
   `/p/` 那一页第一版写了三个不存在的栏位名，於是整页当场炸掉，
   而画面上写的是「这一页载不出来」，看起来像连结坏了。
   一支函式回什么，只有打开它读一次才知道（[重点 26]）。 */
type Sheet = {
  business_name: string;
  style: string | null;
  palette: string | null;
  system_language: string | null;
  person_name: string;
  form_name: string;
  form_body: string;
  can_sign: boolean;
  signed_at: string | null;
  signed_name: string | null;
  signed_note: string | null;
};

const WORDS = {
  en: {
    gone: "This link is not in use.",
    goneLede: "Ask them to send you a new one.",
    signedOn: "Signed",
    by: "by",
    /* ⚠️ 「已经签过了」是一个**答案**，不是一句错误 —— 她回来看自己签了什么，
       正是这条连结签完之后唯一的用处。 */
    already: "You have signed this. Keep the link — you can read it again any time.",
  },
  zh: {
    gone: "这条连结不能用了。",
    goneLede: "跟他们要一条新的。",
    signedOn: "签於",
    by: "签的是",
    already: "你已经签了。这条连结留着，随时打得开来看。",
  },
} as const;

export default async function ConsentPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;

  /* 一个乱猜的号码 · 一条收回去的连结 · 一份根本不存在的表单 ——
     **三个答案一模一样**，不然这一页就变成一台可以拿来试号码的机器。 */
  const supabase = createAnonSupabaseClient();
  const { data, error } = await supabase.rpc("public_consent_form", { in_ref: ref });
  const sheet = (Array.isArray(data) ? data[0] : null) as Sheet | null;

  if (error || !sheet) {
    /* 🔴 这一屏**不穿那门生意的漆** —— 连结是坏的，我们就不知道那是谁家。
       编一套颜色出来正好是这一页最不该做的事。 */
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-neutral-900">{WORDS.en.gone}</h1>
        <p className="text-sm text-neutral-600">{WORDS.en.goneLede}</p>
      </main>
    );
  }

  const lang = sheet.system_language === "zh" ? "zh" : "en";
  const w = WORDS[lang];
  const htmlLang = lang === "zh" ? "zh-Hans" : "en";

  return (
    <StyleScope
      register={(sheet.style ?? "swiss") as StyleName}
      palette={sheet.palette}
      className="ds-ground min-h-[100dvh] [background-color:var(--color-canvas)]"
    >
      <main
        lang={htmlLang}
        className="mx-auto flex w-full max-w-2xl flex-col gap-7 px-6 py-10 text-[color:var(--color-on-canvas)]"
      >
        {/* 抬头：她的招牌，不是我们的。 */}
        <header className="flex flex-col gap-1">
          <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
            {sheet.business_name}
          </p>
          <h1 className="[font-size:var(--text-hero)] [font-weight:var(--fw-semibold)]">
            {sheet.form_name}
          </h1>
          {sheet.person_name ? (
            <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
              {sheet.person_name}
            </p>
          ) : null}
        </header>

        {/* 🔴 那一份字。`whitespace-pre-line` —— 她写的分段是那一份的一部分，
            把它压成一整块，读起来就不是同一份纸了。 */}
        <section className="whitespace-pre-line [font-size:var(--text-base,1rem)] [line-height:1.7]">
          {sheet.form_body}
        </section>

        <section className="flex flex-col gap-3 border-t [border-color:var(--color-ink-800)] pt-6">
          {sheet.can_sign ? (
            <SignForm refId={ref} lang={lang} />
          ) : (
            <div className="flex flex-col gap-1">
              <p className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
                {w.signedOn} {(sheet.signed_at ?? "").slice(0, 10)}
                {sheet.signed_name ? ` · ${w.by} ${sheet.signed_name}` : ""}
              </p>
              {sheet.signed_note ? (
                <p className="whitespace-pre-line [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                  {sheet.signed_note}
                </p>
              ) : null}
              <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                {w.already}
              </p>
            </div>
          )}
        </section>
      </main>
    </StyleScope>
  );
}

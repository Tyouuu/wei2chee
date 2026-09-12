import type { Metadata } from "next";
import { StyleScope } from "@/design-system/editor/style-scope";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { createAnonSupabaseClient } from "@/lib/supabase/server";
import { CancelForm } from "./cancel-form";
import { ReviewForm } from "./review-form";

/**
 * 她自己那张预约 —— 第五个不用登入的画面。
 *
 * ── 为什么它值得一整条网址（2026-09-12，[任务 398] 之后的下一件）─────────
 *
 * `public_appointment` · `cancel_shared_appointment` · `submit_appointment_review`
 * 三支（20260910630000 / 20260911010000）从做出来那天起零个呼叫端——
 * `appointments.public_ref` 这个门牌存在，而没有一条网址读过它、
 * 也没有一个按钮写过它。一条没有人发得出去的连结，跟一条不存在的
 * 连结是同一件事（[任务 155]，`r/[ref]` 那次的同一句话）。
 *
 * ── 跟 `/r/` `/c/` 同一个理由，不重复讲一次这一层为什么在 app/[locale]/ 外面
 *
 * 见 `app/c/[ref]/page.tsx` 档头。
 *
 * ── 🔴 它看得到什么，看不到什么——照 `public_appointment` 自己的规矩 ───────
 *
 * 看得到：这家自己的名字跟样子 · 她自己的名字 · 什么服务 · 几点 ·
 * 现在是什么状态 · 还能不能取消 · 还能不能留评价（或者她留过的那一句）。
 * 🔴 看不到：任何 id · 她的其他预约 · 钱 · 她的手机号码。
 *
 * ── 四种状态，只答她这一刻真的问得出的那一句 ────────────────────────────
 *
 * `booked` 给取消；`done` 给评价（或者她已经留过的那一句）；`cancelled` ·
 * `no_show` 只讲现在是什么状态，不给任何按钮——两者都是已经定案的结局，
 * 这一页不是拿来跟柜台吵的地方。
 */

export const dynamic = "force-dynamic";

/* 不给搜寻引擎收——一条发给某一个客人的连结被 Google 收进去，
   就是这一层唯一真正会漏的方式，而这一页上有她的名字。 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Sheet = {
  business_name: string;
  style: string | null;
  palette: string | null;
  system_language: string | null;
  party_name: string;
  service: string;
  starts_at: string;
  ends_at: string;
  status: string;
  can_cancel: boolean;
  can_review: boolean;
  review_rating: number | null;
  review_text: string | null;
};

const WORDS = {
  en: {
    gone: "This link is not in use.",
    goneLede: "Ask them to send you a new one.",
    status_booked: "Booked",
    status_cancelled: "Cancelled",
    status_done: "Done",
    status_no_show: "Marked as missed",
    reviewedHeading: "What you said",
  },
  zh: {
    gone: "这条连结不能用了。",
    goneLede: "跟他们要一条新的。",
    status_booked: "已经排好",
    status_cancelled: "取消了",
    status_done: "做完了",
    status_no_show: "记成没来",
    reviewedHeading: "你说的",
  },
} as const;

export default async function BookingPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;

  /* 一个乱猜的号码 · 一条收回去的连结 · 一笔根本不存在的预约 ——
     三个答案一模一样，不然这一页就变成一台可以拿来试号码的机器。 */
  const supabase = createAnonSupabaseClient();
  const { data, error } = await supabase.rpc("public_appointment", { in_ref: ref });
  const appt = (Array.isArray(data) ? data[0] : null) as Sheet | null;

  if (error || !appt) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-neutral-900">{WORDS.en.gone}</h1>
        <p className="text-sm text-neutral-600">{WORDS.en.goneLede}</p>
      </main>
    );
  }

  const lang = appt.system_language === "zh" ? "zh" : "en";
  const w = WORDS[lang];
  const htmlLang = lang === "zh" ? "zh-Hans" : "en";

  const statusWord =
    appt.status === "cancelled"
      ? w.status_cancelled
      : appt.status === "done"
        ? w.status_done
        : appt.status === "no_show"
          ? w.status_no_show
          : w.status_booked;

  const when = new Date(appt.starts_at);
  const whenText = Number.isNaN(when.getTime())
    ? ""
    : when.toLocaleString(lang === "zh" ? "zh-CN" : "en-MY", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      });

  return (
    <StyleScope
      register={(appt.style ?? "swiss") as StyleName}
      palette={appt.palette}
      className="ds-ground min-h-[100dvh] [background-color:var(--color-canvas)]"
    >
      <main
        lang={htmlLang}
        className="mx-auto flex w-full max-w-2xl flex-col gap-7 px-6 py-10 text-[color:var(--color-on-canvas)]"
      >
        {/* 抬头：她的招牌，不是我们的。 */}
        <header className="flex flex-col gap-1">
          <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
            {appt.business_name}
          </p>
          <h1 className="[font-size:var(--text-hero)] [font-weight:var(--fw-semibold)]">
            {appt.service || appt.party_name}
          </h1>
          <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
            {appt.party_name}
            {whenText ? ` · ${whenText}` : ""}
            {` · ${statusWord}`}
          </p>
        </header>

        {appt.status === "booked" ? (
          <section className="flex flex-col gap-3 border-t pt-6 [border-color:var(--color-ink-800)]">
            <CancelForm refId={ref} lang={lang} />
          </section>
        ) : null}

        {appt.status === "done" ? (
          <section className="flex flex-col gap-3 border-t pt-6 [border-color:var(--color-ink-800)]">
            {appt.can_review ? (
              <ReviewForm refId={ref} lang={lang} />
            ) : appt.review_rating ? (
              <div className="flex flex-col gap-1">
                <h2 className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                  {w.reviewedHeading}
                </h2>
                <p className="[font-size:var(--text-lg,1.25rem)]">
                  {"★".repeat(appt.review_rating)}
                  <span className="text-[color:var(--color-on-canvas-dim)]">
                    {"★".repeat(5 - appt.review_rating)}
                  </span>
                </p>
                {appt.review_text ? (
                  <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                    {appt.review_text}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </StyleScope>
  );
}

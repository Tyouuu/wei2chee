"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ringgit } from "@/lib/portal/live-rows";
import { waLink } from "@/lib/portal/wa-link";
import { DeskCard, deskBtn, deskDim } from "../desk-kit";

/**
 * 系统自己看出来的下一步。
 *
 * ── 为什么它排在他自己写的那一份**上面**（2026-09-06）───────────────────
 *
 * 底下那一份是**他自己写下的承诺**（「打给陈太太」）—— 他已经知道。
 * 这一份是**他还不知道的**：报价快到期了、客人按了同意而订金没进来、
 * 保养该去了、套票剩最后一次、货低过补货线、官网有人订了他还没看过。
 *
 * 六个信号 2026-09-06 就算得出来（`nudges_due`，[任务 212](../../../../../docs/founder-tasks.md#212)），
 * 而**画面上一个入口都没有** —— 那一条自己的收尾就写着这句。
 *
 * ── 🔴 它跟底下那一份长得不一样，而且是有理由的不一样 ────────────────────
 *
 * 老板：**「我不要一直都是相同的组件」**。两份清单叠在一起最容易变成
 * 同一个东西印两次。它们真的不同的地方就摆在最前面：
 *
 *     这一份   每一行**先讲是哪一种事**，而且给得了一颗「知道了，别再提」
 *     那一份   每一行是**他自己写的那句话**，而且点得进那张单
 *
 * ── ⚠️ 一行都不存 ────────────────────────────────────────────────────────
 *
 * 六个信号全部是**算出来的**：客人付了订金，那一行自己就不见了。
 * 唯一存起来的是「别再提」那一条（`nudge_snoozes`），而它存的是**日子**
 * 不是天数 —— 存天数每天要有人去减。
 */

export type Nudge = {
  kind: string;
  subject_id: string;
  record_id: string | null;
  party: string | null;
  title: string | null;
  due_on: string | null;
  days_late: number | null;
  /** 🔴 师傅拿回来是 null —— 「不给看」跟「零」是两句话。 */
  amount_cents: number | null;
  qty_left: number | null;
  qty_floor: number | null;
  /** 上一次替这一件事讲话是哪一天。⚠️ 只算**真的发出去的**那几句 ——
   *  排着等的、退回来的都不算，不然它会讲一件没有发生过的事。 */
  last_told_on: string | null;
  /** 这句话是讲给谁听的：`owner`（他自己）还是 `customer`（他的客人）。
   *  `messages.audience` 那一栏的两个值，一字不差。 */
  audience: string | null;
  /** 讲给哪一个人。**没有人可以讲的时候是 null** —— 那正是「补货线破了」
   *  那一种：那件事只关他自己。 */
  party_id: string | null;
  /** 那一句话本身，资料库写好的。
   *
   *  🔴 **不在这里再写一次。** `messages.body` 是 not null，所以每一个
   *  发讯息的地方都要交出一句话；写在画面这一边，就是十一句话散在
   *  十一个画面里，而**送去审核的模板跟真的发出去的那一句会分家**
   *  —— 而 Meta 只让你发审过的那一句（[任务 250](../../../../../docs/founder-tasks.md#250)）。 */
  body: string | null;
};

/**
 * 六种事各自的抬头。
 *
 * ⚠️ 它是一份**手写的对照表**，而这个仓库栽在那种东西上至少八次 ——
 * 所以配一条守卫：`nudges_due` 里每一种 `kind`，这里都要有一句
 * （`nudge-kinds.test.ts` 从那支 migration 自己读出来对帐）。
 * 认不得的那一种照样画得出来（印它自己的名字），**不会让整页炸掉** ——
 * 一个少一句话的画面，比一个白掉的画面好。
 */
const KIND_LABEL: Record<string, string> = {
  quote_expiring: "kind_quote_expiring",
  agreed_unpaid: "kind_agreed_unpaid",
  contract_due: "kind_contract_due",
  package_last: "kind_package_last",
  below_reorder: "kind_below_reorder",
  booking_unseen: "kind_booking_unseen",
  /* 🔴 这三种是 2026-09-06 那一支加的（`20260906360000`），
     而我照着一支旧的 migration 写了六种 —— **守卫第一次跑就点名了它们**。
     那正是这条守卫存在的理由：一份手写的对照表活得比它描述的东西久。 */
  payment_overdue: "kind_payment_overdue",
  rental_overdue: "kind_rental_overdue",
  referral_owing: "kind_referral_owing",
  /* 🔴 第十种是**在我写这一份的时候**加进去的（`20260906370000`）——
     而守卫当场就点名了它。那就是这条守卫在做的事：
     资料库那一支会长，而这份对照表不会自己跟着长。 */
  request_open: "kind_request_open",
  /* 🔴 第十一种（`20260906750000`）—— 又一次守卫先讲话。
     一个学生连着两堂没来，对一间补习中心就是一个快要走掉的客户。 */
  absent_twice: "kind_absent_twice",
  /* 🔴 第十二种（`20260907010000`）—— 守卫第三次先讲话。
     一个客人照他自己的节奏早就该回来了，而他没有。
     ⚠️ 它带的两个数字是**来过几次 · 平常隔几天**，不是库存那两个 ——
     见底下 `detail()`：一句借来的话正是第十一种上线时印错的那一句。 */
  party_lapsed: "kind_party_lapsed",
};

/**
 * 🔴 那两栏是**借来的**，六种事借去装六样不同的东西。
 *
 * `nudges_due` 只有两栏放数字（`qty_left` · `qty_floor`），
 * 而那一支自己的注解就写着「借同两栏」：
 *
 *   below_reorder   架上剩几个 · 补货线
 *   package_last    套票还剩几次
 *   rental_overdue  借出去几件
 *   request_open    他要几件
 *   absent_twice    缺席几堂
 *   party_lapsed    来过几次 · 平常隔几天
 *
 * ── 在这一段之前只有一句话 ────────────────────────────────────────────
 *
 * `leftOf`＝「还剩 N，线是 M」，而**六种里五种借的不是库存**。
 * 所以今天画出来是：
 *
 *   一张剩最后一次的套票   → 「还剩 1，线是 0」
 *   两百张逾期没还的椅子   → 「还剩 200，线是 0」
 *   经销商要五十件        → 「还剩 50，线是 0」
 *   连着两堂没来的学生     → 「还剩 2，线是 0」
 *
 * 🔴 **`，线是 0` 在那四种里一次都讲不通**，而它不报错、不会红、
 * 也不会让页面白掉 —— 那正是它活着的原因。
 * 抓到它的是 `nudge-kinds.test.ts` 新加的那一条：第十二种加进来的那天，
 * 它顺手点名了另外三种。
 *
 * ⚠️ 认不得的那一种退回 `leftOf`，不是不画 ——
 * 少一句合身的话，比少一个数字好。
 */
const QTY_WORD: Record<string, string> = {
  below_reorder: "leftOf",
  package_last: "sessionsLeft",
  rental_overdue: "qtyOut",
  request_open: "qtyAsked",
  absent_twice: "missedLessons",
  party_lapsed: "visitsEvery",
};

export function NudgeList({
  projectId,
  locale,
  rows,
  isOwner,
  moduleOf,
  phoneOf,
}: {
  projectId: string;
  locale: string;
  rows: Nudge[];
  isOwner: boolean;
  /** 哪一张单在哪一页 —— 只有伺服器那一边知道他把它叫什么。 */
  moduleOf: Record<string, string>;
  /** 那个人的 WhatsApp 号码。**查不到的不在这里面** —— 见底下 `tellHref`。 */
  phoneOf: Record<string, string>;
}) {
  /* 直接读字典，不走一个字包 —— 这一份要按每一行填日子跟数量，
     而那正是 ICU 参数在做的事。 */
  const t = useTranslations("portal.today");
  const router = useRouter();
  const [hushed, setHushed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState("");

  const key = (n: Nudge) => `${n.kind}|${n.subject_id}`;
  const shown = rows.filter((n) => !hushed.has(key(n)));

  async function hush(n: Nudge) {
    if (busy) return;
    setBusy(key(n));
    /* 当场消失，改不了就放回去 —— 一颗按了三秒没反应的按钮会被按第二次，
       而一颗看起来成功而资料库里没变的按钮更糟。 */
    setHushed((s) => new Set(s).add(key(n)));
    try {
      const { error } = await createBrowserSupabaseClient().rpc(
        "snooze_nudge",
        {
          in_project_id: projectId,
          in_kind: n.kind,
          in_subject_id: n.subject_id,
          in_days: 7,
        },
      );
      if (error) {
        setHushed((s) => {
          const next = new Set(s);
          next.delete(key(n));
          return next;
        });
        setSaid(t("saveFailed"));
      }
    } finally {
      setBusy(null);
    }
  }

  async function seenBookings() {
    if (busy) return;
    setBusy("seen");
    try {
      const { error } = await createBrowserSupabaseClient().rpc(
        "mark_bookings_seen",
        {
          in_project_id: projectId,
        },
      );
      if (error) setSaid(t("saveFailed"));
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  /**
   * 🔴 这一件事的那一句话，发给那个人 —— 而那条连结要嘛是真的，要嘛不画。
   *
   * ── 为什么它今天就成立，而「发出去」那一整件事还卡着 ──────────────
   *
   * 系统自己发讯息要一个通过 Meta 商业验证的号码，而那卡在公司
   * （[任务 11](../../../../../docs/founder-tasks.md#11) ·
   * [249](../../../../../docs/founder-tasks.md#249)）。
   * **而这一条不是系统在发，是他自己按的** —— 号码是他客人的，
   * 从他自己的名册上来；那句话是资料库写好的（`nudges_due.body`）。
   * `record_message_sent` 从做出来那天起就是为这一条路建的，
   * 而它到今天为止**一个呼叫端都没有**。
   *
   * ── 🔴 四个条件缺一个就不画 ────────────────────────────────────────
   *
   *   ① 他是老板     —— 那张表是 `sees_money` 的，师傅按了会被拒
   *   ② 讲给客人听   —— `owner` 那几条是讲给他自己的，没有人可以发
   *   ③ 有那个人     —— 「补货线破了」只关他自己，没有对象
   *   ④ 号码认得出来 —— 见 lib/portal/wa-link.ts。**认不出来就不画**，
   *      而不是画一颗打给空气的（官网那颗就是那样活了十几天）
   */
  function tellHref(n: Nudge): string | null {
    if (!isOwner || n.audience !== "customer" || !n.party_id || !n.body)
      return null;
    return waLink(phoneOf[n.party_id], n.body);
  }

  /**
   * 他按了那条连结 —— 记一笔。
   *
   * ⚠️ **记的是「他把这句话交出去了」，不是「客人收到了」。**
   * 他有可能开了 WhatsApp 又把它关掉。而另一条路（另外给一颗
   * 「我发了」的按钮）他会忘记按，那本帐就永远是空的，
   * 於是催款那一条会一直讲同一句话。两个都不完美，选会被用的那一个，
   * 而画面上写的是「9月3日 讲过」——**一句关於他做过什么的话**，
   * 不是一句关於送达的话。
   *
   * ⚠️ 连结自己会开（`target="_blank"`），**不在这里 `window.open`** ——
   * 一个 `await` 之后才开的分页会被挡下来，而他会以为那颗按钮坏了。
   */
  async function told(n: Nudge) {
    if (busy) return;
    setBusy(key(n));
    try {
      const { error } = await createBrowserSupabaseClient().rpc(
        "record_message_sent",
        {
          in_project_id: projectId,
          in_audience: "customer",
          in_kind: n.kind,
          in_body: n.body,
          in_subject_id: n.subject_id,
          in_party_id: n.party_id,
        },
      );
      /* 讯息他已经看到了（那一页开着）—— 所以这里坏掉只是**没记下来**，
         而那句话要讲清楚是哪一种，不是笼统的一句「存不了」。 */
      if (error) setSaid(t("tellNotLogged"));
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  /** 这一行第二句话 —— 每一种事自己讲自己的。 */
  function detail(n: Nudge): string {
    const bits: string[] = [];
    if (n.party) bits.push(n.party);
    if (n.title && n.title !== n.party) bits.push(n.title);
    if (n.qty_left != null)
      bits.push(
        t(QTY_WORD[n.kind] ?? "leftOf", {
          n: Number(n.qty_left),
          m: Number(n.qty_floor ?? 0),
        }),
      );
    if (n.due_on) {
      const late = Number(n.days_late ?? 0);
      bits.push(
        late > 0
          ? t("lateBy", { n: late, date: n.due_on })
          : t("on", { date: n.due_on }),
      );
    }
    if (n.amount_cents != null)
      bits.push(ringgit(Number(n.amount_cents)) ?? "");
    return bits.filter(Boolean).join(" · ");
  }

  const anyBooking = shown.some((n) => n.kind === "booking_unseen");

  return (
    <DeskCard
      title={t("nudgesLabel")}
      action={
        /* 🔴 「都看过了」是**一整家**的动作（`mark_bookings_seen` 收的是
           project，不是一笔），所以它是卡头上的一颗，不是每一行一颗。
           而它是 `sees_money` 的，师傅按不了 —— 按不了的就不画。 */
        anyBooking && isOwner ? (
          <button
            type="button"
            disabled={busy === "seen"}
            onClick={() => void seenBookings()}
            className={deskBtn()}
          >
            {t("seenAll")}
          </button>
        ) : undefined
      }
    >
      <p className={`mb-4 ${deskDim}`}>{t("nudgesLede")}</p>
      {shown.length === 0 ? (
        <p className={deskDim}>{t("noNudges")}</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((n) => {
            const late = Number(n.days_late ?? 0) > 0;
            const page = n.record_id ? moduleOf[n.record_id] : undefined;
            return (
              <li
                key={key(n)}
                className={
                  "flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t py-4 pl-3 " +
                  "[border-color:var(--color-ink-800)] " +
                  (late
                    ? "[box-shadow:inset_2px_0_0_var(--color-clay-bright)]"
                    : "[box-shadow:inset_2px_0_0_var(--color-ink-800)]")
                }
              >
                {/* 先讲是哪一种事 —— 这一份跟他自己写的那一份差别就在这里。 */}
                <span className="[font-weight:var(--fw-medium)] [color:var(--color-paper)]">
                  {KIND_LABEL[n.kind] ? t(KIND_LABEL[n.kind]) : n.kind}
                </span>
                <span
                  className={`min-w-0 flex-1 ${late ? "text-[color:var(--color-clay-bright)]" : deskDim}`}
                >
                  {detail(n)}
                </span>
                {/* 🔴 上一次讲这一件事是哪一天。**只算真的发出去的那几句**
                    （`nudges_due` 自己滤掉排着等的跟退回来的）——
                    而它旁边不写「还要不要再讲」：那是一个天数，
                    而这个仓库刚立过不发明天数那条规矩。 */}
                {n.last_told_on ? (
                  <span className={deskDim}>
                    {t("toldOn", { date: n.last_told_on })}
                  </span>
                ) : null}
                {page && n.record_id ? (
                  <a
                    href={`/${locale}/portal/${page}/${n.record_id}`}
                    className={`${deskDim} underline`}
                  >
                    {t("openIt")}
                  </a>
                ) : null}
                {(() => {
                  const href = tellHref(n);
                  return href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => void told(n)}
                      className={`${deskDim} min-h-11 underline`}
                    >
                      {t("tellThem")}
                    </a>
                  ) : null;
                })()}
                <button
                  type="button"
                  disabled={busy === key(n)}
                  onClick={() => void hush(n)}
                  className={`${deskDim} min-h-11 underline disabled:opacity-60`}
                >
                  {t("snooze")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {said ? (
        <p
          role="alert"
          className="mt-3 [font-size:var(--text-sm)] text-[color:var(--color-clay-bright)]"
        >
          {said}
        </p>
      ) : null}
    </DeskCard>
  );
}

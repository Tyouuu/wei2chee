"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ringgit } from "@/lib/portal/live-rows";
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
};

export function NudgeList({
  projectId,
  locale,
  rows,
  isOwner,
  moduleOf,
}: {
  projectId: string;
  locale: string;
  rows: Nudge[];
  isOwner: boolean;
  /** 哪一张单在哪一页 —— 只有伺服器那一边知道他把它叫什么。 */
  moduleOf: Record<string, string>;
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

  /** 这一行第二句话 —— 每一种事自己讲自己的。 */
  function detail(n: Nudge): string {
    const bits: string[] = [];
    if (n.party) bits.push(n.party);
    if (n.title && n.title !== n.party) bits.push(n.title);
    if (n.qty_left != null)
      bits.push(
        t("leftOf", { n: Number(n.qty_left), m: Number(n.qty_floor ?? 0) }),
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
                {page && n.record_id ? (
                  <a
                    href={`/${locale}/portal/${page}/${n.record_id}`}
                    className={`${deskDim} underline`}
                  >
                    {t("openIt")}
                  </a>
                ) : null}
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

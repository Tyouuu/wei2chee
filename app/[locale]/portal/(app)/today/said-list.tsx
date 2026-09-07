"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { deskDim } from "../desk-kit";
import { KIND_LABEL } from "./nudge-list";

/**
 * 这个系统替他讲过的每一句话，跟「以后要不要自动讲」那两个开关。
 *
 * ── 他自己要的就是这两样 ──────────────────────────────────────────────────
 *
 * [任务 219](../../../../../docs/founder-tasks.md#219) 他 2026-09-06 拍板
 * **`現在就要對客戶開放就是兩個都開放`**，而落地清单里写着同一句：
 * **一个总开关 ＋ 一份「发过什么」**。
 * 那张表 20260906380000 建好了（[任务 222](#222)），而
 * `set_message_settings` 到今天为止**画面上一个入口都没有**
 * （[任务 252](#252) 那份清单上的一支）。
 *
 * ── 🔴 为什么它长在这一页上，而不是自己一页 ───────────────────────────────
 *
 * 老板 2026-09-06 讲**「现在太多东西了」**，而侧栏那一组一天多九行。
 * 规矩因此换成一句：**每接一扇门，先问「它属於哪一页」。**
 *
 * 「我们讲过什么」属於**这一页** —— 因为讲话就发生在这里：
 * 上面那一份讯号里的「发这一则」按下去，这一份就多一行
 * （[任务 265](#265)）。它是同一个回圈的另外半圈，不是第十七行。
 *
 * ── ⚠️ 一句都还没讲过的时候，这张卡照样画 ─────────────────────────────────
 *
 * 上面那张讯号卡空的时候整张不画，理由是「一张永远写着『现在没有要看的』的卡
 * 读起来是这一页没做完」。**这一张不一样，而差别是真的**：
 *
 *   ① 空的时候那句话是**一个答案**，不是缺席 ——
 *      「系统有没有偷偷替我跟客人讲话？」**没有，一句都没有。**
 *   ② 🔴 **开关要有一个家。** 只在有讯息的时候才画，
 *      等於他要先让系统讲过一次话，才关得掉它。
 *
 * ── 🔴 那两个开关今天真的挡得住东西，而我先前讲错了一次 ─────────────────────
 *
 * 我第一版在这里写「产品代码里零个地方读 `message_settings`，
 * 所以这两个框存下来的是一个还没有人读的偏好」。
 * **那一句是错的，而抓到它的是这一支尺**：跑到第 ④ 段，`queue_message`
 * 当场回一句 `he has turned off the messages that go to the customer`。
 *
 * 读它的不是 TypeScript，**是资料库自己**（20260906380000）：
 * `queue_message` 每一次都先问那一行，关着就拒绝。所以：
 *
 *   ✅ **关掉之后，系统就排不了要发给他们的讯息** —— 今天就成立，挡得住
 *   ⚠️ 而**他自己按 WhatsApp 发出去的照旧记在上面** ——
 *      那是 20260906380000 明写的判断：**开关挡的是「以后自动去发」，
 *      不是「记下他已经发过的」**。一个因为开关关着而拒绝记下事实的系统，
 *      是在丢掉事实
 *   ⚠️ 而**今天还没有任何东西会自己发出去**（要一个通过 Meta 商业验证的号码，
 *      卡在公司 —— [任务 11](#11) · [249](#249)）
 *
 * 底下那一句把这三件照实讲完。[重点 5b](../../../../../docs/founder-points.md)：
 * 一格做完要讲清楚它「还不是什么」，自己讲，不要等他发现。
 */

export type Said = {
  id: string;
  /** 讲给谁听：`owner` 是讲给他自己的，`customer` 是讲给他客人的 */
  audience: string;
  /** 哪一种事 —— 跟讯号那一支同一批词（`kind_*`） */
  kind: string;
  /** 🔴 **原话。** 一份不记得自己讲过什么的帐，答不了「我上个月跟他讲的是三千还是三千五」 */
  body: string;
  party: string | null;
  status: string;
  /** 「14:32」 —— 伺服器那一边照马来西亚时间排好的，不在浏览器里再算一次 */
  at: string;
  /** 「9月6日」 */
  on: string;
};

export function SaidList({
  projectId,
  rows,
  toOwner,
  toCustomer,
}: {
  projectId: string;
  rows: Said[];
  toOwner: boolean;
  toCustomer: boolean;
}) {
  const t = useTranslations("portal.today");
  /* ⚠️ `deskDim` 自己带着 `--text-sm`，而这几行要的是 `--text-xs` ——
     一个元素上两个字级，赢的是**样式表里后面那一条**，不是字串里后面那一个。
     这个仓库栽在同一件事上两次（`w-full` 赢过 `w-[110px]`），
     所以这几行只拿它的颜色。 */
  const dim = "text-[color:var(--color-on-canvas-dim)]";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* 按下去当场变 —— 一个按了三秒才动的勾，在他眼里是没反应。
     写不进去就把画面放回去（见下面）。 */
  const [own, setOwn] = useState(toOwner);
  const [cust, setCust] = useState(toCustomer);

  async function flip(which: "owner" | "customer", on: boolean) {
    if (busy) return;
    const before = which === "owner" ? own : cust;
    (which === "owner" ? setOwn : setCust)(on);
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(
        "set_message_settings",
        {
          in_project_id: projectId,
          /* ⚠️ **不给的那一个不动** —— 那一支的两个参数预设都是 null，
             而 null 的意思是「别碰」。两个都送，会让一次点击写掉两件事。 */
          in_to_owner: which === "owner" ? on : null,
          in_to_customer: which === "customer" ? on : null,
        },
      );
      if (err) {
        /* 🔴 写不进去就把那个勾放回去。一个**看起来成功而资料库里没变**
           的开关，比一个报错的糟得多：他会以为已经关掉了。 */
        (which === "owner" ? setOwn : setCust)(before);
        setError(err.message);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  /* 那一种事叫什么 —— **跟讯号那一份用同一张对照表**（`KIND_LABEL`），
     不在这里抄第二份：一件事在讯号上叫「报价快过期」，
     在讲过的帐上就不该叫别的名字。
     ⚠️ 认不得的那一种印它自己的名字，不印空白 ——
     一行少一个字，跟一行少一件事，在画面上分不出来。 */
  const kindWord = (kind: string) =>
    KIND_LABEL[kind] ? t(KIND_LABEL[kind]) : kind;

  return (
    <div data-said-list className="flex flex-col">
      {rows.length ? (
        <ul className="flex flex-col">
          {rows.map((m, i) => (
            <li
              key={m.id}
              /* 🔴 390 上那句话被挤成 150px 宽、折成四行 —— 时间那一列 80px
                 加右边那颗药丸，把主角挤到只剩一条缝（看图才看到的）。
                 窄的时候**那句话自己占一整行**：时间跟状态在上面一行，
                 它们两个都很短。宽的时候照参考那一套排回去（时间左 · 状态右）。 */
              className={`flex flex-wrap items-start gap-x-4 gap-y-1 py-3 ${i ? "border-t [border-color:var(--color-ink-800)]" : ""}`}
            >
              {/* 🔴 时间在左边自己一列，从参考那一套的 Class Schedule 拿的
                  （`.screenshots/upstream/up-academy.png`）：它的每一行是
                  **时间在左 · 那件事在中 · 状态在右**。
                  ⚠️ 而它的时间是「08:00 - 08:45」两截，我们只有一刻 ——
                  所以那一列是「几点」压着「哪一天」，宽度写死，
                  不然十几行的时间各自对不齐，读起来是十几件不相干的事。 */}
              <div className="w-20 shrink-0 whitespace-nowrap">
                {/* 🔴 `w-16` 折成了三行：`09:08` / `am` / `7 Sept`
                    —— 而一个折成三行的时间，把每一行撑成三行高，
                    十几行读起来是十几件不相干的事（看图才看到的）。 */}
                <p className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] tabular-nums">
                  {m.at}
                </p>
                <p className={`[font-size:var(--text-xs)] ${dim}`}>{m.on}</p>
              </div>
              {/* 🔴 **只在它不是「发出去了」的时候才画一颗药丸。**
                  参考那一页每一行都有一颗，而它那几行有三种状态；
                  我们二十行全部写着「已发」就是二十颗没有讲任何事的药丸。
                  跟[任务 230] 那一条同一句：**对得上的不列。** */}
              {m.status !== "sent" ? (
                <span
                  className={
                    "shrink-0 sm:order-last [border-radius:var(--radius-pill)] [border:var(--hairline)_solid_var(--color-ink-800)] px-2 py-0.5 [font-size:var(--text-xs)] [font-weight:var(--fw-medium)] " +
                    (m.status === "failed"
                      ? "[background-color:color-mix(in_oklab,var(--color-clay-bright)_14%,transparent)] text-[color:var(--color-clay-bright)]"
                      : `[background-color:var(--color-ink-900)] ${dim}`)
                  }
                >
                  {t(`said_${m.status}` as "said_failed")}
                </span>
              ) : null}
              <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                {/* 🔴 **原话是这一行的主角**，不是那一种事的名字。
                    他打开这一页要读的就是这一句（见 `Said.body`）。 */}
                <p className="[font-size:var(--text-sm)] break-words">
                  {m.body}
                </p>
                <p className={`mt-0.5 [font-size:var(--text-xs)] ${dim}`}>
                  {[
                    m.party ?? (m.audience === "owner" ? t("saidToYou") : null),
                    kindWord(m.kind),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        /* 🔴 这是一个**答案**，不是一句「现在没有东西」—— 见档头。 */
        <p className={`[font-size:var(--text-sm)] ${deskDim}`}>
          {t("saidNothing")}
        </p>
      )}

      <div className="mt-5 border-t pt-4 [border-color:var(--color-ink-800)]">
        <div className="flex flex-col gap-2">
          {(
            [
              ["owner", own, t("sayToMe")],
              ["customer", cust, t("sayToCustomers")],
            ] as const
          ).map(([which, on, label]) => (
            <label
              key={which}
              className="flex min-h-11 items-center gap-3 [font-size:var(--text-sm)]"
            >
              <input
                type="checkbox"
                checked={on}
                disabled={busy}
                onChange={(e) => void flip(which, e.target.checked)}
                className="h-4 w-4 shrink-0"
              />
              {label}
            </label>
          ))}
        </div>
        {/* 🔴 照实讲它今天还不是什么 —— 见档头。 */}
        <p className={`mt-2 [font-size:var(--text-xs)] ${dim}`}>
          {t("sayNotYet")}
        </p>
        {error ? (
          <p
            role="alert"
            className="mt-2 [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

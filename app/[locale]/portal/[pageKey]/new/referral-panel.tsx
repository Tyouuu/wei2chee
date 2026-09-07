"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecordFormCopy } from "../record-copy";

/**
 * 「这一单是谁介绍的。」
 *
 * ── 为什么它要有一格 ─────────────────────────────────────────────────────
 *
 * [任务 156]：装修在这个市场是百分之百靠口碑的，而那笔介绍费今天记在
 * 老板脑袋里 —— **谁介绍的 · 答应多少 · 给了没有**，三样都没有纪录，
 * 最后常常变成一场架。沙龙 · 车厂 · 冷气一模一样，而本地一家都没有。
 *
 * 20260905260000 把三支函式建好了，而 `set_record_referral`
 * **画面上一个入口都没有** —— 这一段就是那个入口。
 *
 * ── 🔴 它不会替他记一笔 ──────────────────────────────────────────────────
 *
 * [任务 156] 的原话：算出来 RM 300 就写 RM 300。
 * **替他记一笔他还没讲过要给的钱，是在他的帐上凭空多一笔支出**，
 * 而他要到对帐的时候才会发现。真的给了那天，他去开销那一页记一笔 ——
 * 走的是他手打一笔开销**同一支函式**（[重点 23] AI 平权）。
 *
 * ── 🔴 「欠他多少」是资料库算的，不是这一页算的 ──────────────────────────
 *
 * `referred_jobs` 回的 `promised_cents` 就是那个数字，而它跟
 * `referrals_owing` 用同一段 SQL。**这一页不重算** ——
 * 同一个问题两个答案，这个仓库栽过至少八次。
 *
 * ── ⚠️ 比例算在「收到的钱」上 ────────────────────────────────────────────
 *
 * 不是单上那个总数。这句话一定要印出来：一个看到「3%」的老板，
 * 会以为是一张 RM 48,500 的单的 3%，而客人可能只付了订金。
 *
 * ── 只给看得到钱的人 ─────────────────────────────────────────────────────
 *
 * 一笔答应给出去的钱是钱。20260905280000 把守卫从 `works_here`
 * 改回 `sees_money` 的时候，`check:referrals` 当场红了一条
 * 「师傅算不出老板给了谁多少介绍费」—— 所以这一段整段只在老板那一边画，
 * 而**不画的判断在伺服器那一边**（读不到就 `null`，`null` 就不画）。
 */

export type ReferralOption = { id: string; name: string };

export function ReferralPanel({
  recordId,
  referrerId,
  referrerName,
  portion,
  amountCents,
  promised,
  people,
  copy,
}: {
  recordId: string;
  /** 现在挂着谁。`null` = 没有人介绍。 */
  referrerId: string | null;
  referrerName: string | null;
  /** 抽几 %。跟 `amountCents` 只会有一个（资料库那一条 check 挡着）。 */
  portion: number | null;
  amountCents: number | null;
  /** 🔴 资料库算的「照到今天收到的钱，这一单欠他多少」。已经排版好。 */
  promised: string | null;
  /** 挑得到的人：客户 · 供应商 · 师傅三种都可以 —— 谁介绍谁是他的生意。 */
  people: ReferralOption[];
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [who, setWho] = useState(referrerName ?? "");
  const [kind, setKind] = useState<"portion" | "amount">(
    amountCents != null ? "amount" : "portion",
  );
  const [pct, setPct] = useState(portion == null ? "" : String(portion));
  const [flat, setFlat] = useState(
    amountCents == null ? "" : (amountCents / 100).toFixed(2),
  );

  const dim =
    "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";

  async function save() {
    setError(null);
    const typed = who.trim();
    /* 🔴 只在完全对上一个人的时候才送 id。名字对不上就不猜 ——
       [任务 89] 量过：靠名字认人会把钱记到另一个人头上，而这里那个
       「另一个人」就是收介绍费的人。 */
    const hit = people.find((p) => p.name === typed);
    if (!hit) {
      setError(copy.refUnknown.replace("{name}", typed));
      return;
    }
    const pctN = pct.trim() === "" ? null : Number(pct);
    const flatN = flat.trim() === "" ? null : Math.round(Number(flat) * 100);
    setBusy(true);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(
        "set_record_referral",
        {
          in_record_id: recordId,
          in_referrer_id: hit.id,
          in_portion: kind === "portion" ? pctN : null,
          in_amount_cents: kind === "amount" ? flatN : null,
        },
      );
      if (err) {
        setError(err.message);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setError(null);
    setBusy(true);
    try {
      /* 三栏一起走 —— 留一个没有人的比例，是一笔没有收款人的钱。 */
      const { error: err } = await createBrowserSupabaseClient().rpc(
        "set_record_referral",
        {
          in_record_id: recordId,
          in_referrer_id: null,
        },
      );
      if (err) {
        setError(err.message);
        return;
      }
      setWho("");
      setPct("");
      setFlat("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  /* 🔴 `ds-control` —— 不要第二份手写的框。这一段旁边就是抽成、送货、
     地址那几段，四段各自手写一次边框跟内距，就是他讲的「像两个人做的」，
     而 `form-section.tsx` 的档头记着同一件事发生过九次。 */
  /* 🔴 宽度**不在这里面**。第一版把 `w-full` 写进来，然后在那个数字框上
     加 `w-[110px]` —— 两条都是 Tailwind 的宽度，赢的是**档案里后面那一条**，
     不是字串里后面那一个。画出来那个框铺满整行、`%` 掉到第三行去，
     而读数一片绿。同一个形状这个仓库栽过（一条 CSS 规则输给下面同名同重量的另一条）。 */
  const field =
    "ds-control h-10 min-w-0 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]";
  const tab = (on: boolean) =>
    "inline-flex h-10 items-center [border-radius:var(--radius-md)] border px-3 [font-size:var(--text-sm)] " +
    (on
      ? "[border-color:var(--color-primary)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]"
      : "[border-color:var(--color-ink-800)] text-[color:var(--color-on-canvas-dim)]");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.refHeading}
        </h2>
        {/* 🔴 `max-w-[62ch]`：这一段的宽度是 1080px（走单那几页比别页宽，
            因为右边还有一张印出来的纸），而这一句 160 个字排成一行 ——
            看图才看到的：一行长到眼睛跳回行首会跳错行。
            旁边几段的说明都很短，所以从来没有撞到过。 */}
        <p className={`mt-1 max-w-[62ch] ${dim}`}>{copy.refLede}</p>
      </div>

      <label className="flex max-w-[420px] flex-col gap-1.5">
        <span className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
          {copy.refWho}
        </span>
        {/* ⚠️ `datalist` 不是下拉：他打得进一个还没建档的名字，
            而送出去之前那一步会挡下来并且讲出是哪一个名字对不上。
            一个只能选的框，在他名册还没建好的第一个月是打不下去的。 */}
        <input
          className={`${field} w-full`}
          list="referral-people"
          value={who}
          disabled={busy}
          placeholder={copy.refWhoBlank}
          onChange={(e) => setWho(e.target.value)}
        />
        <datalist id="referral-people">
          {people.map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
      </label>

      {/* 🔴 一个标题管整排，不是两颗按钮配一个自己带标题的框。
          第一版是 `items-end` 的一行，於是「Per cent」那个标签**浮在两颗
          按钮的上方**，读起来像是那两颗按钮的标题 —— 看图才看到的。
          比例还是数目，跟填几，是同一个决定的两半。 */}
      <div className="flex flex-col gap-1.5">
        <span className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
          {copy.refAmount}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={tab(kind === "portion")}
            aria-pressed={kind === "portion"}
            onClick={() => setKind("portion")}
          >
            {copy.refKindPortion}
          </button>
          <button
            type="button"
            className={tab(kind === "amount")}
            aria-pressed={kind === "amount"}
            onClick={() => setKind("amount")}
          >
            {copy.refKindAmount}
          </button>
          {/* 单位讲出来 —— 一个空框旁边只写着「答应给多少」，
              他答不出该打 3 还是 300。
              ⚠️ 而 RM 在前、% 在后：这个市场写的是「RM 300」跟「3%」，
              两个都摆同一边，其中一个一定读起来是错的。 */}
          {kind === "amount" ? <span className={dim}>RM</span> : null}
          <input
            className={`${field} w-[110px]`}
            inputMode="decimal"
            disabled={busy}
            aria-label={kind === "portion" ? copy.refPortion : copy.refAmount}
            value={kind === "portion" ? pct : flat}
            onChange={(e) =>
              kind === "portion"
                ? setPct(e.target.value)
                : setFlat(e.target.value)
            }
          />
          {kind === "portion" ? <span className={dim}>%</span> : null}
        </div>
      </div>

      {/* 🔴 资料库算的那个数字。没有介绍人就没有这一句 —— 一个 RM 0
          印在一张没有人介绍的单上，读起来像「他一分都不拿」。 */}
      {referrerId && promised ? (
        <p className={dim}>{copy.refSoFar.replace("{amount}", promised)}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="inline-flex h-10 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] disabled:opacity-60"
        >
          {busy ? copy.saving : copy.refSave}
        </button>
        {referrerId ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void clear()}
            className="inline-flex h-10 items-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)] disabled:opacity-60"
          >
            {copy.refClear}
          </button>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

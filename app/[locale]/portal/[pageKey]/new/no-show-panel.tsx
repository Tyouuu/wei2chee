"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecordFormCopy } from "../record-copy";
import { ringgitOf } from "./line-editor";

/**
 * 她放过几次飞机，这一单要不要订金。
 *
 * ── 为什么这一格值得存在（[任务 333/354]）─────────────────────────────────
 *
 * `deposit_advice` · `set_appointment_deposit` · `set_booking_rules` 从
 * 20260909320000 就在跑，而到今天为止一个呼叫端都没有——柜台想知道
 * 「这个客人靠不靠得住」，今天只能靠记忆或者翻回去数。
 *
 * ── 🔴 两半，两条守卫 ───────────────────────────────────────────────────
 *
 * 「放过几次」跟「这一单要不要订金」是 `works_here`——柜台自己按得到，
 * 因为叫客人先付订金的常常就是她自己。「这门生意的规矩」（放几次之后
 * 才要收、收多少）是 `sees_money`——那是老板的决定，不是柜台的。
 * `onHand`（她手上还有多少订金）是钱，只有看得到钱的人才有数字，
 * 见 `info.onHandCents === null` 那一句判断——不是另外去问一次角色，
 * 那支函式自己已经把看不到钱的人的钱那两栏改成 null 了。
 *
 * ── 🔴 规矩没填，就不建议 ──────────────────────────────────────────────
 *
 * `ruleAfter === null` 的时候 `advise` 永远是 false（[重点 33]：不知道的
 * 东西不要编）。这一格顺手把「规矩没填」变成一个填得进去的表单，
 * 而不是一句「请去设定页填」——她正站在一张真的预约前面想这件事，
 * 那正是填这两个数字最自然的时刻。
 */
export function NoShowPanel({
  recordId,
  projectId,
  info,
  copy,
}: {
  /** 这一张预约的 id —— `set_appointment_deposit` 只认它。 */
  recordId: string;
  /** `set_booking_rules` 认的是整门生意，不是这一张单。 */
  projectId: string;
  info: {
    missed: number;
    came: number;
    lastMissedOn: string | null;
    ruleAfter: number | null;
    advise: boolean;
    /** null = 看不到钱的人。 */
    suggestCents: number | null;
    onHandCents: number | null;
    depositCents: number | null;
  };
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [depositInput, setDepositInput] = useState(
    info.depositCents != null
      ? String(info.depositCents / 100)
      : info.advise && info.suggestCents != null
        ? String(info.suggestCents / 100)
        : "",
  );
  const [afterInput, setAfterInput] = useState(
    info.ruleAfter != null ? String(info.ruleAfter) : "",
  );
  const [amountInput, setAmountInput] = useState(
    info.suggestCents != null ? String(info.suggestCents / 100) : "",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* 规矩没填的时候直接摊开（她正站在这一张单前面，是填这两个数字最自然
     的时刻）；已经填过的收起来只留一句摘要——老板要求的设计总检：
     一条老板一年才改一两次的规矩，摊开着占的分量跟每天都要看的信息
     一样重，读起来就是「杂乱」的一部分。 */
  const [policyOpen, setPolicyOpen] = useState(info.ruleAfter == null);

  async function call(
    name: string,
    args: Record<string, unknown>,
    tag: string,
  ) {
    setError(null);
    setBusy(tag);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(
        name,
        args,
      );
      if (err) {
        setError(err.message || copy.noShowFailed);
        return;
      }
      if (tag === "policy") setPolicyOpen(false);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const dim =
    "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";
  const control =
    "ds-control h-10 w-32 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none";
  const ghost =
    "inline-flex h-10 items-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)] disabled:opacity-60";
  const solid =
    "inline-flex h-10 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] disabled:opacity-60";

  const seesMoney = info.onHandCents !== null;
  const total = info.missed + info.came;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.noShowHeading}
        </h2>
        {total > 0 && info.missed > 0 && (
          <p
            className={
              info.advise
                ? "mt-1 [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
                : `mt-1 ${dim}`
            }
          >
            {copy.noShowMissed
              .replace("{missed}", String(info.missed))
              .replace("{came}", String(total))}
          </p>
        )}
        {info.advise && (
          <p className="mt-1 [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]">
            {copy.noShowAdvise}
            {seesMoney && info.suggestCents != null
              ? ` — ${copy.noShowSuggested.replace("{amount}", ringgitOf(info.suggestCents))}`
              : ""}
          </p>
        )}
        {seesMoney && (info.onHandCents ?? 0) > 0 && (
          <p className={`mt-1 ${dim}`}>
            {copy.noShowOnHand.replace(
              "{amount}",
              ringgitOf(info.onHandCents as number),
            )}
          </p>
        )}
      </div>

      {/* 这一单要不要订金 —— 柜台按得到。 */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={dim}>{copy.noShowDepositLabel}</span>
          <div className="flex items-center gap-2">
            <span className={dim}>RM</span>
            <input
              type="number"
              min="0"
              step="1"
              value={depositInput}
              onChange={(e) => setDepositInput(e.target.value)}
              className={control}
            />
          </div>
        </label>
        <button
          type="button"
          disabled={busy !== null || depositInput.trim() === ""}
          onClick={() =>
            void call(
              "set_appointment_deposit",
              {
                in_id: recordId,
                in_amount_cents: Math.round(Number(depositInput) * 100),
              },
              "deposit",
            )
          }
          className={solid}
        >
          {busy === "deposit" ? copy.saving : copy.noShowDepositSave}
        </button>
        {info.depositCents != null && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              setDepositInput("");
              void call(
                "set_appointment_deposit",
                { in_id: recordId, in_amount_cents: null },
                "clear",
              );
            }}
            className={`min-h-10 underline ${dim}`}
          >
            {copy.noShowDepositClear}
          </button>
        )}
      </div>

      {/* 这门生意的规矩 —— 只有老板。规矩已经填过就收起来只留一句摘要。 */}
      {seesMoney && !policyOpen && (
        <div className="flex flex-wrap items-center gap-3 border-t pt-4 [border-color:var(--color-ink-800)]">
          <p className={dim}>
            {copy.noShowPolicySummary
              .replace("{after}", String(info.ruleAfter))
              .replace("{amount}", ringgitOf(info.suggestCents ?? 0))}
          </p>
          <button
            type="button"
            onClick={() => setPolicyOpen(true)}
            className={`min-h-10 underline ${dim}`}
          >
            {copy.noShowPolicyEdit}
          </button>
        </div>
      )}
      {seesMoney && policyOpen && (
        <div className="flex flex-col gap-3 border-t pt-4 [border-color:var(--color-ink-800)]">
          <div>
            <h3 className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
              {copy.noShowPolicyHeading}
            </h3>
            <p className={`mt-1 ${dim}`}>{copy.noShowPolicyLede}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className={dim}>{copy.noShowPolicyAfter}</span>
              <input
                type="number"
                min="1"
                max="20"
                step="1"
                value={afterInput}
                onChange={(e) => setAfterInput(e.target.value)}
                className={control}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={dim}>{copy.noShowPolicyAmount}</span>
              <div className="flex items-center gap-2">
                <span className={dim}>RM</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className={control}
                />
              </div>
            </label>
            <button
              type="button"
              disabled={
                busy !== null ||
                afterInput.trim() === "" ||
                amountInput.trim() === ""
              }
              onClick={() =>
                void call(
                  "set_booking_rules",
                  {
                    in_project_id: projectId,
                    in_no_show_deposit_after: Math.round(Number(afterInput)),
                    in_default_deposit_cents: Math.round(
                      Number(amountInput) * 100,
                    ),
                  },
                  "policy",
                )
              }
              className={ghost}
            >
              {busy === "policy" ? copy.saving : copy.noShowPolicySave}
            </button>
            {info.ruleAfter != null && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => setPolicyOpen(false)}
                className={`min-h-10 underline ${dim}`}
              >
                {copy.cancel}
              </button>
            )}
          </div>
        </div>
      )}

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

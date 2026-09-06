"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecordFormCopy } from "../record-copy";

/**
 * 货退回来了几件，退了多少钱。
 *
 * ── 为什么它在这里 ────────────────────────────────────────────────────────
 *
 * `record_return` · `returns_of` · `drop_return` 三支从 20260905840000 起就在，
 * 而**画面上一个入口都没有** —— [任务 208](../../../../../docs/founder-tasks.md#208)
 * 跟 [210](../../../../../docs/founder-tasks.md#210) 两条的收尾都写着同一句
 * 「画面上没有那一段」。一间五金店 · 一家批发商 · 一家零售店每天在做这件事，
 * 而在这一扇门之前，他退一车货，系统里什么都没有发生。
 *
 * ── 🔴 一个方向，两句不一样的话 ───────────────────────────────────────────
 *
 * 卖的那三种（订单 · 工程）：货**回到架上**，他欠我的少多少。
 * 买的那一种（进货单）：货**送回给供应商**，我欠他的少多少。
 * ⚠️ 而方向是**那张单自己算出来的**（`record_return` 里面），不是一个参数 ——
 * 呼叫端挑错一次，架上的数字就反了，而**那是没有人用眼睛看得出来的**
 * （装修师傅不知道自己应该有几包）。所以这里一个方向都不送。
 *
 * ── 🔴 它讲得出发生了什么，不是回一句「好了」 ─────────────────────────────
 *
 * 那一支回四个数：几行真的动了架上 · 几行退得比出去过的多 · 几行找不到那件货 ·
 * 几行没有数量（一口价那种）。**四个都要印出来** ——
 * 一个静静少算两行的退货，是他下个月盘点才会发现的错。
 *
 * ── 报价单不画这一段 ──────────────────────────────────────────────────────
 *
 * 资料库那边 `is_returnable_module` 收报价单，而一张报价单**还没有人答应**，
 * 货一件都没有出去过，所以退货那一半永远会回 `not_out`。
 * ⚠️ 只剩「退钱」那一半 —— 而一笔从来没有收过的钱退不了。
 * 那不是少一个功能，是**不画一颗按下去一定失败的按钮**。
 */

export type ReturnLine = {
  description: string | null;
  qty: number | null;
  unit: string | null;
};
export type PastReturn = {
  id: string;
  returnedOn: string | null;
  reason: string | null;
  creditCents: number | null;
  note: string | null;
  lines: ReturnLine[];
};
/** 那张单上的一行，可以退的那几行。 */
export type Returnable = {
  id: string;
  description: string | null;
  qty: number | null;
  unit: string | null;
};

type Outcome = {
  back: number;
  notOut: number;
  unknown: number;
  skipped: number;
};

export function ReturnsPanel({
  recordId,
  lines,
  past,
  buying,
  copy,
}: {
  recordId: string;
  /** 那张单上的行。⚠️ 没有行的单（一口价）照样退得了钱。 */
  lines: readonly Returnable[];
  past: readonly PastReturn[];
  /** 进货单 —— 只换那两句话，方向照旧由资料库算。 */
  buying: boolean;
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [credit, setCredit] = useState("");
  const [reason, setReason] = useState("");
  const [on, setOn] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<Outcome | null>(null);
  const [open, setOpen] = useState(false);

  const num = (s: string) => {
    const n = Number((s ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && (s ?? "").trim() !== "" && n > 0 ? n : null;
  };

  async function take() {
    setError(null);
    setSaid(null);
    const picked = lines
      .map((l) => ({ line_id: l.id, qty: num(qty[l.id] ?? "") }))
      .filter((x) => x.qty !== null);
    const money = num(credit);
    /* 🔴 什么都没填就不要打那一支 —— 一次「记了一笔什么都没有的退货」
       比一句拒绝糟：那一行会永远留在这张单的历史上。 */
    if (!picked.length && money === null) {
      setError(copy.returnNothing);
      return;
    }
    setBusy("take");
    try {
      const { data, error: err } = await createBrowserSupabaseClient().rpc(
        "record_return",
        {
          in_record_id: recordId,
          in_lines: picked.length ? picked : null,
          in_credit_cents: money === null ? 0 : Math.round(money * 100),
          in_reason: reason.trim(),
          in_returned_on: on || null,
          /* 按两下只记一次 —— 柜台就是会按两下的地方。 */
          in_idempotency_key: crypto.randomUUID(),
        },
      );
      if (err) {
        setError(err.message);
        return;
      }
      const row = (Array.isArray(data) ? data[0] : data) as {
        back?: number;
        not_out?: number;
        unknown?: number;
        skipped?: number;
      } | null;
      setSaid({
        back: Number(row?.back ?? 0),
        notOut: Number(row?.not_out ?? 0),
        unknown: Number(row?.unknown ?? 0),
        skipped: Number(row?.skipped ?? 0),
      });
      setQty({});
      setCredit("");
      setReason("");
      setOn("");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function undo(id: string) {
    setError(null);
    setSaid(null);
    setBusy(id);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(
        "drop_return",
        { in_id: id },
      );
      if (err) {
        setError(err.message);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const dim =
    "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";
  const control =
    "ds-control h-10 w-full min-w-0 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none";
  const ghost =
    "inline-flex h-10 items-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)] disabled:opacity-60";
  const solid =
    "inline-flex h-10 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] disabled:opacity-60";

  const money = (cents: number | null) =>
    cents == null ? "" : `RM ${(Number(cents) / 100).toFixed(2)}`;

  return (
    <div data-returns-panel className="flex flex-col gap-4">
      <div>
        <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.returnsHeading}
        </h2>
        <p className={`mt-1 ${dim}`}>
          {buying ? copy.returnsLedeBuy : copy.returnsLede}
        </p>
      </div>

      {/* 退过的那几次。⚠️ 一次都没有的时候讲一句，不要画一张空清单。 */}
      {past.length ? (
        <ul className="flex flex-col gap-4">
          {past.map((r) => (
            <li key={r.id} className="flex flex-col gap-1">
              <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas)]">
                {r.returnedOn ?? ""}
                {r.lines.length
                  ? ` · ${r.lines
                      .map((l) =>
                        `${l.description ?? ""}${
                          l.qty == null
                            ? ""
                            : ` ${l.qty}${l.unit ? ` ${l.unit}` : ""}`
                        }`.trim(),
                      )
                      .join(" · ")}`
                  : ""}
                {r.creditCents ? ` · ${money(r.creditCents)}` : ""}
              </p>
              {r.reason?.trim() ? <p className={dim}>{r.reason}</p> : null}
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => undo(r.id)}
                className={`self-start ${dim} underline`}
              >
                {copy.returnUndo}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={dim}>{copy.returnsNone}</p>
      )}

      {/* 🔴 它讲得出刚刚发生了什么 —— 见档头。 */}
      {said ? (
        <p aria-live="polite" className={dim}>
          {[
            said.back
              ? (buying ? copy.returnSentBack : copy.returnBack).replace(
                  "{n}",
                  String(said.back),
                )
              : "",
            said.notOut
              ? copy.returnNotOut.replace("{n}", String(said.notOut))
              : "",
            said.unknown
              ? copy.returnUnknown.replace("{n}", String(said.unknown))
              : "",
            said.skipped
              ? copy.returnSkipped.replace("{n}", String(said.skipped))
              : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}

      {open ? (
        <div className="flex flex-col gap-3">
          {/* 那张单上的行，一行一个数量。⚠️ 留空 = 这一行不退，
              **不是退 0** —— 一个退 0 的行会在他的历史上留下一笔没发生的事。 */}
          {lines.length ? (
            <ul className="flex flex-col gap-2">
              {lines.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center gap-2 sm:flex-nowrap"
                >
                  <span className="min-w-0 flex-1 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)]">
                    {l.description ?? ""}
                    {l.qty == null ? "" : ` · ${l.qty}${l.unit ? ` ${l.unit}` : ""}`}
                  </span>
                  <input
                    inputMode="decimal"
                    aria-label={`${copy.returnQty} — ${l.description ?? ""}`}
                    value={qty[l.id] ?? ""}
                    onChange={(e) =>
                      setQty((v) => ({ ...v, [l.id]: e.target.value }))
                    }
                    className={`${control} max-w-28`}
                  />
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-40 flex-1 flex-col gap-1.5">
              <span className={dim}>{copy.returnCredit}</span>
              <input
                inputMode="decimal"
                value={credit}
                onChange={(e) => setCredit(e.target.value)}
                className={control}
              />
            </label>
            <label className="flex min-w-40 flex-1 flex-col gap-1.5">
              <span className={dim}>{copy.returnOn}</span>
              <input
                type="date"
                value={on}
                onChange={(e) => setOn(e.target.value)}
                className={control}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={dim}>{copy.returnReason}</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={control}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={take}
              className={solid}
            >
              {busy === "take" ? copy.returnBusy : copy.returnDo}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setOpen(false)}
              className={ghost}
            >
              {copy.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`self-start ${ghost}`}
        >
          {copy.returnStart}
        </button>
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

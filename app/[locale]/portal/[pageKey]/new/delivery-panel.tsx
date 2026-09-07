"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecordFormCopy } from "../record-copy";

/**
 * 送出去了几趟，还欠多少，谁签的。
 *
 * ── 为什么它在这里 ────────────────────────────────────────────────────────
 *
 * 那五支函式 20260905500000 就做好了，而画面上一个入口都没有 ——
 * 🔴 而它比别的更糟一点：客人那一页（`/r/<号码>`）**已经画得出签收那一颗**，
 * 而老板开不了一趟货，所以那颗按钮实际上永远不会出现。
 * **半条线跟没有线是同一件事。**
 *
 * ── 🔴 一趟货，不是第三份单据 ─────────────────────────────────────────────
 *
 * 订单本身就是送货单，缺的只是「一趟」。所以这里不问他重打一次要送什么，
 * 只问：**几时送 · 谁去送 · 谁收的**，货照那张单上还没送的那几行走。
 *
 * ── 两栏，不是一栏配一个勾 ────────────────────────────────────────────────
 *
 * 「谁收的」是**老板在门口自己打的**（我们这一边的说法）；
 * 「签收」是**客人自己在他手机上按下去的**（`/r/<号码>` 那一页）。
 * 在争执的时候那两样不是同一个重量，所以它们分开画。
 */

export type DeliveryLine = {
  description: string | null;
  qty: number | null;
  unit: string | null;
};
export type DeliveryRun = {
  id: string;
  runOn: string | null;
  driver: string | null;
  receivedBy: string | null;
  signedAt: string | null;
  signedName: string | null;
  note: string | null;
  lines: DeliveryLine[];
};
export type Shortfall = {
  description: string | null;
  unit: string | null;
  ordered: number;
  gone: number;
  still: number;
};

export function DeliveryPanel({
  recordId,
  runs,
  shortfall,
  copy,
}: {
  recordId: string;
  runs: readonly DeliveryRun[];
  /** 还欠哪几行。⚠️ 一口价那几行不在里面 —— 架上没有东西要动。 */
  shortfall: readonly Shortfall[];
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [driver, setDriver] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function run(withGoods: boolean) {
    setError(null);
    setBusy("run");
    try {
      const db = createBrowserSupabaseClient();
      /* 🔴 有货要送就走 `deliver_record`（它会把架上的数字扣掉）；
         一趟一件货都没有的（装修交屋 · 服务做完）走 `open_delivery_run`。
         **两条不是同一件事**：前者动库存，后者只记一趟。 */
      const { error: err } = withGoods
        ? await db.rpc("deliver_record", {
            in_record_id: recordId,
            in_lines: null,
            in_driver: driver || null,
            in_received_by: receivedBy || null,
          })
        : await db.rpc("open_delivery_run", {
            in_record_id: recordId,
            in_driver: driver || null,
            in_received_by: receivedBy || null,
          });
      if (err) {
        setError(err.message);
        return;
      }
      setDriver("");
      setReceivedBy("");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function takeBack(id: string) {
    setError(null);
    setBusy(id);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(
        "archive_delivery",
        {
          in_delivery_id: id,
        },
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

  const owing = shortfall.filter((s) => Number(s.still) > 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.runHeading}
        </h2>
        <p className={`mt-1 ${dim}`}>{copy.runLede}</p>
      </div>

      {/* 还欠哪几行。⚠️ 一件都不欠就不画这一段 ——
          一段永远说同一句话的段落，读起来是没做完。 */}
      {owing.length ? (
        <div>
          <h3 className={`[font-weight:var(--fw-semibold)] ${dim}`}>
            {copy.runStillOwed}
          </h3>
          <ul className="mt-1 flex flex-col gap-1">
            {owing.map((s, i) => (
              <li key={i} className={dim}>
                {s.description} · {String(s.still)}
                {s.unit ? ` ${s.unit}` : ""} ({String(s.gone)}/
                {String(s.ordered)})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 送过的那几趟。 */}
      {runs.length ? (
        <ul className="flex flex-col gap-4">
          {runs.map((r) => (
            <li key={r.id} className="flex flex-col gap-1">
              <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas)]">
                {r.runOn ?? ""}
                {r.lines.length
                  ? ` · ${r.lines
                      .map((l) =>
                        `${l.description ?? ""}${l.qty == null ? "" : ` ${l.qty}${l.unit ? ` ${l.unit}` : ""}`}`.trim(),
                      )
                      .join(" · ")}`
                  : ` · ${copy.runNoGoods}`}
              </p>
              <p className={dim}>
                {r.driver ? `${copy.runDriver}: ${r.driver}` : ""}
                {r.driver && r.receivedBy ? " · " : ""}
                {r.receivedBy ? `${copy.runReceivedBy}: ${r.receivedBy}` : ""}
              </p>
              {/* 🔴 他自己签的那一行，跟我们打的那一行分开画 ——
                  在争执的时候那两样不是同一个重量。 */}
              {r.signedAt ? (
                <p className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
                  {copy.runSigned
                    .replace("{name}", r.signedName ?? "")
                    .replace("{date}", r.signedAt.slice(0, 10))}
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className={dim}>{copy.runNotSigned}</span>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void takeBack(r.id)}
                    className={`min-h-10 underline ${dim}`}
                  >
                    {busy === r.id ? copy.saving : copy.runTakeBack}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={dim}>{copy.runNone}</p>
      )}

      {/* 开一趟。⚠️ 收起来的那一趟**货不会自己回到架上** ——
          那句话写在下面，因为它是他按之前要知道的事。 */}
      {open ? (
        <div className="flex flex-col gap-3 border-t pt-4 [border-color:var(--color-ink-800)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className={dim}>{copy.runDriver}</span>
              <input
                value={driver}
                onChange={(e) => setDriver(e.target.value)}
                className={control}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={dim}>{copy.runReceivedBy}</span>
              <input
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                className={control}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* 有东西还没送 -> 送货；一件都不欠 -> 那是交屋 / 做完了。 */}
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run(owing.length > 0)}
              className={solid}
            >
              {busy === "run"
                ? copy.saving
                : owing.length > 0
                  ? copy.runSend
                  : copy.runHandover}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`min-h-10 underline ${dim}`}
            >
              {copy.cancel}
            </button>
          </div>
          <p className={dim}>
            {owing.length > 0 ? copy.runSendHint : copy.runHandoverHint}
          </p>
        </div>
      ) : (
        <div>
          <button type="button" onClick={() => setOpen(true)} className={ghost}>
            {copy.runOpen}
          </button>
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

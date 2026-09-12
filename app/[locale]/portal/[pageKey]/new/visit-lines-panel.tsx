"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecordFormCopy } from "../record-copy";
import { ringgitOf } from "./line-editor";

/**
 * 沙龙那一本日记簿——做什么 · 谁做 · 多少钱 · 小费，同一张纸上四栏
 * （[任务 341] 沙龙其余那一组 · [重点 34]：手写簿写不写得下这一格）。
 *
 * ── 为什么这一段今天才接（[任务 402]）─────────────────────────────────────
 *
 * `add_visit_line` · `set_visit_tip`（20260910010000 · 20260911190000）
 * 从做出来那天起零个 UI 呼叫端——助手打得到 `add_visit_line`（[任务 372]
 * 附近那一批），而画面上从来没有一个入口。
 *
 * ── 🔴 小费不是钱，跟她自己付的价钱分开画 ─────────────────────────────────
 *
 * `tip_cents` 直接给做事的那个人，从来不进 `ledger_entries`——跟储值卡
 * 送的那 200 同一条纪律。这里故意把它放在同一行的最后一栏，不是另开
 * 一个总额，免得柜台以为它跟营业额有关。
 *
 * ── 谁做的只认真的人 ──────────────────────────────────────────────────────
 *
 * 下拉只列这家自己的师傅（`visitStaffOptions`），不给自由文字——
 * [任务 89] 那条界线：省他的字，不可以拿「猜」来省。
 */
export function VisitLinesPanel({
  appointmentId,
  lines,
  staffOptions,
  copy,
}: {
  appointmentId: string;
  lines: { id: string; service: string; staffName: string; priceCents: number | null; tipCents: number | null }[];
  staffOptions: { id: string; name: string }[];
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [service, setService] = useState("");
  const [staffId, setStaffId] = useState("");
  const [price, setPrice] = useState("");
  const [tipDrafts, setTipDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addLine() {
    if (busy || !service.trim()) return;
    setError(null);
    setBusy("add");
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc("add_visit_line", {
        in_appointment_id: appointmentId,
        in_service: service,
        in_staff_id: staffId || null,
        in_price_cents: price.trim() === "" ? null : Math.round(Number(price) * 100),
      });
      if (err) {
        setError(err.message);
        return;
      }
      setService("");
      setStaffId("");
      setPrice("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function saveTip(lineId: string) {
    const draft = tipDrafts[lineId];
    if (draft === undefined || draft.trim() === "" || busy) return;
    setError(null);
    setBusy(lineId);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc("set_visit_tip", {
        in_line_id: lineId,
        in_tip_cents: Math.round(Number(draft) * 100),
      });
      if (err) {
        setError(err.message);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const dim = "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";
  const control =
    "ds-control h-10 w-24 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none";
  const controlWide =
    "ds-control h-10 w-full min-w-0 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none";
  const ghost =
    "inline-flex h-10 items-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)] disabled:opacity-60";

  return (
    <div className="flex flex-col gap-4">
      <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
        {copy.visitLinesHeading}
      </h2>

      {lines.length ? (
        <ul className="flex flex-col gap-3">
          {lines.map((l) => (
            <li key={l.id} className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas)]">
                  {l.service}
                </div>
                <div className={dim}>
                  {l.staffName || copy.visitLinesStaffNone}
                  {" · "}
                  {l.priceCents != null ? ringgitOf(l.priceCents) : copy.visitLinesPriceNone}
                </div>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex flex-col gap-1">
                  <span className={dim}>{copy.visitLinesTip}</span>
                  <div className="flex items-center gap-2">
                    <span className={dim}>RM</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={tipDrafts[l.id] ?? (l.tipCents != null ? String(l.tipCents / 100) : "")}
                      onChange={(e) =>
                        setTipDrafts((prev) => ({ ...prev, [l.id]: e.target.value }))
                      }
                      className={control}
                    />
                  </div>
                </label>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void saveTip(l.id)}
                  className={ghost}
                >
                  {busy === l.id ? copy.saving : copy.visitLinesTipSave}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={dim}>{copy.visitLinesNone}</p>
      )}

      <div className="flex flex-wrap items-end gap-3 border-t pt-4 [border-color:var(--color-ink-800)]">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <span className={dim}>{copy.visitLinesAddService}</span>
          <input
            type="text"
            value={service}
            onChange={(e) => setService(e.target.value)}
            className={controlWide}
          />
        </label>
        {staffOptions.length ? (
          <label className="flex flex-col gap-1">
            <span className={dim}>{copy.visitLinesAddStaff}</span>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="ds-control h-10 min-w-[9rem] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none"
            >
              <option value="">{copy.visitLinesStaffNone}</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1">
          <span className={dim}>{copy.visitLinesAddPrice}</span>
          <div className="flex items-center gap-2">
            <span className={dim}>RM</span>
            <input
              type="number"
              min="0"
              step="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={control}
            />
          </div>
        </label>
        <button
          type="button"
          disabled={busy !== null || !service.trim()}
          onClick={() => void addLine()}
          className={ghost}
        >
          {busy === "add" ? copy.saving : copy.visitLinesAddSave}
        </button>
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DeskCard, deskBtn, deskDim, deskField } from "../desk-kit";

/**
 * 搬一次货，跟搬过的那几次。
 *
 * ── 🔴 同一间搬到同一间，按钮不给按 ────────────────────────────────────
 *
 * `transfer_stock` 自己会拒绝，而**一颗按下去一定失败的按钮
 * 是这个仓库禁的第一条**。所以两边选到同一间的时候，
 * 按钮是灰的，而且旁边讲得出为什么。
 *
 * ── 🔴 架上不够照样搬，然后讲出来 ──────────────────────────────────────
 *
 * 那一支回一个 `short` —— **0 是「够」，不是「没问题」的同义词**。
 * 挡下去他就绕过系统搬，而那一天起两间店的数字都是假的：
 * **他真的把货搬走了，错的是那个数字**（[任务 230] 同一条）。
 */

type Branch = { id: string; name: string };
type Item = { id: string; name: string; unit: string };
type Row = {
  id: string;
  item: string;
  qty: number;
  from: string;
  to: string;
  on: string;
};
type Words = Record<string, string>;

export function TransferDesk({
  branches,
  items,
  rows,
  words,
}: {
  branches: Branch[];
  items: Item[];
  rows: Row[];
  words: Words;
}) {
  const router = useRouter();
  const [item, setItem] = useState(items[0]?.id ?? "");
  const [from, setFrom] = useState(branches[0]?.id ?? "");
  const [to, setTo] = useState(branches[1]?.id ?? "");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const [failed, setFailed] = useState(false);

  const same = from === to;
  const canGo = !!item && !!from && !!to && !same && Number(qty) > 0 && !busy;

  const move = async () => {
    if (!canGo) return;
    setBusy(true);
    setSaid("");
    setFailed(false);
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.rpc("transfer_stock", {
      in_item_id: item,
      in_from_branch: from,
      in_to_branch: to,
      in_qty: Number(qty),
      in_note: note,
    });
    setBusy(false);
    if (error) {
      setFailed(true);
      return;
    }
    const r = (data as { moved: number; short: number }[] | null)?.[0];
    const short = Number(r?.short ?? 0);
    /* 🔴 不够的时候讲出来 —— 见档头。 */
    setSaid(
      short > 0
        ? words.shortWarn.replace("%n", String(short))
        : words.moved.replace("%n", String(Number(r?.moved ?? qty))),
    );
    setQty("");
    setNote("");
    router.refresh();
  };

  const undo = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setSaid("");
    setFailed(false);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc("undo_transfer", {
      in_transfer_id: id,
    });
    setBusy(false);
    if (error) {
      setFailed(true);
      return;
    }
    router.refresh();
  };

  /* ⚠️ **不加 `appearance-none`** —— 看图才看到：四个框里三个是下拉，
     而拿掉那支箭之后它们跟旁边那个打字的框长得一模一样，
     没有任何东西告诉他那三个是选的。 */
  const select = deskField;

  return (
    <div className="flex flex-col gap-5">
      <DeskCard title={words.formTitle}>
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1.5">
              <span className={deskDim}>{words.item}</span>
              <select
                value={item}
                onChange={(e) => setItem(e.target.value)}
                className={select}
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                    {i.unit ? ` · ${i.unit}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={deskDim}>{words.fromBranch}</span>
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className={select}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={deskDim}>{words.toBranch}</span>
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={select}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={deskDim}>{words.qty}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className={deskField}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={deskDim}>{words.note}</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={deskField}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!canGo}
              onClick={move}
              className={deskBtn("primary")}
            >
              {words.move}
            </button>
            {/* 🔴 灰的那一刻讲得出为什么 —— 见档头。 */}
            {same && <span className={deskDim}>{words.sameBranch}</span>}
            {said && <span className={deskDim}>{said}</span>}
            {failed && (
              <span className="[color:var(--color-clay-bright)] [font-size:var(--text-sm)]">
                {words.saveFailed}
              </span>
            )}
          </div>

          <p className={deskDim}>{words.formNote}</p>
        </div>
      </DeskCard>

      <DeskCard title={words.pastTitle}>
        {rows.length === 0 ? (
          <p className={deskDim}>{words.none}</p>
        ) : (
          <ul className="flex flex-col gap-3" data-transfers="list">
            {rows.map((r) => (
              <li
                key={r.id}
                data-transfers="card"
                className="[border:var(--hairline)_solid_var(--color-ink-800)] [border-radius:var(--radius-md)] p-4"
              >
                {/* 一张运单卡 ← `up-logistics`：左边从哪里、右边到哪里，
                    中间一条虚线。方向是这一件唯一会记错的东西，
                    而一条虚线讲得比两栏字快。 */}
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
                    {r.from}
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-px min-w-8 flex-1 [border-top:1px_dashed_var(--color-ink-800)]"
                  />
                  <span className={deskDim}>→</span>
                  <span
                    aria-hidden="true"
                    className="h-px min-w-8 flex-1 [border-top:1px_dashed_var(--color-ink-800)]"
                  />
                  <span className="min-w-0 flex-1 truncate text-right [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
                    {r.to}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3 [border-color:var(--color-ink-800)]">
                  <span className="[font-size:var(--text-sm)]">
                    {r.item}
                    <span className="tabular-nums"> · {r.qty}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={deskDim}>{r.on}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => undo(r.id)}
                      className={deskBtn("danger")}
                    >
                      {words.undo}
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DeskCard>
    </div>
  );
}

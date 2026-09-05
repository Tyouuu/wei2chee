"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DeskCard, deskBtn, deskDim, deskField } from "../desk-kit";

/**
 * 快过期的，跟一批货进来了。
 *
 * ── 🔴 「还剩几件」不是存起来的 ─────────────────────────────────────────
 *
 * `batches_of` 的 `on_hand` 是**从流水加出来的**（20260905320000）——
 * 架上有几件 · 过期 · 帐龄 · 保养到期日 · 车子里程 · 这一件，
 * **存起来的数字会说谎，算出来的不会**。所以这一页上没有一格给他打「还剩几件」。
 *
 * ── ⚠️ 已经过期的排最前面，而且读起来要跟「还有几天」不一样 ─────────────
 *
 * 那是他今天就该从架上拿下来的那几盒。
 */

type Expiring = {
  batch_id: string;
  item_id: string;
  item_name: string;
  code: string;
  expiry_on: string | null;
  days_left: number | null;
  on_hand: number;
  unit: string;
  location: string;
};

type Batch = {
  batch_id: string;
  code: string;
  expiry_on: string | null;
  received_on: string | null;
  on_hand: number;
  days_left: number | null;
};

type Words = Record<string, string>;

/* 🔴 **这几条字里的占位是 `%n`，不是 `{n}`。**
   next-intl 看到 `{n}` 就当成一个必填参数，而这一类字是
   **逐行**代进去的 —— 页面那一层给不了那个值。
   结果是它把 **key 本身**印在画面上：`portal.expiry.daysLeft`。
   尺子当时只报「没有讲还有几天」，一张图就看到了。 */

export function ShelfLife({
  soon,
  items,
  words,
}: {
  soon: Expiring[];
  items: { id: string; name: string; unit: string }[];
  words: Words;
}) {
  const router = useRouter();
  const dim = deskDim;
  const btn = deskBtn();
  const field = deskField;

  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [expiry, setExpiry] = useState("");
  const [received, setReceived] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const [batches, setBatches] = useState<Batch[] | null>(null);

  async function look(id: string) {
    if (!id) return;
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("batches_of", { in_item_id: id });
      if (error) {
        setBatches([]);
        return;
      }
      setBatches((data ?? []) as Batch[]);
    } catch {
      setBatches([]);
    }
  }

  async function add() {
    if (busy) return;
    /* 🔴 批号是这一整件事的钥匙 —— 没有它这一批就认不出来，
       而一个空的批号在画面上跟一个真的批号长得一样。 */
    if (!code.trim()) {
      setSaid(words.needCode);
      return;
    }
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("add_stock_batch", {
        in_item_id: itemId,
        in_code: code.trim(),
        /* ⚠️ 空的效期存的是「没有」，不是今天 —— 一个凭空写上去的效期，
           会让一盒不会过期的货出现在「快过期」上。 */
        in_expiry_on: expiry || null,
        in_received_on: received || null,
      });
      if (error) {
        setSaid(words.failed);
        return;
      }
      setSaid(words.added);
      setCode("");
      setExpiry("");
      await look(itemId);
      /* 新的一批可能马上就在「快过期」上 —— 那一段是伺服器画的。 */
      router.refresh();
    } catch {
      setSaid(words.failed);
    } finally {
      setBusy(false);
    }
  }

  const unitOf = (id: string) => items.find((i) => i.id === id)?.unit ?? "";

  return (
    <>
      {/* 🔴 **这一段是一片格子，不是一串行。**

          老板：「我不要一直都是相同的组件」。而这一段问的问题跟别的清单
          不一样 —— 他要的是**一眼扫过去哪一盒最急**，而一串等宽的行
          没有办法让「还有 3 天」比「还有 60 天」跳出来。

          骨架抄的是他挑的那一套的 `file-manager`（一件东西一张小卡，
          那个数字最大），只是这里最大的那个数字是**还有几天**。 */}
      <DeskCard title={words.soonLabel}>
        <p className={`mb-5 ${dim}`}>{soon.length ? words.soonLede : words.soonNone}</p>
        {soon.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {soon.map((b) => {
              const late = b.days_left != null && b.days_left < 0;
              return (
                <li
                  key={b.batch_id}
                  className={`flex flex-col gap-1 [border-radius:var(--radius-md)] [border:var(--hairline)_solid_var(--color-ink-800)] p-4 ${
                    late ? "[border-color:var(--color-clay-bright)]" : ""
                  }`}
                >
                  <span className="[font-weight:var(--fw-semibold)]">{b.item_name}</span>
                  {/* 那个数字最大 —— 这一格的答案就是它。 */}
                  <span
                    className={`tabular-nums [font-size:var(--text-stat)] [font-weight:var(--fw-semibold)] ${
                      late ? "text-[color:var(--color-clay-bright)]" : ""
                    }`}
                  >
                    {b.days_left == null
                      ? words.noExpiry
                      : late
                        ? words.gone.replace("%n", String(Math.abs(b.days_left)))
                        : words.daysLeft.replace("%n", String(b.days_left))}
                  </span>
                  <span className={`tabular-nums ${dim}`}>
                    {[b.code, `${b.on_hand} ${b.unit}`.trim(), b.location]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </DeskCard>

      <div className="h-5" />

      <DeskCard title={words.batchesLabel}>
        <p className={`mb-4 ${dim}`}>{words.batchesLede}</p>
        {items.length === 0 ? (
          <p className={dim}>{words.noItems}</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-[1fr_10rem_10rem_10rem_auto] md:items-end">
              <label className="grid gap-1">
                <span className={dim}>{words.item}</span>
                <select
                  value={itemId}
                  onChange={(e) => {
                    setItemId(e.target.value);
                    setBatches(null);
                    setSaid("");
                  }}
                  className={field}
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className={dim}>{words.code}</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={words.codePlaceholder}
                  className={field}
                />
              </label>
              <label className="grid gap-1">
                <span className={dim}>{words.expiryOn}</span>
                <input
                  type="date"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className={`${field} tabular-nums`}
                />
              </label>
              <label className="grid gap-1">
                <span className={dim}>{words.receivedOn}</span>
                <input
                  type="date"
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                  className={`${field} tabular-nums`}
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={add}
                  className={deskBtn("primary")}
                >
                  {busy ? words.adding : words.add}
                </button>
                <button type="button" onClick={() => look(itemId)} className={btn}>
                  {words.itsBatches}
                </button>
                {said && (
                  <span aria-live="polite" className={dim}>
                    {said}
                  </span>
                )}
              </div>
            </div>

            {batches !== null && (
              <div className="mt-5">
                {batches.length === 0 ? (
                  <p className={dim}>{words.noBatches}</p>
                ) : (
                  <ul className="flex flex-col">
                    {batches.map((b) => (
                      <li
                        key={b.batch_id}
                        className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t py-2 [border-color:var(--color-ink-800)]"
                      >
                        <span className="tabular-nums [font-weight:var(--fw-medium)]">{b.code}</span>
                        <span className={`tabular-nums ${dim}`}>
                          {words.onHand} {b.on_hand} {unitOf(itemId)}
                        </span>
                        <span className="min-w-0 flex-1" />
                        <span className={`tabular-nums ${dim}`}>
                          {b.expiry_on ?? words.noExpiry}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </DeskCard>
    </>
  );
}

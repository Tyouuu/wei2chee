"use client";

import { deskBtn, deskDim, deskField } from "../desk-kit";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * 开帐 —— 他换到这一套之前，手上本来就有的那几个数字。
 *
 * ── 为什么这一段要给他打字（2026-09-05）────────────────────────────────
 *
 * 这一整页其余每一个数字都是**从他自己的书加出来的**，一个都不用他填。
 * 而开帐不是：他昨天银行有多少、客人已经欠他多少，**那是这套系统
 * 看不到的历史**。少了它，试算表从他装这套系统那天开始，
 * 而那不是他的生意开始的那天。
 *
 * ── 🔴 对方那一边永远是「开帐」，所以他一个字都不用想 ────────────────
 *
 * `set_opening_balance` 自己配平（20260905570000）：他打「银行有两万」，
 * 另一边自己去权益。**每一套小生意的开帐都是这样做的**，而它永远配得平。
 * 这一页因此没有一格叫「对方科目」—— 那一格正是老板放弃会计软件的那一刻。
 *
 * ── 名字跟数字同一行，因为它们是同一个动作 ─────────────────────────────
 *
 * 「现金 · 银行」是我们给的词，而他的是「大众银行」。
 * `set_ledger_account_name` 从做出来那天起也没有画面 —— 而他会想改它的
 * 那一刻，正好就是他坐下来填开帐的那一刻。
 *
 * ⚠️ **代号不给改**（程式读它），**名字给改**（人看它）——
 * 跟 `stage` · `category` 同一条。
 */

type Account = {
  code: string;
  name: string;
  kind: string;
  opening_cents: number | null;
  opening_as_on: string | null;
};

export function OpeningBook({
  projectId,
  accounts,
  words,
}: {
  projectId: string;
  accounts: Account[];
  words: {
    name: string;
    amount: string;
    asOn: string;
    save: string;
    saving: string;
    saved: string;
    failed: string;
    future: string;
    negative: string;
    noDate: string;
  };
}) {
  const [rows, setRows] = useState(() =>
    accounts.map((a) => ({
      ...a,
      /* 分变成块 —— 他打的是 20000，不是 2000000。 */
      amount: a.opening_cents ? String(Math.round(a.opening_cents / 100)) : "",
      asOn: a.opening_as_on ?? "",
    })),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<Record<string, string>>({});

  async function save(code: string) {
    const row = rows.find((r) => r.code === code);
    if (!row || busy) return;
    /* 🔴 挡在这里讲人话，而不是让资料库那句英文冒出来 ——
       那一支自己也挡（未来的日子 · 负数），而它讲的是给程式听的话。 */
    if (!row.asOn) {
      setSaid((s) => ({ ...s, [code]: words.noDate }));
      return;
    }
    if (row.asOn > new Date().toISOString().slice(0, 10)) {
      setSaid((s) => ({ ...s, [code]: words.future }));
      return;
    }
    const cents = Math.round(Number(row.amount || 0) * 100);
    if (cents < 0) {
      setSaid((s) => ({ ...s, [code]: words.negative }));
      return;
    }
    setBusy(code);
    try {
      const supabase = createBrowserSupabaseClient();
      const name = row.name.trim();
      /* 名字先改 —— 一次失败的改名之后还写进去一个数字，
         会让他以为两样都存好了。 */
      if (name && name !== accounts.find((a) => a.code === code)?.name) {
        const { error } = await supabase.rpc("set_ledger_account_name", {
          in_project_id: projectId,
          in_code: code,
          in_name: name,
        });
        if (error) {
          setSaid((s) => ({ ...s, [code]: words.failed }));
          return;
        }
      }
      const { error } = await supabase.rpc("set_opening_balance", {
        in_project_id: projectId,
        in_code: code,
        in_amount_cents: cents,
        in_as_on: row.asOn,
      });
      setSaid((s) => ({ ...s, [code]: error ? words.failed : words.saved }));
    } catch {
      setSaid((s) => ({ ...s, [code]: words.failed }));
    } finally {
      setBusy(null);
    }
  }

  const field = deskField;

  return (
    <div className="flex flex-col">
      <div className="hidden gap-3 pb-2 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)] md:grid md:grid-cols-[1fr_9rem_10rem_auto]">
        <span>{words.name}</span>
        <span className="text-right">{words.amount}</span>
        <span>{words.asOn}</span>
        <span />
      </div>
      {rows.map((r) => (
        <div
          key={r.code}
          className="grid items-center gap-3 border-t py-3 [border-color:var(--color-ink-800)] md:grid-cols-[1fr_9rem_10rem_auto]"
        >
          <input
            value={r.name}
            onChange={(e) =>
              setRows((v) => v.map((x) => (x.code === r.code ? { ...x, name: e.target.value } : x)))
            }
            className={field}
            aria-label={words.name}
          />
          <input
            value={r.amount}
            inputMode="decimal"
            onChange={(e) =>
              setRows((v) =>
                v.map((x) =>
                  x.code === r.code
                    ? { ...x, amount: e.target.value.replace(/[^0-9.]/g, "") }
                    : x,
                ),
              )
            }
            className={`${field} text-right tabular-nums`}
            aria-label={words.amount}
          />
          <input
            type="date"
            value={r.asOn}
            onChange={(e) =>
              setRows((v) => v.map((x) => (x.code === r.code ? { ...x, asOn: e.target.value } : x)))
            }
            className={`${field} tabular-nums`}
            aria-label={words.asOn}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy === r.code}
              onClick={() => save(r.code)}
              className="inline-flex min-h-11 items-center justify-center disabled:opacity-60 [background-color:var(--color-ink-900)] [border-radius:var(--radius-control)] [border:var(--hairline)_solid_var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-sm)] [padding-inline:calc(var(--pad-control-x)*1.2)]"
            >
              {busy === r.code ? words.saving : words.save}
            </button>
            {said[r.code] && (
              <span
                aria-live="polite"
                className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]"
              >
                {said[r.code]}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

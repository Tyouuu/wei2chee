"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecordFormCopy } from "../record-copy";

/**
 * 「这位客人还剩几次。」
 *
 * ── 为什么它在客户那一页 ──────────────────────────────────────────────────
 *
 * 因为那是他会去问这句话的地方。客人坐下来，前台打开她的名字 ——
 * 「你那张十次的还剩三次，今天用掉一次吗？」
 * 一张全店的套票清单回答不了这句，它回答的是另一个问题（这个月卖了几张）。
 *
 * ── 🔴 剩几次不是一个可以按的数字 ────────────────────────────────────────
 *
 * 它是**总次数减掉打卡那几行**数出来的（`package_balance`）。
 * 所以这一页上没有一格「还剩几次」给他打字 —— 跟库存那一格「架上有几个」
 * 同一条：**一个是加起来的数字，就不该有人打得进去。**
 *
 * 要改，就记一次打卡，或者退回一次。两件都留下痕迹。
 *
 * ── 过期只讲，不挡 ────────────────────────────────────────────────────────
 *
 * 一张过期的套票照样刷得掉（跟报价单过期同一条：过期是日历的事实，
 * 通不通融是老板的判断）。这里把「过期了」印出来，然后让他自己决定 ——
 * 而一间沙龙常常通融。
 */

export type PackageRow = {
  id: string;
  name: string;
  total: number;
  left: number;
  soldOn: string;
  expiresOn: string | null;
  expired: boolean;
};

export function PackagesPanel({
  partyId,
  rows,
  copy,
}: {
  partyId: string;
  rows: readonly PackageRow[];
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sessions, setSessions] = useState("10");
  const [expiry, setExpiry] = useState("");

  const db = () => createBrowserSupabaseClient();

  /* ⚠️ `PromiseLike`，不是 `Promise`：supabase 的查询建构器是 thenable，
     不是一个真的 Promise（它没有 catch / finally）。写成 Promise 的话
     每一个呼叫点都要多包一层 async 箭头，而那是为了型别写的噪音。 */
  async function run(
    tag: string,
    work: () => PromiseLike<{ error: { message: string } | null }>,
  ) {
    setError(null);
    setBusy(tag);
    try {
      const { error: err } = await work();
      if (err) {
        setError(err.message);
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(null);
    }
  }

  async function sell() {
    const n = Number((sessions ?? "").replace(/[^\d]/g, ""));
    if (!name.trim() || !Number.isFinite(n) || n <= 0) return;
    const ok = await run("sell", () =>
      db().rpc("add_service_package", {
        in_party_id: partyId,
        in_name: name.trim(),
        in_sessions_total: n,
        in_expires_on: expiry || null,
        /* 手机上网路慢，他会按两次。同一张单不要变成两张。 */
        in_idempotency_key: crypto.randomUUID(),
      }),
    );
    if (ok) {
      setName("");
      setSessions("10");
      setExpiry("");
      setOpen(false);
    }
  }

  const dim = "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";
  const control =
    "ds-control h-10 w-full min-w-0 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]";
  const quiet =
    "inline-flex min-h-11 items-center [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)] disabled:opacity-60";

  const fill = (shape: string, n: number) => shape.replace("{n}", String(n));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.packHeading}
        </h2>
        <p className={`mt-1 ${dim}`}>{copy.packLede}</p>
      </div>

      {rows.length ? (
        <div className="flex flex-col [border-radius:var(--radius-md)] border [border-color:var(--color-ink-800)]">
          {rows.map((r, i) => (
            <div
              key={r.id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 ${
                i ? "border-t [border-color:var(--color-ink-800)]" : ""
              }`}
            >
              <div className="min-w-40 flex-1">
                <div className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
                  {r.name}
                </div>
                <div className={dim}>
                  {copy.packSoldOn} {r.soldOn}
                  {r.expiresOn ? ` · ${copy.packExpiresOn} ${r.expiresOn}` : ""}
                  {/* 过期只讲，不挡 —— 见档头。 */}
                  {r.expired ? ` · ${copy.packExpired}` : ""}
                </div>
              </div>

              {/* 🔴 剩几次是**印出来的，不是一个输入框** —— 它是数出来的。 */}
              <div
                className={`tabular-nums [font-size:var(--text-stat)] [font-weight:var(--fw-semibold)] ${
                  r.left > 0
                    ? "text-[color:var(--color-primary)]"
                    : "text-[color:var(--color-on-canvas-dim)]"
                }`}
              >
                {r.left > 0 ? fill(copy.packLeft, r.left) : copy.packUsedUp}
              </div>
              <div className={dim}>/ {r.total}</div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!!busy || r.left <= 0}
                  onClick={() =>
                    void run(r.id, () =>
                      db().rpc("use_package_session", {
                        in_package_id: r.id,
                        in_idempotency_key: crypto.randomUUID(),
                      }),
                    )
                  }
                  className="inline-flex min-h-11 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] disabled:opacity-60"
                >
                  {busy === r.id ? copy.packUsing : copy.packUse}
                </button>
                {r.left < r.total ? (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={async () => {
                      const client = db();
                      const { data } = await client
                        .from("package_uses")
                        .select("id")
                        .eq("package_id", r.id)
                        .order("created_at", { ascending: false })
                        .limit(1);
                      const last = (data ?? [])[0]?.id;
                      if (!last) return;
                      await run(`undo-${r.id}`, () =>
                        client.rpc("undo_package_use", { in_use_id: last }),
                      );
                    }}
                    className={`min-h-11 underline ${dim}`}
                  >
                    {copy.packUndo}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() =>
                    void run(`away-${r.id}`, () =>
                      db().rpc("set_package_archived", { in_id: r.id, in_archived: true }),
                    )
                  }
                  className={`min-h-11 underline ${dim}`}
                >
                  {copy.packPutAway}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className={dim}>{copy.packNone}</p>
      )}

      {open ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-40 flex-1 flex-col gap-1">
            <span className={dim}>{copy.packName}</span>
            <input
              aria-label={copy.packName}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={control}
            />
          </label>
          <label className="flex w-24 flex-col gap-1">
            <span className={dim}>{copy.packSessions}</span>
            <input
              aria-label={copy.packSessions}
              inputMode="numeric"
              value={sessions}
              onChange={(e) => setSessions(e.target.value)}
              className={control}
            />
          </label>
          <label className="flex w-44 flex-col gap-1">
            <span className={dim}>{copy.packExpiry}</span>
            <input
              aria-label={copy.packExpiry}
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className={control}
            />
          </label>
          <button
            type="button"
            disabled={busy === "sell" || !name.trim()}
            onClick={() => void sell()}
            className="inline-flex min-h-11 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] disabled:opacity-60"
          >
            {busy === "sell" ? copy.packSelling : copy.packSell}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`self-start ${quiet}`}>
          {copy.packSell}
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

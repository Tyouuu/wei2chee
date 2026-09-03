"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecordFormCopy } from "../record-copy";

/**
 * 盘点：架上数到 84，系统说 91。
 *
 * ── 为什么它非有不可 ──────────────────────────────────────────────────────
 *
 * 一个货品建好之后，数量就锁住了（那是对的：总数是流水加起来的）。
 * 而库存的性质是**它一定会飘** —— 破了三包、少算两箱、上个月就是差七个。
 * 一个记不了差异的库存，三个月之后就是一个没有人再看的数字。
 *
 * ── 🔴 他打的是「架上有几个」，不是「差几个」 ────────────────────────────
 *
 * 差几个是算出来的，而且**在资料库里算**（`count_stock`）——
 * 两个人同时盘点的时候，那是唯一挡得住的地方。
 * 这里那一行「会记一笔：−7」只是**给他看的预告**，不是送出去的数字。
 *
 * ── 站在架子前面 ──────────────────────────────────────────────────────────
 *
 * 他是拿着手机站在架子前面数的，所以：数字键盘、44px、一格一个动作。
 */

export function Stocktake({
  itemId,
  onHand,
  unit,
  onCounted,
  copy,
}: {
  itemId: string;
  /** 系统现在说有几个。null = 读不到 —— 那时候不画，不画一个 0。 */
  onHand: number | null;
  unit: string;
  /**
   * 🔴 记完之后，把新的数量交回上面那一格。
   *
   * 少了这一句，画面上那个数字**不会变** —— 而资料库已经变了。
   * `router.refresh()` 重画的是伺服器那棵树，而那一格的值是这个表单
   * 第一次挂载的时候存进 useState 的，之后就跟伺服器没有关系了。
   *
   * 那正是这个仓库犯过十一次的那个形状：**改到了，画面没动**，
   * 而他盯着一个没变的数字，没有任何理由去重新整理。
   * 这一次是**看图**看到的，不是尺子（尺子那时候只在问资料库）。
   */
  onCounted: (counted: number) => void;
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [counted, setCounted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (onHand == null) return null;

  const n = counted.trim() === "" ? null : Number(counted.replace(/[^\d.-]/g, ""));
  const valid = n != null && Number.isFinite(n) && n >= 0;
  const diff = valid ? n - onHand : null;

  async function run() {
    if (!valid) return;
    setError(null);
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: err } = await supabase.rpc("count_stock", {
        in_item_id: itemId,
        in_counted: n,
        /* 他自己的词由那一页的语言决定，而那一句住在资料库里 ——
           这里不传，让 count_stock 照 system_language 挑。 */
      });
      if (err) {
        setError(err.message);
        return;
      }
      onCounted(n);
      setCounted("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 [border-radius:var(--radius-md)] border p-3 [border-color:var(--color-ink-800)]">
      <span className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
        {copy.countHeading}
      </span>
      <p className="[font-size:var(--text-xs)] text-[color:var(--color-on-canvas-dim)]">
        {copy.countLede}
      </p>

      <div className="flex items-center gap-2">
        <input
          aria-label={copy.countLabel}
          placeholder={copy.countLabel}
          inputMode="decimal"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          className="ds-control h-11 min-w-0 flex-1 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]"
        />
        <button
          type="button"
          disabled={busy || !valid || diff === 0}
          onClick={() => void run()}
          className="inline-flex h-11 shrink-0 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] transition-colors [transition-duration:var(--dur)] hover:[background-color:var(--color-primary-deep)] disabled:opacity-60"
        >
          {busy ? copy.countRunning : copy.countCta}
        </button>
      </div>

      {/* 🔴 按下去之前先讲会发生什么。一个直接吃下去的盘点，
          他没有办法在按之前发现自己多打了一个零。 */}
      {valid ? (
        <span className="[font-size:var(--text-xs)] tabular-nums text-[color:var(--color-on-canvas-dim)]">
          {diff === 0
            ? copy.countSame
            : copy.countDiff.replace(
                "{n}",
                `${diff! > 0 ? "+" : "−"}${Math.abs(diff!)}${unit ? ` ${unit}` : ""}`,
              )}
        </span>
      ) : null}

      {error ? (
        <p role="alert" className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

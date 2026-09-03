"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecordFormCopy } from "../record-copy";
import { fromPacks, hasPacks, packPhrase } from "@/lib/portal/pack-units";

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
  packSize,
  packUnit,
  onCounted,
  copy,
}: {
  itemId: string;
  /** 系统现在说有几个。null = 读不到 —— 那时候不画，不画一个 0。 */
  onHand: number | null;
  unit: string;
  /** 一箱几个。>1 才有箱这个概念 —— 见 lib/portal/pack-units.ts。 */
  packSize?: number | null;
  packUnit?: string;
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
  /* 🔴 一个杂货批发商站在仓库里看到的是「三箱又十九罐」，他数不出 91。
     `pack_size` 从 20260901070000 就存得进去，而在这一格之前
     **没有任何地方拿它算过东西**。 */
  const [packs, setPacks] = useState("");
  const byPack = hasPacks(packSize);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (onHand == null) return null;

  const num = (t: string) => (t.trim() === "" ? null : Number(t.replace(/[^\d.-]/g, "")));
  const loose = num(counted);
  const packCount = num(packs);
  /* 两格都空才叫没填。只打箱数、只打零头，两个都是他真的会做的事。 */
  const n = byPack
    ? packCount == null && loose == null
      ? null
      : fromPacks(packCount ?? 0, loose ?? 0, packSize as number)
    : loose;
  const valid = n != null && Number.isFinite(n) && n >= 0;
  const diff = valid ? n - onHand : null;
  const diffPhrase = diff != null ? packPhrase(diff, packSize, packUnit ?? "", unit) : null;
  const onHandPhrase = packPhrase(onHand, packSize, packUnit ?? "", unit);

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
      setPacks("");
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

      {/* 系统现在说几箱几个。有箱才印 —— 没有箱的时候上面那一格已经讲完了。 */}
      {onHandPhrase ? (
        <span className="[font-size:var(--text-xs)] tabular-nums text-[color:var(--color-on-canvas-dim)]">
          {onHand} {unit} · {onHandPhrase}
        </span>
      ) : null}

      {/* 🔴 390 上三个控件挤成一排，「另外几个」被切掉一半 ——
          而那正好是他站着的宽度。改成会换行：两个数字并排，
          按钮自己一行、整条宽（戴着手套的拇指按得准）。 */}
      <div className="flex flex-wrap items-center gap-2">
        {byPack ? (
          <input
            aria-label={copy.packHowMany}
            placeholder={copy.packShort}
            inputMode="decimal"
            value={packs}
            onChange={(e) => setPacks(e.target.value)}
            className="ds-control h-11 min-w-0 basis-[calc(50%-0.25rem)] grow [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]"
          />
        ) : null}
        <input
          aria-label={byPack ? copy.packLoose : copy.countLabel}
          /* 并排的时候用短的那个字 —— 一个被切掉一半的提示读不出来。
             aria-label 照旧是完整那一句。 */
          placeholder={byPack ? copy.packLooseShort : copy.countLabel}
          inputMode="decimal"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          className="ds-control h-11 min-w-0 basis-[calc(50%-0.25rem)] grow [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]"
        />
        <button
          type="button"
          disabled={busy || !valid || diff === 0}
          onClick={() => void run()}
          className="inline-flex h-11 w-full shrink-0 items-center justify-center sm:w-auto sm:justify-start [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] transition-colors [transition-duration:var(--dur)] hover:[background-color:var(--color-primary-deep)] disabled:opacity-60"
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
                `${diff! > 0 ? "+" : "−"}${Math.abs(diff!)}${unit ? ` ${unit}` : ""}` +
                  /* 箱那一句接在后面：他打的是箱，而记进去的是罐 ——
                     两个都印出来，他才看得出自己有没有多打一个零。 */
                  (byPack && diffPhrase ? ` (${copy.packThatIs} ${diffPhrase})` : ""),
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

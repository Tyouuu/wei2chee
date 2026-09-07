"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { deskBtn, deskDim } from "../desk-kit";

/**
 * 哪几件货是一台一台管的。
 *
 * ── 🔴 预设是关的，而且开不开得了是资料库在判 ─────────────────────────────
 *
 * 一包水泥永远不该看到序号那一栏（[任务 91](#91)），所以
 * `catalog_items.tracks_serial` 预设是 false。
 *
 * 而**架上还有没挂在任何一批上的货就不准开**（20260906100000 的守卫）——
 * 开了之后那几件永远没有序号，画面上会同时写着「架上 5 件」跟「有序号的 0 件」，
 * **同一个问题两个答案**。所以这里不自己判，**把资料库那句拒绝原样印出来** ——
 * 而它自己讲得出出路（先盘成零，或者一件一件补序号）。
 *
 * ⚠️ **关掉永远可以** —— 那是放宽。
 */

type Item = {
  id: string;
  name: string;
  unit: string | null;
  tracks: boolean;
  /** 已经登记了几台。⚠️ 只在开着的那几件上有意义。 */
  units: number;
};

export function TrackedItems({
  items,
  words,
}: {
  items: Item[];
  words: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* 一件都还没开的时候，那一整份货架不用摊出来 —— 他多半是来查一个号码的。 */
  const [showAll, setShowAll] = useState(false);

  async function flip(id: string, on: boolean) {
    setError(null);
    setBusy(id);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc(
        "set_item_serial_tracking",
        { in_item_id: id, in_on: on },
      );
      if (err) {
        /* 🔴 原样印。那句拒绝自己讲得出该怎么做，而我重写一次
           只会把「先盘成零」那条出路弄丢。 */
        setError(err.message);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const on = items.filter((i) => i.tracks);
  const off = items.filter((i) => !i.tracks);

  return (
    <div data-tracked-items className="flex flex-col gap-4">
      {on.length ? (
        <ul className="flex flex-col">
          {on.map((i) => (
            <li
              key={i.id}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t py-3 [border-color:var(--color-ink-800)]"
            >
              <span className="[font-weight:var(--fw-semibold)]">{i.name}</span>
              <span className={`[font-size:var(--text-sm)] ${deskDim}`}>
                {words.unitsOn.replace("%n", String(i.units))}
              </span>
              <span className="min-w-0 flex-1" />
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => flip(i.id, false)}
                className={`[font-size:var(--text-sm)] underline ${deskDim}`}
              >
                {words.turnOff}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`[font-size:var(--text-sm)] ${deskDim}`}>{words.noneOn}</p>
      )}

      {off.length ? (
        showAll ? (
          <div className="flex flex-col gap-2">
            <p className={`[font-size:var(--text-sm)] ${deskDim}`}>
              {words.turnOnLede}
            </p>
            <ul className="flex flex-col">
              {off.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t py-3 [border-color:var(--color-ink-800)]"
                >
                  <span>{i.name}</span>
                  <span className="min-w-0 flex-1" />
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => flip(i.id, true)}
                    className={deskBtn()}
                  >
                    {words.turnOn}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className={`self-start [font-size:var(--text-sm)] underline ${deskDim}`}
          >
            {words.showAll.replace("%n", String(off.length))}
          </button>
        )
      ) : null}

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

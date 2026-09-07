"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ringgit } from "@/lib/portal/live-rows";
import { DeskCard, deskBtn, deskDim, deskField } from "../desk-kit";

/**
 * 一个号码，跟那一台自己走过的路。
 *
 * ── 🔴 为什么这一页的骨架不跟车牌那一页一样 ───────────────────────────────
 *
 * 车牌那一页答的是「上次什么时候来 · 做了什么」—— 一份**做过的事**的清单。
 * 这一页答的是「**这一台现在在哪里**」：几时进的、进价多少、卖给谁、几时出的。
 * 那是一条**只会走一次的路**（进 → 出），所以它画成一条轨道，不是一张清单：
 * 一个进出各一次的东西列成两行表格，读起来是两件不相干的事。
 *
 * ── 一台车、一台冰箱、一张 SIM ────────────────────────────────────────────
 *
 * [任务 181](../../../../../docs/founder-tasks.md#181) 拿我们自己扫到的名单数过：
 * **怡保 262 家里 122 家要序号（47%）** —— 车行 90 · 电器 19 · 手机店 13，
 * 而**车行是怡保排第一的行业**。一间二手车行的整个库存就是序号：
 * 一台车、一个车架号、一个成本、一个卖价。
 *
 * ⚠️ 而 [任务 91](#91) 写的「没有人给一包水泥编序号」**没有被推翻** ——
 * 那句话是对着**五金建材**讲的（那一栏 48 家，18%），
 * 而它就是这里为什么**预设是关的**：一件货身上一个开关，五金店永远看不到那一栏。
 *
 * ── 🔴 进价只给看得到钱的人 ───────────────────────────────────────────────
 *
 * `batches_of` 跟 `serial_history` 是 `works_here`（柜台查一台车在不在，
 * 是他一天的工作），而**进价那一栏按身分回 null**。
 * 「不给看」跟「免费」是两句话，所以读不到就整段不画，**不画一个 RM 0**。
 */

type Move = {
  moved_on: string | null;
  direction: string | null;
  qty: number | null;
  reason: string | null;
  doc_no: string | null;
  party: string | null;
};
type Found = {
  itemId: string;
  itemName: string;
  code: string;
  onHand: number;
  unitCostCents: number | null;
  moves: Move[];
};

type Words = Record<string, string>;

export function SerialSearch({
  projectId,
  items,
  words,
}: {
  projectId: string;
  /** 已经开了序号的那几件货 —— 登记一台新的要先挑一件。 */
  items: { id: string; name: string }[];
  words: Words;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState(false);
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* 登记一台新的 —— 只在查不到的时候画（车牌那一页学到的那一条：
     **他手上那个号码已经在框里了，不要他再打一次**）。 */
  const [itemId, setItemId] = useState("");
  const [cost, setCost] = useState("");

  async function look() {
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await createBrowserSupabaseClient().rpc(
        "serial_history",
        { in_project_id: projectId, in_code: c },
      );
      if (err) {
        setError(err.message);
        return;
      }
      const rows = (data ?? []) as {
        item_id: string;
        item_name: string;
        code: string;
        on_hand: number | null;
        unit_cost_cents: number | null;
        moved_on: string | null;
        direction: string | null;
        qty: number | null;
        reason: string | null;
        doc_no: string | null;
        party: string | null;
      }[];
      setAsked(true);
      if (!rows.length) {
        setFound(null);
        setItemId(items[0]?.id ?? "");
        return;
      }
      const first = rows[0];
      setFound({
        itemId: first.item_id,
        itemName: first.item_name,
        code: first.code,
        onHand: Number(first.on_hand ?? 0),
        unitCostCents:
          first.unit_cost_cents == null ? null : Number(first.unit_cost_cents),
        /* ⚠️ 一台从来没有动过的（登记了、还没进）回一行全空的 —— 那不是一步。 */
        moves: rows.filter((r) => r.moved_on || r.direction),
      });
    } finally {
      setBusy(false);
    }
  }

  async function register() {
    const c = code.trim();
    if (!c || !itemId) return;
    setBusy(true);
    setError(null);
    try {
      const cents = (() => {
        const n = Number(cost.replace(/[^0-9.]/g, ""));
        return Number.isFinite(n) && cost.trim() !== "" ? Math.round(n * 100) : null;
      })();
      const { error: err } = await createBrowserSupabaseClient().rpc(
        "add_stock_batch",
        {
          in_item_id: itemId,
          in_code: c,
          /* ⚠️ 序号没有效期 —— 那一栏是给一箱奶粉用的。 */
          in_unit_cost_cents: cents,
        },
      );
      if (err) {
        setError(err.message);
        return;
      }
      setCost("");
      router.refresh();
      await look();
    } finally {
      setBusy(false);
    }
  }

  /* ⚠️ 用产品自己那一支，不要在这里再写一次 —— 第一版是 `toFixed(2)`，
     印出来是 `RM 28000.00`，而这个系统每一个别的地方都是 `RM 28,000.00`。
     同一件事两份实作，这个仓库栽过至少八次。 */
  const money = (cents: number | null) =>
    cents == null ? null : (ringgit(cents) ?? null);

  return (
    <div data-serial-search className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-56 flex-1 flex-col gap-1.5">
          <span className={deskDim}>{words.code}</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              /* 柜台上他打完就按 Enter —— 一个非要用滑鼠的搜索框，
                 在一个手上拿着车钥匙的人面前是多一个动作。 */
              if (e.key === "Enter") {
                e.preventDefault();
                void look();
              }
            }}
            placeholder={words.codePlaceholder}
            className={deskField}
          />
        </label>
        <button
          type="button"
          disabled={busy || !code.trim()}
          onClick={look}
          className={deskBtn("primary")}
        >
          {busy ? words.searching : words.search}
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

      {/* ── 找到了：那一台，跟它走过的路 ────────────────────────────────── */}
      {found ? (
        <DeskCard title={found.itemName}>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            {/* 🔴 一个车架号是 17 个字，而 390 只有 390 ——
                实拍那一张图上它整个撑破了页面。所以窄屏小一档、而且断得了行：
                **一个横着滑出去的号码，跟一个印不出来的号码是同一件事。** */}
            <p className="[font-size:var(--text-title)] @xl:[font-size:var(--text-hero)] [font-weight:var(--fw-semibold)] tabular-nums break-all">
              {found.code}
            </p>
            {/* 🔴 在不在架上是这一页的答案 —— 一台卖掉的车跟一台还在的车，
                在柜台上是完全不同的下一句话。 */}
            <p
              className={
                found.onHand > 0
                  ? "[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]"
                  : `[font-size:var(--text-sm)] ${deskDim}`
              }
            >
              {found.onHand > 0 ? words.inStock : words.gone}
            </p>
            {/* 读不到就整段不画 —— 见档头。 */}
            {found.unitCostCents !== null ? (
              <p className={`[font-size:var(--text-sm)] ${deskDim}`}>
                {words.cost} {money(found.unitCostCents)}
              </p>
            ) : null}
          </div>

          {found.moves.length ? (
            <ol className="mt-4 flex flex-col gap-3">
              {found.moves.map((m, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-3">
                  {/* 进跟出用**形状**分，不只是颜色 —— 印出来跟灰阶上都要讲得出话。 */}
                  <span
                    aria-hidden="true"
                    className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] tabular-nums"
                  >
                    {m.direction === "out" ? "→" : "←"}
                  </span>
                  <span className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
                    {m.direction === "out" ? words.wentOut : words.cameIn}
                  </span>
                  <span className={`[font-size:var(--text-sm)] ${deskDim}`}>
                    {/* ⚠️ 去重 —— 出货那一笔的「为什么」就是那张单的单号，
                        於是第一版印出「SO-2026-0001 · Mr Tan · SO-2026-0001」。 */}
                    {Array.from(
                      new Set(
                        [m.moved_on, m.doc_no, m.party, m.reason]
                          .map((x) => String(x ?? "").trim())
                          .filter(Boolean),
                      ),
                    ).join(" · ")}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={`mt-4 [font-size:var(--text-sm)] ${deskDim}`}>
              {words.noMoves}
            </p>
          )}
        </DeskCard>
      ) : null}

      {/* ── 查不到：就在这里登记 ────────────────────────────────────────
          ⚠️ 只在**已经有货开了序号**的时候画。一件都没有的时候，
          他要做的是先去那件货上把它打开 —— 而一颗按下去一定失败的按钮
          是这个仓库禁的第一条。 */}
      {asked && !found ? (
        items.length ? (
          <DeskCard title={words.registerTitle}>
            <p className={`[font-size:var(--text-sm)] ${deskDim}`}>
              {words.notFound}
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="flex min-w-56 flex-1 flex-col gap-1.5">
                <span className={deskDim}>{words.whichItem}</span>
                <select
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  className={deskField}
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-40 flex-1 flex-col gap-1.5">
                <span className={deskDim}>{words.cost}</span>
                <input
                  inputMode="decimal"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className={deskField}
                />
              </label>
              <button
                type="button"
                disabled={busy || !itemId}
                onClick={register}
                className={deskBtn("primary")}
              >
                {busy ? words.registering : words.register}
              </button>
            </div>
          </DeskCard>
        ) : (
          <p className={`[font-size:var(--text-sm)] ${deskDim}`}>
            {words.noneTracked}
          </p>
        )
      ) : null}
    </div>
  );
}

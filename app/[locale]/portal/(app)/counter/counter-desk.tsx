"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DeskCard, deskBtn, deskDim, deskField } from "../desk-kit";

/**
 * 柜台。扫一下 · 一按结帐 · 找零。
 *
 * ── 一按，不是四次 ────────────────────────────────────────────────────────
 *
 * 一笔柜台交易到 2026-09-07 为止要打**四次**：开一张单 → 写几行 →
 * 出货（架上扣掉）→ 记一笔钱。**而柜台一天做两百笔**
 * （[重点 29](../../../../../docs/founder-points.md)）。
 * `scan_item` 跟 `ring_up_sale`（20260906830000 · 850000）就是那一按，
 * 而画面上一个入口都没有。
 *
 * ⚠️ **底下还是那四支** —— 单号 · 阶段 · 连到客户 · 防重复 · 分店守卫 ·
 * 卖价 · 批号先进先出 · 序号要讲哪一台 · 自动分摊，九样全部住在里面
 * （[重点 23](../../../../../docs/founder-points.md)：不准另开一条写入路径）。
 *
 * ── 🔴 找零跟总额在资料库算，不在这里算 ──────────────────────────────────
 *
 * 那一支回 `total_cents` · `change_cents` · `owed_cents`，而这一页**印它回的**。
 * 在浏览器里减一次，就是同一个问题两个答案 —— 这个仓库栽在那上面至少八次。
 * 篮子里那个「小计」是他一边扫一边要看的，所以它在这里算；
 * **而按下去之后画面上那三个数字全部换成资料库回的那一组。**
 *
 * ── 扫码是完全相符，不是开头相符 ──────────────────────────────────────────
 *
 * 扫描枪送的是一整串码。一个「开头相符」会回两件货，而那是一个
 * 停在柜台的收银员。`suggest_items` 那一支照旧开头相符 ——
 * **它是给人打字用的，不是给枪用的**。
 *
 * ── ⚠️ 一件有序号的货，这一屏卖不了 ──────────────────────────────────────
 *
 * `deliver_record` 会要他讲哪一台（[任务 211](../../../../../docs/founder-tasks.md#211)），
 * 而柜台没有地方讲。所以扫到那种货**当场讲出来并且不加进篮子** ——
 * 加进去按下去才失败，是一颗按下去一定失败的按钮。
 */

export type ScanHit = {
  itemId: string;
  name: string;
  unit: string;
  priceCents: number;
  onHand: number;
  tracksSerial: boolean;
};

type Line = {
  itemId: string;
  name: string;
  unit: string;
  priceCents: number;
  qty: number;
  onHand: number;
};

type Rang = {
  docNo: string | null;
  totalCents: number;
  paidCents: number;
  changeCents: number;
  owedCents: number;
  short: number;
  rang: boolean;
};

type Words = Record<string, string>;

const money = (cents: number) => {
  const whole = cents / 100;
  return `RM ${whole.toLocaleString("en-MY", {
    minimumFractionDigits: whole % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

export function CounterDesk({
  projectId,
  moduleKey,
  branches,
  words,
}: {
  projectId: string;
  /** 这一笔开在哪一页。柜台没有报价这一步，所以那是订单那一类。 */
  moduleKey: string;
  branches: { id: string; name: string }[];
  words: Words;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [paid, setPaid] = useState("");
  const [branchId, setBranchId] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [rang, setRang] = useState<Rang | null>(null);
  const codeBox = useRef<HTMLInputElement>(null);

  /* 篮子小计。⚠️ 这一个是他一边扫一边看的，所以在这里算；
     **按下去之后画面上印的是资料库回的那一组**，见档头。 */
  const subtotal = lines.reduce((n, l) => n + l.priceCents * l.qty, 0);

  async function scan(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim();
    if (!c || busy) return;
    setSaid(null);
    setBusy(true);
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.rpc("scan_item", {
      in_project_id: projectId,
      in_code: c,
    });
    setBusy(false);
    if (error) {
      setSaid(words.scanFailed);
      return;
    }
    const hit = (
      data as
        | {
            item_id: string;
            name: string;
            unit: string;
            price_cents: number;
            on_hand: number;
            tracks_serial: boolean;
          }[]
        | null
    )?.[0];
    if (!hit) {
      /* 🔴 讲出他刚扫的那一串 —— 一句「找不到」他没有办法拿去做事，
         而那一串正是他要拿去对包装上那个码的东西。 */
      setSaid(words.scanNone.replace("{code}", c));
      setCode("");
      codeBox.current?.focus();
      return;
    }
    if (hit.tracks_serial) {
      /* ⚠️ 见档头：柜台没有地方讲哪一台。 */
      setSaid(words.scanSerial.replace("{name}", hit.name));
      setCode("");
      codeBox.current?.focus();
      return;
    }
    setLines((prev) => {
      const at = prev.findIndex((l) => l.itemId === hit.item_id);
      /* 同一件扫两下 = 两件，不是两行 —— 柜台就是这样扫的。 */
      if (at >= 0) {
        const next = [...prev];
        next[at] = { ...next[at], qty: next[at].qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          itemId: hit.item_id,
          name: hit.name,
          unit: hit.unit ?? "",
          priceCents: Number(hit.price_cents ?? 0),
          qty: 1,
          onHand: Number(hit.on_hand ?? 0),
        },
      ];
    });
    setCode("");
    codeBox.current?.focus();
  }

  function setQty(i: number, qty: number) {
    setLines((prev) =>
      prev.map((l, n) => (n === i ? { ...l, qty: Math.max(0, qty) } : l)),
    );
  }
  function drop(i: number) {
    setLines((prev) => prev.filter((_, n) => n !== i));
  }

  async function ring() {
    if (!lines.length || busy) return;
    setSaid(null);
    setBusy(true);
    const supabase = createBrowserSupabaseClient();
    const cents = Math.round(Number(paid.replace(/[^\d.]/g, "") || "0") * 100);
    const { data, error } = await supabase.rpc("ring_up_sale", {
      in_project_id: projectId,
      in_module_key: moduleKey,
      in_lines: lines
        .filter((l) => l.qty > 0)
        .map((l) => ({
          description: l.name,
          qty: l.qty,
          unit: l.unit,
          unit_price_cents: l.priceCents,
          item_id: l.itemId,
        })),
      in_paid_cents: Number.isFinite(cents) ? cents : 0,
      in_method: "cash",
      in_branch_id: branchId || null,
      /* 🔴 柜台就是会按两下的地方。同一把钥匙 = 同一笔交易。 */
      in_idempotency_key: crypto.randomUUID(),
    });
    setBusy(false);
    if (error) {
      setSaid(`${words.ringFailed} — ${error.message}`);
      return;
    }
    const r = (
      data as
        | {
            doc_no: string | null;
            total_cents: number;
            paid_cents: number;
            change_cents: number;
            owed_cents: number;
            short: number;
            rang: boolean;
          }[]
        | null
    )?.[0];
    if (!r) {
      setSaid(words.ringFailed);
      return;
    }
    setRang({
      docNo: r.doc_no,
      totalCents: Number(r.total_cents),
      paidCents: Number(r.paid_cents),
      changeCents: Number(r.change_cents),
      owedCents: Number(r.owed_cents),
      short: Number(r.short),
      rang: !!r.rang,
    });
    setLines([]);
    setPaid("");
    router.refresh();
  }

  /* ── 结完帐那一屏 ─────────────────────────────────────────────────
     🔴 找零用整页最大的字。抄的是那 16 个专业老板端里 Square 的做法
     （[任务 107o](../../../../../docs/founder-tasks.md#107o)）：
     一屏只有一件事。收银员在客人面前读的就是那一个数字。 */
  if (rang) {
    return (
      <DeskCard>
        <div data-counter-done="" className="flex flex-col gap-4">
          <p className={deskDim}>
            {rang.rang ? words.doneNew : words.doneAgain}
            {rang.docNo ? ` · ${rang.docNo}` : ""}
          </p>
          <div>
            <div className={deskDim}>{words.change}</div>
            <div
              data-counter-change=""
              className="[font-size:var(--text-hero)] [font-variant-numeric:tabular-nums] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]"
            >
              {money(rang.changeCents)}
            </div>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 [font-size:var(--text-sm)]">
            <div>
              <dt className={deskDim}>{words.basket}</dt>
              <dd className="[font-variant-numeric:tabular-nums] text-[color:var(--color-on-canvas)]">
                {money(rang.totalCents)}
              </dd>
            </div>
            <div>
              <dt className={deskDim}>{words.taken}</dt>
              <dd className="[font-variant-numeric:tabular-nums] text-[color:var(--color-on-canvas)]">
                {money(rang.paidCents)}
              </dd>
            </div>
            {/* 🔴 付不够照样成交，然后讲出来 —— 老客户赊数是真的事，
              而挡下去他就在系统外面卖（跟额度不挡单同一条）。
              那张单自己留在「谁欠我钱」上。 */}
            {rang.owedCents > 0 ? (
              <div>
                <dt className={deskDim}>{words.owed}</dt>
                <dd className="[font-weight:var(--fw-medium)] [font-variant-numeric:tabular-nums] text-[color:var(--color-clay-bright)]">
                  {money(rang.owedCents)}
                </dd>
              </div>
            ) : null}
          </dl>
          {/* ⚠️ 架上不够照样出，然后讲出来 —— 挡下去他就绕过系统卖，
            而那一天起架上的数字是假的。 */}
          {rang.short > 0 ? (
            <p className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]">
              {words.shortShelf.replace("{n}", String(rang.short))}
            </p>
          ) : null}
          <div>
            <button
              type="button"
              className={deskBtn("primary")}
              onClick={() => {
                setRang(null);
                setTimeout(() => codeBox.current?.focus(), 0);
              }}
            >
              {words.next}
            </button>
          </div>
        </div>
      </DeskCard>
    );
  }

  return (
    <div data-counter="" className="flex flex-col gap-4">
      <DeskCard>
        <form onSubmit={scan} className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className={deskDim}>{words.scan}</span>
            <input
              ref={codeBox}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={words.scanHint}
              aria-label={words.scan}
              className={deskField}
            />
          </label>
          <button type="submit" disabled={busy} className={deskBtn()}>
            {words.add}
          </button>
        </form>
        {said ? (
          <p
            role="status"
            className="mt-2 [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
          >
            {said}
          </p>
        ) : null}
      </DeskCard>

      {/* 篮子。⚠️ 空的时候不画一张空表 —— 那一句在页面上讲过了。 */}
      {lines.length ? (
        <DeskCard>
          <ul className="flex flex-col gap-2">
            {lines.map((l, i) => (
              <li
                key={l.itemId}
                data-basket-line=""
                className="flex flex-wrap items-center gap-3"
              >
                <span className="min-w-0 flex-1 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas)]">
                  {l.name}
                  {l.unit ? ` · ${l.unit}` : ""}
                </span>
                {/* 🔴 宽度加在**外面那个框**上，不加在 input 的 class 上。
                  `deskField` 自己带着 `w-full`，而两个 width 在同一个元素上，
                  赢的是**样式表里后面**那一条，不是字串里后面那一个 ——
                  於是那一格铺满整行，一行明细断成三行。
                  这个仓库栽在同一条上两次（[任务 217] · [任务 264]）。 */}
                <span className="w-20 shrink-0">
                  <input
                    type="number"
                    min={0}
                    step="1"
                    aria-label={`${words.qty} — ${l.name}`}
                    value={l.qty}
                    onChange={(e) => setQty(i, Number(e.target.value))}
                    className={deskField}
                    data-basket-qty=""
                  />
                </span>
                <span className="w-24 text-right [font-size:var(--text-sm)] [font-variant-numeric:tabular-nums] text-[color:var(--color-on-canvas)]">
                  {money(l.priceCents * l.qty)}
                </span>
                <button
                  type="button"
                  onClick={() => drop(i)}
                  aria-label={`${words.remove} — ${l.name}`}
                  className={deskBtn("danger")}
                >
                  {words.remove}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t pt-4 [border-color:var(--color-ink-800)]">
            <div>
              <div className={deskDim}>{words.basket}</div>
              <div
                data-counter-subtotal=""
                className="[font-size:var(--text-hero)] [font-variant-numeric:tabular-nums] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]"
              >
                {money(subtotal)}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              {/* 只有两间店以上才画 —— 一个只有一个选项的下拉是假的控件。 */}
              {branches.length > 1 ? (
                <label className="flex flex-col gap-1">
                  <span className={deskDim}>{words.branch}</span>
                  <select
                    value={branchId}
                    aria-label={words.branch}
                    onChange={(e) => setBranchId(e.target.value)}
                    className={deskField}
                  >
                    <option value="">{words.branchAny}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="flex flex-col gap-1">
                <span className={deskDim}>{words.taken}</span>
                <span className="w-32 shrink-0">
                  <input
                    inputMode="decimal"
                    value={paid}
                    aria-label={words.taken}
                    onChange={(e) => setPaid(e.target.value)}
                    placeholder="0.00"
                    className={deskField}
                  />
                </span>
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={ring}
                className={deskBtn("primary")}
              >
                {busy ? words.ringing : words.ring}
              </button>
            </div>
          </div>
        </DeskCard>
      ) : (
        /* 🔴 一句话，而且**只在篮子空着的时候** —— 一张已经有东西的篮子
          底下写着「扫一样东西就开始」，是这一屏在讲一句假话。
          它本来在页面那一边，无条件画（看图才看到的）。 */
        <p className={deskDim}>{words.empty}</p>
      )}
    </div>
  );
}

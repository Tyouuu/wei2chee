"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecordFormCopy } from "../record-copy";
import { FormSection } from "./form-section";
import { ringgitOf } from "./line-editor";

/**
 * 月结对帐单 —— 他每个月要发给这个客人的那一张纸。
 *
 * ── 为什么这一段存在 ──────────────────────────────────────────────────────
 *
 * 八个行业每个月都要跟某一个人对一次帐，而今天他是把 WhatsApp 往上滚、
 * 一张一张单自己加。[任务 147] 20260905 把算术做完了，
 * 而它自己的收尾写着「**那张纸不存在** —— 这是算术，画面那一半不是我的地盘」。
 * 这一段是那张纸。
 *
 * ── 🔴 师傅那一边整段不画 ────────────────────────────────────────────────
 *
 * `party_statement` 是 security definer 而且自己 `where sees_money(...)` ——
 * 一个师傅打它拿回来的是**零行**，而零行会画成一张空的对帐单，
 * 读起来是「这个客人什么都没欠」。
 *
 * 跟旁边那一段订金余额同一条：**null = 没有问，整段不画；
 * 空 = 问过了，这个月没有来往** —— 两句话在画面上必须长得不一样。
 *
 * ── 🔴 期末余额不在这里算 ────────────────────────────────────────────────
 *
 * 那一栏是资料库跑出来的 `running_cents` 的最后一个值，
 * 而 [任务 147] 用真的客户身分验过它**跟 `party_debts` 一分钱都不差**。
 *
 * 在这里拿几行自己加一次，就是同一个问题的第二个答案 ——
 * 而这个仓库栽在那上面至少八次。
 *
 * ── 订金**不算进**期末余额 ────────────────────────────────────────────────
 *
 * [任务 147] 故意弄坏过一次，红出来是：对帐单说他欠 RM 10,000，
 * 系统说 RM 13,000。这一行的讲法本来就是两个数字：
 * 「你还欠 RM 45,500，另外你那边有 RM 3,000 的订金还没扣。」
 * 订金那一半在旁边那一段，这里不碰。
 */

type Row = {
  kind: string;
  onDate: string;
  docNo: string;
  title: string;
  chargeCents: number;
  creditCents: number;
  runningCents: number;
};

/** 这个月的第一天跟最后一天。⚠️ 用马来西亚的今天，不是伺服器的。 */
function monthEdges(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}

const thisMonth = () => {
  const now = new Date(Date.now() + 8 * 3600 * 1000); /* MYT */
  return now.toISOString().slice(0, 7);
};

export function PartyStatement({
  projectId,
  partyId,
  copy,
}: {
  projectId: string;
  partyId: string;
  copy: RecordFormCopy;
}) {
  const [month, setMonth] = useState(thisMonth);
  const [rows, setRows] = useState<Row[] | null>(null);
  /** 🔴 读不到 ≠ 没有来往。前者整段不画，后者讲一句话。 */
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const { from, to } = monthEdges(month);
    void (async () => {
      const { data, error } = await createBrowserSupabaseClient().rpc("party_statement", {
        p_project_id: projectId,
        p_party_id: partyId,
        p_from: from,
        p_to: to,
      });
      if (!alive) return;
      if (error) {
        setFailed(true);
        setRows(null);
        return;
      }
      setFailed(false);
      setRows(
        (data as Record<string, unknown>[]).map((r) => ({
          kind: String(r.kind ?? ""),
          onDate: String(r.on_date ?? ""),
          docNo: String(r.doc_no ?? ""),
          title: String(r.title ?? ""),
          chargeCents: Number(r.charge_cents ?? 0),
          creditCents: Number(r.credit_cents ?? 0),
          runningCents: Number(r.running_cents ?? 0),
        })),
      );
    })();
    return () => {
      alive = false;
    };
  }, [projectId, partyId, month]);

  /* 🔴 期末余额取最后一行的 running —— 不在这里重算（见档头） */
  const closing = rows?.length ? rows[rows.length - 1].runningCents : null;
  /* 开帐那一行不是一张单，它没有单号也没有日子可以印 */
  const moves = (rows ?? []).filter((r) => r.kind !== "opening");
  const opening = (rows ?? []).find((r) => r.kind === "opening");

  return (
    <FormSection
      title={copy.statementHeading}
      action={
        <input
          type="month"
          aria-label={copy.statementMonth}
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="ds-control h-9 [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none"
        />
      }
    >
      {failed ? (
        <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {copy.statementUnread}
        </span>
      ) : rows === null ? null : moves.length === 0 ? (
        /* 🔴 「这个月没有来往」照样要讲期初 —— 一张只写着「没有」的对帐单，
            答不了他真正问的那一句「所以他到底欠我多少」。 */
        <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)] tabular-nums">
          {copy.statementQuiet}
          {opening ? ` · ${copy.statementOpening} ${ringgitOf(opening.runningCents)}` : ""}
        </span>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse [font-size:var(--text-sm)] tabular-nums">
            <thead>
              <tr className="text-left text-[color:var(--color-on-canvas-dim)]">
                <th className="py-1 pr-3 font-normal [font-size:var(--text-xs)]">{copy.statementOn}</th>
                <th className="py-1 pr-3 font-normal [font-size:var(--text-xs)]">{copy.statementWhat}</th>
                <th className="py-1 pr-3 text-right font-normal [font-size:var(--text-xs)]">
                  {copy.statementCharge}
                </th>
                <th className="py-1 pr-3 text-right font-normal [font-size:var(--text-xs)]">
                  {copy.statementPaid}
                </th>
                <th className="py-1 text-right font-normal [font-size:var(--text-xs)]">
                  {copy.statementRunning}
                </th>
              </tr>
            </thead>
            <tbody className="text-[color:var(--color-on-canvas)]">
              {opening ? (
                <tr className="border-t [border-color:var(--color-ink-800)] text-[color:var(--color-on-canvas-dim)]">
                  <td className="py-1.5 pr-3">{opening.onDate}</td>
                  <td className="py-1.5 pr-3">{copy.statementOpening}</td>
                  <td className="py-1.5 pr-3 text-right">—</td>
                  <td className="py-1.5 pr-3 text-right">—</td>
                  <td className="py-1.5 text-right">{ringgitOf(opening.runningCents)}</td>
                </tr>
              ) : null}
              {moves.map((r, i) => (
                <tr key={i} className="border-t [border-color:var(--color-ink-800)]">
                  <td className="py-1.5 pr-3">{r.onDate}</td>
                  <td className="py-1.5 pr-3">
                    {[r.docNo, r.title].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {r.chargeCents ? ringgitOf(r.chargeCents) : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {r.creditCents ? ringgitOf(r.creditCents) : "—"}
                  </td>
                  <td className="py-1.5 text-right">{ringgitOf(r.runningCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 [border-color:var(--color-ink-700)] [font-weight:var(--fw-semibold)]">
                <td className="py-2 pr-3" colSpan={4}>
                  {copy.statementClosing}
                </td>
                <td className="py-2 text-right">{closing == null ? "—" : ringgitOf(closing)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </FormSection>
  );
}

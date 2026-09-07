"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DeskCard, deskBtn, deskDim, deskField } from "../desk-kit";

/**
 * 借出去的，跟借一样东西出去。
 *
 * ── 🔴 「借出去」几乎是白捡的：架上自己会少一件 ────────────────────────
 *
 * 填了是架上哪一件货，`lend_item` 就走**人按的那一支**
 * （[重点 23](../../../../../docs/founder-points.md)）——
 * 一件婚纱借出去，架上那一件当场变 0，所以没有人订得了第二次。
 *
 * ── ⚠️ 故意不做：按天算租金 ────────────────────────────────────────────
 *
 * 每一套租赁软件都在算「天数 × 日租」。做那件事要一张费率表 · 一套进位规则 ·
 * 週末算不算 —— 而**逾期三天要不要收钱是他的判断，不是一条公式**
 * （20260905540000）。跟额度不挡单 · 架上不够照样出货同一条：
 * **讲事实，判断留给他。**
 */

type Out = {
  id: string;
  record_id: string;
  doc_no: string | null;
  party: string | null;
  descr: string;
  qty: number;
  out_on: string;
  due_back_on: string | null;
  days_over: number;
};

type Words = Record<string, string>;

export function OutOnLoan({
  out,
  jobs,
  words,
}: {
  out: Out[];
  jobs: { id: string; label: string }[];
  words: Words;
}) {
  const router = useRouter();
  const dim = deskDim;
  const btn = deskBtn();
  const field = deskField;

  const [rows, setRows] = useState(out);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<Record<string, string>>({});

  /* 一趟东西挂在一张单上，而那张单答得出「在谁那里」——
     所以分组的键是那张单，显示的是那张单上的人。 */
  const groups = (() => {
    const by = new Map<
      string,
      { key: string; who: string; doc: string | null; items: Out[] }
    >();
    for (const r of rows) {
      const key = r.record_id;
      if (!by.has(key))
        by.set(key, {
          key,
          who: r.party || words.someone,
          doc: r.doc_no,
          items: [],
        });
      by.get(key)!.items.push(r);
    }
    return [...by.values()];
  })();
  const late = rows.filter((r) => r.days_over > 0).length;

  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [what, setWhat] = useState("");
  const [qty, setQty] = useState("1");
  const [due, setDue] = useState("");

  async function back(r: Out) {
    if (busy) return;
    setBusy(r.id);
    const before = rows;
    /* 当场从清单上拿掉 —— 柜台上东西已经回到架子上了。 */
    setRows((v) => v.filter((x) => x.id !== r.id));
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("return_rental", {
        in_rental_id: r.id,
      });
      if (error) throw error;
      router.refresh();
    } catch {
      /* 🔴 收不了就放回去 —— 一行看起来还回来了而资料库里还借着的，
         比一行报错的糟得多。 */
      setRows(before);
      setSaid((s) => ({ ...s, [r.id]: words.failed }));
    } finally {
      setBusy(null);
    }
  }

  async function lend() {
    if (busy) return;
    if (!what.trim()) {
      setSaid((s) => ({ ...s, form: words.needWhat }));
      return;
    }
    setBusy("form");
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("lend_item", {
        in_record_id: jobId,
        in_descr: what.trim(),
        in_qty: Number(qty || 1),
        /* ⚠️ 空的归还日存的是「没有」—— 一个凭空写上去的日子，
           明天就会让这一行变成「逾期」。 */
        in_due_back_on: due || null,
      });
      if (error) {
        setSaid((s) => ({ ...s, form: words.failed }));
        return;
      }
      setSaid((s) => ({ ...s, form: words.lent }));
      setWhat("");
      setQty("1");
      router.refresh();
    } catch {
      setSaid((s) => ({ ...s, form: words.failed }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {/* 🔴 **按「在谁那里」分组，不是一串平的行。**

          老板：「我不要一直都是相同的组件」。而这一页问的是
          **「什么在外面、在谁那里」** —— 一串平的行答得了前半句，
          答不了后半句：他要打一通电话，而电话是打给**一个人**，
          不是打给一件东西。

          骨架抄的是他挑的那一套的 `infrastructure`（顶上一排摘要，
          底下一组一张表）。[任务 195] 想在对帐那一页用它，
          而对帐那一边**没有一栏可以分组** —— 这一页有。 */}
      <DeskCard title={words.outLabel}>
        <p className={`mb-4 ${dim}`}>
          {rows.length ? words.outLede : words.outNone}
        </p>

        {rows.length > 0 && (
          <>
            {/* 顶上一排摘要 —— 他站在柜台前先问的是这两个数。 */}
            <div className="mb-5 flex flex-wrap gap-2">
              <Pill>{words.pieces.replace("%n", String(rows.length))}</Pill>
              {late > 0 && (
                <Pill tone="late">
                  {words.lateCount.replace("%n", String(late))}
                </Pill>
              )}
              <Pill>{words.people.replace("%n", String(groups.length))}</Pill>
            </div>

            <div className="flex flex-col gap-6">
              {groups.map((g) => (
                <div key={g.key}>
                  <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
                    <span className="[font-weight:var(--fw-semibold)]">
                      {g.who}
                    </span>
                    {g.doc && (
                      <span className={`tabular-nums ${dim}`}>{g.doc}</span>
                    )}
                  </div>
                  <ul className="flex flex-col">
                    {g.items.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t py-3 [border-color:var(--color-ink-800)]"
                      >
                        <span>{r.descr}</span>
                        <span className={`tabular-nums ${dim}`}>×{r.qty}</span>
                        <span className="min-w-0 flex-1" />
                        {/* 🔴 逾期几天讲出来，收不收钱是他的判断 —— 见档头。 */}
                        {r.days_over > 0 ? (
                          <span className="tabular-nums [font-size:var(--text-sm)] text-[color:var(--color-clay-bright)]">
                            {words.overdue.replace("%n", String(r.days_over))}
                          </span>
                        ) : (
                          <span className={`tabular-nums ${dim}`}>
                            {r.due_back_on
                              ? `${words.dueBack} ${r.due_back_on}`
                              : words.noDueDate}
                          </span>
                        )}
                        <button
                          type="button"
                          disabled={busy === r.id}
                          onClick={() => back(r)}
                          className={btn}
                        >
                          {busy === r.id ? words.returning : words.back}
                        </button>
                        {said[r.id] && (
                          <span aria-live="polite" className={dim}>
                            {said[r.id]}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </DeskCard>

      <div className="h-5" />

      <DeskCard title={words.lendLabel}>
        <p className={`mb-4 ${dim}`}>{words.lendLede}</p>
        {/* 🔴 一张单都没有就不画那几格 —— 借出去的东西挂在一张单上，
            而一个挑不到单的表单是一颗按不动的按钮。 */}
        {jobs.length === 0 ? (
          <p className={dim}>{words.noJobs}</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_7rem_10rem_auto] md:items-end">
              <label className="grid gap-1">
                <span className={dim}>{words.onJob}</span>
                <select
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className={field}
                >
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className={dim}>{words.what}</span>
                <input
                  value={what}
                  onChange={(e) => setWhat(e.target.value)}
                  placeholder={words.whatPlaceholder}
                  className={field}
                />
              </label>
              <label className="grid gap-1">
                <span className={dim}>{words.howMany}</span>
                <input
                  value={qty}
                  inputMode="decimal"
                  onChange={(e) =>
                    setQty(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  className={`${field} text-right tabular-nums`}
                />
              </label>
              <label className="grid gap-1">
                <span className={dim}>{words.dueOn}</span>
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className={`${field} tabular-nums`}
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busy === "form"}
                  onClick={lend}
                  className={deskBtn("primary")}
                >
                  {busy === "form" ? words.lending : words.lend}
                </button>
                {said.form && (
                  <span aria-live="polite" className={dim}>
                    {said.form}
                  </span>
                )}
              </div>
            </div>
            <p className={`mt-3 ${dim}`}>{words.depositNote}</p>
          </>
        )}
      </DeskCard>
    </>
  );
}

/** 顶上那一排摘要。参考页的 `infrastructure` 用它把一整页压成三个数。 */
function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "late";
}) {
  return (
    <span
      className={`inline-flex items-center [border-radius:999px] [border:var(--hairline)_solid_var(--color-ink-800)] px-3 py-1 [font-size:var(--text-sm)] tabular-nums ${
        tone === "late"
          ? "[border-color:var(--color-clay-bright)] text-[color:var(--color-clay-bright)]"
          : ""
      }`}
    >
      {children}
    </span>
  );
}

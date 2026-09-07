"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ringgit } from "@/lib/portal/live-rows";
import { DeskCard, DeskSheet, deskBtn, deskDim, deskField } from "../desk-kit";

/**
 * 开一次薪水，改几笔，发出去。
 *
 * ── 🔴 他打的只有「收入」那几笔 ────────────────────────────────────────
 *
 * 公积金 · 社险 · 就业保险**不给打** —— 那几笔是
 * `recompute_payslip_statutory` 照法律表算的，而**一个打得进去的法定扣款
 * 就是一个算错的法定扣款**：他会照自己记得的数字打，而那几张表一年会改。
 * 所以这一页上「扣了多少」是印出来的，不是一个框。
 *
 * ── 发出去之后整张锁住 ──────────────────────────────────────────────────
 *
 * 跟收过货的进货单同一条：**钱已经到工人手上了，改那张纸不会把它变回来**
 * （20260904220000）。所以发出去之后这一页只印不改 ——
 * 而资料库那一边也会抛，两边讲同一句话。
 */

type Slip = {
  id: string;
  name: string;
  gross: number;
  deduction: number;
  employer: number;
  net: number;
  earnings: { label: string; amount: number }[];
  taken: { label: string; amount: number }[];
};

type Run = {
  id: string;
  period_from: string;
  period_to: string;
  paid_at: string | null;
};

type Words = Record<string, string>;

const rm = (cents: number) => ringgit(cents) ?? "RM 0";

type Person = {
  id: string;
  name: string;
  basis: string;
  rate: number;
  hasTerms: boolean;
  epfPart: string;
  socsoPart: string;
  eisPart: string;
};

export function PayDesk({
  projectId,
  run,
  suggested,
  slips,
  staff,
  law,
  lawReady,
  words,
}: {
  projectId: string;
  run: Run | null;
  suggested: { from: string; to: string };
  slips: Slip[];
  staff: Person[];
  /** 哪一个计划有哪几个类别 —— **从那几张表里读出来的**。 */
  law: Record<string, string[]>;
  lawReady: boolean;
  words: Words;
}) {
  const router = useRouter();
  const dim = deskDim;
  const btn = deskBtn();
  const field = deskField;

  const withTerms = staff.filter((s) => s.hasTerms).length;

  return (
    <>
      {run ? (
        <OpenRun
          run={run}
          slips={slips}
          lawReady={lawReady}
          words={words}
          dim={dim}
          btn={btn}
          field={field}
          onChanged={() => router.refresh()}
        />
      ) : (
        <NoRun
          projectId={projectId}
          suggested={suggested}
          canOpen={withTerms > 0}
          staffCount={staff.length}
          words={words}
          dim={dim}
          btn={btn}
          field={field}
          onOpened={() => router.refresh()}
        />
      )}

      <div className="h-5" />

      <PayTerms
        staff={staff}
        law={law}
        lawReady={lawReady}
        words={words}
        dim={dim}
        btn={btn}
        field={field}
      />
    </>
  );
}

/** 还没开的时候：一个窗口跟一颗按钮。 */
function NoRun({
  projectId,
  suggested,
  canOpen,
  staffCount,
  words,
  dim,
  btn,
  field,
  onOpened,
}: {
  projectId: string;
  suggested: { from: string; to: string };
  canOpen: boolean;
  staffCount: number;
  words: Words;
  dim: string;
  btn: string;
  field: string;
  onOpened: () => void;
}) {
  const [from, setFrom] = useState(suggested.from);
  const [to, setTo] = useState(suggested.to);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");

  async function open() {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("open_pay_run", {
        in_project_id: projectId,
        in_period_from: from,
        in_period_to: to,
      });
      if (error) {
        setSaid(words.failed);
        return;
      }
      onOpened();
    } catch {
      setSaid(words.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DeskCard title={words.runLabel}>
      <p className={`mb-4 ${dim}`}>{words.noRun}</p>
      {/* 🔴 一个人都没有底薪的时候，开出来的是一张**空的**薪水单
          （`open_pay_run` 是照 `staff_pay_terms` 长出每一行的）——
          所以不画那颗按钮，改成讲出要先做哪一件。 */}
      {!canOpen ? (
        <p className={dim}>
          {staffCount === 0 ? words.noStaff : words.noTerms}
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1">
            <span className={dim}>{words.from}</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={`${field} tabular-nums`}
            />
          </label>
          <label className="grid gap-1">
            <span className={dim}>{words.to}</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={`${field} tabular-nums`}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={open}
            className={deskBtn("primary")}
          >
            {busy ? words.opening : words.open}
          </button>
          {said && (
            <span aria-live="polite" className={dim}>
              {said}
            </span>
          )}
        </div>
      )}
    </DeskCard>
  );
}

/**
 * 开着的那一张 —— 左边改，右边看。
 *
 * ── 骨架抄的是 `invoice` 那一页 ────────────────────────────────────────
 *
 * 他挑的那一套（arhamkhnz）的开发票页是**两张卡并排**：左边填，右边一张
 * 叫 Preview 的卡，里面是一张浮在灰垫子上的纸，卡头右边是 Print / PDF。
 *
 * 🔴 而这不是为了好看。**一张薪资单是要拿给工人的东西** ——
 * 我第一版把它画成一串可以打字的行，於是他按「发出去」之前，
 * 整个画面上没有任何一个东西长得像那张纸。
 *
 * ⚠️ 右边那一张跟着**左边选中的那个人**走 —— 一个只能预览第一个人的
 * 预览，在第二个人身上就是一句没有用的真话。
 */
function OpenRun({
  run,
  slips,
  lawReady,
  words,
  dim,
  btn,
  field,
  onChanged,
}: {
  run: Run;
  slips: Slip[];
  lawReady: boolean;
  words: Words;
  dim: string;
  btn: string;
  field: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState(slips[0]?.id ?? "");
  const [draft, setDraft] = useState<
    Record<string, { label: string; amount: string }[]>
  >(() =>
    Object.fromEntries(
      slips.map((s) => [
        s.id,
        s.earnings.map((e) => ({
          label: e.label,
          amount: String(Math.round(e.amount / 100)),
        })),
      ]),
    ),
  );

  const totalNet = slips.reduce((n, s) => n + s.net, 0);
  /* 🔴 他真正掏出去的是**实发加雇主那一份** —— 一个只看实发的老板，
     会少算掉公积金雇主的 12–13%，而那笔钱一样从他的户口出去。 */
  const totalCost = slips.reduce(
    (n, s) => n + s.net + s.deduction + s.employer,
    0,
  );
  const sheet = slips.find((s) => s.id === picked) ?? slips[0] ?? null;

  async function saveLines(slipId: string) {
    if (busy) return;
    setBusy(slipId);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("set_payslip_earnings", {
        in_payslip_id: slipId,
        in_lines: (draft[slipId] ?? [])
          .filter((l) => l.label.trim() || Number(l.amount) > 0)
          .map((l) => ({
            label: l.label.trim(),
            amount_cents: Math.round(Number(l.amount || 0) * 100),
          })),
      });
      if (error) {
        setSaid((s) => ({ ...s, [slipId]: words.failed }));
        return;
      }
      setSaid((s) => ({ ...s, [slipId]: words.saved }));
      /* 存进去之后法定那几笔会重算 —— 所以要把伺服器那一份读回来，
         不然「扣了多少」还是旧的数字。 */
      onChanged();
    } catch {
      setSaid((s) => ({ ...s, [slipId]: words.failed }));
    } finally {
      setBusy(null);
    }
  }

  async function run_(fn: "pay_pay_run" | "discard_pay_run") {
    if (busy) return;
    setBusy("run");
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc(fn, { in_run_id: run.id });
      if (error) {
        setSaid((s) => ({ ...s, run: words.failed }));
        return;
      }
      onChanged();
    } catch {
      setSaid((s) => ({ ...s, run: words.failed }));
    } finally {
      setBusy(null);
    }
  }

  if (slips.length === 0) {
    return (
      <DeskCard title={words.runLabel}>
        <p className={dim}>{words.noTerms}</p>
      </DeskCard>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {/* ── 左：这一次的薪水 ─────────────────────────────────────────── */}
      <DeskCard
        title={words.runLabel}
        action={
          <span className={`tabular-nums ${dim}`}>
            {run.period_from} — {run.period_to}
          </span>
        }
      >
        <p className={`mb-4 ${dim}`}>{words.runLede}</p>
        {/* 🔴 法律那几张表还没有人核对过的时候，这一页会把每一张单
            画成一分法定扣款都没有 —— 而那跟「刚好是零」在画面上一模一样。 */}
        {!lawReady && (
          <p className="mb-4 [font-size:var(--text-sm)] text-[color:var(--color-clay-bright)]">
            {words.noLaw}
          </p>
        )}

        <ul className="flex flex-col">
          {slips.map((s) => {
            const open = s.id === picked;
            return (
              <li
                key={s.id}
                className="border-t py-4 [border-color:var(--color-ink-800)]"
              >
                {/* 整行按得到 —— 柜台上拇指按不准一句字里的那几个字。 */}
                <button
                  type="button"
                  onClick={() => setPicked(s.id)}
                  className="flex w-full flex-wrap items-baseline gap-x-4 gap-y-1 text-left"
                >
                  <span
                    className={`[font-weight:var(--fw-semibold)] ${
                      open ? "" : "text-[color:var(--color-on-canvas-dim)]"
                    }`}
                  >
                    {s.name}
                  </span>
                  <span className="min-w-0 flex-1" />
                  <span className={dim}>{words.takesHome}</span>
                  <span className="tabular-nums [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
                    {rm(s.net)}
                  </span>
                </button>

                {/* 只摊开选中那一个 —— 五个人五张表单，一屏读不完。 */}
                {open && (
                  <div className="mt-3 flex flex-col gap-2">
                    {(draft[s.id] ?? []).map((l, i) => (
                      <div
                        key={i}
                        className="grid gap-2 sm:grid-cols-[1fr_9rem]"
                      >
                        <input
                          value={l.label}
                          placeholder={words.lineLabel}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              [s.id]: (d[s.id] ?? []).map((x, j) =>
                                j === i ? { ...x, label: e.target.value } : x,
                              ),
                            }))
                          }
                          className={field}
                          aria-label={words.lineLabel}
                        />
                        <input
                          value={l.amount}
                          inputMode="decimal"
                          placeholder={words.lineAmount}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              [s.id]: (d[s.id] ?? []).map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      amount: e.target.value.replace(
                                        /[^0-9.]/g,
                                        "",
                                      ),
                                    }
                                  : x,
                              ),
                            }))
                          }
                          className={`${field} text-right tabular-nums`}
                          aria-label={words.lineAmount}
                        />
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            [s.id]: [
                              ...(d[s.id] ?? []),
                              { label: "", amount: "" },
                            ],
                          }))
                        }
                        className={btn}
                      >
                        {words.addLine}
                      </button>
                      <button
                        type="button"
                        disabled={busy === s.id}
                        onClick={() => saveLines(s.id)}
                        className={btn}
                      >
                        {busy === s.id ? words.saving : words.save}
                      </button>
                      {said[s.id] && (
                        <span aria-live="polite" className={dim}>
                          {said[s.id]}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-4 border-t pt-5 [border-color:var(--color-ink-700)]">
          <div>
            <div className={dim}>{words.totalNet}</div>
            <div className="mt-0.5 tabular-nums [font-size:var(--text-stat)] [font-weight:var(--fw-semibold)]">
              {rm(totalNet)}
            </div>
          </div>
          <div>
            <div className={dim}>{words.totalCost}</div>
            <div className="mt-0.5 tabular-nums [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
              {rm(totalCost)}
            </div>
          </div>
          <span className="min-w-0 flex-1" />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy === "run"}
              onClick={() => run_("discard_pay_run")}
              className={deskBtn("danger")}
            >
              {words.discard}
            </button>
            <button
              type="button"
              disabled={busy === "run"}
              onClick={() => run_("pay_pay_run")}
              className={deskBtn("primary")}
            >
              {busy === "run" ? words.paying : words.payIt}
            </button>
            {said.run && (
              <span aria-live="polite" className={dim}>
                {said.run}
              </span>
            )}
          </div>
        </div>
        <p className={`mt-4 ${dim}`}>
          {words.payHint} {words.discardHint}
        </p>
      </DeskCard>

      {/* ── 右：那一张纸 ─────────────────────────────────────────────── */}
      <DeskCard title={words.slipLabel} className="self-start">
        {sheet ? (
          <DeskSheet>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="[font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
                {sheet.name}
              </span>
              <span className={`tabular-nums ${dim}`}>
                {run.period_from} — {run.period_to}
              </span>
            </div>

            <dl className="mt-6 flex flex-col">
              {sheet.earnings.map((e, i) => (
                <Line
                  key={`e${i}`}
                  label={e.label || words.lineLabel}
                  value={rm(e.amount)}
                />
              ))}
              {sheet.earnings.length === 0 && (
                <Line label={words.earns} value={rm(sheet.gross)} />
              )}
              {sheet.taken.map((d, i) => (
                <Line
                  key={`d${i}`}
                  label={d.label}
                  value={`− ${rm(d.amount)}`}
                  dim
                />
              ))}
            </dl>

            <div className="mt-5 flex flex-wrap items-baseline justify-between gap-3 border-t pt-4 [border-color:var(--color-ink-700)]">
              <span className="[font-weight:var(--fw-semibold)]">
                {words.takesHome}
              </span>
              <span className="tabular-nums [font-size:var(--text-stat)] [font-weight:var(--fw-semibold)]">
                {rm(sheet.net)}
              </span>
            </div>
            {sheet.employer > 0 && (
              <p className={`mt-3 tabular-nums ${dim}`}>
                {words.youAlsoPay} {rm(sheet.employer)}
              </p>
            )}
            {/* ⚠️ 那几笔法定的从哪来，印在纸上 —— 一个跟他自己算的对不上的
                扣款，读起来像我们算错了。 */}
            {sheet.taken.length > 0 && (
              <p className={`mt-1 ${dim}`}>{words.byLaw}</p>
            )}
          </DeskSheet>
        ) : (
          <p className={dim}>{words.noTerms}</p>
        )}
      </DeskCard>
    </div>
  );
}

/** 那张纸上的一行。 */
function Line({
  label,
  value,
  dim,
}: {
  label: string;
  value: string;
  dim?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-t py-2 [border-color:var(--color-ink-800)]">
      <dt className={dim ? deskDim : "[font-size:var(--text-sm)]"}>{label}</dt>
      <dd
        className={`tabular-nums [font-size:var(--text-sm)] ${dim ? deskDim : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

/** 每个人的底薪。一年动一两次，所以排最后。 */
function PayTerms({
  staff,
  law,
  lawReady,
  words,
  dim,
  btn,
  field,
}: {
  staff: Person[];
  law: Record<string, string[]>;
  lawReady: boolean;
  words: Words;
  dim: string;
  btn: string;
  field: string;
}) {
  const [rows, setRows] = useState(() =>
    staff.map((s) => ({
      ...s,
      rateText: s.rate ? String(Math.round(s.rate / 100)) : "",
    })),
  );
  const schemes: [string, string][] = [
    ["epf", words.epf],
    ["socso", words.socso],
    ["eis", words.eis],
  ];
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<Record<string, string>>({});

  async function save(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row || busy) return;
    setBusy(id);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("set_staff_pay_terms", {
        in_staff_id: id,
        in_basis: row.basis,
        in_rate_cents: Math.round(Number(row.rateText || 0) * 100),
        /* ⚠️ 空的存的是 **null = 不适用**，而那是一个真的答案，
           不是漏填（工地上一半是分包出去的师傅，那些人自己缴）。 */
        in_epf_part: row.epfPart || null,
        in_socso_part: row.socsoPart || null,
        in_eis_part: row.eisPart || null,
      });
      setSaid((s) => ({ ...s, [id]: error ? words.failed : words.saved }));
    } catch {
      setSaid((s) => ({ ...s, [id]: words.failed }));
    } finally {
      setBusy(null);
    }
  }

  if (staff.length === 0) {
    return (
      <DeskCard title={words.termsLabel}>
        <p className={dim}>{words.noStaff}</p>
      </DeskCard>
    );
  }

  return (
    <DeskCard title={words.termsLabel}>
      <p className={`mb-4 ${dim}`}>{words.termsLede}</p>
      <div className="flex flex-col">
        {rows.map((r) => (
          <div
            key={r.id}
            className="grid items-center gap-3 border-t py-3 [border-color:var(--color-ink-800)] md:grid-cols-[1fr_8rem_8rem_auto]"
          >
            <span>{r.name}</span>
            <select
              value={r.basis}
              onChange={(e) =>
                setRows((v) =>
                  v.map((x) =>
                    x.id === r.id ? { ...x, basis: e.target.value } : x,
                  ),
                )
              }
              className={field}
              aria-label={words.basis}
            >
              <option value="monthly">{words.monthly}</option>
              <option value="daily">{words.daily}</option>
              <option value="hourly">{words.hourly}</option>
            </select>
            <input
              value={r.rateText}
              inputMode="decimal"
              placeholder={words.rate}
              onChange={(e) =>
                setRows((v) =>
                  v.map((x) =>
                    x.id === r.id
                      ? {
                          ...x,
                          rateText: e.target.value.replace(/[^0-9.]/g, ""),
                        }
                      : x,
                  ),
                )
              }
              className={`${field} text-right tabular-nums`}
              aria-label={words.rate}
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => save(r.id)}
                className={btn}
              >
                {busy === r.id ? words.saving : words.save}
              </button>
              {said[r.id] && (
                <span aria-live="polite" className={dim}>
                  {said[r.id]}
                </span>
              )}
            </div>
            {/* 公积金 · 社险 · 就业保险各自的类别。

                🔴 那几个选项**从那几张法律表里读**，不在这里手写一份 ——
                手写的那一份会活得比它描述的东西久。
                表是空的时候整段不画 —— 一个挑不到东西的下拉是一颗按不动的按钮。 */}
            {lawReady && (
              <div className="col-span-full flex flex-wrap gap-3">
                {schemes.map(([scheme, label]) =>
                  (law[scheme] ?? []).length ? (
                    <label key={scheme} className="flex items-center gap-2">
                      <span className={dim}>{label}</span>
                      <select
                        value={
                          scheme === "epf"
                            ? r.epfPart
                            : scheme === "socso"
                              ? r.socsoPart
                              : r.eisPart
                        }
                        onChange={(e) =>
                          setRows((v) =>
                            v.map((x) =>
                              x.id === r.id
                                ? {
                                    ...x,
                                    ...(scheme === "epf"
                                      ? { epfPart: e.target.value }
                                      : scheme === "socso"
                                        ? { socsoPart: e.target.value }
                                        : { eisPart: e.target.value }),
                                  }
                                : x,
                            ),
                          )
                        }
                        className={`${field} w-auto`}
                      >
                        <option value="">{words.notApplicable}</option>
                        {(law[scheme] ?? []).map((part) => (
                          <option key={part} value={part}>
                            {part}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null,
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </DeskCard>
  );
}

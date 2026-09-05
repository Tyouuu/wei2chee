"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Section } from "../section";

/**
 * 这一轮要去哪几家，跟签一份新的。
 *
 * ── 🔴 那一行上只有两颗按钮，因为门口只有两个答案 ───────────────────────
 *
 * 「来过了」跟「没做成」。**其余每一件事都是那两颗的后果** ——
 * 单号 · 阶段 · 连到这个客户 · 连到那个工地，全部住在
 * `add_pipeline_record` 里面，而 `log_service_visit` 打的就是它
 * （[重点 23](../../../../../docs/founder-points.md)：AI 跟人走同一支）。
 *
 * ── 按下去当场变，不等伺服器 ────────────────────────────────────────────
 *
 * 一颗按了三秒没反应的按钮，在门口就是被按第二次的那一颗。
 * 🔴 而**改不了就把画面放回去** —— 一颗看起来成功而资料库里没变的按钮，
 * 比一颗报错的糟得多：他会以为记下来了。
 *
 * ⚠️ 按两下不会开第二张单，那是资料库挡的（`log_service_visit` 查到
 * 已经记过就把第一笔还回来），不是这里挡的。
 */

type Due = {
  contract_id: string;
  party_id: string | null;
  party: string;
  title: string;
  due_on: string;
  every_months: number;
  status: string | null;
  overdue: boolean;
  record_id: string | null;
  done_on: string | null;
};

type Ending = {
  contract_id: string;
  party_id: string | null;
  party: string;
  title: string;
  ends_on: string;
  days_left: number;
  visits_done: number;
};

type Words = Record<string, string>;

/** 🔴 **还没记过的那一次，`status` 是 `'due'`，不是 null。**
 *
 *  `due_visits` 回的是 `coalesce(v.status, 'due')`（20260905220000）——
 *  而我第一版拿 `d.status` 当真假用，於是**每一次到期都被画成「已经记过了」**：
 *  门口那两颗按钮变成了「没做成」跟「记错了」，而「来过了」根本不出现。
 *  一张图就看到了，而尺子当时报的是「画面上没有那颗按钮」。 */
const logged = (d: Due) => d.status === "done" || d.status === "skip";

/** 一份合约的一次到期，是「哪一份 × 哪一天」—— 那也正好是资料库那条
 *  唯一索引的键，所以画面跟资料库讲的是同一件事。 */
const keyOf = (d: Due) => `${d.contract_id}|${d.due_on}`;

export function ServiceRound({
  projectId,
  locale,
  due,
  ending,
  parties,
  jobPages,
  words,
}: {
  projectId: string;
  locale: string;
  due: Due[];
  ending: Ending[];
  parties: { id: string; name: string }[];
  jobPages: { key: string; label: string }[];
  words: Words;
}) {
  const [rows, setRows] = useState(due);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<Record<string, string>>({});
  const [makeJobIn, setMakeJobIn] = useState<string>(jobPages[0]?.key ?? "");

  async function log(d: Due, status: "done" | "skip") {
    const k = keyOf(d);
    if (busy) return;
    setBusy(k);
    const before = rows;
    /* 当场变。 */
    setRows((v) =>
      v.map((r) =>
        keyOf(r) === k
          ? {
              ...r,
              status,
              done_on: status === "done" ? new Date().toISOString().slice(0, 10) : null,
            }
          : r,
      ),
    );
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("log_service_visit", {
        in_contract_id: d.contract_id,
        in_due_on: d.due_on,
        in_status: status,
        /* 只有「来过了」才开单，而且只在他挑了一页的时候。
           一次没做成的上门不该在他的簿子上留下一张单。 */
        in_make_job_in: status === "done" && makeJobIn ? makeJobIn : null,
      });
      if (error) throw error;
      const made = (Array.isArray(data) ? data[0] : data) as { record_id?: string | null } | null;
      setRows((v) =>
        v.map((r) => (keyOf(r) === k ? { ...r, record_id: made?.record_id ?? r.record_id } : r)),
      );
    } catch {
      /* 🔴 放回去 —— 见档头。 */
      setRows(before);
      setSaid((s) => ({ ...s, [k]: words.failed }));
    } finally {
      setBusy(null);
    }
  }

  async function undo(d: Due) {
    const k = keyOf(d);
    if (busy) return;
    setBusy(k);
    const before = rows;
    /* 撤销之后回到「还没记过」，而那个字是 `'due'` 不是 null。 */
    setRows((v) => v.map((r) => (keyOf(r) === k ? { ...r, status: "due", done_on: null } : r)));
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("undo_service_visit", {
        in_contract_id: d.contract_id,
        in_due_on: d.due_on,
      });
      if (error) throw error;
      /* ⚠️ 开出来的那张单**不会跟着消失** —— 单号发出去了，而一张凭空
         消失的单在他的簿子上是一个洞（20260905220000）。所以那条连结留着。 */
    } catch {
      setRows(before);
      setSaid((s) => ({ ...s, [k]: words.failed }));
    } finally {
      setBusy(null);
    }
  }

  const dim = "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";
  const btn =
    "inline-flex min-h-11 items-center justify-center [background-color:var(--color-ink-900)] [border-radius:var(--radius-control)] [border:var(--hairline)_solid_var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-sm)] [padding-inline:calc(var(--pad-control-x)*1.1)] disabled:opacity-60";

  return (
    <>
      <Section label={words.roundLabel} count={rows.length || undefined}>
        <p className={`mb-4 ${dim}`}>{rows.length ? words.roundLede : words.roundNone}</p>
        {rows.length > 0 && (
          <ul className="flex flex-col">
            {rows.map((d) => {
              const k = keyOf(d);
              return (
                <li
                  key={k}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t py-3 [border-color:var(--color-ink-800)]"
                >
                  <span className="tabular-nums [font-size:var(--text-sm)]">{d.due_on}</span>
                  <span className="[font-weight:var(--fw-semibold)]">{d.party}</span>
                  {d.title && <span className={dim}>{d.title}</span>}
                  {/* 逾期讲出来。⚠️ 只有还没做的才算逾期 —— 一次做完的上门
                      不管当初迟了多久，都不再是一件要追的事。 */}
                  {d.overdue && !logged(d) && (
                    <span className="[font-size:var(--text-sm)] text-[color:var(--color-clay-bright)]">
                      {words.overdue}
                    </span>
                  )}
                  <span className="min-w-0 flex-1" />
                  {logged(d) ? (
                    <>
                      <span className={dim}>
                        {d.status === "done" ? words.wasDone : words.wasSkipped}
                      </span>
                      {d.record_id && jobPages.length > 0 && (
                        <a
                          href={`/${locale}/portal/${jobPages[0].key}/${d.record_id}`}
                          className="[font-size:var(--text-sm)] underline"
                        >
                          {words.openJob}
                        </a>
                      )}
                      <button
                        type="button"
                        disabled={busy === k}
                        onClick={() => undo(d)}
                        className={btn}
                      >
                        {words.undo}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy === k}
                        onClick={() => log(d, "done")}
                        className={btn}
                      >
                        {words.done}
                      </button>
                      <button
                        type="button"
                        disabled={busy === k}
                        onClick={() => log(d, "skip")}
                        className={btn}
                      >
                        {words.skip}
                      </button>
                    </>
                  )}
                  {said[k] && (
                    <span aria-live="polite" className={dim}>
                      {said[k]}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {/* 「顺手开一张单」开在哪。⚠️ 一页都没有的时候整段不画 ——
            那时候那颗按钮开不出任何东西，而 `log_service_visit` 会抛。 */}
        {rows.length > 0 && jobPages.length > 0 && (
          <label className={`mt-4 flex flex-wrap items-center gap-3 ${dim}`}>
            {words.makeJob}
            <select
              value={makeJobIn}
              onChange={(e) => setMakeJobIn(e.target.value)}
              className="min-h-11 [background-color:var(--color-ink-950)] [border-radius:var(--radius-control)] [border:var(--hairline)_solid_var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-sm)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)]"
            >
              {jobPages.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
              <option value="">{words.noJob}</option>
            </select>
          </label>
        )}
      </Section>

      {ending.length > 0 && (
        <Section label={words.endingLabel} count={ending.length}>
          <p className={`mb-4 ${dim}`}>{words.endingLede}</p>
          <ul className="flex flex-col">
            {ending.map((e) => (
              <li
                key={e.contract_id}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t py-3 [border-color:var(--color-ink-800)]"
              >
                <span className="[font-weight:var(--fw-semibold)]">{e.party}</span>
                {e.title && <span className={dim}>{e.title}</span>}
                <span className="min-w-0 flex-1" />
                <span className={dim}>{words.visitsDone.replace("{n}", String(e.visits_done))}</span>
                {/* 🔴 已经过期的排在最前面（资料库排的），而它读起来要
                    跟「还有几天」不一样 —— 那是他今天就该打的那一通。 */}
                <span
                  className={`tabular-nums [font-size:var(--text-sm)] ${
                    e.days_left < 0 ? "text-[color:var(--color-clay-bright)]" : ""
                  }`}
                >
                  {e.days_left < 0
                    ? words.endedAgo.replace("{n}", String(Math.abs(e.days_left)))
                    : words.daysLeft.replace("{n}", String(e.days_left))}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <NewContract projectId={projectId} parties={parties} words={words} btn={btn} dim={dim} />
    </>
  );
}

/** 签一份新的。⚠️ **没有客户就不画那几格** —— 一份合约要有一个人，
 *  而一个挑不到人的表单是一颗按不动的按钮。 */
function NewContract({
  projectId,
  parties,
  words,
  btn,
  dim,
}: {
  projectId: string;
  parties: { id: string; name: string }[];
  words: Words;
  btn: string;
  dim: string;
}) {
  const [partyId, setPartyId] = useState("");
  const [title, setTitle] = useState("");
  const [every, setEvery] = useState("6");
  const [startsOn, setStartsOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [endsOn, setEndsOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");

  const field =
    "min-h-11 w-full [background-color:var(--color-ink-950)] [border-radius:var(--radius-control)] [border:var(--hairline)_solid_var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-sm)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)]";

  async function sign() {
    if (busy) return;
    if (!partyId) {
      setSaid(words.pickWho);
      return;
    }
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("add_service_contract", {
        in_project_id: projectId,
        in_party_id: partyId,
        in_title: title.trim(),
        in_every_months: Number(every) || 6,
        in_starts_on: startsOn || null,
        /* ⚠️ 空的到期日存的是「没有」，不是今天 —— 一份没有写到期日的
           合约是一直续着的，而那跟「今天到期」是相反的意思。 */
        in_ends_on: endsOn || null,
      });
      setSaid(error ? words.failed : words.signed);
      if (!error) {
        setTitle("");
        setPartyId("");
      }
    } catch {
      setSaid(words.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section label={words.newLabel}>
      <p className={`mb-4 ${dim}`}>{words.newLede}</p>
      {parties.length === 0 ? (
        <p className={dim}>{words.noCustomers}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_7rem_9rem_9rem_auto] md:items-end">
          <label className="grid gap-1">
            <span className={dim}>{words.who}</span>
            <select value={partyId} onChange={(e) => setPartyId(e.target.value)} className={field}>
              <option value="">{words.pickWho}</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className={dim}>{words.what}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={words.whatPlaceholder}
              className={field}
            />
          </label>
          <label className="grid gap-1">
            <span className={dim}>{words.everyMonths}</span>
            <input
              value={every}
              inputMode="numeric"
              onChange={(e) => setEvery(e.target.value.replace(/[^0-9]/g, ""))}
              className={`${field} tabular-nums`}
            />
          </label>
          <label className="grid gap-1">
            <span className={dim}>{words.startsOn}</span>
            <input
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              className={`${field} tabular-nums`}
            />
          </label>
          <label className="grid gap-1">
            <span className={dim}>{words.endsOn}</span>
            <input
              type="date"
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              className={`${field} tabular-nums`}
            />
          </label>
          <div className="flex items-center gap-3">
            <button type="button" disabled={busy} onClick={sign} className={btn}>
              {busy ? words.signing : words.sign}
            </button>
            {said && (
              <span aria-live="polite" className={dim}>
                {said}
              </span>
            )}
          </div>
        </div>
      )}
      <p className={`mt-3 ${dim}`}>{words.endsOnHint}</p>
    </Section>
  );
}

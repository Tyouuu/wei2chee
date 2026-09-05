"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DeskCard, deskBtn, deskDim, deskField } from "../desk-kit";

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
  const field = deskField;

  /* 一条路线是**按天**排的。⚠️ 顺序照资料库给的（逾期的在前），
     所以这里只分段，不重排 —— 重排一次就要在两个地方维护同一条规则。 */
  const days = (() => {
    const today = new Date().toISOString().slice(0, 10);
    const by = new Map<string, { on: string; late: boolean; items: Due[] }>();
    for (const d of rows) {
      if (!by.has(d.due_on))
        by.set(d.due_on, { on: d.due_on, late: d.due_on < today, items: [] });
      by.get(d.due_on)!.items.push(d);
    }
    return [...by.values()];
  })();

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

  const dim = deskDim;
  const btn = deskBtn();

  return (
    <>
      {/* 🔴 **按日子分段，不是一串平的行。**

          老板：「我不要一直都是相同的组件」。而这一页问的是
          **「这一轮要去哪几家」** —— 那是一条路线，不是一份名单：
          他今天出门要知道**今天有哪几家**，明天有哪几家。

          骨架抄的是他挑的那一套的 `productivity`（按天分段的行程），
          而不是那一串到处都在用的记录行。 */}
      <DeskCard title={words.roundLabel}>
        <p className={`mb-5 ${dim}`}>{rows.length ? words.roundLede : words.roundNone}</p>

        {days.length > 0 && (
          <div className="flex flex-col gap-6">
            {days.map((day) => (
              <div key={day.on}>
                {/* 那一天。⚠️ 已经过去而且还没做的那几天，读起来要不一样 ——
                    那是他今天真的要补的。 */}
                <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
                  <span
                    className={`tabular-nums [font-weight:var(--fw-semibold)] ${
                      day.late ? "text-[color:var(--color-clay-bright)]" : ""
                    }`}
                  >
                    {day.on}
                  </span>
                  {/* 🔴 只印数字，不挂词 —— 「1 stops」是英文复数变形的坑，
                      而这一套本来就有一个做法：数字骑在标题旁边。 */}
                  <span className={`tabular-nums ${dim}`}>{day.items.length}</span>
                </div>
                <ul className="flex flex-col">
                  {day.items.map((d) => {
                    const k = keyOf(d);
                    return (
                      <li
                        key={k}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t py-3 [border-color:var(--color-ink-800)]"
                      >
                        <span className="[font-weight:var(--fw-semibold)]">{d.party}</span>
                        {d.title && <span className={dim}>{d.title}</span>}
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
                              className={deskBtn("danger")}
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
                              className={deskBtn("primary")}
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
              </div>
            ))}
          </div>
        )}

        {/* 「顺手开一张单」开在哪。⚠️ 一页都没有的时候整段不画 ——
            那时候那颗按钮开不出任何东西，而 `log_service_visit` 会抛。 */}
        {rows.length > 0 && jobPages.length > 0 && (
          <label className={`mt-5 flex flex-wrap items-center gap-3 ${dim}`}>
            {words.makeJob}
            {/* ⚠️ 不写 `w-auto` —— 它跟 `field` 自己的 `w-full` 都是 width，
                赢的是档案里后面那一条。用一个有上限的盒子包起来才稳。 */}
            <span className="inline-block w-full max-w-[16rem]">
              <select
                value={makeJobIn}
                onChange={(e) => setMakeJobIn(e.target.value)}
                className={field}
              >
                {jobPages.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
                <option value="">{words.noJob}</option>
              </select>
            </span>
          </label>
        )}
      </DeskCard>

      <div className="h-5" />

      {ending.length > 0 && (
        <DeskCard title={words.endingLabel}>
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
                <span className={dim}>{words.visitsDone.replace("%n", String(e.visits_done))}</span>
                {/* 🔴 已经过期的排在最前面（资料库排的），而它读起来要
                    跟「还有几天」不一样 —— 那是他今天就该打的那一通。 */}
                <span
                  className={`tabular-nums [font-size:var(--text-sm)] ${
                    e.days_left < 0 ? "text-[color:var(--color-clay-bright)]" : ""
                  }`}
                >
                  {e.days_left < 0
                    ? words.endedAgo.replace("%n", String(Math.abs(e.days_left)))
                    : words.daysLeft.replace("%n", String(e.days_left))}
                </span>
              </li>
            ))}
          </ul>
        </DeskCard>
      )}

      <div className="h-5" />

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

  const field = deskField;

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
    <DeskCard title={words.newLabel}>
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
            <button type="button" disabled={busy} onClick={sign} className={deskBtn("primary")}>
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
    </DeskCard>
  );
}

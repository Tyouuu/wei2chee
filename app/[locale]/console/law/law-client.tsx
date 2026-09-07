"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageBar } from "@/app/[locale]/portal/(app)/page-bar";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { parseBrackets, permilleRows, type Bracket } from "./parse-brackets";

export type Schedule = {
  id: string;
  scheme: string;
  part: string;
  effective_from: string;
  effective_to: string | null;
  source_name: string;
  source_url: string;
  act: string;
  via: string;
  rounding: string;
  confirmed_at: string | null;
  confirmed_note: string;
  brackets: number;
  hasTail: boolean;
};

const card =
  "rounded-[var(--radius-lg)] border p-5 [border-color:var(--color-ink-800)] [background-color:var(--color-ink-900)]";
const field =
  "w-full rounded-[var(--radius-md)] border px-3 py-2 [font-size:var(--text-sm)] [border-color:var(--color-ink-700)] [background-color:var(--color-ink-950)] [color:var(--color-paper)]";
const label =
  "[font-size:var(--text-xs)] uppercase tracking-[0.12em] [color:var(--color-paper-dim)]";
const dim = "[font-size:var(--text-sm)] [color:var(--color-paper-dim)]";
const btn =
  "rounded-[var(--radius-md)] px-4 py-2 [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [background-color:var(--color-primary)] [color:var(--color-on-primary)] disabled:opacity-50";

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** 一格读起来是什么样子 —— 金额那一种，或者百分比那一种。 */
function bracketLine(b: Bracket): string {
  const span =
    b.wage_to_cents === null
      ? `${money(b.wage_from_cents)} +`
      : `${money(b.wage_from_cents)} - ${money(b.wage_to_cents)}`;
  const take =
    b.employee_permille !== undefined
      ? `${b.employee_permille / 10}% / ${b.employer_permille! / 10}%`
      : `${money(b.employee_cents!)} / ${money(b.employer_cents!)}`;
  return `${span}   ${take}`;
}

export function LawClient({
  schedules,
  capped,
}: {
  schedules: Schedule[];
  capped: boolean;
}) {
  const t = useTranslations("portal.console");
  const router = useRouter();

  const unconfirmed = schedules.filter((s) => !s.confirmed_at);

  return (
    <>
      <PageBar
        title={t("lawTitle")}
        subtitle={t("lawSubtitle", {
          count: schedules.length,
          unconfirmed: unconfirmed.length,
        })}
      />
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* 🔴 两种缺法，两个后果，而它们不一样 —— 讲混了他会去修错的那一件。
            一份表都没有 → `statutory_lookup` 在**算**那一刻就抛；
            装了没人核对 → 薪资单算得出来，而 `pay_pay_run` 挡住钱。 */}
        {schedules.length === 0 ? (
          <p
            data-law-nothing=""
            className={`${card} [color:var(--color-clay-bright)]`}
          >
            {t("lawNothing")}
          </p>
        ) : unconfirmed.length > 0 ? (
          <p
            data-law-unconfirmed=""
            className={`${card} [color:var(--color-clay-bright)]`}
          >
            {t("lawBlocked", { count: unconfirmed.length })}
          </p>
        ) : null}

        {capped ? (
          <p
            data-law-capped=""
            className={`${card} mt-3 [color:var(--color-clay-bright)]`}
          >
            {t("lawCapped")}
          </p>
        ) : null}

        <section className="mt-8">
          <h2 className="[font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
            {t("lawLoadedTitle")}
          </h2>
          {schedules.length === 0 ? (
            <p className={`${dim} mt-2`}>{t("lawWhereToGet")}</p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {/* 🔴 没有人核对过的排最前面 —— 那几份是挡着钱的那几份。 */}
              {[...schedules]
                .sort(
                  (a, b) =>
                    Number(!!a.confirmed_at) - Number(!!b.confirmed_at) ||
                    a.scheme.localeCompare(b.scheme) ||
                    a.part.localeCompare(b.part) ||
                    b.effective_from.localeCompare(a.effective_from),
                )
                .map((s) => (
                  <ScheduleRow key={s.id} row={s} onDone={router.refresh} />
                ))}
            </ul>
          )}
        </section>

        <LoadForm onDone={router.refresh} />
      </div>
    </>
  );
}

function ScheduleRow({ row, onDone }: { row: Schedule; onDone: () => void }) {
  const t = useTranslations("portal.console");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");

  async function confirm() {
    setBusy(true);
    setSaid("");
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc("confirm_statutory_schedule", {
      in_id: row.id,
      in_note: note,
    });
    setBusy(false);
    if (error) {
      setSaid(error.message);
      return;
    }
    onDone();
  }

  return (
    <li className={card} data-law-row="">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="[font-size:var(--text-base)] [font-weight:var(--fw-semibold)] uppercase">
          {row.scheme}
        </span>
        <span className="[font-size:var(--text-base)]">{row.part}</span>
        <span className={dim}>
          {row.effective_from} - {row.effective_to ?? t("lawStillOn")}
        </span>
        <span
          className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 [font-size:10px] uppercase tracking-[0.1em] [font-weight:var(--fw-semibold)] ${
            row.confirmed_at
              ? "[background-color:var(--color-jade-bright)] [color:var(--color-ink-900)]"
              : "[background-color:var(--color-clay-bright)] [color:var(--color-ink-900)]"
          }`}
          data-law-state={row.confirmed_at ? "confirmed" : "unconfirmed"}
        >
          {t(row.confirmed_at ? "lawConfirmed" : "lawNotConfirmed")}
        </span>
      </div>

      <p className={`${dim} mt-2`}>
        {/* 🔴 几格。零格的表**装得进去**，而它到发薪那一天才被拒绝
            （「the loaded table is incomplete」）。所以这个数字要看得见。 */}
        <span data-law-brackets={row.brackets}>
          {t("lawBrackets", { count: row.brackets })}
        </span>
        {" · "}
        {t(row.hasTail ? "lawHasTail" : "lawNoTail")}
        {row.rounding === "ringgit_up" ? ` · ${t("lawRoundUp")}` : null}
      </p>

      <p className={`${dim} mt-1`}>
        {/* 出处那一条是**连结** —— 核对那一步就是打开它比一次，
            所以它要在按下「我核对过了」的那颗按钮旁边。 */}
        <a
          href={row.source_url}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 [color:var(--color-paper)]"
        >
          {row.source_name}
        </a>
        {row.act ? ` · ${row.act}` : null}
        {row.via ? ` · ${t("lawVia", { via: row.via })}` : null}
      </p>

      {row.confirmed_at ? (
        row.confirmed_note ? (
          <p className={`${dim} mt-2`}>{row.confirmed_note}</p>
        ) : null
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid min-w-[18rem] flex-1 gap-1">
            <span className={label}>{t("lawNoteLabel")}</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("lawNotePlaceholder")}
              className={field}
            />
          </label>
          {/* ⚠️ 那一格**不挡**按钮。要求他填一句，换来的是一个句号 ——
              而真正让核对变便宜的是上面那条连结，不是一条我发明的规矩。 */}
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className={btn}
          >
            {busy ? t("lawConfirming") : t("lawConfirm")}
          </button>
        </div>
      )}
      {said ? (
        <p className="mt-2 [font-size:var(--text-sm)] [color:var(--color-clay-bright)]">
          {said}
        </p>
      ) : null}
    </li>
  );
}

function LoadForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("portal.console");
  const [scheme, setScheme] = useState("epf");
  const [part, setPart] = useState("");
  const [from, setFrom] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [act, setAct] = useState("");
  const [via, setVia] = useState("");
  const [rounding, setRounding] = useState("cent");
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");

  /* 🔴 解析结果**在他按下去之前**就画出来。一份贴错的表，
     `statutory_lookup` 到**算薪水那一刻**才会讲话，而那时候他人在发薪那一天。 */
  const parsed = useMemo(
    () => (paste.trim() ? parseBrackets(paste) : null),
    [paste],
  );

  const ready =
    !!parsed?.ok &&
    !!part.trim() &&
    !!from &&
    !!sourceName.trim() &&
    !!sourceUrl.trim();

  async function load() {
    if (!parsed?.ok) return;
    setBusy(true);
    setSaid("");
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc("upsert_statutory_schedule", {
      in_scheme: scheme,
      in_part: part.trim(),
      in_effective_from: from,
      in_source_name: sourceName.trim(),
      in_source_url: sourceUrl.trim(),
      in_act: act.trim(),
      in_via: via.trim(),
      in_rounding: rounding,
      in_brackets: parsed.rows,
    });
    setBusy(false);
    if (error) {
      setSaid(error.message);
      return;
    }
    setPaste("");
    onDone();
  }

  return (
    <section className="mt-9" data-law-load="">
      <h2 className="[font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
        {t("lawLoadTitle")}
      </h2>
      {/* ⚠️ 同一个（计划·类别·生效日）再装一次 = 换掉那一份，**而且它的
          确认会被收回**（20260904210000 的 on conflict）。他要知道，
          不然他贴一次修正，然后不知道核对已经不算数了。 */}
      <p className={`${dim} mt-2`}>{t("lawReplaces")}</p>

      <div className={`${card} mt-4 grid gap-4`}>
        <div className="flex flex-wrap gap-4">
          <label className="grid gap-1">
            <span className={label}>{t("lawScheme")}</span>
            <select
              value={scheme}
              onChange={(e) => setScheme(e.target.value)}
              className={field}
            >
              <option value="epf">EPF</option>
              <option value="socso">SOCSO</option>
              <option value="eis">EIS</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className={label}>{t("lawPart")}</span>
            {/* ⚠️ 自由文字，故意的：那几个类别（EPF Part A/C/E ·
                SOCSO 第一/二类）是**法律的**，在这里再手写一份名单，
                就是这个仓库栽过八次的那件事 —— 而 20260904210000
                的档头也是这样讲的。 */}
            <input
              value={part}
              onChange={(e) => setPart(e.target.value)}
              placeholder={t("lawPartPlaceholder")}
              className={field}
            />
          </label>
          <label className="grid gap-1">
            <span className={label}>{t("lawFrom")}</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={field}
            />
          </label>
          <label className="grid gap-1">
            <span className={label}>{t("lawRounding")}</span>
            <select
              value={rounding}
              onChange={(e) => setRounding(e.target.value)}
              className={field}
            >
              <option value="cent">{t("lawRoundCent")}</option>
              <option value="ringgit_up">{t("lawRoundUp")}</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className={label}>{t("lawSourceName")}</span>
            <input
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder={t("lawSourceNamePlaceholder")}
              className={field}
            />
          </label>
          <label className="grid gap-1">
            <span className={label}>{t("lawSourceUrl")}</span>
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://"
              className={field}
            />
          </label>
          <label className="grid gap-1">
            <span className={label}>{t("lawAct")}</span>
            <input
              value={act}
              onChange={(e) => setAct(e.target.value)}
              placeholder={t("lawActPlaceholder")}
              className={field}
            />
          </label>
          <label className="grid gap-1">
            <span className={label}>{t("lawViaLabel")}</span>
            {/* 出处是法律；「我从哪里抄来的」是另一件事，
                而它是一条要审的线索（那一栏自己的注解就是这样写的）。 */}
            <input
              value={via}
              onChange={(e) => setVia(e.target.value)}
              placeholder={t("lawViaPlaceholder")}
              className={field}
            />
          </label>
        </div>

        <label className="grid gap-1">
          <span className={label}>{t("lawPaste")}</span>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={8}
            placeholder={t("lawPastePlaceholder")}
            className={`${field} font-mono [font-size:var(--text-xs)]`}
            data-law-paste=""
          />
          <span className={dim}>{t("lawPasteHint")}</span>
        </label>

        {parsed ? (
          parsed.ok ? (
            <div data-law-preview="" className={dim}>
              <p className="[color:var(--color-jade-bright)]">
                {t("lawParsed", {
                  count: parsed.rows.length,
                  rates: permilleRows(parsed.rows),
                })}
              </p>
              {parsed.skippedHeading ? (
                <p className="mt-1">
                  {t("lawSkippedHeading", { text: parsed.skippedHeading })}
                </p>
              ) : null}
              {/* 头三格跟**最后那一格** —— 最后那一格是表尾那一行
                  （没有上限、百分比），也是最容易贴漏的一行。 */}
              <pre className="mt-2 overflow-x-auto whitespace-pre [font-size:var(--text-xs)] [color:var(--color-paper)]">
                {[
                  ...parsed.rows.slice(0, 3).map(bracketLine),
                  ...(parsed.rows.length > 4 ? ["..."] : []),
                  ...(parsed.rows.length > 3
                    ? [bracketLine(parsed.rows[parsed.rows.length - 1])]
                    : []),
                ].join("\n")}
              </pre>
            </div>
          ) : (
            <p
              data-law-refused={parsed.why}
              className="[font-size:var(--text-sm)] [color:var(--color-clay-bright)]"
            >
              {parsed.why === "empty"
                ? t("lawBadEmpty")
                : t(
                    parsed.why === "columns"
                      ? "lawBadColumns"
                      : parsed.why === "number"
                        ? "lawBadNumber"
                        : parsed.why === "mixed"
                          ? "lawBadMixed"
                          : "lawBadSpan",
                    { line: parsed.line, text: parsed.text },
                  )}
            </p>
          )
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={load}
            disabled={busy || !ready}
            className={btn}
          >
            {/* 还没贴东西的时候不写「装 0 格进去」—— 一颗提议装零格的按钮
                承诺的是一件不会发生的事。 */}
            {busy
              ? t("lawLoading")
              : parsed?.ok
                ? t("lawLoad", { count: parsed.rows.length })
                : t("lawLoadIdle")}
          </button>
          {said ? (
            <span className="[font-size:var(--text-sm)] [color:var(--color-clay-bright)]">
              {said}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

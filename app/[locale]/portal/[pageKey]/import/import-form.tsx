"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { RecordFormCopy } from "../record-copy";
import {
  mapHeaders,
  parseSheet,
  rowHasSomething,
  rowToRecord,
  keyForRow,
  type SheetColumn,
} from "@/lib/portal/import-sheet";

/**
 * 把他那份 Excel 贴进来。
 *
 * ── 三件事，照这个顺序 ────────────────────────────────────────────────────
 *
 *   ① 贴上   ② 看清楚我们读成了什么   ③ 才按下去
 *
 * 第 ② 步是这一页真正的内容。一个直接吃下去、然后说「进了 500 行」的
 * 汇入，他没有办法知道电话有没有存进备注 —— 而他会在下个月发现。
 *
 * ── 🔴 没进去的那几行，一行一行讲 ────────────────────────────────────────
 *
 * Frappe 的 `skipped_rows`，抄的就是这一件。五百行里第 237 行日期打错，
 * 要**进去 499 行，然后告诉他第 237 行怎么了** ——
 * 不是整批失败（他要重来），也不是默默跳过（他不知道少了一行）。
 */

const CHUNK = 500;

/** 「读到 {n} 行」→「读到 42 行」。
 *  ⚠️ 字串加一个洞，不是一个函式：`copy` 是从伺服器传下来的，
 *  而函式过不去 —— 那一句是用一个 500 换来的（见 record-copy.ts）。 */
const fill = (s: string, n: number) => s.replace("{n}", String(n));

/** 预览那张表只是拿来**看每一栏有没有对位**的，不是拿来读内容的。
 *  ⚠️ 一格三百个字会把旁边那几栏挤成一个字一行 —— 看图才看到的。 */
const short = (s: string) => (s.length > 48 ? `${s.slice(0, 48)}…` : s);

export function ImportForm({
  projectId,
  moduleKey,
  columns,
  ownKeys,
  backHref,
  copy,
}: {
  projectId: string;
  moduleKey: string;
  /** 这一页自己的栏名。表头对的就是它们。 */
  columns: SheetColumn[];
  /** 他自己加的那几栏（车牌号…）。它们进 extra。 */
  ownKeys: string[];
  backHref: string;
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ok: number; failed: { row: number; why: string }[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const sheet = useMemo(() => parseSheet(text), [text]);
  const mapping = useMemo(() => mapHeaders(sheet.headers, columns), [sheet.headers, columns]);
  const own = useMemo(() => new Set(ownKeys), [ownKeys]);
  const bodyRows = useMemo(() => sheet.rows.filter(rowHasSomething), [sheet.rows]);

  /** 表头那一行，他自己的字，用 tab 分开 —— 贴回 Excel 就是一排栏。 */
  const template = columns.map((c) => c.label).join("\t");

  async function run() {
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      /* 钥匙从**贴上去的那份内容加行号**算出来，不是随机的 ——
         他按了两次「汇入」，第二次一行都不会重复（keyForRow 的档头讲了
         为什么不能只从这一行的内容算）。 */
      let ok = 0;
      const failed: { row: number; why: string }[] = [];

      for (let start = 0; start < bodyRows.length; start += CHUNK) {
        const slice = bodyRows.slice(start, start + CHUNK);
        const payload = slice.map((cells, i) =>
          rowToRecord(cells, mapping, own, keyForRow(text, start + i)),
        );
        const { data, error: err } = await supabase.rpc("import_records", {
          in_project_id: projectId,
          in_module_key: moduleKey,
          in_rows: payload,
        });
        if (err) {
          setError(err.message);
          setBusy(false);
          return;
        }
        const res = data as { ok: number; failed: { row: number; why: string }[] };
        ok += res.ok ?? 0;
        /* 行号加回这一批的位移，而且 +2：资料库那边从 1 数，
           而他看的是 Excel 的行号，第一行是表头。 */
        for (const f of res.failed ?? []) failed.push({ row: start + f.row + 1, why: f.why });
      }
      setDone({ ok, failed });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const control =
    "ds-control w-full [padding:var(--pad-control-y)_var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]";

  return (
    <div className="flex flex-col gap-6">
      {/* ① 表头范本。他贴回 Excel 当第一行就好。 */}
      <div className="flex flex-col gap-2">
        <span className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
          {copy.importHeaders}
        </span>
        <code className="[border-radius:var(--radius-md)] border px-3 py-2 [font-size:var(--text-xs)] [border-color:var(--color-ink-800)] text-[color:var(--color-on-canvas-dim)]">
          {columns.map((c) => c.label).join(" · ")}
        </code>
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(template)}
          className="self-start min-h-11 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)] underline"
        >
          {copy.importCopyHeaders}
        </button>
      </div>

      {/* ② 贴上 */}
      <label className="flex flex-col gap-1.5">
        <span className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
          {copy.importPaste}
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={copy.importPastePlaceholder}
          className={`${control} font-mono`}
        />
      </label>

      {/* ③ 我们读成了什么。这一段才是这一页的内容。 */}
      {bodyRows.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas)]">
            {fill(copy.importReadAs, bodyRows.length)}
          </p>

          {/* 🔴 认不出来的表头，原样列出来。不猜 —— 猜错一栏，
              五百行的电话会存进备注，而他下个月才发现。 */}
          {mapping.unmatched.length ? (
            <p className="[font-size:var(--text-sm)] text-[color:var(--color-clay-bright)]">
              {copy.importUnmatched} {mapping.unmatched.join(" · ")}
            </p>
          ) : null}
          {mapping.nothingMatched ? (
            <p className="[font-size:var(--text-sm)] text-[color:var(--color-clay-bright)]">
              {copy.importNoHeaders}
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse [font-size:var(--text-sm)]">
              <thead>
                <tr className="border-b text-left [border-color:var(--color-ink-800)]">
                  {sheet.headers.map((h, i) => (
                    <th
                      key={i}
                      className={`px-2 py-1.5 [font-size:var(--text-xs)] font-normal ${
                        mapping.byIndex[i]
                          ? "text-[color:var(--color-on-canvas-dim)]"
                          : "text-[color:var(--color-clay-bright)] line-through"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-b [border-color:var(--color-ink-800)]">
                    {sheet.headers.map((_, j) => (
                      <td
                        key={j}
                        className={`px-2 py-1.5 ${
                          mapping.byIndex[j]
                            ? "text-[color:var(--color-on-canvas)]"
                            : "text-[color:var(--color-on-canvas-dim)] line-through"
                        }`}
                      >
                        {short(r[j] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bodyRows.length > 5 ? (
            <p className="[font-size:var(--text-xs)] text-[color:var(--color-on-canvas-dim)]">
              {fill(copy.importMoreRows, bodyRows.length - 5)}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]">
          {error}
        </p>
      ) : null}

      {/* 🔴 结果：进了几行，而且没进去的一行一行讲。 */}
      {done ? (
        <div className="flex flex-col gap-2 [border-radius:var(--radius-md)] border p-3 [border-color:var(--color-ink-800)]">
          <p className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
            {fill(copy.importDone, done.ok)}
          </p>
          {done.failed.length ? (
            <>
              <p className="[font-size:var(--text-sm)] text-[color:var(--color-clay-bright)]">
                {fill(copy.importFailed, done.failed.length)}
              </p>
              <ul className="flex flex-col gap-1">
                {done.failed.slice(0, 20).map((f) => (
                  <li
                    key={f.row}
                    className="[font-size:var(--text-xs)] text-[color:var(--color-on-canvas-dim)]"
                  >
                    {fill(copy.importRowNo, f.row)} — {f.why}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy || bodyRows.length === 0 || mapping.nothingMatched}
          onClick={() => void run()}
          className="inline-flex h-11 shrink-0 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] transition-colors [transition-duration:var(--dur)] hover:[background-color:var(--color-primary-deep)] disabled:opacity-60"
        >
          {busy ? copy.importRunning : copy.importCta}
        </button>
        <a href={backHref} className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)] underline">
          {copy.cancel}
        </a>
      </div>
    </div>
  );
}

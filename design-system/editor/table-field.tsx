"use client";

import { useState } from "react";
import {
  COLUMN_KINDS,
  KIND_LABELS,
  blankRow,
  newColumnKey,
  type ColumnKind,
  type TableColumn,
  type TableModel,
} from "@/lib/portal/table-model";
import type { StatusTone } from "@/design-system/components/status-dot";

/**
 * The table editor in the fields panel.
 *
 * WHY A CUSTOM FIELD AND NOT PUCK'S ARRAY FIELD. Puck's built-in `array` field
 * edits one prop in isolation, and a table is two arrays that have to agree:
 * add a column and every row grows a cell. Two separate array fields cannot
 * coordinate, and would let a customer produce rows whose cells belong to
 * columns that no longer exist. One custom field over one `{columns, rows}`
 * prop makes that impossible by construction — every mutation below rewrites
 * both halves together.
 *
 * WHY IT LOOKS LIKE THIS AND NOT LIKE A SPREADSHEET. The panel is 290px wide.
 * A real grid needs a column per column and would be scrolling horizontally
 * before the third one. So columns are a vertical list of cards, and records
 * are collapsed to their first cell until opened — the same idiom Puck's own
 * array field uses, so it does not read as a foreign control, but aware of
 * which column each input belongs to.
 */

/** Eight is a table, twelve is a spreadsheet nobody can read in a 458px canvas.
 *  The ceiling is here rather than in the data layer because it is a judgement
 *  about legibility, not an invariant. */
const MAX_COLUMNS = 8;

const TONE_OPTIONS: { value: StatusTone; label: string }[] = [
  { value: "positive", label: "正常" },
  { value: "warning", label: "注意" },
  { value: "negative", label: "有问题" },
  { value: "neutral", label: "待处理" },
];

const inputClass =
  "w-full min-w-0 rounded-[6px] border px-2 py-1.5 text-[13px] outline-none [border-color:var(--color-ink-800)] [background-color:var(--color-ink-850)] [color:var(--color-paper)] focus-visible:[border-color:var(--color-primary)]";

const iconBtnClass =
  "grid h-6 w-6 shrink-0 place-items-center rounded-[5px] text-[13px] leading-none [color:var(--color-paper-dim)] enabled:hover:[background-color:var(--color-ink-800)] enabled:hover:[color:var(--color-paper)] disabled:opacity-25";

const sectionLabelClass =
  "text-[10px] uppercase tracking-[0.12em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]";

const addBtnClass =
  "w-full rounded-[6px] border border-dashed px-2 py-1.5 text-[12px] [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] enabled:hover:[border-color:var(--color-primary)] enabled:hover:[color:var(--color-paper)] disabled:opacity-30";

export function TableFieldEditor({
  value,
  onChange,
}: {
  value: TableModel;
  onChange: (value: TableModel) => void;
}) {
  const columns = value?.columns ?? [];
  const rows = value?.rows ?? [];
  const [openRow, setOpenRow] = useState<number | null>(null);

  function setColumns(
    next: TableColumn[],
    rewriteRows?: (r: TableModel["rows"]) => TableModel["rows"],
  ) {
    onChange({ columns: next, rows: rewriteRows ? rewriteRows(rows) : rows });
  }

  function addColumn() {
    if (columns.length >= MAX_COLUMNS) return;
    const key = newColumnKey(columns);
    // Seeded empty on every existing row rather than left absent: an absent key
    // and an empty string render identically, but only the explicit one shows
    // up as an editable input on rows the customer has already filled in.
    setColumns([...columns, { key, label: "新栏位", kind: "text" }], (rs) =>
      rs.map((r) => ({ ...r, cells: { ...r.cells, [key]: "" } })),
    );
  }

  function removeColumn(index: number) {
    // A table with no columns is not a smaller table, it is a rendering crash
    // and an unrecoverable state — there would be no header to add one back
    // from. Same reasoning as the dashboard being un-removable.
    if (columns.length <= 1) return;
    const key = columns[index].key;
    setColumns(
      columns.filter((_, i) => i !== index),
      (rs) =>
        rs.map((r) => {
          const cells = { ...r.cells };
          const tones = { ...(r.tones ?? {}) };
          delete cells[key];
          delete tones[key];
          return { cells, tones };
        }),
    );
  }

  function moveColumn(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= columns.length) return;
    const next = [...columns];
    [next[index], next[to]] = [next[to], next[index]];
    setColumns(next);
  }

  function patchColumn(index: number, patch: Partial<TableColumn>) {
    setColumns(columns.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function setCell(rowIndex: number, key: string, cellValue: string) {
    onChange({
      columns,
      rows: rows.map((r, i) =>
        i === rowIndex ? { ...r, cells: { ...r.cells, [key]: cellValue } } : r,
      ),
    });
  }

  function setTone(rowIndex: number, key: string, tone: StatusTone) {
    onChange({
      columns,
      rows: rows.map((r, i) =>
        i === rowIndex ? { ...r, tones: { ...(r.tones ?? {}), [key]: tone } } : r,
      ),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className={sectionLabelClass}>栏位</span>
          <span className="text-[11px] [color:var(--color-paper-dim)]">
            {columns.length}/{MAX_COLUMNS}
          </span>
        </div>

        {columns.map((col, i) => (
          <div
            key={col.key}
            className="flex flex-col gap-1.5 rounded-[7px] border p-2 [border-color:var(--color-ink-800)] [background-color:var(--color-ink-900)]"
          >
            <input
              value={col.label}
              onChange={(e) => patchColumn(i, { label: e.target.value })}
              maxLength={16}
              placeholder="栏位名称"
              aria-label={`第 ${i + 1} 列的名称`}
              className={inputClass}
            />
            <div className="flex items-center gap-1">
              <select
                value={col.kind}
                onChange={(e) => patchColumn(i, { kind: e.target.value as ColumnKind })}
                aria-label={`第 ${i + 1} 列的类型`}
                className="min-w-0 flex-1 rounded-[6px] border px-1.5 py-1 text-[12px] [border-color:var(--color-ink-800)] [background-color:var(--color-ink-850)] [color:var(--color-paper-dim)]"
              >
                {COLUMN_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => moveColumn(i, -1)}
                disabled={i === 0}
                aria-label="往前移"
                className={iconBtnClass}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveColumn(i, 1)}
                disabled={i === columns.length - 1}
                aria-label="往后移"
                className={iconBtnClass}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeColumn(i)}
                disabled={columns.length <= 1}
                aria-label="删掉这一列"
                className={iconBtnClass}
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addColumn}
          disabled={columns.length >= MAX_COLUMNS}
          className={addBtnClass}
        >
          ＋ 加一列
        </button>
      </section>

      <section className="flex flex-col gap-1.5">
        <span className={sectionLabelClass}>记录</span>

        {rows.map((row, i) => {
          const open = openRow === i;
          const summary = row.cells?.[columns[0]?.key ?? ""] || "（空白）";
          return (
            <div
              key={i}
              className="rounded-[7px] border [border-color:var(--color-ink-800)] [background-color:var(--color-ink-900)]"
            >
              <div className="flex items-center gap-1 p-1.5">
                <button
                  type="button"
                  onClick={() => setOpenRow(open ? null : i)}
                  aria-expanded={open}
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[5px] px-1 py-0.5 text-left text-[13px] [color:var(--color-paper)] hover:[background-color:var(--color-ink-850)]"
                >
                  <span aria-hidden="true" className="text-[10px] [color:var(--color-paper-dim)]">
                    {open ? "▾" : "▸"}
                  </span>
                  <span className="truncate">{summary}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ columns, rows: rows.filter((_, j) => j !== i) });
                    setOpenRow(null);
                  }}
                  aria-label={`删掉「${summary}」这一行`}
                  className={iconBtnClass}
                >
                  ✕
                </button>
              </div>

              {open && (
                <div className="flex flex-col gap-2 border-t px-2 pb-2 pt-2 [border-color:var(--color-ink-800)]">
                  {columns.map((col) => (
                    <label key={col.key} className="flex flex-col gap-1">
                      <span className="text-[11px] [color:var(--color-paper-dim)]">{col.label}</span>
                      <input
                        value={row.cells?.[col.key] ?? ""}
                        onChange={(e) => setCell(i, col.key, e.target.value)}
                        className={inputClass}
                      />
                      {col.kind === "status" && (
                        <select
                          value={row.tones?.[col.key] ?? "neutral"}
                          onChange={(e) => setTone(i, col.key, e.target.value as StatusTone)}
                          aria-label={`${col.label} 的颜色`}
                          className="mt-0.5 rounded-[6px] border px-1.5 py-1 text-[12px] [border-color:var(--color-ink-800)] [background-color:var(--color-ink-850)] [color:var(--color-paper-dim)]"
                        >
                          {TONE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => {
            onChange({ columns, rows: [...rows, blankRow(columns)] });
            setOpenRow(rows.length);
          }}
          className={addBtnClass}
        >
          ＋ 加一行
        </button>
      </section>
    </div>
  );
}

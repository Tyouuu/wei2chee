import type { StatusTone } from "@/design-system/components/status-dot";

/**
 * The shape of a record table, and the one place that knows how to read BOTH
 * the shape it has now and the shape it used to have.
 *
 * WHY THIS FILE EXISTS. RecordTable's columns used to be four separate props
 * -- `primaryLabel`, `secondaryLabel`, `amountLabel`, `statusColumnLabel` --
 * which meant the COUNT was baked into the component's type. A customer could
 * rename a column and never add one, and the AI assistant refused「表格加一列」
 * not because the model was weak but because no operation could express it:
 * the model can only say what the components can represent. Turning columns
 * into an array is therefore not a table feature, it is the thing that makes
 * "design your own system" true of the most-used component in the product.
 *
 * WHY THE LEGACY SHAPE IS READ AND NOT MIGRATED IN THE DATABASE. Saved layouts
 * are opaque `jsonb` written by customers who have already paid; a SQL
 * migration that rewrites them is one bad regex away from destroying work that
 * has no other copy. Reading both shapes costs one function and cannot lose
 * anything. `upgradeRecordTableProps` below then rewrites props on LOAD, so
 * the editor's fields panel only ever sees the new shape and the old one dies
 * out naturally at each customer's next save.
 *
 * WHY THE LEGACY COLUMN KEYS SURVIVE AS `primary`/`secondary`/`amount`/
 * `status`. A row's cells are keyed by column key, so keeping the old names as
 * the built-in keys makes the upgrade a pure re-nesting -- no value moves, no
 * mapping table, and a half-upgraded layout still renders the right text under
 * the right heading.
 */

export const COLUMN_KINDS = ["text", "detail", "amount", "status"] as const;
export type ColumnKind = (typeof COLUMN_KINDS)[number];

export type TableColumn = {
  /** Stable identity. Rows address their cells by this, so it must survive a
   *  rename -- which is exactly why it is not derived from the label. */
  key: string;
  label: string;
  /** How the cell is rendered and aligned. `detail` is the dimmed secondary
   *  column, `amount` is right-aligned tabular figures, `status` renders a
   *  StatusDot with a per-row tone. */
  kind: ColumnKind;
};

export type TableRow = {
  cells: Record<string, string>;
  /** Only meaningful for `status` columns; keyed the same way so a row keeps
   *  its tone when a status column is renamed or reordered. */
  tones?: Record<string, StatusTone>;
};

export type TableModel = {
  columns: TableColumn[];
  rows: TableRow[];
  /**
   * These rows came out of the database, not out of the template.
   *
   * Set by the live-rows projection and carried through here so that it
   * SURVIVES A LOAD. Without that it does not exist for longer than one
   * render: the editor autosaves the projected rows into layout_json, and
   * this function rebuilds `table` on the way back in -- so the flag was
   * written on save and erased on load, every time.
   *
   * What it costs when it is lost: the day a business deletes its last
   * record, the projection has nothing to put in, and a frozen row that was
   * once real is indistinguishable from a sample -- so the deleted customer
   * comes back on screen and the delete looks as though it failed.
   *
   * ⚠️ Found in a browser, not in a test. The unit test for the fix built its
   * own tree and called the projection directly, so it never went through this
   * function at all -- 「the fixture is not the product」, which is the same
   * mistake the projection's own header records about the slot bug.
   */
  live?: boolean;
};

export const KIND_LABELS: Record<ColumnKind, string> = {
  text: "文字",
  detail: "说明",
  amount: "金额",
  status: "状态",
};

const STATUS_TONES: StatusTone[] = ["positive", "warning", "negative", "neutral"];

const isTone = (v: unknown): v is StatusTone => STATUS_TONES.includes(v as StatusTone);

/** A key no existing column is using. Sequential rather than random so a
 *  layout diff stays readable to a human debugging a customer's page. */
export function newColumnKey(columns: TableColumn[]): string {
  const used = new Set(columns.map((c) => c.key));
  for (let i = 1; ; i++) {
    const key = `c${i}`;
    if (!used.has(key)) return key;
  }
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Reads the legacy four-prop shape into the array shape. Kept separate from
 *  `normalizeTable` so the upgrade rule is stated once and testable on its own. */
function fromLegacy(props: Record<string, unknown>): TableModel {
  const legacyRows = Array.isArray(props.rows) ? (props.rows as Record<string, unknown>[]) : [];

  // The old component decided a column existed by scanning the rows for a
  // defined value (`rows.some(r => r.secondary !== undefined)`), so an empty
  // optional column was invisible. Same rule here, plus the label: a customer
  // who titled a column and then cleared every cell meant to keep the column.
  const hasSecondary =
    Boolean(props.secondaryLabel) || legacyRows.some((r) => r.secondary !== undefined);
  const hasAmount = Boolean(props.amountLabel) || legacyRows.some((r) => r.amount !== undefined);

  const columns: TableColumn[] = [
    { key: "primary", label: asString(props.primaryLabel) || "名称", kind: "text" },
  ];
  if (hasSecondary)
    columns.push({ key: "secondary", label: asString(props.secondaryLabel) || "说明", kind: "detail" });
  if (hasAmount)
    columns.push({ key: "amount", label: asString(props.amountLabel) || "金额", kind: "amount" });
  columns.push({ key: "status", label: asString(props.statusColumnLabel) || "状态", kind: "status" });

  const rows: TableRow[] = legacyRows.map((r) => ({
    cells: {
      primary: asString(r.primary),
      secondary: asString(r.secondary),
      amount: asString(r.amount),
      status: asString(r.statusLabel),
    },
    tones: { status: isTone(r.statusTone) ? r.statusTone : "neutral" },
  }));

  return { columns, rows };
}

/** The single reader. Accepts a component's whole prop bag in either shape and
 *  always returns something renderable -- a table with no columns at all is a
 *  crash surface, not a design choice. */
export function normalizeTable(props: Record<string, unknown>): TableModel {
  const t = props.table as TableModel | undefined;

  if (t && Array.isArray(t.columns) && t.columns.length > 0) {
    return {
      columns: t.columns
        .filter((c) => c && typeof c.key === "string" && c.key)
        .map((c) => ({
          key: c.key,
          label: asString(c.label),
          kind: (COLUMN_KINDS as readonly string[]).includes(c.kind) ? c.kind : "text",
        })),
      rows: (Array.isArray(t.rows) ? t.rows : []).map((r) => ({
        cells: (r?.cells ?? {}) as Record<string, string>,
        tones: (r?.tones ?? {}) as Record<string, StatusTone>,
      })),
      /* Carried, not rebuilt -- see the note on TableModel.live. Only `true`
         survives: a page that never held real rows must not gain the flag by
         accident, because the flag is what decides whether an empty result
         means 「他删完了」 or 「他还没开始」. */
      ...(t.live === true ? { live: true as const } : {}),
    };
  }

  return fromLegacy(props);
}

const LEGACY_PROPS = ["primaryLabel", "secondaryLabel", "amountLabel", "statusColumnLabel", "rows"];

/**
 * Rewrites one RecordTable's props into the array shape, dropping the legacy
 * four. Applied on load (lib/portal/layout-upgrade.ts) rather than lazily,
 * because Puck's fields panel edits the props it is given: leave `rows` behind
 * and the customer gets both the new grid editor and a stale second row editor
 * writing to a prop nothing renders.
 */
export function upgradeRecordTableProps(props: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...props, table: normalizeTable(props) };
  for (const k of LEGACY_PROPS) delete next[k];
  return next;
}

/** A blank row shaped for the current columns. Used by both the field editor's
 *  「加一行」 and the assistant's add_table_row. */
export function blankRow(columns: TableColumn[]): TableRow {
  const cells: Record<string, string> = {};
  const tones: Record<string, StatusTone> = {};
  for (const c of columns) {
    cells[c.key] = "";
    if (c.kind === "status") tones[c.key] = "neutral";
  }
  return { cells, tones };
}

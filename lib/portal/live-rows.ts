import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatusTone } from "@/lib/templates/copy/types";

/**
 * The customer's own rows, put into the page that was going to show samples.
 *
 * ── WHY A PROJECTION AND NOT A COMPONENT THAT FETCHES ─────────────────────
 *
 * A page in this product is a saved Puck tree, and a table's rows are PROPS
 * inside it (see recordTable in lib/templates/industry-template.ts). So there
 * are two places rows could become real: the component could fetch them, or
 * the tree could be rewritten on the way to the browser.
 *
 * The component fetching is wrong here for a reason that has nothing to do
 * with taste: RecordTable is also rendered into the style gallery, the landing
 * page's showroom, hundreds of live thumbnails and the printed page. A
 * component that reaches for a database is a component that cannot be drawn in
 * any of those places. The projection keeps the drawing pure and puts the
 * knowledge where the page is assembled -- which is also where publish
 * projection already lives, so this is the shape this repo already uses.
 *
 * ── HOW THE SAMPLES RETIRE ────────────────────────────────────────────────
 *
 * They do not need a flag, a migration or a state to maintain: this returns
 * the real rows when there are any and leaves the tree untouched when there
 * are none. The first quotation a customer writes replaces the demonstration,
 * and an empty business still gets a page that teaches them what it is for.
 *
 * That is the founder's decision of 2026-08-30 (「留着、标清楚、加第一笔真的就
 * 消失」) implemented by construction rather than by bookkeeping.
 */

/** Modules whose rows live in `pipeline_records`. Mirrors is_pipeline_module()
 *  in 20260830040000; module-catalog.test.ts fails if the shapes drift. */
const PIPELINE_MODULES = new Set(["quotations", "orders", "projects", "tasks"]);

export type LiveRow = {
  primary: string;
  secondary?: string;
  amount?: string;
  tone: StatusTone;
  status: string;
};

type PipelineRecord = {
  title: string | null;
  party: string | null;
  amount_cents: number | null;
  stage: string | null;
};

/**
 * Ringgit from sen. Grouped, and without decimals when there are none --
 * 「RM 48,500」 is how a contractor writes it and 「RM 48,500.00」 is how
 * software does.
 */
export function ringgit(cents: number | null | undefined): string | undefined {
  if (cents == null || !Number.isFinite(cents)) return undefined;
  const whole = cents / 100;
  return `RM ${whole.toLocaleString("en-MY", {
    minimumFractionDigits: whole % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * A stage has no severity of its own -- 「等确认」 is not a warning, it is where
 * most of a healthy pipeline sits. So the tone comes from POSITION: the last
 * stage of this business's workflow is done, the first is not started, and
 * everything between is in progress.
 *
 * Falling back to neutral when the stage is not in the list is deliberate. A
 * stage the workflow does not contain is one the customer typed or renamed,
 * and colouring it by guesswork would be inventing a judgement about their
 * business.
 */
export function toneForStage(stage: string, workflow: string[]): StatusTone {
  const i = workflow.findIndex((s) => s === stage);
  if (i < 0) return "neutral";
  if (i === workflow.length - 1) return "positive";
  if (i === 0) return "neutral";
  return "warning";
}

export function rowsFromRecords(
  records: PipelineRecord[],
  workflow: string[],
): LiveRow[] {
  return records.map((r) => ({
    primary: (r.title ?? "").trim() || (r.party ?? "").trim(),
    secondary: (r.party ?? "").trim() || undefined,
    amount: ringgit(r.amount_cents),
    tone: toneForStage((r.stage ?? "").trim(), workflow),
    status: (r.stage ?? "").trim(),
  }));
}

/**
 * Rewrite the tables of a page tree to carry `rows`.
 *
 * Only RecordTable, and only its rows: the columns are the customer's own
 * headings, which they may have renamed, and replacing those would undo their
 * work every time they loaded the page.
 *
 * Returns the tree unchanged when there is nothing to put in it, so the caller
 * can apply this unconditionally and an untouched object stays untouched.
 */
export function withLiveRows(
  tree: Record<string, unknown>,
  rows: LiveRow[],
): Record<string, unknown> {
  if (!rows.length) return tree;
  const content = (tree as { content?: unknown }).content;
  if (!Array.isArray(content)) return tree;
  return { ...tree, content: mapNodes(content, rows) };
}

/**
 * IT IS NEVER AT THE TOP LEVEL.
 *
 * A generated page is one SystemShell whose `main` prop holds the blocks:
 *
 *     SystemShell
 *       sidebar: [RailNav]
 *       main:    [PageHeader, FilterChips, DatePicker, RecordTable]
 *
 * The first version of this walked `tree.content` and stopped, so it found
 * nothing on every page in the product while its unit test -- written against a
 * hand-made flat tree -- passed. That is the fifth time this repo has shipped a
 * projection that never entered a slot; task 19 records the same failure on the
 * published-site projection, in the same words.
 *
 * So it recurses into any prop that holds an array of nodes, which is what a
 * Puck slot is. Nothing here needs to know the slot's name: a projection that
 * lists `["sidebar", "main"]` is the hardcoded version of this bug.
 */
/** A LiveRow in the table model's own shape. The keys are the built-in column
 *  keys from recordTable(); a column the owner added has no value here, which
 *  renders empty rather than wrong. */
function toModelRow(r: LiveRow): { cells: Record<string, string>; tones: Record<string, StatusTone> } {
  const cells: Record<string, string> = { primary: r.primary };
  if (r.secondary) cells.secondary = r.secondary;
  if (r.amount) cells.amount = r.amount;
  cells.status = r.status;
  return { cells, tones: { status: r.tone } };
}

function mapNodes(nodes: unknown[], rows: LiveRow[]): unknown[] {
  return nodes.map((node) => {
    const n = node as { type?: string; props?: Record<string, unknown> };
    if (!n || typeof n !== "object" || !n.props) return node;

    if (n.type === "RecordTable") {
      /*
        THE ROWS ARE NOT WHERE THEIR NAME SAYS.

        A generated table's props are { id, gridId, caption, table: { columns,
        rows } } -- the rows live one level down, inside `table`, beside the
        columns they belong to (see recordTable() and lib/portal/table-model.ts).

        The first version wrote props.rows, which the component does not read,
        so every page kept its samples. The unit test passed because its fixture
        put rows at props.rows -- a shape this codebase never produces. That is
        the same "the fixture is not the product" mistake as the slot bug it was
        written to catch, made inside the fix for it.

        Both shapes are handled because a page saved before the table model
        changed can still carry the flat one (see lib/portal/layout-upgrade.ts),
        and a projection that only understood today's shape would quietly skip
        exactly the oldest customers.
      */
      /*
        AND THE ROW SHAPE IS NOT THE SAME IN BOTH PLACES.

        `props.rows` is the legacy flat row -- { primary, secondary, amount,
        status } -- which normalizeTable() converts. `props.table.rows` is the
        model itself: { cells: Record<key, string>, tones: Record<key, tone> },
        keyed by COLUMN KEY so a row keeps its meaning when the owner renames or
        reorders a column.

        Writing the flat shape into the model gave a table with the right number
        of rows and nothing in any cell -- which is how it looked in the browser
        before this line existed.
      */
      const table = n.props.table as { rows?: unknown; columns?: unknown } | undefined;
      if (table && typeof table === "object") {
        return {
          ...n,
          props: { ...n.props, table: { ...table, rows: rows.map(toModelRow) } },
        };
      }
      if (Array.isArray(n.props.rows)) {
        return { ...n, props: { ...n.props, rows } };
      }
      return node;
    }

    let changed = false;
    const props: Record<string, unknown> = { ...n.props };
    for (const [key, value] of Object.entries(n.props)) {
      if (Array.isArray(value) && value.some((v) => v && typeof v === "object" && "type" in (v as object))) {
        const mapped = mapNodes(value, rows);
        if (mapped.some((v, i) => v !== value[i])) {
          props[key] = mapped;
          changed = true;
        }
      }
    }
    return changed ? { ...n, props } : node;
  });
}

/**
 * Read this module's rows for this project.
 *
 * Through the caller's own session, so RLS is what bounds it -- the policies
 * on pipeline_records are the backstop, not a filter written here. Returns an
 * empty array on any failure: a page that renders its samples is a much better
 * outcome than a page that does not render.
 */
export async function fetchLiveRows(
  supabase: SupabaseClient,
  projectId: string,
  moduleKey: string,
  workflow: string[],
  limit = 50,
): Promise<LiveRow[]> {
  if (!PIPELINE_MODULES.has(moduleKey)) return [];
  try {
    const { data, error } = await supabase
      .from("pipeline_records")
      .select("title, party, amount_cents, stage")
      .eq("project_id", projectId)
      .eq("module_key", moduleKey)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return rowsFromRecords(data as PipelineRecord[], workflow);
  } catch {
    return [];
  }
}

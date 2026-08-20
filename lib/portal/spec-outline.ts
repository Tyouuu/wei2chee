import { walkNodes, type PuckLayout, type PuckNode } from "./layout-ops";
import { PAGE_KEYS, isBuiltInPage, type PageId, type PageKey, type PageRef } from "@/lib/templates/industry-template";

/**
 * Reads a customer's finished design and states, factually, what system they
 * have designed.
 *
 * WHY THIS IS CODE AND NOT A PROMPT: this is the part of the specification a
 * developer will build from -- which pages exist, which columns each table
 * carries, what the workflow stages are, which fields get captured. Every one of
 * those facts is already sitting in the layout JSON. Asking a model to read the
 * layout and "describe the system" would be asking it to re-derive facts it can
 * only get wrong; a hallucinated column in a build specification is a bug that
 * gets built.
 *
 * So the structure is extracted here, exactly, and the model is left with the
 * one job it is actually good at: writing the prose around these facts. Same
 * division as everywhere else in this codebase.
 */

export const PAGE_TITLES: Record<PageKey, string> = {
  dashboard: "总览",
  customers: "客户",
  quotations: "报价单",
  projects: "项目 / 订单",
  payments: "收款",
  bookings: "预约",
  orders: "订单",
};

export type PageSpec = {
  pageKey: PageId;
  title: string;
  /** The page's own heading, as the customer renamed it. */
  heading: string | null;
  subtitle: string | null;
  tables: { caption: string; columns: string[]; sampleRowCount: number }[];
  workflows: { title: string | null; stages: string[] }[];
  /** Inputs the customer expects staff to fill in on this page. */
  inputs: { kind: string; label: string }[];
  metrics: { label: string; sample: string }[];
};

export type SystemSpec = {
  pages: PageSpec[];
  /** Every distinct workflow stage across the whole system, in first-seen
   *  order -- the pipeline the built system has to model. */
  workflowStages: string[];
  /** Distinct nouns the customer used, so the built system speaks their
   *  language rather than a generic CRM's. */
  vocabulary: string[];
};

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/** Human-readable names for the input components, for a reader who has never
 *  seen this editor and should not have to learn its component names. */
const INPUT_KINDS: Record<string, string> = {
  DatePicker: "日期",
  MonthPicker: "月份",
  FileUploadField: "文件上传",
  Listbox: "下拉选择",
  Combobox: "搜索选择",
  TextAutocomplete: "文字输入（含建议）",
  FilterChips: "筛选条件",
};

function specForPage(pageKey: PageId, ownTitle: string | null, layout: PuckLayout): PageSpec {
  const nodes = walkNodes(layout.content ?? []);
  const first = (type: string): PuckNode | undefined => nodes.find((n) => n.type === type);

  const header = first("PageHeader");

  const tables = nodes
    .filter((n) => n.type === "RecordTable")
    .map((n) => ({
      caption: str(n.props.caption) ?? "记录表",
      // Only the columns the table actually shows. `secondaryLabel` and
      // `amountLabel` are optional and RecordTable hides a column whose rows
      // never carry a value, so listing a label that is set but unused would
      // specify a column the customer cannot see.
      columns: [
        str(n.props.primaryLabel),
        str(n.props.secondaryLabel),
        str(n.props.amountLabel),
        str(n.props.statusColumnLabel),
      ].filter((c): c is string => Boolean(c)),
      sampleRowCount: Array.isArray(n.props.rows) ? n.props.rows.length : 0,
    }));

  const workflows = nodes
    .filter((n) => n.type === "WorkflowStrip")
    .map((n) => ({
      title: str(n.props.title),
      stages: Array.isArray(n.props.stages)
        ? (n.props.stages as { label?: string }[])
            .map((s) => str(s?.label))
            .filter((s): s is string => Boolean(s))
        : [],
    }));

  const inputs = nodes
    .filter((n) => n.type in INPUT_KINDS)
    .map((n) => ({
      kind: INPUT_KINDS[n.type],
      label:
        str(n.props.label) ??
        str(n.props.placeholder) ??
        str(n.props.hint) ??
        INPUT_KINDS[n.type],
    }));

  const metrics = nodes
    .filter((n) => n.type === "HeroCard")
    .map((n) => ({
      label: str(n.props.label) ?? "指标",
      sample: str(n.props.value) ?? "",
    }));

  return {
    pageKey,
    // A page the customer invented has no entry in PAGE_TITLES, and its name is
    // theirs -- falling back to the key would put "custom_a1b2c3d4e5f6" into a
    // document a developer is meant to build from.
    title: ownTitle?.trim() || (isBuiltInPage(pageKey) ? PAGE_TITLES[pageKey] : "自定页面"),
    heading: header ? str(header.props.title) : null,
    subtitle: header ? str(header.props.subtitle) : null,
    tables,
    workflows,
    inputs,
    metrics,
  };
}

export function buildSystemSpec(
  layouts: Partial<Record<PageId, PuckLayout>>,
  /** The business's own page set. Defaults to every known page type only for
   *  callers that genuinely have all of them -- specifying pages a business
   *  does not have would put a 「预约」section into a contractor's build brief. */
  pageRefs: readonly PageRef[] = PAGE_KEYS.map((key) => ({ key })),
): SystemSpec {
  const pages = pageRefs
    .filter((ref) => layouts[ref.key])
    .map((ref) => specForPage(ref.key, ref.title ?? null, layouts[ref.key] as PuckLayout));

  // First-seen order, deduped. A Set preserves insertion order, which is what
  // makes the result the pipeline as the customer sequenced it rather than an
  // arbitrary reordering.
  const workflowStages = [
    ...new Set(pages.flatMap((p) => p.workflows.flatMap((w) => w.stages))),
  ];

  // The customer's own nouns, taken from what they renamed things to: table
  // captions and column headings are where a business's real vocabulary ends
  // up ("师傅" rather than "员工", "病人" rather than "客户").
  const vocabulary = [
    ...new Set(pages.flatMap((p) => p.tables.flatMap((t) => [t.caption, ...t.columns]))),
  ];

  return { pages, workflowStages, vocabulary };
}

/**
 * The spec as plain text, for the model to write prose around and for the
 * founder to read directly if the model is unavailable. Deliberately readable
 * on its own: this is the fallback document, not scaffolding for one.
 */
export function specToText(spec: SystemSpec): string {
  const lines: string[] = [];

  if (spec.workflowStages.length) {
    lines.push(`业务流程：${spec.workflowStages.join(" → ")}`);
    lines.push("");
  }

  for (const page of spec.pages) {
    lines.push(`## ${page.heading ?? page.title}（${page.pageKey}）`);
    if (page.subtitle) lines.push(page.subtitle);

    for (const m of page.metrics) {
      lines.push(`- 关键数字：${m.label}${m.sample ? `（例：${m.sample}）` : ""}`);
    }
    for (const t of page.tables) {
      lines.push(`- 数据表「${t.caption}」，栏位：${t.columns.join(" / ")}`);
    }
    for (const w of page.workflows) {
      if (w.stages.length) lines.push(`- 流程：${w.stages.join(" → ")}`);
    }
    for (const i of page.inputs) {
      lines.push(`- 输入项：${i.label}（${i.kind}）`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

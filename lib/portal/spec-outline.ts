import { walkNodes, type PuckLayout, type PuckNode } from "./layout-ops";
import { normalizeTable } from "./table-model";
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

export const PAGE_TITLES_EN: Record<PageKey, string> = {
  dashboard: "Overview",
  customers: "Customers",
  quotations: "Quotations",
  projects: "Projects / Orders",
  payments: "Payments",
  bookings: "Bookings",
  orders: "Orders",
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

/* The same seven, in the language the document is being written in. The
   customer's own words are never in this table -- only the names of the
   controls, which are ours. */
const INPUT_KINDS_EN: Record<string, string> = {
  DatePicker: "date",
  MonthPicker: "month",
  FileUploadField: "file upload",
  Listbox: "dropdown",
  Combobox: "searchable select",
  TextAutocomplete: "text with suggestions",
  FilterChips: "filters",
};

function specForPage(
  pageKey: PageId,
  ownTitle: string | null,
  layout: PuckLayout,
  lang: "zh" | "en",
): PageSpec {
  const nodes = walkNodes(layout.content ?? []);
  const first = (type: string): PuckNode | undefined => nodes.find((n) => n.type === type);

  const header = first("PageHeader");

  const tables = nodes
    .filter((n) => n.type === "RecordTable")
    .map((n) => {
      // Read through normalizeTable rather than off the props directly, so a
      // page saved before columns became an array still specifies the right
      // columns -- the spec is what the build team quotes from, and a table
      // described with the wrong columns is a wrong quote.
      const table = normalizeTable(n.props);
      return {
        caption: str(n.props.caption) ?? "记录表",
        columns: table.columns.map((c) => c.label).filter(Boolean),
        sampleRowCount: table.rows.length,
      };
    });

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
      kind: (lang === "zh" ? INPUT_KINDS : INPUT_KINDS_EN)[n.type],
      label:
        str(n.props.label) ??
        str(n.props.placeholder) ??
        str(n.props.hint) ??
        (lang === "zh" ? INPUT_KINDS : INPUT_KINDS_EN)[n.type],
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
    title:
      ownTitle?.trim() ||
      (isBuiltInPage(pageKey)
        ? (lang === "zh" ? PAGE_TITLES : PAGE_TITLES_EN)[pageKey]
        : lang === "zh" ? "自定页面" : "Custom page"),
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
  /** The document's language. Names the STRUCTURE -- page titles, control
   *  names, section labels -- and never the customer's own words, which stay
   *  exactly as they typed them in both languages. */
  lang: "zh" | "en" = "zh",
): SystemSpec {
  const pages = pageRefs
    .filter((ref) => layouts[ref.key])
    .map((ref) => specForPage(ref.key, ref.title ?? null, layouts[ref.key] as PuckLayout, lang));

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
export function specToText(spec: SystemSpec, lang: "zh" | "en" = "zh"): string {
  /*
    THE STRUCTURE IS DESCRIBED IN THE DOCUMENT'S OWN LANGUAGE.

    This text is two things at once: the fallback document a founder reads when
    the model is unavailable, and the INPUT the model is given to write prose
    around. The second job is why the language matters more than it looks.

    Measured on 2026-08-26: the prompt said 「Write in English」 and the prose
    came back in Chinese every time. The prompt was not being ignored -- the
    model was following the language of the FACTS it was handed, which read
    「业务流程」, 「关键数字」, 「数据表…栏位」, 「输入项」. Naming the language in one
    line while showing the opposite in forty is not an instruction, it is a
    contradiction.

    What never changes language is the customer's OWN words -- their page
    headings, their column names, their workflow stages. Those are quoted, and
    it is the whole argument of the document: 「系统里的用词要跟客户自己的叫法一致」.
  */
  const w =
    lang === "zh"
      ? {
          flow: "业务流程：",
          metric: "关键数字：",
          eg: (v: string) => `（例：${v}）`,
          table: (c: string) => `数据表「${c}」，栏位：`,
          stage: "流程：",
          input: "输入项：",
          of: (k: string) => `（${k}）`,
        }
      : {
          flow: "Workflow: ",
          metric: "Key figure: ",
          eg: (v: string) => ` (e.g. ${v})`,
          table: (c: string) => `Table 「${c}」, columns: `,
          stage: "Workflow: ",
          input: "Input: ",
          of: (k: string) => ` (${k})`,
        };

  const lines: string[] = [];

  if (spec.workflowStages.length) {
    lines.push(`${w.flow}${spec.workflowStages.join(" → ")}`);
    lines.push("");
  }

  for (const page of spec.pages) {
    lines.push(`## ${page.heading ?? page.title} (${page.pageKey})`);
    if (page.subtitle) lines.push(page.subtitle);

    for (const m of page.metrics) {
      lines.push(`- ${w.metric}${m.label}${m.sample ? w.eg(m.sample) : ""}`);
    }
    for (const t of page.tables) {
      lines.push(`- ${w.table(t.caption)}${t.columns.join(" / ")}`);
    }
    for (const wf of page.workflows) {
      if (wf.stages.length) lines.push(`- ${w.stage}${wf.stages.join(" → ")}`);
    }
    for (const i of page.inputs) {
      lines.push(`- ${w.input}${i.label}${w.of(i.kind)}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

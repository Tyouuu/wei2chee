import type { SupabaseClient } from "@supabase/supabase-js";
import { ringgit } from "./live-rows";
import type { LiveStats } from "./live-stats";

/**
 * 对账's headline and its verdict, from the same view the table reads.
 *
 * ── WHY THIS EXISTS AS WELL AS THE ROWS ───────────────────────────────────
 *
 * The page has three parts and the rows were only one of them. Photographed
 * the day the table went live: 「Sep 2026 · Maybank … We are short RM 20,800」
 * in the table, and directly above it a headline reading 「Difference this
 * month RM 0 · System total RM 246,800 · 128 entries」 -- the sample figure
 * every customer in this product shares -- and under that a panel asserting
 * 「This month ties out. Your total and the upstream statement agree.」
 *
 * Three statements on one screen, two of them untrue, and the untrue two are
 * the ones a person reads first. 任务 80 already named this exact shape: a
 * table of samples announces itself and a total does not.
 *
 * ── AND WHY THE PANEL IS HERE RATHER THAN LEFT ALONE ──────────────────────
 *
 * It is not decoration. buildFromShape gives 对账 an Alert instead of a
 * paragraph precisely because 「对得上 / 对不上」 is a STATE -- the one place in
 * the system where the answer IS the whole page. A state block that states the
 * wrong state is worse than no block.
 */

/* ⚠️ A TILE'S TONE IS NOT A ROW'S TONE. LiveStat uses good | warn | bad |
   normal and LiveRow uses positive | warning | negative | neutral -- two
   vocabularies for one idea, which TypeScript caught here and would not have
   caught if either had been a bare string. */
export type ReconcileFacts = {
  stats: LiveStats;
  /** What the state panel should say now. */
  alert: { title: string; description: string; variant: "default" | "warning" };
};

const WORDS = {
  zh: {
    gap: "本月差额",
    ours: "我们的账",
    theirs: "他们讲的",
    entries: "笔数",
    entriesN: (n: number) => `${n} 笔`,
    versus: (source: string) => (source ? `对 ${source}` : "对上游"),
    tiesTitle: "这个月对得上",
    tiesBody: (source: string) =>
      `你的总数跟${source || "上游"}给的数字一样。`,
    offTitle: (amount: string, over: boolean) =>
      over ? `我们比他们多 ${amount}` : `我们比他们少 ${amount}`,
    offBody: "差额还没解释。查完可以在这一笔上按「结了」，说明写在备注里。",
    settledTitle: "这个月结了",
    settledBody: "你已经看过并且接受了这个月的差额。",
    noneTitle: "还没有对账",
    noneBody: "把上游或银行给的总数记一笔，这一页就会告诉你差多少。",
  },
  en: {
    gap: "Difference this month",
    ours: "Our books",
    theirs: "What they say",
    entries: "Entries",
    entriesN: (n: number) => `${n} ${n === 1 ? "entry" : "entries"}`,
    versus: (source: string) => (source ? `against ${source}` : "against upstream"),
    tiesTitle: "This month ties out",
    tiesBody: (source: string) =>
      `Your total and the figure ${source || "upstream"} gave you are the same.`,
    offTitle: (amount: string, over: boolean) =>
      over ? `We are over by ${amount}` : `We are short by ${amount}`,
    offBody:
      "The difference is not explained yet. Once you have found it, mark the month settled and write what it was in the note.",
    settledTitle: "This month is settled",
    settledBody: "You have looked at this month's difference and accepted it.",
    noneTitle: "Nothing to reconcile yet",
    noneBody:
      "Record the total your upstream or your bank gave you and this page will tell you how far apart you are.",
  },
};

/**
 * The newest month, because that is the statement in his hand.
 *
 * Returns `undefined` when the query failed and `null` when there is genuinely
 * nothing -- the same three-way answer live-months uses, and the difference
 * matters: a failed read must leave the page exactly as it was rather than
 * report zero, because 「we could not ask」 and 「the answer is nothing」 are
 * different sentences and only one of them is ever true here.
 */
export async function fetchReconcileFacts(
  supabase: SupabaseClient,
  projectId: string,
  moduleKey: string,
  lang: "zh" | "en" = "zh",
): Promise<ReconcileFacts | null | undefined> {
  const { data, error } = await supabase
    .from("reconciliation_lines")
    .select("period, source, their_cents, ours_cents, entries, settled_at")
    .eq("project_id", projectId)
    .eq("module_key", moduleKey)
    .is("archived_at", null)
    .order("period", { ascending: false })
    .limit(1);

  if (error) return undefined;
  if (!data || data.length === 0) return null;

  const r = data[0] as {
    source: string | null;
    their_cents: number | string | null;
    ours_cents: number | string | null;
    entries: number | string | null;
    settled_at: string | null;
  };
  const w = WORDS[lang];
  const theirs = Number(r.their_cents ?? 0);
  const ours = Number(r.ours_cents ?? 0);
  const entries = Number(r.entries ?? 0);
  const gap = ours - theirs;
  const source = (r.source ?? "").trim();

  return {
    stats: {
      tiles: [
        {
          label: w.gap,
          /* The absolute figure, with the direction carried by the words rather
             than by a minus sign. 「-RM 300」 in a headline is read as a
             negative balance rather than as a gap. */
          value: ringgit(Math.abs(gap)) ?? "RM 0",
          deltaLabel: w.versus(source),
          tone: gap === 0 || r.settled_at ? "good" : "warn",
          icon: "reconcile",
        },
        { label: w.ours, value: ringgit(ours) ?? "RM 0", tone: "normal", icon: "money" },
        { label: w.theirs, value: ringgit(theirs) ?? "RM 0", tone: "normal", icon: "file" },
        { label: w.entries, value: w.entriesN(entries), tone: "normal", icon: "list" },
      ],
      /* NO CHART. Reconciliation is a comparison of two figures, and a trend
         line drawn through one month of it would be a shape invented out of a
         single point. The page's own composition draws no chart either. */
      trend: [],
    },
    alert: r.settled_at
      ? { title: w.settledTitle, description: w.settledBody, variant: "default" }
      : gap === 0
        ? { title: w.tiesTitle, description: w.tiesBody(source), variant: "default" }
        : {
            title: w.offTitle(ringgit(Math.abs(gap)) ?? "RM 0", gap > 0),
            description: w.offBody,
            variant: "warning",
          },
  };
}

/**
 * Put the verdict on the state panel.
 *
 * ⚠️ KEYED ON THE NODE'S ID, not on the type. `Alert` is a general block a
 * customer can place anywhere on any page, and rewriting every one of them
 * would replace whatever they wrote with a sentence about reconciliation. Only
 * the panel buildFromShape names `<page>-variance` is the verdict.
 */
export function withReconcileAlert(
  tree: Record<string, unknown>,
  alert: ReconcileFacts["alert"] | null,
): Record<string, unknown> {
  if (!alert) return tree;
  const content = (tree as { content?: unknown }).content;
  if (!Array.isArray(content)) return tree;

  let touched = false;
  const walk = (nodes: unknown[]): unknown[] =>
    nodes.map((node) => {
      const n = node as { type?: string; props?: Record<string, unknown> };
      if (!n || typeof n !== "object" || !n.props) return node;

      if (n.type === "Alert" && String(n.props.id ?? "").endsWith("-variance")) {
        touched = true;
        return {
          ...n,
          props: {
            ...n.props,
            title: alert.title,
            description: alert.description,
            variant: alert.variant,
          },
        };
      }

      let changed = false;
      const props: Record<string, unknown> = { ...n.props };
      for (const [key, value] of Object.entries(n.props)) {
        if (Array.isArray(value) && value.some((v) => v && typeof v === "object" && "type" in (v as object))) {
          const mapped = walk(value);
          if (mapped.some((v, i) => v !== value[i])) {
            props[key] = mapped;
            changed = true;
          }
        }
      }
      return changed ? { ...n, props } : node;
    });

  const next = walk(content);
  return touched ? { ...tree, content: next } : tree;
}

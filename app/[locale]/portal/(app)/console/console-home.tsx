"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { PageBar } from "../page-bar";
import { STAGES, StageSelect, stageTone } from "./stage";
import { formatDay } from "@/lib/format-date";
import { MODULE_BY_KEY, type ModuleShape } from "@/lib/portal/module-catalog";

type Customer = {
  project_id: string;
  email: string;
  business_name: string | null;
  owner_name: string | null;
  industry_name: string | null;
  industry_name_en: string | null;
  style: string | null;
  paid: boolean;
  stage: string;
  dev_fee_myr: number;
  monthly_fee_myr: number;
  page_count: number;
  founder_note: string | null;
  created_at: string;
  updated_at: string | null;
};

const money = (n: number) => `RM ${Number(n || 0).toLocaleString("en-MY")}`;

/*
  THE ORDER SHAPES ARE LISTED IN IS THE ORDER THEY ARE WORTH BUILDING.

  Sorted by demand at render time, not hard-coded, because the whole point of
  the section is that the answer changes as customers arrive. The catalogue's
  own order is alphabetical-by-accident and would put `overview` -- the one
  module every system gets for free and which therefore carries no information
  -- at the top of a list headed "what to build next".
*/
type ShapeRow = { shape: ModuleShape; systems: number; modules: { key: string; n: number }[] };

/**
 * Group per-module counts into per-shape counts.
 *
 * WHY THIS MAPPING LIVES HERE AND NOT IN SQL. `shape` is declared exactly once,
 * in lib/portal/module-catalog.ts. Teaching console_overview() the module ->
 * shape mapping would make a second copy that drifts the first time a module is
 * added, so the RPC counts page keys and this function does the only thing that
 * needs the catalogue.
 *
 * An unknown key is DROPPED, not bucketed into an "other" row: page keys come
 * from the catalogue, so a key that is not in it is a module that was removed,
 * and counting a deleted module towards a build decision is worse than not
 * counting it. It stays visible in the per-module lists of the shapes it maps
 * to, which is nowhere -- and that is the correct amount of attention.
 */
function toShapeRows(counts: Record<string, number>): ShapeRow[] {
  const rows = new Map<ModuleShape, ShapeRow>();
  for (const [key, n] of Object.entries(counts)) {
    const archetype = MODULE_BY_KEY[key];
    if (!archetype || !n) continue;
    const row = rows.get(archetype.shape) ?? { shape: archetype.shape, systems: 0, modules: [] };
    row.systems += n;
    row.modules.push({ key, n });
    rows.set(archetype.shape, row);
  }
  return [...rows.values()]
    .map((r) => ({ ...r, modules: r.modules.sort((a, b) => b.n - a.n) }))
    .sort((a, b) => b.systems - a.systems || b.modules.length - a.modules.length);
}

/** Below this many systems the ranking is noise, and the screen says so rather
 *  than drawing a confident bar chart over two demo accounts. */
const ENOUGH_SYSTEMS_TO_DECIDE = 5;

export function ConsoleHome({
  locale,
  overview,
  customers,
}: {
  locale: string;
  overview: Record<string, unknown>;
  customers: Customer[];
}) {
  const t = useTranslations("portal.console");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const byStage = (overview.by_stage ?? {}) as Record<string, number>;
  const num = (k: string) => Number(overview[k] ?? 0);

  const built = toShapeRows((overview.modules_built ?? {}) as Record<string, number>);
  const systems = num("systems_counted");
  const analysesTotal = num("analyses_total");
  const analysesWithModules = num("analyses_with_modules");
  const lang = locale === "zh" ? "zh" : "en";
  const moduleName = (key: string) => {
    const a = MODULE_BY_KEY[key];
    if (!a) return key;
    return lang === "en" ? a.labelEn || a.label : a.label;
  };

  async function setStage(projectId: string, stage: string) {
    setBusy(projectId);
    const { error } = await createBrowserSupabaseClient().rpc("console_set_stage", {
      target_project_id: projectId,
      new_stage: stage,
    });
    setBusy(null);
    if (!error) router.refresh();
  }

  const fmtDate = (iso: string | null) => (iso ? formatDay(iso, locale) : "—");

  return (
    <>
      <PageBar title={t("title")} subtitle={t("subtitle")}>
        <Link
          href={`/${locale}/portal/console/leads`}
          className="rounded-[var(--radius-md)] border px-3 py-1.5 [font-size:var(--text-xs)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] transition-colors hover:[border-color:var(--color-primary)]"
        >
          {t("leadsCta", { count: num("leads_total") })}
        </Link>
      </PageBar>

      <div className="px-8 py-7">
        {/* MONEY FIRST. This screen answers "how is the business doing" before
            it answers anything else, and every other admin panel that buries
            revenue under a table gets skimmed instead of read. */}
        <dl className="grid gap-px overflow-hidden rounded-[var(--radius-md)] [background-color:var(--color-ink-800)] sm:grid-cols-2 lg:grid-cols-5">
          <Stat label={t("statLeads")} value={String(num("leads_total"))} note={t("statLeadsNote", { analyzed: num("leads_analyzed"), converted: num("leads_converted") })} />
          <Stat label={t("statCustomers")} value={String(num("customers_total"))} note={t("statCustomersNote", { paid: num("customers_paid") })} />
          <Stat label={t("statDevRevenue")} value={money(num("revenue_dev"))} note={t("statDevRevenueNote")} tone="good" />
          <Stat label={t("statMrr")} value={money(num("revenue_monthly"))} note={t("statMrrNote")} tone="good" />
          <Stat
            label={t("statConversion")}
            value={num("leads_total") ? `${Math.round((num("leads_converted") / num("leads_total")) * 100)}%` : "—"}
            note={t("statConversionNote")}
          />
        </dl>

        {/* The pipeline, as counts rather than as a board. A kanban with one
            card in it is theatre; this is the same information at the size the
            business actually is, and it stays readable at fifty. */}
        <section className="mt-8">
          <h2 className="[font-size:var(--text-sm)] uppercase tracking-[0.13em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
            {t("pipelineTitle")}
          </h2>
          <ol className="mt-3 flex flex-wrap items-stretch gap-2">
            {STAGES.map((stage, i) => (
              <li key={stage} className="flex items-center gap-2">
                <div className="min-w-[104px] rounded-[var(--radius-md)] border px-3.5 py-2.5 [border-color:var(--color-ink-800)] [background-color:var(--color-ink-900)]">
                  <span className="block [font-size:var(--text-micro)] uppercase tracking-[0.12em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
                    {t(`stage.${stage}`)}
                  </span>
                  <span
                    className={`mt-1 block [font-size:var(--text-title)] leading-none [font-weight:var(--fw-semibold)] ${
                      byStage[stage] ? stageTone(stage) : "[color:var(--color-ink-700)]"
                    }`}
                  >
                    {byStage[stage] ?? 0}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <span aria-hidden="true" className="[color:var(--color-ink-700)]">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* WHAT TO BUILD NEXT.

            The console counted money and stages and not one module. But the 17
            modules collapse into 10 shapes -- pipeline alone covers quotations,
            orders, projects and tasks -- so making ONE shape genuinely run is
            four modules at once. Which shape to make run first is the single
            most load-bearing decision in the roadmap, and until now the only
            way to see it was to open every customer in turn and count by hand.

            Counted from what customers actually HAVE, not from what the AI
            proposed: `modules` on analysis_results was added later and is null
            on 8 of 10 rows, while project_pages is complete and is measured
            after the customer edited. The proposed figures are shown as a
            coverage line underneath rather than as a second chart, because a
            chart over 2 of 10 rows next to a chart over all of them invites
            reading them as equals. */}
        <section className="mt-9">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="[font-size:var(--text-sm)] uppercase tracking-[0.13em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
              {t("shapesTitle")}
            </h2>
            <span className="[font-size:var(--text-xs)] [color:var(--color-paper-dim)]">
              {t("shapesDenominator", { systems })}
            </span>
          </div>

          {built.length === 0 ? (
            <p className="mt-4 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
              {t("shapesEmpty")}
            </p>
          ) : (
            <>
              {systems < ENOUGH_SYSTEMS_TO_DECIDE && (
                <p className="mt-3 [font-size:var(--text-xs)] [color:var(--color-amber-bright,var(--color-paper-dim))]">
                  {t("shapesTooEarly", { needed: ENOUGH_SYSTEMS_TO_DECIDE })}
                </p>
              )}
              <ol className="mt-4 grid gap-px overflow-hidden rounded-[var(--radius-md)] [background-color:var(--color-ink-800)]">
                {built.map((row, i) => (
                  <li
                    key={row.shape}
                    className="grid grid-cols-[7.5rem_2.5rem_1fr] items-baseline gap-3 [background-color:var(--color-ink-900)] px-4 py-3"
                  >
                    <span className="font-mono [font-size:var(--text-xs)] [color:var(--color-paper)] [font-weight:var(--fw-semibold)]">
                      {row.shape}
                    </span>
                    <span
                      className={`text-right tabular-nums [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] ${
                        i === 0 ? "[color:var(--color-jade-bright)]" : "[color:var(--color-paper)]"
                      }`}
                    >
                      {row.systems}
                    </span>
                    {/* The gloss started on --color-ink-700 and the screenshot
                        showed why that was wrong: ink-700 is the token for the
                        「·」 between two numbers, and this is a sentence that
                        teaches what a shape IS -- the one thing on the row a
                        reader who has not met the vocabulary needs. Separator
                        colour on load-bearing text is how a caption becomes
                        decoration. */}
                    <span className="[font-size:var(--text-xs)] [color:var(--color-paper)]">
                      {row.modules.map((m) => `${moduleName(m.key)} ${m.n}`).join(" · ")}
                      <span className="ml-2 [color:var(--color-paper-dim)]">{t(`shapeGloss.${row.shape}`)}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 [font-size:var(--text-xs)] [color:var(--color-paper-dim)]">
                {t("shapesProposedCoverage", {
                  with: analysesWithModules,
                  total: analysesTotal,
                })}
              </p>
            </>
          )}
        </section>

        <section className="mt-9">
          <h2 className="[font-size:var(--text-sm)] uppercase tracking-[0.13em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
            {t("customersTitle")}
            <span className="ml-2 opacity-60">{customers.length}</span>
          </h2>

          {customers.length === 0 ? (
            <p className="mt-4 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
              {t("noCustomers")}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-[var(--radius-md)] border [border-color:var(--color-ink-800)]">
              <table className="w-full min-w-[880px] border-collapse [font-size:var(--text-sm)]">
                <thead>
                  <tr className="[background-color:var(--color-ink-900)]">
                    {["colBusiness", "colIndustry", "colPages", "colStage", "colFees", "colUpdated"].map((k) => (
                      <th
                        key={k}
                        className="border-b px-4 py-2.5 text-left [font-size:var(--text-micro)] uppercase tracking-[0.12em] [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]"
                      >
                        {t(k)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.project_id} className="[&:not(:last-child)]:border-b [&:not(:last-child)]:[border-color:var(--color-ink-850)]">
                      <td className="px-4 py-3">
                        <Link
                          href={`/${locale}/portal/console/${c.project_id}`}
                          className="block [color:var(--color-paper)] [font-weight:var(--fw-medium)] hover:[color:var(--color-primary)]"
                        >
                          {c.business_name || t("unnamed")}
                        </Link>
                        <span className="block [font-size:var(--text-xs)] [color:var(--color-paper-dim)]">{c.email}</span>
                      </td>
                      {/* Both names come back from console_customers. Reading
                          name_zh unconditionally printed 装修/承包商 in a column
                          headed TRADE on the English portal -- and check:en
                          could not see it, because it signs in as a CUSTOMER
                          and every console route 404s for that account. */}
                      <td className="px-4 py-3 [color:var(--color-paper-dim)]">
                        {(lang === "en" ? c.industry_name_en || c.industry_name : c.industry_name) ?? "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums [color:var(--color-paper-dim)]">{c.page_count}</td>
                      <td className="px-4 py-3">
                        <StageSelect
                          value={c.stage}
                          disabled={busy === c.project_id}
                          onChange={(next) => setStage(c.project_id, next)}
                        />
                      </td>
                      <td className="px-4 py-3 tabular-nums [color:var(--color-paper-dim)]">
                        {money(c.dev_fee_myr)}
                        <span className="[color:var(--color-ink-700)]"> · </span>
                        {t("perMonth", { amount: money(c.monthly_fee_myr) })}
                      </td>
                      <td className="px-4 py-3 tabular-nums [color:var(--color-paper-dim)]">
                        {fmtDate(c.updated_at ?? c.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "good";
}) {
  return (
    <div className="[background-color:var(--color-ink-900)] px-4 py-3.5">
      <dt className="[font-size:var(--text-micro)] uppercase tracking-[0.12em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
        {label}
      </dt>
      <dd
        className={`mt-1.5 [font-size:var(--text-title)] leading-none tabular-nums [font-weight:var(--fw-semibold)] ${
          tone === "good" ? "[color:var(--color-jade-bright)]" : "[color:var(--color-paper)]"
        }`}
      >
        {value}
      </dd>
      {note && <p className="mt-2 [font-size:var(--text-xs)] [color:var(--color-paper-dim)]">{note}</p>}
    </div>
  );
}

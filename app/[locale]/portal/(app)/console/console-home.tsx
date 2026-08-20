"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { PageBar } from "../page-bar";
import { STAGES, StageSelect, stageTone } from "./stage";
import { formatDay } from "@/lib/format-date";

type Customer = {
  project_id: string;
  email: string;
  business_name: string | null;
  owner_name: string | null;
  industry_name: string | null;
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
          className="rounded-[7px] border px-3 py-1.5 text-[12.5px] [border-color:var(--color-ink-800)] [color:var(--color-paper)] transition-colors hover:[border-color:var(--color-primary)]"
        >
          {t("leadsCta", { count: num("leads_total") })}
        </Link>
      </PageBar>

      <div className="px-8 py-7">
        {/* MONEY FIRST. This screen answers "how is the business doing" before
            it answers anything else, and every other admin panel that buries
            revenue under a table gets skimmed instead of read. */}
        <dl className="grid gap-px overflow-hidden rounded-[9px] [background-color:var(--color-ink-800)] sm:grid-cols-2 lg:grid-cols-5">
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
          <h2 className="text-[13px] uppercase tracking-[0.13em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
            {t("pipelineTitle")}
          </h2>
          <ol className="mt-3 flex flex-wrap items-stretch gap-2">
            {STAGES.map((stage, i) => (
              <li key={stage} className="flex items-center gap-2">
                <div className="min-w-[104px] rounded-[9px] border px-3.5 py-2.5 [border-color:var(--color-ink-800)] [background-color:var(--color-ink-900)]">
                  <span className="block text-[10.5px] uppercase tracking-[0.12em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
                    {t(`stage.${stage}`)}
                  </span>
                  <span
                    className={`mt-1 block text-[20px] leading-none [font-weight:var(--fw-semibold)] ${
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

        <section className="mt-9">
          <h2 className="text-[13px] uppercase tracking-[0.13em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
            {t("customersTitle")}
            <span className="ml-2 opacity-60">{customers.length}</span>
          </h2>

          {customers.length === 0 ? (
            <p className="mt-4 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
              {t("noCustomers")}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-[9px] border [border-color:var(--color-ink-800)]">
              <table className="w-full min-w-[880px] border-collapse text-[13px]">
                <thead>
                  <tr className="[background-color:var(--color-ink-900)]">
                    {["colBusiness", "colIndustry", "colPages", "colStage", "colFees", "colUpdated"].map((k) => (
                      <th
                        key={k}
                        className="border-b px-4 py-2.5 text-left text-[10.5px] uppercase tracking-[0.12em] [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]"
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
                        <span className="block text-[11.5px] [color:var(--color-paper-dim)]">{c.email}</span>
                      </td>
                      <td className="px-4 py-3 [color:var(--color-paper-dim)]">{c.industry_name ?? "—"}</td>
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
                        {money(c.monthly_fee_myr)}/月
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
      <dt className="text-[10.5px] uppercase tracking-[0.12em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
        {label}
      </dt>
      <dd
        className={`mt-1.5 text-[19px] leading-none tabular-nums [font-weight:var(--fw-semibold)] ${
          tone === "good" ? "[color:var(--color-jade-bright)]" : "[color:var(--color-paper)]"
        }`}
      >
        {value}
      </dd>
      {note && <p className="mt-2 text-[11.5px] [color:var(--color-paper-dim)]">{note}</p>}
    </div>
  );
}

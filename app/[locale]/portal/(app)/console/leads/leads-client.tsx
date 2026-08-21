"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageBar } from "../../page-bar";
import { formatDayTime } from "@/lib/format-date";

type Lead = {
  id: string;
  created_at: string;
  language: string;
  industry_name: string | null;
  style_selected: string | null;
  answers: Record<string, unknown> | null;
  summary: string | null;
  bottlenecks: { title: string; description: string }[] | null;
  converted: boolean;
  account_email: string | null;
};

export function LeadsClient({ locale, leads }: { locale: string; leads: Lead[] }) {
  const t = useTranslations("portal.console");
  const [open, setOpen] = useState<string | null>(null);
  const [onlyUnconverted, setOnlyUnconverted] = useState(false);

  const shown = onlyUnconverted ? leads.filter((l) => !l.converted) : leads;
  const unconverted = leads.filter((l) => !l.converted).length;

  return (
    <>
      <PageBar title={t("leadsTitle")} subtitle={t("leadsSubtitle", { count: leads.length, unconverted })}>
        <label className="flex items-center gap-2 [font-size:var(--text-xs)] [color:var(--color-paper-dim)]">
          <input
            type="checkbox"
            checked={onlyUnconverted}
            onChange={(e) => setOnlyUnconverted(e.target.checked)}
            className="accent-[var(--color-primary)]"
          />
          {t("onlyUnconverted")}
        </label>
        <Link
          href={`/${locale}/portal/console`}
          className="rounded-[var(--radius-md)] px-3 py-1.5 [font-size:var(--text-xs)] [color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
        >
          ← {t("title")}
        </Link>
      </PageBar>

      <div className="px-8 py-7">
        {shown.length === 0 ? (
          <p className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)]">{t("noLeads")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((lead) => {
              const isOpen = open === lead.id;
              // Answers are a free-shape jsonb written by the questionnaire, so
              // they are rendered as key/value rather than mapped to a fixed
              // set of fields the form might no longer have.
              const answers = Object.entries(lead.answers ?? {}).filter(
                ([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0),
              );
              return (
                <li
                  key={lead.id}
                  className="rounded-[var(--radius-md)] border [border-color:var(--color-ink-800)] [background-color:var(--color-ink-900)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="[color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
                          {lead.industry_name ?? t("unknownIndustry")}
                        </span>
                        <span className="rounded-full px-2 py-0.5 [font-size:var(--text-micro)] uppercase tracking-[0.1em] [background-color:var(--color-ink-850)] [color:var(--color-paper-dim)]">
                          {lead.language}
                        </span>
                        {lead.converted ? (
                          <span className="rounded-full px-2 py-0.5 [font-size:var(--text-micro)] [background-color:var(--color-primary-soft)] [color:var(--color-jade-bright)] [font-weight:var(--fw-semibold)]">
                            {t("converted")}
                          </span>
                        ) : (
                          <span className="rounded-full px-2 py-0.5 [font-size:var(--text-micro)] [background-color:var(--color-ink-850)] [color:var(--color-brass-bright)]">
                            {t("notConverted")}
                          </span>
                        )}
                      </div>

                      {/* The AI's own sentence about this business. It is the
                          single most useful thing on the row and it has never
                          been visible outside a table editor. */}
                      {lead.summary ? (
                        <p className="mt-2 max-w-3xl border-l-2 pl-3 [border-color:var(--color-primary)] [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
                          {lead.summary}
                        </p>
                      ) : (
                        <p className="mt-2 [color:var(--color-paper-dim)] [font-size:var(--text-sm)] opacity-70">
                          {t("noAnalysis")}
                        </p>
                      )}

                      {lead.account_email && (
                        <p className="mt-2 [font-size:var(--text-xs)] [color:var(--color-paper-dim)] [font-family:var(--font-mono)]">
                          {lead.account_email}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <time
                        dateTime={lead.created_at}
                        className="tabular-nums [font-size:var(--text-xs)] [color:var(--color-paper-dim)]"
                      >
                        {formatDayTime(lead.created_at, locale)}
                      </time>
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : lead.id)}
                        aria-expanded={isOpen}
                        className="rounded-[var(--radius-sm)] border px-2.5 py-1 [font-size:var(--text-xs)] [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] hover:[color:var(--color-paper)]"
                      >
                        {isOpen ? t("collapse") : t("expand")}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t px-4 py-4 [border-color:var(--color-ink-800)]">
                      {lead.bottlenecks?.length ? (
                        <>
                          <h3 className="[font-size:var(--text-micro)] uppercase tracking-[0.12em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
                            {t("bottlenecks")}
                          </h3>
                          <ul className="mt-2 flex flex-col gap-2">
                            {lead.bottlenecks.map((b, i) => (
                              <li key={i} className="max-w-3xl">
                                <span className="[color:var(--color-brass-bright)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
                                  {b.title}
                                </span>
                                <span className="ml-2 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
                                  {b.description}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : null}

                      <h3 className="mt-5 [font-size:var(--text-micro)] uppercase tracking-[0.12em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
                        {t("answers")}
                      </h3>
                      {answers.length === 0 ? (
                        <p className="mt-2 [color:var(--color-paper-dim)] [font-size:var(--text-sm)] opacity-70">
                          {t("noAnswers")}
                        </p>
                      ) : (
                        <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                          {answers.map(([key, value]) => (
                            <div key={key} className="min-w-0">
                              <dt className="[font-size:var(--text-xs)] [color:var(--color-paper-dim)] [font-family:var(--font-mono)]">
                                {key}
                              </dt>
                              <dd className="[color:var(--color-paper)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
                                {Array.isArray(value) ? value.join("、") : String(value)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Data } from "@puckeditor/core";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { WHATSAPP_NUMBER } from "@/lib/brand";
import { PagePreview } from "../../../page-preview";
import { PageBar } from "../../page-bar";
import { StageSelect } from "../stage";
import styles from "@/app/[locale]/style-picker/style-scope.module.css";
import chrome from "../../../chrome.module.css";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { scopeClasses } from "@/lib/portal/palettes";

type Page = {
  pageKey: string;
  label: string;
  isDraft: boolean;
  updatedAt: string | null;
  layout: Data;
};

export function CustomerDetail({
  locale,
  projectId,
  email,
  businessName,
  ownerName,
  industryName,
  summary,
  style,
  palette,
  stage,
  devFee,
  monthlyFee,
  note,
  pages,
  specText,
}: {
  locale: string;
  projectId: string;
  email: string;
  businessName: string | null;
  ownerName: string | null;
  industryName: string | null;
  summary: string | null;
  style: StyleName;
  /** The customer's 配色 layer, or null for this layout's native colours.
   *  Threaded from the server rather than fetched again: the same projects row
   *  supplies `style`, and a second query would be a second source of truth. */
  palette: string | null;
  stage: string;
  devFee: number;
  monthlyFee: number;
  note: string | null;
  pages: Page[];
  /** The structural specification, extracted from the layouts rather than
   *  written by a model — see this route's server component for why. */
  specText: string;
}) {
  const t = useTranslations("portal.console");
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [dev, setDev] = useState(String(devFee));
  const [monthly, setMonthly] = useState(String(monthlyFee));
  const [noteDraft, setNoteDraft] = useState(note ?? "");
  const [saved, setSaved] = useState<string | null>(null);

  const supabase = () => createBrowserSupabaseClient();

  async function setStage(next: string) {
    setBusy(true);
    await supabase().rpc("console_set_stage", { target_project_id: projectId, new_stage: next });
    setBusy(false);
    router.refresh();
  }

  async function saveFees() {
    setBusy(true);
    const { error } = await supabase().rpc("console_set_fees", {
      target_project_id: projectId,
      new_dev_fee: Number(dev) || 0,
      new_monthly_fee: Number(monthly) || 0,
    });
    setBusy(false);
    setSaved(error ? null : "fees");
    router.refresh();
  }

  async function saveNote() {
    setBusy(true);
    const { error } = await supabase().rpc("console_set_note", {
      target_project_id: projectId,
      new_note: noteDraft,
    });
    setBusy(false);
    setSaved(error ? null : "note");
  }

  const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `你好，关于你的系统（${businessName || email}）`,
  )}`;

  return (
    <>
      <PageBar title={businessName || t("unnamed")} subtitle={email}>
        <StageSelect value={stage} disabled={busy} onChange={setStage} />
        <Link
          href={`/${locale}/portal/console`}
          className="rounded-[var(--radius-md)] px-3 py-1.5 [font-size:var(--text-xs)] [color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
        >
          ← {t("title")}
        </Link>
      </PageBar>

      <div className="px-8 py-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {summary && (
              <p className="max-w-3xl border-l-2 pl-3.5 [border-color:var(--color-primary)] [color:var(--color-paper-dim)] [font-size:var(--text-base)] [line-height:var(--leading-body)]">
                {summary}
              </p>
            )}

            {/* THE THING THAT WAS IMPOSSIBLE. Their actual pages, rendered in
                their own chosen style. */}
            <section className="mt-7">
              <h2 className="[font-size:var(--text-sm)] uppercase tracking-[0.13em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
                {t("theirDesign")}
                <span className="ml-2 opacity-60">{pages.length}</span>
              </h2>

              <ul className="mt-4 grid items-start gap-5 2xl:grid-cols-2">
                {pages.map((page) => (
                  <li
                    key={page.pageKey}
                    className={`overflow-hidden rounded-[var(--radius-lg)] [background-color:var(--color-ink-900)] [border:1px_solid_var(--color-ink-800)]`}
                  >
                    <div className={`${chrome.mount} m-3 mb-0`}>
                      <div className={scopeClasses(style, palette)}>
                        <PagePreview data={page.layout} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-2.5">
                      <span className="min-w-0">
                        <span className="block truncate [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
                          {page.label}
                        </span>
                        <span className="block [font-size:var(--text-xs)] [color:var(--color-paper-dim)] [font-family:var(--font-mono)]">
                          {page.pageKey}
                        </span>
                      </span>
                      {/* Draft vs saved is the difference between "this is what
                          we generated for them" and "this is what they decided",
                          which is exactly what a build brief has to distinguish. */}
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 [font-size:var(--text-micro)] ${
                          page.isDraft
                            ? "[background-color:var(--color-ink-850)] [color:var(--color-paper-dim)]"
                            : "[background-color:var(--color-primary-soft)] [color:var(--color-jade-bright)] [font-weight:var(--fw-semibold)]"
                        }`}
                      >
                        {page.isDraft ? t("pageDraft") : t("pageSaved")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-9">
              <h2 className="[font-size:var(--text-sm)] uppercase tracking-[0.13em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
                {t("buildBrief")}
              </h2>
              <p className="mt-2 max-w-2xl [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
                {t("buildBriefNote")}
              </p>
              <pre className="mt-3 max-h-[420px] overflow-auto rounded-[var(--radius-md)] border px-4 py-3.5 [font-size:var(--text-xs)] leading-relaxed [border-color:var(--color-ink-800)] [background-color:var(--color-ink-900)] [color:var(--color-paper)] [font-family:var(--font-mono)] whitespace-pre-wrap">
                {specText || t("noSpec")}
              </pre>
            </section>
          </div>

          {/* ---- the operator column ---- */}
          <aside className="flex flex-col gap-5">
            <Panel title={t("facts")}>
              <Fact label={t("factIndustry")} value={industryName ?? "—"} />
              <Fact label={t("factOwner")} value={ownerName ?? "—"} />
              <Fact label={t("factStyle")} value={style} />
              <Fact label={t("factEmail")} value={email} mono />
            </Panel>

            <Panel title={t("fees")}>
              <label className="flex flex-col gap-1">
                <span className="[font-size:var(--text-xs)] [color:var(--color-paper-dim)]">{t("devFee")}</span>
                <input
                  value={dev}
                  onChange={(e) => setDev(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  className={inputClass}
                />
              </label>
              <label className="mt-3 flex flex-col gap-1">
                <span className="[font-size:var(--text-xs)] [color:var(--color-paper-dim)]">{t("monthlyFee")}</span>
                <input
                  value={monthly}
                  onChange={(e) => setMonthly(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  className={inputClass}
                />
              </label>
              <button type="button" onClick={saveFees} disabled={busy} className={btnClass}>
                {saved === "fees" ? t("saved") : t("save")}
              </button>
            </Panel>

            <Panel title={t("note")}>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder={t("notePlaceholder")}
                className={`${inputClass} resize-none leading-relaxed`}
              />
              <button type="button" onClick={saveNote} disabled={busy} className={btnClass}>
                {saved === "note" ? t("saved") : t("save")}
              </button>
            </Panel>

            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[var(--radius-md)] px-4 py-2.5 text-center [font-size:var(--text-sm)] [background-color:var(--color-jade)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)]"
            >
              {t("whatsapp")}
            </a>
          </aside>
        </div>
      </div>
    </>
  );
}

const inputClass =
  "w-full rounded-[var(--radius-md)] border px-3 py-2 [font-size:var(--text-sm)] outline-none [background-color:var(--color-ink-850)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] focus-visible:[border-color:var(--color-primary)]";

const btnClass =
  "mt-3 w-full rounded-[var(--radius-md)] border px-3 py-1.5 [font-size:var(--text-xs)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] transition-colors disabled:opacity-50 enabled:hover:[border-color:var(--color-primary)]";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] border p-4 [border-color:var(--color-ink-800)] [background-color:var(--color-ink-900)]">
      <h3 className="[font-size:var(--text-micro)] uppercase tracking-[0.12em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 [font-size:var(--text-xs)] [color:var(--color-paper-dim)]">{label}</span>
      <span
        className={`min-w-0 truncate text-right [font-size:var(--text-xs)] [color:var(--color-paper)] ${
          mono ? "[font-family:var(--font-mono)]" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

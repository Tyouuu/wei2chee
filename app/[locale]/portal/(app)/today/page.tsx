import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { ringgit } from "@/lib/portal/live-rows";
import { todayMYT } from "@/lib/portal/record-validity";
import { PageBar } from "../page-bar";
import { PageBody, Section } from "../section";

/**
 * 要跟的事。
 *
 * ── 🔴 逾期的排最前面 ─────────────────────────────────────────────────────
 *
 * 一个承包商打开系统那一秒要看到的不是「今天有三件」，
 * 是**「有一件昨天就该做而你没做」**。那一排在最上面，而且是红的。
 *
 * ── 师傅也看得到 ──────────────────────────────────────────────────────────
 *
 * 「明天去工地量尺寸」是他一天的工作，所以 `follow_ups_due` 是
 * `works_here` 不是 `sees_money`。跟谁欠我钱那一页正好相反 ——
 * 那一页对师傅是 404，因为空的会画成「没有人欠你钱」。
 *
 * ── ⚠️ 它还不是什么 ──────────────────────────────────────────────────────
 *
 * **不会自己提醒他。** 到了那一天没有任何东西会响 ——
 * 那要一条发得出去的讯息，而那卡在真的 WhatsApp 号码（任务 11）。
 * 今天它只在他打开的时候讲话。
 */

/** 马来西亚的今天往后七天。 */
function weekFromMYT(): string {
  const d = new Date(`${todayMYT()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

type Due = {
  id: string;
  record_id: string;
  module_key: string;
  doc_no: string | null;
  title: string | null;
  party: string | null;
  amount_cents: number | null;
  what: string;
  due_on: string;
  days_late: number;
};

export default async function TodayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ until?: string }>;
}) {
  const { locale } = await params;
  const { until } = await searchParams;
  const t = await getTranslations("portal");

  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");

  const supabase = await createSessionSupabaseClient();
  const { data } = await supabase.rpc("follow_ups_due", {
    in_project_id: workspace.projectId,
    /* 「这个礼拜」是网址上的一个字，不是一个要他记住的设定。
       🔴 **马来西亚的今天，不是伺服器的。** `toISOString()` 是 UTC，
       所以半夜到早上八点算出来是前一天 —— 而那正好是他补记昨天工地的
       那个时段（`today_myt()` 存在的同一个八小时）。 */
    in_until: until === "week" ? weekFromMYT() : null,
  });
  const rows = (data ?? []) as Due[];
  const late = rows.filter((r) => Number(r.days_late) > 0).length;

  const dim = "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";

  return (
    <>
      <PageBar title={t("today.title")} subtitle={t("today.lede")} />
      <PageBody>
        <Section label={t("today.label")} count={rows.length}>
          {rows.length === 0 ? (
            <div className="flex flex-col gap-3">
              <p className={dim}>
                {until === "week" ? t("today.noneWeek") : t("today.none")}
              </p>
              {until !== "week" ? (
                <a href={`/${locale}/portal/today?until=week`} className={`underline ${dim}`}>
                  {t("today.week")}
                </a>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* 🔴 逾期几件 —— 那才是他要先看的数字。一件都没有就不画。 */}
              {late > 0 ? (
                <div>
                  <div className={dim}>{t("today.late")}</div>
                  <div className="mt-0.5 [font-size:var(--text-stat)] [font-weight:var(--fw-semibold)] tabular-nums text-[color:var(--color-clay-bright)]">
                    {late}
                  </div>
                </div>
              ) : null}

              <ul className="flex flex-col gap-5">
                {rows.map((r) => (
                  <li key={r.id} className="flex flex-col gap-1">
                    <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas)]">
                      {r.what}
                    </p>
                    <p
                      className={
                        Number(r.days_late) > 0
                          ? "[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
                          : dim
                      }
                    >
                      {Number(r.days_late) > 0
                        ? t("today.lateBy", { n: r.days_late, date: r.due_on })
                        : t("today.on", { date: r.due_on })}
                    </p>
                    {/* 点得进那张单 —— 他读完这一行下一件事就是打开它。 */}
                    <p className={dim}>
                      <a
                        href={`/${locale}/portal/${r.module_key}/${r.record_id}`}
                        className="underline"
                      >
                        {r.doc_no ?? ""}
                        {r.doc_no && r.title ? " · " : ""}
                        {r.title ?? ""}
                      </a>
                      {r.party ? ` · ${r.party}` : ""}
                      {r.amount_cents != null ? ` · ${ringgit(Number(r.amount_cents))}` : ""}
                    </p>
                  </li>
                ))}
              </ul>

              <p className={dim}>
                {until === "week" ? (
                  <a href={`/${locale}/portal/today`} className="underline">
                    {t("today.todayOnly")}
                  </a>
                ) : (
                  <a href={`/${locale}/portal/today?until=week`} className="underline">
                    {t("today.week")}
                  </a>
                )}
              </p>
            </div>
          )}
        </Section>
      </PageBody>
    </>
  );
}

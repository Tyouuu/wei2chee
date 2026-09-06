import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { ringgit } from "@/lib/portal/live-rows";
import { todayMYT } from "@/lib/portal/record-validity";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { DeskCard } from "../desk-kit";

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
  /* 他自己那一套配色 —— 跟记录页同一个来源。 */
  const { data: paletteRow } = await supabase
    .from("projects")
    .select("palette")
    .eq("id", workspace.projectId)
    .maybeSingle();
  const palette = (paletteRow?.palette as string | null) ?? null;
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

  const dim =
    "[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]";

  /* 🔴 **这一页穿的是他的系统，不是 Formae 的壳。**

     老板 2026-09-06 看着薪水那一页：
     「不是這個黑色的那個白色的啊 我們的system的Ui啊」—— 他对了。
     **深色是 Formae 的建造工具，浅色是他的系统**，
     而这一页是他每天拿来跑生意的，跟报价单那几页是同一件事。

     ⚠️ **连 `PageBar` 一起包进去** —— 只包内容会变成
     一条深色的横梁配一张白纸，那比两边都深色更像坏了。

     ⚠️ class 字串一个字都不用改：同一批 token 名字在两边都在，
     只是在 scope 里面解析成浅色那一套。 */
  return (
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={palette}
      data-surface="desk"
      className="min-h-screen [background-color:var(--color-canvas)]"
    >
      <PageBar title={t("today.title")} subtitle={t("today.lede")} />
      <PageBody>
        {/* 🔴 「今天 / 这个星期」是一个**筛子**，不是页脚两条连结。
            它原本是最底下两句底线字，而他要换的时候得先滚到底 ——
            一个筛子的家在它筛的那份清单的**上面**。
            参考那一套每一张卡就是这样：抬头在左，这一张自己的控件在右。 */}
        <DeskCard
          action={
            <div className="flex [border-radius:var(--radius-control)] [border:var(--hairline)_solid_var(--color-ink-800)] overflow-hidden">
              {(
                [
                  {
                    on: until !== "week",
                    href: `/${locale}/portal/today`,
                    label: t("today.todayOnly"),
                  },
                  {
                    on: until === "week",
                    href: `/${locale}/portal/today?until=week`,
                    label: t("today.week"),
                  },
                ] as const
              ).map((x) => (
                <a
                  key={x.href}
                  href={x.href}
                  aria-current={x.on ? "page" : undefined}
                  className={
                    "flex min-h-11 items-center px-3 [font-size:var(--text-sm)] " +
                    (x.on
                      ? "[background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)]"
                      : "[color:var(--color-paper)] hover:[background-color:var(--color-ink-950)]")
                  }
                >
                  {x.label}
                </a>
              ))}
            </div>
          }
        >
          {rows.length === 0 ? (
            <p className={dim}>
              {until === "week" ? t("today.noneWeek") : t("today.none")}
            </p>
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

              <ul className="flex flex-col">
                {rows.map((r) => {
                  const isLate = Number(r.days_late) > 0;
                  return (
                    <li
                      key={r.id}
                      /* 🔴 逾期的那几件用**一条边**认，不是靠读第二行的颜色。
                         他扫这一页的时候读的是左缘，不是每一行的第二句。 */
                      className={
                        "grid gap-1 border-t py-4 pl-3 [border-color:var(--color-ink-800)] " +
                        (isLate
                          ? "[box-shadow:inset_2px_0_0_var(--color-clay-bright)]"
                          : "[box-shadow:inset_2px_0_0_var(--color-ink-800)]")
                      }
                    >
                      {/* 要做的那件事排第一，而且比它的日期跟单号大一档 ——
                          这一页的答案就是这一句。 */}
                      <p className="[font-size:var(--text-base)] [color:var(--color-paper)]">
                        {r.what}
                      </p>
                      <p
                        className={
                          isLate
                            ? "[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
                            : dim
                        }
                      >
                        {isLate
                          ? t("today.lateBy", {
                              n: r.days_late,
                              date: r.due_on,
                            })
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
                        {r.amount_cents != null
                          ? ` · ${ringgit(Number(r.amount_cents))}`
                          : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </DeskCard>
      </PageBody>
    </StyleScope>
  );
}

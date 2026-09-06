import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { DeskCard, deskDim } from "../desk-kit";
import { AttendanceDesk } from "./attendance-desk";

/**
 * 谁哪一天做了工。
 *
 * ── 为什么这一页要存在（2026-09-06）─────────────────────────────────────
 *
 * `log_work_day` · `work_days_of` · `days_worked`（20260906550000）
 * 三支从做出来那天起**画面上一个入口都没有** —— [任务 228] 的收尾自己
 * 就写着「记一天跟看这个月几天，两屏都是画面那一边」。
 *
 * 而少了它，**一个按天算的师傅，开一次薪拿到的是一张空的薪资单** ——
 * 不报错、不讲，公积金社险照样按 0 算。那张表自己的注解写着为什么要三种
 * 算法：他最大的三个市场（装修 · 冷气 · 车厂）的工人**有一半是按天算的**。
 *
 * ── 🔴 这一页的骨架是抄来的 ────────────────────────────────────────────
 *
 * 老板：**「找模板去學習別人的設計啊」**。
 * 照他 9-04 挑的那一套里 **`up-productivity` 那一张月历** ——
 * [任务 191] 自己写着那一页「半个 —— 月历那一块还没抄」，然后一直没拿。
 *
 * 他们把它放在右边一条窄栏里当选日子的东西；**在这一页它是主角**：
 * 一格就是一天，而那一天的答案**画在格子自己身上**，不是画在旁边一张表上。
 * 一串行答不了「这个月他有几天没来」——**一片格子一眼就看得出来**。
 *
 * ⚠️ 而这跟「我欠人家的」那一页拿的是两页参考的两样东西
 * （[重点 7h](../../../../../docs/founder-points.md)：一个来源留一点、
 * 落点要分散）—— 那一页拿的是摘要药丸跟警报带，这一页拿的是月历。
 *
 * ── 🔴 挑人跟换月份走网址，不走浏览器 ──────────────────────────────────
 *
 * 「这个月他做了几天」由 `days_worked` 答（半天算半天）。
 * 在浏览器里把那几个格子加起来，就是**同一个问题两个答案** ——
 * 而这个 schema 判过十二次同一件事。所以选谁、看哪个月都在网址上，
 * 那个数字永远是资料库算的。
 *
 * ── 师傅也打得开 ────────────────────────────────────────────────────────
 *
 * `log_work_day` 是 `works_here` 不是 `sees_money`，而 [任务 228] 写清楚了
 * 为什么：**工头在工地上替他那一班记，才是这一件的用处**。
 * 这一页上一分钱都没有 —— 天数不是钱，钱在薪水那一页。
 */

type Day = {
  staff_id: string;
  name: string;
  on_date: string;
  kind: string;
  hours: number | null;
  note: string | null;
};

/** 马来西亚的今天。⚠️ 伺服器跑的是另一个时区，而半夜到早上八点补记昨天的工
 *  正好是他会做的事（`log_work_day` 自己也是这样算的）。 */
function todayMyt(): string {
  const d = new Date(Date.now() + 8 * 3600_000);
  return d.toISOString().slice(0, 10);
}

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ who?: string; m?: string }>;
}) {
  const { locale } = await params;
  const { who, m } = await searchParams;
  const t = await getTranslations("portal");

  const workspace = await loadWorkspace();
  if (!workspace) redirect("/login");

  const supabase = await createSessionSupabaseClient();
  const { data: paletteRow } = await supabase
    .from("projects")
    .select("palette")
    .eq("id", workspace.projectId)
    .maybeSingle();
  const palette = (paletteRow?.palette as string | null) ?? null;

  const today = todayMyt();
  /* 哪一个月。⚠️ 认不得的就当成这个月 —— 一个坏掉的网址不该画出一张空月历。 */
  const month = /^\d{4}-\d{2}$/.test(m ?? "")
    ? (m as string)
    : today.slice(0, 7);
  const [yy, mm] = month.split("-").map(Number);
  const first = new Date(Date.UTC(yy, mm - 1, 1));
  const lastDay = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const from = `${month}-01`;
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;

  const { data: staffRows } = await supabase
    .from("directory_entries")
    .select("id, name")
    .eq("project_id", workspace.projectId)
    .eq("module_key", "staff")
    .is("archived_at", null)
    .order("name");
  const staff = (
    (staffRows ?? []) as { id: string; name: string | null }[]
  ).map((s) => ({ id: s.id, name: s.name ?? "" }));

  /* 没讲是谁就第一个 —— 一张要他先做一个选择才画得出东西的月历，
     在他打开的那一秒是空的。 */
  const pickedId = staff.find((s) => s.id === who)?.id ?? staff[0]?.id ?? null;

  const [{ data: dayRows }, { data: sumRows }] = await Promise.all([
    supabase.rpc("work_days_of", {
      in_project_id: workspace.projectId,
      in_from: from,
      in_to: to,
    }),
    pickedId
      ? supabase.rpc("days_worked", {
          in_staff_id: pickedId,
          in_from: from,
          in_to: to,
        })
      : Promise.resolve({ data: null }),
  ]);

  const mine = ((dayRows ?? []) as Day[]).filter(
    (d) => d.staff_id === pickedId,
  );
  const marks: Record<string, { kind: string; hours: number | null }> = {};
  for (const d of mine) marks[d.on_date] = { kind: d.kind, hours: d.hours };

  const sum =
    (
      (sumRows ?? []) as {
        days: number;
        hours: number | null;
        logged: number;
      }[]
    )[0] ?? null;

  /* 星期一开头 —— 参考那一张就是 Mo…Su，而马来西亚的一週也是这样算的。 */
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let d = 1; d <= lastDay; d += 1)
    cells.push(`${month}-${String(d).padStart(2, "0")}`);

  const prev = new Date(Date.UTC(yy, mm - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(yy, mm, 1)).toISOString().slice(0, 7);
  const href = (q: { who?: string | null; m?: string }) =>
    `/${locale}/portal/attendance?who=${q.who ?? pickedId ?? ""}&m=${q.m ?? month}`;

  const monthName = new Intl.DateTimeFormat(
    locale === "zh" ? "zh-MY" : "en-MY",
    {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(first);

  return (
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={palette}
      data-surface="desk"
      className="min-h-screen [background-color:var(--color-canvas)]"
    >
      <PageBar title={t("attendance.title")} subtitle={t("attendance.lede")} />
      <PageBody>
        {staff.length === 0 ? (
          <DeskCard>
            <p className={deskDim}>{t("attendance.noStaff")}</p>
          </DeskCard>
        ) : (
          <>
            {/* 挑人。⚠️ 一个人的时候不画 —— 一排只有一颗的选择不是选择。 */}
            {staff.length > 1 && (
              <ul className="mb-5 flex flex-wrap gap-2">
                {staff.map((s) => {
                  const on = s.id === pickedId;
                  return (
                    <li key={s.id}>
                      <a
                        href={href({ who: s.id })}
                        aria-current={on ? "page" : undefined}
                        className={
                          "inline-flex min-h-11 items-center [border-radius:999px] px-4 [font-size:var(--text-sm)] " +
                          (on
                            ? "[background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)]"
                            : "[border:var(--hairline)_solid_var(--color-ink-800)] [color:var(--color-paper)]")
                        }
                      >
                        {s.name}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}

            <AttendanceDesk
              staffId={pickedId as string}
              staffName={staff.find((s) => s.id === pickedId)?.name ?? ""}
              monthName={monthName}
              prevHref={href({ m: prev })}
              nextHref={href({ m: next })}
              today={today}
              cells={cells}
              marks={marks}
              words={{
                prev: t("attendance.prev"),
                next: t("attendance.next"),
                full: t("attendance.full"),
                half: t("attendance.half"),
                absent: t("attendance.absent"),
                hours: t("attendance.hours"),
                pickDay: t("attendance.pickDay"),
                notYet: t("attendance.notYet"),
                saveFailed: t("attendance.saveFailed"),
                mon: t("attendance.mon"),
                tue: t("attendance.tue"),
                wed: t("attendance.wed"),
                thu: t("attendance.thu"),
                fri: t("attendance.fri"),
                sat: t("attendance.sat"),
                sun: t("attendance.sun"),
                summary: t("attendance.summary", {
                  days: sum ? Number(sum.days) : 0,
                  logged: sum ? Number(sum.logged) : 0,
                }),
                note: t("attendance.note"),
              }}
            />
          </>
        )}
      </PageBody>
    </StyleScope>
  );
}

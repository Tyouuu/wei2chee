import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { DeskCard, deskDim } from "../desk-kit";
import { RotaDesk } from "./rota-desk";

/**
 * 星期三下午谁有空。
 *
 * ── 为什么这一页要存在（2026-09-06）─────────────────────────────────────
 *
 * `who_is_free` · `staff_hours_of` · `set_staff_hours`（20260906430000）
 * 三支从做出来那天起**画面上一个入口都没有** —— [任务 224] 的收尾自己
 * 就写着「排班跟『谁有空』两屏都是画面那一边」。
 *
 * 一间三张椅子的沙龙，一天真的会问四句，而**第四句今天没有任何地方答得了**：
 * 「今天谁上班」看得到人 · 「Ah Girl 请假」挡起来的时段做得到 ·
 * 「这个月做了几天」在薪水那边 · 🔴 **「星期三下午谁有空」——** 就是这一页。
 *
 * ── 🔴 这一页的骨架是抄来的 ────────────────────────────────────────────
 *
 * 老板：**「找模板去學習別人的設計啊」**。
 * 照他 9-04 挑的那一套里 **`up-crm` 的 Upcoming Meetings** ——
 * 一条**横的时间轴**（08:45 · 09:00 · 10:00 · 10:20 几个刻度），
 * 上面压着一块占着那段时间的实块。
 *
 * 那正是这一页要答的形状：**一个人一条轨道，他的班是轨道上的一块**，
 * 而问的那个时段是轨道上的一道竖带 —— **空不空一眼就看得出来**，
 * 不用读任何一行字。一张「人 × 星期几」的表答得了「他星期几上班」，
 * 答不了「两点到四点那一格里他在不在」。
 *
 * ⚠️ 而它跟前两页拿的不是同一样东西
 * （[重点 7h](../../../../../docs/founder-points.md)：一个来源留一点、
 * 落点要分散）：出勤拿的是 `up-productivity` 的月历，
 * 「我欠人家的」拿的是 `up-infrastructure` 的药丸跟 `up-patient` 的警报带。
 *
 * ── 🔴 一行班都没排，每一个人都算有空 ──────────────────────────────────
 *
 * 那是 `who_is_free` 自己写在代码里的（`not anyone_rostered`），
 * 而理由是 20260902030000 拒绝整套上班时间引擎的那一句：
 * **每一样都是第一笔预约之前要先填完的设定**。
 * 所以这一页**一行都不填也用得了** —— 那时候它只答「谁已经有人了」。
 *
 * ── 师傅也打得开 ────────────────────────────────────────────────────────
 *
 * 三支都是 `works_here`。柜台要知道今天谁在，那是他一天的工作，
 * 而这一页上一分钱都没有。
 */

type Shift = {
  staff_id: string;
  name: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  note: string | null;
};

type Free = {
  staff_id: string;
  name: string;
  on_duty: boolean;
  busy: boolean;
  busy_with: string;
};

/** 马来西亚的今天。⚠️ 伺服器跑的是另一个时区。 */
function todayMyt(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

/** 马来西亚现在几点。⚠️ 读时钟要在组件外面 ——
 *  React 19 的纯度规则挡的就是「画的时候读一个会变的东西」。 */
function hourMyt(): number {
  return Number(
    new Date(Date.now() + 8 * 3600_000).toISOString().slice(11, 13),
  );
}

const hhmm = (t: string) => t.slice(0, 5);
/** 「10:30」→ 从午夜起第几分钟。 */
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export default async function RotaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ d?: string; s?: string; e?: string }>;
}) {
  const { locale } = await params;
  const q = await searchParams;
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
  const day = /^\d{4}-\d{2}-\d{2}$/.test(q.d ?? "") ? (q.d as string) : today;
  const okTime = (v: string | undefined, fallback: string) =>
    /^\d{2}:\d{2}$/.test(v ?? "") ? (v as string) : fallback;
  /* 预设是**下一个整点起一个钟头** —— 他问这一句的时候，客人多半就在电话上。 */
  const nowH = hourMyt();
  const from = okTime(
    q.s,
    `${String(Math.min(nowH + 1, 22)).padStart(2, "0")}:00`,
  );
  const to = okTime(
    q.e,
    `${String(Math.min(nowH + 2, 23)).padStart(2, "0")}:00`,
  );

  const [{ data: staffRows }, { data: shiftRows }, freeRes] = await Promise.all(
    [
      supabase
        .from("directory_entries")
        .select("id, name")
        .eq("project_id", workspace.projectId)
        .eq("module_key", "staff")
        .is("archived_at", null)
        .order("name"),
      supabase.rpc("staff_hours_of", { in_project_id: workspace.projectId }),
      /* ⚠️ 明写 `+08:00` —— 这一支照墙上时钟算星期几，
       而伺服器的时区不是他的时区。 */
      supabase.rpc("who_is_free", {
        in_project_id: workspace.projectId,
        in_starts_at: `${day}T${from}:00+08:00`,
        in_ends_at: `${day}T${to}:00+08:00`,
      }),
    ],
  );

  const staff = (
    (staffRows ?? []) as { id: string; name: string | null }[]
  ).map((s) => ({ id: s.id, name: s.name ?? "" }));
  const shifts = (shiftRows ?? []) as Shift[];
  const free = (freeRes?.data ?? []) as Free[];

  /* 星期几照 Postgres 的算法（0 是星期日）—— `who_is_free` 用的就是它，
     两边不一样就是同一件事两个答案。 */
  const dowOfDay = new Date(
    Date.UTC(
      Number(day.slice(0, 4)),
      Number(day.slice(5, 7)) - 1,
      Number(day.slice(8, 10)),
    ),
  ).getUTCDay();

  /* 轨道两头。⚠️ 不写死 8–20：一间开到晚上十点的店会被切掉半个班。
     没有人排班的时候才用那个预设。 */
  const startsMin = shifts.length
    ? Math.min(...shifts.map((s) => mins(s.starts_at)))
    : 8 * 60;
  const endsMax = shifts.length
    ? Math.max(...shifts.map((s) => mins(s.ends_at)))
    : 20 * 60;
  const railFrom = Math.min(startsMin, mins(from)) - 30;
  const railTo = Math.max(endsMax, mins(to)) + 30;
  const span = Math.max(railTo - railFrom, 60);
  const pct = (m: number) => ((m - railFrom) / span) * 100;

  /* 刻度：整点，最多八个 —— 参考那一条只有四个刻度，
     一条挤满数字的轴读起来就是一把尺，不是一天。 */
  const ticks: number[] = [];
  const step = Math.max(1, Math.ceil(span / 60 / 8));
  for (let h = Math.ceil(railFrom / 60); h * 60 <= railTo; h += step)
    ticks.push(h * 60);

  const shiftsOf = (id: string) =>
    shifts.filter((s) => s.staff_id === id && s.weekday === dowOfDay);

  const dayName = new Intl.DateTimeFormat(locale === "zh" ? "zh-MY" : "en-MY", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(
    new Date(
      Date.UTC(
        Number(day.slice(0, 4)),
        Number(day.slice(5, 7)) - 1,
        Number(day.slice(8, 10)),
      ),
    ),
  );

  const nobodyRostered = shifts.length === 0;

  return (
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={palette}
      data-surface="desk"
      className="min-h-screen [background-color:var(--color-canvas)]"
    >
      <PageBar title={t("rota.title")} subtitle={t("rota.lede")} />
      <PageBody>
        {staff.length === 0 ? (
          <DeskCard>
            <p className={deskDim}>{t("rota.noStaff")}</p>
          </DeskCard>
        ) : (
          <div className="flex flex-col gap-5">
            {/* ① 问的那一句 —— 一条时间轴 ← `up-crm` 的 Upcoming Meetings。 */}
            <DeskCard
              title={dayName}
              action={
                <form
                  action={`/${locale}/portal/rota`}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    type="date"
                    name="d"
                    defaultValue={day}
                    aria-label={t("rota.day")}
                    className="min-h-11 [background-color:var(--color-ink-900)] [border:var(--hairline)_solid_var(--color-ink-800)] [border-radius:var(--radius-control)] [color:var(--color-paper)] [font-size:var(--text-sm)] [padding-inline:var(--pad-control-x)]"
                  />
                  <input
                    type="time"
                    name="s"
                    defaultValue={from}
                    aria-label={t("rota.from")}
                    className="min-h-11 [background-color:var(--color-ink-900)] [border:var(--hairline)_solid_var(--color-ink-800)] [border-radius:var(--radius-control)] [color:var(--color-paper)] [font-size:var(--text-sm)] [padding-inline:var(--pad-control-x)]"
                  />
                  <input
                    type="time"
                    name="e"
                    defaultValue={to}
                    aria-label={t("rota.to")}
                    className="min-h-11 [background-color:var(--color-ink-900)] [border:var(--hairline)_solid_var(--color-ink-800)] [border-radius:var(--radius-control)] [color:var(--color-paper)] [font-size:var(--text-sm)] [padding-inline:var(--pad-control-x)]"
                  />
                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center [background-color:var(--color-primary)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [padding-inline:calc(var(--pad-control-x)*1.2)]"
                  >
                    {t("rota.ask")}
                  </button>
                </form>
              }
            >
              <div
                className="grid gap-4 sm:grid-cols-[8.5rem_1fr_10rem] sm:items-center"
                data-rota="rails"
              >
                {/* 刻度 ← 参考那一条的 08:45 · 09:00 · 10:00 · 10:20。
                    🔴 **窄屏不画** —— 看图才看到：390 上轨道只有 135px，
                    七个刻度挤成一团「10:0012:0014:00…」，那不是一条轴，
                    是一摊字。手机上那一块自己印着 10:00–19:00，
                    而右边那一句话讲的就是答案。 */}
                <div className="relative hidden h-4 sm:col-start-2 sm:block">
                  {ticks.map((m) => (
                    <span
                      key={m}
                      className={`absolute -translate-x-1/2 tabular-nums ${deskDim}`}
                      style={{ left: `${pct(m)}%` }}
                    >
                      {String(Math.floor(m / 60)).padStart(2, "0")}:00
                    </span>
                  ))}
                </div>

                {staff.map((s) => {
                  const f = free.find((x) => x.staff_id === s.id);
                  const mine = shiftsOf(s.id);
                  const state = !f
                    ? ""
                    : f.busy
                      ? t("rota.taken")
                      : f.on_duty
                        ? t("rota.free")
                        : t("rota.off");
                  return (
                    <div
                      key={s.id}
                      data-rota="rail"
                      className="grid gap-1 sm:col-span-3 sm:grid-cols-subgrid sm:items-center sm:gap-3"
                    >
                      <span className="truncate [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
                        {s.name}
                      </span>
                      <span className="relative h-9 min-w-0 [background-color:var(--color-ink-950)] [border-radius:var(--radius-sm)]">
                        {/* 他的班 —— 轨道上的一块。 */}
                        {mine.map((sh, i) => (
                          <span
                            key={i}
                            className="absolute inset-y-0 flex items-center justify-center overflow-hidden [background-color:color-mix(in_oklab,var(--color-primary)_11%,var(--color-ink-900))] [border-radius:var(--radius-sm)] [font-size:var(--text-xs,12px)]"
                            style={{
                              left: `${pct(mins(sh.starts_at))}%`,
                              width: `${pct(mins(sh.ends_at)) - pct(mins(sh.starts_at))}%`,
                            }}
                          >
                            {hhmm(sh.starts_at)}–{hhmm(sh.ends_at)}
                          </span>
                        ))}
                        {/* 🔴 问的那一段 —— 一道竖带压在轨道上。
                            有人了就是红的，那一格是他下一句话要讲的。 */}
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-0 [border-radius:2px]"
                          style={{
                            left: `${pct(mins(from))}%`,
                            width: `${Math.max(pct(mins(to)) - pct(mins(from)), 0.8)}%`,
                            /* 🔴 空的时候**只画框，不填色** ——
                               看图才看到：他的班是一块淡灰，而问的那一段
                               也填淡灰，两块变成同一个灰，
                               画面上分不出哪一块是哪一件事。
                               有人了才填色，因为那一格是他下一句话要讲的。 */
                            backgroundColor: f?.busy
                              ? "color-mix(in oklab, var(--color-clay-bright) 30%, transparent)"
                              : "transparent",
                            outline: `2px solid ${
                              f?.busy
                                ? "var(--color-clay-bright)"
                                : "var(--color-paper)"
                            }`,
                          }}
                        />
                      </span>
                      <span
                        className={
                          "[font-size:var(--text-sm)] " +
                          (f?.busy
                            ? "[color:var(--color-clay-bright)]"
                            : f?.on_duty
                              ? "[color:var(--color-paper)]"
                              : deskDim)
                        }
                      >
                        {state}
                        {f?.busy && f.busy_with ? ` · ${f.busy_with}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>

              {nobodyRostered && (
                <p className={`mt-4 ${deskDim}`}>{t("rota.noneRostered")}</p>
              )}
            </DeskCard>

            {/* ② 设定：一个礼拜的形状，打一次就永远有效。 */}
            <RotaDesk
              staff={staff}
              shifts={shifts.map((s) => ({
                staffId: s.staff_id,
                weekday: s.weekday,
                from: hhmm(s.starts_at),
                to: hhmm(s.ends_at),
              }))}
              words={{
                rosterTitle: t("rota.rosterTitle"),
                rosterLede: t("rota.rosterLede"),
                save: t("rota.save"),
                clear: t("rota.clearDay"),
                saved: t("rota.saved"),
                saveFailed: t("rota.saveFailed"),
                sun: t("rota.sun"),
                mon: t("rota.mon"),
                tue: t("rota.tue"),
                wed: t("rota.wed"),
                thu: t("rota.thu"),
                fri: t("rota.fri"),
                sat: t("rota.sat"),
                note: t("rota.rosterNote"),
              }}
            />
          </div>
        )}
      </PageBody>
    </StyleScope>
  );
}

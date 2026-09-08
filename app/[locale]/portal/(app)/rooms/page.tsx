import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { DeskCard, deskDim } from "../desk-kit";
import { RoomsDesk, type RoomRow } from "./rooms-desk";

/**
 * 三点还有哪一间房空着。
 *
 * ── 为什么这一页要存在（2026-09-09）─────────────────────────────────────
 *
 * `add_room` · `set_room_active` · `rooms_of` · `rooms_free`
 * （20260909020000）四支都用真的登入身分验过，而 [任务 308] 自己的收尾
 * 写着：**「画面上开不了一间房 —— 没有一页开得了第一间房。」**
 * 一个建好了没有人到得了的东西，跟一个不存在的东西，
 * 在报告里长得一模一样。
 *
 * ── 🔴 模板不是从外面找的，是我们自己那一页 ──────────────────────────
 *
 * 老板 2026-09-09：`有些頁面有自己的模板 就去繼續使用`。
 * 而排班那一页（`/portal/rota`，[任务 245]）问的**就是同一句话**：
 * 一个时段 → 哪一个还空着。所以这一页照它排：
 *
 *   ① 一条横的时间轴，一间房一条轨道，那一天排进去的每一笔是轨道上
 *      的一块，而问的那一段是压在上面的一道竖带 —— 空不空一眼看得出来
 *   ② 底下：开一间房 / 关掉
 *
 * ⚠️ 而它跟排班那一页有一处**故意不一样**：排班那一条轨道上画的是
 * 「他这个礼拜几上班」（一个礼拜的形状），这一条画的是
 * **「今天这一间房排了什么」** —— 一间房没有班表，它只有那一天的行程。
 *
 * ── 只有老板 ──────────────────────────────────────────────────────────────
 *
 * 开房 · 关房两支是 `sees_money`。前台读得到房（`rooms_of` 是 `works_here`），
 * 而她开不了也关不了 —— 一个她打得开、每一颗按钮都会被资料库拒绝的页面，
 * 比 404 糟。
 */

type Free = {
  room_id: string;
  name: string;
  busy: boolean;
  busy_with: string;
};

type Booked = {
  id: string;
  room_id: string | null;
  starts_at: string;
  ends_at: string;
  service: string | null;
  party: string | null;
  kind: string | null;
  note: string | null;
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

/** 「10:30」→ 从午夜起第几分钟。 */
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** 一个时刻 → 马来西亚墙上时钟的「HH:MM」。 */
const clock = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(iso));

export default async function RoomsPage({
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
  /* 🔴 只有老板。见档头。 */
  if (workspace.role !== "owner") notFound();

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
  /* 预设是**下一个整点起一个钟头** —— 她问这一句的时候，客人多半就在电话上。
     跟排班那一页同一个预设。 */
  const nowH = hourMyt();
  const from = okTime(q.s, `${String(Math.min(nowH + 1, 22)).padStart(2, "0")}:00`);
  const to = okTime(q.e, `${String(Math.min(nowH + 2, 23)).padStart(2, "0")}:00`);

  /* ⚠️ 明写 `+08:00` —— 这两支照墙上时钟算，而伺服器的时区不是她的时区。 */
  const dayStart = `${day}T00:00:00+08:00`;
  const dayEnd = `${day}T23:59:59+08:00`;

  const [roomRes, freeRes, { data: bookedRows }] = await Promise.all([
    supabase.rpc("rooms_of", { in_project_id: workspace.projectId }),
    supabase.rpc("rooms_free", {
      in_project_id: workspace.projectId,
      in_starts_at: `${day}T${from}:00+08:00`,
      in_ends_at: `${day}T${to}:00+08:00`,
    }),
    /* 那一天排进房里的每一笔。
       🔴 这一段**不走 `rooms_free`** —— 那一支答的是「这一段空不空」，
       一个是非题；轨道上要画的是「这一天这一间排了什么」，是一串。
       两个问题，两支函式，而不是把其中一个硬拗成另一个。 */
    supabase
      .from("appointments")
      .select("id, room_id, starts_at, ends_at, service, party, kind, note")
      .eq("project_id", workspace.projectId)
      .not("room_id", "is", null)
      .gte("starts_at", dayStart)
      .lte("starts_at", dayEnd)
      .neq("status", "cancelled")
      .order("starts_at"),
  ]);

  const rooms = (roomRes?.data ?? []) as RoomRow[];
  const free = (freeRes?.data ?? []) as Free[];
  const booked = (bookedRows ?? []) as Booked[];
  const live = rooms.filter((r) => r.active);

  /* 轨道两头。⚠️ 不写死 8–20：一间开到晚上十点的店会被切掉半天。
     一笔都没有的时候才用那个预设 —— 跟排班那一页同一条。 */
  const marks = booked.flatMap((b) => [
    mins(clock(b.starts_at)),
    mins(clock(b.ends_at)),
  ]);
  const startsMin = marks.length ? Math.min(...marks) : 9 * 60;
  const endsMax = marks.length ? Math.max(...marks) : 19 * 60;
  const railFrom = Math.min(startsMin, mins(from)) - 30;
  const railTo = Math.max(endsMax, mins(to)) + 30;
  const span = Math.max(railTo - railFrom, 60);
  const pct = (m: number) => ((m - railFrom) / span) * 100;

  /* 刻度：整点，最多八个 —— 一条挤满数字的轴读起来是一把尺，不是一天。 */
  const ticks: number[] = [];
  const step = Math.max(1, Math.ceil(span / 60 / 8));
  for (let h = Math.ceil(railFrom / 60); h * 60 <= railTo; h += step)
    ticks.push(h * 60);

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

  const boxCls =
    "min-h-11 [background-color:var(--color-ink-900)] [border:var(--hairline)_solid_var(--input)] [border-radius:var(--radius-control)] [color:var(--color-paper)] [font-size:var(--text-sm)] [padding-inline:var(--pad-control-x)]";

  return (
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={palette}
      data-surface="desk"
      className="min-h-screen [background-color:var(--color-canvas)]"
    >
      <PageBar title={t("rooms.title")} subtitle={t("rooms.lede")} />
      <PageBody>
        <div className="flex flex-col gap-5">
          {/* ① 问的那一句 —— 一条时间轴，模板是我们自己的排班那一页。 */}
          {live.length > 0 ? (
            <DeskCard
              title={dayName}
              action={
                <form
                  action={`/${locale}/portal/rooms`}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    type="date"
                    name="d"
                    defaultValue={day}
                    aria-label={t("rooms.day")}
                    className={boxCls}
                  />
                  <input
                    type="time"
                    name="s"
                    defaultValue={from}
                    aria-label={t("rooms.from")}
                    className={boxCls}
                  />
                  <input
                    type="time"
                    name="e"
                    defaultValue={to}
                    aria-label={t("rooms.to")}
                    className={boxCls}
                  />
                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center [background-color:var(--color-primary)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [padding-inline:calc(var(--pad-control-x)*1.2)]"
                  >
                    {t("rooms.ask")}
                  </button>
                </form>
              }
            >
              <div
                className="grid gap-4 sm:grid-cols-[8.5rem_1fr_10rem] sm:items-center"
                data-rooms="rails"
              >
                {/* 刻度。🔴 **窄屏不画** —— 390 上轨道只剩一百多像素，
                    七个刻度挤成一摊字（排班那一页看图学到的同一条）。 */}
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

                {live.map((r) => {
                  const f = free.find((x) => x.room_id === r.id);
                  const mine = booked.filter((b) => b.room_id === r.id);
                  return (
                    <div
                      key={r.id}
                      data-rooms="rail"
                      className="grid gap-1 sm:col-span-3 sm:grid-cols-subgrid sm:items-center sm:gap-3"
                    >
                      <span className="truncate [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
                        {r.name}
                      </span>
                      <span className="relative h-9 min-w-0 [background-color:var(--color-ink-950)] [border-radius:var(--radius-sm)]">
                        {/* 今天排进这一间的每一笔 —— 轨道上的一块。 */}
                        {mine.map((b) => {
                          const a = mins(clock(b.starts_at));
                          const z = mins(clock(b.ends_at));
                          return (
                            <span
                              key={b.id}
                              title={`${clock(b.starts_at)}–${clock(b.ends_at)} ${
                                (b.service ?? "").trim() || (b.note ?? "").trim()
                              }`}
                              className="absolute inset-y-0 flex items-center overflow-hidden [border-radius:var(--radius-sm)] [font-size:var(--text-xs,12px)] [padding-inline:6px]"
                              style={{
                                left: `${pct(a)}%`,
                                width: `${Math.max(pct(z) - pct(a), 1)}%`,
                                /* 🔴 照排班那一页抄的那一层淡色（primary 11% 兑 ink-900）
                                   在这里几乎看不见 —— 那一页的轨道是深的，
                                   而这一页的轨道坐在浅色的地上，两个混出来是同一个灰。
                                   看图看出来的（[重点 7l]）。
                                   改成跟日程那一块同一套：一层兑**这一页的地**的淡色
                                   ＋ 一条实心的边 —— 有没有人一眼看得出来。 */
                                background:
                                  "color-mix(in oklab, var(--color-primary) 16%, var(--color-canvas))",
                                borderLeft: "3px solid var(--color-primary)",
                              }}
                            >
                              {/* 时刻 ＋ 是什么 —— 一个光秃秃的「05:00」
                                  答不了「那一间在做什么」，而那是她下一句话。
                                  装不下就切掉后半，时刻永远留着。 */}
                              <span className="truncate">
                                {clock(b.starts_at)}
                                {(b.service ?? "").trim() || (b.note ?? "").trim()
                                  ? ` · ${(b.service ?? "").trim() || (b.note ?? "").trim()}`
                                  : ""}
                              </span>
                            </span>
                          );
                        })}
                        {/* 🔴 问的那一段 —— 一道竖带压在轨道上。
                            **空的时候只画框，不填色**：填了色它跟底下
                            那几块变成同一个灰，画面上分不出哪一块是哪一件事
                            （排班那一页看图学到的）。 */}
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-0 [border-radius:2px]"
                          style={{
                            left: `${pct(mins(from))}%`,
                            width: `${Math.max(pct(mins(to)) - pct(mins(from)), 0.8)}%`,
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
                            : "[color:var(--color-paper)]")
                        }
                      >
                        {f?.busy ? t("rooms.taken") : t("rooms.free")}
                        {f?.busy && f.busy_with ? ` · ${f.busy_with}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </DeskCard>
          ) : null}

          {/* ② 设定：开一间房 / 关掉。 */}
          <RoomsDesk
            projectId={workspace.projectId}
            rows={rooms}
            copy={{
              title: t("rooms.label"),
              lede: t("rooms.note"),
              add: t("rooms.add"),
              adding: t("rooms.adding"),
              name: t("rooms.name"),
              off: t("rooms.off"),
              on: t("rooms.on"),
              offLabel: t("rooms.offLabel"),
              none: t("rooms.none"),
            }}
          />
        </div>
      </PageBody>
    </StyleScope>
  );
}

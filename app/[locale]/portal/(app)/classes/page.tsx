import { StyleScope } from "@/design-system/editor/style-scope";
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import { PageBar } from "../page-bar";
import { PageBody } from "../section";
import { ClassDesk } from "./class-desk";

/**
 * 一个老师十个学生。
 *
 * ── 为什么这一页要存在（2026-09-06）─────────────────────────────────────
 *
 * `add_class_group` · `class_groups_of` · `class_roster` · `enrol_in_class` ·
 * `leave_class` · `update_class_group` · `set_class_slots` · `open_lesson` ·
 * `lessons_due` · `mark_attendance` · `class_attendance_of` ——
 * **十一支，画面上一个入口都没有**（[任务 223](#223) · [241](#241) 的收尾）。
 *
 * 而少了它，**补习那一行今天用不了这个产品**：一堂十个学生的课，
 * 照旧的做法要开十行预约、同一个老师同一个钟头，
 * 而那条「同一个人同一个时间只准一次」的约束会把第二行到第十行全部拒绝。
 *
 * ── 🔴 这一页的骨架是抄来的 ────────────────────────────────────────────
 *
 * 老板：**「找模板去學習別人的設計啊」**。
 * 照他 9-04 挑的那一套里 **`up-academy` 的 Class Schedule** ——
 * 一串行，**每一行左边一条有色的竖条**、时间在左、课名在中间、
 * **右边一颗状态药丸**（In Progress · Upcoming · Cancelled）。
 *
 * 那正是「这个礼拜要上哪几堂」的形状，而我们的状态是三个真的事实：
 * **还没开 · 开了还没点名 · 点过了**。
 * 一串没有状态的课表答不了他唯一要问的那一句：**哪一堂还没点名**。
 *
 * ⚠️ 四页各拿各的（[重点 7h](../../../../../docs/founder-points.md)）：
 * 我欠人家的 ← `up-infrastructure` ＋ `up-patient` · 出勤 ← `up-productivity` ·
 * 谁有空 ← `up-crm` · 搬货 ← `up-logistics` · 这一页 ← `up-academy`。
 *
 * ── 🔴 一堂课是一行预约，不是第二张课表 ────────────────────────────────
 *
 * `open_lesson` 开的就是 `appointments` 里的一行（[任务 223](#223) 的判断）。
 * 所以这一页不另外画一张月历 —— 那一堂课在预约那一页上看得到。
 *
 * ── 师傅也打得开 ────────────────────────────────────────────────────────
 *
 * 十一支都是 `works_here`。点名的是老师，而这一页上一分钱都没有。
 */

type Lesson = {
  group_id: string;
  class_name: string;
  staff_id: string | null;
  staff_name: string | null;
  on_date: string;
  starts_at: string;
  ends_at: string;
  lesson_id: string | null;
  marked: number;
  seats_taken: number;
};

type Group = {
  id: string;
  name: string;
  staff_id: string | null;
  staff_name: string | null;
  capacity: number | null;
  seats_taken: number;
  archived_at: string | null;
};

function todayMyt(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

export default async function ClassesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
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

  /* 🔴 一个班住在预约那一页上（`add_class_group` 自己会拒绝别的页）。
     没有那一页就没有这一件事 —— 而一个开不出班的「班」页，
     是一颗按下去一定失败的按钮。 */
  const { data: pageRows } = await supabase
    .from("project_pages")
    .select("page_key")
    .eq("project_id", workspace.projectId);
  const calendarKey = ((pageRows ?? []) as { page_key: string }[]).find(
    (r) => r.page_key === "bookings",
  )?.page_key;
  if (!calendarKey) notFound();

  const from = todayMyt();
  const until = new Date(Date.now() + 8 * 3600_000 + 13 * 864e5)
    .toISOString()
    .slice(0, 10);

  const [
    { data: dueRows },
    { data: groupRows },
    { data: staffRows },
    { data: peopleRows },
  ] = await Promise.all([
    supabase.rpc("lessons_due", {
      in_project_id: workspace.projectId,
      in_from: from,
      in_until: until,
    }),
    supabase.rpc("class_groups_of", { in_project_id: workspace.projectId }),
    supabase
      .from("directory_entries")
      .select("id, name")
      .eq("project_id", workspace.projectId)
      .eq("module_key", "staff")
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("directory_entries")
      .select("id, name")
      .eq("project_id", workspace.projectId)
      .eq("module_key", "customers")
      .is("archived_at", null)
      .order("name"),
  ]);

  /* 🔴 那两栏是带时区的时刻，**不是墙上时钟** —— 我第一版切了 ISO 字串的
     第 11–16 个字，那是 UTC：一堂排在下午四点的课印出来是「08:00」。
     看图才看到的（数字全绿）。 */
  const clock = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kuala_Lumpur",
  });

  const lessons = ((dueRows ?? []) as Lesson[]).map((l) => ({
    groupId: l.group_id,
    className: l.class_name,
    teacher: l.staff_name ?? "",
    on: l.on_date,
    from: clock.format(new Date(l.starts_at)),
    to: clock.format(new Date(l.ends_at)),
    lessonId: l.lesson_id,
    marked: Number(l.marked ?? 0),
    seats: Number(l.seats_taken ?? 0),
  }));

  const groups = ((groupRows ?? []) as Group[])
    .filter((g) => !g.archived_at)
    .map((g) => ({
      id: g.id,
      name: g.name,
      staffId: g.staff_id,
      teacher: g.staff_name ?? "",
      capacity: g.capacity,
      seats: Number(g.seats_taken ?? 0),
    }));

  const staff = (
    (staffRows ?? []) as { id: string; name: string | null }[]
  ).map((s) => ({ id: s.id, name: s.name ?? "" }));
  const people = (
    (peopleRows ?? []) as { id: string; name: string | null }[]
  ).map((p) => ({ id: p.id, name: p.name ?? "" }));

  return (
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={palette}
      data-surface="desk"
      className="min-h-screen [background-color:var(--color-canvas)]"
    >
      <PageBar title={t("classes.title")} subtitle={t("classes.lede")} />
      <PageBody>
        <ClassDesk
          projectId={workspace.projectId}
          moduleKey={calendarKey}
          lessons={lessons}
          groups={groups}
          staff={staff}
          people={people}
          words={{
            dueTitle: t("classes.dueTitle"),
            noneDue: t("classes.noneDue"),
            open: t("classes.open"),
            mark: t("classes.mark"),
            notOpen: t("classes.notOpen"),
            openedNotMarked: t("classes.openedNotMarked"),
            markedAll: t("classes.markedAll"),
            groupsTitle: t("classes.groupsTitle"),
            noGroups: t("classes.noGroups"),
            addGroup: t("classes.addGroup"),
            name: t("classes.name"),
            teacher: t("classes.teacher"),
            capacity: t("classes.capacity"),
            noTeacher: t("classes.noTeacher"),
            save: t("classes.save"),
            seats: t("classes.seats"),
            rosterTitle: t("classes.rosterTitle"),
            enrol: t("classes.enrol"),
            leave: t("classes.leave"),
            emptyRoster: t("classes.emptyRoster"),
            slotsTitle: t("classes.slotsTitle"),
            slotsNote: t("classes.slotsNote"),
            saveSlots: t("classes.saveSlots"),
            came: t("classes.came"),
            noShow: t("classes.noShow"),
            excused: t("classes.excused"),
            notYet: t("classes.notYet"),
            close: t("classes.close"),
            saveFailed: t("classes.saveFailed"),
            full: t("classes.full"),
            mon: t("classes.mon"),
            tue: t("classes.tue"),
            wed: t("classes.wed"),
            thu: t("classes.thu"),
            fri: t("classes.fri"),
            sat: t("classes.sat"),
            sun: t("classes.sun"),
          }}
        />
      </PageBody>
    </StyleScope>
  );
}

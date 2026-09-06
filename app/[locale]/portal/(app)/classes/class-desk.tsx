"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DeskCard, deskBtn, deskDim, deskField } from "../desk-kit";

/**
 * 这个礼拜要上哪几堂，跟一个班有谁。
 *
 * ── 🔴 三种状态是三个真的事实 ──────────────────────────────────────────
 *
 * 参考那一串（`up-academy` 的 Class Schedule）右边挂着 In Progress ·
 * Upcoming · Cancelled。我们的三个不是抄字，是**这一堂课真的走到哪**：
 *
 *   还没开        `lesson_id` 是空的
 *   开了还没点名  开出来了，而 `marked` 是 0
 *   点过了        `marked > 0`
 *
 * 🔴 **「开出来了」不等於「点过名」** —— `lessons_due` 自己把那两件分成
 * 两栏，而那正是他唯一要问的那一句：**哪一堂还没点名**。
 */

type Lesson = {
  groupId: string;
  className: string;
  teacher: string;
  on: string;
  from: string;
  to: string;
  lessonId: string | null;
  marked: number;
  seats: number;
};
type Group = {
  id: string;
  name: string;
  staffId: string | null;
  teacher: string;
  capacity: number | null;
  seats: number;
};
type Person = { id: string; name: string };
type Words = Record<string, string>;

type Att = {
  party_id: string;
  name: string;
  on_roster: boolean;
  status: string | null;
};
type RosterRow = { party_id: string; name: string; left_on: string | null };

export function ClassDesk({
  projectId,
  moduleKey,
  lessons,
  groups,
  staff,
  people,
  words,
}: {
  projectId: string;
  moduleKey: string;
  lessons: Lesson[];
  groups: Group[];
  staff: Person[];
  people: Person[];
  words: Words;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  /* 点名那一屏：开着的那一堂 + 它的名单。 */
  const [marking, setMarking] = useState<{ id: string; title: string } | null>(
    null,
  );
  /* 正在改的那一个班（跟展开是两件事：展开是看，改是动手）。 */
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTeacher, setEditTeacher] = useState("");
  const [editCap, setEditCap] = useState("");
  const [att, setAtt] = useState<Att[]>([]);

  /* 一个班摊开：名单 + 一个礼拜几点上。 */
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [slots, setSlots] = useState<
    { weekday: number; from: string; to: string }[]
  >([]);
  const [newName, setNewName] = useState("");
  const [newTeacher, setNewTeacher] = useState("");
  const [newCap, setNewCap] = useState("");
  const [addWho, setAddWho] = useState("");

  const sb = () => createBrowserSupabaseClient();
  const dayName = (d: number) =>
    [
      words.sun,
      words.mon,
      words.tue,
      words.wed,
      words.thu,
      words.fri,
      words.sat,
    ][d];

  const run = async <T,>(fn: () => Promise<{ error: unknown; data: T }>) => {
    setBusy(true);
    setFailed(false);
    const { error, data } = await fn();
    setBusy(false);
    if (error) {
      setFailed(true);
      return null;
    }
    return data;
  };

  const openLesson = async (l: Lesson) => {
    const data = await run(async () =>
      sb().rpc("open_lesson", {
        in_group_id: l.groupId,
        in_on: l.on,
        in_module_key: moduleKey,
      }),
    );
    if (data) router.refresh();
  };

  const startMarking = async (l: Lesson) => {
    if (!l.lessonId) return;
    const data = await run(async () =>
      sb().rpc("class_attendance_of", { in_appointment_id: l.lessonId }),
    );
    if (data) {
      setAtt(data as Att[]);
      setMarking({ id: l.lessonId, title: `${l.className} · ${l.on}` });
    }
  };

  const mark = async (partyId: string, status: string) => {
    if (!marking) return;
    /* 按下去当场变，写不进去就放回去 —— 一颗看起来成功而资料库里没变的
       按钮，比一颗报错的糟得多。 */
    const was = att;
    setAtt((rows) =>
      rows.map((r) => (r.party_id === partyId ? { ...r, status } : r)),
    );
    const ok = await run(async () =>
      sb().rpc("mark_attendance", {
        in_appointment_id: marking.id,
        in_party_id: partyId,
        in_status: status,
      }),
    );
    if (!ok) setAtt(was);
    else router.refresh();
  };

  const expand = async (g: Group) => {
    if (openGroup === g.id) {
      setOpenGroup(null);
      return;
    }
    const r = await run(async () =>
      sb().rpc("class_roster", { in_group_id: g.id }),
    );
    const s = await run(async () =>
      sb()
        .from("class_slots")
        .select("weekday, starts_at, ends_at")
        .eq("group_id", g.id)
        .order("weekday"),
    );
    setRoster(((r ?? []) as RosterRow[]).filter((x) => !x.left_on));
    setSlots(
      (
        (s ?? []) as { weekday: number; starts_at: string; ends_at: string }[]
      ).map((x) => ({
        weekday: x.weekday,
        from: String(x.starts_at).slice(0, 5),
        to: String(x.ends_at).slice(0, 5),
      })),
    );
    setOpenGroup(g.id);
    setAddWho("");
  };

  const addGroup = async () => {
    if (!newName.trim()) return;
    const data = await run(async () =>
      sb().rpc("add_class_group", {
        in_project_id: projectId,
        in_module_key: moduleKey,
        in_name: newName.trim(),
        in_staff_id: newTeacher || null,
        in_capacity: newCap ? Number(newCap) : null,
      }),
    );
    if (data) {
      setNewName("");
      setNewCap("");
      router.refresh();
    }
  };

  /**
   * 🔴 一个班开出来之后改得了，也关得掉。
   *
   * `update_class_group` · `set_contract_archived` 那一类从建出来那天起
   * **画面上一个入口都没有**（[任务 243](../../../../../docs/founder-tasks.md#243)）。
   * 而一个老师换人、一个班从八个位子加到十个，是补习中心每一个学期都会做的事
   * —— 一个开得出来而改不了的班，第二个学期就是错的。
   *
   * ⚠️ **清空要另外讲。** `null` 在那一支里是「这一栏不要动」，
   * 所以「这个班以后没有老师」「不限人数」要用它自己的 `in_clear_*`
   * —— 同一个坑这个仓库栽过五次（due_on · 工地 · 分店 · done_by · job_id）。
   */
  const saveGroup = async (g: Group) => {
    if (!editName.trim()) return;
    const data = await run(async () =>
      sb().rpc("update_class_group", {
        in_group_id: g.id,
        in_name: editName.trim(),
        in_staff_id: editTeacher || null,
        in_clear_staff: !editTeacher,
        in_capacity: editCap.trim() ? Number(editCap) : null,
        in_clear_capacity: !editCap.trim(),
      }),
    );
    if (data) {
      setEditing(null);
      router.refresh();
    }
  };

  /* 🔴 **关掉，不是删掉。** 一个上过课的班是历史 ——
     那几堂课、那几次点名都挂在它身上。`class_groups_of` 自己会滤掉
     关掉的那几个，所以这一页看不到它，而资料还在。 */
  const closeGroup = async (g: Group) => {
    const data = await run(async () =>
      /* ⚠️ 关掉走的是**同一支** —— 那一支自己就收 `in_archived`，
         不是另外一支。我第一版猜了一个 `set_class_group_archived`，
         而它根本不存在（这个 session 第九次猜函式名字）。 */
      sb().rpc("update_class_group", {
        in_group_id: g.id,
        in_archived: true,
      }),
    );
    if (data !== null) {
      setEditing(null);
      setOpenGroup(null);
      router.refresh();
    }
  };

  const enrol = async (gid: string) => {
    if (!addWho) return;
    const data = await run(async () =>
      sb().rpc("enrol_in_class", { in_group_id: gid, in_party_id: addWho }),
    );
    if (data) {
      const r = await run(async () =>
        sb().rpc("class_roster", { in_group_id: gid }),
      );
      setRoster(((r ?? []) as RosterRow[]).filter((x) => !x.left_on));
      setAddWho("");
      router.refresh();
    }
  };

  const leave = async (gid: string, pid: string) => {
    const data = await run(async () =>
      sb().rpc("leave_class", { in_group_id: gid, in_party_id: pid }),
    );
    if (data) {
      setRoster((rows) => rows.filter((r) => r.party_id !== pid));
      router.refresh();
    }
  };

  const saveSlots = async (gid: string) => {
    const rows = slots
      .filter((s) => s.from && s.to)
      .map((s) => ({ weekday: s.weekday, starts_at: s.from, ends_at: s.to }));
    const data = await run(async () =>
      sb().rpc("set_class_slots", { in_group_id: gid, in_slots: rows }),
    );
    if (data) router.refresh();
  };

  const state = (l: Lesson) =>
    !l.lessonId
      ? { word: words.notOpen, hot: false }
      : l.marked > 0
        ? { word: words.markedAll, hot: false }
        : { word: words.openedNotMarked, hot: true };

  return (
    <div className="flex flex-col gap-5">
      {/* ① 这个礼拜要上哪几堂 ← `up-academy` 的 Class Schedule。 */}
      <DeskCard title={words.dueTitle}>
        {lessons.length === 0 ? (
          <p className={deskDim}>{words.noneDue}</p>
        ) : (
          <ul className="flex flex-col" data-classes="due">
            {lessons.map((l) => {
              const s = state(l);
              return (
                <li
                  key={`${l.groupId}-${l.on}`}
                  data-classes="lesson"
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t py-3 pl-3 [border-color:var(--color-ink-800)]"
                  style={{
                    /* 左边那一条竖条 —— 参考每一行都有一条。
                       还没点名的那一条是红的：那是他今天要做的事。 */
                    boxShadow: `inset 3px 0 0 ${
                      s.hot
                        ? "var(--color-clay-bright)"
                        : "var(--color-ink-800)"
                    }`,
                  }}
                >
                  <span className="w-48 shrink-0 whitespace-nowrap tabular-nums [font-size:var(--text-sm)]">
                    {l.on}
                    <span className={` ${deskDim}`}>
                      {" "}
                      {l.from}–{l.to}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="[font-size:var(--text-base)] [font-weight:var(--fw-medium)]">
                      {l.className}
                    </span>
                    <span className={` ${deskDim}`}>
                      {l.teacher ? ` · ${l.teacher}` : ""} ·{" "}
                      {words.seats.replace("%n", String(l.seats))}
                    </span>
                  </span>
                  <span
                    className={
                      "[font-size:var(--text-sm)] " +
                      (s.hot ? "[color:var(--color-clay-bright)]" : deskDim)
                    }
                  >
                    {s.word}
                  </span>
                  {l.lessonId ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startMarking(l)}
                      className={deskBtn()}
                    >
                      {words.mark}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openLesson(l)}
                      className={deskBtn("primary")}
                    >
                      {words.open}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* 点名 —— 挑了一堂才出现。 */}
        {marking && (
          <div className="mt-5 border-t pt-5 [border-color:var(--color-ink-800)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <span className="[font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
                {marking.title}
              </span>
              <button
                type="button"
                onClick={() => setMarking(null)}
                className={deskBtn()}
              >
                {words.close}
              </button>
            </div>
            <ul className="flex flex-col" data-classes="attendance">
              {att.map((a) => (
                <li
                  key={a.party_id}
                  className="flex flex-wrap items-center justify-between gap-3 border-t py-3 [border-color:var(--color-ink-800)]"
                >
                  <span className="[font-size:var(--text-sm)]">
                    {a.name}
                    {!a.status && (
                      <span className={` ${deskDim}`}> · {words.notYet}</span>
                    )}
                  </span>
                  <span className="flex flex-wrap gap-2">
                    {(
                      [
                        ["came", words.came],
                        ["no_show", words.noShow],
                        ["excused", words.excused],
                      ] as const
                    ).map(([k, w]) => (
                      <button
                        key={k}
                        type="button"
                        disabled={busy}
                        aria-pressed={a.status === k}
                        onClick={() => mark(a.party_id, k)}
                        className={
                          a.status === k ? deskBtn("primary") : deskBtn()
                        }
                      >
                        {w}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DeskCard>

      {/* ② 班 —— 谁在、几点上。 */}
      <DeskCard title={words.groupsTitle}>
        <div className="flex flex-col gap-4">
          {groups.length === 0 ? (
            <p className={deskDim}>{words.noGroups}</p>
          ) : (
            <ul className="flex flex-col" data-classes="groups">
              {groups.map((g) => {
                const on = openGroup === g.id;
                const full = g.capacity != null && g.seats >= g.capacity;
                return (
                  <li
                    key={g.id}
                    className="border-t py-3 [border-color:var(--color-ink-800)]"
                  >
                    <button
                      type="button"
                      onClick={() => expand(g)}
                      aria-expanded={on}
                      className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-left"
                    >
                      <span className="min-w-0 flex-1 [font-size:var(--text-base)] [font-weight:var(--fw-medium)]">
                        {g.name}
                      </span>
                      <span className={deskDim}>
                        {g.teacher || words.noTeacher} ·{" "}
                        {g.capacity != null
                          ? `${g.seats}/${g.capacity}`
                          : words.seats.replace("%n", String(g.seats))}
                      </span>
                      {full && (
                        <span className="[color:var(--color-brass-bright)] [font-size:var(--text-sm)]">
                          {words.full}
                        </span>
                      )}
                    </button>

                    {/* 🔴 改这个班 / 关掉它。**只在展开的时候画** ——
                        一份清单上每一行挂两颗按钮，读起来是一份控制台，
                        而他打开这一页要看的是「这个礼拜要上哪几堂」。 */}
                    {on && editing !== g.id && (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(g.id);
                            setEditName(g.name);
                            setEditTeacher(g.staffId ?? "");
                            setEditCap(
                              g.capacity != null ? String(g.capacity) : "",
                            );
                          }}
                          className={deskBtn()}
                        >
                          {words.editGroup}
                        </button>
                      </div>
                    )}
                    {on && editing === g.id && (
                      <div className="mt-3 flex flex-col gap-3 [border-radius:var(--radius-md)] [border:var(--hairline)_solid_var(--input)] p-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <span className={deskDim}>{words.name}</span>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className={deskField}
                            />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className={deskDim}>{words.teacher}</span>
                            <select
                              value={editTeacher}
                              onChange={(e) => setEditTeacher(e.target.value)}
                              className={deskField}
                            >
                              <option value="">{words.noTeacher}</option>
                              {staff.map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className={deskDim}>{words.capacity}</span>
                            <span className="inline-block w-24">
                              <input
                                type="number"
                                min="1"
                                value={editCap}
                                onChange={(e) => setEditCap(e.target.value)}
                                className={deskField}
                              />
                            </span>
                          </label>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            disabled={busy || !editName.trim()}
                            onClick={() => void saveGroup(g)}
                            className={deskBtn("primary")}
                          >
                            {words.save}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setEditing(null)}
                            className={deskBtn()}
                          >
                            {words.close}
                          </button>
                          {/* 🔴 关掉那一颗排在最后、而且是 danger ——
                              它旁边那两颗都是「改一改」，而这一颗
                              会让这个班从这一页上消失。 */}
                          <span className="ml-auto">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void closeGroup(g)}
                              className={deskBtn("danger")}
                            >
                              {words.closeGroup}
                            </button>
                          </span>
                        </div>
                        <p className={deskDim}>{words.closeGroupNote}</p>
                      </div>
                    )}
                    {on && (
                      <div className="mt-4 grid gap-6 lg:grid-cols-2">
                        <div className="flex flex-col gap-3">
                          <p className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                            {words.rosterTitle}
                          </p>
                          {roster.length === 0 ? (
                            <p className={deskDim}>{words.emptyRoster}</p>
                          ) : (
                            <ul className="flex flex-col gap-2">
                              {roster.map((r) => (
                                <li
                                  key={r.party_id}
                                  className="flex items-center justify-between gap-3"
                                >
                                  <span className="[font-size:var(--text-sm)]">
                                    {r.name}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => leave(g.id, r.party_id)}
                                    className={deskBtn("danger")}
                                  >
                                    {words.leave}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="min-w-0 flex-1">
                              <select
                                value={addWho}
                                onChange={(e) => setAddWho(e.target.value)}
                                className={deskField}
                              >
                                <option value="">—</option>
                                {people.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </span>
                            <button
                              type="button"
                              disabled={busy || !addWho}
                              onClick={() => enrol(g.id)}
                              className={deskBtn("primary")}
                            >
                              {words.enrol}
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3">
                          <p className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                            {words.slotsTitle}
                          </p>
                          <ul className="flex flex-col gap-2">
                            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                              const s = slots.find((x) => x.weekday === d);
                              return (
                                <li
                                  key={d}
                                  className="flex flex-wrap items-center gap-2"
                                >
                                  <span className="w-20 shrink-0 [font-size:var(--text-sm)]">
                                    {dayName(d)}
                                  </span>
                                  <span className="flex min-w-0 flex-1 items-center gap-2">
                                    <span className="min-w-0 flex-1 sm:w-28 sm:flex-none">
                                      <input
                                        type="time"
                                        aria-label={`${dayName(d)} ${words.slotsTitle}`}
                                        value={s?.from ?? ""}
                                        onChange={(e) =>
                                          setSlots((xs) => {
                                            const rest = xs.filter(
                                              (x) => x.weekday !== d,
                                            );
                                            return [
                                              ...rest,
                                              {
                                                weekday: d,
                                                from: e.target.value,
                                                to: s?.to ?? "",
                                              },
                                            ];
                                          })
                                        }
                                        className={deskField}
                                      />
                                    </span>
                                    <span className={deskDim}>–</span>
                                    <span className="min-w-0 flex-1 sm:w-28 sm:flex-none">
                                      <input
                                        type="time"
                                        value={s?.to ?? ""}
                                        onChange={(e) =>
                                          setSlots((xs) => {
                                            const rest = xs.filter(
                                              (x) => x.weekday !== d,
                                            );
                                            return [
                                              ...rest,
                                              {
                                                weekday: d,
                                                from: s?.from ?? "",
                                                to: e.target.value,
                                              },
                                            ];
                                          })
                                        }
                                        className={deskField}
                                      />
                                    </span>
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => saveSlots(g.id)}
                              className={deskBtn("primary")}
                            >
                              {words.saveSlots}
                            </button>
                            <span className={deskDim}>{words.slotsNote}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* 加一个班。 */}
          <div
            data-classes="new"
            className="flex flex-wrap items-end gap-3 border-t pt-4 [border-color:var(--color-ink-800)]"
          >
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className={deskDim}>{words.name}</span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={deskField}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={deskDim}>{words.teacher}</span>
              <select
                value={newTeacher}
                onChange={(e) => setNewTeacher(e.target.value)}
                className={deskField}
              >
                <option value="">{words.noTeacher}</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={deskDim}>{words.capacity}</span>
              <span className="inline-block w-24">
                <input
                  type="number"
                  min="1"
                  value={newCap}
                  onChange={(e) => setNewCap(e.target.value)}
                  className={deskField}
                />
              </span>
            </label>
            <button
              type="button"
              disabled={busy || !newName.trim()}
              onClick={addGroup}
              className={deskBtn("primary")}
            >
              {words.addGroup}
            </button>
          </div>

          {failed && (
            <p className="[color:var(--color-clay-bright)] [font-size:var(--text-sm)]">
              {words.saveFailed}
            </p>
          )}
        </div>
      </DeskCard>
    </div>
  );
}

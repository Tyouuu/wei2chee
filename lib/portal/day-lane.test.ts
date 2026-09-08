/* 一天摊开的时候，那一栏是什么。
 *
 * ── 那是一个判断，而它是资料决定的 ────────────────────────────────────────
 *
 * 2026-09-08 量过：Fresha 跟 Booksy（两家最大的沙龙软件）都不给椅子图，
 * 给的是「一天 × 一个师傅一栏」—— 因为一间沙龙稀缺的是**师傅**。
 * 而 Zenoti（做 medi spa 那一档的）反过来讲「每一张椅子、**每一间房**，
 * 都是一个订得到的位置」—— 一间做脸的房 60–90 分钟只能一个人，
 * 而激光机只有一台，**会撞的是房间**。
 *
 * 所以那一栏是**先用完的那一样**：
 *
 *   一间会订房的店 → 房间（每一笔预约都有房，那就是房间的用处）
 *   一间沙龙       → 师傅（一间房都没有）
 *
 * 🔴 而它只在她真的开了第一间房那一天翻一次 —— 那是她自己做的一个动作，
 * 不是一个每天会变的启发式。少了这一条就要多一个设定，而那是她第一天
 * 要先决定的一件事。
 *
 * 🔴 **另外那一样照旧要看得见**（`where`，画在那一块上）：少了它，
 * 她把三个房排满之后才发现两个客人同一个美疗师。
 */
import { describe, expect, it } from "vitest";
import { rowsFromAppointments, type AppointmentRow } from "./live-rows";

const at = (h: number, m = 0) => {
  const d = new Date();
  d.setUTCHours(h, m, 0, 0);
  return d.toISOString();
};

const row = (over: Partial<AppointmentRow>): AppointmentRow => ({
  id: over.id ?? "1",
  starts_at: over.starts_at ?? at(2),
  ends_at: over.ends_at ?? at(3),
  kind: over.kind ?? "booking",
  party: over.party ?? "Ms Lim",
  service: over.service ?? "Facial",
  status: over.status ?? "booked",
  source: over.source ?? "staff",
  note: over.note ?? "",
  extra: over.extra ?? {},
  staff: over.staff ?? null,
  room: over.room ?? null,
});

describe("那一栏是什么", () => {
  it("一间沙龙：那一栏是师傅", () => {
    const out = rowsFromAppointments([
      row({ id: "a", staff: { name: "Amy" } }),
      row({ id: "b", staff: { name: "Jasmine" } }),
    ]);
    expect(out.map((r) => r.who)).toEqual(["Amy", "Jasmine"]);
    /* 没有房间，就没有那个小标 —— 一间沙龙的块上不该多一格空的。 */
    expect(out.every((r) => r.where === undefined)).toBe(true);
  });

  it("🔴 一间 medi spa：那一栏是房间，而师傅画在那一块上", () => {
    const out = rowsFromAppointments([
      row({ id: "a", staff: { name: "Amy" }, room: { name: "Room 1" } }),
      row({ id: "b", staff: { name: "Jasmine" }, room: { name: "Laser room" } }),
    ]);
    expect(out.map((r) => r.who)).toEqual(["Room 1", "Laser room"]);
    expect(out.map((r) => r.where)).toEqual(["Amy", "Jasmine"]);
  });

  /* 她刚开第一间房、只排了一笔进去的那一天。整页翻成房间那一栏，
     而还没排房的那几笔去「还没安排」—— 不是被丢掉。 */
  it("只要有一笔排了房，整页就照房间分栏", () => {
    const out = rowsFromAppointments([
      row({ id: "a", staff: { name: "Amy" }, room: { name: "Room 1" } }),
      row({ id: "b", staff: { name: "Jasmine" } }),
    ]);
    expect(out[0].who).toBe("Room 1");
    expect(out[1].who).toBeUndefined();
    /* 而那一笔的师傅照旧看得见。 */
    expect(out[1].where).toBe("Jasmine");
  });

  it("一行都没有给的时候，两样都不送 —— 那一块自己退回原来的画法", () => {
    const out = rowsFromAppointments([row({ id: "a" }), row({ id: "b" })]);
    expect(out.every((r) => r.who === undefined && r.where === undefined)).toBe(true);
  });

  it("挡起来的时段也占着那一栏 —— 它不是没有人的空白", () => {
    const out = rowsFromAppointments([
      row({ id: "a", kind: "block", party: "", service: "", note: "消毒", room: { name: "Laser room" } }),
      row({ id: "b", staff: { name: "Amy" }, room: { name: "Room 1" } }),
    ]);
    expect(out[0].who).toBe("Laser room");
    expect(out[0].primary).toBe("消毒");
  });
});

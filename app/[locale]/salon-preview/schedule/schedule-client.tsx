"use client";

import { useState } from "react";
import Link from "next/link";
import { SalonSidebar } from "../salon-shell";
import { AppointmentSheet, BookingSheet, type BookingPrefill, type OpenAppointment } from "./schedule-dialogs";
import { Timeline, type LaneItem, type StaffLane } from "./schedule-timeline";

export type { LaneItem, StaffLane } from "./schedule-timeline";

type Status = "inService" | "upcoming" | "completed";
type Gap = Extract<LaneItem, { type: "gap" }>;
type Appointment = Extract<LaneItem, { type: "appointment" }>;

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const SCHEDULE = "/en/salon-preview/schedule";

export function ScheduleClient({
  projectId,
  dateStr,
  isToday,
  prevDate,
  nextDate,
  weekStaff,
  weekLanes,
  weekHourLabels,
  weekTotalWidth,
  weekLabel,
  customers,
  businessName,
  dayLabel,
  lanes,
  hourLabels,
  shiftLabel,
  totalWidth,
  nowLeft,
  nowLabel,
  rosterCount,
  onShiftCount,
  totals,
  capacityPct,
  nextArrivals,
  quickSlots,
}: {
  projectId: string;
  dateStr: string;
  isToday: boolean;
  prevDate: string;
  nextDate: string;
  weekStaff: { id: string; name: string }[];
  weekLanes: Record<string, StaffLane[]>;
  weekHourLabels: { time: string; meridiem: string; current: boolean }[];
  weekTotalWidth: number;
  weekLabel: string;
  customers: { id: string; name: string }[];
  businessName: string;
  dayLabel: string;
  lanes: StaffLane[];
  hourLabels: { time: string; meridiem: string; current: boolean }[];
  shiftLabel: string;
  totalWidth: number;
  nowLeft: number | null;
  nowLabel: string;
  rosterCount: number;
  onShiftCount: number;
  totals: { totalGuests: number; inServiceCount: number; upcomingCount: number; completedCount: number };
  capacityPct: number | null;
  nextArrivals: { guestName: string; timeLabel: string; service: string; staffName: string | null; initials: string }[];
  quickSlots: Gap[];
}) {
  const [viewTab, setViewTab] = useState<"day" | "gap" | "week">("day");
  const [activeStylist, setActiveStylist] = useState<string>("all");
  const [stylistMenuOpen, setStylistMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  // The Week shows one stylist at a time (that is how the field does it).
  const [weekStaffId, setWeekStaffId] = useState<string>(weekStaff[0]?.id || "anyone");
  // The two side panels: the booking form (blank, or prefilled from an open
  // slot) and the appointment that was clicked.
  const [booking, setBooking] = useState<{ prefill: BookingPrefill | null } | null>(null);
  const [openAppt, setOpenAppt] = useState<OpenAppointment | null>(null);

  const bookSlot = (gap: Gap) =>
    setBooking({
      // An open stretch can be hours long; offer the first hour, she can widen it.
      prefill: {
        staffId: gap.staffId,
        start: hhmm(gap.startMinutesOfDay),
        end: hhmm(gap.startMinutesOfDay + Math.min(gap.minutes, 60)),
        date: gap.date,
      },
    });

  const openAppointment = (item: Appointment) =>
    setOpenAppt({
      id: item.id,
      guestName: item.guestName,
      service: item.service,
      timeLabel: item.timeLabel,
      statusLabel: item.statusLabel,
      status: item.status,
      arrived: item.arrived,
      href: item.href,
      staffName: item.staffName,
    });

  const scrollTimeline = (left: number) => {
    document.getElementById("timeline-scroll-area")?.scrollTo({ left, behavior: "smooth" });
  };

  const rowVisible = (lane: StaffLane) => {
    if (activeStylist !== "all" && activeStylist !== lane.name) return false;
    if (statusFilter !== "all" && !lane.statuses.includes(statusFilter)) return false;
    const q = search.trim().toLowerCase();
    if (q && !lane.searchText.includes(q)) return false;
    return true;
  };

  const visibleLanes = lanes.filter(rowVisible);

  const STATUS_PILLS: { key: Status | "all"; label: string }[] = [
    { key: "all", label: `All (${totals.totalGuests})` },
    { key: "inService", label: `In Service (${totals.inServiceCount})` },
    { key: "upcoming", label: `Upcoming (${totals.upcomingCount})` },
    { key: "completed", label: `Completed (${totals.completedCount})` },
  ];

  // Every open stretch of the day, for the "Gap & Open Slots" view.
  const allGaps = lanes
    .flatMap((lane) =>
      lane.items
        .filter((it): it is Gap => it.type === "gap")
        .map((it) => ({ ...it, laneName: lane.name })),
    )
    .sort((a, b) => a.startMinutesOfDay - b.startMinutesOfDay || a.laneName.localeCompare(b.laneName));

  const weekRows = weekLanes[weekStaffId] ?? [];
  const weekBookings = weekRows.reduce((s, l) => s + l.bookingsCount, 0);

  const tabClass = (on: boolean) =>
    "px-4 py-1.5 rounded-lg text-[13.5px] leading-5 font-normal leading-tight text-center transition-all active:scale-[0.97] " +
    (on ? "bg-[#ffffff] text-[#1a1c1f] shadow-sm" : "text-[#5e5e67] hover:text-[#1a1c1f]");

  const dayHeader = (
    <div className="px-5 py-3 border-b border-[#c8c5cb]/30 flex flex-wrap items-center justify-between gap-3 bg-[#ffffff]">
      <div className="flex items-center gap-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#000000]">Timeline Flow</span>
          <span className="text-[11.5px] font-mono px-2 py-0.5 rounded bg-[#eeedf1] text-[#5e5e67] border border-[#c8c5cb]/30">{shiftLabel}</span>
        </div>
        <span className="text-[#c8c5cb]/40 text-sm">|</span>
        <div className="inline-flex p-0.5 rounded-lg bg-[#eeedf1] text-[#5e5e67] text-[11.5px]">
          <button onClick={() => scrollTimeline(0)} className="px-2.5 py-1 rounded bg-[#ffffff] text-[#1a1c1f] font-medium shadow-2xs transition-all active:scale-[0.97]">
            All Day
          </button>
          <button onClick={() => scrollTimeline(0)} className="px-2.5 py-1 rounded hover:text-[#1a1c1f] active:scale-[0.97] transition-colors">
            Morning
          </button>
          <button onClick={() => scrollTimeline(totalWidth / 2)} className="px-2.5 py-1 rounded hover:text-[#1a1c1f] active:scale-[0.97] transition-colors">
            Afternoon
          </button>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 text-[11px] text-[#5e5e67]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-[#000000]" /> In Service
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-[#e8e8ec]/60 border border-[#c8c5cb]/40" /> Upcoming
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded border border-dashed border-[#c8c5cb]/60" /> Open Slot
          </span>
        </div>
        {nowLeft !== null ? (
          <div className="flex items-center gap-1.5 text-[11.5px] text-[#000000] font-mono bg-[#f3f3f7] px-2 py-1 rounded border border-[#c8c5cb]/30">
            <span className="inline-block w-2 h-2 rounded-full bg-[#000000] animate-pulse" />
            <span className="font-semibold">{nowLabel} NOW</span>
          </div>
        ) : isToday ? (
          <div className="flex items-center gap-1.5 text-[11.5px] text-[#5e5e67] font-mono bg-[#f3f3f7] px-2 py-1 rounded border border-[#c8c5cb]/30">
            <span>Outside shown hours ({nowLabel})</span>
          </div>
        ) : null}
      </div>
    </div>
  );

  const weekHeader = (
    <div className="px-5 py-3 border-b border-[#c8c5cb]/30 flex flex-wrap items-center justify-between gap-3 bg-[#ffffff]">
      <div className="flex items-center gap-3">
        <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#000000]">Week · {weekLabel}</span>
        <select
          aria-label="Week stylist"
          value={weekStaffId}
          onChange={(e) => setWeekStaffId(e.target.value)}
          className="h-8 rounded-lg border border-[#c8c5cb]/50 bg-[#ffffff] px-2.5 text-[13px] text-[#1a1c1f] outline-none focus:border-[#000000]"
        >
          {weekStaff.map((s) => (
            <option key={s.id || "anyone"} value={s.id || "anyone"}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-4 text-[11.5px] text-[#5e5e67]">
        <span data-testid="week-count">
          {weekBookings} {weekBookings === 1 ? "booking" : "bookings"} this week
        </span>
        <span>Click a day to open it · click an open stretch to book it</span>
      </div>
    </div>
  );

  return (
    <div
      className="bg-[#f9f9fd] text-[#1a1c1f] text-[14.5px] leading-[22px] tracking-[-0.005em] antialiased min-h-screen"
      style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
    >
      <SalonSidebar active="appointments-and-flow" businessName={businessName} subtitle="Operations" />
      <div className="pl-64 min-h-screen bg-[#f9f9fd]">
        <main className="w-full pt-0 bg-[#f9f9fd] min-h-screen">
          <div className="flex flex-col w-full">
            {/* Top Command & Action Bar */}
            <div className="px-8 pt-7 pb-6 bg-[#ffffff] border-b border-[#c8c5cb]/30 flex flex-col gap-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] uppercase tracking-wider">
                    <span>Operations</span>
                    <span className="text-[#c8c5cb]">/</span>
                    <span className="text-[#1a1c1f]">Stylist Schedule &amp; Slots</span>
                  </div>
                  <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold tracking-tight text-[#1a1c1f]">
                    Appointments &amp; Schedule
                  </h1>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f3f3f7] border border-[#c8c5cb]/30 text-[#47464b] text-[11.5px] leading-4 tracking-[0.04em] font-medium select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#000000] shrink-0" />
                    <span className="font-medium tracking-tight text-[12px]">
                      {onShiftCount > 0
                        ? `Live Roster · ${onShiftCount} of ${rosterCount} Clocked In`
                        : `Full Roster · ${rosterCount} Stylist${rosterCount === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  <div className="inline-flex items-center p-1 rounded-xl bg-[#f3f3f7] border border-[#c8c5cb]/30 select-none">
                    <button onClick={() => setViewTab("day")} className={tabClass(viewTab === "day")}>
                      Day
                      <br />
                      <span className="font-medium text-[11px] text-[#5e5e67]">Schedule</span>
                    </button>
                    <button onClick={() => setViewTab("gap")} className={tabClass(viewTab === "gap")}>
                      Gap &amp; Open
                      <br />
                      <span className="text-[11px]">Slots</span>
                    </button>
                    <button onClick={() => setViewTab("week")} className={tabClass(viewTab === "week")}>
                      Week
                      <br />
                      <span className="text-[11px]">View</span>
                    </button>
                  </div>
                  <button
                    onClick={() => setBooking({ prefill: null })}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#000000] text-[#ffffff] hover:bg-neutral-800 transition-colors text-[13.5px] leading-5 font-normal shadow-sm cursor-pointer shrink-0 active:scale-[0.99]"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    <span className="leading-tight text-left text-[12.5px]">
                      New
                      <br />
                      <span className="font-normal text-[11.5px] text-[#ffffff]/90">Appointment</span>
                    </span>
                  </button>
                </div>
              </div>

              {/* Filters, Date Controls & Status Summary */}
              <div className="flex items-center justify-between pt-1 gap-4 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center rounded-lg bg-[#ffffff] border border-[#c8c5cb]/50 shadow-2xs overflow-hidden">
                    <Link
                      href={`${SCHEDULE}?date=${prevDate}`}
                      className="px-2.5 py-1.5 hover:bg-[#eeedf1] text-[#5e5e67] hover:text-[#1a1c1f] transition-colors active:scale-[0.97]"
                      title="Previous Day"
                      aria-label="Previous day"
                    >
                      <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                    </Link>
                    <div className="px-3 py-1.5 text-[13.5px] leading-5 font-normal text-[#1a1c1f] border-x border-[#c8c5cb]/30 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[15px] text-[#5e5e67]">calendar_today</span>
                      <span data-testid="day-label">{dayLabel}</span>
                    </div>
                    <Link
                      href={`${SCHEDULE}?date=${nextDate}`}
                      className="px-2.5 py-1.5 hover:bg-[#eeedf1] text-[#5e5e67] hover:text-[#1a1c1f] transition-colors active:scale-[0.97]"
                      title="Next Day"
                      aria-label="Next day"
                    >
                      <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    </Link>
                  </div>
                  {isToday ? (
                    <span
                      className="px-3 py-1.5 rounded-lg border border-[#c8c5cb]/50 text-[13.5px] leading-5 font-normal text-[#1a1c1f] bg-[#eeedf1] shadow-2xs"
                      title="You're already viewing today"
                    >
                      Today
                    </span>
                  ) : (
                    <Link
                      href={SCHEDULE}
                      className="px-3 py-1.5 rounded-lg border border-[#c8c5cb]/50 text-[13.5px] leading-5 font-normal text-[#1a1c1f] bg-[#ffffff] hover:bg-[#eeedf1] shadow-2xs transition-colors"
                    >
                      Back to Today
                    </Link>
                  )}
                  <div className="relative">
                    <button
                      onClick={() => setStylistMenuOpen((v) => !v)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#c8c5cb]/50 text-[13.5px] leading-5 font-normal text-[#1a1c1f] hover:bg-[#eeedf1] active:scale-[0.97] transition-colors bg-[#ffffff] shadow-2xs"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#000000]" />
                      <span>{activeStylist === "all" ? `All Roster Stylists (${rosterCount})` : activeStylist}</span>
                      <span className="material-symbols-outlined text-[16px] text-[#5e5e67]">
                        {stylistMenuOpen ? "arrow_drop_up" : "arrow_drop_down"}
                      </span>
                    </button>
                    {stylistMenuOpen && (
                      <div className="absolute left-0 top-full mt-1 w-56 rounded-lg border border-[#c8c5cb]/50 bg-[#ffffff] shadow-md z-30 overflow-hidden">
                        <button
                          onClick={() => {
                            setActiveStylist("all");
                            setStylistMenuOpen(false);
                          }}
                          className={
                            "w-full text-left px-3 py-2 text-[13px] hover:bg-[#f3f3f7] transition-colors " +
                            (activeStylist === "all" ? "font-semibold text-[#000000]" : "text-[#1a1c1f]")
                          }
                        >
                          All Roster Stylists ({rosterCount})
                        </button>
                        {lanes.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setActiveStylist(s.name);
                              setStylistMenuOpen(false);
                            }}
                            className={
                              "w-full text-left px-3 py-2 text-[13px] hover:bg-[#f3f3f7] transition-colors border-t border-[#e8e8ec] " +
                              (activeStylist === s.name ? "font-semibold text-[#000000]" : "text-[#1a1c1f]")
                            }
                          >
                            {s.name}
                            {s.role ? <span className="block text-[11px] text-[#5e5e67] font-normal">{s.role}</span> : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <span className="material-symbols-outlined text-[17px] text-[#5e5e67] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      search
                    </span>
                    <input
                      className="w-full pl-8 pr-3 py-1.5 text-[13.5px] leading-5 font-normal rounded-lg border border-[#c8c5cb]/50 bg-[#ffffff] text-[#1a1c1f] placeholder:text-[#5e5e67]/70 focus:outline-none focus:border-[#000000] transition-all shadow-2xs"
                      placeholder="Search guest, stylist, service..."
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {STATUS_PILLS.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setStatusFilter(p.key)}
                        className={
                          "px-3 py-1 rounded-md text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase transition-all active:scale-[0.97] " +
                          (statusFilter === p.key
                            ? "bg-[#000000] text-[#ffffff]"
                            : "text-[#5e5e67] hover:text-[#1a1c1f] bg-[#f3f3f7] hover:bg-[#eeedf1] border border-[#c8c5cb]/30")
                        }
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Canvas */}
            <div className="p-8 flex gap-6 items-start">
              {viewTab === "day" && (
                <Timeline
                  header={dayHeader}
                  lanes={visibleLanes}
                  hourLabels={hourLabels}
                  totalWidth={totalWidth}
                  nowLeft={nowLeft}
                  nowLabel={nowLabel}
                  laneHeader="Stylist / Chair"
                  empty={
                    lanes.length === 0
                      ? "No staff members are set up yet."
                      : `No stylist matches ${search ? `"${search}"` : "this filter"}${activeStylist !== "all" ? ` for ${activeStylist}` : ""}${statusFilter !== "all" ? ` in ${STATUS_PILLS.find((p) => p.key === statusFilter)?.label}` : ""}.`
                  }
                  onBookGap={bookSlot}
                  onOpenAppt={openAppointment}
                />
              )}

              {viewTab === "week" && (
                <Timeline
                  header={weekHeader}
                  lanes={weekRows}
                  hourLabels={weekHourLabels}
                  totalWidth={weekTotalWidth}
                  nowLeft={null}
                  nowLabel={nowLabel}
                  laneHeader="Day"
                  empty="No staff members are set up yet."
                  onBookGap={bookSlot}
                  onOpenAppt={openAppointment}
                />
              )}

              {/* Gap & Open Slots: every open stretch of the day, biggest picture of where a walk-in fits */}
              {viewTab === "gap" && (
                <div className="flex-1 min-w-0 bg-[#ffffff] border border-[#c8c5cb]/40 rounded-xl shadow-sm flex flex-col overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#c8c5cb]/30 flex items-center justify-between">
                    <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#000000]">
                      Open Slots · {dayLabel}
                    </span>
                    <span className="text-[11.5px] font-mono px-2 py-0.5 rounded bg-[#eeedf1] text-[#5e5e67] border border-[#c8c5cb]/30">
                      {allGaps.length} open
                    </span>
                  </div>
                  {allGaps.length === 0 ? (
                    <p data-testid="gap-empty" className="p-10 text-center text-[13.5px] text-[#5e5e67]">
                      Nothing open on this day — every stylist is booked through the shown hours.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#c8c5cb]/20">
                      {allGaps.map((g, i) => (
                        <div key={i} data-testid="gap-row" className="px-5 py-3 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#000000] shrink-0" />
                            <div className="min-w-0">
                              <div className="text-[13.5px] font-semibold text-[#1a1c1f] truncate">{g.laneName}</div>
                              <div className="text-[11.5px] font-mono text-[#5e5e67]">
                                {g.timeLabel} · {g.minutes} min open
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => bookSlot(g)}
                            className="px-3 py-1.5 rounded-lg border border-[#c8c5cb]/60 hover:border-[#000000] hover:bg-[#eeedf1] text-[12.5px] font-medium text-[#1a1c1f] transition-colors"
                          >
                            Book this slot
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Right Side: Daily Capacity & Booking Triage */}
              <div className="w-[310px] shrink-0 flex flex-col gap-4">
                {/* Daily Booking Overview */}
                <div className="bg-[#ffffff] border border-[#c8c5cb]/40 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-[#c8c5cb]/30 pb-2.5">
                    <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                      Daily Booking Triage
                    </span>
                    <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#1a1c1f] bg-[#f3f3f7] px-2 py-0.5 rounded font-medium border border-[#c8c5cb]/30">
                      {capacityPct !== null ? `${capacityPct}% Capacity` : "—"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 pt-3">
                    {[
                      { label: "Today's Guests", value: String(totals.totalGuests), suffix: "Total", tone: "text-[#1a1c1f]" },
                      { label: "In Service", value: String(totals.inServiceCount), suffix: "Active", tone: "text-[#000000]" },
                      { label: "Upcoming", value: String(totals.upcomingCount), suffix: "Queued", tone: "text-[#1a1c1f]" },
                      { label: "Completed", value: String(totals.completedCount), suffix: "Done", tone: "text-[#5e5e67]" },
                    ].map((k) => (
                      <div key={k.label} className="p-3 rounded-lg bg-[#f3f3f7]/50 border border-[#c8c5cb]/20">
                        <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] uppercase tracking-wider block">
                          {k.label}
                        </span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className={"text-[22px] leading-tight font-semibold " + k.tone}>{k.value}</span>
                          <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">{k.suffix}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Slot Finder */}
                <div className="bg-[#ffffff] border border-[#c8c5cb]/40 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-[#c8c5cb]/30 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#000000]">flash_on</span>
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#1a1c1f]">
                        Quick Slot Placement
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11.5px] leading-4 tracking-[0.04em] font-medium bg-[#eeedf1] text-[#1a1c1f] font-semibold">
                      {quickSlots.length} Available
                    </span>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {quickSlots.length === 0 && (
                      <p className="text-[12px] text-[#5e5e67] py-2">No open slots of 30+ minutes left today.</p>
                    )}
                    {quickSlots.map((slot, i) => (
                      <div key={i} className="p-3 rounded-lg border border-[#c8c5cb]/40 bg-[#f3f3f7]/30 flex flex-col gap-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[13.5px] leading-5 font-normal font-semibold text-[#1a1c1f] block">{slot.staffName}</span>
                            <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">{slot.minutes} min gap · {slot.timeLabel}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-end pt-1 border-t border-[#c8c5cb]/20">
                          <button
                            onClick={() => bookSlot(slot)}
                            className="px-2.5 py-1 rounded text-[11.5px] leading-4 tracking-[0.04em] font-medium transition-colors border border-[#c8c5cb]/60 hover:border-[#000000] text-[#1a1c1f] hover:bg-[#eeedf1]"
                          >
                            Book Slot
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setBooking({ prefill: null })}
                    className="w-full mt-0.5 py-2 rounded-lg border border-dashed border-[#c8c5cb]/50 hover:border-[#000000] text-[#5e5e67] hover:text-[#1a1c1f] hover:bg-[#eeedf1] active:scale-[0.99] text-[13.5px] leading-5 font-normal transition-all flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">calendar_add_on</span>
                    <span>Add Custom Time Slot</span>
                  </button>
                </div>

                {/* Next Arrivals */}
                <div className="bg-[#ffffff] border border-[#c8c5cb]/40 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-[#c8c5cb]/30 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#5e5e67]">schedule</span>
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                        Next Guest Arrivals
                      </span>
                    </div>
                    <span className="text-[11.5px] font-mono text-[#5e5e67] font-medium">Upcoming</span>
                  </div>
                  {nextArrivals.length === 0 && (
                    <p className="text-[12px] text-[#5e5e67] py-1">No more guests booked today.</p>
                  )}
                  {nextArrivals.map((g, i) => (
                    <div
                      key={i}
                      className={"flex items-start gap-3" + (i > 0 ? " pt-2 border-t border-[#c8c5cb]/20" : "")}
                    >
                      <div className="w-9 h-9 rounded-full bg-[#eeedf1] flex items-center justify-center text-[11.5px] leading-4 tracking-[0.04em] font-semibold text-[#1a1c1f] shrink-0">
                        {g.initials || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[13.5px] leading-5 font-normal font-semibold text-[#1a1c1f] truncate">{g.guestName}</h4>
                          <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#000000] font-medium bg-[#e8e8ec]/40 px-1.5 py-0.5 rounded">
                            {g.timeLabel}
                          </span>
                        </div>
                        <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-0.5">
                          {g.service}
                          {g.staffName ? ` · with ${g.staffName}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {booking && (
        <BookingSheet
          projectId={projectId}
          dateStr={dateStr}
          dayLabel={dayLabel}
          customers={customers}
          staff={lanes.filter((l) => l.id !== "anyone").map((l) => ({ id: l.id, name: l.name }))}
          prefill={booking.prefill}
          onClose={() => setBooking(null)}
        />
      )}
      {openAppt && <AppointmentSheet appt={openAppt} onClose={() => setOpenAppt(null)} />}
    </div>
  );
}

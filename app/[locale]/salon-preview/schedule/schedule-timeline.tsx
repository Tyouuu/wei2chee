"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The horizontal timeline the founder drew for the Day view (hours across,
 * one row per stylist), pulled out so the Week view can reuse it as it is:
 * one stylist, one row per DAY. Nothing about how it looks changed; only who
 * supplies the rows.
 */

export type LaneItem =
  | {
      type: "appointment";
      id: string;
      left: number;
      width: number;
      guestName: string;
      service: string;
      timeLabel: string;
      statusLabel: string;
      statusStyle: "solid" | "outline" | "muted";
      status: "booked" | "done" | "no_show" | "cancelled";
      arrived: boolean;
      href: string;
      staffName: string;
    }
  | { type: "block"; left: number; width: number; label: string; timeLabel: string }
  | {
      type: "gap";
      left: number;
      width: number;
      startMinutesOfDay: number;
      timeLabel: string;
      minutes: number;
      staffName: string;
      staffId: string;
      /** The day this open stretch is on (the Week view has seven of them). */
      date: string;
    };

export type StaffLane = {
  id: string;
  name: string;
  role: string;
  bookingsCount: number;
  loadPct: number;
  loadTone: "primary" | "secondary";
  statuses: ("inService" | "upcoming" | "completed")[];
  searchText: string;
  items: LaneItem[];
  /** Week rows are days: the label links to that day's schedule. */
  href?: string;
  isToday?: boolean;
};

export type StatusStyle = "solid" | "outline" | "muted";

const STATUS_STYLE: Record<StatusStyle, string> = {
  solid: "border-2 border-[#000000] shadow-sm hover:shadow",
  outline: "border border-[#c8c5cb]/60 hover:border-[#000000] shadow-2xs",
  muted: "border border-[#c8c5cb]/40 opacity-70",
};
const STATUS_BADGE: Record<StatusStyle, string> = {
  solid: "bg-[#000000] text-[#ffffff]",
  outline: "bg-[#e8e8ec] text-[#1a1c1f] border border-[#c8c5cb]/30",
  muted: "bg-[#f3f3f7] text-[#5e5e67] border border-[#c8c5cb]/30",
};

type Appointment = Extract<LaneItem, { type: "appointment" }>;
type Gap = Extract<LaneItem, { type: "gap" }>;

export function Timeline({
  header,
  lanes,
  hourLabels,
  totalWidth,
  nowLeft,
  nowLabel,
  laneHeader,
  empty,
  onBookGap,
  onOpenAppt,
}: {
  header: ReactNode;
  lanes: StaffLane[];
  hourLabels: { time: string; meridiem: string; current: boolean }[];
  totalWidth: number;
  nowLeft: number | null;
  nowLabel: string;
  laneHeader: string;
  empty: ReactNode;
  onBookGap: (gap: Gap) => void;
  onOpenAppt: (item: Appointment) => void;
}) {
  return (
    <div className="flex-1 min-w-0 bg-[#ffffff] border border-[#c8c5cb]/40 rounded-xl shadow-sm flex flex-col overflow-hidden">
      {header}

      <div className="relative w-full flex overflow-hidden">
        {/* Sticky label column */}
        <div className="w-[200px] shrink-0 border-r border-[#c8c5cb]/30 bg-[#ffffff] z-20 shadow-sm flex flex-col">
          <div className="h-12 px-4 py-2.5 text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67] flex items-center justify-between border-b border-[#c8c5cb]/30 bg-[#f3f3f7]">
            <span>{laneHeader}</span>
            <span className="material-symbols-outlined text-[15px] text-[#5e5e67]">swap_vert</span>
          </div>
          <div className="divide-y divide-[#c8c5cb]/20 flex flex-col">
            {lanes.map((lane) => (
              <div key={lane.id} data-testid="lane-label" className="h-[148px] p-3.5 flex flex-col justify-between bg-[#ffffff]">
                <div>
                  <div className="flex items-center gap-2">
                    {/* A day row that is not today gets a pale dot; stylist rows (isToday unset) stay black. */}
                    <span className={"w-2.5 h-2.5 rounded-full shrink-0 " + (lane.isToday === false ? "bg-[#c8c5cb]" : "bg-[#000000]")} />
                    {lane.href ? (
                      <Link href={lane.href} className="text-[13.5px] leading-5 font-semibold text-[#1a1c1f] truncate hover:underline">
                        {lane.name}
                      </Link>
                    ) : (
                      <span className="text-[13.5px] leading-5 font-semibold text-[#1a1c1f] truncate">{lane.name}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#5e5e67] mt-0.5">{lane.role}</p>
                </div>
                <div className="flex items-center justify-between text-[11.5px] text-[#5e5e67] pt-2 border-t border-[#c8c5cb]/20">
                  <span className="font-medium text-[#1a1c1f]">
                    {lane.bookingsCount} Booking{lane.bookingsCount === 1 ? "" : "s"}
                  </span>
                  <span
                    className={
                      "font-mono font-semibold px-1.5 py-0.5 rounded border border-[#c8c5cb]/30 " +
                      (lane.loadTone === "primary" ? "text-[#000000] bg-[#f3f3f7]" : "text-[#5e5e67] font-medium bg-[#f3f3f7]")
                    }
                  >
                    {lane.loadPct}% Load
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable timeline area */}
        <div id="timeline-scroll-area" className="flex-1 overflow-x-auto overflow-y-hidden select-none">
          <div className="relative" style={{ width: totalWidth }}>
            <div className="h-12 flex border-b border-[#c8c5cb]/30 bg-[#f3f3f7]">
              {hourLabels.map((h) => (
                <div
                  key={h.time + h.meridiem}
                  className={
                    "w-[160px] shrink-0 py-2 text-center border-r border-[#c8c5cb]/20 flex flex-col justify-center items-center " +
                    (h.current ? "bg-[#eeedf1]/70" : "")
                  }
                >
                  <span className={"font-mono font-semibold text-[13px] " + (h.current ? "text-[#000000]" : "text-[#1a1c1f]")}>{h.time}</span>
                  <span className={"text-[9.5px] font-mono " + (h.current ? "text-[#000000] font-semibold" : "text-[#5e5e67]")}>{h.meridiem}</span>
                </div>
              ))}
            </div>

            <div className="relative divide-y divide-[#c8c5cb]/20 bg-[#ffffff]">
              {nowLeft !== null && (
                <div className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center" style={{ left: nowLeft }}>
                  <div className="bg-[#000000] text-[#ffffff] px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold shadow-md -mt-3.5 z-40 flex items-center gap-1.5 border border-[#ffffff]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a] animate-pulse" />
                    <span>{nowLabel} NOW</span>
                  </div>
                  <div className="w-[2px] h-full bg-[#000000] shadow-sm" />
                </div>
              )}

              {lanes.map((lane) => (
                <div key={lane.id} className="h-[148px] relative py-2.5 px-2">
                  {lane.items.map((item, i) => {
                    if (item.type === "gap") {
                      return (
                        <div
                          key={`gap-${i}`}
                          className="absolute top-2.5 bottom-2.5"
                          style={{ left: item.left + 8, width: Math.max(item.width - 16, 40) }}
                        >
                          <button
                            onClick={() => onBookGap(item)}
                            className="h-full w-full rounded-lg border-2 border-dashed border-[#c8c5cb]/50 hover:border-[#000000] text-[#5e5e67] hover:text-[#1a1c1f] flex flex-col items-center justify-center p-2 hover:bg-[#f3f3f7]/60 transition-all text-center"
                          >
                            <span className="material-symbols-outlined text-[16px] text-[#000000]">add_circle</span>
                            <span className="text-[11px] font-mono text-[#000000] font-bold mt-1">{item.timeLabel}</span>
                            <span className="text-[10px] text-[#5e5e67]">{item.minutes} min Open</span>
                          </button>
                        </div>
                      );
                    }
                    if (item.type === "block") {
                      return (
                        <div
                          key={`block-${i}`}
                          className="absolute top-2.5 bottom-2.5"
                          style={{ left: item.left + 8, width: Math.max(item.width - 16, 40) }}
                        >
                          <div className="h-full w-full rounded-lg border border-[#c8c5cb]/30 bg-[#f3f3f7]/30 flex flex-col items-center justify-center p-2 text-[#5e5e67] text-center">
                            <span className="text-[11px] font-bold text-[#1a1c1f]">{item.label}</span>
                            <span className="text-[10px] font-mono text-[#5e5e67] mt-0.5">{item.timeLabel}</span>
                          </div>
                        </div>
                      );
                    }
                    // A 30-minute booking is only ~80px wide: the status label used to
                    // eat the whole row and the guest's name disappeared. Narrow cards
                    // trade the label for a dot (the full sentence is in the tooltip
                    // and in the panel that opens on click) so the NAME stays readable.
                    const cardWidth = Math.max(item.width - 16, 60);
                    const narrow = cardWidth < 130;
                    return (
                      <div
                        key={item.id}
                        className="absolute top-2.5 bottom-2.5 z-10"
                        style={{ left: item.left + 8, width: cardWidth }}
                      >
                        <div
                          onClick={() => onOpenAppt(item)}
                          data-testid="appt-card"
                          title={`${item.guestName} — ${item.service} · ${item.timeLabel} · ${item.statusLabel}`}
                          className={
                            "h-full bg-[#ffffff] rounded-lg flex flex-col justify-between transition-all cursor-pointer " +
                            (narrow ? "p-2 " : "p-3 ") +
                            STATUS_STYLE[item.statusStyle]
                          }
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className={"font-bold text-[#1a1c1f] truncate " + (narrow ? "text-[12px]" : "text-[13px]")}>{item.guestName}</span>
                              {narrow ? (
                                <span
                                  aria-hidden
                                  className={
                                    "w-2 h-2 rounded-full shrink-0 " +
                                    (item.statusStyle === "solid" ? "bg-[#000000]" : item.statusStyle === "outline" ? "bg-[#c8c5cb]" : "bg-[#e8e8ec] border border-[#c8c5cb]")
                                  }
                                />
                              ) : (
                                <span className={"px-2 py-0.5 rounded text-[9.5px] font-mono font-bold shrink-0 " + STATUS_BADGE[item.statusStyle]}>
                                  {item.statusLabel}
                                </span>
                              )}
                            </div>
                            <p className={"text-[#47464b] font-medium mt-1 truncate " + (narrow ? "text-[11px]" : "text-[11.5px]")}>{item.service}</p>
                          </div>
                          <div className="text-[10.5px] font-mono text-[#5e5e67] border-t border-[#c8c5cb]/20 pt-1.5 truncate">
                            {narrow ? item.timeLabel.split(" - ")[0] : item.timeLabel}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {lanes.length === 0 && (
                <div className="p-10 flex flex-col items-center justify-center gap-2 text-center">
                  <span className="material-symbols-outlined text-[28px] text-[#c8c5cb]">search_off</span>
                  <p className="text-[13.5px] font-medium text-[#5e5e67]">{empty}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

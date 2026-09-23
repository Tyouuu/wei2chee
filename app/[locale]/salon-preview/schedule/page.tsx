"use client";

import { useState } from "react";
import { MaterialSymbolsLink, SalonSidebar } from "../salon-shell";

/**
 * Literal port of the founder's own Stitch source for "Appointments &
 * Schedule" (the Floor Timeline gantt, Task 405, pasted 2026-09-23). Same
 * class names translated to arbitrary hex, same absolute-positioned block
 * layout at the same pixel offsets he designed -- this is the page Task 405
 * flagged as needing genuinely new backend (chair/station occupancy, live
 * "in service" state), so every number on it is his own sample content, not
 * read from any database.
 *
 * "use client": the source's own onclick handlers (scrubber, All Day /
 * Morning / Afternoon, Assign Walk-in / Book Slot) are kept working rather
 * than dropped, because a demo page with buttons that visibly do nothing is
 * exactly the dead-button defect this repo's own record-table.tsx refuses to
 * ship. They stay literal to the source (scrollTo / alert), matching what a
 * pre-backend demo can honestly promise.
 *
 * Extended in the same spirit to every other dead control on this page:
 *  - the 4 timeline rows are each their own uniquely-shaped hand-written
 *    block (like Audit Log's 6 rows) rather than a data array, so the
 *    "All Roster Stylists" filter, the search box and the 4 status pills
 *    all work at ROW granularity (hide/show a whole stylist's row), not by
 *    hiding individual appointment cards inside a row -- the cards within a
 *    row mix statuses (an in-service card and an upcoming card can sit in
 *    the same row) and aren't a uniform shape either, so per-card filtering
 *    would mean rewriting ~10 bespoke absolutely-positioned blocks; per-row
 *    filtering reuses the same technique already shipped on Audit Log.
 *  - Previous/Next/Today and "+ New Appointment" would need a different
 *    day's worth of sample data to have any real effect, which doesn't
 *    exist (same category as Stock's purchase-order builder) -- they get an
 *    honest `alert()` in the same voice the source's own Book Slot / Assign
 *    Walk-in handlers already use, rather than silently doing nothing.
 *  - the Day / Gap & Open Slots / Week View tabs get a real active-state
 *    toggle (the click is genuinely tracked), but Gap/Week don't switch to
 *    different content -- there's no alternate layout for them in the
 *    source, and inventing one would be a new screen, not a wiring fix.
 */

type Status = "inService" | "upcoming" | "completed";

const STYLISTS: {
  name: string;
  role: string;
  bookings: string;
  load: string;
  loadTone: "primary" | "secondary";
  statuses: Status[];
  searchText: string;
}[] = [
  {
    name: "Amy Chen",
    role: "Station 01 · Senior Master",
    bookings: "4 Bookings",
    load: "80% Load",
    loadTone: "primary",
    statuses: ["inService", "upcoming"],
    searchText: "Amy Chen Amanda Choong Balayage Highlights Scalp Spa Marcus Tan Fade Cut Beard Shaping",
  },
  {
    name: "Jasmine Teo",
    role: "Station 02 · Director Colorist",
    bookings: "5 Bookings",
    load: "100% Full",
    loadTone: "primary",
    statuses: ["inService", "upcoming"],
    searchText:
      "Jasmine Teo Datin Nora Root Touchup Gloss Toner Cool Ash Rachel Soo Digital Perm Keratin Treatment Therapy",
  },
  {
    name: "Chloe Tan",
    role: "Station 03 · Creative Stylist",
    bookings: "3 Bookings",
    load: "65% Load",
    loadTone: "secondary",
    statuses: ["completed", "inService", "upcoming"],
    searchText:
      "Chloe Tan Lim Wei Seng Finishing Cut Scalp Treatment Elena Rostova Root Color Signature Blowout Wash Style",
  },
  {
    name: "Kelvin Ng",
    role: "Station 04 · Senior Barber",
    bookings: "2 Bookings",
    load: "45% Load",
    loadTone: "secondary",
    statuses: ["upcoming"],
    searchText: "Kelvin Ng Darren Lee Precision Cut Lucas Wong Fade Beard",
  },
];

const STATUS_PILLS: { key: Status | "all"; label: string }[] = [
  { key: "all", label: "All (18)" },
  { key: "inService", label: "In Service (4)" },
  { key: "upcoming", label: "Upcoming (10)" },
  { key: "completed", label: "Completed (4)" },
];

export default function SalonSchedulePreview() {
  const [viewTab, setViewTab] = useState<"day" | "gap" | "week">("day");
  const [activeStylist, setActiveStylist] = useState<string>("all");
  const [stylistMenuOpen, setStylistMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  const scrollTimeline = (left: number) => {
    document.getElementById("timeline-scroll-area")?.scrollTo({ left, behavior: "smooth" });
  };

  const rowVisible = (s: (typeof STYLISTS)[number]) => {
    if (activeStylist !== "all" && activeStylist !== s.name) return false;
    if (statusFilter !== "all" && !s.statuses.includes(statusFilter)) return false;
    const q = search.trim().toLowerCase();
    if (q && !s.searchText.toLowerCase().includes(q)) return false;
    return true;
  };

  const showAmy = rowVisible(STYLISTS[0]);
  const showJasmine = rowVisible(STYLISTS[1]);
  const showChloe = rowVisible(STYLISTS[2]);
  const showKelvin = rowVisible(STYLISTS[3]);
  const visibleStylistCount = [showAmy, showJasmine, showChloe, showKelvin].filter(Boolean).length;

  const noSampleDataForOtherDays = () =>
    alert("This demo only has sample bookings for Thursday, Oct 24 -- date navigation isn't wired yet.");

  return (
    <>
      <MaterialSymbolsLink />
      <div
        className="bg-[#f9f9fd] text-[#1a1c1f] text-[14.5px] leading-[22px] tracking-[-0.005em] antialiased min-h-screen"
        style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
      >
        <SalonSidebar active="appointments-and-flow" />
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
                      <span className="font-medium tracking-tight text-[12px]">Live Roster · 4 Stylists on Shift</span>
                    </div>
                    <div className="inline-flex items-center p-1 rounded-xl bg-[#f3f3f7] border border-[#c8c5cb]/30 select-none">
                      <button
                        onClick={() => setViewTab("day")}
                        className={
                          "px-4 py-1.5 rounded-lg text-[13.5px] leading-5 font-normal leading-tight text-center transition-all active:scale-[0.97] " +
                          (viewTab === "day" ? "bg-[#ffffff] text-[#1a1c1f] shadow-sm" : "text-[#5e5e67] hover:text-[#1a1c1f]")
                        }
                      >
                        Day
                        <br />
                        <span className="font-medium text-[11px] text-[#5e5e67]">Schedule</span>
                      </button>
                      <button
                        onClick={() => setViewTab("gap")}
                        className={
                          "px-4 py-1.5 rounded-lg text-[13.5px] leading-5 font-normal leading-tight text-center transition-all active:scale-[0.97] " +
                          (viewTab === "gap" ? "bg-[#ffffff] text-[#1a1c1f] shadow-sm" : "text-[#5e5e67] hover:text-[#1a1c1f]")
                        }
                      >
                        Gap &amp; Open
                        <br />
                        <span className="text-[11px]">Slots</span>
                      </button>
                      <button
                        onClick={() => setViewTab("week")}
                        className={
                          "px-4 py-1.5 rounded-lg text-[13.5px] leading-5 font-normal leading-tight text-center transition-all active:scale-[0.97] " +
                          (viewTab === "week" ? "bg-[#ffffff] text-[#1a1c1f] shadow-sm" : "text-[#5e5e67] hover:text-[#1a1c1f]")
                        }
                      >
                        Week
                        <br />
                        <span className="text-[11px]">View</span>
                      </button>
                    </div>
                    <button
                      onClick={() => alert("New Appointment booking form isn't wired up in this demo yet.")}
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

                {viewTab !== "day" && (
                  <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] bg-[#f3f3f7] border border-[#c8c5cb]/30 rounded-lg px-3 py-2">
                    {viewTab === "gap" ? "Gap & Open Slots" : "Week View"} isn&apos;t built in this demo yet -- showing
                    today&apos;s Day Schedule below.
                  </div>
                )}

                {/* Filters, Date Controls & Status Summary */}
                <div className="flex items-center justify-between pt-1 gap-4 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center rounded-lg bg-[#ffffff] border border-[#c8c5cb]/50 shadow-2xs overflow-hidden">
                      <button
                        onClick={noSampleDataForOtherDays}
                        className="px-2.5 py-1.5 hover:bg-[#eeedf1] text-[#5e5e67] hover:text-[#1a1c1f] transition-colors active:scale-[0.97]"
                        title="Previous Day"
                      >
                        <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                      </button>
                      <div className="px-3 py-1.5 text-[13.5px] leading-5 font-normal text-[#1a1c1f] border-x border-[#c8c5cb]/30 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[15px] text-[#5e5e67]">calendar_today</span>
                        <span>Thursday, Oct 24, 2024</span>
                      </div>
                      <button
                        onClick={noSampleDataForOtherDays}
                        className="px-2.5 py-1.5 hover:bg-[#eeedf1] text-[#5e5e67] hover:text-[#1a1c1f] transition-colors active:scale-[0.97]"
                        title="Next Day"
                      >
                        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                      </button>
                    </div>
                    <button
                      onClick={noSampleDataForOtherDays}
                      className="px-3 py-1.5 rounded-lg border border-[#c8c5cb]/50 text-[13.5px] leading-5 font-normal text-[#1a1c1f] hover:bg-[#eeedf1] active:scale-[0.97] transition-colors bg-[#ffffff] shadow-2xs"
                    >
                      Today
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setStylistMenuOpen((v) => !v)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#c8c5cb]/50 text-[13.5px] leading-5 font-normal text-[#1a1c1f] hover:bg-[#eeedf1] active:scale-[0.97] transition-colors bg-[#ffffff] shadow-2xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#000000]" />
                        <span>{activeStylist === "all" ? "All Roster Stylists (4 on duty)" : activeStylist}</span>
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
                            All Roster Stylists (4 on duty)
                          </button>
                          {STYLISTS.map((s) => (
                            <button
                              key={s.name}
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
                              <span className="block text-[11px] text-[#5e5e67] font-normal">{s.role}</span>
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

              {/* Main Canvas: Gantt Flow & Dispatch Drawer */}
              <div className="p-8 flex gap-6 items-start">
                {/* Timeline Board */}
                <div className="flex-1 min-w-0 bg-[#ffffff] border border-[#c8c5cb]/40 rounded-xl shadow-sm flex flex-col overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#c8c5cb]/30 flex flex-wrap items-center justify-between gap-3 bg-[#ffffff]">
                    <div className="flex items-center gap-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#000000] font-semibold">
                          Timeline Flow
                        </span>
                        <span className="text-[11.5px] font-mono px-2 py-0.5 rounded bg-[#eeedf1] text-[#5e5e67] border border-[#c8c5cb]/30">
                          09:00 - 18:00 (9h Shift)
                        </span>
                      </div>
                      <span className="text-[#c8c5cb]/40 text-sm">|</span>
                      <div className="inline-flex p-0.5 rounded-lg bg-[#eeedf1] text-[#5e5e67] text-[11.5px]">
                        <button
                          onClick={() => scrollTimeline(0)}
                          className="px-2.5 py-1 rounded bg-[#ffffff] text-[#1a1c1f] font-medium shadow-2xs transition-all active:scale-[0.97]"
                        >
                          All Day
                        </button>
                        <button onClick={() => scrollTimeline(0)} className="px-2.5 py-1 rounded hover:text-[#1a1c1f] active:scale-[0.97] transition-colors">
                          Morning (09-13)
                        </button>
                        <button onClick={() => scrollTimeline(640)} className="px-2.5 py-1 rounded hover:text-[#1a1c1f] active:scale-[0.97] transition-colors">
                          Afternoon (13-18)
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
                      <div className="flex items-center gap-1.5 text-[11.5px] text-[#000000] font-mono bg-[#f3f3f7] px-2 py-1 rounded border border-[#c8c5cb]/30">
                        <span className="inline-block w-2 h-2 rounded-full bg-[#000000] animate-pulse" />
                        <span className="font-semibold">11:20 AM NOW</span>
                      </div>
                    </div>
                  </div>

                  {/* Timeline Scrubber */}
                  <div className="px-5 py-2.5 bg-[#f3f3f7]/40 border-b border-[#c8c5cb]/20 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-[11px] text-[#5e5e67] shrink-0">
                      <span className="material-symbols-outlined text-[15px] text-[#000000]">tune</span>
                      <span>Timeline Scrubber</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div
                        className="relative flex-1 h-3 bg-[#e8e8ec]/60 rounded-full overflow-hidden cursor-pointer"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const pct = (e.clientX - rect.left) / rect.width;
                          const area = document.getElementById("timeline-scroll-area");
                          if (!area) return;
                          area.scrollTo({ left: pct * (1440 - area.clientWidth + 200), behavior: "smooth" });
                        }}
                      >
                        <div className="absolute top-0 bottom-0 left-0 w-[42%] bg-[#000000]/20 border-r-2 border-[#000000] rounded-l-full" />
                        <div className="absolute top-0 bottom-0 left-[25.9%] w-1.5 bg-[#000000] rounded-full" />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-[#5e5e67] w-28 shrink-0">
                        <span>09:00</span>
                        <span className="text-[#000000] font-semibold">11:20</span>
                        <span>18:00</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-[#5e5e67]">
                      <span className="material-symbols-outlined text-[14px]">swipe</span>
                      <span>Scroll horizontal for afternoon</span>
                    </div>
                  </div>

                  {/* Grid */}
                  <div className="relative w-full flex overflow-hidden">
                    {/* Sticky stylist column */}
                    <div className="w-[200px] shrink-0 border-r border-[#c8c5cb]/30 bg-[#ffffff] z-20 shadow-sm flex flex-col">
                      <div className="h-12 px-4 py-2.5 text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67] flex items-center justify-between border-b border-[#c8c5cb]/30 bg-[#f3f3f7]">
                        <span>Stylist / Chair</span>
                        <span className="material-symbols-outlined text-[15px] text-[#5e5e67]">swap_vert</span>
                      </div>
                      <div className="divide-y divide-[#c8c5cb]/20 flex flex-col">
                        {STYLISTS.filter(rowVisible).map((s) => (
                          <div key={s.name} className="h-[148px] p-3.5 flex flex-col justify-between bg-[#ffffff]">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#000000] shrink-0" />
                                <span className="text-[13.5px] leading-5 font-normal font-semibold text-[#1a1c1f] truncate">
                                  {s.name}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#5e5e67] mt-0.5">{s.role}</p>
                            </div>
                            <div className="flex items-center justify-between text-[11.5px] text-[#5e5e67] pt-2 border-t border-[#c8c5cb]/20">
                              <span className="font-medium text-[#1a1c1f]">{s.bookings}</span>
                              <span
                                className={
                                  "font-mono font-semibold px-1.5 py-0.5 rounded border border-[#c8c5cb]/30 " +
                                  (s.loadTone === "primary" ? "text-[#000000] bg-[#f3f3f7]" : "text-[#5e5e67] font-medium bg-[#f3f3f7]")
                                }
                              >
                                {s.load}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Scrollable timeline area */}
                    <div id="timeline-scroll-area" className="flex-1 overflow-x-auto overflow-y-hidden select-none">
                      <div className="w-[1440px] relative">
                        {/* Hour header */}
                        <div className="h-12 grid grid-cols-9 border-b border-[#c8c5cb]/30 bg-[#f3f3f7]">
                          {["09:00 AM", "10:00 AM", "11:00 AM · Current", "12:00 PM", "13:00 PM", "14:00 PM", "15:00 PM", "16:00 PM", "17:00 PM"].map(
                            (h, i) => {
                              const [time, meridiem] = h.split(" ");
                              const current = i === 2;
                              return (
                                <div
                                  key={h}
                                  className={
                                    "w-[160px] py-2 text-center border-r border-[#c8c5cb]/20 flex flex-col justify-center items-center " +
                                    (current ? "bg-[#eeedf1]/70" : "")
                                  }
                                >
                                  <span className={"font-mono font-semibold text-[13px] " + (current ? "text-[#000000]" : "text-[#1a1c1f]")}>
                                    {time}
                                  </span>
                                  <span className={"text-[9.5px] font-mono " + (current ? "text-[#000000] font-semibold" : "text-[#5e5e67]")}>
                                    {meridiem}
                                  </span>
                                </div>
                              );
                            },
                          )}
                        </div>

                        <div className="relative divide-y divide-[#c8c5cb]/20 bg-[#ffffff]">
                          {/* NOW line */}
                          <div className="absolute top-0 bottom-0 left-[373px] z-30 pointer-events-none flex flex-col items-center">
                            <div className="bg-[#000000] text-[#ffffff] px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold shadow-md -mt-3.5 z-40 flex items-center gap-1.5 border border-[#ffffff]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a] animate-pulse" />
                              <span>11:20 NOW</span>
                            </div>
                            <div className="w-[2px] h-full bg-[#000000] shadow-sm" />
                          </div>

                          {/* Row 1: Amy Chen */}
                          {showAmy && (
                          <div className="h-[148px] relative py-2.5 px-2">
                            <div className="absolute left-[8px] w-[144px] top-2.5 bottom-2.5">
                              <div className="h-full w-full rounded-lg border border-dashed border-[#c8c5cb]/50 bg-[#f3f3f7]/30 hover:bg-[#f3f3f7]/60 flex flex-col items-center justify-center p-2 text-[#5e5e67] transition-all">
                                <span className="material-symbols-outlined text-[16px] text-[#5e5e67]">cleaning_services</span>
                                <span className="text-[11px] font-mono font-medium mt-1 text-[#1a1c1f]">09:00 - 10:00</span>
                                <span className="text-[10px] text-[#5e5e67]">Station Prep &amp; Setup</span>
                              </div>
                            </div>
                            <div className="absolute left-[168px] w-[240px] top-2.5 bottom-2.5 z-10">
                              <div
                                onClick={() => alert("Amanda Choong — Balayage Highlights & Scalp Spa (10:00 - 11:30, in service)")}
                                className="h-full bg-[#ffffff] border-2 border-[#000000] rounded-lg p-3 flex flex-col justify-between shadow-sm hover:shadow transition-all cursor-pointer"
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-[13px] text-[#1a1c1f] truncate">Amanda Choong</span>
                                    <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-[#000000] text-[#ffffff]">
                                      IN SERVICE
                                    </span>
                                  </div>
                                  <p className="text-[11.5px] text-[#47464b] font-medium mt-1 truncate">Balayage Highlights &amp; Scalp Spa</p>
                                </div>
                                <div className="text-[10.5px] font-mono text-[#000000] font-semibold border-t border-[#c8c5cb]/20 pt-1.5 flex items-center justify-between">
                                  <span>10:00 - 11:30 (90m)</span>
                                  <span className="text-[#ba1a1a] font-medium">Rinse in 10m</span>
                                </div>
                              </div>
                            </div>
                            <div className="absolute left-[416px] w-[152px] top-2.5 bottom-2.5 z-10">
                              <button
                                onClick={() => alert("Slot booked with Amy Chen at 11:30 AM")}
                                className="h-full w-full rounded-lg border-2 border-dashed border-[#c8c5cb]/60 hover:border-[#000000] text-[#5e5e67] hover:text-[#1a1c1f] flex flex-col items-center justify-center p-2 hover:bg-[#f3f3f7]/60 transition-all text-center"
                              >
                                <span className="material-symbols-outlined text-[16px] text-[#000000]">add_circle</span>
                                <span className="text-[11px] font-mono text-[#000000] font-bold mt-1">11:30 - 12:30</span>
                                <span className="text-[10px] text-[#5e5e67]">60 min Gap</span>
                                <span className="mt-1 px-2 py-0.5 text-[9.5px] font-medium rounded bg-[#eeedf1] border border-[#c8c5cb]/40 hover:bg-[#000000] hover:text-[#ffffff]">
                                  + Book Slot
                                </span>
                              </button>
                            </div>
                            <div className="absolute left-[576px] w-[232px] top-2.5 bottom-2.5 z-10">
                              <div
                                onClick={() => alert("Marcus Tan — Fade Cut & Beard Shaping (12:30 - 14:00, confirmed)")}
                                className="h-full bg-[#ffffff] border border-[#c8c5cb]/60 hover:border-[#000000] rounded-lg p-3 flex flex-col justify-between shadow-2xs transition-all cursor-pointer"
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-[13px] text-[#1a1c1f] truncate">Marcus Tan</span>
                                    <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-medium bg-[#e8e8ec] text-[#1a1c1f] border border-[#c8c5cb]/30">
                                      UPCOMING
                                    </span>
                                  </div>
                                  <p className="text-[11.5px] text-[#47464b] font-medium mt-1 truncate">Fade Cut &amp; Beard Shaping</p>
                                </div>
                                <div className="text-[10.5px] font-mono text-[#5e5e67] border-t border-[#c8c5cb]/20 pt-1.5 flex items-center justify-between">
                                  <span>12:30 - 14:00 (90m)</span>
                                  <span className="text-[#5e5e67]/70">Confirmed</span>
                                </div>
                              </div>
                            </div>
                            <div className="absolute left-[816px] w-[612px] top-2.5 bottom-2.5">
                              <button className="h-full w-full rounded-lg border-2 border-dashed border-[#c8c5cb]/40 hover:border-[#000000] text-[#5e5e67] hover:text-[#1a1c1f] flex items-center justify-between px-5 hover:bg-[#f3f3f7]/40 transition-all">
                                <div className="flex items-center gap-3 text-left">
                                  <span className="material-symbols-outlined text-[20px] text-[#000000]">calendar_add_on</span>
                                  <div>
                                    <span className="text-[13px] font-bold text-[#1a1c1f] block">
                                      14:00 - 17:00 (3.0h Open Afternoon Block)
                                    </span>
                                    <span className="text-[11px] text-[#5e5e67] mt-0.5 block">
                                      Free slot for Cut, Balayage Color, or Deep Hair Treatment
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      alert("Walk-in assigned");
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-[#000000] text-[#ffffff] text-[11px] font-medium shadow-2xs hover:bg-neutral-800"
                                  >
                                    + Add Walk-in
                                  </span>
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      alert("Opens the appointment scheduler for Amy Chen, 14:00 - 17:00 (not wired in this demo)");
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-[#c8c5cb]/50 text-[11px] font-medium hover:bg-[#eeedf1]"
                                  >
                                    Schedule Appointment
                                  </span>
                                </div>
                              </button>
                            </div>
                          </div>
                          )}

                          {/* Row 2: Jasmine Teo */}
                          {showJasmine && (
                          <div className="h-[148px] relative py-2.5 px-2">
                            <div className="absolute left-[8px] w-[144px] top-2.5 bottom-2.5">
                              <div className="h-full w-full rounded-lg border border-[#c8c5cb]/30 bg-[#f3f3f7]/30 flex flex-col items-center justify-center p-2 text-[#5e5e67] text-center">
                                <span className="text-[11px] font-bold text-[#1a1c1f]">Color Formulation Lab</span>
                                <span className="text-[10px] font-mono text-[#5e5e67] mt-0.5">09:00 - 10:00</span>
                              </div>
                            </div>
                            <div className="absolute left-[168px] w-[400px] top-2.5 bottom-2.5 z-10">
                              <div
                                onClick={() =>
                                  alert("Datin Nora — Full Root Touchup & Gloss Toner (10:00 - 12:30, processing, 15m left)")
                                }
                                className="h-full bg-[#ffffff] border-2 border-[#000000] rounded-lg p-3 flex flex-col justify-between shadow-sm hover:shadow transition-all cursor-pointer"
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-[13px] text-[#1a1c1f] truncate">Datin Nora</span>
                                      <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-[#000000] text-[#ffffff]">
                                        VIP GUEST
                                      </span>
                                    </div>
                                    <span className="text-[10.5px] font-mono text-[#5e5e67] font-semibold">Formula #L9-G</span>
                                  </div>
                                  <p className="text-[11.5px] text-[#47464b] font-medium mt-1 truncate">
                                    Full Root Touchup &amp; Gloss Toner (7.1 Cool Ash Blend)
                                  </p>
                                </div>
                                <div className="text-[10.5px] font-mono text-[#000000] font-semibold border-t border-[#c8c5cb]/20 pt-1.5 flex items-center justify-between">
                                  <span>10:00 - 12:30 (150m)</span>
                                  <span className="text-[#ba1a1a] font-medium">Processing · 15m left</span>
                                </div>
                              </div>
                            </div>
                            <div className="absolute left-[576px] w-[72px] top-2.5 bottom-2.5">
                              <div className="h-full bg-[#f3f3f7]/60 rounded-lg border border-dashed border-[#c8c5cb]/40 flex flex-col items-center justify-center text-center p-1">
                                <span className="text-[10.5px] font-semibold text-[#5e5e67]">Staff Lunch</span>
                                <span className="text-[9px] font-mono text-[#5e5e67]/70">30m</span>
                              </div>
                            </div>
                            <div className="absolute left-[656px] w-[392px] top-2.5 bottom-2.5 z-10">
                              <div
                                onClick={() => alert("Rachel Soo — Digital Perm & Keratin Treatment Therapy (13:00 - 15:30, deposit paid $80)")}
                                className="h-full bg-[#ffffff] border border-[#c8c5cb]/60 hover:border-[#000000] rounded-lg p-3 flex flex-col justify-between shadow-2xs transition-all cursor-pointer"
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-[13px] text-[#1a1c1f] truncate">Rachel Soo</span>
                                    <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-medium bg-[#e8e8ec] text-[#1a1c1f] border border-[#c8c5cb]/30">
                                      CONFIRMED
                                    </span>
                                  </div>
                                  <p className="text-[11.5px] text-[#47464b] font-medium mt-1 truncate">Digital Perm &amp; Keratin Treatment Therapy</p>
                                </div>
                                <div className="text-[10.5px] font-mono text-[#5e5e67] border-t border-[#c8c5cb]/20 pt-1.5 flex items-center justify-between">
                                  <span>13:00 - 15:30 (150m)</span>
                                  <span className="text-[#5e5e67]">Deposit Paid ($80)</span>
                                </div>
                              </div>
                            </div>
                            <div className="absolute left-[1056px] w-[372px] top-2.5 bottom-2.5">
                              <button
                                onClick={() => alert("Slot booked with Jasmine Teo at 15:30 PM")}
                                className="h-full w-full rounded-lg border-2 border-dashed border-[#c8c5cb]/40 hover:border-[#000000] text-[#5e5e67] hover:text-[#1a1c1f] flex items-center justify-between px-4 hover:bg-[#f3f3f7]/40 transition-all"
                              >
                                <div className="flex items-center gap-2.5 text-left">
                                  <span className="material-symbols-outlined text-[18px] text-[#000000]">add_circle</span>
                                  <div>
                                    <span className="text-[12px] font-bold text-[#1a1c1f] block">15:30 - 17:00 (1.5h Open)</span>
                                    <span className="text-[10.5px] text-[#5e5e67]">Color Consult or Quick Blowout Styling</span>
                                  </div>
                                </div>
                                <span className="px-2.5 py-1 rounded border border-[#c8c5cb]/60 text-[10.5px] font-medium hover:bg-[#000000] hover:text-[#ffffff] transition-colors">
                                  + Book Slot
                                </span>
                              </button>
                            </div>
                          </div>
                          )}

                          {/* Row 3: Chloe Tan */}
                          {showChloe && (
                          <div className="h-[148px] relative py-2.5 px-2">
                            <div className="absolute left-[8px] w-[232px] top-2.5 bottom-2.5">
                              <div className="h-full w-full rounded-lg border border-dashed border-[#c8c5cb]/40 bg-[#f3f3f7]/20 flex flex-col items-center justify-center p-2 text-[#5e5e67] text-center">
                                <div className="flex items-center gap-1.5 text-[#000000]">
                                  <span className="material-symbols-outlined text-[15px]">check_circle</span>
                                  <span className="text-[11.5px] font-mono font-bold">09:00 - 10:30 Completed</span>
                                </div>
                                <span className="text-[10px] text-[#5e5e67] mt-0.5">Men&apos;s Wash &amp; Finish Style</span>
                              </div>
                            </div>
                            <div className="absolute left-[248px] w-[232px] top-2.5 bottom-2.5 z-10">
                              <div
                                onClick={() => alert("Lim Wei Seng — Finishing Cut & Scalp Treatment (10:30 - 12:00, in service)")}
                                className="h-full bg-[#ffffff] border-2 border-[#000000] rounded-lg p-3 flex flex-col justify-between shadow-sm hover:shadow transition-all cursor-pointer"
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-[13px] text-[#1a1c1f] truncate">Lim Wei Seng</span>
                                    <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-[#000000] text-[#ffffff]">
                                      IN SERVICE
                                    </span>
                                  </div>
                                  <p className="text-[11.5px] text-[#47464b] font-medium mt-1 truncate">Finishing Cut &amp; Scalp Treatment</p>
                                </div>
                                <div className="text-[10.5px] font-mono text-[#000000] font-semibold border-t border-[#c8c5cb]/20 pt-1.5 flex items-center justify-between">
                                  <span>10:30 - 12:00 (90m)</span>
                                  <span className="text-[#5e5e67]">Blowdry in 15m</span>
                                </div>
                              </div>
                            </div>
                            <div className="absolute left-[488px] w-[312px] top-2.5 bottom-2.5 z-10">
                              <div
                                onClick={() => alert("Elena Rostova — Root Color & Signature Blowout (12:00 - 14:00, patch test cleared)")}
                                className="h-full bg-[#ffffff] border border-[#c8c5cb]/60 hover:border-[#000000] rounded-lg p-3 flex flex-col justify-between shadow-2xs transition-all cursor-pointer"
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-[13px] text-[#1a1c1f] truncate">Elena Rostova</span>
                                    <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-medium bg-[#e8e8ec] text-[#1a1c1f] border border-[#c8c5cb]/30">
                                      UPCOMING
                                    </span>
                                  </div>
                                  <p className="text-[11.5px] text-[#47464b] font-medium mt-1 truncate">Root Color &amp; Signature Blowout</p>
                                </div>
                                <div className="text-[10.5px] font-mono text-[#5e5e67] border-t border-[#c8c5cb]/20 pt-1.5 flex items-center justify-between">
                                  <span>12:00 - 14:00 (120m)</span>
                                  <span className="text-[#000000] font-medium">Patch Cleared</span>
                                </div>
                              </div>
                            </div>
                            <div className="absolute left-[808px] w-[620px] top-2.5 bottom-2.5">
                              <button
                                onClick={() => alert("Slot booked with Chloe Tan at 02:00 PM")}
                                className="h-full w-full rounded-lg border-2 border-dashed border-[#c8c5cb]/40 hover:border-[#000000] text-[#5e5e67] hover:text-[#1a1c1f] flex items-center justify-between px-5 hover:bg-[#f3f3f7]/40 transition-all"
                              >
                                <div className="flex items-center gap-3 text-left">
                                  <span className="material-symbols-outlined text-[20px] text-[#000000]">calendar_add_on</span>
                                  <div>
                                    <span className="text-[13px] font-bold text-[#1a1c1f] block">
                                      14:00 - 17:00 (3.0h Open Afternoon Slot)
                                    </span>
                                    <span className="text-[11px] text-[#5e5e67] mt-0.5 block">
                                      Chloe Free Block · Reserved for Cut, Color, or Perm
                                    </span>
                                  </div>
                                </div>
                                <span className="px-3 py-1.5 rounded-lg border border-[#c8c5cb]/60 text-[11px] font-medium hover:bg-[#000000] hover:text-[#ffffff] transition-colors">
                                  + Quick Slot
                                </span>
                              </button>
                            </div>
                          </div>
                          )}

                          {/* Row 4: Kelvin Ng */}
                          {showKelvin && (
                          <div className="h-[148px] relative py-2.5 px-2">
                            <div className="absolute left-[8px] w-[392px] top-2.5 bottom-2.5 z-10">
                              <button
                                onClick={() => alert("Walk-in assigned to Kelvin Ng")}
                                className="h-full w-full rounded-lg border-2 border-dashed border-[#c8c5cb]/50 hover:border-[#000000] text-[#5e5e67] hover:text-[#1a1c1f] flex flex-col items-center justify-center p-3 hover:bg-[#f3f3f7]/60 transition-all text-center"
                              >
                                <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#000000]">
                                  <span className="material-symbols-outlined text-[16px]">bolt</span>
                                  <span>09:00 - 11:30 Open (Chair Ready Now)</span>
                                </div>
                                <span className="text-[10.5px] text-[#5e5e67] mt-1">Ideal for walk-in haircut, beard shave or wash</span>
                                <span className="mt-2 text-[10px] font-mono px-3 py-1 rounded bg-[#000000] text-[#ffffff] font-bold shadow-2xs">
                                  Assign Walk-in Guest
                                </span>
                              </button>
                            </div>
                            <div className="absolute left-[408px] w-[152px] top-2.5 bottom-2.5 z-10">
                              <div
                                onClick={() => alert("Darren Lee — Precision Cut (11:30 - 12:30, waiting in lounge)")}
                                className="h-full bg-[#ffffff] border border-[#c8c5cb]/60 hover:border-[#000000] rounded-lg p-3 flex flex-col justify-between shadow-2xs transition-all cursor-pointer"
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-[13px] text-[#1a1c1f] truncate">Darren Lee</span>
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-[#e8e8ec] text-[#1a1c1f] border border-[#c8c5cb]/30">
                                      UPCOMING
                                    </span>
                                  </div>
                                  <p className="text-[11.5px] text-[#47464b] font-medium mt-1 truncate">Precision Cut</p>
                                </div>
                                <div className="text-[10.5px] font-mono text-[#5e5e67] border-t border-[#c8c5cb]/20 pt-1.5 flex items-center justify-between">
                                  <span>11:30 - 12:30</span>
                                  <span className="text-[#000000] font-medium">Waiting</span>
                                </div>
                              </div>
                            </div>
                            <div className="absolute left-[568px] w-[72px] top-2.5 bottom-2.5">
                              <div className="h-full bg-[#f3f3f7]/60 rounded-lg border border-dashed border-[#c8c5cb]/40 flex flex-col items-center justify-center text-center p-1">
                                <span className="text-[10.5px] font-semibold text-[#5e5e67]">Break</span>
                                <span className="text-[9px] font-mono text-[#5e5e67]/70">30m</span>
                              </div>
                            </div>
                            <div className="absolute left-[648px] w-[152px] top-2.5 bottom-2.5 z-10">
                              <div
                                onClick={() => alert("Lucas Wong — Fade & Beard (11:30 - 12:30, queued)")}
                                className="h-full bg-[#ffffff] border border-[#c8c5cb]/60 hover:border-[#000000] rounded-lg p-3 flex flex-col justify-between shadow-2xs transition-all cursor-pointer"
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-[13px] text-[#1a1c1f] truncate">Lucas Wong</span>
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-[#e8e8ec] text-[#1a1c1f] border border-[#c8c5cb]/30">
                                      QUEUED
                                    </span>
                                  </div>
                                  <p className="text-[11.5px] text-[#47464b] font-medium mt-1 truncate">Fade &amp; Beard</p>
                                </div>
                                <div className="text-[10.5px] font-mono text-[#5e5e67] border-t border-[#c8c5cb]/20 pt-1.5">11:30 - 12:30</div>
                              </div>
                            </div>
                            <div className="absolute left-[808px] w-[620px] top-2.5 bottom-2.5">
                              <button
                                onClick={() => alert("Slot booked with Kelvin Ng at 02:00 PM")}
                                className="h-full w-full rounded-lg border-2 border-dashed border-[#c8c5cb]/40 hover:border-[#000000] text-[#5e5e67] hover:text-[#1a1c1f] flex items-center justify-between px-5 hover:bg-[#f3f3f7]/40 transition-all"
                              >
                                <div className="flex items-center gap-3 text-left">
                                  <span className="material-symbols-outlined text-[20px] text-[#000000]">calendar_add_on</span>
                                  <div>
                                    <span className="text-[13px] font-bold text-[#1a1c1f] block">
                                      14:00 - 17:00 (3.0h Kelvin Open Slot)
                                    </span>
                                    <span className="text-[11px] text-[#5e5e67] mt-0.5 block">
                                      Barber Kelvin open for walk-ins, beard grooming &amp; hot towel shave
                                    </span>
                                  </div>
                                </div>
                                <span className="px-3 py-1.5 rounded-lg border border-[#c8c5cb]/60 text-[11px] font-medium hover:bg-[#000000] hover:text-[#ffffff] transition-colors">
                                  + Book Kelvin
                                </span>
                              </button>
                            </div>
                          </div>
                          )}

                          {visibleStylistCount === 0 && (
                            <div className="p-10 flex flex-col items-center justify-center gap-2 text-center">
                              <span className="material-symbols-outlined text-[28px] text-[#c8c5cb]">search_off</span>
                              <p className="text-[13.5px] font-medium text-[#5e5e67]">
                                No stylist matches &quot;{search}&quot;
                                {activeStylist !== "all" ? ` for ${activeStylist}` : ""}
                                {statusFilter !== "all" ? ` in ${STATUS_PILLS.find((p) => p.key === statusFilter)?.label}` : ""}.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Daily Capacity & Booking Triage */}
                <div className="w-[310px] shrink-0 flex flex-col gap-4">
                  {/* Daily Booking Overview */}
                  <div className="bg-[#ffffff] border border-[#c8c5cb]/40 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-[#c8c5cb]/30 pb-2.5">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                        Daily Booking Triage
                      </span>
                      <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#1a1c1f] bg-[#f3f3f7] px-2 py-0.5 rounded font-medium border border-[#c8c5cb]/30">
                        82% Capacity
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 pt-3">
                      {[
                        { label: "Today's Guests", value: "18", suffix: "Total", tone: "text-[#1a1c1f]" },
                        { label: "In Service", value: "4", suffix: "Active", tone: "text-[#000000]" },
                        { label: "Upcoming", value: "10", suffix: "Queued", tone: "text-[#1a1c1f]" },
                        { label: "Completed", value: "4", suffix: "Done", tone: "text-[#5e5e67]" },
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
                        3 Available
                      </span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {[
                        {
                          who: "Kelvin Ng · Ready Now",
                          note: "Available until 11:30 AM (Haircut / Wash)",
                          badge: "Instant",
                          service: "Men's cut or beard trim",
                          cta: "Assign Walk-in",
                          primary: true,
                          alert: "Walk-in assigned to Kelvin Ng",
                        },
                        {
                          who: "Amy Chen · 11:30 AM",
                          note: "60 min gap before next guest",
                          badge: "In 10m",
                          service: "Cut & Blow or Treatment",
                          cta: "Book Slot",
                          primary: false,
                          alert: "Slot booked with Amy Chen at 11:30 AM",
                        },
                        {
                          who: "Chloe Tan · 02:00 PM",
                          note: "3.0 hours open block",
                          badge: "Afternoon",
                          service: "Color / Perm / Styling",
                          cta: "Book Slot",
                          primary: false,
                          alert: "Slot booked with Chloe Tan at 02:00 PM",
                        },
                      ].map((r) => (
                        <div key={r.who} className="p-3 rounded-lg border border-[#c8c5cb]/40 bg-[#f3f3f7]/30 flex flex-col gap-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-[13.5px] leading-5 font-normal font-semibold text-[#1a1c1f] block">{r.who}</span>
                              <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">{r.note}</span>
                            </div>
                            <span
                              className={
                                "text-[11.5px] font-mono px-1.5 py-0.5 rounded " +
                                (r.primary
                                  ? "text-[#000000] font-semibold bg-[#e8e8ec]/40 border border-[#c8c5cb]/30"
                                  : "text-[#5e5e67] bg-[#eeedf1]")
                              }
                            >
                              {r.badge}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-[#c8c5cb]/20">
                            <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">{r.service}</span>
                            <button
                              onClick={() => alert(r.alert)}
                              className={
                                "px-2.5 py-1 rounded text-[11.5px] leading-4 tracking-[0.04em] font-medium transition-colors " +
                                (r.primary
                                  ? "bg-[#000000] text-[#ffffff] hover:bg-neutral-800"
                                  : "border border-[#c8c5cb]/60 hover:border-[#000000] text-[#1a1c1f] hover:bg-[#eeedf1]")
                              }
                            >
                              {r.cta}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => alert("Custom time slot picker isn't wired up in this demo yet.")}
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
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#eeedf1] flex items-center justify-center text-[11.5px] leading-4 tracking-[0.04em] font-semibold text-[#1a1c1f] shrink-0">
                        DL
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[13.5px] leading-5 font-normal font-semibold text-[#1a1c1f] truncate">Darren Lee</h4>
                          <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#000000] font-medium bg-[#e8e8ec]/40 px-1.5 py-0.5 rounded">
                            11:30 AM
                          </span>
                        </div>
                        <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-0.5">
                          Men&apos;s Precision Cut · with Kelvin Ng
                        </p>
                        <div className="mt-2 text-[11px] text-[#5e5e67] bg-[#f3f3f7]/60 border border-[#c8c5cb]/20 p-2 rounded leading-relaxed">
                          Guest is waiting in lounge. Ready for start at 11:30 AM.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 pt-2 border-t border-[#c8c5cb]/20">
                      <div className="w-9 h-9 rounded-full bg-[#eeedf1] flex items-center justify-center text-[11.5px] leading-4 tracking-[0.04em] font-semibold text-[#1a1c1f] shrink-0">
                        ER
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[13.5px] leading-5 font-normal font-semibold text-[#1a1c1f] truncate">Elena Rostova</h4>
                          <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] bg-[#eeedf1] px-1.5 py-0.5 rounded">
                            12:00 PM
                          </span>
                        </div>
                        <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-0.5">
                          Root Color &amp; Blowout · with Chloe Tan
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

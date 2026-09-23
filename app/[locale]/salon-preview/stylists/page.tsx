"use client";

import { useState } from "react";
import { MaterialSymbolsLink, SalonSidebar } from "../salon-shell";

/**
 * Literal port of the founder's own Stitch source for "Edit Stylist Profile
 * & Commission Tier" (Task 405, pasted 2026-09-23) -- one specific stylist
 * (#ST-003, Jasmine Teo), same as how Register & Checkout shows one active
 * folio and Clients & Profiles always shows one selected client. "Stylists
 * & Staff" in the sidebar links straight here; no separate roster/list page
 * was given, so (matching his own source, where "Back to Stylist Roster" is
 * href="#") that link stays inert rather than inventing a page he hasn't
 * designed yet.
 *
 * Client Component (upgraded from the original literal-port Server
 * Component): his source had no real onclick/JS behaviour anywhere --
 * the toggles, the commission-model tabs, the tag "x" buttons were all
 * inert. The founder later asked for every control to actually do
 * something in this demo, so employment-status, commission-model, the
 * permission toggles (the two marked "locked" stay locked -- a director
 * override isn't something a local checkbox can honestly fake) and the
 * tag remove buttons now hold real local state.
 *
 * RECONSTRUCTION NOTE: his paste was cut off by the message's own ~50,000
 * character limit partway through the "Audit & Lifecycle" card, right after
 * "Modified By". The screenshot he sent alongside it shows the rest --
 * Created Date (12 Feb 2023), Contract Renewal (31 Dec 2025), and two
 * actions (View Contract PDF / Archive Stylist) -- so those four lines were
 * rebuilt from the screenshot, following the exact row pattern the earlier,
 * complete rows already use. Flagged here the same way the Clients &
 * Profiles truncation was flagged; worth checking against his own working
 * file.
 *
 * WHAT IS REAL AND WHAT IS NOT: every number below is his own sample
 * content (commission tiers, shift roster, performance snapshot). None of
 * it reads from or writes to a database -- the toggles, tag editor, tab
 * selector, and Save/Discard buttons don't do anything yet.
 */
/* eslint-disable @next/next/no-img-element -- literal port of his Stitch
   source; an AI-generated reference photo from an external CDN, not
   user-uploaded content that needs next/image's optimisation pipeline. */

type Shift = {
  day: string;
  status: "off" | "on" | "peak";
  statusLabel: string;
  detail: string;
  bay: string;
  guests: string;
};

const SHIFTS: Shift[] = [
  { day: "Monday", status: "off", statusLabel: "Rest Day", detail: "Floor Closed for Stylist", bay: "—", guests: "0" },
  { day: "Tuesday", status: "on", statusLabel: "On Shift", detail: "10:00 AM – 08:00 PM", bay: "Bay 02", guests: "6 guests" },
  { day: "Wednesday", status: "on", statusLabel: "On Shift", detail: "10:00 AM – 08:00 PM", bay: "Bay 02", guests: "6 guests" },
  { day: "Thursday", status: "on", statusLabel: "On Shift", detail: "10:00 AM – 08:00 PM", bay: "Bay 02", guests: "6 guests" },
  { day: "Friday", status: "peak", statusLabel: "Peak Shift", detail: "10:00 AM – 08:30 PM", bay: "Bay 02", guests: "7 guests" },
  { day: "Saturday", status: "peak", statusLabel: "Peak Shift", detail: "09:30 AM – 08:30 PM", bay: "Bay 02", guests: "8 guests" },
  { day: "Sunday", status: "on", statusLabel: "On Shift", detail: "10:00 AM – 06:00 PM", bay: "Bay 02", guests: "5 guests" },
];

type Tier = { code: string; name: string; range: string; pct: string; current?: boolean };

const TIERS: Tier[] = [
  { code: "T1", name: "Base Tier", range: "RM 0.00 – RM 8,000.00", pct: "15%" },
  { code: "T2", name: "Standard Floor Level", range: "RM 8,001.00 – RM 15,000.00", pct: "22%", current: true },
  { code: "T3", name: "Senior Artisan Level", range: "RM 15,001.00 – RM 25,000.00", pct: "30%" },
  { code: "T4", name: "Top Performer Prestige Tier", range: "RM 25,001.00+", pct: "35%" },
];

const TAGS = ["Balayage & Foilyage", "Air-touch Bleach", "Color Correction", "Scalp Rituals"];

type MiniStat = { label: string; value: string; note: string; positive?: boolean };

const MINI_STATS: MiniStat[] = [
  { label: "MTD Service Rev", value: "RM 14,680", note: "RM 320 to Tier 3" },
  { label: "Client Retention", value: "88.4%", note: "Studio Top 5%", positive: true },
  { label: "Guests Served", value: "42", note: "18 appointments left" },
  { label: "Avg Ticket Size", value: "RM 349.50", note: "+14% vs studio avg" },
];

type Permission = { label: string; note: string; on: boolean; locked?: boolean };

const PERMISSIONS: Permission[] = [
  { label: "View full guest phone numbers", note: "Direct WhatsApp confirmations", on: true },
  { label: "Edit dispensary color formulas", note: "Update client technical cards", on: true },
  { label: "VIP Discretionary Discount", note: "Authorized up to 10% on register", on: true },
  { label: "Modify station shift real-time", note: "Swap chair slots on floor calendar", on: true },
  { label: "View peer stylists payroll", note: "Restricted to Studio Director", on: false, locked: true },
  { label: "Execute cash register refunds", note: "Director PIN override required", on: false, locked: true },
];

export default function SalonStylistProfilePreview() {
  const [employment, setEmployment] = useState<"Full-time Active" | "Part-time / Contract" | "On Leave / Sabbatical">(
    "Full-time Active",
  );
  const [commissionModel, setCommissionModel] = useState<"Tiered Progressive" | "Flat Percentage" | "Base + Fixed Bonus">(
    "Tiered Progressive",
  );
  const [permissionState, setPermissionState] = useState(() => Object.fromEntries(PERMISSIONS.map((p) => [p.label, p.on])));
  const [tags, setTags] = useState(TAGS);

  const togglePermission = (label: string, locked?: boolean) => {
    if (locked) return;
    setPermissionState((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <>
      <MaterialSymbolsLink />
      <div
        className="bg-[#f9f9fd] text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] antialiased min-h-screen"
        style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
      >
        <SalonSidebar active="stylists-and-staff" />
        <div className="pl-64 min-h-screen bg-[#f9f9fd]">
          <main className="w-full pt-0 bg-[#f9f9fd] p-5">
            <div className="flex flex-col w-full">
              {/* Breadcrumb & Workflow Status Strip */}
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 gap-2">
                <nav className="flex items-center gap-1 text-[#5e5e67] text-[11.5px] leading-4 tracking-[0.04em] font-medium tracking-wider uppercase">
                  <span>Operations</span>
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  <span>Stylist Directory</span>
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  <span className="text-[#1a1c1f]">#ST-003 · Jasmine Teo</span>
                </nav>
                <div className="flex items-center gap-2 self-start md:self-auto">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase bg-[#eeedf1] text-[#5e5e67]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1a9a4d]" />
                    Active on Floor
                  </span>
                  <span className="text-[#5e5e67] text-[11.5px] leading-4 tracking-[0.04em] font-medium">Branch: Bangsar Studio</span>
                </div>
              </div>

              {/* Header Action Banner */}
              <div className="bg-[#ffffff] rounded-xl p-5 mb-5 border border-[#c8c5cb]/30 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <a
                    href="#"
                    className="inline-flex items-center gap-1 text-[#5e5e67] hover:text-[#1a1c1f] text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider transition-colors mb-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                    Back to Stylist Roster
                  </a>
                  <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold text-[#1a1c1f] tracking-tight">
                    Edit Stylist Profile &amp; Commission Tier
                  </h1>
                  <p className="text-[13.5px] leading-5 text-[#5e5e67] max-w-3xl">
                    Configure working schedule, tier commission brackets, assigned styling bay, and studio register booking
                    permissions.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button className="px-5 py-1.5 rounded-lg bg-[#eeedf1] hover:bg-[#e8e8ec] active:scale-[0.97] text-[#1a1c1f] text-[13.5px] leading-5 transition-colors">
                    Discard Changes
                  </button>
                  <button className="px-5 py-1.5 rounded-lg bg-[#eeedf1] hover:bg-[#e8e8ec] active:scale-[0.97] text-[#1a1c1f] text-[13.5px] leading-5 inline-flex items-center gap-1.5 transition-colors">
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                    Preview Public Bio
                  </button>
                  <button className="px-5 py-1.5 rounded-lg bg-[#000000] text-[#ffffff] text-[13.5px] leading-5 font-medium inline-flex items-center gap-1.5 shadow-sm hover:opacity-90 active:scale-[0.99] transition-all">
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    Save Stylist Settings
                  </button>
                </div>
              </div>

              {/* Main 2/3 and 1/3 Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* LEFT 8 COLUMNS */}
                <div className="lg:col-span-8 flex flex-col gap-5">
                  {/* Section 1: Basic Identity & Salon Role */}
                  <section className="bg-[#ffffff] rounded-xl p-5 border border-[#c8c5cb]/30 shadow-sm">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#eeedf1]">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#eeedf1] flex items-center justify-center text-[#1a1c1f]">
                          <span className="material-symbols-outlined text-[18px]">badge</span>
                        </div>
                        <div>
                          <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">
                            Basic Identity &amp; Salon Role
                          </h2>
                        </div>
                      </div>
                      <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-medium text-[#5e5e67] uppercase">
                        UID: 884-JTEO
                      </span>
                    </div>

                    {/* Avatar Management Block */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-3 bg-[#f3f3f7] rounded-lg mb-5">
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#eeedf1] shadow-sm">
                        <img
                          className="w-full h-full object-cover"
                          alt="Close up editorial portrait photo of professional Asian female hairstylist Jasmine Teo wearing clean minimalist black studio apparel in bright high-end modern salon setting with soft directional daylight"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuATdc2bsvsrDguoi8xGn0QhKUR5pskGdUm4loBdtEC5-MzqqThJNi3V6MB3NEMTxi9z06rcL0d3O5HHqrlk9kh02BpVi1dLWvucKL7Id2lmjpQN0hEC1YoGQHecY7UDIeFUw1-0CtD9gyxr-5m0bmtD6vHJq5cMzzUGOkNTtmKv2QJovF1DvWF-PHzN50bgWuw4LmvYuICHLuiwfZx_REh4DeXZhL9NAXmXbbTB5hXuu_Qq5fW5Y3BD"
                        />
                      </div>
                      <div className="flex flex-col justify-center gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium text-[#1a1c1f]">
                            Jasmine Teo
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#e2e2e6] text-[13.5px] leading-[18px] tracking-[0.01em] font-medium text-[#1a1c1f]">
                            JT
                          </span>
                        </div>
                        <p className="text-[13.5px] leading-5 text-[#5e5e67]">
                          Square photo recommended. 800×800px JPG or PNG for client booking app showcase.
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <button className="px-2 py-1 rounded bg-[#ffffff] text-[#1a1c1f] hover:bg-[#eeedf1] active:scale-[0.97] text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider transition-colors shadow-sm">
                            Change Photo
                          </button>
                          <button className="px-2 py-1 rounded text-[#ba1a1a] hover:bg-[#ffdad6]/20 active:scale-[0.97] text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider transition-colors">
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Primary Form Fields Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                          Full Legal Name
                        </label>
                        <input
                          className="w-full h-9 px-2 rounded-lg bg-[#f3f3f7] text-[#1a1c1f] text-[14.5px] leading-[22px] tracking-[-0.005em] focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#000000] transition-all"
                          type="text"
                          defaultValue="Jasmine Teo"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                          Employee ID / System Code
                        </label>
                        <div className="h-9 px-2 rounded-lg bg-[#e2e2e6]/60 flex items-center justify-between text-[#5e5e67]">
                          <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-medium text-[#1a1c1f]">ST-003</span>
                          <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider">
                            Read Only
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                          Display Title / Public Role
                        </label>
                        <input
                          className="w-full h-9 px-2 rounded-lg bg-[#f3f3f7] text-[#1a1c1f] text-[14.5px] leading-[22px] tracking-[-0.005em] focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#000000] transition-all"
                          type="text"
                          defaultValue="Master Colorist & Balayage Specialist"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                          WhatsApp Direct Contact
                        </label>
                        <input
                          className="w-full h-9 px-2 rounded-lg bg-[#f3f3f7] text-[#1a1c1f] text-[13.5px] leading-[18px] tracking-[0.01em] font-medium focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#000000] transition-all"
                          type="text"
                          defaultValue="+60 16-882 9104"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                          Work Email Address
                        </label>
                        <input
                          className="w-full h-9 px-2 rounded-lg bg-[#f3f3f7] text-[#1a1c1f] text-[14.5px] leading-[22px] tracking-[-0.005em] focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#000000] transition-all"
                          type="email"
                          defaultValue="jasmine.teo@weihair.com"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                          Assigned Station / Floor Bay
                        </label>
                        <div className="relative">
                          <select
                            className="w-full h-9 px-2 pr-8 rounded-lg bg-[#f3f3f7] text-[#1a1c1f] text-[14.5px] leading-[22px] tracking-[-0.005em] appearance-none focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#000000] cursor-pointer transition-all"
                            defaultValue="Bay 02 - Color & Balayage Station (Dedicated)"
                          >
                            <option>Bay 02 - Color & Balayage Station (Dedicated)</option>
                            <option>Bay 01 - Lead Director Master Station</option>
                            <option>Bay 03 - Precision Cut & Texture Hub</option>
                            <option>Bay 04 - Scalp & Treatment Suite</option>
                          </select>
                          <span className="material-symbols-outlined absolute right-2.5 top-2 text-[18px] text-[#5e5e67] pointer-events-none">
                            expand_more
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Employment Status Pill Selector */}
                    <div className="mt-3 pt-3 border-t border-[#eeedf1] flex flex-col gap-1">
                      <label className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                        Employment Type &amp; Roster Status
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setEmployment("Full-time Active")}
                          className={
                            "px-5 py-1.5 rounded-lg text-[13.5px] leading-5 inline-flex items-center gap-2 active:scale-[0.97] transition-all " +
                            (employment === "Full-time Active"
                              ? "bg-[#000000] text-[#ffffff] font-medium shadow-sm"
                              : "bg-[#f3f3f7] hover:bg-[#eeedf1] text-[#5e5e67]")
                          }
                        >
                          {employment === "Full-time Active" && <span className="w-2 h-2 rounded-full bg-[#1a9a4d]" />}
                          Full-time Active
                        </button>
                        <button
                          onClick={() => setEmployment("Part-time / Contract")}
                          className={
                            "px-5 py-1.5 rounded-lg text-[13.5px] leading-5 inline-flex items-center gap-2 active:scale-[0.97] transition-all " +
                            (employment === "Part-time / Contract"
                              ? "bg-[#000000] text-[#ffffff] font-medium shadow-sm"
                              : "bg-[#f3f3f7] hover:bg-[#eeedf1] text-[#5e5e67]")
                          }
                        >
                          {employment === "Part-time / Contract" && <span className="w-2 h-2 rounded-full bg-[#1a9a4d]" />}
                          Part-time / Contract
                        </button>
                        <button
                          onClick={() => setEmployment("On Leave / Sabbatical")}
                          className={
                            "px-5 py-1.5 rounded-lg text-[13.5px] leading-5 inline-flex items-center gap-2 active:scale-[0.97] transition-all " +
                            (employment === "On Leave / Sabbatical"
                              ? "bg-[#000000] text-[#ffffff] font-medium shadow-sm"
                              : "bg-[#f3f3f7] hover:bg-[#eeedf1] text-[#5e5e67]")
                          }
                        >
                          {employment === "On Leave / Sabbatical" && <span className="w-2 h-2 rounded-full bg-amber-500" />}
                          On Leave / Sabbatical
                        </button>
                      </div>
                    </div>

                    {/* Specialization Tags */}
                    <div className="mt-3 pt-3 border-t border-[#eeedf1] flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                          Styling Specialties &amp; Portfolio Tags
                        </label>
                        <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                          Appears in online client booking flow
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#eeedf1] text-[#1a1c1f] text-[13.5px] leading-5"
                          >
                            {tag}
                            <button
                              onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                              className="hover:text-[#ba1a1a] active:scale-[0.9] transition-transform"
                            >
                              <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                          </span>
                        ))}
                        <button
                          onClick={() => {
                            const next = window.prompt("Add a styling specialty or portfolio tag:");
                            if (next && next.trim() && !tags.includes(next.trim())) {
                              setTags((prev) => [...prev, next.trim()]);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#f3f3f7] hover:bg-[#eeedf1] active:scale-[0.97] text-[#5e5e67] hover:text-[#1a1c1f] text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">add</span>
                          Add Tag
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* Section 2: Weekly Shift & Chair Roster */}
                  <section className="bg-[#ffffff] rounded-xl p-5 border border-[#c8c5cb]/30 shadow-sm">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#eeedf1]">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#eeedf1] flex items-center justify-center text-[#1a1c1f]">
                          <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                        </div>
                        <div>
                          <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">
                            Weekly Shift &amp; Chair Roster
                          </h2>
                        </div>
                      </div>
                      <button className="px-2 py-1 rounded bg-[#eeedf1] hover:bg-[#e8e8ec] active:scale-[0.97] text-[#1a1c1f] text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider transition-colors">
                        Copy Mon-Fri
                      </button>
                    </div>

                    <div className="overflow-hidden rounded-lg bg-[#f3f3f7]">
                      <div className="grid grid-cols-12 px-3 py-2 text-[#5e5e67] text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase">
                        <div className="col-span-2">Day of Week</div>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-4">Shift Schedule</div>
                        <div className="col-span-2">Station Bay</div>
                        <div className="col-span-2 text-right">Max Clients</div>
                      </div>
                      <div className="flex flex-col bg-[#ffffff]">
                        {SHIFTS.map((s) => (
                          <div
                            key={s.day}
                            className={
                              "grid grid-cols-12 items-center px-3 py-2.5 border-t border-[#eeedf1] transition-colors " +
                              (s.status === "off" ? "opacity-60" : "hover:bg-[#f3f3f7]")
                            }
                          >
                            <div className="col-span-2 text-[13.5px] leading-5 font-medium text-[#1a1c1f] flex items-center gap-1.5">
                              {s.day}
                              {s.status === "peak" && <span className="w-1.5 h-1.5 rounded-full bg-[#bd616a]" title="Peak Shift" />}
                            </div>
                            <div className="col-span-2">
                              <span
                                className={
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase " +
                                  (s.status === "off" ? "bg-[#eeedf1] text-[#5e5e67]" : "bg-[#e8e8ec] text-[#1a1c1f]")
                                }
                              >
                                {s.statusLabel}
                              </span>
                            </div>
                            <div
                              className={
                                "col-span-4 text-[13.5px] leading-[18px] " +
                                (s.status === "off" ? "text-[#5e5e67]" : "text-[#1a1c1f] tracking-[0.01em] font-medium")
                              }
                            >
                              {s.detail}
                            </div>
                            <div
                              className={
                                "col-span-2 text-[13.5px] leading-5 " + (s.status === "off" ? "text-[#5e5e67]" : "text-[#1a1c1f]")
                              }
                            >
                              {s.bay}
                            </div>
                            <div
                              className={
                                "col-span-2 text-right text-[13.5px] leading-[18px] tracking-[0.01em] " +
                                (s.status === "off" ? "text-[#5e5e67]" : "text-[#1a1c1f] font-medium")
                              }
                            >
                              {s.guests}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-[#f3f3f7] flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#5e5e67] text-[20px]">hourglass_empty</span>
                        <div className="flex flex-col">
                          <span className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium text-[#1a1c1f]">
                            Turnover Buffer: 15 mins
                          </span>
                          <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                            Auto-spaced for sanitation &amp; mixing bowl cleanups
                          </span>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-[#f3f3f7] flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#5e5e67] text-[20px]">restaurant</span>
                        <div className="flex flex-col">
                          <span className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium text-[#1a1c1f]">
                            Daily Lunch Rest: 14:00 – 15:00
                          </span>
                          <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                            Auto-blocked on appointments book
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Section 3: Commission Tier & Revenue Split Matrix */}
                  <section className="bg-[#ffffff] rounded-xl p-5 border border-[#c8c5cb]/30 shadow-sm">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#eeedf1]">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#eeedf1] flex items-center justify-center text-[#1a1c1f]">
                          <span className="material-symbols-outlined text-[18px]">payments</span>
                        </div>
                        <div>
                          <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">
                            Commission Tier &amp; Revenue Split Matrix
                          </h2>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#eeedf1] text-[#5e5e67] text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase">
                        Bangsar Tier-A
                      </span>
                    </div>

                    {/* Commission Model Selector */}
                    <div className="mb-5">
                      <label className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67] block mb-1">
                        Commission Structure Model
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          onClick={() => setCommissionModel("Tiered Progressive")}
                          className={
                            "p-2 rounded-lg text-left transition-colors active:scale-[0.98] " +
                            (commissionModel === "Tiered Progressive"
                              ? "bg-[#000000] text-[#ffffff] shadow-sm"
                              : "bg-[#f3f3f7] hover:bg-[#eeedf1] text-[#1a1c1f]")
                          }
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium">Tiered Progressive</span>
                            {commissionModel === "Tiered Progressive" && (
                              <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            )}
                          </div>
                          <p
                            className={
                              "text-[11.5px] leading-4 tracking-[0.04em] font-medium mt-1 " +
                              (commissionModel === "Tiered Progressive" ? "text-[#858387]" : "text-[#5e5e67]")
                            }
                          >
                            Split increases as revenue bands cross higher thresholds
                          </p>
                        </button>
                        <button
                          onClick={() => setCommissionModel("Flat Percentage")}
                          className={
                            "p-2 rounded-lg text-left transition-colors active:scale-[0.98] " +
                            (commissionModel === "Flat Percentage"
                              ? "bg-[#000000] text-[#ffffff] shadow-sm"
                              : "bg-[#f3f3f7] hover:bg-[#eeedf1] text-[#1a1c1f]")
                          }
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium">Flat Percentage</span>
                            {commissionModel === "Flat Percentage" && (
                              <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            )}
                          </div>
                          <p
                            className={
                              "text-[11.5px] leading-4 tracking-[0.04em] font-medium mt-1 " +
                              (commissionModel === "Flat Percentage" ? "text-[#858387]" : "text-[#5e5e67]")
                            }
                          >
                            Single uniform percentage applied across all services
                          </p>
                        </button>
                        <button
                          onClick={() => setCommissionModel("Base + Fixed Bonus")}
                          className={
                            "p-2 rounded-lg text-left transition-colors active:scale-[0.98] " +
                            (commissionModel === "Base + Fixed Bonus"
                              ? "bg-[#000000] text-[#ffffff] shadow-sm"
                              : "bg-[#f3f3f7] hover:bg-[#eeedf1] text-[#1a1c1f]")
                          }
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium">Base + Fixed Bonus</span>
                            {commissionModel === "Base + Fixed Bonus" && (
                              <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            )}
                          </div>
                          <p
                            className={
                              "text-[11.5px] leading-4 tracking-[0.04em] font-medium mt-1 " +
                              (commissionModel === "Base + Fixed Bonus" ? "text-[#858387]" : "text-[#5e5e67]")
                            }
                          >
                            Guaranteed monthly retainer with per-head incentive
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Retainer Base Input */}
                    <div className="mb-5">
                      <label className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67] block mb-1">
                        Base Monthly Retainer Draw
                      </label>
                      <div className="relative max-w-sm">
                        <span className="absolute left-3 top-2 text-[13.5px] leading-5 font-medium text-[#5e5e67]">RM</span>
                        <input
                          className="w-full h-9 pl-11 pr-2 rounded-lg bg-[#f3f3f7] text-[#1a1c1f] text-[13.5px] leading-[18px] tracking-[0.01em] font-medium focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#000000] transition-all"
                          type="text"
                          defaultValue="3,200.00"
                        />
                      </div>
                      <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] block mt-1">
                        Guaranteed base salary paid regardless of monthly service revenue ceiling.
                      </span>
                    </div>

                    {/* Commission Tiers */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                          Service Revenue Commission Brackets
                        </label>
                        <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                          Calculated at calendar month end
                        </span>
                      </div>
                      <div className="flex flex-col gap-2 pt-1">
                        {TIERS.map((t) => (
                          <div
                            key={t.code}
                            className={
                              "flex items-center justify-between p-2 rounded-lg relative " +
                              (t.current ? "bg-[#eeedf1]" : "bg-[#f3f3f7]")
                            }
                          >
                            {t.current && <div className="absolute -left-1 top-2 bottom-2 w-1 rounded-full bg-[#000000]" />}
                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  "w-6 h-6 rounded flex items-center justify-center text-[13.5px] leading-[18px] tracking-[0.01em] font-medium " +
                                  (t.current ? "bg-[#000000] text-[#ffffff]" : "bg-[#eeedf1] text-[#1a1c1f]")
                                }
                              >
                                {t.code}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium text-[#1a1c1f]">
                                    {t.name}
                                  </span>
                                  {t.current && (
                                    <span className="px-1.5 py-0.5 rounded bg-[#e2e2e6] text-[#1a1c1f] text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase">
                                      Current Run-rate
                                    </span>
                                  )}
                                </div>
                                <p className="text-[13.5px] leading-[18px] tracking-[0.01em] font-medium text-[#5e5e67]">{t.range}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-base leading-6 tracking-[-0.01em] font-medium text-[#1a1c1f]">{t.pct}</span>
                              <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] uppercase">
                                Payout Split
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Ancillary Rules */}
                    <div className="mt-3 pt-3 border-t border-[#eeedf1] grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-[#f3f3f7]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium text-[#1a1c1f]">
                            Retail Product Commission
                          </span>
                          <span className="text-base leading-6 tracking-[-0.01em] font-medium text-[#1a1c1f]">10%</span>
                        </div>
                        <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                          Flat commission across all Kérastase, Olaplex, and Tokio Inkarami take-home retail products sold under
                          this stylist profile.
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[#f3f3f7]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium text-[#1a1c1f]">
                            Dispensary Wastage Safeguard
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#eeedf1] text-[#1a1c1f] text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase">
                            Active Rule
                          </span>
                        </div>
                        <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                          Deducts 2% from final service payout if monthly scale-logged chemical color wastage exceeds studio
                          tolerance of 12%.
                        </p>
                      </div>
                    </div>
                  </section>
                </div>

                {/* RIGHT 4 COLUMNS */}
                <div className="lg:col-span-4 flex flex-col gap-5">
                  {/* Card 1: Performance Snapshot */}
                  <div className="bg-[#ffffff] rounded-xl p-5 border border-[#c8c5cb]/30 shadow-sm">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#eeedf1]">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[18px] text-[#1a1c1f]">monitoring</span>
                        <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">
                          Performance Snapshot
                        </h3>
                      </div>
                      <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-medium text-[#5e5e67] uppercase">
                        Oct 2024
                      </span>
                    </div>
                    <div className="flex flex-col gap-3">
                      <div className="p-3 rounded-lg bg-[#f3f3f7] flex flex-col">
                        <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                          Current Projected Payout
                        </span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-[30px] leading-9 tracking-[-0.025em] font-semibold text-[#1a1c1f]">RM 6,429.60</span>
                        </div>
                        <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-1">
                          RM 3,200 Base + RM 3,229.60 Earned Commission
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {MINI_STATS.map((stat) => (
                          <div key={stat.label} className="p-2 rounded-lg bg-[#f3f3f7]">
                            <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                              {stat.label}
                            </span>
                            <p className="text-base leading-6 tracking-[-0.01em] font-medium text-[#1a1c1f] mt-1">{stat.value}</p>
                            <p
                              className={
                                "text-[11.5px] leading-4 tracking-[0.04em] font-medium mt-0.5 " +
                                (stat.positive ? "text-[#1a9a4d]" : "text-[#5e5e67]")
                              }
                            >
                              {stat.note}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col gap-1.5 pt-2">
                        <div className="flex items-center justify-between text-[11.5px] leading-4 tracking-[0.04em] font-medium">
                          <span className="text-[#5e5e67] uppercase">Progress to Tier 3 (RM 15k)</span>
                          <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-medium text-[#1a1c1f]">97.8%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#e8e8ec] overflow-hidden">
                          <div className="h-full bg-[#000000] rounded-full" style={{ width: "97.8%" }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Security & Permissions */}
                  <div className="bg-[#ffffff] rounded-xl p-5 border border-[#c8c5cb]/30 shadow-sm">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#eeedf1]">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[18px] text-[#1a1c1f]">shield</span>
                        <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">
                          Security &amp; Permissions
                        </h3>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-[#000000]" title="Synced with Studio Access Core" />
                    </div>
                    <div className="mb-3">
                      <label className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67] block mb-1">
                        System Access Level
                      </label>
                      <div className="relative">
                        <select
                          className="w-full h-9 px-2 pr-8 rounded-lg bg-[#f3f3f7] text-[#1a1c1f] text-[14.5px] leading-[22px] tracking-[-0.005em] appearance-none focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#000000] cursor-pointer"
                          defaultValue="Senior Stylist & Floor Specialist"
                        >
                          <option>Senior Stylist &amp; Floor Specialist</option>
                          <option>Apprentice / Junior Colorist</option>
                          <option>Floor Lead / Assistant Manager</option>
                          <option>Studio Director (Full Root)</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-2.5 top-2 text-[18px] text-[#5e5e67] pointer-events-none">
                          expand_more
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 divide-y divide-[#eeedf1]">
                      {PERMISSIONS.map((p) => (
                        <div key={p.label} className={"flex items-center justify-between pt-2" + (p.locked ? " opacity-70" : "")}>
                          <div className="flex flex-col pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium text-[#1a1c1f]">
                                {p.label}
                              </span>
                              {p.locked && <span className="material-symbols-outlined text-[14px] text-[#5e5e67]">lock</span>}
                            </div>
                            <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">{p.note}</span>
                          </div>
                          {p.locked ? (
                            <span
                              aria-label="Toggle disabled"
                              title="Requires Director PIN override"
                              className="w-10 h-5 rounded-full bg-[#eeedf1] relative p-0.5 shrink-0 cursor-not-allowed"
                            >
                              <span className="block w-4 h-4 rounded-full bg-[#c8c5cb] mr-auto shadow-sm" />
                            </span>
                          ) : (
                            <button
                              aria-label="Toggle"
                              onClick={() => togglePermission(p.label, p.locked)}
                              className={
                                "w-10 h-5 rounded-full relative p-0.5 shrink-0 transition-colors cursor-pointer " +
                                (permissionState[p.label] ? "bg-[#000000]" : "bg-[#e8e8ec]")
                              }
                            >
                              <span
                                className={
                                  "block w-4 h-4 rounded-full bg-[#ffffff] shadow-sm transition-transform " +
                                  (permissionState[p.label] ? "ml-auto" : "mr-auto")
                                }
                              />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card 3: Audit Trail & Contract Life */}
                  <div className="bg-[#ffffff] rounded-xl p-5 border border-[#c8c5cb]/30 shadow-sm">
                    <div className="flex items-center gap-1 pb-3 mb-3 border-b border-[#eeedf1]">
                      <span className="material-symbols-outlined text-[18px] text-[#5e5e67]">history</span>
                      <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Audit &amp; Lifecycle</h3>
                    </div>
                    <div className="flex flex-col gap-2 text-[11.5px] leading-4 tracking-[0.04em] font-medium">
                      <div className="flex items-center justify-between">
                        <span className="text-[#5e5e67] uppercase">Last Modified</span>
                        <span className="font-medium text-[#1a1c1f]">18 Oct 2024 · 09:42 AM</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#5e5e67] uppercase">Modified By</span>
                        <span className="font-medium text-[#1a1c1f]">Wei Lin (Director)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#5e5e67] uppercase">Created Date</span>
                        <span className="font-medium text-[#1a1c1f]">12 Feb 2023</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#5e5e67] uppercase">Contract Renewal</span>
                        <span className="font-medium text-[#1a1c1f]">31 Dec 2025</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-[#eeedf1]">
                        <button className="inline-flex items-center gap-1 text-[#1a1c1f] hover:text-[#000000] active:scale-[0.97] uppercase tracking-wider transition-colors">
                          <span className="material-symbols-outlined text-[14px]">description</span>
                          View Contract PDF
                        </button>
                        <button className="text-[#ba1a1a] hover:underline active:scale-[0.97] uppercase tracking-wider transition-colors">
                          Archive Stylist
                        </button>
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

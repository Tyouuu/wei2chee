import { MaterialSymbolsLink, SalonSidebar } from "../salon-shell";

/**
 * Literal port of the founder's own Stitch source for "Clients & Profiles"
 * (Task 405, pasted 2026-09-23). Same structure, same copy, same numbers he
 * designed with -- Material 3 semantic colours swapped for arbitrary hex the
 * same way the other three pages are.
 *
 * ⚠️ THE PASTE CUT OFF mid-way through the third visit-history row (his
 * message hit its own length limit). Rows 3 and 4 below are reconstructed
 * from the screenshot he sent alongside it (dates, services, stylist
 * initials, totals, invoice numbers all read off the rendered page, not
 * invented), and the "Prescribed Homecare Regulars" card's empty state is a
 * best-effort close of a section whose literal markup never arrived -- flag
 * both if either doesn't match his working file once he checks.
 *
 * No page behind it yet: no cart, no folio-checkout backend, no client
 * database. This is still sample content only.
 */
const SEGMENTS = [
  { label: "All (248)", active: true },
  { label: "VIP Gold (64)" },
  { label: "Color Regulars (142)" },
  { label: "Packages (38)" },
];

const CLIENTS = [
  {
    initials: "NA",
    name: "Datin Nora Al-Habshee",
    tier: "VIP PLATINUM",
    phone: "012-553 0921",
    stylist: "JT",
    stylistName: "Jasmine",
    active: true,
    right: "Today",
    detail: "19 visits · Active Fusio Pass (6/10)",
    note: "Next: Nov 28 · 11am",
  },
  {
    initials: "AC",
    name: "Amanda Choong",
    tier: "VIP GOLD",
    phone: "012-882 9104",
    stylist: "AC",
    stylistName: "Amy",
    right: "Oct 18",
    detail: "12 visits · Scalp Sensitive",
    note: "6 wks cycle (Due soon)",
  },
  {
    initials: "MT",
    name: "Marcus Tan",
    tier: "REGULAR",
    phone: "016-778 2004",
    stylist: "CT",
    stylistName: "Chloe",
    right: "Oct 12",
    detail: "22 visits · Fade Cut & Scalp",
    note: "Every 3 wks",
  },
  {
    initials: "RS",
    name: "Rachel Soo",
    tier: "VIP PLATINUM",
    phone: "017-229 0113",
    stylist: "JT",
    stylistName: "Jasmine",
    right: "Sep 29",
    detail: "14 visits · Digital Perm",
    note: "Perm Cycle 4",
  },
  {
    initials: "LW",
    name: "Lim Wei Seng",
    tier: "REGULAR",
    phone: "019-412 8890",
    stylist: "AC",
    stylistName: "Amy",
    right: "Sep 15",
    detail: "8 visits · Scalp Ozone",
    note: "Monthly Groom",
  },
  {
    initials: "CS",
    name: "Chloe Sim",
    tier: "VIP GOLD",
    phone: "012-309 8812",
    stylist: "WL",
    stylistName: "Wei Lin",
    right: "Sep 08",
    detail: "16 visits · Balayage & Gloss",
    note: "8 wks cycle",
  },
  {
    initials: "SJ",
    name: "Sarah Jenkins",
    tier: "COLOR REGULAR",
    phone: "017-642 9055",
    stylist: "JT",
    stylistName: "Jasmine",
    right: "Aug 29",
    detail: "9 visits · High-Lift Ash Blonde",
    note: "Tone Refresh",
  },
  {
    initials: "DL",
    name: "Darren Lee",
    tier: "REGULAR",
    phone: "016-551 2289",
    stylist: "CT",
    stylistName: "Chloe",
    right: "Aug 22",
    detail: "18 visits · Scissor Cut & Head Spa",
    note: "Bi-weekly",
  },
];

const ALPHA = ["A", "C", "D", "J", "L", "M", "R", "S", "T", "W", "#"];

const STAT_TILES = [
  { label: "Lifetime Spend", value: "RM 5,820.00", note: "Top 5% Studio Tier" },
  { label: "Total Completed Visits", value: "19 Visits", note: "Since Nov 2022" },
  { label: "Active Passes", value: "1 Prepaid Plan", note: "6 of 10 remaining", primary: true },
  { label: "Avg Return Cycle", value: "5.8 Weeks", note: "Regular Colorist" },
];

const INFO_CARDS = [
  {
    icon: "tune",
    label: "Hair Profile & Texture",
    line1: "Thick, Wavy · Base Level 3",
    line2: "~15% hairline grey coverage · High porosity",
  },
  {
    icon: "local_cafe",
    label: "Hospitality & Service",
    line1: "Warm green tea (no sugar)",
    line2: "Prefers quiet service during processing",
  },
  {
    icon: "verified",
    label: "Safety Note",
    tag: "Sep 2024",
    line1: "PPD Patch Test Cleared",
    line2: "Tested Sep 12, 2024 · Safe with 20Vol & Blond Studio",
    warn: true,
  },
];

const VISITS = [
  {
    date: "24 Oct 2024",
    time: "14:30 – 17:15",
    service: "Full Balayage, Dialight Toner, K18 Defense",
    detail: "Lifted to Level 9 pale · Redeemed Caviar Pass #4",
    stylistInitial: "J",
    stylistName: "Jasmine Teo",
    total: "RM 740.00",
    inv: "#INV-5182",
  },
  {
    date: "15 Aug 2024",
    time: "11:00 – 12:45",
    service: "Root Touchup, Gloss Wash & Blow",
    detail: "Majirel 6.1 temple grey coverage",
    stylistInitial: "J",
    stylistName: "Jasmine Teo",
    total: "RM 380.00",
    inv: "#INV-4921",
  },
  {
    date: "02 Jun 2024",
    time: "15:00 – 18:30",
    service: "Color Correction & Reconstruction Blowdry",
    detail: "Brass band neutralized with Blond Studio",
    stylistInitial: "W",
    stylistName: "Wei Lin",
    total: "RM 820.00",
    inv: "#INV-4109",
  },
  {
    date: "15 May 2024",
    time: "10:15 – 12:00",
    service: "Package Purchase: Fusio-Dose 10-Session Pass + Blowdry",
    detail: "Prepaid package enrolled; session 1 redeemed",
    stylistInitial: "J",
    stylistName: "Jasmine Teo",
    total: "RM 1,980.00",
    inv: "#INV-3980",
  },
];

export default function SalonClientsPreview() {
  return (
    <>
      <MaterialSymbolsLink />
      <div
        className="bg-[#f9f9fd] text-[#1a1c1f] text-[14.5px] leading-[22px] tracking-[-0.005em] antialiased min-h-screen"
        style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
      >
        <SalonSidebar active="clients-and-profiles" />
        <div className="pl-64 min-h-screen bg-[#f9f9fd]">
          <main className="w-full min-h-screen bg-[#f9f9fd]">
            <div className="flex flex-col w-full">
              <div className="p-5 flex flex-col gap-5 max-w-[1720px] mx-auto w-full">
                {/* Header */}
                <div className="flex flex-col gap-2.5 pb-3 border-b border-[#eeedf1]">
                  <div className="flex items-center gap-2 text-[11.5px] font-mono text-[#77767b] tracking-wider uppercase">
                    <span className="hover:text-[#1a1c1f] cursor-pointer transition-colors">Operations</span>
                    <span>/</span>
                    <span className="hover:text-[#1a1c1f] cursor-pointer transition-colors">Client Directory</span>
                    <span>/</span>
                    <span className="text-[#000000] font-semibold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#000000] inline-block" />
                      Datin Nora Al-Habshee
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-[20px] leading-7 tracking-[-0.015em] text-[#000000] font-semibold tracking-tight">Clients &amp; Folios</h1>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#eeedf1] text-[#5e5e67] font-medium tracking-wide">
                        客户档案与技术手册
                      </span>
                      <span className="text-[11.5px] font-mono text-[#77767b] hidden md:inline-block">· Bangsar Flagship</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button className="h-9 px-3 rounded-lg bg-[#ffffff] text-[#1a1c1f] text-[13.5px] leading-5 font-normal hover:bg-[#eeedf1] transition-colors flex items-center gap-2 shadow-sm border border-[#eeedf1]">
                        <span className="material-symbols-outlined text-[16px] text-[#5e5e67]">file_download</span>
                        <span>Export CSV</span>
                      </button>
                      <button className="h-9 px-3.5 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#1b1b1e] text-[13.5px] leading-5 font-medium transition-colors flex items-center gap-1.5 shadow-sm">
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        <span>+ New Client Folio</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Main grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* LEFT: Directory */}
                  <section aria-label="Client Directory" className="lg:col-span-5 xl:col-span-4 flex flex-col gap-2">
                    <div className="bg-[#ffffff] rounded-xl p-2 flex flex-col gap-2 shadow-sm border border-[#c8c5cb]/30">
                      <div className="relative flex items-center">
                        <span className="material-symbols-outlined absolute left-3 text-[18px] text-[#77767b] pointer-events-none">
                          search
                        </span>
                        <input
                          className="w-full h-9 pl-9 pr-12 rounded-lg bg-[#f3f3f7] text-[13.5px] text-[#1a1c1f] placeholder:text-[#77767b] focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#000000] transition-all border border-transparent focus:border-[#eeedf1]"
                          placeholder="Search name, phone, formula ID..."
                          type="text"
                        />
                        <kbd className="absolute right-2.5 px-1.5 py-0.5 text-[10px] font-mono bg-[#eeedf1] text-[#47464b] rounded border border-[#eeedf1]">
                          ⌘K
                        </kbd>
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 text-[11.5px] font-mono">
                        {SEGMENTS.map((s) => (
                          <button
                            key={s.label}
                            className={
                              "px-2.5 py-1 rounded-full shrink-0 transition-colors " +
                              (s.active
                                ? "bg-[#000000] text-[#ffffff] font-medium shadow-sm"
                                : "bg-[#f3f3f7] hover:bg-[#eeedf1] text-[#47464b] border border-[#eeedf1]")
                            }
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-1.5 border-t border-[#eeedf1] text-[11.5px] font-mono text-[#77767b]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-[#5e5e67]">Sort:</span>
                          <select className="bg-[#f3f3f7] border border-[#eeedf1] rounded px-2 py-0.5 text-[11px] text-[#1a1c1f] font-medium focus:outline-none cursor-pointer">
                            <option>Recently Visited</option>
                            <option>Most Visits</option>
                            <option>Name (A–Z)</option>
                            <option>Spend Tier</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-1 bg-[#f3f3f7] p-0.5 rounded border border-[#eeedf1] text-[11px]">
                          <button className="px-1.5 py-0.5 rounded bg-[#ffffff] text-[#1a1c1f] font-medium shadow-sm flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[13px]">view_list</span>
                            <span>25 / p</span>
                          </button>
                          <button className="px-1.5 py-0.5 rounded text-[#77767b] hover:text-[#1a1c1f] flex items-center gap-0.5 transition-colors">
                            <span className="material-symbols-outlined text-[13px]">unfold_more</span>
                            <span>Scroll</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10.5px] font-mono font-medium text-[#77767b] pt-1 border-t border-[#eeedf1] select-none">
                        {ALPHA.map((l) => (
                          <span
                            key={l}
                            className={
                              l === "A"
                                ? "px-1 rounded bg-[#000000] text-[#ffffff] cursor-pointer"
                                : l === "D"
                                  ? "hover:text-[#000000] cursor-pointer text-[#000000] font-semibold"
                                  : "hover:text-[#000000] cursor-pointer"
                            }
                          >
                            {l}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Client stream */}
                    <div className="flex flex-col gap-2 max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
                      {CLIENTS.map((c) => (
                        <div
                          key={c.name}
                          className={
                            "bg-[#ffffff] rounded-xl p-2 relative overflow-hidden transition-all shadow-sm cursor-pointer " +
                            (c.active ? "border-2 border-[#000000]" : "border border-[#eeedf1] hover:bg-[#f3f3f7]/60")
                          }
                        >
                          {c.active && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#000000]" />}
                          <div className={"flex items-start justify-between gap-2 " + (c.active ? "pl-1" : "")}>
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div
                                className={
                                  "w-9 h-9 rounded-full flex items-center justify-center text-[11.5px] font-semibold shrink-0 " +
                                  (c.active ? "bg-[#000000] text-[#ffffff] ring-2 ring-[#f9f9fd] shadow-sm" : "bg-[#e8e8ec] text-[#1a1c1f]")
                                }
                              >
                                {c.initials}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-[#1a1c1f] text-[14px] truncate">{c.name}</span>
                                  <span
                                    className={
                                      "text-[9px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider " +
                                      (c.active
                                        ? "bg-[#000000] text-[#ffffff] font-semibold"
                                        : "bg-[#f3f3f7] text-[#47464b] font-medium border border-[#eeedf1]")
                                    }
                                  >
                                    {c.tier}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 font-mono text-[11.5px] text-[#77767b]">
                                  <span className="flex items-center gap-0.5">
                                    <span className="material-symbols-outlined text-[12px] text-[#5e5e67]">call</span>
                                    {c.phone}
                                  </span>
                                  <span className="inline-block w-1 h-1 rounded-full bg-[#c8c5cb]" />
                                  <span className="text-[11.5px] text-[#47464b] font-medium flex items-center gap-1">
                                    <span className="w-3 h-3 rounded-full bg-[#eeedf1] flex items-center justify-center text-[8px] font-mono">
                                      {c.stylist}
                                    </span>
                                    {c.stylistName}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {c.active ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-[#e8e8ec] text-[#000000] font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#000000] animate-pulse" />
                                  {c.right}
                                </span>
                              ) : (
                                <span className="font-mono text-[10.5px] text-[#77767b]">{c.right}</span>
                              )}
                            </div>
                          </div>
                          <div
                            className={
                              "mt-2 pt-1 flex items-center justify-between text-[11.5px] border-t border-[#eeedf1] " +
                              (c.active ? "pl-1" : "")
                            }
                          >
                            <span className="text-[11px] text-[#47464b] font-mono">{c.detail}</span>
                            <span className={"font-mono text-[10.5px] " + (c.active ? "text-[#000000] font-semibold" : "text-[#77767b]")}>
                              {c.note}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    <div className="flex flex-col gap-2 p-2 bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm text-[11.5px] font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-[11.5px] text-[#47464b]">
                          Showing <strong className="text-[#1a1c1f] font-semibold">1–25</strong> of 248
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-[#77767b]">Per page:</span>
                          <select className="bg-[#f3f3f7] border border-[#eeedf1] rounded px-1.5 py-0.5 text-[11px] text-[#1a1c1f] font-medium focus:outline-none cursor-pointer">
                            <option>25</option>
                            <option>50</option>
                            <option>100</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-[#eeedf1]">
                        <div className="flex items-center gap-1">
                          <button
                            disabled
                            className="w-7 h-7 flex items-center justify-center rounded bg-[#f3f3f7] text-[#77767b] disabled:opacity-40 border border-[#eeedf1]"
                          >
                            <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                          </button>
                          <button className="w-7 h-7 flex items-center justify-center rounded bg-[#000000] text-[#ffffff] font-semibold text-[11.5px] shadow-sm">
                            1
                          </button>
                          <button className="w-7 h-7 flex items-center justify-center rounded bg-[#f3f3f7] hover:bg-[#eeedf1] text-[#1a1c1f] font-medium text-[11.5px] transition-colors border border-[#eeedf1]">
                            2
                          </button>
                          <button className="w-7 h-7 flex items-center justify-center rounded bg-[#f3f3f7] hover:bg-[#eeedf1] text-[#1a1c1f] font-medium text-[11.5px] transition-colors border border-[#eeedf1]">
                            3
                          </button>
                          <span className="px-0.5 text-[#77767b] text-[11px]">…</span>
                          <button className="w-7 h-7 flex items-center justify-center rounded bg-[#f3f3f7] hover:bg-[#eeedf1] text-[#1a1c1f] font-medium text-[11.5px] transition-colors border border-[#eeedf1]">
                            10
                          </button>
                          <button className="w-7 h-7 flex items-center justify-center rounded bg-[#ffffff] hover:bg-[#eeedf1] text-[#1a1c1f] transition-colors shadow-sm border border-[#eeedf1]">
                            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[#77767b]">
                          <span>Go:</span>
                          <input
                            className="w-8 h-6 text-center rounded bg-[#f3f3f7] border border-[#eeedf1] text-[#1a1c1f] text-[11px] font-mono focus:outline-none focus:border-[#000000]"
                            defaultValue="1"
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* RIGHT: Dossier */}
                  <section aria-label="Dedicated Client Dossier" className="lg:col-span-7 xl:col-span-8 flex flex-col gap-5">
                    {/* Hero */}
                    <div className="bg-[#ffffff] rounded-xl p-5 flex flex-col gap-3 shadow-sm border border-[#c8c5cb]/30">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#eeedf1]">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <div className="w-16 h-16 rounded-full bg-[#000000] text-[#ffffff] flex items-center justify-center text-xl leading-7 tracking-[-0.015em] font-semibold shrink-0 ring-4 ring-[#f3f3f7] shadow-sm">
                              NA
                            </div>
                            <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[#000000] border-2 border-[#ffffff] flex items-center justify-center">
                              <span className="material-symbols-outlined text-[10px] text-[#ffffff]">check</span>
                            </span>
                          </div>
                          <div className="flex flex-col justify-center">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="text-[22px] font-semibold text-[#1a1c1f] tracking-tight leading-none">Datin Nora Al-Habshee</h2>
                              <span className="px-2 py-0.5 rounded text-[10.5px] font-mono bg-[#000000] text-[#ffffff] font-semibold tracking-wider uppercase leading-none">
                                VIP PLATINUM
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10.5px] font-mono bg-[#e8e8ec] text-[#47464b] font-medium flex items-center gap-1 leading-none">
                                <span className="material-symbols-outlined text-[12px]">verified</span> ID: #WH-0941
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5 font-mono text-[12px] text-[#77767b] mt-2 flex-wrap">
                              <span className="text-[#47464b] font-medium flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px] text-[#5e5e67]">call</span> +60 12-553 0921
                              </span>
                              <span>·</span>
                              <span>Bangsar Residence</span>
                              <span>·</span>
                              <span className="text-[#000000] font-semibold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">content_cut</span> Primary Stylist: Jasmine Teo
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap sm:justify-end shrink-0">
                          <a
                            href="https://wa.me/60125530921"
                            target="_blank"
                            rel="noreferrer"
                            className="h-8 px-3 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] text-[#1a1c1f] text-[13px] font-medium transition-colors flex items-center gap-1.5 shadow-sm border border-[#eeedf1]"
                          >
                            <span className="material-symbols-outlined text-[15px] text-[#5e5e67]">chat</span>
                            <span>WhatsApp</span>
                          </a>
                          <button className="h-8 px-3 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] text-[#1a1c1f] text-[13px] font-medium transition-colors flex items-center gap-1.5 shadow-sm border border-[#eeedf1]">
                            <span className="material-symbols-outlined text-[15px] text-[#5e5e67]">calendar_today</span>
                            <span>Book Next</span>
                          </button>
                          <button className="h-8 px-3 rounded-lg bg-[#ffffff] hover:bg-[#eeedf1] text-[#1a1c1f] text-[13px] font-medium transition-colors flex items-center gap-1.5 shadow-sm border border-[#eeedf1]">
                            <span className="material-symbols-outlined text-[15px] text-[#5e5e67]">edit</span>
                            <span>Edit Profile</span>
                          </button>
                        </div>
                      </div>

                      {/* Stat tiles */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 py-1">
                        {STAT_TILES.map((t) => (
                          <div
                            key={t.label}
                            className="flex flex-col justify-between p-2.5 rounded-lg bg-[#f3f3f7]/70 border border-[#eeedf1] min-h-[78px]"
                          >
                            <span className="text-[10.5px] font-mono text-[#77767b] uppercase tracking-wider">{t.label}</span>
                            <span className={"font-mono font-semibold text-[17px] mt-0.5 " + (t.primary ? "text-[#000000]" : "text-[#1a1c1f]")}>
                              {t.value}
                            </span>
                            <span className="text-[10px] font-mono text-[#77767b] mt-0.5">{t.note}</span>
                          </div>
                        ))}
                      </div>

                      {/* Info cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {INFO_CARDS.map((c) => (
                          <div
                            key={c.label}
                            className="bg-[#f3f3f7] rounded-lg p-3 flex flex-col justify-between gap-1 border border-[#eeedf1] min-h-[92px]"
                          >
                            <div className="flex items-center justify-between text-[#77767b]">
                              <span
                                className={
                                  "text-[10.5px] font-mono uppercase tracking-wider flex items-center gap-1 " +
                                  (c.warn ? "text-[#000000] font-semibold" : "")
                                }
                              >
                                {c.warn && <span className="material-symbols-outlined text-[14px] text-[#000000]">verified</span>}
                                {c.label}
                              </span>
                              {c.tag ? (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#e2e2e6] text-[#1a1c1f] font-semibold">
                                  {c.tag}
                                </span>
                              ) : (
                                <span className="material-symbols-outlined text-[15px]">{c.icon}</span>
                              )}
                            </div>
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <span className="font-medium text-[13.5px] text-[#1a1c1f]">{c.line1}</span>
                              <span className="text-[#47464b] text-[12px]">{c.line2}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Latest formula */}
                      <div className="p-3.5 rounded-lg bg-[#f3f3f7] border border-[#eeedf1] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#000000] text-[#ffffff] flex items-center justify-center shrink-0 shadow-sm">
                            <span className="material-symbols-outlined text-[18px]">science</span>
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-[10.5px] font-mono uppercase text-[#77767b] tracking-wider">Latest Technical Formula</span>
                              <span className="font-mono text-[11px] text-[#1a1c1f] font-semibold">24 Oct 2024</span>
                              <span className="text-[10px] font-mono text-[#77767b]">· By Jasmine Teo</span>
                            </div>
                            <span className="font-semibold text-[#1a1c1f] text-[14px] mt-0.5">
                              Balayage Lift (Blond Studio 9) + Dialight 9.12 Pearl Ash Gloss Toner
                            </span>
                          </div>
                        </div>
                        <button className="h-8 px-3 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#1b1b1e] text-[12px] font-medium flex items-center gap-1 shrink-0 transition-colors shadow-sm">
                          <span>View Full Technical Dossier</span>
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </button>
                      </div>
                    </div>

                    {/* Active Prepaid Packages */}
                    <div className="bg-[#ffffff] rounded-xl p-5 flex flex-col gap-3 shadow-sm border border-[#c8c5cb]/30">
                      <div className="flex items-center justify-between pb-1 border-b border-[#eeedf1]">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Active Prepaid Packages</h3>
                          <span className="text-[11.5px] font-mono px-2 py-0.5 rounded bg-[#eeedf1] text-[#1a1c1f] font-semibold">
                            1 Active Plan
                          </span>
                        </div>
                        <button className="h-8 px-3 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#1b1b1e] text-[12.5px] font-medium flex items-center gap-1.5 transition-colors shadow-sm">
                          <span className="material-symbols-outlined text-[15px]">add</span>
                          <span>+ Redeem Session</span>
                        </button>
                      </div>
                      <div className="p-3.5 rounded-lg bg-[#f3f3f7] border border-[#eeedf1] flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#1a1c1f] text-[15px]">Kérastase Fusio-Dose Caviar Concentré</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#e2e2e6] text-[#1a1c1f] font-semibold">
                                10 SESSIONS PASS
                              </span>
                            </div>
                            <span className="text-[11.5px] text-[#77767b] font-mono mt-0.5">
                              Purchased 15 May 2024 · Valid through 30 Nov 2025 (410 days left)
                            </span>
                          </div>
                          <div className="flex items-baseline gap-1.5 text-right">
                            <span className="font-mono text-[20px] font-semibold text-[#000000] leading-none">6</span>
                            <span className="font-mono text-[12px] text-[#77767b] uppercase">/ 10 Sessions Remaining</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 pt-1">
                          <div className="w-full h-2 rounded-full bg-[#e2e2e6] overflow-hidden">
                            <div className="h-full bg-[#000000] rounded-full" style={{ width: "60%" }} />
                          </div>
                          <div className="flex items-center justify-between text-[11.5px] font-mono text-[#77767b]">
                            <span>4 Sessions Redeemed (Value ~RM 720.00 consumed)</span>
                            <span className="font-semibold text-[#1a1c1f]">Remaining Value: RM 1,080.00 / RM 1,800.00</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Visit & Bill History */}
                    <div className="bg-[#ffffff] rounded-xl p-5 flex flex-col gap-3 shadow-sm border border-[#c8c5cb]/30">
                      <div className="flex items-center justify-between pb-1 border-b border-[#eeedf1]">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Visit &amp; Bill History</h3>
                          <span className="text-[11.5px] font-mono text-[#77767b]">(Last 4 Visits Recorded)</span>
                        </div>
                        <button className="text-[11.5px] font-mono text-[#000000] hover:underline flex items-center gap-1 font-medium">
                          <span>View All Invoices in Terminal</span>
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[13.5px] leading-5">
                          <thead className="text-[11px] font-mono uppercase text-[#77767b] border-b border-[#eeedf1]">
                            <tr>
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Services Rendered &amp; Treatment</th>
                              <th className="py-2 px-3">Stylist</th>
                              <th className="py-2 px-3 text-right font-mono">Total (RM)</th>
                              <th className="py-2 px-3 text-right font-mono">Folio Receipt</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#eeedf1]">
                            {VISITS.map((v) => (
                              <tr key={v.inv} className="hover:bg-[#f3f3f7]/40 transition-colors">
                                <td className="py-3 px-3 align-top font-mono text-[12px] font-semibold text-[#1a1c1f]">
                                  <div>{v.date}</div>
                                  <span className="text-[10px] text-[#77767b] font-normal">{v.time}</span>
                                </td>
                                <td className="py-3 px-3 align-top">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-[#1a1c1f] text-[13.5px]">{v.service}</span>
                                    <span className="text-[11.5px] text-[#77767b] mt-0.5 font-mono">{v.detail}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-3 align-top font-mono text-[12px] text-[#47464b]">
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#f3f3f7] border border-[#eeedf1]">
                                    <span className="w-3 h-3 rounded-full bg-[#000000] text-[#ffffff] text-[8px] flex items-center justify-center font-bold">
                                      {v.stylistInitial}
                                    </span>
                                    {v.stylistName}
                                  </span>
                                </td>
                                <td className="py-3 px-3 align-top text-right font-mono font-semibold text-[#1a1c1f] text-[14px]">
                                  {v.total}
                                </td>
                                <td className="py-3 px-3 align-top text-right">
                                  <a
                                    href="#"
                                    className="font-mono text-[11.5px] text-[#000000] hover:underline px-2 py-0.5 rounded bg-[#f3f3f7] border border-[#eeedf1]"
                                  >
                                    {v.inv}
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Prescribed Homecare Regulars */}
                    <div className="bg-[#ffffff] rounded-xl p-5 flex flex-col gap-3 shadow-sm border border-[#c8c5cb]/30">
                      <div className="flex items-center justify-between pb-1 border-b border-[#eeedf1]">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">
                            Prescribed Homecare Regulars
                          </h3>
                          <span className="text-[11.5px] font-mono text-[#77767b]">(Reorder Intelligence &amp; Regimen)</span>
                        </div>
                        <button className="h-8 px-3 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] text-[#1a1c1f] text-[12.5px] font-medium flex items-center gap-1.5 transition-colors shadow-sm border border-[#eeedf1]">
                          <span className="material-symbols-outlined text-[15px]">add</span>
                          <span>+ Bill Product</span>
                        </button>
                      </div>
                      <p className="text-[13.5px] text-[#77767b] py-4 text-center">
                        No homecare products billed to Datin Nora yet.
                      </p>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

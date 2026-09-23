import Link from "next/link";
import { MaterialSymbolsLink, SalonSidebar } from "../salon-shell";

/**
 * Literal port of the founder's own Stitch source for "Salon Overview"
 * (Task 405, pasted 2026-09-23). Same structure, same copy, same numbers he
 * designed with -- Material 3 semantic colours swapped for their arbitrary
 * hex equivalents (bg-surface-container-lowest -> bg-[#ffffff], etc.) so
 * Tailwind's own generator produces them without touching swiss.css's
 * `--color-primary` / `--color-on-primary`, which already mean something
 * different platform-wide.
 *
 * WHAT IS REAL AND WHAT IS NOT, so nobody mistakes one for the other:
 *   - the numbers below are HIS OWN sample content, unchanged from the
 *     source he gave -- not fabricated here.
 *   - none of it reads from the database yet. He asked for this to be
 *     demo-ready for a prospect meeting first; wiring live figures
 *     (guest counts, takings, stylist load, low-stock reorder -- all
 *     computable today, see the chat) is the next pass, not this one.
 *   - "In Chair" vs "Waiting Lounge", the till-float / drawer-balanced
 *     line, and the WhatsApp confirmation tags are things the product
 *     cannot answer today even once wired -- no seated-vs-waiting state,
 *     no cash-drawer count, no inbound WhatsApp. Logged in founder-tasks.
 */
export default function SalonOverviewPreview() {
  return (
    <>
      <MaterialSymbolsLink />
      <div
        className="bg-[#f9f9fd] text-[#1a1c1f] text-[14.5px] leading-[22px] tracking-[-0.005em] antialiased min-h-screen"
        style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
      >
        <SalonSidebar active="overview" />
        <div className="pl-64 min-h-screen bg-[#f9f9fd]">
          <main className="w-full pt-0 bg-[#f9f9fd] min-h-screen">
            <div className="flex flex-col w-full">
              <div className="p-8 max-w-[1560px] mx-auto w-full space-y-8">
                {/* Top Header Area */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#eeedf1]">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[#5e5e67] text-[11.5px] leading-4 tracking-[0.04em] font-medium">
                      <span>Operations</span>
                      <span>/</span>
                      <span className="text-[#000000] font-medium">Bangsar Flagship</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold text-[#000000]">
                        Salon Overview
                      </h1>
                      <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#e8e8ec]/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#000000] animate-pulse" />
                        <span className="text-[11.5px] leading-4 tracking-[0.04em] tracking-wider uppercase text-[#000000] font-semibold">
                          Live Floor Status
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="px-3.5 py-2 rounded bg-[#f3f3f7] text-[13.5px] leading-5 font-normal text-[#5e5e67]">
                      Thursday, Oct 24
                    </div>
                    <button className="px-3.5 py-2 rounded bg-[#eeedf1] hover:bg-[#e8e8ec] active:scale-[0.97] text-[#000000] text-[13.5px] leading-5 font-normal transition-colors">
                      Floor Notes
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 rounded bg-[#000000] text-[#ffffff] hover:bg-[#5f5e61] active:scale-[0.97] text-[13.5px] leading-5 font-normal transition-colors">
                      <span className="material-symbols-outlined text-[18px]">person_add</span>
                      <span>+ New Walk-in Guest</span>
                    </button>
                  </div>
                </header>

                {/* Top KPI Metric Cards */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Metric 1: Today's Guest Flow */}
                  <div className="p-5 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm flex flex-col justify-between h-36">
                    <div className="flex items-center justify-between text-[#5e5e67]">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase">
                        Today&apos;s Flow (今日客流)
                      </span>
                      <span className="material-symbols-outlined text-[18px]">group</span>
                    </div>
                    <div>
                      <div className="text-[30px] leading-9 tracking-[-0.025em] font-semibold text-[#000000] tabular-nums">
                        18 Guests
                      </div>
                      <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-1">
                        4 In Chair · 2 Waiting Lounge · 12 Completed
                      </p>
                    </div>
                  </div>

                  {/* Metric 2: Chair Occupancy */}
                  <div className="p-5 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm flex flex-col justify-between h-36">
                    <div className="flex items-center justify-between text-[#5e5e67]">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase">
                        Stylist Workload (技师负荷)
                      </span>
                      <span className="material-symbols-outlined text-[18px]">badge</span>
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[30px] leading-9 tracking-[-0.025em] font-semibold text-[#000000] tabular-nums">
                          80%
                        </span>
                        <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                          4 of 5 Stylists Busy
                        </span>
                      </div>
                      <div className="w-full bg-[#e8e8ec] h-1.5 rounded-full mt-2.5 overflow-hidden">
                        <div className="bg-[#000000] h-full rounded-full" style={{ width: "80%" }} />
                      </div>
                    </div>
                  </div>

                  {/* Metric 3: Today's Takings */}
                  <div className="p-5 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm flex flex-col justify-between h-36">
                    <div className="flex items-center justify-between text-[#5e5e67]">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase">
                        Today&apos;s Takings (实收开单)
                      </span>
                      <span className="material-symbols-outlined text-[18px]">payments</span>
                    </div>
                    <div>
                      <div className="text-[30px] leading-9 tracking-[-0.025em] font-semibold text-[#000000] tabular-nums">
                        RM 2,480.00
                      </div>
                      <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-1">
                        14 Receipts Settled · Drawer Balanced
                      </p>
                    </div>
                  </div>

                  {/* Metric 4: Dispensary Low Stock */}
                  <div className="p-5 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm flex flex-col justify-between h-36">
                    <div className="flex items-center justify-between text-[#5e5e67]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#ba1a1a]" />
                        <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#ba1a1a]">
                          Dispensary Reorder
                        </span>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-[#ba1a1a]">inventory_2</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div className="pr-2 truncate">
                        <div className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium text-[#000000] font-semibold truncate">
                          Blond Studio 9 Bleach
                        </div>
                        <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-0.5">
                          1 tub remaining (L&apos;Oréal)
                        </div>
                      </div>
                      <Link
                        href="/en/salon-preview/stock"
                        className="px-2.5 py-1 bg-[#eeedf1] hover:bg-[#e8e8ec] active:scale-[0.97] rounded text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#000000] uppercase tracking-wider transition-colors shrink-0"
                      >
                        Reorder
                      </Link>
                    </div>
                  </div>
                </section>

                {/* Main Operations Workspace */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Left 8 Columns */}
                  <div className="lg:col-span-8 space-y-6">
                    {/* Stylist Roster & Day Target Breakdown */}
                    <div className="p-6 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm space-y-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                            Daily Stylist Run Sheet (今日工位与业绩分配)
                          </span>
                          <span className="px-2 py-0.5 rounded text-[11.5px] leading-4 tracking-[0.04em] font-medium bg-[#e8e8ec] text-[#000000] font-medium">
                            5 Active Staff
                          </span>
                        </div>
                        <Link
                          href="/en/salon-preview/stylists"
                          className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] hover:text-[#000000] active:scale-[0.97] transition-all uppercase tracking-wider font-semibold flex items-center gap-1"
                        >
                          View Full Roster <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </Link>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { name: "Amy Chen", tier: "Senior", note: "4 Clients Booked", projected: "RM 680.00" },
                          { name: "Jasmine Teo", tier: "Master", note: "5 Clients (Color heavy)", projected: "RM 1,120.00" },
                          { name: "Chloe Tan", tier: "Creative", note: "3 Clients Booked", projected: "RM 420.00" },
                          { name: "Kelvin Ng", tier: "Associate", note: "3 Clients + Support", projected: "RM 260.00" },
                        ].map((s) => (
                          <div
                            key={s.name}
                            className="p-4 rounded-xl bg-[#f3f3f7] flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium font-semibold text-[#000000]">
                                  {s.name}
                                </span>
                                <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                                  {s.tier}
                                </span>
                              </div>
                              <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                                {s.note}
                              </div>
                            </div>
                            <div className="mt-3 pt-2.5 border-t border-[#eeedf1] flex items-baseline justify-between">
                              <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                                Projected
                              </span>
                              <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-medium font-semibold text-[#000000]">
                                {s.projected}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Upcoming Appointments & Run Sheet Flow */}
                    <div className="p-6 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#000000]">
                            Today&apos;s Schedule &amp; Next Arrivals
                          </h2>
                          <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                            Real-time appointment queue verified via WhatsApp automated reminder
                          </span>
                        </div>
                        <Link
                          href="/en/salon-preview/schedule"
                          className="px-3.5 py-1.5 rounded bg-[#eeedf1] hover:bg-[#e8e8ec] text-[#000000] text-[13.5px] leading-5 font-normal transition-colors"
                        >
                          Open Schedule Grid
                        </Link>
                      </div>

                      <div className="overflow-x-auto">
                        <div className="min-w-[600px] divide-y divide-[#eeedf1]">
                          {[
                            {
                              time: "11:45 AM",
                              name: "Darren Lee",
                              tag: "WA Confirmed",
                              detail: "Men's Scissor Fade · Stylist Amy Chen (Chair 01)",
                              status: "Arrived / Seated",
                              action: "View Formula",
                            },
                            {
                              time: "12:15 PM",
                              name: "Elena Rostova",
                              tag: "On Route",
                              detail: "Balayage Retouch + K18 Treatment · Stylist Jasmine Teo",
                              status: "Prep Bowl: #04",
                              action: "Formula Card",
                            },
                            {
                              time: "01:00 PM",
                              name: "Kenichi Sato",
                              tag: "WA Confirmed",
                              detail: "Signature Cut & Scalp Spa Detox · Stylist Wei Lin",
                              status: "Regular (12 Visits)",
                              action: "History",
                            },
                            {
                              time: "01:30 PM",
                              name: "Sarah Khor",
                              tag: "Walk-in Request",
                              detail: "Wash & Blow Dry + Olaplex No. 3 · Stylist Kelvin Ng",
                              status: "Assigned",
                              action: "Assign Stylist",
                            },
                          ].map((row) => (
                            <div key={row.time + row.name} className="py-3.5 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4">
                                <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-medium font-semibold text-[#000000] w-20 shrink-0">
                                  {row.time}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium font-semibold text-[#000000]">
                                      {row.name}
                                    </span>
                                    <span
                                      className={
                                        "px-2 py-0.5 rounded text-[11.5px] leading-4 tracking-[0.04em] font-medium " +
                                        (row.tag === "WA Confirmed"
                                          ? "bg-[#e8e8ec] text-[#000000]"
                                          : "bg-[#e8e8ec] text-[#5e5e67]")
                                      }
                                    >
                                      {row.tag}
                                    </span>
                                  </div>
                                  <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-0.5">
                                    {row.detail}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                                  {row.status}
                                </span>
                                <button className="px-3 py-1 bg-[#eeedf1] hover:bg-[#e8e8ec] active:scale-[0.97] text-[#000000] rounded text-[11.5px] leading-4 tracking-[0.04em] font-medium transition-colors">
                                  {row.action}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right 4 Columns */}
                  <div className="lg:col-span-4 space-y-6">
                    {/* Front Desk Settlement & Quick POS */}
                    <div className="p-6 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm space-y-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#000000]">
                            Shift Register Stream
                          </h2>
                          <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                            Till Float: RM 350.00 intact
                          </span>
                        </div>
                        <a
                          href="#"
                          className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] hover:text-[#000000] transition-colors uppercase tracking-wider font-semibold"
                        >
                          Full POS
                        </a>
                      </div>

                      {/* Payment Split Multi-bar */}
                      <div className="space-y-2">
                        <div className="w-full h-2 rounded-full overflow-hidden flex bg-[#e8e8ec]">
                          <div className="bg-[#000000] h-full" style={{ width: "65%" }} title="DuitNow QR 65%" />
                          <div className="bg-[#5e5e67] h-full" style={{ width: "25%" }} title="Card Terminal 25%" />
                          <div className="bg-[#c8c5cb] h-full" style={{ width: "10%" }} title="Cash 10%" />
                        </div>
                        <div className="flex items-center justify-between pt-1 text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#000000]" />
                            <span>QR (RM 1,612.00)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#5e5e67]" />
                            <span>Card (RM 620.00)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#c8c5cb]" />
                            <span>Cash (RM 248.00)</span>
                          </div>
                        </div>
                      </div>

                      {/* Recent Settled Tickets Stream */}
                      <div className="pt-2 border-t border-[#eeedf1] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">
                            Recent Settled Receipts
                          </span>
                          <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                            Today (14)
                          </span>
                        </div>

                        <div className="space-y-2">
                          {[
                            { inv: "#INV-1082", time: "11:15 AM", who: "Lim Wei Seng · Amy Chen", amt: "RM 180.00" },
                            { inv: "#INV-1081", time: "10:40 AM", who: "Nora Tan · Jasmine Teo", amt: "RM 420.00" },
                          ].map((r) => (
                            <div
                              key={r.inv}
                              className="p-3 rounded bg-[#f3f3f7] flex items-center justify-between"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[13.5px] leading-5 font-normal font-semibold text-[#000000]">
                                    {r.inv}
                                  </span>
                                  <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                                    {r.time}
                                  </span>
                                </div>
                                <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-0.5">
                                  {r.who}
                                </div>
                              </div>
                              <div className="flex items-center gap-2.5">
                                <span className="text-[13.5px] leading-[18px] tracking-[0.01em] font-medium font-semibold text-[#000000]">
                                  {r.amt}
                                </span>
                                <button
                                  className="p-1.5 rounded hover:bg-[#eeedf1] active:scale-[0.9] text-[#5e5e67] hover:text-[#000000] transition-all"
                                  title="Print or send receipt via WhatsApp"
                                >
                                  <span className="material-symbols-outlined text-[16px]">receipt</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Link
                        href="/en/salon-preview/register"
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded bg-[#000000] text-[#ffffff] hover:bg-[#5f5e61] active:scale-[0.98] text-[13.5px] leading-5 font-normal transition-all"
                      >
                        <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                        <span>Open Fast POS Checkout</span>
                      </Link>
                    </div>

                    {/* Practical Inventory Reorder Action Alert */}
                    <div className="p-6 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#ba1a1a] animate-pulse" />
                          <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#000000]">
                            Dispensary &amp; Stock Alert
                          </h3>
                        </div>
                        <Link
                          href="/en/salon-preview/stock"
                          className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] hover:text-[#000000] active:scale-[0.97] uppercase tracking-wider font-semibold transition-all"
                        >
                          Manage Stock
                        </Link>
                      </div>
                      <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                        2 critical chemical formulations below minimum reorder threshold.
                      </p>

                      <div className="space-y-2.5 pt-1">
                        {[
                          { name: "Blond Studio 9 Bleach", note: "L'Oréal Professionnel · 1 tub left" },
                          { name: "DiaLight 9.12 Milkshake", note: "Gloss Toner · 2 tubes left" },
                        ].map((item) => (
                          <div
                            key={item.name}
                            className="p-3.5 rounded bg-[#f3f3f7] flex items-center justify-between gap-3"
                          >
                            <div>
                              <div className="text-[14.5px] leading-[22px] tracking-[-0.005em] font-medium font-semibold text-[#000000]">
                                {item.name}
                              </div>
                              <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] mt-0.5">
                                {item.note}
                              </div>
                            </div>
                            <Link
                              href="/en/salon-preview/stock"
                              className="px-3 py-1.5 bg-[#eeedf1] hover:bg-[#e8e8ec] active:scale-[0.97] rounded text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#000000] uppercase tracking-wider transition-colors shrink-0"
                            >
                              1-Click PO
                            </Link>
                          </div>
                        ))}
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

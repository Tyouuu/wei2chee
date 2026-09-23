import { MaterialSymbolsLink, SalonSidebar } from "../salon-shell";

/**
 * Literal port of the founder's own Stitch source for "Activity Log & Audit
 * Trail" (Task 405, pasted 2026-09-23) -- the last of the five Management
 * rows, so all ten sidebar destinations now have a real page behind them.
 *
 * Server Component: unlike End of Day Cash and Invoices & Terminal, this
 * source has NO <script> block at all -- the search box, the five filter
 * pills, the six activity rows, and the pagination footer are all as inert
 * in his own markup as they are here. The right-hand "Activity Details"
 * panel is not wired to the list either (no onclick anywhere in his
 * source) -- it's a static illustration of what clicking the first
 * (already-highlighted) row would show, matching his own screenshot
 * exactly rather than inventing a click handler he didn't build.
 *
 * WHAT IS REAL AND WHAT IS NOT: every stylist name, timestamp, discount,
 * stock figure and manager note below is his own sample content. None of
 * it reads from a database -- "Export Summary", the date button, the
 * search box, the filter pills, "Print Receipt" and "View Invoice" all do
 * nothing yet.
 */

const METRICS = [
  {
    label: "Total Events Today",
    tag: "142 actions",
    tagClass: "bg-[#eeedf1] text-[#5e5e67]",
    value: "142",
    valueColor: "text-[#000000]",
    note: "Recorded across reception desk, styling chairs & dispensary",
  },
  {
    label: "Staff Manual Edits",
    tag: "5 stylists",
    tagClass: "bg-[#eeedf1] text-[#5e5e67]",
    value: "84",
    valueColor: "text-[#000000]",
    note: "Bills settled, formula notes modified, inventory checked",
  },
  {
    label: "AI Auto-Reconciliation",
    tag: "100% Matched",
    tagClass: "bg-[#1a9a4d]/10 text-[#1a9a4d] border border-[#1a9a4d]/20",
    value: "58",
    valueColor: "text-[#000000]",
    note: "WhatsApp deposit receipts verified & slots reserved automatically",
  },
  {
    label: "Special Approvals",
    tag: "Manager Signed",
    tagClass: "bg-[#a8710a]/10 text-[#a8710a] border border-[#a8710a]/20",
    value: "5",
    valueColor: "text-[#a8710a]",
    note: "VIP courtesy discounts & petty cash towel laundromat fee",
  },
];

const FILTER_TABS: { label: string; active?: boolean; icon?: string; iconColor?: string }[] = [
  { label: "All Activities", active: true },
  { label: "Front Desk & Cashier" },
  { label: "Stylists & Overrides" },
  { label: "Dispensary & Stock" },
  { label: "AI Concierge", icon: "smart_toy", iconColor: "text-[#3b62d9]" },
];

export default function SalonAuditLogPreview() {
  return (
    <>
      <MaterialSymbolsLink />
      <div
        className="bg-[#f9f9fd] text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] antialiased min-h-screen"
        style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
      >
        <SalonSidebar active="system-audit-log" />
        <div className="pl-64 min-h-screen bg-[#f9f9fd]">
          <main className="w-full p-8 bg-[#f9f9fd]">
            <div className="flex flex-col w-full">
              {/* Header Section */}
              <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-5 border-b border-[#e8e8ec]">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider text-[#5e5e67]">
                    <span>Operations</span>
                    <span className="text-[#c8c5cb]">/</span>
                    <span>Management</span>
                    <span className="text-[#c8c5cb]">/</span>
                    <span className="text-[#000000] font-semibold">Activity &amp; Audit Trail</span>
                  </div>
                  <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold text-[#000000] tracking-tight mt-0.5">
                    Activity Log &amp; Audit Trail
                  </h1>
                  <p className="text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#5e5e67]">
                    A transparent, real-time record of all front-desk transactions, staff price adjustments, stock usage, and
                    AI concierge actions across the salon.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-start xl:self-auto">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#ffffff] border border-[#c8c5cb] text-[12px] font-medium text-[#5e5e67] shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-[#1a9a4d]" />
                    <span className="text-[#1a1c1f]">Bangsar Salon Active</span>
                  </div>
                  <button className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded bg-[#ffffff] text-[#000000] border border-[#c8c5cb] hover:bg-[#f3f3f7] active:scale-[0.97] transition-colors font-medium text-[13.5px] leading-5">
                    <span className="material-symbols-outlined text-[17px] text-[#5e5e67]">calendar_today</span>
                    <span>Today, 24 Oct</span>
                  </button>
                  <button className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded bg-[#000000] text-[#ffffff] hover:bg-[#e2e2e6] hover:text-[#000000] active:scale-[0.97] transition-colors font-medium text-[13.5px] leading-5">
                    <span className="material-symbols-outlined text-[17px]">download</span>
                    <span>Export Summary</span>
                  </button>
                </div>
              </header>

              {/* Metrics */}
              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 py-5">
                {METRICS.map((m) => (
                  <div
                    key={m.label}
                    className="p-5 rounded-xl bg-[#ffffff] border border-[#c8c5cb]/30 shadow-sm flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#5e5e67]">
                        {m.label}
                      </span>
                      <span className={"text-[11px] font-medium px-2 py-0.5 rounded " + m.tagClass}>{m.tag}</span>
                    </div>
                    <div className="my-2">
                      <span className={"text-[30px] leading-9 tracking-[-0.025em] font-semibold tracking-tight " + m.valueColor}>
                        {m.value}
                      </span>
                    </div>
                    <p className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">{m.note}</p>
                  </div>
                ))}
              </section>

              {/* Search & Filter Tabs */}
              <section className="flex flex-col gap-3 pb-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-lg">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5e5e67] text-[18px]">
                      search
                    </span>
                    <input
                      className="w-full h-9 pl-9 pr-4 rounded-lg bg-[#ffffff] border border-[#c8c5cb] text-[13.5px] leading-5 text-[#000000] placeholder:text-[#5e5e67] focus:outline-none focus:border-[#000000] transition-colors"
                      placeholder="Search staff name, client name, service, or bill #..."
                      type="text"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {FILTER_TABS.map((f) => (
                      <button
                        key={f.label}
                        className={
                          "h-8 px-3 rounded-full text-[11.5px] leading-4 tracking-[0.04em] font-medium transition-all active:scale-[0.97] inline-flex items-center gap-1 " +
                          (f.active
                            ? "bg-[#000000] text-[#ffffff]"
                            : "bg-[#ffffff] border border-[#c8c5cb] text-[#1a1c1f] hover:border-[#000000]")
                        }
                      >
                        {f.icon && <span className={"material-symbols-outlined text-[14px] " + f.iconColor}>{f.icon}</span>}
                        <span>{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Main Split */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start pt-1">
                {/* Activity Exhibition List */}
                <div className="xl:col-span-8 flex flex-col rounded-xl border border-[#c8c5cb]/30 bg-[#ffffff] overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between px-3 py-3 border-b border-[#e8e8ec] bg-[#f3f3f7]/40">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[17px] text-[#000000]">list_alt</span>
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#000000]">
                        Chronological Activity Stream
                      </span>
                    </div>
                    <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                      Showing 6 latest verified actions
                    </span>
                  </div>

                  <div className="divide-y divide-[#e8e8ec]">
                    {/* Item 1: Selected / Featured Event */}
                    <div className="p-3 bg-[#f3f3f7]/50 border-l-2 border-l-[#000000] flex flex-col sm:flex-row items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#000000] text-[#ffffff] flex items-center justify-center font-bold text-[12px] shrink-0 mt-0.5">
                          JT
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[14px] text-[#000000] font-semibold">Jasmine Teo</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#eeedf1] text-[#5e5e67] font-medium">
                              Master Stylist
                            </span>
                            <span className="text-[#c8c5cb]">·</span>
                            <span className="text-[12px] text-[#5e5e67] font-mono">4:32 PM</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#a8710a]/10 text-[#a8710a] font-medium border border-[#a8710a]/20">
                              VIP Discount Override
                            </span>
                          </div>
                          <div className="text-[14px] text-[#000000] font-medium leading-snug">
                            Applied 10% Courtesy Loyalty Discount to Amanda Choong&apos;s Balayage &amp; Olaplex bill
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-1 text-[12px]">
                            <span className="text-[#5e5e67]">Change:</span>
                            <span className="line-through text-[#5e5e67] font-medium">RM 520.00</span>
                            <span className="text-[#5e5e67]">→</span>
                            <span className="font-semibold text-[#000000] px-1.5 py-0.5 rounded bg-[#a8710a]/10 text-[#a8710a]">
                              RM 468.00 (-RM 52.00)
                            </span>
                            <span className="text-[#c8c5cb]">·</span>
                            <span className="text-[#5e5e67]">
                              Reason: <span className="text-[#000000] font-medium">Director courtesy approval for regular client</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 self-start sm:self-center">
                        <span className="inline-flex items-center gap-1 text-[11.5px] px-2.5 py-1 rounded-md bg-[#eeedf1] text-[#5e5e67] font-medium">
                          <span className="material-symbols-outlined text-[14px] text-[#1a9a4d]">check_circle</span>
                          <span>Approved by Wei Lin</span>
                        </span>
                      </div>
                    </div>

                    {/* Item 2: Checkout Settlement */}
                    <div className="p-3 hover:bg-[#f3f3f7]/40 flex flex-col sm:flex-row items-start justify-between gap-3 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#000000] text-[#ffffff] flex items-center justify-center font-bold text-[12px] shrink-0 mt-0.5">
                          WL
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[14px] text-[#000000] font-semibold">Wei Lin</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#eeedf1] text-[#5e5e67] font-medium">
                              Floor Lead
                            </span>
                            <span className="text-[#c8c5cb]">·</span>
                            <span className="text-[12px] text-[#5e5e67] font-mono">7:42 PM</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#1a9a4d]/10 text-[#1a9a4d] font-medium border border-[#1a9a4d]/20">
                              Checkout Settled
                            </span>
                          </div>
                          <div className="text-[14px] text-[#000000] font-medium leading-snug">
                            Settled final checkout for Amanda Choong (Invoice #INV-2024-1088)
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-1 text-[12px]">
                            <span className="text-[#5e5e67]">
                              Payment Method: <span className="text-[#000000] font-medium">Visa Card (Terminal #01)</span>
                            </span>
                            <span className="text-[#c8c5cb]">·</span>
                            <span className="text-[#5e5e67]">
                              Amount: <span className="text-[#000000] font-semibold">RM 780.00</span>
                            </span>
                            <span className="text-[#c8c5cb]">·</span>
                            <span className="text-[#1a9a4d] font-medium">Paid in Full</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 self-start sm:self-center">
                        <span className="inline-flex items-center gap-1 text-[11.5px] px-2.5 py-1 rounded-md bg-[#eeedf1] text-[#5e5e67] font-medium">
                          <span className="material-symbols-outlined text-[14px] text-[#1a9a4d]">credit_card</span>
                          <span>Receipt #1088</span>
                        </span>
                      </div>
                    </div>

                    {/* Item 3: AI Concierge */}
                    <div className="p-3 hover:bg-[#f3f3f7]/40 flex flex-col sm:flex-row items-start justify-between gap-3 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-md bg-[#3b62d9]/10 text-[#3b62d9] border border-[#3b62d9]/30 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[14px] text-[#3b62d9] font-semibold">AI Concierge · Lingbao</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#3b62d9]/10 text-[#3b62d9] font-medium">
                              WhatsApp Bot
                            </span>
                            <span className="text-[#c8c5cb]">·</span>
                            <span className="text-[12px] text-[#5e5e67] font-mono">6:15 PM</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#1a9a4d]/10 text-[#1a9a4d] font-medium border border-[#1a9a4d]/20">
                              Auto-Matched
                            </span>
                          </div>
                          <div className="text-[14px] text-[#000000] font-medium leading-snug">
                            Auto-verified DuitNow transfer slip (RM 100.00 deposit) for Datin Nora
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-1 text-[12px]">
                            <span className="text-[#5e5e67]">
                              Bank Reference: <span className="text-[#000000] font-mono">#MBB-99824</span>
                            </span>
                            <span className="text-[#c8c5cb]">·</span>
                            <span className="text-[#5e5e67]">
                              Appointment: <span className="text-[#000000] font-medium">Saturday 11:30 AM (Reserved)</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 self-start sm:self-center">
                        <span className="inline-flex items-center gap-1 text-[11.5px] px-2.5 py-1 rounded-md bg-[#3b62d9]/10 text-[#3b62d9] font-medium border border-[#3b62d9]/20">
                          <span className="material-symbols-outlined text-[14px]">verified</span>
                          <span>Slip Validated</span>
                        </span>
                      </div>
                    </div>

                    {/* Item 4: Stock Adjustment */}
                    <div className="p-3 hover:bg-[#f3f3f7]/40 flex flex-col sm:flex-row items-start justify-between gap-3 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-md bg-[#e8e8ec] text-[#000000] flex items-center justify-center shrink-0 border border-[#c8c5cb] mt-0.5">
                          <span className="material-symbols-outlined text-[18px]">scale</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[14px] text-[#000000] font-semibold">Dispensary Lab Scale</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#eeedf1] text-[#5e5e67] font-medium">
                              Bar Counter
                            </span>
                            <span className="text-[#c8c5cb]">·</span>
                            <span className="text-[12px] text-[#5e5e67] font-mono">2:50 PM</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#eeedf1] text-[#5e5e67] font-medium">
                              Stock Deducted
                            </span>
                          </div>
                          <div className="text-[14px] text-[#000000] font-medium leading-snug">
                            Dispensary lightener powder measured: 45g for Service #SVC-902
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-1 text-[12px]">
                            <span className="text-[#5e5e67]">
                              Product: <span className="text-[#000000] font-medium">L&apos;Oreal Blond Studio 9</span>
                            </span>
                            <span className="text-[#c8c5cb]">·</span>
                            <span className="text-[#5e5e67]">
                              Tub Balance: <span className="line-through text-[#5e5e67]">480g</span> →{" "}
                              <span className="font-semibold text-[#000000]">435g</span>
                            </span>
                            <span className="text-[#c8c5cb]">·</span>
                            <span className="text-[#1a9a4d] font-medium">Stock Healthy</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 self-start sm:self-center">
                        <span className="inline-flex items-center gap-1 text-[11.5px] px-2.5 py-1 rounded-md bg-[#eeedf1] text-[#5e5e67] font-medium">
                          <span className="material-symbols-outlined text-[14px]">inventory</span>
                          <span>Logged to Service</span>
                        </span>
                      </div>
                    </div>

                    {/* Item 5: Petty Cash Drawer */}
                    <div className="p-3 hover:bg-[#f3f3f7]/40 flex flex-col sm:flex-row items-start justify-between gap-3 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#e0dee9] text-[#1a1b23] flex items-center justify-center font-bold text-[12px] shrink-0 mt-0.5">
                          KL
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[14px] text-[#000000] font-semibold">Kenneth Lau</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#eeedf1] text-[#5e5e67] font-medium">
                              Receptionist
                            </span>
                            <span className="text-[#c8c5cb]">·</span>
                            <span className="text-[12px] text-[#5e5e67] font-mono">11:20 AM</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#eeedf1] text-[#5e5e67] font-medium">
                              Cash Outflow
                            </span>
                          </div>
                          <div className="text-[14px] text-[#000000] font-medium leading-snug">
                            Petty cash drawer opened: RM 45.00 for Fresh Towels Laundry Dispatch
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-1 text-[12px]">
                            <span className="text-[#5e5e67]">
                              Drawer Cash: <span className="line-through text-[#5e5e67]">RM 850</span> →{" "}
                              <span className="font-semibold text-[#000000]">RM 805</span>
                            </span>
                            <span className="text-[#c8c5cb]">·</span>
                            <span className="text-[#5e5e67]">
                              Voucher: <span className="text-[#000000] font-medium">#PC-1024</span>
                            </span>
                            <span className="text-[#c8c5cb]">·</span>
                            <span className="text-[#5e5e67]">Physical receipt filed in register</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 self-start sm:self-center">
                        <span className="inline-flex items-center gap-1 text-[11.5px] px-2.5 py-1 rounded-md bg-[#eeedf1] text-[#5e5e67] font-medium">
                          <span className="material-symbols-outlined text-[14px]">receipt</span>
                          <span>Voucher Filed</span>
                        </span>
                      </div>
                    </div>

                    {/* Item 6: Formula Update */}
                    <div className="p-3 hover:bg-[#f3f3f7]/40 flex flex-col sm:flex-row items-start justify-between gap-3 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#000000] text-[#ffffff] flex items-center justify-center font-bold text-[12px] shrink-0 mt-0.5">
                          WL
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[14px] text-[#000000] font-semibold">Wei Lin</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#eeedf1] text-[#5e5e67] font-medium">
                              Director
                            </span>
                            <span className="text-[#c8c5cb]">·</span>
                            <span className="text-[12px] text-[#5e5e67] font-mono">10:48 AM</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#eeedf1] text-[#5e5e67] font-medium">
                              Client Profile
                            </span>
                          </div>
                          <div className="text-[14px] text-[#000000] font-medium leading-snug">
                            Updated custom color formula for Datin Nora (Profile #DN-04)
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-1 text-[12px]">
                            <span className="text-[#5e5e67]">
                              Note added:{" "}
                              <span className="text-[#000000] font-medium">
                                Added 3.75ml Olaplex No. 1 Bond Multiplier for porosity care
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 self-start sm:self-center">
                        <span className="inline-flex items-center gap-1 text-[11.5px] px-2.5 py-1 rounded-md bg-[#eeedf1] text-[#5e5e67] font-medium">
                          <span className="material-symbols-outlined text-[14px]">edit_note</span>
                          <span>Formula Saved</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-3 py-3 border-t border-[#e8e8ec] bg-[#f3f3f7]/30 text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">
                    <span>Showing 6 of 142 logged actions today</span>
                    <div className="flex items-center gap-2">
                      <button
                        disabled
                        className="h-7 px-3 rounded border border-[#c8c5cb] bg-[#ffffff] text-[#000000] hover:bg-[#f3f3f7] transition-colors disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <span className="font-medium text-[#000000]">Page 1 of 24</span>
                      <button className="h-7 px-3 rounded border border-[#c8c5cb] bg-[#ffffff] text-[#000000] hover:bg-[#f3f3f7] active:scale-[0.97] transition-colors">
                        Next
                      </button>
                    </div>
                  </div>
                </div>

                {/* Activity Details Panel */}
                <aside className="xl:col-span-4 flex flex-col rounded-xl border border-[#c8c5cb]/30 bg-[#ffffff] overflow-hidden shadow-sm">
                  <div className="px-3 py-3 border-b border-[#e8e8ec] bg-[#f3f3f7]/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#000000]">receipt_long</span>
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#000000]">
                        Activity Details
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#a8710a]/10 text-[#a8710a] border border-[#a8710a]/20">
                      VIP Discount
                    </span>
                  </div>

                  <div className="p-5 flex flex-col gap-5 divide-y divide-[#e8e8ec] text-[13.5px] leading-5">
                    <div className="flex flex-col gap-1 pb-1">
                      <span className="text-[12px] text-[#5e5e67] font-medium">Today at 4:32 PM · Station 02 (iPad Pro)</span>
                      <h3 className="text-base leading-6 tracking-[-0.01em] text-[16px] text-[#000000] font-semibold mt-0.5 leading-snug">
                        10% Manager Courtesy Discount Applied
                      </h3>
                      <p className="text-[#5e5e67] text-[13px] leading-relaxed mt-1">
                        Manual courtesy loyalty discount applied at checkout for a recurring high-value VIP customer.
                      </p>
                    </div>

                    <div className="pt-5 flex flex-col gap-2.5">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#5e5e67]">
                        People &amp; Roles
                      </span>
                      <div className="flex flex-col gap-2">
                        <div className="p-2.5 rounded-lg bg-[#f3f3f7]/60 border border-[#e8e8ec] flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#000000] text-[#ffffff] flex items-center justify-center font-bold text-[11px]">
                              JT
                            </div>
                            <div>
                              <div className="font-medium text-[#000000] text-[13px]">Jasmine Teo</div>
                              <div className="text-[11px] text-[#5e5e67]">Requested discount on service</div>
                            </div>
                          </div>
                          <span className="text-[11px] font-medium text-[#5e5e67]">Master Stylist</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#f3f3f7]/60 border border-[#e8e8ec] flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#000000] text-[#ffffff] flex items-center justify-center font-bold text-[11px]">
                              WL
                            </div>
                            <div>
                              <div className="font-medium text-[#000000] text-[13px]">Wei Lin</div>
                              <div className="text-[11px] text-[#5e5e67]">Approved with manager passcode</div>
                            </div>
                          </div>
                          <span className="text-[11px] font-medium text-[#1a9a4d] flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">check</span> Approved
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-5 flex flex-col gap-2">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#5e5e67]">
                        Customer &amp; Service
                      </span>
                      <div className="p-3 rounded-lg bg-[#f9f9fd] border border-[#c8c5cb]/60 flex flex-col gap-2 text-[13px]">
                        <div className="flex justify-between items-center">
                          <span className="text-[#5e5e67]">Client:</span>
                          <span className="font-semibold text-[#000000]">Amanda Choong</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#5e5e67]">Service:</span>
                          <span className="font-medium text-[#000000]">Balayage Full &amp; Olaplex</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#5e5e67]">Original Price:</span>
                          <span className="line-through text-[#5e5e67]">RM 520.00</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#5e5e67]">Discounted Price:</span>
                          <span className="font-bold text-[#a8710a]">RM 468.00 (-10%)</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-[#e8e8ec] pt-2">
                          <span className="text-[#5e5e67]">Bill Total:</span>
                          <span className="font-bold text-[#000000] text-[14px]">RM 780.00 (with products)</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-5 flex flex-col gap-1.5">
                      <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase tracking-wider text-[#5e5e67]">
                        Manager Note
                      </span>
                      <div className="p-3 rounded-lg bg-[#f3f3f7] text-[13px] text-[#1a1c1f] leading-relaxed border border-[#c8c5cb]/50">
                        &ldquo;Amanda celebrated her 10th visit this year. Approved 10% courtesy loyalty discount on technical
                        coloring as agreed during consultation.&rdquo; — Wei Lin
                      </div>
                    </div>
                  </div>

                  <div className="p-3 border-t border-[#e8e8ec] bg-[#f3f3f7]/30 flex items-center justify-between gap-2">
                    <button className="flex-1 h-8 rounded border border-[#c8c5cb] bg-[#ffffff] text-[#000000] hover:bg-[#f3f3f7] active:scale-[0.97] transition-colors font-medium text-[12px] flex items-center justify-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">print</span>
                      <span>Print Receipt</span>
                    </button>
                    <button className="flex-1 h-8 rounded bg-[#000000] text-[#ffffff] hover:bg-[#e2e2e6] hover:text-[#000000] active:scale-[0.97] transition-colors font-medium text-[12px] flex items-center justify-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">receipt</span>
                      <span>View Invoice</span>
                    </button>
                  </div>
                </aside>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

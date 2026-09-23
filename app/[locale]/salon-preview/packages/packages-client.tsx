"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { SalonSidebar } from "../salon-shell";

export type PackageStatus = "active" | "expiring" | "depleted";

export type PackageRow = {
  id: string;
  partyId: string;
  guest: string;
  phone: string;
  whatsapp: string;
  name: string;
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsLeft: number;
  soldOn: string;
  expiresOn: string | null;
  status: PackageStatus;
};

export type PunchHistoryEntry = {
  id: string;
  usedOn: string;
  staffName: string | null;
  note: string;
};

function ringgit(cents: number): string {
  const whole = cents / 100;
  return `RM ${whole.toLocaleString("en-MY", { minimumFractionDigits: whole % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}
function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${iso}T12:00:00+08:00`));
}
function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}

const PAGE_SIZE = 25;

export function PackagesClient({
  businessName,
  packages,
  selectedId,
  selectedHistory,
  staff,
  canSeeMoney,
  liabilityCents,
  activeCardCount,
  uniqueGuestCount,
  expiringCount,
  redeemedThisMonth,
}: {
  businessName: string;
  packages: PackageRow[];
  selectedId: string | null;
  selectedHistory: PunchHistoryEntry[];
  staff: { id: string; name: string }[];
  canSeeMoney: boolean;
  liabilityCents: number | null;
  activeCardCount: number;
  uniqueGuestCount: number;
  expiringCount: number;
  redeemedThisMonth: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PackageStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return packages.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (q && !`${p.guest} ${p.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [packages, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  const selected = packages.find((p) => p.id === selectedId) ?? null;

  const goTo = (id: string) => router.push(`?package=${id}`);

  const redeem = async () => {
    if (!selected || selected.sessionsLeft <= 0) return;
    setRedeeming(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("use_package_session", {
        in_package_id: selected.id,
        in_staff_id: staffId || null,
        in_note: note,
      });
      if (error) {
        alert(`Couldn't redeem: ${error.message}`);
        return;
      }
      setNote("");
      router.refresh();
    } finally {
      setRedeeming(false);
    }
  };

  const undo = async (useId: string) => {
    if (!confirm("Undo this redemption? The session goes back to remaining.")) return;
    setUndoingId(useId);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("undo_package_use", { in_use_id: useId });
      if (error) {
        alert(`Couldn't undo: ${error.message}`);
        return;
      }
      router.refresh();
    } finally {
      setUndoingId(null);
    }
  };

  const sendWhatsapp = () => {
    if (!selected || !selected.whatsapp) return;
    const digits = selected.whatsapp.replace(/\D/g, "");
    const text = `Hi ${selected.guest}, your ${selected.name} package now has ${selected.sessionsLeft} of ${selected.sessionsTotal} sessions remaining at ${businessName}.`;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div
      className="bg-[#f9f9fd] text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] antialiased min-h-screen"
      style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
    >
      <SalonSidebar active="packages-and-prepaid" businessName={businessName} subtitle="Operations" />
      <div className="pl-64 min-h-screen bg-[#f9f9fd]">
        <main className="w-full px-7 py-7 bg-[#f9f9fd]">
          <div className="flex flex-col w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1 text-[11.5px] leading-4 tracking-[0.04em] font-medium tracking-wider uppercase text-[#5e5e67]">
                  <span>Operations</span>
                  <span className="text-[#c8c5cb]">/</span>
                  <span>Management</span>
                  <span className="text-[#c8c5cb]">/</span>
                  <span className="font-medium text-[#1a1c1f]">Packages &amp; Prepaid Balance Ledger</span>
                </div>
                <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold text-[#1a1c1f] tracking-tight">
                  Packages &amp; Prepaid Balance Ledger
                </h1>
              </div>
              {canSeeMoney && liabilityCents != null && (
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded bg-[#eeedf1] border border-[#c8c5cb]/40">
                  <span className="w-2 h-2 rounded-full bg-[#000000] animate-pulse" />
                  <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider text-[#5e5e67]">Prepaid Float:</span>
                  <span className="text-[13.5px] leading-[18px] font-semibold text-[#1a1c1f] tabular-nums">{ringgit(liabilityCents)}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
              {/* LEFT 8 COLUMNS */}
              <div className="lg:col-span-8 flex flex-col gap-5 min-w-0">
                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    canSeeMoney && liabilityCents != null
                      ? { label: "Prepaid Liability", icon: "account_balance_wallet", value: ringgit(liabilityCents), note: "Unearned float on active cards" }
                      : null,
                    { label: "Active Cards", icon: "credit_card", value: String(activeCardCount), note: `Across ${uniqueGuestCount} guest${uniqueGuestCount === 1 ? "" : "s"}` },
                    { label: "Redeemed (MTD)", icon: "check_circle", value: `${redeemedThisMonth} uses`, note: "" },
                    { label: "Expiring <30 Days", icon: "notifications_active", value: String(expiringCount), note: "", warn: expiringCount > 0 },
                  ]
                    .filter((m): m is NonNullable<typeof m> => m !== null)
                    .map((m) => (
                      <div key={m.label} className="bg-[#ffffff] p-5 rounded-xl border border-[#c8c5cb]/30 flex flex-col justify-between shadow-sm">
                        <div className="flex items-center justify-between text-[#5e5e67] mb-2.5">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5e5e67]">{m.label}</span>
                          <span className={"material-symbols-outlined text-[18px] " + ("warn" in m && m.warn ? "text-amber-600" : "text-[#5e5e67]/70")}>{m.icon}</span>
                        </div>
                        <div>
                          <div className="text-[28px] leading-tight font-semibold text-[#1a1c1f] tabular-nums tracking-tight mb-0.5">{m.value}</div>
                          {m.note && <div className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67]">{m.note}</div>}
                        </div>
                      </div>
                    ))}
                </div>

                {/* Filter Toolbar */}
                <div className="bg-[#ffffff] p-4 rounded-xl border border-[#c8c5cb]/30 space-y-3 shadow-sm">
                  <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
                    <div className="relative w-full sm:max-w-md">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#5e5e67]">search</span>
                      <input
                        className="w-full pl-9 pr-3 py-2 bg-[#f9f9fd] border border-[#c8c5cb]/40 rounded-lg text-[13.5px] leading-[18px] text-[#1a1c1f] placeholder:text-[#5e5e67] focus:outline-none focus:border-[#000000] transition-all"
                        placeholder="Search guest or package name..."
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      />
                    </div>
                    <div className="inline-flex rounded-lg border border-[#c8c5cb]/30 p-1 bg-[#f3f3f7]/70">
                      {([
                        { label: "All", status: "all" as const },
                        { label: "Active", status: "active" as const },
                        { label: "Expiring Soon", status: "expiring" as const },
                        { label: "Depleted", status: "depleted" as const },
                      ]).map((s) => (
                        <button
                          key={s.status}
                          onClick={() => { setStatusFilter(s.status); setPage(1); }}
                          className={"px-3 py-1 text-[11.5px] rounded-md active:scale-[0.97] transition-all " + (statusFilter === s.status ? "font-medium bg-[#ffffff] text-[#1a1c1f] shadow-xs" : "text-[#5e5e67] hover:text-[#1a1c1f]")}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#c8c5cb]/30 bg-[#eeedf1]/30">
                          <th className="py-3.5 px-5 text-[11px] font-semibold text-[#5e5e67] uppercase tracking-wider">Guest &amp; Package</th>
                          <th className="py-3.5 px-5 text-[11px] font-semibold text-[#5e5e67] uppercase tracking-wider">Remaining Balance</th>
                          <th className="py-3.5 px-5 text-[11px] font-semibold text-[#5e5e67] uppercase tracking-wider">Expiry</th>
                          <th className="py-3.5 px-5 text-[11px] font-semibold text-[#5e5e67] uppercase tracking-wider text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#c8c5cb]/20 text-[13.5px] leading-[18px]">
                        {pageRows.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-10 text-center text-[13.5px] text-[#5e5e67]">
                              {packages.length === 0 ? "No prepaid packages sold yet." : `No packages match ${search.trim() ? `"${search.trim()}"` : "this filter"}.`}
                            </td>
                          </tr>
                        )}
                        {pageRows.map((p) => (
                          <tr
                            key={p.id}
                            onClick={() => goTo(p.id)}
                            className={"transition-colors cursor-pointer " + (p.id === selectedId ? "bg-[#f3f3f7]/80" : "hover:bg-[#eeedf1]/30")}
                          >
                            <td className="py-3.5 px-5 align-middle">
                              <div className="flex items-center gap-3">
                                {p.id === selectedId && <span className="w-2 h-2 rounded-full bg-[#000000] shrink-0" />}
                                <div className={"flex flex-col min-w-0" + (p.id !== selectedId ? " pl-5" : "")}>
                                  <span className="font-medium text-[13.5px] text-[#1a1c1f] truncate">{p.guest}</span>
                                  <span className="text-[11.5px] text-[#5e5e67] truncate max-w-[240px]">{p.name}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-5 align-middle">
                              <div className="flex flex-col gap-1.5 w-32">
                                <div className="flex justify-between text-[12px] text-[#1a1c1f]">
                                  <span className={"font-medium" + (p.status === "expiring" ? " text-amber-700" : "")}>{p.sessionsLeft} of {p.sessionsTotal}</span>
                                </div>
                                <div className="w-full bg-[#c8c5cb]/30 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={"h-1.5 rounded-full " + (p.status === "expiring" ? "bg-amber-600" : p.status === "depleted" ? "bg-[#c8c5cb]" : "bg-[#000000]")}
                                    style={{ width: `${Math.round((p.sessionsUsed / p.sessionsTotal) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-5 align-middle">
                              {p.status === "expiring" ? (
                                <div className="text-amber-700 font-medium tabular-nums flex items-center gap-1.5 whitespace-nowrap">
                                  <span className="material-symbols-outlined text-[15px]">warning</span>
                                  <span>{p.expiresOn ? shortDate(p.expiresOn) : "—"}</span>
                                </div>
                              ) : (
                                <div className="tabular-nums text-[#1a1c1f]">{p.expiresOn ? shortDate(p.expiresOn) : "No expiry"}</div>
                              )}
                            </td>
                            <td className="py-3.5 px-5 text-right align-middle">
                              <button
                                onClick={(e) => { e.stopPropagation(); goTo(p.id); }}
                                className={"px-3 py-1.5 font-medium text-[11.5px] rounded-lg transition-colors " + (p.id === selectedId ? "bg-[#000000] text-[#ffffff] shadow-xs" : "border border-[#c8c5cb]/50 text-[#1a1c1f] hover:bg-[#eeedf1]")}
                              >
                                {p.id === selectedId ? "Viewing" : "Inspect"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 px-5 border-t border-[#c8c5cb]/30 flex items-center justify-between text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] bg-[#eeedf1]/20">
                    <div>
                      Showing <span className="font-medium text-[#1a1c1f] tabular-nums">{filtered.length ? (pageClamped - 1) * PAGE_SIZE + 1 : 0}</span> to{" "}
                      <span className="font-medium text-[#1a1c1f] tabular-nums">{Math.min(pageClamped * PAGE_SIZE, filtered.length)}</span> of{" "}
                      <span className="font-medium text-[#1a1c1f] tabular-nums">{filtered.length}</span> packages
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button disabled={pageClamped <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 border border-[#c8c5cb]/50 rounded-md text-[#1a1c1f] disabled:opacity-40">Previous</button>
                      <span className="px-2">Page {pageClamped} / {totalPages}</span>
                      <button disabled={pageClamped >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-3 py-1 border border-[#c8c5cb]/50 rounded-md text-[#1a1c1f] disabled:opacity-40">Next</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT 4 COLUMNS: Inspection & Quick Redeem */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                {!selected ? (
                  <div className="bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm p-10 text-center text-[13.5px] text-[#77767b]">
                    Select a package to inspect it.
                  </div>
                ) : (
                  <div className="bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-[#c8c5cb]/20 flex items-center justify-between bg-[#eeedf1]/20">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-base leading-6 tracking-[-0.01em] text-[#1a1c1f] font-semibold tracking-tight">Inspection &amp; Quick Redeem</span>
                      </div>
                      <span
                        className={
                          "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider shrink-0 self-center border " +
                          (selected.status === "depleted"
                            ? "bg-[#f3f3f7] text-[#5e5e67] border-[#c8c5cb]/30"
                            : selected.status === "expiring"
                              ? "bg-amber-500/10 text-amber-800 border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-800 border-emerald-500/20")
                        }
                      >
                        {selected.status === "depleted" ? "Depleted" : selected.status === "expiring" ? "Expiring Soon" : "Active Pass"}
                      </span>
                    </div>
                    <div className="p-6 space-y-6">
                      <div className="p-3.5 bg-[#f3f3f7]/60 rounded-xl border border-[#c8c5cb]/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#000000] text-[#ffffff] flex items-center justify-center text-[11.5px] font-medium shrink-0">
                            {initialsOf(selected.guest)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[13.5px] leading-[18px] text-[#1a1c1f] truncate font-semibold">{selected.guest}</span>
                            {selected.phone && <span className="text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] tabular-nums">{selected.phone}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 text-[13.5px] leading-[18px]">
                        <div className="text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] font-semibold">{selected.name}</div>
                        <div className="grid grid-cols-2 gap-3 text-[11.5px] pt-2 pb-3 border-b border-[#c8c5cb]/20">
                          <div>
                            <span className="text-[#5e5e67] block">Sold On</span>
                            <span className="font-medium text-[#1a1c1f] tabular-nums mt-0.5 block">{shortDate(selected.soldOn)}</span>
                          </div>
                          <div>
                            <span className="text-[#5e5e67] block">Expires</span>
                            <span className="font-medium text-[#1a1c1f] tabular-nums mt-0.5 block">{selected.expiresOn ? shortDate(selected.expiresOn) : "No expiry"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Punch-card status */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-[11.5px] text-[#5e5e67]">
                          <span className="uppercase tracking-wider text-[11.5px] leading-4 tracking-[0.06em] font-semibold">Punch-Card Status</span>
                          <span className="tabular-nums font-medium text-[#1a1c1f]">{selected.sessionsUsed} Consumed · {selected.sessionsLeft} Remaining</span>
                        </div>
                        <div className="grid grid-cols-5 gap-2.5 p-3.5 bg-[#eeedf1]/40 rounded-xl border border-[#c8c5cb]/30">
                          {Array.from({ length: selected.sessionsTotal }, (_, i) => {
                            const done = i < selected.sessionsUsed;
                            return (
                              <div key={i} className={"flex flex-col items-center justify-center py-2.5 px-1 rounded-lg aspect-square select-none " + (done ? "bg-[#ffffff] border border-[#c8c5cb]/40" : "bg-[#ffffff]/60 border border-dashed border-[#c8c5cb]/70")}>
                                <span className={"material-symbols-outlined " + (done ? "text-[18px] text-[#000000]" : "text-[16px] text-[#c8c5cb]")}>
                                  {done ? "check_circle" : "circle"}
                                </span>
                                <span className={"text-[10px] font-mono mt-1 leading-none " + (done ? "font-medium text-[#1a1c1f]" : "text-[#5e5e67]")}>#{String(i + 1).padStart(2, "0")}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Redeem controls */}
                      <div className="space-y-4">
                        {staff.length > 0 && (
                          <div>
                            <label className="block text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] uppercase tracking-wider mb-1.5">Performing Stylist</label>
                            <select
                              value={staffId}
                              onChange={(e) => setStaffId(e.target.value)}
                              className="w-full h-9 px-3 bg-[#f9f9fd] border border-[#c8c5cb]/40 rounded-lg text-[13.5px] leading-[18px] text-[#1a1c1f] focus:outline-none focus:border-[#000000] transition-colors cursor-pointer"
                            >
                              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="block text-[11.5px] leading-4 tracking-[0.04em] font-medium text-[#5e5e67] uppercase mb-1.5">Session Notes</label>
                          <input
                            className="w-full h-9 px-3 bg-[#f9f9fd] border border-[#c8c5cb]/40 rounded-lg text-[13.5px] leading-[18px] text-[#1a1c1f] placeholder:text-[#5e5e67] focus:outline-none focus:border-[#000000]"
                            type="text"
                            placeholder="Optional"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2.5 pt-1">
                          <button
                            onClick={redeem}
                            disabled={redeeming || selected.sessionsLeft <= 0}
                            className="w-full h-10 rounded-lg font-medium text-[13.5px] leading-5 flex items-center justify-center gap-2 active:scale-[0.99] transition-all shadow-xs bg-[#000000] text-[#ffffff] hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-default"
                          >
                            <span className="material-symbols-outlined text-[18px]">confirmation_number</span>
                            <span>
                              {selected.sessionsLeft <= 0
                                ? "No Sessions Remaining"
                                : redeeming
                                  ? "Redeeming…"
                                  : `Redeem 1 Session (#${String(selected.sessionsUsed + 1).padStart(2, "0")})`}
                            </span>
                          </button>
                          <button
                            onClick={sendWhatsapp}
                            disabled={!selected.whatsapp}
                            className="w-full h-9 border border-[#c8c5cb]/50 text-[#5e5e67] hover:text-[#1a1c1f] bg-[#ffffff] rounded-lg font-medium text-[11.5px] flex items-center justify-center gap-2 hover:bg-[#eeedf1] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-default"
                          >
                            <span className="material-symbols-outlined text-[16px] text-emerald-600">chat</span>
                            <span>{selected.whatsapp ? "Send WhatsApp Balance Slip" : "No WhatsApp on File"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Audit trail */}
                      <div className="pt-4 border-t border-[#c8c5cb]/20 space-y-3">
                        <div className="flex items-center justify-between text-[11.5px] text-[#5e5e67] uppercase tracking-wider">
                          <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold">Audit Trail &amp; Previous Punches</span>
                          <span className="tabular-nums">{selectedHistory.length} entries</span>
                        </div>
                        {selectedHistory.length === 0 ? (
                          <p className="text-[12px] text-[#77767b] py-2">No redemptions recorded yet.</p>
                        ) : (
                          <div className="space-y-2 text-[12px]">
                            {selectedHistory.map((h) => (
                              <div key={h.id} className="flex items-start justify-between p-3 rounded-lg bg-[#f3f3f7]/60 border border-[#c8c5cb]/20">
                                <div className="flex flex-col">
                                  <span className="font-medium text-[#1a1c1f]">{h.staffName ?? "Unassigned"}{h.note ? ` · ${h.note}` : ""}</span>
                                  <span className="text-[#5e5e67] text-[11px] mt-0.5">{shortDate(h.usedOn)}</span>
                                </div>
                                <button
                                  onClick={() => undo(h.id)}
                                  disabled={undoingId === h.id}
                                  className="text-[#ba1a1a] hover:underline text-[11px] shrink-0 disabled:opacity-40"
                                >
                                  {undoingId === h.id ? "Undoing…" : "Undo"}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SalonSidebar } from "../salon-shell";
import { BookNextSheet, EditClientSheet, NewClientSheet, RedeemSheet } from "./client-panels";

export type ClientRow = {
  id: string;
  name: string;
  initials: string;
  kind: "person" | "company";
  status: string;
  phone: string;
  whatsapp: string;
  address: string;
  region: string;
  note: string;
  visits: number;
  lastOn: string | null;
  usualGapDays: number | null;
  lifetimeSpendCents: number | null;
  activePackages: {
    id: string;
    name: string;
    sessionsUsed: number;
    sessionsTotal: number;
    sessionsLeft: number;
    soldOn: string;
    expiresOn: string | null;
  }[];
  visitHistory: {
    id: string;
    date: string;
    time: string;
    service: string;
    staffName: string | null;
    amountCents: number | null;
  }[];
  primaryStylist: string | null;
  primaryStylistId: string | null;
  /** Her most recent completed visit: what "Book Next" starts from. */
  lastVisit: { service: string; startTime: string; minutes: number } | null;
  nextBooking: { dateLabel: string; timeLabel: string; service: string; staffName: string | null } | null;
  /** Her last five real payments. Empty for anyone but the owner. */
  recentPayments: { id: string; docNo: string; dateLabel: string; method: string; amountCents: number }[];
  searchText: string;
};

type SortKey = "recent" | "visits" | "name" | "spend";

function ringgit(cents: number): string {
  const whole = cents / 100;
  return `RM ${whole.toLocaleString("en-MY", { minimumFractionDigits: whole % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}
function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", month: "short", day: "2-digit" }).format(new Date(`${iso}T12:00:00+08:00`));
}
const METHOD_LABEL: Record<string, string> = { cash: "Cash", card: "Card", qr: "QR", transfer: "Transfer", ewallet: "E-wallet", credit: "Credit" };

const PAGE_SIZE = 25;

type Panel = "new" | "edit" | "book" | "redeem" | null;

export function ClientsClient({
  businessName,
  clients,
  canSeeMoney,
  locale,
  projectId,
  staff,
  initialSelectedId = null,
}: {
  businessName: string;
  clients: ClientRow[];
  canSeeMoney: boolean;
  locale: string;
  projectId: string;
  staff: { id: string; name: string }[];
  initialSelectedId?: string | null;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  // Set the moment a client is saved, until the refreshed list has her in it:
  // otherwise the folio would flash the first client in the list meanwhile.
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [activeSegment, setActiveSegment] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);

  const segments = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of clients) if (c.status) counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
    const packageCount = clients.filter((c) => c.activePackages.length > 0).length;
    const list: { key: string; label: string }[] = [{ key: "all", label: `All (${clients.length})` }];
    for (const [status, count] of counts) list.push({ key: `status:${status}`, label: `${status} (${count})` });
    if (packageCount > 0) list.push({ key: "packages", label: `Packages (${packageCount})` });
    return list;
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = clients.filter((c) => {
      if (activeSegment === "packages" && c.activePackages.length === 0) return false;
      if (activeSegment.startsWith("status:") && c.status !== activeSegment.slice(7)) return false;
      if (q && !c.searchText.includes(q)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "visits") return b.visits - a.visits;
      if (sort === "spend") return (b.lifetimeSpendCents ?? 0) - (a.lifetimeSpendCents ?? 0);
      // recent: most recently visited first, clients with no visits last.
      if (!a.lastOn && !b.lastOn) return 0;
      if (!a.lastOn) return 1;
      if (!b.lastOn) return -1;
      return b.lastOn.localeCompare(a.lastOn);
    });
    return list;
  }, [clients, activeSegment, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageClients = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  const found = clients.find((c) => c.id === selectedId);
  const opening = !found && justCreated !== null && justCreated === selectedId;
  const selected = found ?? (opening ? null : filtered[0] ?? null);
  const tags = useMemo(() => [...new Set(clients.map((c) => c.status).filter(Boolean))], [clients]);
  const canUsePass = (selected?.activePackages ?? []).some((p) => p.sessionsLeft > 0);

  // Scoped to the current page, not the whole filtered list -- a letter
  // button has to have a real row to jump to on the page it's shown on.
  const letters = useMemo(() => {
    const present = new Set(pageClients.map((c) => (/[A-Za-z]/.test(c.name[0]) ? c.name[0].toUpperCase() : "#")));
    return "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("").filter((l) => present.has(l));
  }, [pageClients]);

  // Which row is the first one of its starting letter, computed once as a
  // pure pass over pageClients rather than mutated during the render map.
  const firstOfLetterIds = useMemo(() => {
    const seen = new Set<string>();
    const ids = new Set<string>();
    for (const c of pageClients) {
      const letter = /[A-Za-z]/.test(c.name[0]) ? c.name[0].toUpperCase() : "#";
      if (!seen.has(letter)) {
        seen.add(letter);
        ids.add(c.id);
      }
    }
    return ids;
  }, [pageClients]);

  const jumpTo = (letter: string) => {
    document.getElementById(`client-row-${letter}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const exportCsv = () => {
    const header = ["Name", "Phone", "WhatsApp", "Status", "Visits", "Last Visit", "Lifetime Spend"];
    const lines = filtered.map((c) => [
      c.name,
      c.phone,
      c.whatsapp,
      c.status,
      String(c.visits),
      c.lastOn ?? "",
      c.lifetimeSpendCents != null ? (c.lifetimeSpendCents / 100).toFixed(2) : "",
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="bg-[#f9f9fd] text-[#1a1c1f] text-[14.5px] leading-[22px] tracking-[-0.005em] antialiased min-h-screen"
      style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
    >
      <SalonSidebar active="clients-and-profiles" businessName={businessName} subtitle="Operations" />
      <div className="pl-64 min-h-screen bg-[#f9f9fd]">
        <main className="w-full min-h-screen bg-[#f9f9fd]">
          <div className="flex flex-col w-full">
            <div className="px-8 py-5 flex flex-col gap-5 max-w-[1720px] mx-auto w-full">
              {/* Header */}
              <div className="flex flex-col gap-2.5 pb-3 border-b border-[#eeedf1]">
                <div className="flex items-center gap-2 text-[11.5px] font-mono text-[#77767b] tracking-wider uppercase">
                  <span>Operations</span>
                  <span>/</span>
                  <span>Client Directory</span>
                  <span>/</span>
                  <span className="text-[#000000] font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#000000] inline-block" />
                    {selected ? selected.name : "No client selected"}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-[20px] leading-7 tracking-[-0.015em] text-[#000000] font-semibold tracking-tight">Clients &amp; Folios</h1>
                    <span className="text-[11.5px] font-mono text-[#77767b] hidden md:inline-block">· {businessName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={exportCsv}
                      className="h-9 px-3 rounded-lg bg-[#ffffff] text-[#1a1c1f] text-[13.5px] leading-5 font-normal hover:bg-[#eeedf1] active:scale-[0.97] transition-colors flex items-center gap-2 shadow-sm border border-[#eeedf1]"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#5e5e67]">file_download</span>
                      <span>Export CSV</span>
                    </button>
                    <button
                      onClick={() => setPanel("new")}
                      className="h-9 px-3.5 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#1b1b1e] active:scale-[0.97] text-[13.5px] leading-5 font-medium transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      <span>New Client Folio</span>
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
                      <span className="material-symbols-outlined absolute left-3 text-[18px] text-[#77767b] pointer-events-none">search</span>
                      <input
                        className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#f3f3f7] text-[13.5px] text-[#1a1c1f] placeholder:text-[#77767b] focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#000000] transition-all border border-transparent focus:border-[#eeedf1]"
                        placeholder="Search name, phone, WhatsApp..."
                        type="text"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                      />
                    </div>

                    {/* Wraps instead of scrolling: at the common laptop widths
                        (1024-1300px) this list of 5 pills doesn't fit on one
                        line, and a hidden horizontal scrollbar reads as
                        broken, not as "more to see". */}
                    <div className="flex items-center gap-1.5 flex-wrap py-0.5 text-[11.5px] font-mono">
                      {segments.map((s) => (
                        <button
                          key={s.key}
                          onClick={() => {
                            setActiveSegment(s.key);
                            setPage(1);
                          }}
                          className={
                            "px-2.5 py-1 rounded-full shrink-0 transition-colors active:scale-[0.97] " +
                            (activeSegment === s.key
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
                        <select
                          value={sort}
                          onChange={(e) => setSort(e.target.value as SortKey)}
                          className="bg-[#f3f3f7] border border-[#eeedf1] rounded px-2 py-0.5 text-[11px] text-[#1a1c1f] font-medium focus:outline-none cursor-pointer"
                        >
                          <option value="recent">Recently Visited</option>
                          <option value="visits">Most Visits</option>
                          <option value="name">Name (A-Z)</option>
                          {canSeeMoney && <option value="spend">Highest Spend</option>}
                        </select>
                      </div>
                      <span className="text-[11px]">{filtered.length} match{filtered.length === 1 ? "" : "es"}</span>
                    </div>

                    {letters.length > 1 && (
                      <div className="flex items-center flex-wrap gap-0.5 text-[11px] font-mono font-medium text-[#77767b] pt-1.5 border-t border-[#eeedf1] select-none">
                        {letters.map((l) => (
                          <button
                            key={l}
                            onClick={() => jumpTo(l)}
                            className="h-6 min-w-6 px-1 rounded hover:text-[#000000] hover:bg-[#f3f3f7] cursor-pointer"
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Client stream */}
                  <div className="flex flex-col gap-2 max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
                    {pageClients.length === 0 && (
                      <div className="bg-[#ffffff] rounded-xl p-4 border border-[#eeedf1] shadow-sm text-center text-[13px] text-[#77767b]">
                        {clients.length === 0
                          ? "No customers set up yet."
                          : `No clients match ${search.trim() ? `"${search.trim()}"` : "this segment"}.`}
                      </div>
                    )}
                    {pageClients.map((c) => {
                      const letter = /[A-Za-z]/.test(c.name[0]) ? c.name[0].toUpperCase() : "#";
                      const active = c.id === selected?.id;
                      return (
                        <div
                          key={c.id}
                          id={firstOfLetterIds.has(c.id) ? `client-row-${letter}` : undefined}
                          onClick={() => setSelectedId(c.id)}
                          className={
                            "bg-[#ffffff] rounded-xl p-2 relative overflow-hidden transition-all shadow-sm cursor-pointer " +
                            (active ? "border-2 border-[#000000]" : "border border-[#eeedf1] hover:bg-[#f3f3f7]/60")
                          }
                        >
                          {active && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#000000]" />}
                          <div className={"flex items-start justify-between gap-2 " + (active ? "pl-1" : "")}>
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div
                                className={
                                  "w-9 h-9 rounded-full flex items-center justify-center text-[11.5px] font-semibold shrink-0 " +
                                  (active ? "bg-[#000000] text-[#ffffff] ring-2 ring-[#f9f9fd] shadow-sm" : "bg-[#e8e8ec] text-[#1a1c1f]")
                                }
                              >
                                {c.initials}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-[#1a1c1f] text-[14px] truncate">{c.name}</span>
                                  {c.status && (
                                    <span
                                      className={
                                        "text-[9px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider " +
                                        (active ? "bg-[#000000] text-[#ffffff] font-semibold" : "bg-[#f3f3f7] text-[#47464b] font-medium border border-[#eeedf1]")
                                      }
                                    >
                                      {c.status}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 font-mono text-[11.5px] text-[#77767b]">
                                  {c.phone ? (
                                    <span className="flex items-center gap-0.5">
                                      <span className="material-symbols-outlined text-[12px] text-[#5e5e67]">call</span>
                                      {c.phone}
                                    </span>
                                  ) : (
                                    <span className="text-[#c8c5cb]">No phone on file</span>
                                  )}
                                  {c.primaryStylist && (
                                    <>
                                      <span className="inline-block w-1 h-1 rounded-full bg-[#c8c5cb]" />
                                      <span className="text-[11.5px] text-[#47464b] font-medium">{c.primaryStylist}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono text-[10.5px] text-[#77767b]">{c.lastOn ? shortDate(c.lastOn) : "No visits"}</span>
                            </div>
                          </div>
                          <div className={"mt-2 pt-1 flex items-center justify-between text-[11.5px] border-t border-[#eeedf1] " + (active ? "pl-1" : "")}>
                            <span className="text-[11px] text-[#47464b] font-mono">
                              {c.visits} visit{c.visits === 1 ? "" : "s"}
                              {c.activePackages.length > 0 ? ` · ${c.activePackages[0].sessionsLeft}/${c.activePackages[0].sessionsTotal} sessions left` : ""}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination -- real, over the filtered list, not a fixed decoration */}
                  <div className="flex flex-col gap-2 p-2 bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm text-[11.5px] font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] text-[#47464b]">
                        {filtered.length > 0 ? (
                          <>
                            Showing <strong className="text-[#1a1c1f] font-semibold">{(pageClamped - 1) * PAGE_SIZE + 1}–{Math.min(pageClamped * PAGE_SIZE, filtered.length)}</strong> of {filtered.length}
                          </>
                        ) : (
                          "Showing 0 of 0"
                        )}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={pageClamped <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className="w-7 h-7 flex items-center justify-center rounded bg-[#f3f3f7] text-[#1a1c1f] disabled:opacity-40 disabled:cursor-default border border-[#eeedf1] hover:bg-[#eeedf1] active:scale-[0.97]"
                        >
                          <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                        </button>
                        <span className="px-2 text-[11.5px] text-[#1a1c1f] font-medium">
                          Page {pageClamped} / {totalPages}
                        </span>
                        <button
                          disabled={pageClamped >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          className="w-7 h-7 flex items-center justify-center rounded bg-[#f3f3f7] text-[#1a1c1f] disabled:opacity-40 disabled:cursor-default border border-[#eeedf1] hover:bg-[#eeedf1] active:scale-[0.97]"
                        >
                          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* RIGHT: Dossier */}
                <section aria-label="Dedicated Client Dossier" className="lg:col-span-7 xl:col-span-8 flex flex-col gap-5">
                  {!selected ? (
                    <div className="bg-[#ffffff] rounded-xl p-10 shadow-sm border border-[#c8c5cb]/30 text-center text-[13.5px] text-[#77767b]">
                      {opening ? "Opening her folio…" : "Select a client from the directory to see their folio."}
                    </div>
                  ) : (
                    <>
                      {/* Hero */}
                      <div className="bg-[#ffffff] rounded-xl p-5 flex flex-col gap-3 shadow-sm border border-[#c8c5cb]/30">
                        <div className="flex flex-col gap-4 pb-3 border-b border-[#eeedf1]">
                          <div className="flex items-start gap-4">
                            <div className="w-16 h-16 rounded-full bg-[#000000] text-[#ffffff] flex items-center justify-center text-xl leading-7 tracking-[-0.015em] font-semibold shrink-0 ring-4 ring-[#f3f3f7] shadow-sm">
                              {selected.initials}
                            </div>
                            <div className="flex flex-col justify-center">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-[22px] font-semibold text-[#1a1c1f] tracking-tight leading-none">{selected.name}</h2>
                                {selected.status && (
                                  <span className="px-2 py-0.5 rounded text-[10.5px] font-mono bg-[#000000] text-[#ffffff] font-semibold tracking-wider uppercase leading-none">
                                    {selected.status}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2.5 font-mono text-[12px] text-[#77767b] mt-2 flex-wrap">
                                {selected.phone && (
                                  <span className="text-[#47464b] font-medium flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[13px] text-[#5e5e67]">call</span> {selected.phone}
                                  </span>
                                )}
                                {selected.address && (
                                  <>
                                    <span>·</span>
                                    <span>{selected.address}{selected.region ? `, ${selected.region}` : ""}</span>
                                  </>
                                )}
                                {selected.primaryStylist && (
                                  <>
                                    <span>·</span>
                                    <span className="text-[#000000] font-semibold flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[13px]">content_cut</span> Usually with {selected.primaryStylist}
                                    </span>
                                  </>
                                )}
                              </div>
                              {selected.nextBooking && (
                                <div data-testid="next-booking" className="flex items-center gap-1.5 font-mono text-[12px] text-[#000000] font-semibold mt-1.5">
                                  <span className="material-symbols-outlined text-[13px]">event_upcoming</span>
                                  <span>
                                    Next: {selected.nextBooking.dateLabel} · {selected.nextBooking.timeLabel}
                                    {selected.nextBooking.service ? ` · ${selected.nextBooking.service}` : ""}
                                    {selected.nextBooking.staffName ? ` · ${selected.nextBooking.staffName}` : ""}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Book Next / Charge in Register are what she does most days,
                              so they stay labeled. WhatsApp and Edit Profile are
                              occasional, so they're icon-only here -- same action,
                              less visual weight, and the row doesn't wrap at
                              in-between widths anymore. */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => setPanel("book")}
                              className="h-8 px-3 rounded-lg bg-[#000000] hover:bg-[#1b1b1e] active:scale-[0.97] text-[#ffffff] text-[13px] font-medium transition-colors flex items-center gap-1.5 shadow-sm"
                            >
                              <span className="material-symbols-outlined text-[15px]">calendar_today</span>
                              <span>Book Next</span>
                            </button>
                            <Link
                              href={`/${locale}/salon-preview/register?client=${selected.id}`}
                              className="h-8 px-3 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] active:scale-[0.97] text-[#1a1c1f] text-[13px] font-medium transition-colors flex items-center gap-1.5 shadow-sm border border-[#eeedf1]"
                            >
                              <span className="material-symbols-outlined text-[15px] text-[#5e5e67]">point_of_sale</span>
                              <span>Charge in Register</span>
                            </Link>
                            {selected.whatsapp ? (
                              <a
                                href={`https://wa.me/${selected.whatsapp.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="WhatsApp"
                                title="WhatsApp"
                                className="h-8 w-8 rounded-lg bg-[#f3f3f7] hover:bg-[#eeedf1] text-[#1a1c1f] transition-colors flex items-center justify-center shadow-sm border border-[#eeedf1]"
                              >
                                <span className="material-symbols-outlined text-[16px] text-[#5e5e67]">chat</span>
                              </a>
                            ) : null}
                            <button
                              onClick={() => setPanel("edit")}
                              aria-label="Edit Profile"
                              title="Edit Profile"
                              className="h-8 w-8 rounded-lg bg-[#ffffff] hover:bg-[#eeedf1] active:scale-[0.97] text-[#1a1c1f] transition-colors flex items-center justify-center shadow-sm border border-[#eeedf1]"
                            >
                              <span className="material-symbols-outlined text-[16px] text-[#5e5e67]">edit</span>
                            </button>
                          </div>
                        </div>

                        {/* Stat tiles */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 py-1">
                          {[
                            canSeeMoney
                              ? { label: "Lifetime Spend", value: ringgit(selected.lifetimeSpendCents ?? 0), note: "" }
                              : null,
                            { label: "Completed Visits", value: `${selected.visits} Visit${selected.visits === 1 ? "" : "s"}`, note: "" },
                            {
                              label: "Active Passes",
                              value: selected.activePackages.length ? `${selected.activePackages.length} Prepaid Plan${selected.activePackages.length === 1 ? "" : "s"}` : "None",
                              note: selected.activePackages[0] ? `${selected.activePackages[0].sessionsLeft} of ${selected.activePackages[0].sessionsTotal} remaining` : "",
                              primary: selected.activePackages.length > 0,
                            },
                            {
                              label: "Avg Return Cycle",
                              value: selected.usualGapDays ? `${(selected.usualGapDays / 7).toFixed(1)} Weeks` : "—",
                              note: selected.usualGapDays ? "" : "Not enough visits yet",
                            },
                          ]
                            .filter((t): t is NonNullable<typeof t> => t !== null)
                            .map((t) => (
                              <div key={t.label} className="flex flex-col justify-between p-2.5 rounded-lg bg-[#f3f3f7]/70 border border-[#eeedf1] min-h-[78px]">
                                <span className="text-[10.5px] font-mono text-[#77767b] uppercase tracking-wider">{t.label}</span>
                                <span className={"font-mono font-semibold text-[17px] mt-0.5 " + ("primary" in t && t.primary ? "text-[#000000]" : "text-[#1a1c1f]")}>{t.value}</span>
                                <span className="text-[10px] font-mono text-[#77767b] mt-0.5">{t.note}</span>
                              </div>
                            ))}
                        </div>

                        {selected.note && (
                          <div className="p-3.5 rounded-lg bg-[#f3f3f7] border border-[#eeedf1] flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-[#000000] text-[#ffffff] flex items-center justify-center shrink-0 shadow-sm">
                              <span className="material-symbols-outlined text-[18px]">sticky_note_2</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[10.5px] font-mono uppercase text-[#77767b] tracking-wider">Notes on File</span>
                              <span className="font-medium text-[#1a1c1f] text-[14px] mt-0.5 whitespace-pre-wrap">{selected.note}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Active Prepaid Packages */}
                      <div className="bg-[#ffffff] rounded-xl p-5 flex flex-col gap-3 shadow-sm border border-[#c8c5cb]/30">
                        <div className="flex items-center justify-between pb-1 border-b border-[#eeedf1]">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Active Prepaid Packages</h3>
                            <span className="text-[11.5px] font-mono px-2 py-0.5 rounded bg-[#eeedf1] text-[#1a1c1f] font-semibold">
                              {selected.activePackages.length} Active Plan{selected.activePackages.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          {canUsePass && (
                            <button
                              onClick={() => setPanel("redeem")}
                              className="h-8 px-3 rounded-lg bg-[#000000] text-[#ffffff] hover:bg-[#1b1b1e] active:scale-[0.97] text-[12.5px] font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                              <span className="material-symbols-outlined text-[15px]">add</span>
                              <span>+ Redeem Session</span>
                            </button>
                          )}
                        </div>
                        {selected.activePackages.length === 0 ? (
                          <p className="text-[13.5px] text-[#77767b] py-4 text-center">No active prepaid packages for {selected.name}.</p>
                        ) : (
                          selected.activePackages.map((pkg) => (
                            <div key={pkg.id} className="p-3.5 rounded-lg bg-[#f3f3f7] border border-[#eeedf1] flex flex-col gap-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-[#1a1c1f] text-[15px]">{pkg.name}</span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#e2e2e6] text-[#1a1c1f] font-semibold">
                                      {pkg.sessionsTotal} SESSIONS PASS
                                    </span>
                                  </div>
                                  <span className="text-[11.5px] text-[#77767b] font-mono mt-0.5">
                                    Purchased {shortDate(pkg.soldOn)}{pkg.expiresOn ? ` · Valid through ${shortDate(pkg.expiresOn)}` : ""}
                                  </span>
                                </div>
                                <div className="flex items-baseline gap-1.5 text-right">
                                  <span className="font-mono text-[20px] font-semibold text-[#000000] leading-none">{pkg.sessionsLeft}</span>
                                  <span className="font-mono text-[12px] text-[#77767b] uppercase">/ {pkg.sessionsTotal} Sessions Remaining</span>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1.5 pt-1">
                                <div className="w-full h-2 rounded-full bg-[#e2e2e6] overflow-hidden">
                                  <div className="h-full bg-[#000000] rounded-full" style={{ width: `${Math.round((pkg.sessionsUsed / pkg.sessionsTotal) * 100)}%` }} />
                                </div>
                                <div className="text-[11.5px] font-mono text-[#77767b]">{pkg.sessionsUsed} Sessions Redeemed</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Visit & Bill History */}
                      <div className="bg-[#ffffff] rounded-xl p-5 flex flex-col gap-3 shadow-sm border border-[#c8c5cb]/30">
                        <div className="flex items-center justify-between pb-1 border-b border-[#eeedf1]">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Visit History</h3>
                            <span className="text-[11.5px] font-mono text-[#77767b]">
                              ({selected.visitHistory.length} Completed Visit{selected.visitHistory.length === 1 ? "" : "s"} Recorded)
                            </span>
                          </div>
                        </div>
                        {selected.visitHistory.length === 0 ? (
                          <p className="text-[13.5px] text-[#77767b] py-4 text-center">No completed visits recorded for {selected.name} yet.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-[13.5px] leading-5">
                              <thead className="text-[11px] font-mono uppercase text-[#77767b] border-b border-[#eeedf1]">
                                <tr>
                                  <th className="py-2 px-3">Date</th>
                                  <th className="py-2 px-3">Service</th>
                                  <th className="py-2 px-3">Stylist</th>
                                  <th className="py-2 px-3 text-right font-mono">Total (RM)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#eeedf1]">
                                {selected.visitHistory.map((v) => (
                                  <tr key={v.id} className="hover:bg-[#f3f3f7]/40 transition-colors">
                                    <td className="py-3 px-3 align-top font-mono text-[12px] font-semibold text-[#1a1c1f]">
                                      <div>{v.date}</div>
                                      <span className="text-[10px] text-[#77767b] font-normal">{v.time}</span>
                                    </td>
                                    <td className="py-3 px-3 align-top">
                                      <span className="font-medium text-[#1a1c1f] text-[13.5px]">{v.service}</span>
                                    </td>
                                    <td className="py-3 px-3 align-top font-mono text-[12px] text-[#47464b]">{v.staffName ?? "—"}</td>
                                    <td className="py-3 px-3 align-top text-right font-mono font-semibold text-[#1a1c1f] text-[14px]">
                                      {v.amountCents != null ? ringgit(v.amountCents) : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Recent Payments -- her real last five, owner only (it is her money) */}
                      {canSeeMoney && (
                        <div className="bg-[#ffffff] rounded-xl p-5 flex flex-col gap-3 shadow-sm border border-[#c8c5cb]/30">
                          <div className="flex items-center justify-between pb-1 border-b border-[#eeedf1]">
                            <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Recent Payments</h3>
                            <Link
                              href={`/${locale}/salon-preview/invoices?client=${selected.id}`}
                              className="text-[11.5px] font-mono text-[#000000] hover:underline flex items-center gap-1 font-medium"
                            >
                              <span>View all invoices</span>
                              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                            </Link>
                          </div>
                          {selected.recentPayments.length === 0 ? (
                            <p className="text-[13.5px] text-[#77767b] py-4 text-center">No payments recorded for {selected.name} yet.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-[13.5px] leading-5">
                                <thead className="text-[11px] font-mono uppercase text-[#77767b] border-b border-[#eeedf1]">
                                  <tr>
                                    <th className="py-2 px-3">Date</th>
                                    <th className="py-2 px-3">Invoice</th>
                                    <th className="py-2 px-3">Method</th>
                                    <th className="py-2 px-3 text-right font-mono">Amount (RM)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#eeedf1]">
                                  {selected.recentPayments.map((p) => (
                                    <tr key={p.id} data-testid="payment-row" className="hover:bg-[#f3f3f7]/40 transition-colors">
                                      <td className="py-3 px-3 font-mono text-[12px] text-[#1a1c1f]">{p.dateLabel}</td>
                                      <td className="py-3 px-3 font-mono text-[12px] text-[#47464b]">{p.docNo || "—"}</td>
                                      <td className="py-3 px-3 text-[12.5px] text-[#47464b]">{METHOD_LABEL[p.method] ?? (p.method || "—")}</td>
                                      <td className="py-3 px-3 text-right font-mono font-semibold text-[#1a1c1f] text-[14px]">{ringgit(p.amountCents)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>

      {panel === "new" && (
        <NewClientSheet
          projectId={projectId}
          clients={clients}
          onClose={() => setPanel(null)}
          onOpen={(id) => {
            setPanel(null);
            setSelectedId(id);
          }}
          onCreated={(id) => {
            // Clear whatever filter would hide her, then land on her folio.
            setSearch("");
            setActiveSegment("all");
            setPage(1);
            setJustCreated(id);
            setSelectedId(id);
          }}
        />
      )}
      {panel === "edit" && selected && <EditClientSheet client={selected} tags={tags} onClose={() => setPanel(null)} />}
      {panel === "book" && selected && <BookNextSheet projectId={projectId} client={selected} staff={staff} onClose={() => setPanel(null)} />}
      {panel === "redeem" && selected && <RedeemSheet client={selected} staff={staff} onClose={() => setPanel(null)} />}
    </div>
  );
}

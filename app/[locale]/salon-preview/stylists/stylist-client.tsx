"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { SalonSidebar } from "../salon-shell";
import { TierEditor } from "./tier-editor";

export type CommissionTier = {
  id: string;
  fromCents: number;
  toCents: number | null;
  percent: number;
  current: boolean;
};

export type StylistProfile = {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  status: string;
  note: string;
  createdAt: string;
  isOnFloor: boolean;
  guestsServedThisMonth: number;
  avgTicketCents: number;
  earnedCentsThisMonth: number | null;
  commissionCentsThisMonth: number | null;
  commissionTiers: CommissionTier[];
  recentShifts: { clockInAt: string; clockOutAt: string | null }[];
  lastModified: { at: string; by: string | null; viaAi: boolean } | null;
};

function ringgit(cents: number): string {
  const whole = cents / 100;
  return `RM ${whole.toLocaleString("en-MY", { minimumFractionDigits: whole % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}
function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(iso));
}
function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}

export function StylistClient({
  businessName,
  roster,
  selectedId,
  profile,
  canSeeMoney,
}: {
  businessName: string;
  roster: { id: string; name: string }[];
  selectedId: string | null;
  profile: StylistProfile | null;
  canSeeMoney: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    name: profile?.name ?? "",
    phone: profile?.phone ?? "",
    whatsapp: profile?.whatsapp ?? "",
    email: profile?.email ?? "",
    status: profile?.status ?? "",
    note: profile?.note ?? "",
  }));
  const [dirty, setDirty] = useState(false);
  const [editingTiers, setEditingTiers] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const goTo = (id: string) => {
    router.push(`?staff=${id}`);
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("update_directory_entry", {
        in_id: profile.id,
        in_name: form.name,
        in_phone: form.phone,
        in_whatsapp: form.whatsapp,
        in_email: form.email,
        in_status: form.status,
        in_note: form.note,
      });
      if (error) {
        alert(`Couldn't save: ${error.message}`);
        return;
      }
      setDirty(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (!profile) return;
    setForm({
      name: profile.name, phone: profile.phone, whatsapp: profile.whatsapp,
      email: profile.email, status: profile.status, note: profile.note,
    });
    setDirty(false);
  };

  const archive = async () => {
    if (!profile) return;
    if (!confirm(`Archive ${profile.name}? This tucks them off the active roster without deleting their history -- you can bring them back later.`)) return;
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc("set_directory_archived", { in_id: profile.id, in_archived: true });
    if (error) {
      alert(`Couldn't archive: ${error.message}`);
      return;
    }
    const next = roster.find((r) => r.id !== profile.id);
    router.push(next ? `?staff=${next.id}` : "?");
    router.refresh();
  };

  return (
    <div
      className="bg-[#f9f9fd] text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] antialiased min-h-screen"
      style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
    >
      <SalonSidebar active="stylists-and-staff" businessName={businessName} subtitle="Operations" />
      <div className="pl-64 min-h-screen bg-[#f9f9fd]">
        <main className="w-full pt-0 bg-[#f9f9fd] px-8 pb-5">
          <div className="flex flex-col w-full">
            {/* Breadcrumb & Roster Picker */}
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 gap-2">
              <nav className="flex items-center gap-1 text-[#5e5e67] text-[11.5px] leading-4 tracking-[0.04em] font-medium tracking-wider uppercase">
                <span>Operations</span>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <span>Stylist Directory</span>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <span className="text-[#1a1c1f]">{profile ? profile.name : "No staff yet"}</span>
              </nav>
              {roster.length > 1 && (
                <div className="flex items-center gap-2 self-start md:self-auto">
                  <span className="text-[11.5px] text-[#5e5e67]">Viewing:</span>
                  <select
                    value={selectedId ?? ""}
                    onChange={(e) => goTo(e.target.value)}
                    className="h-8 px-2 rounded-lg bg-[#ffffff] border border-[#c8c5cb]/40 text-[13px] focus:outline-none cursor-pointer"
                  >
                    {roster.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {profile && (
                <div className="flex items-center gap-2 self-start md:self-auto">
                  <span
                    className={
                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase " +
                      (profile.isOnFloor ? "bg-[#eeedf1] text-[#1a1c1f]" : "bg-[#f3f3f7] text-[#5e5e67]")
                    }
                  >
                    <span className={"w-1.5 h-1.5 rounded-full " + (profile.isOnFloor ? "bg-[#1a9a4d]" : "bg-[#c8c5cb]")} />
                    {profile.isOnFloor ? "Clocked In" : "Not Clocked In"}
                  </span>
                  <span className="text-[#5e5e67] text-[11.5px] leading-4 tracking-[0.04em] font-medium">· {businessName}</span>
                </div>
              )}
            </div>

            {!profile ? (
              <div className="bg-[#ffffff] rounded-xl p-10 border border-[#c8c5cb]/30 shadow-sm text-center text-[13.5px] text-[#77767b]">
                No staff members set up yet.
              </div>
            ) : (
              <>
                {/* Header Action Banner */}
                <div className="bg-[#ffffff] rounded-xl p-5 mb-5 border border-[#c8c5cb]/30 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold text-[#1a1c1f] tracking-tight">
                      Edit Stylist Profile &amp; Commission Tier
                    </h1>
                    <p className="text-[13.5px] leading-5 text-[#5e5e67] max-w-3xl">
                      Contact details, recent shifts, and commission bracket for this stylist.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      disabled={!dirty}
                      onClick={discard}
                      className="px-5 py-1.5 rounded-lg bg-[#eeedf1] hover:bg-[#e8e8ec] active:scale-[0.97] disabled:opacity-40 disabled:cursor-default text-[#1a1c1f] text-[13.5px] leading-5 transition-colors"
                    >
                      Discard Changes
                    </button>
                    <button
                      disabled={!dirty || saving}
                      onClick={save}
                      className="px-5 py-1.5 rounded-lg bg-[#000000] text-[#ffffff] disabled:opacity-40 disabled:cursor-default text-[13.5px] leading-5 font-medium inline-flex items-center gap-1.5 shadow-sm hover:opacity-90 active:scale-[0.99] transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">check</span>
                      {saving ? "Saving…" : "Save Stylist Settings"}
                    </button>
                  </div>
                </div>

                {/* Main 2/3 and 1/3 Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* LEFT 8 COLUMNS */}
                  <div className="lg:col-span-8 flex flex-col gap-5">
                    {/* Section 1: Basic Identity & Contact */}
                    <section className="bg-[#ffffff] rounded-xl p-5 border border-[#c8c5cb]/30 shadow-sm">
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#eeedf1]">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[#eeedf1] flex items-center justify-center text-[#1a1c1f]">
                            <span className="material-symbols-outlined text-[18px]">badge</span>
                          </div>
                          <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Basic Identity &amp; Contact</h2>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 p-3 bg-[#f3f3f7] rounded-lg mb-5">
                        <div className="w-16 h-16 rounded-xl bg-[#000000] text-[#ffffff] flex items-center justify-center text-xl font-semibold shrink-0 shadow-sm">
                          {initialsOf(profile.name)}
                        </div>
                        <p className="text-[13px] text-[#5e5e67]">No photo uploads are wired up for stylists yet -- shown with initials instead.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">Full Name</label>
                          <input
                            className="w-full h-9 px-2 rounded-lg bg-[#f3f3f7] text-[#1a1c1f] text-[14.5px] focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#000000] transition-all"
                            type="text" value={form.name} onChange={(e) => set("name", e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">Employment / Roster Status</label>
                          <input
                            className="w-full h-9 px-2 rounded-lg bg-[#f3f3f7] text-[#1a1c1f] text-[14.5px] focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#000000] transition-all"
                            type="text" placeholder="e.g. Full-time, On Leave..." value={form.status} onChange={(e) => set("status", e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">Phone</label>
                          <input
                            className="w-full h-9 px-2 rounded-lg bg-[#f3f3f7] text-[#1a1c1f] text-[13.5px] focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#000000] transition-all"
                            type="text" value={form.phone} onChange={(e) => set("phone", e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">WhatsApp</label>
                          <input
                            className="w-full h-9 px-2 rounded-lg bg-[#f3f3f7] text-[#1a1c1f] text-[13.5px] focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#000000] transition-all"
                            type="text" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1 md:col-span-2">
                          <label className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">Work Email</label>
                          <input
                            className="w-full h-9 px-2 rounded-lg bg-[#f3f3f7] text-[#1a1c1f] text-[14.5px] focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#000000] transition-all"
                            type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-[#eeedf1] flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">Notes</label>
                          <span className="text-[11.5px] text-[#5e5e67]">Specialties, standing arrangements, anything worth remembering</span>
                        </div>
                        <textarea
                          className="w-full min-h-[72px] p-2 rounded-lg bg-[#f3f3f7] text-[#1a1c1f] text-[13.5px] focus:outline-none focus:bg-[#ffffff] focus:ring-1 focus:ring-[#000000] transition-all resize-y"
                          value={form.note} onChange={(e) => set("note", e.target.value)}
                        />
                      </div>
                    </section>

                    {/* Section 2: Recent Shifts */}
                    <section className="bg-[#ffffff] rounded-xl p-5 border border-[#c8c5cb]/30 shadow-sm">
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#eeedf1]">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[#eeedf1] flex items-center justify-center text-[#1a1c1f]">
                            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                          </div>
                          <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Recent Shifts</h2>
                        </div>
                        <span className="text-[11.5px] text-[#5e5e67]">Last {profile.recentShifts.length || 0} clock-ins</span>
                      </div>

                      {profile.recentShifts.length === 0 ? (
                        <p className="text-[13.5px] text-[#77767b] py-6 text-center">
                          No clock-ins recorded for {profile.name} yet.
                        </p>
                      ) : (
                        <div className="overflow-hidden rounded-lg bg-[#f3f3f7]">
                          <div className="grid grid-cols-12 px-3 py-2 text-[#5e5e67] text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase">
                            <div className="col-span-5">Clocked In</div>
                            <div className="col-span-5">Clocked Out</div>
                            <div className="col-span-2 text-right">Hours</div>
                          </div>
                          <div className="flex flex-col bg-[#ffffff]">
                            {profile.recentShifts.map((sh, i) => {
                              const hours = sh.clockOutAt
                                ? ((new Date(sh.clockOutAt).getTime() - new Date(sh.clockInAt).getTime()) / 3600000).toFixed(1)
                                : null;
                              return (
                                <div key={i} className="grid grid-cols-12 items-center px-3 py-2.5 border-t border-[#eeedf1]">
                                  <div className="col-span-5 text-[13px] text-[#1a1c1f]">{fmtDateTime(sh.clockInAt)}</div>
                                  <div className="col-span-5 text-[13px] text-[#1a1c1f]">
                                    {sh.clockOutAt ? fmtDateTime(sh.clockOutAt) : <span className="text-[#1a9a4d] font-medium">Still on shift</span>}
                                  </div>
                                  <div className="col-span-2 text-right text-[13px] font-medium text-[#1a1c1f]">{hours ?? "—"}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </section>

                    {/* Section 3: Commission Tiers */}
                    <section className="bg-[#ffffff] rounded-xl p-5 border border-[#c8c5cb]/30 shadow-sm">
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#eeedf1]">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[#eeedf1] flex items-center justify-center text-[#1a1c1f]">
                            <span className="material-symbols-outlined text-[18px]">payments</span>
                          </div>
                          <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Commission Tiers</h2>
                        </div>
                        {/* Setting a rate is money, so it is the owner's (set_commission_tiers asks sees_money). */}
                        {canSeeMoney && !editingTiers && (
                          <button
                            onClick={() => setEditingTiers(true)}
                            className="px-2 py-1 rounded bg-[#eeedf1] hover:bg-[#e8e8ec] active:scale-[0.97] text-[#1a1c1f] text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase tracking-wider transition-colors"
                          >
                            Edit Brackets
                          </button>
                        )}
                      </div>

                      {editingTiers ? (
                        <TierEditor
                          key={profile.id}
                          partyId={profile.id}
                          saved={profile.commissionTiers}
                          earnedCents={profile.earnedCentsThisMonth}
                          onClose={() => setEditingTiers(false)}
                        />
                      ) : profile.commissionTiers.length === 0 ? (
                        <p className="text-[13.5px] text-[#77767b] py-6 text-center">No commission brackets set for {profile.name} yet.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {profile.commissionTiers.map((t, i) => (
                            <div key={t.id} className={"flex items-center justify-between p-2 rounded-lg relative " + (t.current ? "bg-[#eeedf1]" : "bg-[#f3f3f7]")}>
                              {t.current && <div className="absolute -left-1 top-2 bottom-2 w-1 rounded-full bg-[#000000]" />}
                              <div className="flex items-center gap-2">
                                <span className={"w-6 h-6 rounded flex items-center justify-center text-[13.5px] font-medium " + (t.current ? "bg-[#000000] text-[#ffffff]" : "bg-[#eeedf1] text-[#1a1c1f]")}>
                                  T{i + 1}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[14.5px] font-medium text-[#1a1c1f]">Tier {i + 1}</span>
                                    {t.current && canSeeMoney && (
                                      <span className="px-1.5 py-0.5 rounded bg-[#e2e2e6] text-[#1a1c1f] text-[11.5px] uppercase">Current Run-rate</span>
                                    )}
                                  </div>
                                  <p className="text-[13px] text-[#5e5e67]">
                                    {ringgit(t.fromCents)} {t.toCents != null ? `– ${ringgit(t.toCents)}` : "+"}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-base font-medium text-[#1a1c1f]">{t.percent}%</span>
                                <p className="text-[11.5px] text-[#5e5e67] uppercase">Payout Split</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>

                  {/* RIGHT 4 COLUMNS */}
                  <div className="lg:col-span-4 flex flex-col gap-5">
                    {/* Performance Snapshot */}
                    <div className="bg-[#ffffff] rounded-xl p-5 border border-[#c8c5cb]/30 shadow-sm">
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#eeedf1]">
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[18px] text-[#1a1c1f]">monitoring</span>
                          <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Performance Snapshot</h3>
                        </div>
                        <span className="text-[13px] text-[#5e5e67] uppercase">This Month</span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {canSeeMoney && profile.commissionCentsThisMonth != null && (
                          <div className="p-3 rounded-lg bg-[#f3f3f7] flex flex-col">
                            <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">Commission This Month</span>
                            <span className="text-[30px] leading-9 font-semibold text-[#1a1c1f] mt-1">{ringgit(profile.commissionCentsThisMonth)}</span>
                            <span className="text-[11.5px] text-[#5e5e67] mt-1">On {ringgit(profile.earnedCentsThisMonth ?? 0)} of attributed service revenue</span>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 rounded-lg bg-[#f3f3f7]">
                            <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">Guests Served</span>
                            <p className="text-base font-medium text-[#1a1c1f] mt-1">{profile.guestsServedThisMonth}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-[#f3f3f7]">
                            <span className="text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]">Avg Ticket Size</span>
                            <p className="text-base font-medium text-[#1a1c1f] mt-1">{profile.avgTicketCents ? ringgit(profile.avgTicketCents) : "—"}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Audit & Lifecycle */}
                    <div className="bg-[#ffffff] rounded-xl p-5 border border-[#c8c5cb]/30 shadow-sm">
                      <div className="flex items-center gap-1 pb-3 mb-3 border-b border-[#eeedf1]">
                        <span className="material-symbols-outlined text-[18px] text-[#5e5e67]">history</span>
                        <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Audit &amp; Lifecycle</h3>
                      </div>
                      <div className="flex flex-col gap-2 text-[11.5px] leading-4 tracking-[0.04em] font-medium">
                        <div className="flex items-center justify-between">
                          <span className="text-[#5e5e67] uppercase">Last Modified</span>
                          <span className="font-medium text-[#1a1c1f]">{profile.lastModified ? fmtDateTime(profile.lastModified.at) : "Never"}</span>
                        </div>
                        {profile.lastModified && (
                          <div className="flex items-center justify-between">
                            <span className="text-[#5e5e67] uppercase">Modified By</span>
                            <span className="font-medium text-[#1a1c1f]">
                              {profile.lastModified.viaAi ? "AI Assistant" : profile.lastModified.by || "—"}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-[#5e5e67] uppercase">Added to Roster</span>
                          <span className="font-medium text-[#1a1c1f]">{fmtDate(profile.createdAt)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 mt-1 border-t border-[#eeedf1]">
                          <button onClick={archive} className="text-[#ba1a1a] hover:underline active:scale-[0.97] uppercase tracking-wider transition-colors">
                            Archive Stylist
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

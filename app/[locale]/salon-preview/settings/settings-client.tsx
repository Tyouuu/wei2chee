"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { SalonSidebar } from "../salon-shell";
import { FIELD, LABEL, sentence } from "../side-panel";
import { BranchesTab, TeamTab, type BranchRow, type MemberRow } from "./settings-people";

export type { BranchRow, MemberRow } from "./settings-people";

/**
 * Tenant Settings (Task 415 item 3): the owner's own decisions about the shop.
 * See settings/page.tsx for what is real, what the design had that this does not
 * draw, and why.
 *
 * Two kinds of thing live here and they behave differently, on purpose:
 *   - FIELDS (General, Booking & Loyalty): you change them, and Save Configuration
 *     writes only what changed, each through its own database call. A failure in one
 *     does not undo the others, and says which one failed.
 *   - LISTS (Branch Locations, Team & Access): each row has its own button that acts
 *     at once. Adding a person is not a draft.
 */

export type SettingsValues = {
  businessName: string;
  ownerName: string;
  siteSlug: string;
  sitePublished: boolean;
  keepsBookings: boolean;
  keepsStock: boolean;
  keepsStaff: boolean;
  noShowAfter: string;
  depositRm: string;
  stampsNeeded: string;
};

type Tab = "general" | "branches" | "team" | "rules";
type Errors = Partial<Record<"name" | "slug" | "pages" | "booking" | "loyalty", string>>;

const CARD = "bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm";

/** Words for the codes set_my_site_slug returns instead of raising. */
const SLUG_SENTENCES: Record<string, string> = {
  empty: "Type an address for the website.",
  shape: "Use 3 to 40 letters, numbers or hyphens, with no hyphen at either end.",
  reserved: "That address is reserved. Pick another.",
  taken: "Someone else already has that address.",
  no_project: "This account has no shop to put an address on.",
};

/** The three pages a salon can switch on and off, and the sidebar rows each one drives. */
const PAGE_SWITCHES: { key: "keepsBookings" | "keepsStock" | "keepsStaff"; pageKey: string; label: string; drives: string }[] = [
  { key: "keepsBookings", pageKey: "bookings", label: "Appointments & schedule", drives: "Drives Appointments & Flow and Packages & Prepaid." },
  { key: "keepsStock", pageKey: "inventory", label: "Salon stock & orders", drives: "Drives Salon Stock & Orders: shelves, reorder lines and purchase orders." },
  { key: "keepsStaff", pageKey: "staff", label: "Stylists & staff", drives: "Drives Stylists & Staff: commission, clock in and clock out." },
];

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={"relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 " + (checked ? "bg-[#000000]" : "bg-[#c8c5cb]")}
    >
      <span className={"absolute top-0.5 h-4 w-4 rounded-full bg-[#ffffff] shadow-sm transition-all " + (checked ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

function FieldError({ text, testId }: { text?: string; testId: string }) {
  if (!text) return null;
  return <p role="alert" data-testid={testId} className="text-[12.5px] font-medium text-[#ba1a1a]">{text}</p>;
}

export function SettingsClient({
  owner,
  projectId,
  ownerEmail,
  values,
  branches,
  members,
  siteBase,
}: {
  owner: boolean;
  projectId: string;
  ownerEmail: string;
  values: SettingsValues | null;
  branches: BranchRow[];
  members: MemberRow[];
  siteBase: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("general");
  // `base` is what is saved; `form` is what is on screen. They differ = unsaved.
  const [base, setBase] = useState<SettingsValues | null>(values);
  const [form, setForm] = useState<SettingsValues | null>(values);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSlip, setShowSlip] = useState(false);

  const dirty = useMemo(() => !!base && !!form && JSON.stringify(base) !== JSON.stringify(form), [base, form]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(t);
  }, [saved]);

  const set = <K extends keyof SettingsValues>(k: K, v: SettingsValues[K]) => {
    setForm((f) => (f ? { ...f, [k]: v } : f));
    setSaved(false);
  };

  // Save Configuration writes only what changed. Each group is its own call and its
  // own success: a rule that fails validation must not stop the name being saved.
  async function save() {
    if (!form || !base || saving || !dirty) return;
    const next: Errors = {};
    const supabase = createBrowserSupabaseClient();
    const done: Partial<SettingsValues> = {};
    // Saved values the screen must learn about that he did not type (see the name save).
    const baseOnly: Partial<SettingsValues> = {};

    // What we can check here before asking: the sentence is friendlier than a constraint's.
    const nameChanged = form.businessName !== base.businessName || form.ownerName !== base.ownerName;
    if (nameChanged && !form.businessName.trim()) next.name = "Give the store a name.";

    const rulesChanged = form.noShowAfter !== base.noShowAfter || form.depositRm !== base.depositRm;
    let depositCents: number | null = null;
    let afterN: number | null = null;
    if (rulesChanged) {
      const a = form.noShowAfter.trim();
      const d = form.depositRm.trim();
      if ((a === "") !== (d === "")) next.booking = "Set both numbers, or leave both empty.";
      else if (a !== "") {
        afterN = Number(a);
        const rm = Number(d);
        if (!Number.isInteger(afterN) || afterN < 1 || afterN > 20) next.booking = "No-shows must be a whole number from 1 to 20.";
        else if (!Number.isFinite(rm) || rm < 0) next.booking = "The deposit must be a number of ringgit, zero or more.";
        else depositCents = Math.round(rm * 100);
      }
    }
    const stampsChanged = form.stampsNeeded !== base.stampsNeeded;
    let stamps: number | null = null;
    if (stampsChanged && form.stampsNeeded.trim() !== "") {
      stamps = Number(form.stampsNeeded);
      if (!Number.isInteger(stamps) || stamps < 1 || stamps > 50) next.loyalty = "Stamps must be a whole number from 1 to 50.";
    }
    if (next.name || next.booking || next.loyalty) {
      setErrors(next);
      // Anything that is fine still saves below; only the invalid groups are held back.
    }

    setSaving(true);
    setSaved(false);
    try {
      if (nameChanged && !next.name) {
        const { error } = await supabase.rpc("update_business_identity", {
          new_business_name: form.businessName,
          new_owner_name: form.ownerName,
        });
        if (error) next.name = sentence(error.message);
        else {
          Object.assign(done, { businessName: form.businessName.trim(), ownerName: form.ownerName.trim() });
          // Saving the name can also move the site address: while the address is one we
          // made up (not chosen by him, site not published) the database improves it to
          // match the new name. Read it back so the field shows what is really saved,
          // instead of the old guess he would then "save" over the better one.
          const { data } = await supabase.from("projects").select("site_slug").eq("id", projectId).maybeSingle();
          const fresh = (data as { site_slug?: string | null } | null)?.site_slug ?? "";
          if (fresh !== base.siteSlug) {
            if (form.siteSlug === base.siteSlug) done.siteSlug = fresh;
            else baseOnly.siteSlug = fresh;
          }
        }
      }

      if (form.siteSlug !== base.siteSlug) {
        const { data, error } = await supabase.rpc("set_my_site_slug", { new_slug: form.siteSlug });
        const code = typeof data === "string" ? data : "";
        if (error) next.slug = sentence(error.message);
        else if (code !== "ok") next.slug = SLUG_SENTENCES[code] ?? "That address could not be saved.";
        else Object.assign(done, { siteSlug: form.siteSlug.trim().toLowerCase() });
      }

      // Pages: only the ones whose switch moved.
      const pageFailures: string[] = [];
      for (const p of PAGE_SWITCHES) {
        if (form[p.key] === base[p.key]) continue;
        const { error } = form[p.key]
          ? await supabase.rpc("add_project_page", { requested_key: p.pageKey, new_title: "" })
          : await supabase.rpc("remove_project_page", { target_page_key: p.pageKey });
        if (error) pageFailures.push(`${p.label}: ${sentence(error.message)}`);
        else Object.assign(done, { [p.key]: form[p.key] });
      }
      if (pageFailures.length > 0) next.pages = pageFailures.join(" ");

      if (rulesChanged && !next.booking) {
        const { error } = await supabase.rpc("set_booking_rules", {
          in_project_id: projectId,
          in_no_show_deposit_after: afterN,
          in_default_deposit_cents: depositCents,
        });
        if (error) next.booking = sentence(error.message);
        else Object.assign(done, { noShowAfter: form.noShowAfter.trim(), depositRm: form.depositRm.trim() });
      }

      if (stampsChanged && !next.loyalty) {
        const { error } = await supabase.rpc("set_loyalty_rule", { in_project_id: projectId, in_stamps_needed: stamps });
        if (error) next.loyalty = sentence(error.message);
        else Object.assign(done, { stampsNeeded: form.stampsNeeded.trim() });
      }

      setErrors(next);
      if (Object.keys(done).length > 0 || Object.keys(baseOnly).length > 0) {
        // What saved is now the baseline; what failed stays on screen, still unsaved.
        setBase((b) => (b ? { ...b, ...baseOnly, ...done } : b));
        setForm((f) => (f ? { ...f, ...done } : f));
        // The sidebar reads the page set and the name; ask the server again.
        router.refresh();
      }
      if (Object.keys(next).length === 0) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (!base || saving) return;
    setForm(base);
    setErrors({});
    setSaved(false);
  }

  // ⌘S / Ctrl+S saves, as the design says. The handler is kept fresh through a ref
  // so it always sees the latest form.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shownName = (form?.businessName || base?.businessName || "").trim();
  const primaryBranch = branches.find((b) => b.active)?.name ?? shownName;
  const openCount = branches.filter((b) => b.active).length;

  const TABS: { key: Tab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "branches", label: `Branch Locations (${branches.length})` },
    { key: "team", label: `Team & Access (${members.length + 1})` },
    { key: "rules", label: "Booking & Loyalty" },
  ];

  const saveBtn = (id: string) => (
    <button
      data-testid={id}
      onClick={save}
      disabled={!dirty || saving}
      className="h-10 px-4 rounded-lg bg-[#000000] hover:bg-[#1b1b1e] disabled:opacity-40 text-[#ffffff] text-[13.5px] leading-5 font-medium transition-colors shadow-sm flex items-center gap-2"
    >
      <span className="material-symbols-outlined text-[16px]">{saving ? "refresh" : "check"}</span>
      <span>{saving ? "Saving…" : "Save Configuration"}</span>
      <kbd className="ml-0.5 rounded bg-[#ffffff]/20 px-1.5 py-0.5 text-[10px] text-[#ffffff]/70">⌘S</kbd>
    </button>
  );

  return (
    <div
      className="bg-[#f9f9fd] text-[14.5px] leading-[22px] tracking-[-0.005em] text-[#1a1c1f] antialiased min-h-screen"
      style={{ fontFamily: "var(--font-sans-latin), sans-serif" }}
    >
      <SalonSidebar active="tenant-settings" businessName={shownName || undefined} subtitle="Operations" />
      <div className="pl-64 min-h-screen bg-[#f9f9fd]">
        <main className="w-full bg-[#f9f9fd] pt-0">
          <div className="max-w-6xl mx-auto px-8 py-8 flex flex-col gap-8">
            {!owner || !form ? (
              <div className={CARD + " p-10 text-center text-[13.5px] text-[#77767b]"}>
                Tenant settings are only visible to the business owner.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4 border-b border-[#c8c5cb]/40 pb-6">
                  <div className="flex items-center gap-2 text-[11.5px] leading-4 tracking-[0.04em] font-medium uppercase text-[#5e5e67]">
                    <span>Operations</span><span>/</span><span>Management</span><span>/</span>
                    <span className="text-[#1a1c1f] font-semibold">Tenant Settings</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-[20px] leading-7 tracking-[-0.015em] font-semibold text-[#1a1c1f]">Store Settings &amp; Multi-Branch Tenant</h1>
                        {primaryBranch && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1a9a4d]/10 px-2.5 py-0.5 text-[11.5px] font-medium text-[#1a9a4d]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#1a9a4d]" />
                            {primaryBranch}
                            {openCount > 1 ? ` · ${openCount} branches open` : ""}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[13.5px] leading-5 text-[#5e5e67]">Manage the store&apos;s identity, branches, who works here, and the rules the schedule and the till follow.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        data-testid="settings-state"
                        className={"inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11.5px] font-medium " + (dirty ? "bg-amber-50 text-amber-800" : "bg-[#eeedf1] text-[#5e5e67]")}
                      >
                        <span className="material-symbols-outlined text-[15px]">{dirty ? "edit_note" : "check_circle"}</span>
                        <span>{dirty ? "Unsaved changes" : "All changes saved"}</span>
                      </div>
                      {saveBtn("settings-save-top")}
                    </div>
                  </div>
                  <div role="tablist" className="flex flex-wrap items-center gap-2 border-t border-[#c8c5cb]/30 pt-3">
                    {TABS.map((t) => (
                      <button
                        key={t.key}
                        role="tab"
                        aria-selected={tab === t.key}
                        onClick={() => setTab(t.key)}
                        className={
                          "px-3.5 py-1.5 rounded-lg text-[13.5px] leading-5 font-medium transition-colors " +
                          (tab === t.key ? "bg-[#000000] text-[#ffffff] shadow-sm" : "text-[#5e5e67] hover:text-[#1a1c1f] hover:bg-[#eeedf1]")
                        }
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {tab === "general" && (
                  <>
                    <div className={CARD + " p-6 flex flex-col gap-6"}>
                      <div className="flex items-start justify-between border-b border-[#c8c5cb]/30 pb-4">
                        <div>
                          <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Store Identity</h2>
                          <p className="mt-0.5 text-[13.5px] leading-5 text-[#5e5e67]">The name printed on your receipts and shown on your website, and the address people open it at.</p>
                        </div>
                        <span className="rounded bg-[#e8e8ec] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-[#47464b]">Your shop</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <label className="flex flex-col gap-1.5">
                          <span className={LABEL}>Brand name</span>
                          <input className={FIELD} value={form.businessName} maxLength={60} onChange={(e) => set("businessName", e.target.value)} />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className={LABEL}>Owner name</span>
                          <input className={FIELD} value={form.ownerName} maxLength={40} onChange={(e) => set("ownerName", e.target.value)} />
                        </label>
                        <div className="md:col-span-2">
                          <FieldError text={errors.name} testId="settings-error-name" />
                        </div>
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                          <div className="flex items-center justify-between">
                            <label htmlFor="settings-site-slug" className={LABEL}>Website address</label>
                            <span
                              data-testid="settings-site-state"
                              className={"inline-flex items-center gap-1 text-[11px] font-medium " + (form.sitePublished ? "text-[#1a9a4d]" : "text-[#77767b]")}
                            >
                              <span className="material-symbols-outlined text-[13px]">{form.sitePublished ? "public" : "public_off"}</span>
                              {form.sitePublished ? "Published" : "Not published yet"}
                            </span>
                          </div>
                          <div className="flex overflow-hidden rounded-lg border border-[#c8c5cb]/60 bg-[#ffffff] focus-within:border-[#000000] transition-colors">
                            <span className="inline-flex items-center border-r border-[#c8c5cb]/60 bg-[#eeedf1] px-3 font-mono text-[11.5px] text-[#5e5e67] whitespace-nowrap">{siteBase}</span>
                            <input
                              id="settings-site-slug"
                              className="h-9 flex-1 min-w-0 bg-transparent px-2.5 text-[13.5px] outline-none"
                              value={form.siteSlug}
                              maxLength={40}
                              onChange={(e) => set("siteSlug", e.target.value.toLowerCase())}
                            />
                          </div>
                          {form.sitePublished && form.siteSlug !== base?.siteSlug && (
                            <p className="text-[12px] leading-4 text-amber-800">Your site is published. Changing the address breaks any link you have already shared.</p>
                          )}
                          <FieldError text={errors.slug} testId="settings-error-slug" />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-[#c8c5cb]/40 bg-[#f9f9fd] p-3.5">
                          <div className="flex flex-col">
                            <span className="text-[13.5px] font-medium text-[#1a1c1f]">Base currency</span>
                            <span className="text-[11.5px] text-[#5e5e67]">Every amount in the system is in ringgit</span>
                          </div>
                          <span className="rounded bg-[#eeedf1] px-2.5 py-1 text-[13.5px] font-medium tabular-nums text-[#1a1c1f]">MYR (RM)</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-[#c8c5cb]/40 bg-[#f9f9fd] p-3.5">
                          <div className="flex flex-col">
                            <span className="text-[13.5px] font-medium text-[#1a1c1f]">Business day</span>
                            <span className="text-[11.5px] text-[#5e5e67]">A day runs midnight to midnight, Kuala Lumpur time</span>
                          </div>
                          <span className="rounded bg-[#eeedf1] px-2.5 py-1 text-[13.5px] font-medium tabular-nums text-[#1a1c1f]">UTC+8</span>
                        </div>
                      </div>
                    </div>

                    <div className={CARD + " p-6 flex flex-col gap-5"}>
                      <div>
                        <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Pages you use</h2>
                        <p className="mt-0.5 text-[13.5px] leading-5 text-[#5e5e67]">Turn off what this shop does not do and it leaves the sidebar. Nothing is deleted: turn it back on and it returns with its records.</p>
                      </div>
                      <div className="flex flex-col gap-3">
                        {PAGE_SWITCHES.map((p) => (
                          <div key={p.key} className="flex items-center justify-between gap-4 rounded-lg border border-[#c8c5cb]/30 bg-[#f9f9fd] p-3.5">
                            <div className="flex flex-col">
                              <span className="text-[13.5px] font-medium text-[#1a1c1f]">{p.label}</span>
                              <span className="text-[11.5px] text-[#5e5e67]">{p.drives}</span>
                            </div>
                            <Switch checked={form[p.key]} onChange={(v) => set(p.key, v)} label={p.label} />
                          </div>
                        ))}
                      </div>
                      <p className="text-[12px] leading-4 text-[#77767b]">Overview, Register, Clients, Lookbook, reports, End of Day and Invoices are always on.</p>
                      <FieldError text={errors.pages} testId="settings-error-pages" />
                    </div>

                    <div className={CARD + " p-5 flex flex-col gap-4"}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eeedf1] text-[#1a1c1f]">
                            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                          </div>
                          <div>
                            <h3 className="text-[14.5px] font-semibold text-[#1a1c1f]">Customer Receipt Preview</h3>
                            <p className="mt-0.5 text-[12.5px] leading-4 text-[#5e5e67]">How the Register&apos;s receipt starts: your store name, then the date, cashier and lines.</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowSlip((v) => !v)}
                          aria-expanded={showSlip}
                          className="h-9 shrink-0 px-3.5 rounded-lg bg-[#eeedf1] hover:bg-[#e8e8ec] text-[13.5px] font-medium text-[#1a1c1f] flex items-center gap-1.5 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">{showSlip ? "visibility_off" : "visibility"}</span>
                          {showSlip ? "Hide Slip Sample" : "View Slip Sample"}
                        </button>
                      </div>
                      {showSlip && (
                        <div className="flex justify-center rounded-xl border border-[#c8c5cb]/30 bg-[#f3f3f7] p-6">
                          <div data-testid="settings-slip" className="w-full max-w-[340px] rounded bg-[#ffffff] p-5 text-[12.5px] text-[#1a1c1f] shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div data-testid="settings-slip-name" className="text-[15px] font-semibold">{shownName || "Your store name"}</div>
                                <div className="mt-0.5 text-[11px] text-[#5e5e67]">25 Sept 2026, 3:20 pm</div>
                              </div>
                              <div className="text-right text-[11px] text-[#5e5e67]">
                                <div>Cashier: {(form.ownerName || "Owner").trim()}</div>
                                <div>Walk-in</div>
                              </div>
                            </div>
                            <div className="mt-3 space-y-1.5 border-t border-[#c8c5cb]/30 pt-3">
                              <div className="flex justify-between"><span>1× Cut &amp; blow-dry</span><span className="tabular-nums">RM 80.00</span></div>
                              <div className="flex justify-between"><span>1× Colour treatment</span><span className="tabular-nums">RM 220.00</span></div>
                            </div>
                            <div className="mt-3 space-y-1 border-t border-[#c8c5cb]/30 pt-3">
                              <div className="flex justify-between text-[#5e5e67]"><span>Subtotal</span><span className="tabular-nums">RM 300.00</span></div>
                              <div className="flex justify-between border-t border-[#c8c5cb]/30 pt-1.5 text-[15px] font-bold"><span>Total Paid</span><span className="tabular-nums">RM 300.00</span></div>
                            </div>
                            <div className="mt-3 flex justify-between border-t border-[#c8c5cb]/30 pt-3 text-[11.5px] text-[#5e5e67]"><span>Cash</span><span className="tabular-nums">RM 300.00</span></div>
                            <div className="pt-3 text-center text-[11px] text-[#5e5e67]">Thank you</div>
                            <div className="mt-3 rounded bg-[#eeedf1] px-2 py-1 text-center text-[10.5px] font-medium uppercase tracking-wide text-[#5e5e67]">Sample figures</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {tab === "branches" && <BranchesTab projectId={projectId} branches={branches} />}

                {tab === "team" && <TeamTab ownerEmail={ownerEmail} members={members} />}

                {tab === "rules" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div className={CARD + " p-6 flex flex-col gap-5"}>
                      <div className="border-b border-[#c8c5cb]/30 pb-3">
                        <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">No-show deposit</h3>
                        <p className="mt-0.5 text-[12.5px] leading-4 text-[#5e5e67]">When to ask a client who keeps missing appointments for a deposit.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1.5">
                          <span className={LABEL}>After this many no-shows</span>
                          <input className={FIELD} inputMode="numeric" value={form.noShowAfter} placeholder="e.g. 2" onChange={(e) => set("noShowAfter", e.target.value)} />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className={LABEL}>Deposit (RM)</span>
                          <input className={FIELD} inputMode="decimal" value={form.depositRm} placeholder="e.g. 50" onChange={(e) => set("depositRm", e.target.value)} />
                        </label>
                      </div>
                      <p data-testid="settings-booking-effect" className="rounded-lg bg-[#f3f3f7] px-3 py-2.5 text-[13px] leading-5 text-[#47464b]">
                        {form.noShowAfter.trim() && form.depositRm.trim()
                          ? `After ${form.noShowAfter.trim()} no-show${form.noShowAfter.trim() === "1" ? "" : "s"}, a booking suggests asking for a deposit of RM ${form.depositRm.trim()}. The system only suggests; you or the counter decide.`
                          : "Not set. The schedule will not suggest a deposit for anyone until you fill in both."}
                      </p>
                      <FieldError text={errors.booking} testId="settings-error-booking" />
                    </div>

                    <div className={CARD + " p-6 flex flex-col gap-5"}>
                      <div className="border-b border-[#c8c5cb]/30 pb-3">
                        <h3 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Loyalty card</h3>
                        <p className="mt-0.5 text-[12.5px] leading-4 text-[#5e5e67]">How many visits earn a client a reward.</p>
                      </div>
                      <label className="flex flex-col gap-1.5">
                        <span className={LABEL}>Visits for one reward</span>
                        <input className={FIELD} inputMode="numeric" value={form.stampsNeeded} placeholder="e.g. 10" onChange={(e) => set("stampsNeeded", e.target.value)} />
                      </label>
                      <p data-testid="settings-loyalty-effect" className="rounded-lg bg-[#f3f3f7] px-3 py-2.5 text-[13px] leading-5 text-[#47464b]">
                        {form.stampsNeeded.trim()
                          ? `A client has earned a reward after ${form.stampsNeeded.trim()} visit${form.stampsNeeded.trim() === "1" ? "" : "s"}. Once the counter gives it, her card starts again.`
                          : "Not set. There is no loyalty card until you say how many visits earn a reward."}
                      </p>
                      <FieldError text={errors.loyalty} testId="settings-error-loyalty" />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-[#c8c5cb]/40 pt-4">
                  <button
                    data-testid="settings-discard"
                    onClick={discard}
                    disabled={!dirty || saving}
                    className="h-10 px-4 rounded-lg bg-[#eeedf1] hover:bg-[#e8e8ec] disabled:opacity-40 text-[13.5px] leading-5 font-medium text-[#1a1c1f] transition-colors"
                  >
                    Discard Changes
                  </button>
                  <div className="flex items-center gap-3">
                    {saved && <span data-testid="settings-saved" role="status" className="text-[12.5px] font-medium text-[#047857]">Saved</span>}
                    {saveBtn("settings-save-bottom")}
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

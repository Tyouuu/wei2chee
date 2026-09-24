"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { SALON_NAV } from "@/lib/portal/salon-nav";
import { DAILY_OPS, MANAGEMENT } from "../salon-shell";
import { FIELD, LABEL, sentence } from "../side-panel";

/**
 * The two tabs of Tenant Settings that are lists you act on one row at a time
 * -- branches and who works here. Unlike the General and Rules tabs (fields you
 * change and then Save), each of these is a button that does its own thing at
 * once, as the design's "Add Branch" does: adding a person or closing a branch
 * is not a draft.
 */

export type BranchRow = { id: string; name: string; active: boolean; openedLabel: string };
export type MemberRow = { userId: string; email: string; role: string; active: boolean; addedLabel: string };

const CARD = "bg-[#ffffff] rounded-xl border border-[#c8c5cb]/30 shadow-sm";

function StatusPill({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium " +
        (on ? "bg-[#1a9a4d]/10 text-[#1a9a4d]" : "bg-[#eeedf1] text-[#5e5e67]")
      }
    >
      <span className={"h-1.5 w-1.5 rounded-full " + (on ? "bg-[#1a9a4d]" : "bg-[#77767b]")} />
      {on ? onLabel : offLabel}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Branches
// ─────────────────────────────────────────────────────────────────────────

export function BranchesTab({ projectId, branches }: { projectId: string; branches: BranchRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function add() {
    if (!name.trim() || busy) return;
    setBusy("add");
    setError(null);
    setNote(null);
    try {
      const { data, error: err } = await createBrowserSupabaseClient().rpc("add_branch", { in_project_id: projectId, in_name: name });
      if (err) {
        setError(sentence(err.message));
        return;
      }
      // The database hands back the branch that already has this name instead of
      // making a second one; say so rather than looking as if nothing happened.
      const row = data as { id: string; name: string } | null;
      if (row && branches.some((b) => b.id === row.id)) {
        setNote(`You already have a branch called "${row.name}".`);
      } else {
        setName("");
        setAdding(false);
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function setActive(b: BranchRow, active: boolean) {
    if (busy) return;
    setBusy(b.id);
    setError(null);
    setNote(null);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc("set_branch_active", { in_id: b.id, in_active: active });
      if (err) {
        setError(sentence(err.message));
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={CARD + " p-6 flex flex-col gap-5"}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Managed Branch Locations</h2>
          <p className="text-[13.5px] leading-5 text-[#5e5e67] mt-0.5">Each place you trade from. Sales and stock can be tagged to the branch they happened at.</p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="h-9 shrink-0 px-3.5 rounded-lg bg-[#eeedf1] hover:bg-[#e8e8ec] text-[13.5px] font-medium text-[#1a1c1f] flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[17px]">add_location_alt</span>
            Add Branch
          </button>
        )}
      </div>

      {adding && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-1 min-w-[14rem] flex-col gap-1.5">
            <span className={LABEL}>Branch name</span>
            <input
              className={FIELD}
              value={name}
              maxLength={80}
              placeholder="Puchong"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void add();
              }}
              autoFocus
            />
          </label>
          <button
            onClick={add}
            disabled={busy === "add" || !name.trim()}
            className="h-9 px-4 rounded-lg bg-[#000000] hover:bg-[#1b1b1e] disabled:opacity-50 text-[#ffffff] text-[13.5px] font-medium transition-colors"
          >
            {busy === "add" ? "Adding…" : "Add"}
          </button>
          <button
            onClick={() => {
              setAdding(false);
              setName("");
              setError(null);
            }}
            disabled={busy === "add"}
            className="h-9 px-3.5 rounded-lg border border-[#c8c5cb]/60 hover:bg-[#f3f3f7] text-[13.5px] font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {error && <p role="alert" data-testid="settings-branch-error" className="text-[12.5px] font-medium text-[#ba1a1a]">{error}</p>}
      {note && <p role="status" data-testid="settings-branch-note" className="text-[12.5px] font-medium text-[#5e5e67]">{note}</p>}

      {branches.length === 0 ? (
        <p data-testid="settings-branches-empty" className="rounded-lg bg-[#f3f3f7] px-4 py-6 text-center text-[13.5px] text-[#5e5e67]">
          This shop is one location. Add a branch when you open a second one.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {branches.map((b, i) => (
            <div
              key={b.id}
              data-testid="settings-branch"
              className={"rounded-xl border p-4 flex flex-col gap-3 " + (b.active ? "border-[#000000]/20 bg-[#f9f9fd]" : "border-[#c8c5cb]/40 bg-[#f9f9fd] opacity-80")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={"h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-[12px] font-bold " + (b.active ? "bg-[#000000] text-[#ffffff]" : "bg-[#e8e8ec] text-[#1a1c1f]")}>
                    B{i + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-semibold text-[#1a1c1f] truncate">{b.name}</div>
                    <div className="text-[11.5px] text-[#5e5e67]">Added {b.openedLabel}</div>
                  </div>
                </div>
                <StatusPill on={b.active} onLabel="Open" offLabel="Closed" />
              </div>
              <div className="flex justify-end border-t border-[#c8c5cb]/30 pt-2.5">
                <button
                  onClick={() => setActive(b, !b.active)}
                  disabled={busy === b.id}
                  aria-label={b.active ? `Close ${b.name}` : `Reopen ${b.name}`}
                  className="text-[13px] font-medium text-[#1a1c1f] hover:underline disabled:opacity-50"
                >
                  {busy === b.id ? "…" : b.active ? "Close branch" : "Reopen branch"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[12px] leading-4 text-[#77767b]">
        A branch is a name and whether it is open. A closed branch is kept, not deleted, so the sales and stock recorded against it stay readable. The salon pages in this preview do not split by branch yet.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Team & access
// ─────────────────────────────────────────────────────────────────────────

export function TeamTab({ ownerEmail, members }: { ownerEmail: string; members: MemberRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function add() {
    if (!email.trim() || busy) return;
    setBusy("add");
    setError(null);
    setNote(null);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc("add_project_member", { in_email: email });
      if (err) {
        setError(sentence(err.message));
        return;
      }
      setNote(`${email.trim()} can now sign in and work here.`);
      setEmail("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function setActive(m: MemberRow, active: boolean) {
    if (busy) return;
    setBusy(m.userId);
    setError(null);
    setNote(null);
    try {
      const { error: err } = await createBrowserSupabaseClient().rpc("set_member_active", { in_user_id: m.userId, in_active: active });
      if (err) {
        setError(sentence(err.message));
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  // What a cashier gets, worked out from the same rules the sidebar uses, so the
  // list here cannot drift from what a staff login really sees.
  const rows = [...DAILY_OPS, ...MANAGEMENT];
  const staffSees = rows.filter((r) => r.key && !SALON_NAV[r.key]?.ownerOnly).map((r) => r.label);
  const ownerOnly = rows.filter((r) => r.key && SALON_NAV[r.key]?.ownerOnly).map((r) => r.label);

  return (
    <div className="flex flex-col gap-6">
      <div className={CARD + " p-6 flex flex-col gap-5"}>
        <div>
          <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Who works here</h2>
          <p className="text-[13.5px] leading-5 text-[#5e5e67] mt-0.5">The owner, and the people you have let in. Someone turned off can no longer sign in to this shop.</p>
        </div>

        <div className="divide-y divide-[#e2e2e6] rounded-lg border border-[#c8c5cb]/30">
          <div data-testid="settings-member" className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="text-[14px] font-medium text-[#1a1c1f] truncate">{ownerEmail}</div>
              <div className="text-[11.5px] text-[#5e5e67]">You</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded bg-[#000000] px-2 py-0.5 text-[11px] font-medium text-[#ffffff]">Owner</span>
              <StatusPill on onLabel="Active" offLabel="Off" />
            </div>
          </div>
          {members.map((m) => (
            <div key={m.userId} data-testid="settings-member" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-[#1a1c1f] truncate">{m.email}</div>
                <div className="text-[11.5px] text-[#5e5e67]">Added {m.addedLabel}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded bg-[#eeedf1] px-2 py-0.5 text-[11px] font-medium text-[#47464b] capitalize">{m.role}</span>
                <StatusPill on={m.active} onLabel="Active" offLabel="Off" />
                <button
                  onClick={() => setActive(m, !m.active)}
                  disabled={busy === m.userId}
                  aria-label={m.active ? `Turn off ${m.email}` : `Turn on ${m.email}`}
                  className="text-[13px] font-medium text-[#1a1c1f] hover:underline disabled:opacity-50"
                >
                  {busy === m.userId ? "…" : m.active ? "Turn off" : "Turn on"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-1 min-w-[16rem] flex-col gap-1.5">
            <span className={LABEL}>Add a person by email</span>
            <input
              className={FIELD}
              type="email"
              value={email}
              placeholder="amy@example.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void add();
              }}
            />
          </label>
          <button
            onClick={add}
            disabled={busy === "add" || !email.trim()}
            className="h-9 px-4 rounded-lg bg-[#000000] hover:bg-[#1b1b1e] disabled:opacity-50 text-[#ffffff] text-[13.5px] font-medium transition-colors"
          >
            {busy === "add" ? "Adding…" : "Add person"}
          </button>
        </div>
        <p className="-mt-2 text-[12px] leading-4 text-[#77767b]">They need a Formae account first. An email with no account cannot be added, and nothing is sent to them.</p>
        {error && <p role="alert" data-testid="settings-team-error" className="text-[12.5px] font-medium text-[#ba1a1a]">{error}</p>}
        {note && <p role="status" data-testid="settings-team-note" className="text-[12.5px] font-medium text-[#047857]">{note}</p>}
      </div>

      <div className={CARD + " p-6 flex flex-col gap-4"}>
        <div>
          <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">What each role can open</h2>
          <p className="text-[13.5px] leading-5 text-[#5e5e67] mt-0.5">There are two roles. This list is read from the same rules the sidebar uses.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div data-testid="settings-role-owner" className="rounded-lg bg-[#f3f3f7] p-4">
            <div className="text-[13.5px] font-semibold text-[#1a1c1f] mb-2">Owner</div>
            <p className="text-[13px] leading-5 text-[#47464b]">Everything, including the pages that show money and history: {ownerOnly.join(", ")}.</p>
          </div>
          <div data-testid="settings-role-staff" className="rounded-lg bg-[#f3f3f7] p-4">
            <div className="text-[13.5px] font-semibold text-[#1a1c1f] mb-2">Staff</div>
            <p className="text-[13px] leading-5 text-[#47464b]">{staffSees.join(", ")}. They can take a customer&apos;s payment at the Register. Refunds, paying money out and the owner-only pages stay with you.</p>
          </div>
        </div>
      </div>

      <div className={CARD + " p-6 flex flex-wrap items-center justify-between gap-4"}>
        <div className="min-w-0">
          <h2 className="text-base leading-6 tracking-[-0.01em] font-semibold text-[#1a1c1f]">Change history</h2>
          <p className="text-[13.5px] leading-5 text-[#5e5e67] mt-0.5">Who changed what, and when, and whether a person or the assistant did it. Only you can open it.</p>
        </div>
        <Link
          href="/en/salon-preview/audit-log"
          data-testid="settings-audit-link"
          className="h-9 px-4 rounded-lg border border-[#c8c5cb]/60 bg-[#ffffff] hover:bg-[#eeedf1] text-[13.5px] font-medium text-[#1a1c1f] transition-colors inline-flex items-center gap-1.5"
        >
          <span>Open change history</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { commissionOn, tierPhrase, tierProblems, type Tier } from "@/lib/portal/commission";
import { FIELD, LABEL, sentence } from "../side-panel";
import type { CommissionTier } from "./stylist-client";

/**
 * Editing one stylist's commission brackets, in place on the card that shows
 * them (Task 415). This is the same job the product's own commission panel
 * does (portal/[pageKey]/new/commission-panel.tsx) and it uses the same
 * pieces, so the rules cannot drift apart:
 *
 *   commissionOn    the band-by-band arithmetic (5,000 at 10% then 3,000 at
 *                   15% is 950, not 8,000 at 15%)
 *   tierProblems    the sentences that say what is wrong BEFORE saving, in
 *                   place of whatever the database's constraint would print
 *   tierPhrase      "first RM 500 at 15% · RM 500 and above at 25%"
 *   set_commission_tiers   the one write; it also records which set applies
 *                   from which date
 *
 * ── Simplification pass (founder-tasks 任务428, cut order item 4) ───────
 * His words: don't chase big-SaaS complexity, build something anyone can
 * pick up. A 2-3 person salon's own commission talk is "she gets 10%" or
 * "15% past the first RM 500" -- one band, or two. Six bands is a
 * franchise-payroll shape nobody here asked for, so THIS editor caps
 * "+ Add a band" at two.
 *
 * `tierProblems()`'s own six-band ceiling in lib/portal/commission.ts is
 * left alone on purpose: that file is shared with the old portal's
 * commission-panel.tsx, which other trades still use, and this pass only
 * has authorization to simplify the salon pages. If a stylist somehow
 * already has more than two saved bands (set from elsewhere), they still
 * render and still work -- the cap only stops adding a third from here.
 *
 * ── The one thing that must not be pre-filled: "in force from" ──────────
 * A rate change saved today starts NEXT month, so the rate already paid for
 * this month does not move under him. The box is empty on purpose -- a
 * pre-filled date looks like we decided when it starts, and that date is the
 * one thing only he can say. To change this month as well, he chooses the 1st.
 */

const ENGLISH = {
  first: "first {amount} at {percent}",
  then: "{percent} on everything",
  from: "{amount} and above at {percent}",
  join: " · ",
};
const PROBLEMS = {
  duplicate: "Two bands cannot start at the same figure.",
  // Unreachable from this editor today (the "+ Add a band" button stops at
  // two), but tierProblems() itself still only flags past six -- left as is
  // so a stylist who already has more than two saved bands doesn't hit a
  // mismatched error message just for opening the editor.
  tooMany: "Six bands at most. Past that, nobody can follow which one they are in.",
  badPercent: "The rate has to be between 0 and 100.",
};
const MAX_BANDS = 2;

type Row = { from: string; percent: string };

function rm(cents: number): string {
  const whole = cents / 100;
  return `RM ${whole.toLocaleString("en-MY", { minimumFractionDigits: whole % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}
const todayMY = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());

export function TierEditor({
  partyId,
  saved,
  earnedCents,
  onClose,
}: {
  partyId: string;
  saved: CommissionTier[];
  /** This month's revenue credited to her; null when the viewer cannot see money. */
  earnedCents: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(
    saved.length
      ? saved.map((t) => ({ from: String(t.fromCents / 100), percent: String(t.percent) }))
      : [{ from: "0", percent: "" }],
  );
  const [from, setFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What he has typed so far, worked out as he types. A line he has not
  // finished counts as zero rather than making the whole thing blank.
  const parsed: Tier[] = useMemo(
    () =>
      rows.map((r) => ({
        fromCents: Math.round((Number(r.from.replace(/[^\d.]/g, "")) || 0) * 100),
        percent: Number(r.percent.replace(/[^\d.]/g, "")) || 0,
      })),
    [rows],
  );
  const problems = tierProblems(parsed, PROBLEMS);
  const phrase = tierPhrase(parsed, rm, ENGLISH);
  const preview = earnedCents != null ? commissionOn(earnedCents, parsed) : null;

  const today = todayMY();
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const startNote =
    from === ""
      ? saved.length > 0
        ? "Starts next month. This month keeps the rates it already has."
        : "There are no rates yet, so these apply from now."
      : from <= today
        ? "This month's commission will be worked out on these bands too."
        : "Starts on that date.";

  const setRow = (i: number, patch: Partial<Row>) => setRows((p) => p.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    if (busy || problems.length) return;
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error: err } = await supabase.rpc("set_commission_tiers", {
      in_party_id: partyId,
      in_tiers: parsed.map((t) => ({ from_cents: t.fromCents, percent: t.percent })),
      // Empty means "today" to the database, which means next month. Send
      // null, not an empty string, which it would read as a broken date.
      in_effective_from: from || null,
    });
    setBusy(false);
    if (err) return setError(sentence(err.message));
    router.refresh();
    onClose();
  }

  return (
    <div data-testid="tier-editor" className="flex flex-col gap-3.5">
      <p className="text-[13px] text-[#5e5e67]">Band by band: one rate up to a figure, another above it.</p>

      {/* Column titles once, not on every band: six bands with their own
          titles was a wall of labels. */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[170px_100px_36px] gap-2">
          <span className={LABEL}>From (RM)</span>
          <span className={LABEL}>Rate %</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[170px_100px_36px] gap-2 items-center">
            <input aria-label={`From ${i + 1}`} inputMode="decimal" value={r.from} onChange={(e) => setRow(i, { from: e.target.value })} className={FIELD + " tabular-nums"} />
            <input aria-label={`Rate ${i + 1}`} inputMode="decimal" value={r.percent} onChange={(e) => setRow(i, { percent: e.target.value })} className={FIELD + " tabular-nums"} />
            <button
              type="button"
              aria-label={`Remove band ${i + 1}`}
              disabled={rows.length === 1}
              onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
              className="h-9 w-9 rounded-lg hover:bg-[#f3f3f7] text-[#77767b] hover:text-[#1a1c1f] flex items-center justify-center disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={rows.length >= MAX_BANDS}
        onClick={() => setRows((p) => [...p, { from: "", percent: "" }])}
        className="self-start h-8 px-3 rounded-lg border border-[#c8c5cb]/60 hover:bg-[#f3f3f7] text-[12.5px] font-medium text-[#1a1c1f] disabled:opacity-40"
      >
        + Add a band
      </button>

      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>In force from</span>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="date" aria-label="In force from" value={from} onChange={(e) => setFrom(e.target.value)} className={FIELD + " max-w-[180px]"} />
          <button type="button" onClick={() => setFrom(firstOfMonth)} className="text-[12.5px] font-medium text-[#000000] underline underline-offset-2">
            Start from the 1st of this month
          </button>
        </div>
        <span data-testid="tier-start-note" className="text-[12px] text-[#5e5e67]">
          {startNote}
        </span>
      </div>

      {phrase && problems.length === 0 && (
        <p data-testid="tier-phrase" className="text-[13px] text-[#1a1c1f] bg-[#f3f3f7] rounded-lg px-3 py-2">
          {phrase}
        </p>
      )}
      {preview != null && problems.length === 0 && (
        <p data-testid="tier-preview" className="text-[12.5px] text-[#5e5e67]">
          At these bands, this month&apos;s {rm(earnedCents ?? 0)} would come to <strong className="text-[#1a1c1f]">{rm(preview)}</strong>.
        </p>
      )}
      {problems.map((p) => (
        <p key={p} role="alert" data-testid="tier-problem" className="text-[12.5px] font-medium text-[#ba1a1a]">
          {p}
        </p>
      ))}
      {error && (
        <p role="alert" data-testid="tier-error" className="text-[12.5px] font-medium text-[#ba1a1a]">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          disabled={busy || problems.length > 0}
          onClick={() => void save()}
          className="h-9 px-4 rounded-lg bg-[#000000] text-[#ffffff] text-[13px] font-semibold hover:bg-neutral-800 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save Brackets"}
        </button>
        <button type="button" disabled={busy} onClick={onClose} className="h-9 px-3 rounded-lg border border-[#c8c5cb]/60 text-[13px] font-medium hover:bg-[#f3f3f7]">
          Cancel
        </button>
      </div>
    </div>
  );
}

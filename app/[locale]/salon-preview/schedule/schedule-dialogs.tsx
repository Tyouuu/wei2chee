"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * The two dialogs that replace the schedule page's "isn't wired up yet"
 * alerts (Task 415). Everything here writes through functions that already
 * exist -- nothing new in the database:
 *
 *   BookingDialog      -> add_appointment
 *   AppointmentDialog  -> mark_appointment_arrived, set_appointment_status
 *
 * The database's own sentences are shown as they are ("that time is already
 * taken", "a booking needs to say who it is for") -- they are already written
 * for the person at the desk, so nothing is re-worded here.
 */

export type BookingPrefill = { staffId: string; start: string; end: string };

const LABEL = "text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]";
const FIELD =
  "h-9 w-full rounded-lg border border-[#c8c5cb]/60 bg-[#ffffff] px-3 text-[13.5px] text-[#1a1c1f] outline-none focus:border-[#000000] transition-colors placeholder:text-[#5e5e67]/70";

function sentence(msg: string) {
  const s = msg.trim();
  return s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".");
}

export function BookingDialog({
  projectId,
  dateStr,
  dayLabel,
  customers,
  staff,
  prefill,
  onClose,
}: {
  projectId: string;
  dateStr: string;
  dayLabel: string;
  customers: { id: string; name: string }[];
  staff: { id: string; name: string }[];
  prefill: BookingPrefill | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [clientQuery, setClientQuery] = useState("");
  const [partyId, setPartyId] = useState<string | null>(null);
  const [service, setService] = useState("");
  const [staffId, setStaffId] = useState(prefill?.staffId ?? "");
  const [start, setStart] = useState(prefill?.start ?? "");
  const [end, setEnd] = useState(prefill?.end ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // One key per opening of this dialog: a double press books once.
  const key = useRef<string | null>(null);

  const suggestions = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q || partyId) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [clientQuery, partyId, customers]);

  const submit = async () => {
    if (saving) return;
    const name = clientQuery.trim();
    if (!name) return setError("Say who the booking is for.");
    if (!start || !end) return setError("Pick a start and an end time.");
    if (end <= start) return setError("It has to end after it starts.");
    if (!key.current) key.current = crypto.randomUUID();
    setSaving(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error: err } = await supabase.rpc("add_appointment", {
      in_project_id: projectId,
      in_module_key: "bookings",
      in_starts_at: new Date(`${dateStr}T${start}:00+08:00`).toISOString(),
      in_ends_at: new Date(`${dateStr}T${end}:00+08:00`).toISOString(),
      in_party: name,
      in_party_id: partyId,
      in_staff_id: staffId || null,
      in_service: service.trim(),
      in_idempotency_key: key.current,
    });
    setSaving(false);
    if (err) return setError(sentence(err.message));
    router.refresh();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
      onClick={() => !saving && onClose()}
    >
      <div
        role="dialog"
        aria-label="New appointment"
        className="w-full max-w-md rounded-xl bg-[#ffffff] border border-[#c8c5cb]/40 shadow-xl p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-[16px] leading-6 font-semibold tracking-[-0.01em] text-[#1a1c1f]">New Appointment</h2>
          <p className="text-[12px] text-[#5e5e67] mt-0.5">{dayLabel}</p>
        </div>

        <div className="flex flex-col gap-1.5 relative">
          <span className={LABEL}>Client</span>
          <input
            type="text"
            aria-label="Client"
            value={clientQuery}
            onChange={(e) => {
              setClientQuery(e.target.value);
              setPartyId(null);
              setError(null);
            }}
            placeholder="Type a name — pick a saved client or just use the name"
            className={FIELD}
          />
          {suggestions.length > 0 && (
            <div className="rounded-lg border border-[#c8c5cb]/50 bg-[#ffffff] shadow-md overflow-hidden">
              {suggestions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setClientQuery(c.name);
                    setPartyId(c.id);
                    setError(null);
                  }}
                  className="w-full text-left px-3 py-2 text-[13px] hover:bg-[#f3f3f7] border-b border-[#e8e8ec] last:border-b-0"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {partyId && <span className="text-[11.5px] text-[#5e5e67]">Linked to her saved client folio.</span>}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Service</span>
          <input
            type="text"
            aria-label="Service"
            value={service}
            onChange={(e) => setService(e.target.value)}
            placeholder="e.g. Cut & blow-dry"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Stylist</span>
          <select aria-label="Stylist" value={staffId} onChange={(e) => setStaffId(e.target.value)} className={FIELD}>
            <option value="">Anyone (holds the whole shop&apos;s slot)</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Starts</span>
            <input
              type="time"
              aria-label="Start time"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setError(null);
              }}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Ends</span>
            <input
              type="time"
              aria-label="End time"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setError(null);
              }}
              className={FIELD}
            />
          </label>
        </div>

        {error && (
          <p role="alert" data-testid="booking-error" className="text-[12.5px] text-[#ba1a1a]">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="h-9 px-3.5 rounded-lg border border-[#c8c5cb]/60 bg-[#ffffff] hover:bg-[#f3f3f7] text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="h-9 px-4 rounded-lg bg-[#000000] hover:bg-neutral-800 text-[#ffffff] text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "Booking…" : "Book Appointment"}
          </button>
        </div>
      </div>
    </div>
  );
}

export type OpenAppointment = {
  id: string;
  guestName: string;
  service: string;
  timeLabel: string;
  statusLabel: string;
  status: "booked" | "done" | "no_show" | "cancelled";
  arrived: boolean;
  href: string;
  staffName: string;
};

export function AppointmentDialog({ appt, onClose }: { appt: OpenAppointment; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const setStatus = async (status: "done" | "no_show" | "cancelled") => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { data, error: err } = await supabase.rpc("set_appointment_status", { in_id: appt.id, in_status: status });
    setBusy(false);
    if (err) return setError(sentence(err.message));
    const row = (Array.isArray(data) ? data[0] : data) as
      | { used_package_id?: string | null; package_name?: string; sessions_left?: number | null; why?: string }
      | undefined;
    // `why` is a code, not a sentence. Only the two that need her to do
    // something are worth interrupting for; "no package" and "no client on
    // this booking" are the everyday case and stay quiet.
    const speak =
      status !== "done"
        ? null
        : row?.used_package_id
          ? `Marked done. One session of ${row.package_name || "her package"} was used${row.sessions_left != null ? ` — ${row.sessions_left} left` : ""}.`
          : row?.why === "many_packages"
            ? "Marked done. She has more than one package that could apply, so none was used — open her record to pick the right one."
            : row?.why === "expired_only"
              ? "Marked done. Her package has expired, so no session was used."
              : null;
    router.refresh();
    if (speak) setNote(speak);
    else onClose();
  };

  const markArrived = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error: err } = await supabase.rpc("mark_appointment_arrived", { in_id: appt.id });
    setBusy(false);
    if (err) return setError(sentence(err.message));
    router.refresh();
    onClose();
  };

  const open = appt.status === "booked";

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-label="Appointment"
        className="w-full max-w-sm rounded-xl bg-[#ffffff] border border-[#c8c5cb]/40 shadow-xl p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[16px] leading-6 font-semibold tracking-[-0.01em] text-[#1a1c1f] truncate">{appt.guestName}</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#f3f3f7] text-[#5e5e67] border border-[#c8c5cb]/30 shrink-0">
              {appt.statusLabel}
            </span>
          </div>
          <p className="text-[13px] text-[#47464b] mt-1">{appt.service}</p>
          <p className="text-[12px] font-mono text-[#5e5e67] mt-0.5">
            {appt.timeLabel}
            {appt.staffName ? ` · ${appt.staffName}` : ""}
          </p>
        </div>

        {note && (
          <p data-testid="appt-note" className="text-[12.5px] text-[#1a1c1f] bg-[#f3f3f7] rounded-lg px-3 py-2">
            {note}
          </p>
        )}
        {error && (
          <p role="alert" data-testid="appt-error" className="text-[12.5px] text-[#ba1a1a]">
            {error}
          </p>
        )}

        {open ? (
          <div className="grid grid-cols-2 gap-2">
            {!appt.arrived && (
              <button
                type="button"
                disabled={busy}
                onClick={markArrived}
                className="h-9 rounded-lg border border-[#c8c5cb]/60 hover:bg-[#f3f3f7] text-[13px] font-medium transition-colors disabled:opacity-50"
              >
                She&apos;s here
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => setStatus("done")}
              className="h-9 rounded-lg bg-[#000000] hover:bg-neutral-800 text-[#ffffff] text-[13px] font-medium transition-colors disabled:opacity-50"
            >
              Mark done
            </button>
            {!appt.arrived && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setStatus("no_show")}
                className="h-9 rounded-lg border border-[#c8c5cb]/60 hover:bg-[#f3f3f7] text-[13px] font-medium transition-colors disabled:opacity-50"
              >
                No show
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => setStatus("cancelled")}
              className="h-9 rounded-lg border border-[#c8c5cb]/60 hover:bg-[#f3f3f7] text-[#47464b] text-[13px] font-medium transition-colors disabled:opacity-50"
            >
              Cancel booking
            </button>
          </div>
        ) : (
          <p className="text-[12.5px] text-[#5e5e67]">This one is already settled.</p>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-[#e8e8ec]">
          <Link href={appt.href} className="text-[12.5px] text-[#47464b] underline decoration-[#c8c5cb] hover:text-[#1a1c1f]">
            Open full record
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="h-8 px-3 rounded-lg border border-[#c8c5cb]/60 hover:bg-[#f3f3f7] text-[12.5px] font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

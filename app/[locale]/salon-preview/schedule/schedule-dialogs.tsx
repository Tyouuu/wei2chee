"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * The two side panels behind the schedule page (Task 415 / 416).
 *
 * ── What changed after looking at how the field does it ─────────────────
 *
 * The first version was a centred pop-up that dimmed the whole page. Fresha
 * and Mangomint both book from a panel at the side, so the calendar stays in
 * view while you choose a time -- you can see the free stretch you are
 * filling. So both of these are now a right-hand panel over a barely-there
 * scrim (the calendar is still readable), in this product's own language:
 * white surface, hairline border, 11.5px uppercase labels, black primary.
 *
 * Fresha starts a booking with "the client": an existing one, a new one, or
 * a walk-in. That is kept: type a name and pick the saved client, or leave
 * it as a walk-in, or tick "Save her as a new client" (which uses
 * claim_booking_party, so pressing twice cannot make two clients).
 *
 * Fresha's statuses run Booked -> Arrived -> Started -> Completed, with
 * No-show beside them. The appointment panel shows that as three steps and
 * offers ONE next step as the big button; the less common ones (no show,
 * cancel) sit below it, smaller.
 *
 * Everything writes through functions that already exist:
 *   BookingSheet      add_appointment, claim_booking_party
 *   AppointmentSheet  mark_appointment_arrived, set_appointment_status
 * The database's own sentences are shown as they are.
 */

export type BookingPrefill = { staffId: string; start: string; end: string; date?: string };

const LABEL = "text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]";
const FIELD =
  "h-9 w-full rounded-lg border border-[#c8c5cb]/60 bg-[#ffffff] px-3 text-[13.5px] text-[#1a1c1f] outline-none focus:border-[#000000] transition-colors placeholder:text-[#5e5e67]/70";

function sentence(msg: string) {
  const s = msg.trim();
  return s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".");
}

function duration(start: string, end: string): string | null {
  if (!start || !end || end <= start) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

function Sheet({
  label,
  title,
  subtitle,
  onClose,
  busy,
  footer,
  children,
}: {
  label: string;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  busy: boolean;
  footer: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    // A very light scrim: clicking outside closes, but the calendar stays readable.
    <div className="fixed inset-0 z-[60] bg-black/10" onClick={() => !busy && onClose()}>
      <aside
        role="dialog"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 bottom-0 w-full max-w-[420px] bg-[#ffffff] border-l border-[#c8c5cb]/40 shadow-2xl flex flex-col"
      >
        <div className="px-5 py-4 border-b border-[#c8c5cb]/30 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[16px] leading-6 font-semibold tracking-[-0.01em] text-[#1a1c1f] truncate">{title}</h2>
            {subtitle && <div className="text-[12px] text-[#5e5e67] mt-0.5">{subtitle}</div>}
          </div>
          <button
            type="button"
            aria-label="Close panel"
            disabled={busy}
            onClick={onClose}
            className="h-8 w-8 shrink-0 rounded-lg hover:bg-[#f3f3f7] text-[#5e5e67] hover:text-[#1a1c1f] flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">{children}</div>
        <div className="px-5 py-4 border-t border-[#c8c5cb]/30 bg-[#ffffff]">{footer}</div>
      </aside>
    </div>
  );
}

export function BookingSheet({
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
  // A slot picked from the week carries its own day.
  const date = prefill?.date ?? dateStr;
  const [clientQuery, setClientQuery] = useState("");
  const [partyId, setPartyId] = useState<string | null>(null);
  const [saveAsClient, setSaveAsClient] = useState(false);
  const [contact, setContact] = useState("");
  const [service, setService] = useState("");
  const [staffId, setStaffId] = useState(prefill?.staffId ?? "");
  const [start, setStart] = useState(prefill?.start ?? "");
  const [end, setEnd] = useState(prefill?.end ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Booked, but saving her as a client failed: keep the panel to say so.
  const [bookedNote, setBookedNote] = useState<string | null>(null);
  // One key per opening of this panel: a double press books once.
  const key = useRef<string | null>(null);

  const suggestions = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q || partyId) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [clientQuery, partyId, customers]);

  const length = duration(start, end);
  const dayHeading = date === dateStr ? dayLabel : new Intl.DateTimeFormat("en-MY", { timeZone: "UTC", weekday: "long", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00Z`));

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
    const wantsClient = saveAsClient && !partyId;
    const { data, error: err } = await supabase.rpc("add_appointment", {
      in_project_id: projectId,
      in_module_key: "bookings",
      in_starts_at: new Date(`${date}T${start}:00+08:00`).toISOString(),
      in_ends_at: new Date(`${date}T${end}:00+08:00`).toISOString(),
      in_party: name,
      in_party_id: partyId,
      in_staff_id: staffId || null,
      in_service: service.trim(),
      // The same place the website's booking form puts a number, so the
      // client the database makes from this booking picks it up as WhatsApp.
      in_extra: wantsClient && contact.trim() ? { contact: contact.trim() } : {},
      in_idempotency_key: key.current,
    });
    if (err) {
      setSaving(false);
      return setError(sentence(err.message));
    }
    if (wantsClient) {
      const { error: claimErr } = await supabase.rpc("claim_booking_party", { in_appointment_id: data as string });
      if (claimErr) {
        setSaving(false);
        router.refresh();
        return setBookedNote(`Booked — but she wasn't saved as a client. ${sentence(claimErr.message)}`);
      }
    }
    setSaving(false);
    router.refresh();
    onClose();
  };

  return (
    <Sheet
      label="New appointment"
      title="New Appointment"
      subtitle={dayHeading}
      onClose={onClose}
      busy={saving}
      footer={
        bookedNote ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 rounded-lg bg-[#000000] hover:bg-neutral-800 text-[#ffffff] text-[13.5px] font-medium transition-colors"
          >
            Close
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="h-10 px-4 rounded-lg border border-[#c8c5cb]/60 bg-[#ffffff] hover:bg-[#f3f3f7] text-[13.5px] font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={submit}
              className="flex-1 h-10 rounded-lg bg-[#000000] hover:bg-neutral-800 text-[#ffffff] text-[13.5px] font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "Booking…" : "Book Appointment"}
            </button>
          </div>
        )
      }
    >
      {bookedNote ? (
        <p data-testid="booked-note" className="text-[13px] text-[#1a1c1f] bg-[#f3f3f7] rounded-lg px-3 py-2.5">
          {bookedNote}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
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
              placeholder="Search a saved client, or type a name"
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
            {partyId ? (
              <span className="text-[11.5px] text-[#5e5e67]">Linked to her saved client folio.</span>
            ) : clientQuery.trim() ? (
              <label className="flex items-center gap-2 text-[12.5px] text-[#47464b] mt-0.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveAsClient}
                  onChange={(e) => setSaveAsClient(e.target.checked)}
                  className="h-4 w-4 accent-[#000000]"
                />
                <span>Save her as a new client (otherwise a walk-in)</span>
              </label>
            ) : null}
            {saveAsClient && !partyId && clientQuery.trim() && (
              <input
                type="tel"
                aria-label="Phone or WhatsApp"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Phone or WhatsApp (optional)"
                className={FIELD}
              />
            )}
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

          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Time</span>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            {length && (
              <span data-testid="booking-length" className="text-[11.5px] font-mono text-[#5e5e67]">
                {length}
              </span>
            )}
          </div>

          {error && (
            <p role="alert" data-testid="booking-error" className="text-[12.5px] text-[#ba1a1a]">
              {error}
            </p>
          )}
        </>
      )}
    </Sheet>
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

const STEPS = ["Booked", "Arrived", "Done"] as const;

export function AppointmentSheet({ appt, onClose }: { appt: OpenAppointment; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Where the appointment is NOW. The panel stays open after "Mark done" to
  // say which package session was used, and without this it kept offering
  // "She's here" on a finished appointment (the prop is a snapshot).
  const [live, setLive] = useState({ status: appt.status, arrived: appt.arrived });

  const setStatus = async (status: "done" | "no_show" | "cancelled") => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { data, error: err } = await supabase.rpc("set_appointment_status", { in_id: appt.id, in_status: status });
    setBusy(false);
    if (err) return setError(sentence(err.message));
    setLive((l) => ({ ...l, status }));
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

  const open = live.status === "booked";
  // Where she is on the way through: Booked -> Arrived -> Done.
  const step = live.status === "done" ? 2 : live.arrived ? 1 : 0;
  const statusLabel =
    live.status === appt.status ? appt.statusLabel : { booked: "UPCOMING", done: "COMPLETED", no_show: "NO SHOW", cancelled: "CANCELLED" }[live.status];

  const secondary = "h-9 rounded-lg border border-[#c8c5cb]/60 hover:bg-[#f3f3f7] text-[13px] font-medium transition-colors disabled:opacity-50";

  return (
    <Sheet
      label="Appointment"
      title={appt.guestName}
      subtitle={
        <span className="font-mono">
          {appt.timeLabel}
          {appt.staffName ? ` · ${appt.staffName}` : ""}
        </span>
      }
      onClose={onClose}
      busy={busy}
      footer={
        <div className="flex items-center justify-between">
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
      }
    >
      <div>
        <span className={LABEL}>Service</span>
        <p className="text-[14px] text-[#1a1c1f] mt-1">{appt.service}</p>
      </div>

      {open || live.status === "done" ? (
        <div data-testid="appt-steps" className="flex items-center">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={
                    "h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold " +
                    (i <= step ? "bg-[#000000] text-[#ffffff]" : "bg-[#eeedf1] text-[#5e5e67]")
                  }
                >
                  {i < step || (i === step && live.status === "done") ? (
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={"text-[11px] " + (i <= step ? "text-[#1a1c1f] font-medium" : "text-[#5e5e67]")}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={"flex-1 h-px mx-2 mb-4 " + (i < step ? "bg-[#000000]" : "bg-[#c8c5cb]/60")} />}
            </div>
          ))}
        </div>
      ) : (
        <span className="self-start px-2.5 py-1 rounded-full text-[11.5px] font-mono font-bold bg-[#f3f3f7] text-[#5e5e67] border border-[#c8c5cb]/30">
          {statusLabel}
        </span>
      )}

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
        <div className="flex flex-col gap-2">
          {/* One next step as the big button; the rarer ones sit under it. */}
          {live.arrived ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setStatus("done")}
              className="h-11 rounded-lg bg-[#000000] hover:bg-neutral-800 text-[#ffffff] text-[14px] font-medium transition-colors disabled:opacity-50"
            >
              Mark done
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={markArrived}
              className="h-11 rounded-lg bg-[#000000] hover:bg-neutral-800 text-[#ffffff] text-[14px] font-medium transition-colors disabled:opacity-50"
            >
              She&apos;s here
            </button>
          )}
          <div className="grid grid-cols-3 gap-2">
            {!live.arrived && (
              <button type="button" disabled={busy} onClick={() => setStatus("done")} className={secondary}>
                Mark done
              </button>
            )}
            {!live.arrived && (
              <button type="button" disabled={busy} onClick={() => setStatus("no_show")} className={secondary}>
                No show
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => setStatus("cancelled")}
              className={secondary + " text-[#47464b] " + (live.arrived ? "col-span-3" : "")}
            >
              Cancel booking
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[12.5px] text-[#5e5e67]">This one is already settled.</p>
      )}
    </Sheet>
  );
}

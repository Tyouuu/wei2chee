"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { FIELD, LABEL, PanelFooter, Sheet, sentence } from "../side-panel";
import type { ClientRow } from "./clients-client";

/**
 * The four side panels behind the Clients page (Task 415).
 *
 * How the field does it (read from Fresha's and Mangomint's own help pages):
 * "Add a new client" is a panel beside the list, not a pop-up in the middle;
 * the profile carries Book / Edit; a rebooking starts from what she had last
 * time. So these are right-hand panels (the same shell the Schedule panels
 * use) and each one starts from what the database already knows about her --
 * the last service, her usual stylist, the time of day she usually comes --
 * instead of an empty form (fewer things to type, and every one of those
 * comes from her own past visits, not a guess).
 *
 * Every write is a function that already existed:
 *   NewClientSheet    add_directory_entry
 *   EditClientSheet   update_directory_entry
 *   BookNextSheet     add_appointment
 *   RedeemSheet       use_package_session
 * The database's own sentences are shown as they are.
 */

type Staff = { id: string; name: string };

const digits = (s: string) => s.replace(/\D/g, "");
const todayMY = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function dayLabel(date: string): string {
  return new Intl.DateTimeFormat("en-MY", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00Z`));
}
function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + mins);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function DoneFooter({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="w-full h-10 rounded-lg bg-[#000000] hover:bg-neutral-800 text-[#ffffff] text-[13.5px] font-medium transition-colors"
    >
      Close
    </button>
  );
}

// ── New client ─────────────────────────────────────────────────────────────

export function NewClientSheet({
  projectId,
  clients,
  onClose,
  onCreated,
  onOpen,
}: {
  projectId: string;
  clients: ClientRow[];
  onClose: () => void;
  onCreated: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [onWhatsApp, setOnWhatsApp] = useState(true);
  const [tag, setTag] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const key = useRef<string | null>(null);

  const tags = useMemo(() => [...new Set(clients.map((c) => c.status).filter(Boolean))], [clients]);

  // Two people with one number is normal (a mother booking for her daughter),
  // so this only says so; it never blocks. Two people with one NAME is more
  // likely the same person twice.
  const duplicate = useMemo(() => {
    const p = digits(phone);
    if (p.length >= 8) {
      const hit = clients.find((c) => [c.phone, c.whatsapp].some((x) => digits(x).length >= 8 && digits(x).slice(-8) === p.slice(-8)));
      if (hit) return { client: hit, what: "number" as const };
    }
    const n = name.trim().toLowerCase();
    if (n) {
      const hit = clients.find((c) => c.name.trim().toLowerCase() === n);
      if (hit) return { client: hit, what: "name" as const };
    }
    return null;
  }, [phone, name, clients]);

  const submit = async () => {
    if (saving) return;
    if (!name.trim()) return setError("Give her a name.");
    if (!key.current) key.current = crypto.randomUUID();
    setSaving(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { data, error: err } = await supabase.rpc("add_directory_entry", {
      in_project_id: projectId,
      in_module_key: "customers",
      in_name: name.trim(),
      in_kind: "person",
      in_phone: phone.trim(),
      in_whatsapp: onWhatsApp ? phone.trim() : "",
      in_status: tag.trim(),
      in_note: notes.trim(),
      in_idempotency_key: key.current,
    });
    if (err) {
      setSaving(false);
      return setError(sentence(err.message));
    }
    setSaving(false);
    router.refresh();
    onCreated((data as { id: string }).id);
    onClose();
  };

  return (
    <Sheet
      label="New client"
      title="New Client Folio"
      subtitle="Saved to your client directory"
      onClose={onClose}
      busy={saving}
      footer={<PanelFooter busy={saving} onClose={onClose} onSubmit={submit} submitLabel="Add Client" busyLabel="Adding…" />}
    >
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Name</span>
        <input
          type="text"
          aria-label="Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="Her name as she gives it"
          className={FIELD}
          autoFocus
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Phone</span>
        <input type="tel" aria-label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 012-345 6789" className={FIELD} />
        {phone.trim() && (
          <label className="flex items-center gap-2 text-[12.5px] text-[#47464b] mt-0.5 cursor-pointer">
            <input type="checkbox" checked={onWhatsApp} onChange={(e) => setOnWhatsApp(e.target.checked)} className="h-4 w-4 accent-[#000000]" />
            <span>She is on WhatsApp with this number</span>
          </label>
        )}
        {duplicate && (
          <p data-testid="duplicate-note" className="text-[12.5px] text-[#47464b] bg-[#f3f3f7] rounded-lg px-3 py-2">
            {duplicate.what === "number" ? "This number is already saved for" : "A client with this name already exists:"}{" "}
            <button type="button" onClick={() => onOpen(duplicate.client.id)} className="font-semibold text-[#000000] underline underline-offset-2">
              {duplicate.client.name}
            </button>
            .
          </p>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Tag</span>
        <input
          type="text"
          aria-label="Tag"
          list="client-tags"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="e.g. VIP (optional)"
          className={FIELD}
        />
        <datalist id="client-tags">
          {tags.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Notes</span>
        <textarea
          aria-label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Colour formula, allergies, anything to remember"
          className="w-full rounded-lg border border-[#c8c5cb]/60 bg-[#ffffff] px-3 py-2 text-[13.5px] text-[#1a1c1f] outline-none focus:border-[#000000] transition-colors placeholder:text-[#5e5e67]/70 resize-y"
        />
      </label>

      {error && (
        <p role="alert" data-testid="panel-error" className="text-[12.5px] text-[#ba1a1a]">
          {error}
        </p>
      )}
    </Sheet>
  );
}

// ── Edit profile ───────────────────────────────────────────────────────────

export function EditClientSheet({ client, tags, onClose }: { client: ClientRow; tags: string[]; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone);
  const [whatsapp, setWhatsapp] = useState(client.whatsapp);
  const [tag, setTag] = useState(client.status);
  const [address, setAddress] = useState(client.address);
  const [notes, setNotes] = useState(client.note);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    if (!name.trim()) return setError("She needs a name.");
    setSaving(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    // An empty box is sent as an empty string, which the database reads as
    // "clear this"; leaving a field out would mean "don't touch it".
    const { error: err } = await supabase.rpc("update_directory_entry", {
      in_id: client.id,
      in_name: name.trim(),
      in_phone: phone.trim(),
      in_whatsapp: whatsapp.trim(),
      in_status: tag.trim(),
      in_address: address.trim(),
      in_note: notes.trim(),
    });
    if (err) {
      setSaving(false);
      return setError(sentence(err.message));
    }
    setSaving(false);
    router.refresh();
    onClose();
  };

  return (
    <Sheet
      label="Edit profile"
      title="Edit Profile"
      subtitle={client.name}
      onClose={onClose}
      busy={saving}
      footer={<PanelFooter busy={saving} onClose={onClose} onSubmit={submit} submitLabel="Save Changes" busyLabel="Saving…" />}
    >
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Name</span>
        <input type="text" aria-label="Name" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} className={FIELD} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Phone</span>
          <input type="tel" aria-label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>WhatsApp</span>
          <input type="tel" aria-label="WhatsApp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={FIELD} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Tag</span>
        <input type="text" aria-label="Tag" list="client-tags-edit" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. VIP" className={FIELD} />
        <datalist id="client-tags-edit">
          {tags.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Address</span>
        <input type="text" aria-label="Address" value={address} onChange={(e) => setAddress(e.target.value)} className={FIELD} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Notes</span>
        <textarea
          aria-label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-[#c8c5cb]/60 bg-[#ffffff] px-3 py-2 text-[13.5px] text-[#1a1c1f] outline-none focus:border-[#000000] transition-colors resize-y"
        />
      </label>
      {error && (
        <p role="alert" data-testid="panel-error" className="text-[12.5px] text-[#ba1a1a]">
          {error}
        </p>
      )}
    </Sheet>
  );
}

// ── Book her next appointment ──────────────────────────────────────────────

export function BookNextSheet({ projectId, client, staff, onClose }: { projectId: string; client: ClientRow; staff: Staff[]; onClose: () => void }) {
  const router = useRouter();
  const today = todayMY();
  // Everything below that is prefilled comes from her own last visit.
  const last = client.lastVisit;
  const usualDate = useMemo(() => {
    if (!client.lastOn || !client.usualGapDays) return null;
    const d = addDays(client.lastOn, Math.round(client.usualGapDays));
    return d >= today ? d : null;
  }, [client.lastOn, client.usualGapDays, today]);

  const [date, setDate] = useState(usualDate ?? "");
  const [service, setService] = useState(last?.service ?? "");
  const [staffId, setStaffId] = useState(client.primaryStylistId ?? "");
  const [start, setStart] = useState(last?.startTime ?? "");
  const [end, setEnd] = useState(last?.startTime ? addMinutes(last.startTime, last.minutes) : "");
  const [endTouched, setEndTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const key = useRef<string | null>(null);

  const stylistName = staff.find((s) => s.id === staffId)?.name ?? null;

  const submit = async () => {
    if (saving) return;
    if (!date) return setError("Pick a day.");
    if (date < today) return setError("That day has already passed.");
    if (!start || !end) return setError("Pick a start and an end time.");
    if (end <= start) return setError("It has to end after it starts.");
    if (!key.current) key.current = crypto.randomUUID();
    setSaving(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error: err } = await supabase.rpc("add_appointment", {
      in_project_id: projectId,
      in_module_key: "bookings",
      in_starts_at: new Date(`${date}T${start}:00+08:00`).toISOString(),
      in_ends_at: new Date(`${date}T${end}:00+08:00`).toISOString(),
      in_party: client.name,
      in_party_id: client.id,
      in_staff_id: staffId || null,
      in_service: service.trim(),
      in_extra: {},
      in_idempotency_key: key.current,
    });
    if (err) {
      setSaving(false);
      return setError(sentence(err.message));
    }
    setSaving(false);
    router.refresh();
    setDone(`Booked for ${dayLabel(date)}, ${start}–${end}${stylistName ? ` with ${stylistName}` : ""}.`);
  };

  const jump = (weeks: number) => {
    setDate(addDays(today, weeks * 7));
    setError(null);
  };

  return (
    <Sheet
      label="Book next appointment"
      title="Book Next"
      subtitle={client.name}
      onClose={onClose}
      busy={saving}
      footer={done ? <DoneFooter onClose={onClose} /> : <PanelFooter busy={saving} onClose={onClose} onSubmit={submit} submitLabel="Book Appointment" busyLabel="Booking…" />}
    >
      {done ? (
        <p data-testid="booked-note" className="text-[13px] text-[#1a1c1f] bg-[#f3f3f7] rounded-lg px-3 py-2.5">
          {done}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Day</span>
            <input
              type="date"
              aria-label="Day"
              min={today}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setError(null);
              }}
              className={FIELD}
            />
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {usualDate && (
                <button
                  type="button"
                  data-testid="usual-date"
                  onClick={() => setDate(usualDate)}
                  className="h-7 px-2.5 rounded-full bg-[#000000] text-[#ffffff] text-[11.5px] font-medium"
                >
                  Her usual · {dayLabel(usualDate)}
                </button>
              )}
              {[2, 4, 6, 8].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => jump(w)}
                  className="h-7 px-2.5 rounded-full border border-[#c8c5cb]/60 bg-[#ffffff] hover:bg-[#f3f3f7] text-[11.5px] font-medium text-[#1a1c1f] transition-colors"
                >
                  In {w} weeks
                </button>
              ))}
            </div>
            {date && <span className="text-[11.5px] font-mono text-[#5e5e67]">{dayLabel(date)}</span>}
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
            {last && service === last.service && <span className="text-[11.5px] text-[#5e5e67]">Same as her last visit.</span>}
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
                  const v = e.target.value;
                  setStart(v);
                  // The end follows the start by the length of her last visit,
                  // until she types an end of her own.
                  if (!endTouched && v) setEnd(addMinutes(v, last?.minutes ?? 60));
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
                  setEndTouched(true);
                  setError(null);
                }}
                className={FIELD}
              />
            </div>
            {last?.startTime && start === last.startTime && <span className="text-[11.5px] text-[#5e5e67]">Her usual time of day.</span>}
          </div>

          {error && (
            <p role="alert" data-testid="panel-error" className="text-[12.5px] text-[#ba1a1a]">
              {error}
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}

// ── Use one package session ────────────────────────────────────────────────

export function RedeemSheet({ client, staff, onClose }: { client: ClientRow; staff: Staff[]; onClose: () => void }) {
  const router = useRouter();
  const usable = client.activePackages.filter((p) => p.sessionsLeft > 0);
  const [packageId, setPackageId] = useState(usable[0]?.id ?? "");
  const [staffId, setStaffId] = useState(client.primaryStylistId ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const key = useRef<string | null>(null);

  const chosen = usable.find((p) => p.id === packageId);

  const submit = async () => {
    if (saving || !chosen) return;
    if (!key.current) key.current = crypto.randomUUID();
    setSaving(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error: err } = await supabase.rpc("use_package_session", {
      in_package_id: chosen.id,
      in_staff_id: staffId || null,
      in_note: note.trim(),
      in_idempotency_key: key.current,
    });
    if (err) {
      setSaving(false);
      return setError(sentence(err.message));
    }
    setSaving(false);
    router.refresh();
    const left = chosen.sessionsLeft - 1;
    setDone(`One session of ${chosen.name} used — ${left} left.`);
  };

  return (
    <Sheet
      label="Use a package session"
      title="Redeem Session"
      subtitle={client.name}
      onClose={onClose}
      busy={saving}
      footer={done ? <DoneFooter onClose={onClose} /> : <PanelFooter busy={saving} onClose={onClose} onSubmit={submit} submitLabel="Use 1 Session" busyLabel="Saving…" />}
    >
      {done ? (
        <p data-testid="redeem-note" className="text-[13px] text-[#1a1c1f] bg-[#f3f3f7] rounded-lg px-3 py-2.5">
          {done}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Which pass</span>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Which pass">
              {usable.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={p.id === packageId}
                  onClick={() => setPackageId(p.id)}
                  className={
                    "text-left rounded-lg px-3 py-2.5 transition-colors " +
                    (p.id === packageId ? "border-2 border-[#000000] bg-[#f3f3f7]" : "border border-[#c8c5cb]/60 bg-[#ffffff] hover:bg-[#f3f3f7]")
                  }
                >
                  <span className="block text-[13.5px] font-semibold text-[#1a1c1f]">{p.name}</span>
                  <span className="block text-[11.5px] font-mono text-[#5e5e67] mt-0.5">
                    {p.sessionsLeft} of {p.sessionsTotal} left{p.expiresOn ? ` · valid to ${p.expiresOn}` : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Done by</span>
            <select aria-label="Done by" value={staffId} onChange={(e) => setStaffId(e.target.value)} className={FIELD}>
              <option value="">Not recorded</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Note</span>
            <input type="text" aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className={FIELD} />
          </label>

          {error && (
            <p role="alert" data-testid="panel-error" className="text-[12.5px] text-[#ba1a1a]">
              {error}
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}

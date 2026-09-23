import { redirect } from "next/navigation";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";
import { loadWorkspace } from "@/lib/portal/workspace";
import {
  displayBusinessName,
  type BusinessContext,
} from "@/lib/templates/industry-template";
import { MaterialSymbolsLink } from "../salon-shell";
import { ScheduleClient, type StaffLane, type LaneItem } from "./schedule-client";

function nowMs(): number {
  return Date.now();
}

/**
 * Founder's own Stitch source for "Appointments & Schedule" (the Floor
 * Timeline gantt, Task 405), now reading real appointments instead of 4
 * hand-written stylist rows with ~10 bespoke absolutely-positioned blocks --
 * fifth page converted in today's cutover, and the most structurally
 * different from the previous four.
 *
 * ── Why this one needed real layout math, not just a data swap ───────────
 *
 * Every other converted page swaps a hardcoded array for a fetched one and
 * keeps the same list/table shape. This page's founder-drawn source pixel-
 * positions each appointment card by hand (`left-[168px] w-[240px]`) to
 * align with a 160px/hour, 09:00-18:00 grid. There's no honest way to keep
 * that literal and also be real -- a real appointment can start at any
 * minute, a staff member can have zero or nine bookings today, and the
 * founder's own 4 stylists don't exist in any account but the one he typed
 * them into by hand.
 *
 * So the math itself is preserved (160px/hour, the same visual language:
 * solid black border = in service, thin border = upcoming, dashed = open),
 * but computed from real starts_at/ends_at instead of copied from the
 * source's fixed offsets. The window defaults to 09:00-18:00 (his own
 * choice) but widens to fit any real appointment that falls outside it --
 * an appointment nobody can see because it's off-grid would be a worse
 * defect than a wider grid.
 *
 * Dropped, not faked: "Rinse in 10m" / "Processing - 15m left" / "Formula
 * #L9-G" style in-service countdowns and colour-formula callouts -- nothing
 * in appointments or appointment_lines tracks a processing timer or a
 * formula code, and inventing one would look real on screen while meaning
 * nothing. What IS real and shown instead: arrived_at (a genuine "she's
 * here" fact, task 366) drives the "IN SERVICE" badge, and status covers
 * done / no_show / cancelled, which the source's 3-bucket vocabulary
 * (in service / upcoming / completed) never had to represent.
 *
 * "Live Roster · N Stylists on Shift" now reads who_is_clocked_in() (task
 * 401's real clock-in/out) -- if nobody has clocked in today (most accounts
 * won't have adopted that feature yet), it honestly falls back to "Full
 * Roster · N Stylists" rather than claiming zero people are working.
 */
export default async function SalonSchedulePreview({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login`);

  const workspace = await loadWorkspace();
  if (!workspace) redirect(`/${locale}/login`);
  const projectId = workspace.projectId;

  const supabase = await createSessionSupabaseClient();

  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessName = displayBusinessName(
    (context as BusinessContext | null) ?? {},
  );

  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
  const dayStartUtc = `${todayStr}T00:00:00+08:00`;
  const dayEndUtc = `${todayStr}T23:59:59.999+08:00`;
  const dayLabel = new Intl.DateTimeFormat("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${todayStr}T12:00:00+08:00`));

  const [staffRes, apptRes, clockedInRes] = await Promise.all([
    supabase
      .from("directory_entries")
      .select("id, name, status")
      .eq("project_id", projectId)
      .eq("module_key", "staff")
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("appointments")
      .select("id, kind, starts_at, ends_at, party, staff_id, service, status, arrived_at, source")
      .eq("project_id", projectId)
      .eq("module_key", "bookings")
      .is("archived_at", null)
      .gte("starts_at", dayStartUtc)
      .lte("starts_at", dayEndUtc)
      .order("starts_at"),
    supabase.rpc("who_is_clocked_in", { in_project_id: projectId }),
  ]);

  type StaffRow = { id: string; name: string; status: string | null };
  type ApptRow = {
    id: string;
    kind: "booking" | "block";
    starts_at: string;
    ends_at: string;
    party: string;
    staff_id: string | null;
    service: string;
    status: "booked" | "done" | "no_show" | "cancelled";
    arrived_at: string | null;
    source: "staff" | "website";
  };
  const staffRows = (staffRes.data ?? []) as StaffRow[];
  const apptRows = (apptRes.data ?? []) as ApptRow[];
  const clockedIn = (clockedInRes.data ?? []) as { staff_id: string }[];
  const clockedInIds = new Set(clockedIn.map((c) => c.staff_id));

  // ── Timeline window: his own 09:00-18:00 default, widened only if real
  // data falls outside it (never clip a real booking off-grid).
  const minutesSinceMidnightMY = (iso: string) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(iso));
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return h * 60 + m;
  };

  let windowStartHour = 9;
  let windowEndHour = 18;
  for (const a of apptRows) {
    windowStartHour = Math.min(windowStartHour, Math.floor(minutesSinceMidnightMY(a.starts_at) / 60));
    windowEndHour = Math.max(windowEndHour, Math.ceil(minutesSinceMidnightMY(a.ends_at) / 60));
  }
  windowStartHour = Math.max(0, windowStartHour);
  windowEndHour = Math.min(24, windowEndHour);
  if (windowEndHour <= windowStartHour) windowEndHour = windowStartHour + 1;

  const PX_PER_MIN = 160 / 60;
  const windowStartMin = windowStartHour * 60;
  const windowEndMin = windowEndHour * 60;
  const totalWidth = (windowEndHour - windowStartHour) * 160;
  // 24-hour, matching the source's own literal label ("09:00 - 18:00 (9h
  // Shift)") -- reconstructing this from the already-12-hour-formatted
  // hourLabels array below lost the AM/PM distinction (18:00 became "06:00"
  // with no meridiem), so it's computed directly from the raw hour numbers.
  const shiftLabel = `${String(windowStartHour).padStart(2, "0")}:00 - ${String(windowEndHour).padStart(2, "0")}:00 (${windowEndHour - windowStartHour}h Shift)`;
  const leftFor = (iso: string) => (minutesSinceMidnightMY(iso) - windowStartMin) * PX_PER_MIN;
  const widthFor = (startIso: string, endIso: string) =>
    (minutesSinceMidnightMY(endIso) - minutesSinceMidnightMY(startIso)) * PX_PER_MIN;

  const hourLabels: { time: string; meridiem: string; current: boolean }[] = [];
  const nowMinutes = minutesSinceMidnightMY(new Date().toISOString());
  const currentHour = Math.floor(nowMinutes / 60);
  for (let h = windowStartHour; h < windowEndHour; h++) {
    const meridiem = h < 12 ? "AM" : "PM";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    hourLabels.push({ time: `${String(displayHour).padStart(2, "0")}:00`, meridiem, current: h === currentHour });
  }
  const nowInWindow = nowMinutes >= windowStartMin && nowMinutes < windowEndMin;
  const nowLeft = nowInWindow ? (nowMinutes - windowStartMin) * PX_PER_MIN : null;
  const nowLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

  const statusLabelOf = (a: ApptRow): { label: string; bucket: "inService" | "upcoming" | "completed"; style: "solid" | "outline" | "muted" } => {
    if (a.status === "done") return { label: "COMPLETED", bucket: "completed", style: "muted" };
    if (a.status === "no_show") return { label: "NO SHOW", bucket: "completed", style: "muted" };
    if (a.status === "cancelled") return { label: "CANCELLED", bucket: "completed", style: "muted" };
    if (a.arrived_at) return { label: "IN SERVICE", bucket: "inService", style: "solid" };
    return { label: a.source === "website" ? "WEBSITE BOOKING" : "UPCOMING", bucket: "upcoming", style: "outline" };
  };

  const timeRangeLabel = (startIso: string, endIso: string) => {
    const fmt = (iso: string) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kuala_Lumpur",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(iso));
    const mins = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
    return `${fmt(startIso)} - ${fmt(endIso)} (${mins}m)`;
  };

  const GAP_MIN_MINUTES = 15;

  const lanes: StaffLane[] = staffRows.map((staff) => {
    const mine = apptRows
      .filter((a) => a.staff_id === staff.id)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

    const items: LaneItem[] = [];
    let cursor = windowStartMin;
    let busyMinutes = 0;
    const statuses = new Set<"inService" | "upcoming" | "completed">();
    const searchParts: string[] = [];

    const pushGap = (fromMin: number, toMin: number) => {
      if (toMin - fromMin < GAP_MIN_MINUTES) return;
      items.push({
        type: "gap",
        left: (fromMin - windowStartMin) * PX_PER_MIN,
        width: (toMin - fromMin) * PX_PER_MIN,
        startMinutesOfDay: fromMin,
        timeLabel: `${String(Math.floor(fromMin / 60)).padStart(2, "0")}:${String(fromMin % 60).padStart(2, "0")} - ${String(Math.floor(toMin / 60)).padStart(2, "0")}:${String(toMin % 60).padStart(2, "0")}`,
        minutes: toMin - fromMin,
        staffName: staff.name,
        staffId: staff.id,
      });
    };

    for (const a of mine) {
      const startMin = minutesSinceMidnightMY(a.starts_at);
      const endMin = minutesSinceMidnightMY(a.ends_at);
      if (startMin > cursor) pushGap(cursor, startMin);

      if (a.kind === "block") {
        items.push({
          type: "block",
          left: leftFor(a.starts_at),
          width: Math.max(widthFor(a.starts_at, a.ends_at), 20),
          label: a.service || "Blocked",
          timeLabel: timeRangeLabel(a.starts_at, a.ends_at),
        });
      } else {
        const st = statusLabelOf(a);
        statuses.add(st.bucket);
        searchParts.push(a.party, a.service);
        items.push({
          type: "appointment",
          id: a.id,
          left: leftFor(a.starts_at),
          width: Math.max(widthFor(a.starts_at, a.ends_at), 40),
          guestName: a.party || "(No name on file)",
          service: a.service || "(No service noted)",
          timeLabel: timeRangeLabel(a.starts_at, a.ends_at),
          statusLabel: st.label,
          statusStyle: st.style,
        });
      }
      busyMinutes += Math.min(endMin, windowEndMin) - Math.max(startMin, windowStartMin);
      cursor = Math.max(cursor, endMin);
    }
    if (cursor < windowEndMin) pushGap(cursor, windowEndMin);
    if (mine.length === 0) {
      // A clean day for this stylist -- one honest "open all day" block
      // rather than an empty, blank-looking row.
      items.length = 0;
      pushGap(windowStartMin, windowEndMin);
    }

    const loadPct = Math.round((busyMinutes / (windowEndMin - windowStartMin)) * 100);

    return {
      id: staff.id,
      name: staff.name,
      role: (staff.status ?? "").trim(),
      bookingsCount: mine.length,
      loadPct,
      loadTone: loadPct >= 70 ? "primary" : "secondary",
      statuses: [...statuses],
      searchText: `${staff.name} ${searchParts.join(" ")}`.toLowerCase(),
      items,
    };
  });

  const totalGuests = apptRows.filter((a) => a.kind === "booking").length;
  const inServiceCount = apptRows.filter((a) => a.kind === "booking" && statusLabelOf(a).bucket === "inService").length;
  const upcomingCount = apptRows.filter((a) => a.kind === "booking" && statusLabelOf(a).bucket === "upcoming").length;
  const completedCount = apptRows.filter((a) => a.kind === "booking" && statusLabelOf(a).bucket === "completed").length;

  const totalBusyMinutes = lanes.reduce(
    (sum, l) => sum + l.items.filter((it) => it.type !== "gap").reduce((s2, it) => s2 + it.width / PX_PER_MIN, 0),
    0,
  );
  const capacityPct =
    staffRows.length > 0
      ? Math.round((totalBusyMinutes / (staffRows.length * (windowEndMin - windowStartMin))) * 100)
      : null;

  const nextArrivals = apptRows
    .filter((a) => a.kind === "booking" && a.status === "booked" && !a.arrived_at && new Date(a.starts_at).getTime() > nowMs())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 2)
    .map((a) => ({
      guestName: a.party || "(No name on file)",
      timeLabel: new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kuala_Lumpur",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(a.starts_at)),
      service: a.service || "(No service noted)",
      staffName: staffRows.find((s) => s.id === a.staff_id)?.name ?? null,
      initials: (a.party || "?")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join(""),
    }));

  const quickSlots = lanes
    .flatMap((lane) =>
      lane.items
        .filter((it): it is Extract<LaneItem, { type: "gap" }> => it.type === "gap" && it.minutes >= 30)
        .map((it) => ({ ...it, laneName: lane.name })),
    )
    .sort((a, b) => a.startMinutesOfDay - b.startMinutesOfDay)
    .slice(0, 3);

  return (
    <>
      <MaterialSymbolsLink />
      <ScheduleClient
        businessName={businessName}
        dayLabel={dayLabel}
        lanes={lanes}
        hourLabels={hourLabels}
        shiftLabel={shiftLabel}
        totalWidth={totalWidth}
        nowLeft={nowLeft}
        nowLabel={nowLabel}
        rosterCount={staffRows.length}
        onShiftCount={clockedInIds.size}
        totals={{ totalGuests, inServiceCount, upcomingCount, completedCount }}
        capacityPct={capacityPct}
        nextArrivals={nextArrivals}
        quickSlots={quickSlots}
      />
    </>
  );
}

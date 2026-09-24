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
import { ScheduleClient } from "./schedule-client";
import type { LaneItem, StaffLane } from "./schedule-timeline";

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
 *
 * ── Task 415 / 416: every control here is now backed by a table ──────────
 *
 * This page used to answer half its buttons with an alert saying "isn't
 * wired up yet". Now, with nothing new in the database:
 *
 *   - ‹ › Today            `?date=YYYY-MM-DD` (anything that is not a real
 *                          date falls back to today); the query, the "now"
 *                          line and "next arrivals" follow the chosen day.
 *   - Gap & Open Slots     every open stretch of the day, each one bookable.
 *   - Week                 ONE stylist's week, a row per day on the same
 *                          timeline as the Day view (Mangomint and Fresha
 *                          both show a week for one team member at a time;
 *                          the first version here was an all-stylists count
 *                          table, which is not how the field does it).
 *   - New Appointment, a   add_appointment, from a side panel that keeps the
 *     gap, Book Slot,      calendar in view. The database answers a clash in
 *     Custom Time Slot     its own words, shown as they are.
 *   - Click an appointment mark_appointment_arrived / set_appointment_status
 *                          (done, no show, cancelled) + a link to its record.
 *                          Marking done says which package session was used.
 *
 * A booking with no stylist ("Anyone") holds the whole shop's slot and used
 * to have no row to sit in -- it counted in the totals but was invisible on
 * the grid. It now gets an "Anyone" row (bookings only, no open slots: a gap
 * there would mean nothing).
 */
export default async function SalonSchedulePreview({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { locale } = await params;
  const { date: dateParam } = await searchParams;
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

  // ── Which day: `?date=YYYY-MM-DD`, anything that is not a real date falls
  // back to today. Plain string arithmetic on the calendar date (Malaysia has
  // no daylight saving, so a day is always 24h and this cannot drift).
  const isRealDate = (s: string | undefined): s is string =>
    !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
  const shiftDate = (s: string, days: number) =>
    new Date(new Date(`${s}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
  const dateStr = isRealDate(dateParam) ? dateParam : todayStr;
  const isToday = dateStr === todayStr;
  const prevDate = shiftDate(dateStr, -1);
  const nextDate = shiftDate(dateStr, 1);
  const dayLabel = new Intl.DateTimeFormat("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateStr}T12:00:00+08:00`));

  // The week (Monday first) the chosen day sits in. One query reads all of it;
  // the day view is the slice of it that falls on the chosen day.
  const mondayOffset = (new Date(`${dateStr}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weekStart = shiftDate(dateStr, -mondayOffset);
  const weekEnd = shiftDate(weekStart, 6);
  const weekDates = Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i));

  const [staffRes, weekRes, clockedInRes, customerRes] = await Promise.all([
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
      .gte("starts_at", `${weekStart}T00:00:00+08:00`)
      .lte("starts_at", `${weekEnd}T23:59:59.999+08:00`)
      .order("starts_at"),
    supabase.rpc("who_is_clocked_in", { in_project_id: projectId }),
    supabase
      .from("directory_entries")
      .select("id, name")
      .eq("project_id", projectId)
      .eq("module_key", "customers")
      .is("archived_at", null)
      .order("name")
      .limit(1000),
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
  const weekAppts = (weekRes.data ?? []) as ApptRow[];
  const clockedIn = (clockedInRes.data ?? []) as { staff_id: string }[];
  const clockedInIds = new Set(clockedIn.map((c) => c.staff_id));

  const dayKey = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date(iso));
  const apptRows = weekAppts.filter((a) => dayKey(a.starts_at) === dateStr);

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

  // ── Timeline window: his own 09:00-18:00 default, widened only if real
  // data falls outside it (never clip a real booking off-grid). The Day and
  // the Week each get the window their own data needs.
  const windowFor = (appts: ApptRow[]) => {
    let sh = 9;
    let eh = 18;
    for (const a of appts) {
      sh = Math.min(sh, Math.floor(minutesSinceMidnightMY(a.starts_at) / 60));
      eh = Math.max(eh, Math.ceil(minutesSinceMidnightMY(a.ends_at) / 60));
    }
    sh = Math.max(0, sh);
    eh = Math.min(24, eh);
    if (eh <= sh) eh = sh + 1;
    return { sh, eh, startMin: sh * 60, endMin: eh * 60, totalWidth: (eh - sh) * 160 };
  };
  type Win = ReturnType<typeof windowFor>;

  const PX_PER_MIN = 160 / 60;
  const nowMinutes = minutesSinceMidnightMY(new Date().toISOString());
  const currentHour = Math.floor(nowMinutes / 60);

  const hourLabelsFor = (win: Win, highlightNow: boolean) => {
    const out: { time: string; meridiem: string; current: boolean }[] = [];
    for (let h = win.sh; h < win.eh; h++) {
      const meridiem = h < 12 ? "AM" : "PM";
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      out.push({ time: `${String(displayHour).padStart(2, "0")}:00`, meridiem, current: highlightNow && h === currentHour });
    }
    return out;
  };

  const dayWin = windowFor(apptRows);
  // 24-hour, matching the source's own literal label ("09:00 - 18:00 (9h
  // Shift)").
  const shiftLabel = `${String(dayWin.sh).padStart(2, "0")}:00 - ${String(dayWin.eh).padStart(2, "0")}:00 (${dayWin.eh - dayWin.sh}h Shift)`;
  const nowInWindow = isToday && nowMinutes >= dayWin.startMin && nowMinutes < dayWin.endMin;
  const nowLeft = nowInWindow ? (nowMinutes - dayWin.startMin) * PX_PER_MIN : null;
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

  /** One row of the timeline: the given appointments laid out on `win`. */
  const buildRow = (win: Win, mine: ApptRow[], staffId: string, staffName: string, date: string, allowGaps: boolean) => {
    const sorted = [...mine].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    const leftFor = (iso: string) => (minutesSinceMidnightMY(iso) - win.startMin) * PX_PER_MIN;
    const widthFor = (startIso: string, endIso: string) =>
      (minutesSinceMidnightMY(endIso) - minutesSinceMidnightMY(startIso)) * PX_PER_MIN;

    const items: LaneItem[] = [];
    let cursor = win.startMin;
    let busyMinutes = 0;
    const statuses = new Set<"inService" | "upcoming" | "completed">();
    const searchParts: string[] = [];

    const pushGap = (fromMin: number, toMin: number) => {
      if (!allowGaps || toMin - fromMin < GAP_MIN_MINUTES) return;
      items.push({
        type: "gap",
        left: (fromMin - win.startMin) * PX_PER_MIN,
        width: (toMin - fromMin) * PX_PER_MIN,
        startMinutesOfDay: fromMin,
        timeLabel: `${String(Math.floor(fromMin / 60)).padStart(2, "0")}:${String(fromMin % 60).padStart(2, "0")} - ${String(Math.floor(toMin / 60)).padStart(2, "0")}:${String(toMin % 60).padStart(2, "0")}`,
        minutes: toMin - fromMin,
        staffName,
        staffId,
        date,
      });
    };

    for (const a of sorted) {
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
          status: a.status,
          arrived: !!a.arrived_at,
          href: `/${locale}/portal/bookings/${a.id}`,
          staffName: staffName,
        });
      }
      busyMinutes += Math.min(endMin, win.endMin) - Math.max(startMin, win.startMin);
      cursor = Math.max(cursor, endMin);
    }
    if (cursor < win.endMin) pushGap(cursor, win.endMin);
    if (sorted.length === 0) {
      // A clean day for this stylist -- one honest "open all day" block
      // rather than an empty, blank-looking row.
      items.length = 0;
      pushGap(win.startMin, win.endMin);
    }

    const loadPct = Math.round((busyMinutes / (win.endMin - win.startMin)) * 100);
    const bookings = sorted.filter((a) => a.kind === "booking" && a.status !== "cancelled").length;
    return { items, statuses: [...statuses], searchText: `${staffName} ${searchParts.join(" ")}`.toLowerCase(), loadPct, bookings };
  };

  // ── The Day: one row per stylist, plus an "Anyone" row when some bookings
  // were not given to a stylist (they hold the whole shop's slot, and would
  // otherwise have nowhere to be drawn).
  const lanes: StaffLane[] = staffRows.map((staff) => {
    const row = buildRow(dayWin, apptRows.filter((a) => a.staff_id === staff.id), staff.id, staff.name, dateStr, true);
    return {
      id: staff.id,
      name: staff.name,
      role: (staff.status ?? "").trim() || "Stylist",
      bookingsCount: row.bookings,
      loadPct: row.loadPct,
      loadTone: row.loadPct >= 70 ? "primary" : "secondary",
      statuses: row.statuses,
      searchText: row.searchText,
      items: row.items,
    };
  });
  const unassigned = apptRows.filter((a) => a.staff_id == null);
  if (unassigned.length > 0) {
    const row = buildRow(dayWin, unassigned, "", "Anyone", dateStr, false);
    lanes.push({
      id: "anyone",
      name: "Anyone",
      role: "Not given to a stylist",
      bookingsCount: row.bookings,
      loadPct: row.loadPct,
      loadTone: "secondary",
      statuses: row.statuses,
      searchText: row.searchText,
      items: row.items,
    });
  }

  const totalGuests = apptRows.filter((a) => a.kind === "booking").length;
  const inServiceCount = apptRows.filter((a) => a.kind === "booking" && statusLabelOf(a).bucket === "inService").length;
  const upcomingCount = apptRows.filter((a) => a.kind === "booking" && statusLabelOf(a).bucket === "upcoming").length;
  const completedCount = apptRows.filter((a) => a.kind === "booking" && statusLabelOf(a).bucket === "completed").length;

  const staffLanes = lanes.filter((l) => l.id !== "anyone");
  const totalBusyMinutes = staffLanes.reduce(
    (sum, l) => sum + l.items.filter((it) => it.type !== "gap").reduce((s2, it) => s2 + it.width / PX_PER_MIN, 0),
    0,
  );
  const capacityPct =
    staffRows.length > 0
      ? Math.round((totalBusyMinutes / (staffRows.length * (dayWin.endMin - dayWin.startMin))) * 100)
      : null;

  const nextArrivals = apptRows
    .filter(
      (a) =>
        a.kind === "booking" &&
        a.status === "booked" &&
        !a.arrived_at &&
        // Today: only the ones still to come. Another day: everyone still booked.
        (!isToday || new Date(a.starts_at).getTime() > nowMs()),
    )
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

  const quickSlots = staffLanes
    .flatMap((lane) =>
      lane.items
        .filter((it): it is Extract<LaneItem, { type: "gap" }> => it.type === "gap" && it.minutes >= 30)
        .map((it) => ({ ...it, laneName: lane.name })),
    )
    .sort((a, b) => a.startMinutesOfDay - b.startMinutesOfDay)
    .slice(0, 3);

  // ── The Week: for each stylist, a row per day on one shared window.
  const weekWin = windowFor(weekAppts);
  const shortDate = (d: string, year: boolean) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", ...(year ? { year: "numeric" as const } : {}) }).format(
      new Date(`${d}T00:00:00Z`),
    );
  const weekStaff = [
    ...staffRows.map((s) => ({ id: s.id, name: s.name })),
    ...(weekAppts.some((a) => a.staff_id == null) ? [{ id: "", name: "Anyone" }] : []),
  ];
  const weekLanes: Record<string, StaffLane[]> = {};
  for (const s of weekStaff) {
    weekLanes[s.id || "anyone"] = weekDates.map((d) => {
      const mine = weekAppts.filter((a) => (a.staff_id ?? "") === s.id && dayKey(a.starts_at) === d);
      const row = buildRow(weekWin, mine, s.id, s.name, d, s.id !== "");
      const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" }).format(new Date(`${d}T00:00:00Z`));
      return {
        id: `${s.id || "anyone"}:${d}`,
        name: `${wd} ${Number(d.slice(8, 10))}`,
        role: d === todayStr ? "Today" : shortDate(d, false).replace(/^\d+ /, ""),
        bookingsCount: row.bookings,
        loadPct: row.loadPct,
        loadTone: row.loadPct >= 70 ? "primary" : "secondary",
        statuses: [],
        searchText: "",
        items: row.items,
        href: `/en/salon-preview/schedule?date=${d}`,
        isToday: d === todayStr,
      } satisfies StaffLane;
    });
  }

  return (
    <>
      <MaterialSymbolsLink />
      <ScheduleClient
        projectId={projectId}
        dateStr={dateStr}
        isToday={isToday}
        prevDate={prevDate}
        nextDate={nextDate}
        weekStaff={weekStaff}
        weekLanes={weekLanes}
        weekHourLabels={hourLabelsFor(weekWin, false)}
        weekTotalWidth={weekWin.totalWidth}
        weekLabel={`${shortDate(weekStart, false)} – ${shortDate(weekEnd, true)}`}
        customers={((customerRes.data ?? []) as { id: string; name: string }[]).map((c) => ({ id: c.id, name: c.name }))}
        businessName={businessName}
        dayLabel={dayLabel}
        lanes={lanes}
        hourLabels={hourLabelsFor(dayWin, isToday)}
        shiftLabel={shiftLabel}
        totalWidth={dayWin.totalWidth}
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

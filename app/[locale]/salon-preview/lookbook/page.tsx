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
import { LookbookClient } from "./lookbook-client";
import { stylistDot, type LookCard } from "./types";

/**
 * Founder's own Stitch source for "Hair Lookbook & Consultation Gallery"
 * (Task 405), now reading the salon's own works (Task 415 item 1,
 * lookbook_works in 20260925040000). Until then this was the one page with
 * nothing behind it: six sample cards with someone else's photos and invented
 * formulas, and an Add button that only said "not wired".
 *
 * ── What's real ─────────────────────────────────────────────────────────
 * Every card is a saved work: photo, name, category, lift level, formula,
 * stylist, tags, a line of note. Filters (category, search, undertone, lift
 * level) and sort work on those. "Apply to Ticket" appends the formula to a
 * real customer's note (task 377's precedent for a colour formula), Copy uses
 * the clipboard, Present Look and Present to Client use the browser's full
 * screen.
 *
 * ── The photos ──────────────────────────────────────────────────────────
 * They show clients' faces, so they live in the private job-photos bucket and
 * the page signs a URL per photo (an hour: long enough to work through the
 * page, and a URL that never expires would turn a private bucket public). The
 * database stores the path, never the URL.
 *
 * ── The empty lookbook ──────────────────────────────────────────────────
 * A new salon opens this page to nothing. It is shown six labelled examples
 * (never actionable: Apply to Ticket would otherwise write an invented formula
 * into a real client's note) so the page still says what it is for.
 */

type WorkRow = {
  id: string;
  title: string;
  category: string;
  level: string;
  formula: string;
  note: string;
  tags: string[];
  stylist_id: string | null;
  photo_path: string;
  created_at: string;
};

const addedFmt = new Intl.DateTimeFormat("en-MY", {
  timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", year: "numeric",
});

export default async function SalonLookbookPreview({
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

  const [customerRes, staffRes, workRes] = await Promise.all([
    supabase
      .from("directory_entries")
      .select("id, name, note")
      .eq("project_id", projectId)
      .eq("module_key", "customers")
      .is("archived_at", null)
      .order("name")
      .limit(300),
    supabase
      .from("directory_entries")
      .select("id, name, archived_at")
      .eq("project_id", projectId)
      .eq("module_key", "staff")
      .order("name")
      .limit(100),
    supabase
      .from("lookbook_works")
      .select("id, title, category, level, formula, note, tags, stylist_id, photo_path, created_at")
      .eq("project_id", projectId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const customers = (customerRes.data ?? []) as { id: string; name: string; note: string }[];
  const staffRows = (staffRes.data ?? []) as { id: string; name: string; archived_at: string | null }[];
  const stylists = staffRows.filter((s) => !s.archived_at).map((s) => ({ id: s.id, name: s.name }));
  const nameOf = new Map(staffRows.map((s) => [s.id, s.name]));
  const rows = (workRes.data ?? []) as WorkRow[];

  // One call signs every photo. A path whose file has gone signs to nothing, and
  // that card simply has no photo -- it does not break the page.
  const paths = rows.map((r) => r.photo_path).filter(Boolean);
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from("job-photos").createSignedUrls(paths, 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
  }

  const works: LookCard[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    level: r.level,
    formula: r.formula,
    note: r.note,
    tags: r.tags ?? [],
    stylistName: r.stylist_id ? nameOf.get(r.stylist_id) ?? null : null,
    stylistColor: stylistDot(r.stylist_id),
    photoUrl: r.photo_path ? urlByPath.get(r.photo_path) ?? null : null,
    addedLabel: addedFmt.format(new Date(r.created_at)),
    addedAt: r.created_at,
  }));

  return (
    <>
      <MaterialSymbolsLink />
      <LookbookClient
        projectId={projectId}
        businessName={businessName}
        customers={customers}
        stylists={stylists}
        works={works}
      />
    </>
  );
}

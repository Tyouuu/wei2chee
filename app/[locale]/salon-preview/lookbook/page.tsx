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

/**
 * Founder's own Stitch source for "Hair Lookbook & Consultation Gallery"
 * (Task 405) -- ninth page touched in this cutover, and a different kind
 * of fix from the previous eight.
 *
 * ── Why this page didn't get a data conversion ──────────────────────────
 *
 * The other eight pages each had a real table to read from. This one's
 * own header already said the honest thing: "there is no lookbook table
 * yet" -- nothing in this schema models a shared, browsable style/formula
 * catalogue independent of any one customer. Inventing that table would be
 * new functional-foundation work (a new migration, a new RPC surface), not
 * a screen wired to something that already exists -- out of this pass's
 * lane. So the six looks stay sample content, same as before.
 *
 * ── What WAS real to fix: every button here was completely dead ────────
 *
 * Unlike the other eight pages (which all got at least an honest "isn't
 * wired up yet" alert on anything not backed by data), this page's buttons
 * -- Present Look, Apply to Ticket, Copy, Add Hairstyle Case, Present to
 * Client, the 3 quick-consultation panels, sort, pagination -- had zero
 * onClick handlers at all. That's the exact dead-button defect this whole
 * cutover has been closing everywhere else, and it wasn't fixed here just
 * because the surrounding data happens to be unreal.
 *
 * Two of them are made genuinely real, no schema required: Copy uses the
 * real clipboard API, and Present to Client uses the real Fullscreen API.
 * "Apply to Ticket" is real too, cross-feature: it appends the formula
 * text to a real customer's directory_entries.note (task 377's own
 * precedent for storing a colour formula on the customer's note field),
 * picked from the real customer list fetched below. Everything else that
 * has no real destination gets the same honest alert this whole cutover
 * uses.
 */
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

  const { data: customerRows } = await supabase
    .from("directory_entries")
    .select("id, name, note")
    .eq("project_id", projectId)
    .eq("module_key", "customers")
    .is("archived_at", null)
    .order("name")
    .limit(300);

  const customers = (customerRows ?? []) as { id: string; name: string; note: string }[];

  return (
    <>
      <MaterialSymbolsLink />
      <LookbookClient businessName={businessName} customers={customers} />
    </>
  );
}

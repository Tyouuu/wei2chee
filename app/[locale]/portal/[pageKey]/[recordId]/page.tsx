import { notFound } from "next/navigation";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { StyleScope } from "@/design-system/editor/style-scope";
import { loadRecordPage } from "../record-context";
import { RECORD_COPY } from "../record-copy";
import { NewRecordForm } from "../new/new-record-form";
import { ringgit } from "@/lib/portal/live-rows";

/**
 * 改这一单 — the page a row opens.
 *
 * ── WHY IT EXISTS ────────────────────────────────────────────────────────
 *
 * For a day and a half a business could write its own records and nothing
 * else: no edit, no archive, and the one correction that did exist --
 * reverse_ledger_entry -- had no button anywhere in the product. Type an
 * amount wrong and there was no way back.
 *
 * A record he can write and cannot fix is a record he keeps a second copy of
 * in WhatsApp, and then the system is the second copy.
 *
 * ── WHAT IT WILL NOT LET HIM DO ──────────────────────────────────────────
 *
 *   · change the document number  it is on paper somebody has already seen
 *   · edit money                  a ledger is corrected by an opposite entry,
 *                                 never by a rewrite -- 冲正, both kept
 *   · delete anything             收起来 instead: a lost job is next year's
 *                                 answer to 「上次我们报多少」
 *
 * The form is the same component as 加一单, on purpose: the boxes come from
 * the same columns, in the same language, and write through the same shape's
 * own function. Two forms would agree today and differ in a month.
 */

export default async function EditRecordPage({
  params,
}: {
  params: Promise<{ locale: string; pageKey: string; recordId: string }>;
}) {
  const { locale, pageKey, recordId } = await params;
  const ctx = await loadRecordPage(locale, pageKey);
  const copy = RECORD_COPY[ctx.lang];

  const supabase = await createSessionSupabaseClient();

  /* Read as the customer, so RLS is what bounds it -- a row id from somebody
     else's business simply is not there, and the page 404s rather than
     leaking that it exists. */
  const values: Record<string, string> = {};
  let archivedAt: string | null = null;
  let reversed = false;

  if (ctx.isDirectory) {
    const { data } = await supabase
      .from("directory_entries")
      .select("id, name, contact_person, phone, whatsapp, email, region, address, reg_no, tax_id, status, note, extra, archived_at")
      .eq("id", recordId)
      .eq("module_key", pageKey)
      .maybeSingle();
    if (!data) notFound();
    Object.assign(values, {
      primary: data.name ?? "",
      contact_person: data.contact_person ?? "",
      phone: data.phone ?? "",
      whatsapp: data.whatsapp ?? "",
      email: data.email ?? "",
      region: data.region ?? "",
      address: data.address ?? "",
      reg_no: data.reg_no ?? "",
      tax_id: data.tax_id ?? "",
      status: data.status ?? "",
      note: data.note ?? "",
    });
    Object.assign(values, ownColumns(data.extra));
    archivedAt = data.archived_at;
  } else if (ctx.shape === "ledger") {
    const { data } = await supabase
      .from("ledger_entries")
      .select("id, doc_no, note, party, amount_cents, adjusts_id, extra")
      .eq("id", recordId)
      .eq("module_key", pageKey)
      .maybeSingle();
    if (!data) notFound();
    /* The same three cells the table shows, so what he opens is what he
       clicked. Only the first is editable -- see the header. */
    Object.assign(values, {
      primary: (data.note ?? "").trim() || (data.doc_no ?? ""),
      secondary: data.party ?? "",
      amount: ringgit(data.amount_cents) ?? "",
    });
    Object.assign(values, ownColumns(data.extra));
    const { data: cancels } = await supabase
      .from("ledger_entries")
      .select("id")
      .eq("adjusts_id", recordId)
      .maybeSingle();
    reversed = !!cancels || !!data.adjusts_id;
  } else {
    const { data } = await supabase
      .from("pipeline_records")
      .select("id, title, party, amount_cents, stage, extra, archived_at")
      .eq("id", recordId)
      .eq("module_key", pageKey)
      .maybeSingle();
    if (!data) notFound();
    Object.assign(values, {
      primary: data.title ?? "",
      secondary: data.party ?? "",
      amount: ringgit(data.amount_cents) ?? "",
      status: data.stage ?? "",
    });
    Object.assign(values, ownColumns(data.extra));
    archivedAt = data.archived_at;
  }

  return (
    <StyleScope register={ctx.style} palette={ctx.palette} className="min-h-screen">
      <main className="mx-auto w-full max-w-[560px] px-6 py-10">
        <h1 className="ds-display [font-size:var(--text-title)] tracking-[var(--tracking-title)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.editHeading(ctx.title)}
        </h1>
        <p className="mt-1 mb-7 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {archivedAt ? copy.form.archived : copy.editLede}
        </p>
        <NewRecordForm
          projectId={ctx.projectId}
          moduleKey={ctx.pageKey}
          shape={ctx.shape as "pipeline" | "ledger" | "directory"}
          parties={ctx.parties}
          columns={ctx.columns}
          stages={ctx.stages}
          backHref={ctx.backHref}
          record={{ id: recordId, values, archivedAt, reversed }}
          copy={copy.form}
        />
      </main>
    </StyleScope>
  );
}

/** This business's own columns, back out of `extra`. Strings only, for the
 *  same reason the projection drops the rest: 「[object Object]」 in a box he
 *  is about to save is worse than an empty one. */
function ownColumns(extra: unknown): Record<string, string> {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(extra as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
    else if (typeof v === "number" || typeof v === "boolean") out[k] = String(v);
  }
  return out;
}

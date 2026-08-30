"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { TableColumn } from "@/lib/portal/table-model";

/**
 * 加一单 — the form a person fills in.
 *
 * ── WHY THIS EXISTS AT ALL ────────────────────────────────────────────────
 *
 * `add_pipeline_record` and `add_ledger_entry` were written as 「the RPC the
 * button calls」, and the assistant was routed through them so that it could
 * not have a private path (重点 23, AI 平权). Then a grep for their callers
 * found exactly one: the assistant. THE BUTTON WAS NEVER BUILT.
 *
 * So for a day the customer's own system could only be written to by talking
 * to an AI. That is not a system; it is a demo with a chatbot. This is the
 * other half of the rule -- the human path -- and it deliberately calls the
 * SAME function, from the browser, with the customer's own session, so RLS,
 * the document number, idempotency and the workflow's first stage all apply
 * without being restated here.
 *
 * ── WHY THE FIELDS ARE THE PAGE'S OWN COLUMNS ─────────────────────────────
 *
 * Every shop is different. A workshop adds 「车牌号」, a salon 「染发配方」.
 * Those columns already exist on their page, so the form is built from them
 * rather than from a fixed list -- which means nobody writes a form per trade,
 * and a column added five minutes ago has a box five minutes later.
 *
 * A column the record table does not own is stored in `extra`, keyed by that
 * column. That is the same wire sortCells() writes on the assistant's side.
 *
 * ── AND WHY A DIRECTORY PAGE IS THE EXCEPTION ─────────────────────────────
 *
 * On 客户 · 供应商 · 员工 the second column is headed 「联络方式 / 备注」 --
 * one blob over four structured columns. Building a single box for it would
 * put a phone number into prose, and `whatsapp` exists precisely because it
 * has to be a value a wa.me link can be built from (任务 48) and a
 * notification sent to (任务 59).
 *
 * So on that shape the built-in boxes come from the ENTRY, and the page's own
 * added columns still come from the table. The contact line the table shows is
 * composed back out of those fields by contactLine() in live-rows.ts.
 */

const BUILT_IN = new Set(["primary", "secondary", "amount", "status"]);

/** RM 48,500 · 48500.50 -> sen. Mirrors senFrom() in record-ops.ts, which is
 *  what the assistant's side uses; kept in both because the alternative is
 *  shipping a number parser to the browser through an API round trip. */
function senFrom(text: string): number | undefined {
  const m = text.replace(/[, ]/g, "").match(/-?\d+(\.\d{1,2})?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) ? Math.round(n * 100) : undefined;
}

export type NewRecordCopy = {
  save: string;
  saving: string;
  cancel: string;
  required: string;
  requiredName: string;
  failed: string;
  choose: string;
  more: string;
  less: string;
  whatsapp: string;
  phone: string;
  contactPerson: string;
  email: string;
  region: string;
  note: string;
};

export function NewRecordForm({
  projectId,
  moduleKey,
  shape,
  columns,
  stages,
  backHref,
  copy,
}: {
  projectId: string;
  moduleKey: string;
  /** Which of the three live shapes this page is. Not three booleans: a page
   *  is exactly one of them, and a boolean per shape is how two of them end up
   *  true. */
  shape: "pipeline" | "ledger" | "directory";
  columns: TableColumn[];
  /** This business's own workflow words. Empty on a ledger page, which has no
   *  stages -- its status is read from the money -- and on a directory page,
   *  where the status is a word about a person rather than a step. */
  stages: string[];
  backHref: string;
  copy: NewRecordCopy;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLedger = shape === "ledger";
  const isDirectory = shape === "directory";

  /* The status column is not typed on a ledger page: 订金 · 已入账 · 冲正 are
     read from the money and the allocation, so offering a box for it would be
     offering to write a value the page then overrules. */
  const tableFields = columns.filter((c) => !(isLedger && c.key === "status"));
  /* On a directory page the second column is a composed view, not a field --
     see the header. Everything the owner added himself still comes from here. */
  const shown = isDirectory
    ? tableFields.filter((c) => c.key !== "secondary")
    : tableFields;
  const titleCol = columns.find((c) => c.key === "primary") ?? shown[0];

  /* Collapsed by default and in this order on purpose. A contractor standing
     on a site adds a customer with a name and a number; everything below that
     is true of the record and not of the moment. Measured at 390px, where an
     eight-box form is a scroll before the save button. */
  const extraContact: { key: string; label: string; inputMode?: "tel" | "email" }[] =
    isDirectory
      ? [
          { key: "contact_person", label: copy.contactPerson },
          { key: "email", label: copy.email, inputMode: "email" },
          { key: "region", label: copy.region },
          { key: "note", label: copy.note },
        ]
      : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const title = (values[titleCol?.key ?? "primary"] ?? "").trim();
    if (!title) {
      setError(isDirectory ? copy.requiredName : copy.required);
      return;
    }
    setBusy(true);

    const extra: Record<string, string> = {};
    for (const c of shown) {
      const v = (values[c.key] ?? "").trim();
      if (v && !BUILT_IN.has(c.key)) extra[c.key] = v;
    }
    const party = (values.secondary ?? "").trim();
    const amount = senFrom(values.amount ?? "");

    const supabase = createBrowserSupabaseClient();
    /* One key per submission, so a double tap on a slow connection -- which is
       the normal way to use a phone on 4G -- is one document and not two. */
    const idempotencyKey = crypto.randomUUID();
    const { error: err } = isDirectory
      ? await supabase.rpc("add_directory_entry", {
          in_project_id: projectId,
          in_module_key: moduleKey,
          in_name: title,
          in_contact_person: (values.contact_person ?? "").trim(),
          in_phone: (values.phone ?? "").trim(),
          in_whatsapp: (values.whatsapp ?? "").trim(),
          in_email: (values.email ?? "").trim(),
          in_region: (values.region ?? "").trim(),
          in_status: (values.status ?? "").trim(),
          in_note: (values.note ?? "").trim(),
          in_extra: extra,
          in_idempotency_key: idempotencyKey,
        })
      : isLedger
      ? await supabase.rpc("add_ledger_entry", {
          in_project_id: projectId,
          in_module_key: moduleKey,
          in_amount_cents: amount ?? 0,
          in_party: party,
          in_note: title,
          in_extra: extra,
          in_idempotency_key: idempotencyKey,
        })
      : await supabase.rpc("add_pipeline_record", {
          in_project_id: projectId,
          in_module_key: moduleKey,
          in_title: title,
          in_party: party,
          in_amount_cents: amount ?? null,
          in_stage: (values.status ?? "").trim() || null,
          in_extra: extra,
          in_idempotency_key: idempotencyKey,
        });

    if (err) {
      /* His own words, then ours. A contractor reading 「duplicate key value
         violates unique constraint」 learns nothing he can act on, but hiding
         the reason entirely is how a stuck system looks like a broken one. */
      setError(`${copy.failed}${err.message ? ` — ${err.message}` : ""}`);
      setBusy(false);
      return;
    }
    router.push(backHref);
    router.refresh();
  }

  const control =
    "ds-control h-11 w-full [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]";
  const labelText =
    "[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]";

  function box(key: string, label: string, inputMode?: "tel" | "email" | "decimal") {
    return (
      <label key={key} className="flex flex-col gap-1.5">
        <span className={labelText}>{label}</span>
        <input
          inputMode={inputMode}
          value={values[key] ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          className={control}
        />
      </label>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {shown.map((c) => {
        if (c.key === "status" && stages.length) {
          return (
            <label key={c.key} className="flex flex-col gap-1.5">
              <span className={labelText}>{c.label}</span>
              <select
                value={values.status ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))}
                className={control}
              >
                <option value="">{copy.choose}</option>
                {stages.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        const node = box(
          c.key,
          c.label,
          /* `inputMode` and not `type=number`: a contractor types
             「RM 48,500」 and a number input silently discards the whole
             value. The parser handles the ringgit sign and the commas. */
          c.kind === "amount" ? "decimal" : undefined,
        );
        /* The two numbers go directly under the name, because on a directory
           page they are the reason the row exists. */
        if (!isDirectory || c.key !== "primary") return node;
        return (
          <div key="name-and-numbers" className="flex flex-col gap-4">
            {node}
            {box("whatsapp", copy.whatsapp, "tel")}
            {box("phone", copy.phone, "tel")}
          </div>
        );
      })}

      {extraContact.length ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="self-start [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas-dim)] underline"
          >
            {open ? copy.less : copy.more}
          </button>
          {open ? extraContact.map((f) => box(f.key, f.label, f.inputMode)) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]">
          {error}
        </p>
      ) : null}

      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 shrink-0 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] transition-colors [transition-duration:var(--dur)] hover:[background-color:var(--color-primary-deep)] disabled:opacity-60"
        >
          {busy ? copy.saving : copy.save}
        </button>
        <a href={backHref} className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)] underline">
          {copy.cancel}
        </a>
      </div>
    </form>
  );
}

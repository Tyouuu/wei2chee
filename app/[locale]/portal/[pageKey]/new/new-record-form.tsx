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

export function NewRecordForm({
  projectId,
  moduleKey,
  isLedger,
  columns,
  stages,
  backHref,
  copy,
}: {
  projectId: string;
  moduleKey: string;
  isLedger: boolean;
  columns: TableColumn[];
  /** This business's own workflow words. Empty for a ledger page, which has no
   *  stages -- its status is read from the money, not typed. */
  stages: string[];
  backHref: string;
  copy: {
    save: string;
    saving: string;
    cancel: string;
    required: string;
    failed: string;
    choose: string;
  };
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* The status column is not typed on a ledger page: 订金 · 已入账 · 冲正 are
     read from the money and the allocation, so offering a box for it would be
     offering to write a value the page then overrules. */
  const shown = columns.filter((c) => !(isLedger && c.key === "status"));
  const titleCol = columns.find((c) => c.key === "primary") ?? shown[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const title = (values[titleCol?.key ?? "primary"] ?? "").trim();
    if (!title) {
      setError(copy.required);
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
    const { error: err } = isLedger
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

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {shown.map((c) => (
        <label key={c.key} className="flex flex-col gap-1.5">
          <span className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">{c.label}</span>
          {c.key === "status" && stages.length ? (
            <select
              value={values.status ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))}
              className="ds-control h-11 w-full [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]"
            >
              <option value="">{copy.choose}</option>
              {stages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            <input
              /* `inputMode` and not `type=number`: a contractor types
                 「RM 48,500」 and a number input silently discards the whole
                 value. The parser handles the ringgit sign and the commas. */
              inputMode={c.kind === "amount" ? "decimal" : undefined}
              value={values[c.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [c.key]: e.target.value }))}
              className="ds-control h-11 w-full [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]"
            />
          )}
        </label>
      ))}

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

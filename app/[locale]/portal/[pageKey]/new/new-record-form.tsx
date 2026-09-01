"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { TableColumn } from "@/lib/portal/table-model";
import type { RecordFormCopy } from "../record-copy";
import { LineEditor, blankLine, senOf, totalOf, ringgitOf, type Line } from "./line-editor";

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

/** The lines as set_record_lines wants them: money in sen, blank rows dropped.
 *  A row he started and left empty is not a line he meant to write. */
function linesForDb(lines: Line[]) {
  return lines
    .filter((l) => l.description.trim())
    .map((l) => ({
      description: l.description.trim(),
      qty: l.qty.trim() || null,
      unit: l.unit.trim(),
      unit_price_cents: senOf(l.unitPrice) ?? null,
      amount_cents: senOf(l.amount) ?? 0,
    }));
}

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
  received,
  shape,
  parties,
  record,
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
  shape: "pipeline" | "ledger" | "directory" | "catalog";
  /** This business's own customers, for the name box. Empty on a directory
   *  page, which is where a party is created rather than chosen. */
  parties: { id: string; name: string }[];
  /**
   * The record being fixed, when there is one.
   *
   * ── WHY ONE COMPONENT AND NOT TWO ─────────────────────────────────────
   *
   * 加一单 and 改这一单 ask for the same things, from the same columns, in the
   * same language, and write through the same shape's own function. Two forms
   * would agree today and disagree in a month -- which is how a business ends
   * up able to record a plate number and unable to correct one.
   */
  /* 进货单 only, and only when it already has lines: a 收货 button on an
     order with nothing on it is a button that does nothing. `received` is read
     from the movements rather than from the stage, because the stage is a word
     the owner can type and the movements are the fact. */
  received?: boolean;
  record?: {
    id: string;
    /** Keyed the way the boxes are: built-in column keys plus this business's
     *  own, plus the directory fields. */
    values: Record<string, string>;
    archivedAt: string | null;
    /** Ledger only: it has been reversed already, so it cannot be again. */
    reversed?: boolean;
    /** 逐项明细, when this document has any. */
    lines?: Line[];
  };
  columns: TableColumn[];
  /** This business's own workflow words. Empty on a ledger page, which has no
   *  stages -- its status is read from the money -- and on a directory page,
   *  where the status is a word about a person rather than a step. */
  stages: string[];
  backHref: string;
  copy: RecordFormCopy;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(record?.values ?? {});
  /* 逐项. Only a document has them -- money is one entry and a person is not a
     list of things. */
  const [lines, setLines] = useState<Line[]>(record?.lines ?? []);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLedger = shape === "ledger";
  const isDirectory = shape === "directory";
  const isPipeline = shape === "pipeline";
  const isCatalog = shape === "catalog";
  /* 🔴 HOW MUCH IS LEFT IS NOT HIS TO TYPE, once the item exists.
     It is the sum of the movements (20260901070000), so a box here would be
     overwritten by the next render -- the same control-that-lies the money
     page was locked for. On a NEW item it IS his to type: that is the opening
     count, and it becomes the first movement. */
  const stockLocked = isCatalog && !!record;
  const canReceive = moduleKey === "purchases" && !!record && lines.length > 0;
  /* WITH LINES, THE TOTAL IS NOT HIS TO TYPE. The database recomputes it from
     them on every write (20260831150000), so a figure typed up there would be
     overwritten between pressing 保存 and the page reloading -- the same
     control-that-lies the money page was locked for this morning. */
  const totalFromLines = lines.length ? ringgitOf(totalOf(lines)) : null;

  /* The status column is not typed on a ledger page: 订金 · 已入账 · 冲正 are
     read from the money and the allocation, so offering a box for it would be
     offering to write a value the page then overrules. */
  const tableFields = columns.filter((c) => !(isLedger && c.key === "status"));
  /* On a directory page the second column is a composed view, not a field --
     see the header. Everything the owner added himself still comes from here. */
  const shown = isDirectory
    ? tableFields.filter((c) => c.key !== "secondary")
    : isCatalog
      /* 「仓库 · 包」 is a composed view of two fields, like a directory's
         contact line -- so it gets two boxes below rather than one here. And
         「充足 / 快没了」 is computed from the quantity and the reorder
         level, so offering a box for it offers to write a value the page then
         overrules. */
      ? tableFields.filter((c) => c.key !== "secondary" && c.key !== "status")
      : tableFields;
  const titleCol = columns.find((c) => c.key === "primary") ?? shown[0];

  /* Collapsed by default and in this order on purpose. A contractor standing
     on a site adds a customer with a name and a number; everything below that
     is true of the record and not of the moment. Measured at 390px, where an
     eight-box form is a scroll before the save button. */
  const extraContact: { key: string; label: string; inputMode?: "tel" | "email" }[] =
    isCatalog
      ? [
          { key: "reorder_at", label: copy.stockReorder },
          /* 一箱 = 24 罐. Collapsed because most trades buy and sell in the
             same unit; a wholesaler is the one who opens this (任务 61). */
          { key: "pack_size", label: copy.stockPackSize },
          { key: "pack_unit", label: copy.stockPackUnit },
          { key: "sku", label: "SKU" },
          { key: "note", label: copy.note },
        ]
      : isDirectory
      ? [
          { key: "contact_person", label: copy.contactPerson },
          { key: "email", label: copy.email, inputMode: "email" },
          { key: "region", label: copy.region },
          { key: "address", label: copy.address },
          /* ⚠️ 地址 · 公司注册号 · 税号 WERE HELD BACK ON PURPOSE, and the reason
             stopped being true on 2026-08-31. Until a record had a page of its
             own there was nowhere to show them back, and a box that swallows
             what he types is worse than no box. 改这一单 is that page.

             They matter beyond tidiness: MyInvois needs Buyer as a STRUCTURE
             with a TIN, not a line of text (任务 70), and this is where the
             only person who knows it types it in. */
          { key: "reg_no", label: copy.regNo },
          { key: "tax_id", label: copy.taxId },
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
    /* Exactly one match, case-insensitively, or nothing. The same rule the
       database uses: attaching a job to the wrong person because two of them
       share a name is worse than leaving it unlinked, and the typed text is
       kept either way. */
    const hits = parties.filter((x) => x.name.trim().toLowerCase() === party.toLowerCase());
    const partyId = hits.length === 1 ? hits[0].id : null;

    const supabase = createBrowserSupabaseClient();

    /* ── FIXING ONE, RATHER THAN WRITING ONE ──────────────────────────────
       Same boxes, same shape, same person's session -- a different function,
       because 「what this document says」 and 「what happened to this money」
       are not the same kind of change. See the header of migration
       20260831100000: a ledger's amount is never edited, it is reversed. */
    if (record) {
      const { error: fixErr } = isDirectory
        ? await supabase.rpc("update_directory_entry", {
            in_id: record.id,
            in_name: title,
            in_contact_person: (values.contact_person ?? "").trim(),
            in_phone: (values.phone ?? "").trim(),
            in_whatsapp: (values.whatsapp ?? "").trim(),
            in_email: (values.email ?? "").trim(),
            in_region: (values.region ?? "").trim(),
            in_address: (values.address ?? "").trim(),
            in_reg_no: (values.reg_no ?? "").trim(),
            in_tax_id: (values.tax_id ?? "").trim(),
            in_status: (values.status ?? "").trim(),
            in_note: (values.note ?? "").trim(),
            in_extra: extra,
          })
        : isLedger
        ? await supabase.rpc("update_ledger_words", {
            in_id: record.id,
            /* The note is what the first box holds on a money page -- it is
               「what this was for」, which is the only part of a payment a
               person may rewrite. */
            in_note: title,
          })
        : await supabase.rpc("update_pipeline_record", {
            in_id: record.id,
            in_title: title,
            in_party: party,
            in_party_id: partyId,
            in_amount_cents: amount ?? null,
            in_stage: (values.status ?? "").trim() || null,
            in_extra: extra,
            /* He cleared the name box: detach it, rather than silently
               keeping whoever it used to be attached to. */
            in_clear_party: !party && !partyId,
          });
      if (fixErr) {
        setError(`${copy.failed}${fixErr.message ? ` — ${fixErr.message}` : ""}`);
        setBusy(false);
        return;
      }
      /* The lines go through their own call, and AFTER the document exists --
         they are children of it. Written even when empty, because emptying the
         list is a real edit: it hands the total back to him. */
      if (isPipeline) {
        const { error: lineErr } = await supabase.rpc("set_record_lines", {
          in_record_id: record.id,
          in_lines: linesForDb(lines),
        });
        if (lineErr) {
          setError(`${copy.failed}${lineErr.message ? ` — ${lineErr.message}` : ""}`);
          setBusy(false);
          return;
        }
      }
      router.push(backHref);
      router.refresh();
      return;
    }

    /* One key per submission, so a double tap on a slow connection -- which is
       the normal way to use a phone on 4G -- is one document and not two. */
    const idempotencyKey = crypto.randomUUID();
    if (isCatalog) {
      const num = (k: string) => {
        const n = Number((values[k] ?? "").replace(/[^0-9.]/g, ""));
        return Number.isFinite(n) && (values[k] ?? "").trim() !== "" ? n : null;
      };
      const { data: item, error: itemErr } = await supabase.rpc("add_catalog_item", {
        in_project_id: projectId,
        in_module_key: moduleKey,
        in_name: title,
        in_unit: (values.unit ?? "").trim(),
        in_location: (values.location ?? "").trim(),
        in_sku: (values.sku ?? "").trim(),
        in_pack_size: num("pack_size"),
        in_pack_unit: (values.pack_unit ?? "").trim(),
        in_reorder_at: num("reorder_at"),
        in_note: (values.note ?? "").trim(),
        in_extra: extra,
        in_idempotency_key: idempotencyKey,
      });
      if (itemErr) {
        setError(`${copy.failed}${itemErr.message ? ` — ${itemErr.message}` : ""}`);
        setBusy(false);
        return;
      }
      /* THE OPENING COUNT BECOMES THE FIRST MOVEMENT, which is what ERPNext's
         `opening_stock` field does too. Its own idempotency key, derived from
         the item's, so a double tap does not count the shelf twice. */
      const opening = num("amount");
      if (item?.id && opening !== null && opening > 0) {
        await supabase.rpc("move_stock", {
          in_item_id: item.id,
          in_direction: "in",
          in_qty: opening,
          in_reason: copy.stockOpening,
          in_idempotency_key: idempotencyKey,
        });
      }
      router.push(backHref);
      router.refresh();
      return;
    }

    const { data, error: err } = isDirectory
      ? await supabase.rpc("add_directory_entry", {
          in_project_id: projectId,
          in_module_key: moduleKey,
          in_name: title,
          in_contact_person: (values.contact_person ?? "").trim(),
          in_phone: (values.phone ?? "").trim(),
          in_whatsapp: (values.whatsapp ?? "").trim(),
          in_email: (values.email ?? "").trim(),
          in_region: (values.region ?? "").trim(),
          in_address: (values.address ?? "").trim(),
          in_reg_no: (values.reg_no ?? "").trim(),
          in_tax_id: (values.tax_id ?? "").trim(),
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
          in_party_id: partyId,
          in_note: title,
          in_extra: extra,
          in_idempotency_key: idempotencyKey,
        })
      : await supabase.rpc("add_pipeline_record", {
          in_project_id: projectId,
          in_module_key: moduleKey,
          in_title: title,
          in_party: party,
          in_party_id: partyId,
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
    /* A new document's lines, once it has an id to hang them on. */
    if (isPipeline && lines.length) {
      const made = Array.isArray(data) ? data[0] : data;
      if (made?.id) {
        await supabase.rpc("set_record_lines", {
          in_record_id: made.id,
          in_lines: linesForDb(lines),
        });
      }
    }
    router.push(backHref);
    router.refresh();
  }

  /** 货到了 —— every line of this order becomes one stock movement.
   *
   *  Through the same function that has been proven against a real session
   *  (check:records ⑨). It cannot fire twice: each movement is anchored to
   *  the LINE that caused it, so a second press moves nothing. */
  async function receive() {
    setError(null);
    if (!record) return;
    setBusy(true);
    const { error: err } = await createBrowserSupabaseClient().rpc("receive_purchase", {
      in_record_id: record.id,
    });
    setBusy(false);
    if (err) {
      setError(`${copy.failed}${err.message ? ` — ${err.message}` : ""}`);
      return;
    }
    router.push(backHref);
    router.refresh();
  }

  /** 冲正 on a money page, 收起来 / 放回架上 everywhere else. One handler,
   *  because from the owner's side it is one thing: 「这一笔我要处理掉」. */
  async function correct() {
    setError(null);
    if (!record) return;
    setBusy(true);
    const supabase = createBrowserSupabaseClient();
    const { error: err } = isLedger
      ? await supabase.rpc("reverse_ledger_entry", { in_entry_id: record.id })
      : await supabase.rpc(
          isDirectory
            ? "set_directory_archived"
            : isCatalog
              ? "set_catalog_archived"
              : "set_pipeline_archived",
          { in_id: record.id, in_archived: !record.archivedAt },
        );
    if (err) {
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
    /* The party box offers his own customers. A `datalist` and not a select:
       a new customer typed straight in still has to work -- an owner writing a
       quotation for somebody he has not filed yet must not be stopped, and the
       name he types is what the row carries. */
    const list = key === "secondary" && parties.length ? `${key}-list` : undefined;
    /* ── A BOX THAT CANNOT BE SAVED MUST NOT BE TYPEABLE ──────────────────
       On a money page the amount and the counterparty are shown -- he opened
       this row to see what it says -- and update_ledger_words does not accept
       them, because money is corrected by an opposite entry and never by a
       rewrite. Leaving them editable meant typing a new amount, pressing 保存,
       and nothing happening: a control that lies about what it does, which is
       the one thing block-rules.ts forbids the assistant to draw and which we
       had drawn by hand.

       Found by looking at the screenshot; fifty database assertions and the
       whole suite were green. */
    const locked =
      (!!record && isLedger && key !== titleCol?.key) ||
      (key === "amount" && totalFromLines !== null);
    const shown = key === "amount" && totalFromLines !== null ? totalFromLines : values[key] ?? "";
    return (
      <label key={key} className="flex flex-col gap-1.5">
        <span className={labelText}>{label}</span>
        <input
          inputMode={inputMode}
          list={locked ? undefined : list}
          readOnly={locked}
          aria-readonly={locked || undefined}
          tabIndex={locked ? -1 : undefined}
          value={shown}
          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          className={locked ? `${control} cursor-default opacity-60` : control}
        />
        {list ? (
          <datalist id={list}>
            {parties.map((x) => (
              <option key={x.id} value={x.name} />
            ))}
          </datalist>
        ) : null}
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
        if (isCatalog && c.kind === "amount") {
          /* A COUNT, NOT A PRICE -- and read-only once the item exists. */
          return (
            <label key={c.key} className="flex flex-col gap-1.5">
              <span className={labelText}>
                {stockLocked ? copy.stockOnHand : copy.stockOpening}
              </span>
              <input
                inputMode="decimal"
                value={values.amount ?? ""}
                readOnly={stockLocked}
                aria-readonly={stockLocked || undefined}
                onChange={(e) => setValues((v) => ({ ...v, amount: e.target.value }))}
                className={`${control}${stockLocked ? " opacity-60" : ""}`}
              />
              {stockLocked ? (
                <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                  {copy.stockDerived}
                </span>
              ) : null}
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
        if (isCatalog && c.key === "primary") {
          /* Where it is and what it is counted in, directly under the name --
             on a shelf those two ARE the row. */
          return (
            <div key="name-and-shelf" className="flex flex-col gap-4">
              {node}
              {box("location", copy.stockWhere)}
              {box("unit", copy.stockUnit)}
            </div>
          );
        }
        if (!isDirectory || c.key !== "primary") return node;
        return (
          <div key="name-and-numbers" className="flex flex-col gap-4">
            {node}
            {box("whatsapp", copy.whatsapp, "tel")}
            {box("phone", copy.phone, "tel")}
          </div>
        );
      })}

      {isPipeline ? (
        <>
          <LineEditor lines={lines} onChange={setLines} copy={copy} />
          {totalFromLines ? (
            <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
              {copy.amountFromLines}
            </p>
          ) : null}
        </>
      ) : null}

      {extraContact.length ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="self-start [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas-dim)] underline"
          >
            {open ? copy.less : isCatalog ? copy.moreStock : copy.more}
          </button>
          {open ? extraContact.map((f) => box(f.key, f.label, f.inputMode)) : null}
        </div>
      ) : null}

      {record && isLedger ? (
        <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {copy.moneyFixed}
        </p>
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

        {/* ── THE TWO CORRECTIONS ────────────────────────────────────────
            Pushed to the right, away from 保存: they are not the ordinary
            thing to do on this page, and a destructive-looking action beside
            the primary one gets pressed by accident.

            冲正 is the ONLY way money is corrected -- an opposite entry, both
            kept -- and 收起来 is the only way anything leaves a list. Neither
            is a delete, and there is no delete: a lost job is next year's
            answer to 「上次我们报多少」. */}
        {canReceive ? (
          /* Left of 收起来 and drawn as a real button, because it is the one
             thing an owner opens a purchase order to do. Once the goods are in
             it says so instead, rather than offering a press that would be
             refused -- the same rule the money page follows for 冲正. */
          <span className="ml-auto flex items-center gap-3">
            {received ? (
              <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                {copy.receiveDone}
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={receive}
                title={copy.receiveHint}
                className="rounded-[var(--radius-md)] px-3.5 py-2 [font-size:var(--text-sm)] [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)] disabled:opacity-50"
              >
                {busy ? copy.receiving : copy.receive}
              </button>
            )}
          </span>
        ) : null}

        {record ? (
          <span className={canReceive ? "flex items-center gap-3" : "ml-auto flex items-center gap-3"}>
            {isLedger ? (
              <button
                type="button"
                disabled={busy || record.reversed}
                onClick={correct}
                title={record.reversed ? copy.reversed : copy.reverseHint}
                className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)] underline disabled:opacity-40 disabled:no-underline"
              >
                {busy ? copy.reversing : record.reversed ? copy.reversed : copy.reverse}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={correct}
                className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas-dim)] underline disabled:opacity-40"
              >
                {busy ? copy.archiving : record.archivedAt ? copy.unarchive : copy.archive}
              </button>
            )}
          </span>
        ) : null}
      </div>
    </form>
  );
}

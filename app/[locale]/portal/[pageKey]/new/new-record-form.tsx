"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { TableColumn } from "@/lib/portal/table-model";
import type { RecordFormCopy } from "../record-copy";
import { LineEditor, blankLine, senOf, totalOf, ringgitOf, type Line } from "./line-editor";
import { DocumentPreview } from "./document-preview";
import { validityKindOf, defaultDueOn } from "@/lib/portal/record-validity";
import { TermsEditor, termsForDb, blankTerm, priceRows, type TermRow } from "./terms-editor";
import { suggestedFor } from "@/lib/portal/payment-terms";
import {
  AllocationEditor,
  allocationsForDb,
  type AllocationRowInput,
} from "./allocation-editor";
import type { OpenDocument } from "../record-context";
import type { DocumentSettlement } from "@/lib/portal/allocations";

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
  title,
  today,
  stages,
  trade,
  openDocuments,
  settlement,
  backHref,
  copy,
}: {
  projectId: string;
  moduleKey: string;
  /** Which of the three live shapes this page is. Not three booleans: a page
   *  is exactly one of them, and a boolean per shape is how two of them end up
   *  true. */
  shape: "pipeline" | "ledger" | "directory" | "catalog" | "reconcile" | "calendar";
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
    /** 分期付款表, when he has written one. */
    terms?: TermRow[];
    /** 钱那一边：这笔钱已经分摊给哪几张单。 */
    allocations?: AllocationRowInput[];
    /** Its own document number, for the preview. Never present on a new one --
     *  next_doc_no() issues it inside the write, so anything shown before that
     *  would be a guess printed where the real number goes. */
    docNo?: string | null;
    /** 有效期 / 期限 / 预计到货 -- one column, three meanings, see
     *  lib/portal/record-validity.ts. Empty string and null both mean he has
     *  not set one; they are not different states to him. */
    dueOn?: string | null;
  };
  columns: TableColumn[];
  /** The module's own noun -- 报价单, 进货单 -- for the head of the document. */
  title: string;
  /**
   * Today, in Malaysia, worked out on the SERVER and passed down.
   *
   * ⚠️ Not `new Date()` in here. This component renders on both sides, the
   * server runs UTC and the owner is UTC+8, so between midnight and 8am they
   * would disagree -- the server would print yesterday, the browser today, and
   * React would throw away the hydrated tree. It is the same eight hours that
   * put today_myt() in the database (20260831030000).
   */
  today: string;
  /** This business's own workflow words. Empty on a ledger page, which has no
   *  stages -- its status is read from the money -- and on a directory page,
   *  where the status is a word about a person rather than a step. */
  stages: string[];
  /** 这一行是什么生意。只给分期付款表用来建议惯例，别的地方不读它。 */
  trade?: string | null;
  /** 这笔钱可以分摊给哪几张单。只有钱那几页、而且只有看得到钱的人拿得到。
   *  ⚠️ 空阵列的意思是「没有单可以分」，画面上要那样讲 —— 它跟「读不到」
   *  在这里长得一模一样，而那正是这个仓库被骗过四次的形状。 */
  openDocuments?: readonly OpenDocument[];
  /** 这张单收到多少。⚠️ null = **没有问**（他看不到钱），不是零 ——
   *  所以那一整段不画，而不是画一个 RM 0。 */
  settlement?: DocumentSettlement | null;
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
  const isReconcile = shape === "reconcile";
  const isCalendar = shape === "calendar";

  /* 单据上的那个日子。哪一个字，由模块决定 —— 报价单是有效期，进货单是
     预计到货，两句话不一样（lib/portal/record-validity.ts）。
     ⚠️ 只有报价单有预设（+30 天，照 ERPNext）。替他猜一个交货日填进去，
     比留白更糟：留白他会去填，一个猜的他会以为是真的。 */
  const dateKind = validityKindOf(moduleKey);
  const [dueOn, setDueOn] = useState<string>(
    record ? record.dueOn ?? "" : defaultDueOn(dateKind, today) ?? "",
  );

  /* 分期付款表。⚠️ 只在有金额的走单上 —— 一张任务单没有钱可以分期，
     给它一张分期表是给他一个永远填不了的框。 */
  const canStage = isPipeline && moduleKey !== "tasks";
  const [terms, setTerms] = useState<TermRow[]>(record?.terms ?? []);
  /* 这笔钱付了哪几张单。剩下的那一段是订金 —— 那不是错，是这门生意每天
     在发生的事（lib/portal/allocations.ts）。 */
  const [allocs, setAllocs] = useState<AllocationRowInput[]>(record?.allocations ?? []);
  /* 分摊只在钱那几页，而且只有拿得到那份清单的人（看得到钱的老板）。
     ⚠️ 冲正那一笔不给分摊 —— 它是撤销，资料库那边也会拒绝。 */
  const canAllocate = isLedger && !!openDocuments && !record?.reversed;
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
  const shown = isCalendar
    ? /* NONE OF THE TABLE'S COLUMNS EITHER. An appointment is two instants, a
         customer and a stylist; the table's first column is what it is FOR,
         which is one of its own boxes below. */
      []
    : isReconcile
    ? /* NONE OF THE TABLE'S COLUMNS. A reconciliation row is a COMPARISON:
         its first column is the month and the source together, its second is
         our own total, and its status is the gap -- three things the page
         computes and none of them things to type. Its own boxes are below. */
      []
    : isDirectory
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
    /* A reconciliation has no first column to type -- its identity is the month
       and the source. What it cannot be without is WHO GAVE THE FIGURE, which
       is the same check the writer makes and the same sentence the owner
       needs. */
    if (isReconcile) {
      if (!(values.source ?? "").trim()) {
        setError(copy.reconRequired);
        return;
      }
    } else if (isCalendar) {
      /* A BOOKING IS FOR SOMEBODY; TIME OFF IS NOT. Demanding a name to close
         his own shop for lunch would be the form arguing with him. */
      if ((values.kind ?? "booking") !== "block" && !(values.primary ?? "").trim()) {
        setError(copy.bookRequired);
        return;
      }
    } else if (!title) {
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
      if (isCalendar) {
        const day = (values.day ?? today).trim();
        const from = (values.from ?? "").trim();
        const to = (values.to ?? "").trim();
        const { error: bErr } = await supabase.rpc("update_appointment", {
          in_id: record.id,
          in_starts_at: new Date(`${day}T${from}`).toISOString(),
          in_ends_at: new Date(`${day}T${to}`).toISOString(),
          in_party: (values.primary ?? "").trim(),
          in_party_id: partyId,
          in_service: (values.service ?? "").trim(),
          in_note: (values.note ?? "").trim(),
          in_extra: extra,
          in_clear_party: !(values.primary ?? "").trim() && !partyId,
        });
        if (bErr) {
          setError(
            /already taken/i.test(bErr.message ?? "")
              ? copy.bookTaken
              : `${copy.failed}${bErr.message ? ` — ${bErr.message}` : ""}`,
          );
          setBusy(false);
          return;
        }
        router.push(backHref);
        router.refresh();
        return;
      }

      if (isReconcile) {
        const { error: rErr } = await supabase.rpc("update_reconciliation", {
          in_id: record.id,
          in_period: (values.period ?? "").trim() ? `${(values.period ?? "").trim()}-01` : null,
          in_source: (values.source ?? "").trim(),
          in_their_cents: senFrom(values.their ?? "") ?? 0,
          in_direction: (values.direction ?? "in").trim() || "in",
          in_reference: (values.reference ?? "").trim(),
          in_note: (values.note ?? "").trim(),
          in_extra: extra,
        });
        if (rErr) {
          setError(`${copy.failed}${rErr.message ? ` — ${rErr.message}` : ""}`);
          setBusy(false);
          return;
        }
        router.push(backHref);
        router.refresh();
        return;
      }

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
            in_due_on: dueOn || null,
            /* 同一个形状：他把日期删掉，就要真的删掉。函式那边 null 的意思是
               「这一栏不要动」，所以少了这一句，一个日子填进去就永远拿不掉
               （20260903010000）。 */
            in_clear_due_on: !!dateKind && !dueOn,
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
      /* 分摊也是整份换掉。空的也写 —— 把一笔钱从一张单上拿下来
         （变回订金）是一次真的编辑，跟清空分期表同一个道理。
         ⚠️ 只在这一页真的拿得到那份清单的时候才写：一个师傅打不开钱那几页，
         而万一有一天打得开，一次空的写入会把老板分好的全部清掉。 */
      if (isLedger && canAllocate) {
        const { error: allocErr } = await supabase.rpc("set_payment_allocations", {
          in_entry_id: record.id,
          in_rows: allocationsForDb(allocs),
        });
        if (allocErr) {
          setError(`${copy.failed}${allocErr.message ? ` — ${allocErr.message}` : ""}`);
          setBusy(false);
          return;
        }
      }
      /* 分期表也是整份换掉，跟明细同一个理由：半套改完的付款办法，
         是一份没有人同意过的合约。空的也写 —— 清空是一次真的编辑。 */
      if (canStage) {
        const { error: termErr } = await supabase.rpc("set_record_terms", {
          in_record_id: record.id,
          in_terms: termsForDb(terms),
        });
        if (termErr) {
          setError(`${copy.failed}${termErr.message ? ` — ${termErr.message}` : ""}`);
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

    if (isCalendar) {
      const day = (values.day ?? today).trim();
      const from = (values.from ?? "").trim();
      const to = (values.to ?? "").trim();
      if (!day || !from || !to) {
        setError(copy.bookRequired);
        setBusy(false);
        return;
      }
      /* Local wall-clock into an instant. `new Date("2026-09-03T10:00")` with
         no zone is read in the BROWSER's zone, which is the salon's -- which is
         what is wanted here and is why this is not built on the server. */
      const startsAt = new Date(`${day}T${from}`).toISOString();
      const endsAt = new Date(`${day}T${to}`).toISOString();
      const { error: bErr } = await supabase.rpc("add_appointment", {
        in_project_id: projectId,
        in_module_key: moduleKey,
        in_starts_at: startsAt,
        in_ends_at: endsAt,
        in_party: (values.primary ?? "").trim(),
        in_party_id: partyId,
        in_service: (values.service ?? "").trim(),
        in_kind: (values.kind ?? "booking").trim() || "booking",
        in_note: (values.note ?? "").trim(),
        in_extra: extra,
        in_idempotency_key: idempotencyKey,
      });
      if (bErr) {
        /* The clash gets his own sentence. 「conflicting key value violates
           exclusion constraint」 teaches a salon owner nothing he can act on --
           the database already raises 「that time is already taken」 and this
           says it in his language. */
        setError(
          /already taken/i.test(bErr.message ?? "")
            ? copy.bookTaken
            : `${copy.failed}${bErr.message ? ` — ${bErr.message}` : ""}`,
        );
        setBusy(false);
        return;
      }
      router.push(backHref);
      router.refresh();
      return;
    }

    if (isReconcile) {
      const { error: rErr } = await supabase.rpc("add_reconciliation", {
        in_project_id: projectId,
        in_module_key: moduleKey,
        /* 「2026-08」 from a month input becomes the first of that month. The
           writer rounds it anyway; sending a real date keeps the two ends
           agreeing rather than relying on one of them. */
        in_period: (values.period ?? "").trim() ? `${(values.period ?? "").trim()}-01` : null,
        in_source: (values.source ?? "").trim(),
        in_their_cents: senFrom(values.their ?? "") ?? 0,
        in_direction: (values.direction ?? "in").trim() || "in",
        in_reference: (values.reference ?? "").trim(),
        in_note: (values.note ?? "").trim(),
        in_extra: extra,
        in_idempotency_key: idempotencyKey,
      });
      if (rErr) {
        setError(`${copy.failed}${rErr.message ? ` — ${rErr.message}` : ""}`);
        setBusy(false);
        return;
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
          in_due_on: dueOn || null,
        });

    if (err) {
      /* His own words, then ours. A contractor reading 「duplicate key value
         violates unique constraint」 learns nothing he can act on, but hiding
         the reason entirely is how a stuck system looks like a broken one. */
      setError(`${copy.failed}${err.message ? ` — ${err.message}` : ""}`);
      setBusy(false);
      return;
    }
    /* A new document's lines and instalments, once it has an id to hang them on. */
    const made = Array.isArray(data) ? data[0] : data;
    if (isPipeline && lines.length && made?.id) {
      await supabase.rpc("set_record_lines", {
        in_record_id: made.id,
        in_lines: linesForDb(lines),
      });
    }
    if (canStage && terms.length && made?.id) {
      await supabase.rpc("set_record_terms", {
        in_record_id: made.id,
        in_terms: termsForDb(terms),
      });
    }
    if (isLedger && canAllocate && allocs.length && made?.id) {
      /* 🔴 分摊失败要讲出来，不可以吞掉。这笔钱已经记进去了，
         而他以为它已经分给那张单了 —— 那正是「说了没做」的形状。 */
      const { error: allocErr } = await supabase.rpc("set_payment_allocations", {
        in_entry_id: made.id,
        in_rows: allocationsForDb(allocs),
      });
      if (allocErr) {
        setError(`${copy.failed}${allocErr.message ? ` — ${allocErr.message}` : ""}`);
        setBusy(false);
        return;
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

  /* THE PAPER, BESIDE THE FORM THAT IS FILLING IT IN.
     Only on the pages that produce one. A name list and a shelf have no
     document, and drawing an empty sheet next to them would be decoration. */
  const paper = isPipeline ? (
    <DocumentPreview
      title={title}
      docNo={record?.docNo ?? null}
      values={{
        primary: values.primary,
        secondary: values.secondary,
        amount: values.amount,
        status: values.status,
      }}
      lines={lines}
      /* 有效期要印在那张纸上，不是只留在表单里 —— 一张没有印有效期的
         报价单，是一个永远有效的价钱。他填了才出现（重点：没填的东西
         不上线，一个占位符比一个诚实的空白更糟）。 */
      validity={
        dateKind && dueOn
          ? {
              label:
                dateKind === "validTill"
                  ? copy.validTill
                  : dateKind === "deadline"
                  ? copy.deadline
                  : copy.expected,
              value: dueOn,
            }
          : null
      }
      /* 分期表印在那张纸上。算术在 payment-terms.ts，这里只排版。
         ⚠️ 总数还不知道的时候，比例那几期印「—」不印 RM 0 —— 那两件事不一样。 */
      schedule={
        canStage
          ? (() => {
              const total =
                totalFromLines != null
                  ? senFrom(totalFromLines) ?? null
                  : senFrom(values.amount ?? "") ?? null;
              const priced = priceRows(terms, total);
              return priced.terms.map((t) => ({
                description: t.description,
                portionText: t.portion != null ? `${t.portion}%` : "",
                amountText:
                  t.portion != null && priced.documentCents == null ? "—" : ringgitOf(t.cents),
                due: t.due_on ?? "",
              }));
            })()
          : null
      }
      labels={{
        primary: columns.find((c) => c.key === "primary")?.label,
        secondary: columns.find((c) => c.key === "secondary")?.label,
        amount: columns.find((c) => c.key === "amount")?.label,
        status: columns.find((c) => c.key === "status")?.label,
      }}
      copy={copy}
      dateLabel={copy.previewDate}
      today={today}
    />
  ) : null;

  return (
    <div className={paper ? "grid gap-8 lg:grid-cols-2 lg:gap-10" : undefined}>
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

      {dateKind ? (
        <label className="flex flex-col gap-1.5">
          <span className={labelText}>
            {dateKind === "validTill"
              ? copy.validTill
              : dateKind === "deadline"
              ? copy.deadline
              : copy.expected}
          </span>
          <input
            type="date"
            value={dueOn}
            onChange={(e) => setDueOn(e.target.value)}
            className={control}
          />
          {/* 清空那颗。手机上的日期控件不一定给得了「清掉」这个动作,
              而一个填了就拿不掉的日子,是我们自己造的死结。 */}
          {dueOn ? (
            <button
              type="button"
              onClick={() => setDueOn("")}
              className="self-start [font-size:var(--text-xs)] underline text-[color:var(--color-on-canvas-dim)]"
            >
              {copy.dateClear}
            </button>
          ) : null}
        </label>
      ) : null}

      {isCalendar ? (
        <div className="flex flex-col gap-4">
          {/* A DAY AND TWO CLOCK TIMES, rather than one datetime box each. A
              salon owner books 「Saturday, 10 to 11」; making him type the date
              twice is the form describing the database instead of the day. */}
          <label className="flex flex-col gap-1.5">
            <span className={labelText}>{copy.bookDay}</span>
            <input
              type="date"
              value={values.day ?? today}
              onChange={(e) => setValues((v) => ({ ...v, day: e.target.value }))}
              className={control}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className={labelText}>{copy.bookFrom}</span>
              <input
                type="time"
                value={values.from ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, from: e.target.value }))}
                className={control}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelText}>{copy.bookTo}</span>
              <input
                type="time"
                value={values.to ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, to: e.target.value }))}
                className={control}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={labelText}>{copy.bookKind}</span>
            <select
              value={values.kind ?? "booking"}
              onChange={(e) => setValues((v) => ({ ...v, kind: e.target.value }))}
              className={control}
            >
              <option value="booking">{copy.bookKindBooking}</option>
              <option value="block">{copy.bookKindBlock}</option>
            </select>
          </label>
          {(values.kind ?? "booking") !== "block" ? (
            <>
              {box("primary", copy.bookWho)}
              {box("service", copy.bookService)}
            </>
          ) : null}
          {/* WHO IS DOING IT, from his own 师傅 page. A plain box and not a
              picker yet: the staff list is a directory like any other and the
              same datalist the customer box uses would need the staff rows,
              which this form is not given. Recorded rather than guessed. */}
          {box("staffName", copy.bookStaff)}
          {box("note", copy.note)}
        </div>
      ) : null}

      {isReconcile ? (
        <div className="flex flex-col gap-4">
          {/* THE MONTH, and a month input rather than a date one: the row IS a
              month, and offering a day would invite a value the writer then
              rounds away. */}
          <label className="flex flex-col gap-1.5">
            <span className={labelText}>{copy.reconPeriod}</span>
            <input
              type="month"
              value={values.period ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, period: e.target.value }))}
              className={control}
            />
          </label>
          {box("source", copy.reconSource)}
          {box("their", copy.reconTheirs, "decimal")}
          {/* WHAT THEIR FIGURE IS ABOUT. Without it a supplier's statement gets
              compared against the month's takings and reports a difference that
              is not one -- see the column comment in 20260902020000. */}
          <label className="flex flex-col gap-1.5">
            <span className={labelText}>{copy.reconDirection}</span>
            <select
              value={values.direction ?? "in"}
              onChange={(e) => setValues((v) => ({ ...v, direction: e.target.value }))}
              className={control}
            >
              <option value="in">{copy.reconIn}</option>
              <option value="out">{copy.reconOut}</option>
              <option value="net">{copy.reconNet}</option>
            </select>
          </label>
          {box("reference", copy.reconReference)}
          {box("note", copy.note)}
        </div>
      ) : null}

      {isPipeline ? (
        <>
          <LineEditor lines={lines} onChange={setLines} copy={copy} />
          {totalFromLines ? (
            <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
              {copy.amountFromLines}
            </p>
          ) : null}

        {canStage ? (
          <TermsEditor
            rows={terms}
            onChange={setTerms}
            /* 有明细的时候总数是明细算的，没有的时候是他打的 —— 分期表只要
               一个总数，不用知道它是哪来的。 */
            totalCents={totalFromLines != null ? senFrom(totalFromLines) ?? null : senFrom(values.amount ?? "") ?? null}
            suggested={
              suggestedFor(trade)?.map((t) => ({
                ...blankTerm(),
                /* 那三期的名字用他自己流程里的字，讲不出来就退回通用的那几个。
                   「订金」在装修是订金，在别的行业可能是别的字。 */
                description: copy.termDefaults[t.key] ?? t.key,
                portion: String(t.portion),
              })) ?? null
            }
            /* 哪一期收过钱。⚠️ undefined 的意思是「没有问」，不是「都没收」——
               所以师傅那一边整栏不画，不是画一排「未收」。 */
            paidByTerm={
              settlement
                ? Object.fromEntries(
                    settlement.terms.map((t) => [t.termId, { paidCents: t.paidCents, settled: t.settled }]),
                  )
                : undefined
            }
            copy={copy}
          />
          ) : null}

        {/* ── 这张单收到多少 ────────────────────────────────────────────
            画在分期表底下，因为它回答的正是分期表提出的那一句：
            「订金收了没有」。

            🔴 为什么不印在右边那张纸上：那张纸是**客人拿到的东西**，
            而一张报价单上印着「你已经付了 RM 14,550」是一份对帐单，
            不是一份报价。收到多少是**老板这一边**的答案。

            ⚠️ `settlement` 是 null 的时候整段不画 —— 那代表「没有问」
            （师傅看不到钱），不是「零」。 */}
        {settlement ? (
          <div className="flex flex-col gap-1 [border-radius:var(--radius-md)] border p-3 [border-color:var(--color-ink-800)]">
            <div className="flex items-baseline justify-between gap-4">
              <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                {copy.received}
              </span>
              <span className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] tabular-nums text-[color:var(--color-on-canvas)]">
                {settlement.anyPaid ? ringgitOf(settlement.paidCents) : copy.nothingReceived}
              </span>
            </div>
            {settlement.anyPaid ? (
              <div className="flex items-baseline justify-between gap-4">
                <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                  {copy.stillOwed}
                </span>
                <span className="[font-size:var(--text-sm)] tabular-nums text-[color:var(--color-on-canvas)]">
                  {settlement.settled ? copy.settledAll : ringgitOf(settlement.outstandingCents)}
                </span>
              </div>
            ) : null}
          </div>
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

      {/* 这笔钱付了哪几张单。⚠️ 画在 moneyFixed 上面：那一句讲的是
          「金额跟日子锁住了」，而分摊是这一页上他还改得动的东西 ——
          一句「不能改」底下接一个可以改的东西，读起来是坏的。 */}
      {canAllocate ? (
        <AllocationEditor
          rows={allocs}
          onChange={setAllocs}
          documents={openDocuments ?? []}
          entryCents={senFrom(values.amount ?? "") ?? null}
          copy={copy}
        />
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
    {paper}
    </div>
  );
}

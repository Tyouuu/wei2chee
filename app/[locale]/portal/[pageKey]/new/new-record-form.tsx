"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { TableColumn } from "@/lib/portal/table-model";
import type { RecordFormCopy } from "../record-copy";
import { LineEditor, blankLine, senOf, totalOf, ringgitOf, type Line } from "./line-editor";
import { useLineSuggestions, fillFromShelf } from "./line-suggest";
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
import { signedRinggit } from "@/lib/portal/profit";
import {
  AddressEditor,
  addressesForDb,
  type AddressRow,
} from "./address-editor";
import type { PartyAddress, PartyDebt } from "../record-context";
import { JobPhotos, type JobPhoto } from "./job-photos";
import { ChangeTrail } from "./change-trail";
import { Stocktake } from "./stocktake";
import type { ShownChange } from "@/lib/portal/change-log";

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


/** 标题旁边那颗按钮要指得到这张表单，而它画在表单外面。 */
const FORM_ID = "record-form";

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
  partyAddresses,
  partyDebts,
  branches,
  staff,
  jobs,
  categories,
  businessName,
  earnedValue,
  earnedLocked,
  photos,
  changes,
  settlement,
  earned,
  backHref,
  heading,
  lede,
  afterHeading,
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
    /** 名册那一边：这个对象的地址。 */
    addresses?: AddressRow[];
    /** 走单那一边：这张单是哪一个工地的。 */
    siteAddressId?: string | null;
    /** 哪一间店。 */
    branchId?: string | null;
    /** 那笔钱是谁做的。⚠️ 挑错人改得回来 —— 那不是钱，是一句关於谁的话。 */
    doneBy?: string | null;
    /** 这笔钱是干什么的（他自己的词）。 */
    category?: string | null;
    /** 这笔开销属於哪一单。⚠️ 只有出去的钱有 —— 进来的钱走分摊。 */
    jobId?: string | null;
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
  /** 这一家所有对象的地址。只有走单那几页拿得到 —— 名册页自己在编辑它们。 */
  partyAddresses?: readonly PartyAddress[];
  /** 谁欠我多少。只有走单那几页、只有看得到钱的人拿得到。 */
  partyDebts?: Readonly<Record<string, PartyDebt>>;
  /** 还在营业的分店。⚠️ 两间以上才画那个下拉 ——
   *  一个只有一个选项的下拉是一个假的控件，而一间店的生意占绝大多数。 */
  branches?: readonly { id: string; name: string }[];
  /** 这一家的师傅，给「谁做的」挑。⚠️ **一个人都没有就整个不画** ——
   *  一人公司占我们客户的大多数，而佣金是沙龙跟零售的东西（任务 67）。 */
  staff?: readonly { id: string; name: string }[];
  /** 这一家开过的单，给一笔开销挂上去。 */
  jobs?: readonly { id: string; docNo: string; title: string; party: string }[];
  /** 他自己打过的类别。空的是常态，也是诚实的 —— 我们不发明科目表。 */
  categories?: readonly string[];
  /** 他的公司名 —— 那张纸的抬头。见 document-preview.tsx。 */
  businessName?: string | null;
  /** 师傅那一页的「本月业绩」。
   *
   *  🔴 那一栏的名字模板自己就叫「This month / 本月业绩」，而它到今天为止
   *  是**一个他自己打字进去的框** —— 而底下那一段现在从收款算得出同一个
   *  数字。两个都留着，就是同一张页面上两个真相，而且没有任何东西讲
   *  哪一个是对的。所以这一格锁住，跟库存那一格「架上有几个」同一条：
   *  **一个是加起来的数字，就不该有人打得进去。**
   *
   *  ⚠️ `earnedValue === null` 的意思是**没有问**（读的人看不到钱），
   *  不是「零」—— 那时候格子照样锁住，只是里面空的。 */
  earnedValue?: string | null;
  earnedLocked?: boolean;
  /** 工地的照片。只有走单那几页有，而且只有存过的单才有地方挂。 */
  photos?: readonly JobPhoto[];
  /** 这一张被改过什么。⚠️ null = **没有问**（他看不到这本帐），
   *  不是「没有改过」—— 那两句在画面上要长得不一样。 */
  changes?: readonly ShownChange[] | null;
  /** 这张单收到多少。⚠️ null = **没有问**（他看不到钱），不是零 ——
   *  所以那一整段不画，而不是画一个 RM 0。 */
  settlement?: DocumentSettlement | null;
  /** 这一单赚多少。
   *  ⚠️ `null` = **没有问**（不是一张有钱的单，或者读的人看不到钱），
   *  不是「没赚」-- 那两句在画面上要长得不一样，所以 null 的时候整段不画。 */
  earned?: {
    paidCents: number;
    costCents: number;
    profitCents: number;
    byCategory: { name: string | null; cents: number }[];
  } | null;
  backHref: string;
  /**
   * 这一页的标题跟那一句说明。
   *
   * 🔴 **为什么它们从页面搬进这个元件里**（2026-09-04，照 arhamkhnz 的
   * `dashboard/invoice`）：参考页的主要动作在**标题右边**，不在表单底下。
   * 而那颗按钮要知道「现在正在存」（存的时候变成「保存中…」并且按不下去），
   * 那件事只有这个元件知道 —— 页面是伺服器画的，读不到它。
   *
   * 所以标题跟按钮住在一起。⚠️ 传进来的是**算好的字**，不是产生它的函式：
   * 函式过不了从伺服器到浏览器那一关，页面第一次打开就是一片「出错了」，
   * 而这件事就是这样被发现的（见页面档里那段注解）。
   */
  heading?: string;
  lede?: React.ReactNode;
  /**
   * 🔴 画在**标题底下、表单卡上面**的一段。
   *
   * 今天只有一个用它：预约那一页的「他来了没有」。
   *
   * 这一页其余每一段都在表单**底下**，因为那几段是读的。
   * 而那四颗是写的，而且是一间沙龙柜台一天按最多次的那一下 ——
   * 放在一张一千像素高的表单底下，客人站在面前而他要滑到底。
   *
   * ⚠️ **而它不可以在标题上面。** 我第一版就是那样搬的，
   *    看图当场看到：他还没看到这是哪一张预约，就先按了「来了」。
   *    那比原本要滑到底严重。
   */
  afterHeading?: React.ReactNode;
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
  /* 名册那一边：他的地址。
     ⚠️ 还没有地址行、而旧栏位里有一行字的时候，把那一行**读进编辑器** ——
     不然他打开一个有地址的老客户，看到的是一个空的地址清单，
     而那一行字躺在一个他再也看不到的栏位里。保存一次就搬过来了。 */
  const [addresses, setAddresses] = useState<AddressRow[]>(
    record?.addresses?.length
      ? record.addresses
      : (record?.values.address ?? "").trim()
      ? [
          {
            label: "",
            line: (record?.values.address ?? "").trim(),
            region: (record?.values.region ?? "").trim(),
            isBilling: true,
          },
        ]
      : [],
  );
  /* 表格那一行要讲得出他在哪里，而它读的是旧那两栏。所以保存的时候
     从这一行抄回去 —— 勾了帐单的那一行，没有就第一行。 */
  const primaryAddress =
    addresses.find((a) => a.isBilling && a.line.trim()) ??
    addresses.find((a) => a.line.trim()) ??
    null;
  /* 走单那一边：这张单是哪一个工地的。 */
  const [siteId, setSiteId] = useState<string>(record?.siteAddressId ?? "");
  /* 哪一间店。柱子 8-30 就立了，而它到 9-04 之前一直是 null ——
     因为没有任何东西填得进去（20260904110000）。 */
  const [branchId, setBranchId] = useState<string>(record?.branchId ?? "");
  const manyBranches = (branches?.length ?? 0) > 1;
  /* 那笔钱是谁做的。⚠️ 跟分店不一样，**一个师傅也要画** ——
     一间店只有一个是常态，而一个人做的活还是要挂在他名下才算得出佣金。 */
  const [doneBy, setDoneBy] = useState<string>(record?.doneBy ?? "");
  const anyStaff = (staff?.length ?? 0) > 0;
  /* 这笔钱是干什么的，跟它属於哪一单。20260904200000 --
     这两格是「这个月赚多少」算得出来的原因。 */
  const [category, setCategory] = useState<string>(record?.category ?? "");
  const [jobId, setJobId] = useState<string>(record?.jobId ?? "");
  /* 🔴 挂单**只有出去的钱**。进来的钱靠分摊回答「这一单收了多少」，
     再给它一个 job_id，同一个问题就有两个答案 -- 资料库那边会拒绝，
     而让他填完、保存了才知道，比现在不画糟。 */
  const spendsMoney = isLedger && moduleKey !== "payments";

  /* 这个客户的地址。⚠️ 用的是**跟保存时同一条**认人规矩：完全相符、
     而且只有一个 —— 两个同名的客户不准猜（20260901060000）。
     两边用同一条，是为了不让画面上挑得到的东西在保存的时候被拒绝。 */
  const chosenParty = (() => {
    const typed = (values.secondary ?? "").trim().toLowerCase();
    if (!typed) return null;
    const hits = parties.filter((x) => x.name.trim().toLowerCase() === typed);
    return hits.length === 1 ? hits[0].id : null;
  })();
  /* 🔴 不要再让他把同一行字打第二次（[任务 150] · [重点 29]）。
     他自己的货架 · 他打过的单位 · 上次卖给这个客人那几行 ——
     三支函式 20260905 就做好了，而画面上一个入口都没有。

     ⚠️ 用的是**跟上面同一个** `chosenParty`：认人的规矩只有一条，
     不然「上次那一张」会拿另一个人的单来填。 */
  const suggestions = useLineSuggestions({
    projectId,
    partyId: chosenParty,
    moduleKey,
    enabled: isPipeline,
  });
  const lineSuggest = {
    ...suggestions,
    fill: (l: Line) => fillFromShelf(l, suggestions.items),
  };

  const sitesForParty = (partyAddresses ?? []).filter((a) => a.partyId === chosenParty);
  /* 🔴 他换了客户，上一个客户的工地就不再属於这一张单。资料库会拒绝
     （'that address belongs to somebody else'），而让他保存之后才知道，
     比现在当成没挑糟。 */
  const siteOk = sitesForParty.some((a) => a.id === siteId) ? siteId : "";
  /* 🔴 他正要替一个已经欠钱的客户再开一张单。
     [任务 67] 量到 SQL Account 把「账龄 · 信用额度」列成 Customer 那一栏的卖点 ——
     一个批发商每天在做的判断就是这一句。
     ⚠️ **不挡他开单**：那个额度是他自己随手写的一个数字，
     而「这家老客户超一点没关系」是真的。我们讲事实，判断留给他。 */
  const debt = chosenParty ? partyDebts?.[chosenParty] : undefined;
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
          /* 🔴 `region` 跟 `address` 那两格拿掉了 —— 上面那个地址编辑器
             已经在写同一件事，而**同一个事实有两个写它的地方**，正是这个
             仓库最贵的那一类缺陷（他在一个格子里改了，另一格没变）。

             看图才看到的：新的「Addresses」编辑器画好之后，
             「Address, email and the rest」底下那两格还在。

             那两栏没有从资料库里拿掉：表格那一行的联络字串还在读它们
             （contactLine），所以它们变成一个**只有一个写它的人**的快取 ——
             保存的时候从「帐单寄这里」那一行抄回去，见下面。
             跟 allocated_cents 从今天起只有触发器在写，是同一个做法。 */
          /* ⚠️ 地址 · 公司注册号 · 税号 WERE HELD BACK ON PURPOSE, and the reason
             stopped being true on 2026-08-31. Until a record had a page of its
             own there was nowhere to show them back, and a box that swallows
             what he types is worse than no box. 改这一单 is that page.

             They matter beyond tidiness: MyInvois needs Buyer as a STRUCTURE
             with a TIN, not a line of text (任务 70), and this is where the
             only person who knows it types it in. */
          { key: "reg_no", label: copy.regNo },
          { key: "tax_id", label: copy.taxId },
          /* 最多让他欠多少。收在这里而不是第一层，因为大部分生意不用它 ——
             它是批发那一行的东西（任务 67）。 */
          { key: "credit_limit", label: copy.creditLimit, inputMode: "tel" },
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
            /* 旧的那两栏从「帐单寄这里」那一行抄过来。没有勾帐单的时候
               用第一个 —— 表格上那一行要讲得出他在哪里，而一个只有
               三个工地、没有帐单地址的客户，第一个工地就是答案。 */
            in_region: primaryAddress?.region ?? "",
            in_address: primaryAddress?.line ?? "",
            in_reg_no: (values.reg_no ?? "").trim(),
            in_tax_id: (values.tax_id ?? "").trim(),
            in_status: (values.status ?? "").trim(),
            in_note: (values.note ?? "").trim(),
            in_extra: extra,
            /* 最多让他欠多少。空的就是「不设上限」—— 而 null 的意思是
               「这一栏不要动」，所以要明确讲清空（20260904090000）。 */
            in_credit_limit_cents: senFrom(values.credit_limit ?? "") ?? null,
            in_clear_credit_limit: !(values.credit_limit ?? "").trim(),
          })
        : isLedger
        ? await supabase.rpc("update_ledger_words", {
            in_id: record.id,
            /* The note is what the first box holds on a money page -- it is
               「what this was for」, which is the only part of a payment a
               person may rewrite. */
            in_note: title,
            /* 挑错人是打字错误，不是一笔要留痕迹的更正 —— 改得回来。
               而 null 的意思是「这一栏不要动」，所以清空要另外讲
               （due_on · 工地 · 分店，同一个坑第四次）。 */
            in_done_by: doneBy || null,
            in_clear_done_by: !doneBy,
            /* 类别改得了 -- 它不是钱，是一句关於这笔钱的话。
               ⚠️ 空字串是「清空」，不是「不要动」：`coalesce` 在资料库那边
               看的是 null，而 `""` 是一个他真的打出来的值。 */
            in_category: category.trim(),
            /* 挂错单跟挂错人一样。清空要另一个参数讲（同一个坑第五次）。 */
            in_job_id: (spendsMoney && jobId) || null,
            in_clear_job_id: spendsMoney && !jobId,
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
            in_site_address_id: siteOk || null,
            /* 同一个形状：他把工地拿掉，就要真的拿掉。null 的意思是
               「这一栏不要动」，少了这一句，一个工地挂上去就永远拿不下来。 */
            in_clear_site: !siteOk,
            in_branch_id: branchId || null,
            in_clear_branch: !branchId,
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
      /* 地址整份换掉，跟明细/分期同一个形状。空的也写 —— 清空是一次真的编辑。
         ⚠️ 有单指着的地址，资料库那边会拒绝并且讲得出出路（20260903060000）。 */
      if (isDirectory) {
        const { error: addrErr } = await supabase.rpc("set_directory_addresses", {
          in_party_id: record.id,
          in_rows: addressesForDb(addresses),
        });
        if (addrErr) {
          setError(`${copy.failed}${addrErr.message ? ` — ${addrErr.message}` : ""}`);
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
          in_region: primaryAddress?.region ?? "",
          in_address: primaryAddress?.line ?? "",
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
          /* 🔴 钱那一边也要收 —— 只在报价单上填得了分店、收款填不了，
             就是他月底问「Puchong 收了多少」的时候答不出来。 */
          in_branch_id: branchId || null,
          /* 谁做的。佣金算在这上面（20260904120000）——
             没有它，月底那张表是空的。 */
          in_done_by: doneBy || null,
          /* 这笔钱是干什么的。 */
          in_category: category.trim() || "",
          /* 属於哪一单。⚠️ 只有出去的钱送 -- 见 spendsMoney。 */
          in_job_id: (spendsMoney && jobId) || null,
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
          in_site_address_id: siteOk || null,
          in_branch_id: branchId || null,
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
    if (isDirectory && addresses.length && made?.id) {
      /* 🔴 讲出来，不要吞掉。这个客户已经存进去了，而他以为地址也存了。 */
      const { error: addrErr } = await supabase.rpc("set_directory_addresses", {
        in_party_id: made.id,
        in_rows: addressesForDb(addresses),
      });
      if (addrErr) {
        setError(`${copy.failed}${addrErr.message ? ` — ${addrErr.message}` : ""}`);
        setBusy(false);
        return;
      }
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
              : /* 🔴 预约也有自己那一支，而这条链本来没有它 ——
                 那颗「收起来」在预约那一页画得出来，而按下去
                 打的是 `set_pipeline_archived`，那支函式根本找不到这一行。 */
                isCalendar
                ? "set_appointment_archived"
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

  /* 哪一间店。⚠️ 只有两间以上才画 —— 一个只有一个选项的下拉是一个
     假的控件，而一间店的生意占我们客户的绝大多数。 */
  const branchPicker = (
    <label className="flex flex-col gap-1.5">
      <span className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
        {copy.branch}
      </span>
      <select
        aria-label={copy.branch}
        value={branchId}
        onChange={(e) => setBranchId(e.target.value)}
        className="ds-control h-11 w-full [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]"
      >
        <option value="">{copy.branchAny}</option>
        {(branches ?? []).map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );

  /* 那笔钱是谁赚的。⚠️ 一个师傅也画（不像分店要两间以上）——
     一间店一个人是常态，而那一个人的活还是要挂在他名下，
     不然月底那张佣金表是空的。 */
  const doneByPicker = (
    <label className="flex flex-col gap-1.5">
      <span className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
        {copy.doneBy}
      </span>
      <select
        aria-label={copy.doneBy}
        value={doneBy}
        onChange={(e) => setDoneBy(e.target.value)}
        className="ds-control h-11 w-full [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]"
      >
        <option value="">{copy.doneByNone}</option>
        {(staff ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );

  /* 这笔钱是干什么的。
     🔴 `datalist` 不是 `select`，而理由跟客户那个框一样：**他自己的词就是
     产品**。一个固定清单等於逼全马来西亚的生意走同一份科目表，
     而一个新类别打进去就要能用。
     ⚠️ 而且这份清单是**他自己打过的**，不是我们编的 -- 任务 117 立过那一条：
     没有量过的行业就不建议。所以第一次是空的，那是诚实的。 */
  const categoryBox = (
    <label className="flex flex-col gap-1.5">
      <span className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
        {copy.category}
      </span>
      <input
        aria-label={copy.category}
        value={category}
        list={categories?.length ? "money-category-list" : undefined}
        onChange={(e) => setCategory(e.target.value)}
        placeholder={copy.categoryHint}
        className="ds-control h-11 w-full [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]"
      />
      {categories?.length ? (
        <datalist id="money-category-list">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      ) : null}
    </label>
  );

  /* 这笔开销属於哪一单。⚠️ 一张单都没有的时候整个不画 --
     一个只有「没有指定」的下拉是一个假控件。 */
  const jobPicker = (
    <label className="flex flex-col gap-1.5">
      <span className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
        {copy.forJob}
      </span>
      <select
        aria-label={copy.forJob}
        value={jobId}
        onChange={(e) => setJobId(e.target.value)}
        className="ds-control h-11 w-full [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]"
      >
        <option value="">{copy.forJobNone}</option>
        {(jobs ?? []).map((j) => (
          <option key={j.id} value={j.id}>
            {[j.docNo, j.title || j.party].filter(Boolean).join(" · ")}
          </option>
        ))}
      </select>
      <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
        {copy.forJobWhy}
      </span>
    </label>
  );

  const control =
    "ds-control h-11 w-full [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]";
  const labelText =
    "[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]";

  /** 一格。`half` = 这一格只占半行 —— 见表单那一行的 grid 上面那段注解。 */
  function box(
    key: string,
    label: string,
    inputMode?: "tel" | "email" | "decimal",
    half?: boolean,
  ) {
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
      <label key={key} data-half={half ? "" : undefined} className="flex flex-col gap-1.5">
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

        {/* 🔴 他正要替一个已经欠钱的客户再开一张单。
            画在这一格底下，因为那是他挑完人、还没写金额的那一刻 ——
            [任务 67] 量到 SQL Account 把「账龄 · 信用额度」列成 Customer
            那一栏的卖点，而一个批发商每天在做的判断就是这一句。

            ⚠️ 超过额度**不挡他开单**，也不是红字：那个额度是他自己随手写的
            一个数字，而「这家老客户超一点没关系」是真的。
            只有超过额度那半句用醒目色 —— 那一句是他自己讲过的话。 */}
        {/* ⚠️ `key === "secondary"` —— **只有对方那一格**。
            `box()` 是每一格共用的，而第一版把这一句放在它结尾、没有条件，
            所以同一句「他已经欠 RM 30,000」印在「工程」「客户」「报价」
            三格底下。读数全绿，看图一眼就看到。 */}
        {key === "secondary" && debt && debt.owedCents > 0 ? (
          <span className="[font-size:var(--text-xs)] tabular-nums text-[color:var(--color-on-canvas-dim)]">
            {copy.owesAlready} {ringgitOf(debt.owedCents)}
            {debt.oldestDays != null
              ? ` · ${copy.owesDays.replace("{n}", String(debt.oldestDays))}`
              : ""}
            {debt.limitCents != null && debt.owedCents > debt.limitCents ? (
              <span className="[font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]">
                {" · "}
                {copy.overLimit}
              </span>
            ) : null}
          </span>
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
      businessName={businessName}
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
      /* 🔴 哪一个工地，印在那张纸上。那不是一个内部栏位 ——
         师傅拿着这张纸出门，而一张讲不出去哪里的报价单他开不出门。
         只有他真的挑了才出现（没填的东西不上线）。 */
      site={
        siteOk
          ? (() => {
              const a = sitesForParty.find((x) => x.id === siteOk);
              return a
                ? { label: copy.site, value: [a.label, a.line].filter(Boolean).join(" · ") }
                : null;
            })()
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

  /* 存档那颗。同一颗画两个地方，宽的时候在标题右边、窄的时候在表单底下 ——
     两个地方永远只有一个看得见（另一个是 display:none，读屏也读不到它）。

     ⚠️ **窄的时候不放上面**，而这是判断不是偷懒：参考页那张表单只有八格，
     我们这一张有明细 · 分期 · 照片 · 分摊，手机上要滚很久。一个滚到底
     填完最后一格的人，要再滚回最上面才存得了 —— 那不是复刻，那是把一个
     在 1440 成立的决定，搬到一个它不成立的宽度上。 */
  const saveButton = (
    <button
      type="submit"
      form={FORM_ID}
      disabled={busy}
      className="inline-flex h-11 shrink-0 items-center [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [color:var(--color-on-primary)] [background-color:var(--color-primary)] transition-colors [transition-duration:var(--dur)] hover:[background-color:var(--color-primary-deep)] disabled:opacity-60"
    >
      {busy ? copy.saving : copy.save}
    </button>
  );

  return (
    <>
    {heading ? (
      <div className="mb-7 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="ds-display [font-size:var(--text-title)] tracking-[var(--tracking-title)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
            {heading}
          </h1>
          <p className="mt-1 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
            {lede}
          </p>
        </div>
        <div className="hidden @3xl:block">{saveButton}</div>
      </div>
    ) : null}
    {afterHeading ? <div className="mb-7">{afterHeading}</div> : null}
    <div className={paper ? "grid gap-8 lg:grid-cols-2 lg:gap-10" : undefined}>
    {/* 🔴 表单住进一张卡里（2026-09-04，照 arhamkhnz 的 dashboard/invoice）。
        它本来是一串标签跟输入框直接躺在页面的地上 —— 而参考页那一边是
        **一张白卡**，纸在右边、表单在左边，两块对称。
        没有卡的时候，左边读起来不是「一份要填的东西」，是「一些散落的框」，
        而右边那张纸有边有影，两边看起来像两个不同的产品。 */}
    {/* 🔴 短的那几格并排（2026-09-05，对着 arhamkhnz 的 dashboard/invoice 看）。

        `align:pages` 判这一页「一屏几块 8 对 1」。并排图看得很清楚：
        他们把成对的东西摆成一行（发出日期／到期日 · 税／折扣），而我们是
        **一栏到底** —— 五个框就占满一屏，明细跟分期表全部要滚下去才看得到。

        规矩只有一句：**名字那一格占整行，短的那几格占半行。**
        短的是数字 · 日期 · 状态 · 电话 —— 一个日期栏拉到 500px 宽，
        多出来的那 400px 不是给他填的地方，是他要多走的一段路。

        ⚠️ 用容器宽度不用视窗宽度：手机上这张表是整个屏幕宽，容器就是 390，
        `@3xl` 不成立，於是它自己回到一栏到底 —— 那在手机上是对的。 */}
    <form
      id={FORM_ID}
      onSubmit={submit}
      className="ds-card grid gap-4 @3xl:grid-cols-2 [&>*]:col-span-2 [&>[data-half]]:@3xl:col-span-1 [padding:var(--pad-card-lg)]"
    >
      {shown.map((c) => {
        if (c.key === "status" && stages.length) {
          return (
            <label key={c.key} data-half="" className="flex flex-col gap-1.5">
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
        /* 师傅那一页的「本月业绩」。跟库存那一格同一条：算出来的数字
           没有人打得进去。 */
        if (earnedLocked && c.kind === "amount") {
          return (
            <label key={c.key} data-half="" className="flex flex-col gap-1.5">
              <span className={labelText}>{c.label}</span>
              <input
                value={earnedValue ?? ""}
                readOnly
                aria-readonly
                aria-label={c.label}
                onChange={() => {}}
                className={`${control} opacity-60`}
              />
              <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                {copy.earnedDerived}
              </span>
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
              {/* 🔴 那一句「数量是算出来的」讲的是**为什么这一格锁住**，
                  而它到今天为止就停在那里 —— 没有任何画面呼叫得到
                  `move_stock`（新增货品那一次开帐除外）。所以一个货品建好
                  之后，破了三包水泥就再也记不进去。盘点接在那一句底下，
                  因为那一句正好是他读到「那我怎么改」的那一刻。 */}
              {stockLocked && record ? (
                <Stocktake
                  itemId={record.id}
                  onHand={(() => {
                    const n = Number((values.amount ?? "").replace(/[^\d.-]/g, ""));
                    return Number.isFinite(n) ? n : null;
                  })()}
                  unit={values.unit ?? ""}
                  /* 一箱几个。他打了「1 箱 = 24 罐」，从今天起有东西读它。 */
                  packSize={(() => {
                    const n = Number((values.pack_size ?? "").replace(/[^\d.]/g, ""));
                    return Number.isFinite(n) && n > 0 ? n : null;
                  })()}
                  packUnit={values.pack_unit ?? ""}
                  /* 记完把新的数量放回这一格。见 Stocktake 的档头 ——
                     少了这一句，资料库变了而画面上那个数字不动。 */
                  onCounted={(n) => setValues((v) => ({ ...v, amount: String(n) }))}
                  copy={copy}
                />
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
          /* 金额是短的那一种。名字不是 —— 一个工程的名字要写得下
             「Taman Desa 三房翻新」。 */
          c.kind === "amount",
        );
        /* The two numbers go directly under the name, because on a directory
           page they are the reason the row exists. */
        if (isCatalog && c.key === "primary") {
          /* Where it is and what it is counted in, directly under the name --
             on a shelf those two ARE the row. */
          return (
            <div
              key="name-and-shelf"
              className="grid gap-4 @3xl:grid-cols-2 [&>*]:col-span-2 [&>[data-half]]:@3xl:col-span-1"
            >
              {node}
              {box("location", copy.stockWhere, undefined, true)}
              {box("unit", copy.stockUnit, undefined, true)}
            </div>
          );
        }
        if (!isDirectory || c.key !== "primary") return node;
        return (
          <div
            key="name-and-numbers"
            className="grid gap-4 @3xl:grid-cols-2 [&>*]:col-span-2 [&>[data-half]]:@3xl:col-span-1"
          >
            {node}
            {/* 两个号码本来就是一对，而且两个都短。 */}
            {box("whatsapp", copy.whatsapp, "tel", true)}
            {box("phone", copy.phone, "tel", true)}
          </div>
        );
      })}

      {dateKind ? (
        /* 日期是短的那一种 —— 参考那一页把发出日期跟到期日摆成一行。 */
        <label data-half="" className="flex flex-col gap-1.5">
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

      {/* 他的地址。一格自由文字装不下「帐单一个地方、工地两三个」。 */}
      {isDirectory ? (
        <AddressEditor rows={addresses} onChange={setAddresses} copy={copy} />
      ) : null}

      {isPipeline ? (
        <>
          {/* ── 这张单是哪一个工地的 ──────────────────────────────────
              🔴 只有那个客户**真的有两个以上地址**的时候才出现。
              一个永远只有一个选项的下拉，是一个假的控件；而这个客户只有
              一个地址的时候，「哪一个工地」这个问题本来就没有第二个答案。 */}
          {sitesForParty.length > 1 ? (
            <label className="flex flex-col gap-1.5">
              <span className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
                {copy.site}
              </span>
              <select
                aria-label={copy.site}
                value={siteOk}
                onChange={(e) => setSiteId(e.target.value)}
                className="ds-control h-11 w-full [padding-inline:var(--pad-control-x)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none focus-visible:[border-color:var(--color-primary)]"
              >
                <option value="">{copy.sitePick}</option>
                {sitesForParty.map((a) => (
                  <option key={a.id} value={a.id}>
                    {[a.label, a.line].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {/* 工地的照片。画在明细上面 —— 师傅打开这一单要看的第一件事
              是「上次拆开来长什么样」，不是价钱。 */}
          <JobPhotos
            recordId={record?.id ?? null}
            projectId={projectId}
            photos={photos ?? []}
            copy={copy}
          />

          {manyBranches ? branchPicker : null}

          <LineEditor lines={lines} onChange={setLines} copy={copy} suggest={lineSuggest} />
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

            {/* ── 这一单赚多少 ──────────────────────────────────────────
                🔴 他**还没有挂过任何开销**的时候，不写「赚 RM X」——
                那时候「赚」会等於「收到」，而这一页在宣称一件它不知道的事：
                这一单的成本我们一个字都没有。换成一句告诉他怎么让它算得出来。 */}
            {earned ? (
              earned.costCents > 0 ? (
                <>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                      {copy.jobSpent}
                    </span>
                    <span className="[font-size:var(--text-sm)] tabular-nums text-[color:var(--color-on-canvas)]">
                      {ringgitOf(earned.costCents)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 border-t [border-color:var(--color-ink-800)] pt-2">
                    <span className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
                      {copy.jobEarned}
                    </span>
                    <span
                      className={`[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] tabular-nums ${
                        earned.profitCents < 0
                          ? "text-[color:var(--color-clay-bright)]"
                          : "text-[color:var(--color-on-canvas)]"
                      }`}
                    >
                      {signedRinggit(earned.profitCents) ?? "RM 0"}
                    </span>
                  </div>
                  {/* 🔴 这一单还没收齐的时候，上面那一行讲的是
                      **到目前为止的现金**，不是这一单最后赚多少 ——
                      而那一行是加粗的、人真正会读的那一行。看图才看到的。 */}
                  {settlement && settlement.outstandingCents > 0 ? (
                    <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                      {copy.jobKeptSoFar}
                    </p>
                  ) : null}
                  {earned.byCategory.length ? (
                    <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                      {earned.byCategory
                        .map(
                          (c) =>
                            `${c.name ?? copy.jobNoCategory} ${ringgitOf(c.cents)}`,
                        )
                        .join(" · ")}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                  {copy.jobNoCosts}
                </p>
              )
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
            /* ⚠️ `min-h-11`：一颗只有一行字的按钮画出来只有 21px 高，
               而工地上那根拇指按不准 21px。shoot:commission 在 390 量到的。 */
            className="inline-flex min-h-11 items-center self-start [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas-dim)] underline"
          >
            {open ? copy.less : isCatalog ? copy.moreStock : copy.more}
          </button>
          {open ? extraContact.map((f) => box(f.key, f.label, f.inputMode)) : null}
        </div>
      ) : null}

      {/* 这笔钱付了哪几张单。⚠️ 画在 moneyFixed 上面：那一句讲的是
          「金额跟日子锁住了」，而分摊是这一页上他还改得动的东西 ——
          一句「不能改」底下接一个可以改的东西，读起来是坏的。 */}
      {isLedger ? categoryBox : null}
      {spendsMoney && (jobs?.length ?? 0) > 0 ? jobPicker : null}
      {isLedger && manyBranches ? branchPicker : null}
      {isLedger && anyStaff ? doneByPicker : null}

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

      {/* 改过什么。画在最后 —— 它是读的，不是填的，而且它是老板才看得到的
          那一段（`changes` 是 null 的时候整段不画）。 */}
      {record ? <ChangeTrail rows={changes ?? null} copy={copy} /> : null}

      {error ? (
        <p role="alert" className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]">
          {error}
        </p>
      ) : null}

      <div className="mt-2 flex items-center gap-3">
        {/* 🔴 底下这一颗，在**有纸的那几页留着**（报价单 · 订单 · 进货单）。
            看图量的：那一张填完是 1,400px 高，滚到最后一格的人眼前只剩一颗
            「取消」—— 一张长表最底下最显眼的东西是取消，那是一个陷阱。
            短的那几页（客户 · 收款 · 货品）只有上面那一颗，跟参考页一样：
            那几页一屏就看得完，两颗存档会同时出现在眼睛里。 */}
        <div className={heading && !paper ? "@3xl:hidden" : undefined}>{saveButton}</div>
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
                className="inline-flex min-h-11 items-center [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas-dim)] underline disabled:opacity-40"
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
    </>
  );
}

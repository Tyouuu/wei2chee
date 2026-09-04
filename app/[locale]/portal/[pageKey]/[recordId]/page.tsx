import { notFound } from "next/navigation";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { StyleScope } from "@/design-system/editor/style-scope";
import { loadRecordPage } from "../record-context";
import { RECORD_COPY } from "../record-copy";
import { todayInMalaysia } from "@/lib/portal/live-months";
import { NewRecordForm } from "../new/new-record-form";
import { ringgit } from "@/lib/portal/live-rows";
import { reversedIds, settleDocument, type DocumentSettlement } from "@/lib/portal/allocations";
import { PartyJobs, type PartyJob } from "../new/party-jobs";
import { PartyHistory } from "../new/party-history";
import { CommissionPanel, type CommissionTier } from "../new/commission-panel";
import { PackagesPanel, type PackageRow } from "../new/packages-panel";
import type { JobPhoto } from "../new/job-photos";
import { showChanges, type ShownChange, type ChangeRow } from "@/lib/portal/change-log";
import { priceSchedule } from "@/lib/portal/payment-terms";

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
  /* 正在改的这一笔要从「这张单收到多少」里扣掉 —— 不然分摊编辑器会把
     同一笔钱减两次（record-context.ts 的 excludeEntryId）。 */
  const ctx = await loadRecordPage(locale, pageKey, recordId);
  const copy = RECORD_COPY[ctx.lang];

  const supabase = await createSessionSupabaseClient();

  /* Read as the customer, so RLS is what bounds it -- a row id from somebody
     else's business simply is not there, and the page 404s rather than
     leaking that it exists. */
  const values: Record<string, string> = {};
  let archivedAt: string | null = null;
  let reversed = false;
  let received = false;
  /* 逐项. Read back in the order he wrote them -- a quotation whose lines come
     back shuffled is a different quotation. */
  let docNo: string | null = null;
  /* 有效期 / 期限 / 预计到货 —— 同一栏 due_on，字由模块决定。 */
  let dueOn: string | null = null;
  let lines: {
    description: string;
    qty: string;
    unit: string;
    unitPrice: string;
    amount: string;
  }[] = [];
  /* 分期付款表。跟明细一样按他写的顺序读回来 —— 一份读错顺序的分期表
     是另一份付款办法。 */
  let terms: {
    id?: string;
    description: string;
    portion: string;
    amount: string;
    dueOn: string;
  }[] = [];
  /* 钱那一边：这笔钱已经分摊给哪几张单。 */
  let allocations: { recordId: string; termId: string; amount: string }[] = [];
  /* 名册那一边：这个对象的地址。 */
  let addresses: { id: string; label: string; line: string; region: string; isBilling: boolean }[] = [];
  /* 走单那一边：这张单是哪一个工地的。 */
  let siteAddressId: string | null = null;
  /* 哪一间店。读得回来，不然他每次打开都是「不分店」——
     而那会在下一次保存的时候把分店清掉。 */
  let branchId: string | null = null;
  /* 那笔钱是谁做的（20260904120000）。 */
  let doneBy: string | null = null;
  /* 工地的照片。⚠️ 网址是签出来的、会过期的 —— 桶是 private 的，
     因为那是他客户家里，不是官网（20260904010000）。 */
  let photos: JobPhoto[] = [];
  /* 这一张被改过什么。⚠️ null = 没有问（他看不到这本帐），不是「没有改过」。 */
  let changes: ShownChange[] | null = null;
  /* 客户页那一边：他有几单，还欠多少。 */
  let jobs: PartyJob[] = [];
  let owing: number | null = null;
  /* 他来过几次、上一次什么时候、一共多少。
     ⚠️ 前两个不是钱（师傅要知道这位是熟客），第三个是。 */
  let visits = 0;
  let lastOn: string | null = null;
  let spentCents: number | null = null;
  /* 师傅那一页：他的抽成，跟这个月他做了多少（20260904120000）。
     ⚠️ `null` = **没有问**（这一页不是师傅、或者读的人看不到钱），
     不是「没有抽成」—— 那两句在画面上要长得不一样。 */
  /* 他的套票。⚠️ `null` = **没有问**（这一页不是客户页），不是「他没有套票」。
     ⚠️ 而它**不看 role** —— 一个师傅要跟客人讲「你还剩三次」，
     而那张表上没有金额（20260904190000 的档头）。 */
  let packages: PackageRow[] | null = null;
  let tiers: CommissionTier[] | null = null;
  /* 这个月算在他名下的收款。⚠️ 它同时喂两个地方：底下那一段，
     跟表单里那一格「本月业绩」—— 而那一格从今天起是**锁住**的，
     因为它现在是算出来的（模板本来就把那一栏叫「This month」，
     而它到今天为止是一个他自己打字进去的框）。 */
  let earnedCents = 0;
  /* 单据那一边：这张单收到多少、还欠多少。
     ⚠️ null 的意思是**没有问**（他看不到钱），不是「零」—— 画面照这个
     决定要不要画那一整段。 */
  let settlement: DocumentSettlement | null = null;

  if (ctx.isDirectory) {
    const { data } = await supabase
      .from("directory_entries")
      .select("id, name, contact_person, phone, whatsapp, email, region, address, reg_no, tax_id, status, note, credit_limit_cents, extra, archived_at")
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
      /* 读得回来，不然他每次打开那一格都是空的 —— 而空的意思是
         「不设上限」，所以那会在他下一次保存的时候把额度清掉。 */
      credit_limit: data.credit_limit_cents == null ? "" : ringgit(data.credit_limit_cents) ?? "",
    });
    Object.assign(values, ownColumns(data.extra));
    archivedAt = data.archived_at;

    /* 他的地址。帐单一个地方，工地另一个（20260903060000）。 */
    const { data: addrRows } = await supabase
      .from("directory_addresses")
      .select("id, label, line, region, is_billing")
      .eq("party_id", recordId)
      .order("sort_order");
    /* ── 他有几单在跑，还欠我多少 ──────────────────────────────────────
       两句的答案本来就在库里，只是从来没有人在这一页问过（任务 81）。
       🔴 「还欠」只问看得到钱的人 —— 一个师傅拿回来的是空的，
       而空的会画成「他还欠 RM 48,500」，对一个已经付清的客户撒谎。 */
    const { data: jobRows } = await supabase
      .from("pipeline_records")
      .select("id, module_key, doc_no, title, stage, amount_cents")
      .eq("party_id", recordId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    const jobIds = (jobRows ?? []).map((j: { id: string }) => j.id);
    jobs = (jobRows ?? []).map(
      (j: {
        id: string; module_key: string; doc_no: string | null;
        title: string | null; stage: string | null; amount_cents: number | null;
      }) => ({
        id: j.id,
        href: `/${locale}/portal/${j.module_key}/${j.id}`,
        docNo: j.doc_no ?? "",
        title: j.title ?? "",
        stage: j.stage ?? "",
        amount: ringgit(j.amount_cents) ?? "",
        page: j.module_key,
      }),
    );

    /* ── 他来过几次 ────────────────────────────────────────────────────
       🔴 **含收起来的**：一件做完收档的工作，还是来过一次。
       上面那份 `jobs` 是「在跑的」，故意排掉了收起来的 —— 两个问题，
       两个查询，而不是拿同一份清单去回答两句不一样的话。

       ⚠️ 沙龙的「来过」是预约，不是报价单。所以两张表都数。 */
    const [{ count: jobCount }, { count: bookCount }] = await Promise.all([
      supabase
        .from("pipeline_records")
        .select("id", { count: "exact", head: true })
        .eq("party_id", recordId),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("party_id", recordId),
    ]);
    visits = (jobCount ?? 0) + (bookCount ?? 0);

    if (visits > 0) {
      const [{ data: lastJob }, { data: lastBook }] = await Promise.all([
        supabase
          .from("pipeline_records")
          .select("issued_on")
          .eq("party_id", recordId)
          .order("issued_on", { ascending: false })
          .limit(1),
        supabase
          .from("appointments")
          .select("starts_at")
          .eq("party_id", recordId)
          .order("starts_at", { ascending: false })
          .limit(1),
      ]);
      const days = [
        (lastJob ?? [])[0]?.issued_on ?? null,
        ((lastBook ?? [])[0]?.starts_at ?? "").slice(0, 10) || null,
      ].filter(Boolean) as string[];
      lastOn = days.length ? days.sort().at(-1) ?? null : null;
    }

    /* 「一共多少」是钱。 */
    if (ctx.role === "owner") {
      const { data: spentRows } = await supabase
        .from("pipeline_records")
        .select("amount_cents")
        .eq("party_id", recordId);
      spentCents = (spentRows ?? []).reduce(
        (n: number, r: { amount_cents: number | null }) => n + (r.amount_cents ?? 0),
        0,
      );
    }

    /* ── 客户那一页：他还剩几次 ────────────────────────────────────────
       剩几次是 `package_balance` 数出来的，不是存起来的一栏。
       ⚠️ 只在客户页 —— 套票是卖给客人的（资料库那边也是这样挡的）。 */
    if (pageKey === "customers") {
      const { data: packRows } = await supabase
        .from("package_balance")
        .select("package_id, name, sessions_total, sessions_left, sold_on, expires_on, expired")
        .eq("party_id", recordId)
        .is("archived_at", null)
        .order("sold_on", { ascending: false });
      packages = ((packRows ?? []) as {
        package_id: string; name: string | null; sessions_total: number;
        sessions_left: number; sold_on: string; expires_on: string | null; expired: boolean;
      }[]).map((x) => ({
        id: x.package_id,
        name: x.name ?? "",
        total: Number(x.sessions_total),
        left: Number(x.sessions_left),
        soldOn: x.sold_on,
        expiresOn: x.expires_on,
        expired: !!x.expired,
      }));
    }

    /* ── 师傅那一页：抽成跟这个月 ──────────────────────────────────────
       🔴 只在 `staff` 那一页，而且只问看得到钱的人。佣金是薪水，
       而薪水在这个 schema 里从来不是共用的（commission_tiers 的 policy
       就是 sees_money，`staff_earnings` 第一行也是）。 */
    if (ctx.role === "owner" && pageKey === "staff") {
      const month = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kuala_Lumpur",
        year: "numeric",
        month: "2-digit",
      })
        .format(new Date())
        .slice(0, 7);
      const [{ data: tierRows }, { data: earnRows }] = await Promise.all([
        supabase
          .from("commission_tiers")
          .select("id, from_cents, percent")
          .eq("party_id", recordId)
          .order("from_cents"),
        supabase.rpc("staff_earnings", { in_project_id: ctx.projectId, in_month: month }),
      ]);
      tiers = ((tierRows ?? []) as { id: string; from_cents: number; percent: number }[]).map(
        (t) => ({
          id: t.id,
          /* 存的是分，他打的是块。「500000」在那个框里对他没有意义。 */
          from: String(Number(t.from_cents) / 100),
          /* 「10.00」回来是 numeric(5,2)；他打的是 10。 */
          percent: String(Number(t.percent)),
        }),
      );
      earnedCents = Number(
        ((earnRows ?? []) as { party_id: string; earned_cents: number }[]).find(
          (r) => r.party_id === recordId,
        )?.earned_cents ?? 0,
      );
    }

    if (ctx.role === "owner" && jobIds.length) {
      const { data: allocRows } = await supabase
        .from("ledger_allocations")
        .select("entry_id, record_id, term_id, amount_cents")
        .in("record_id", jobIds);
      const entryIds = [...new Set((allocRows ?? []).map((a: { entry_id: string }) => a.entry_id))];
      const { data: entryRows } = entryIds.length
        ? await supabase.from("ledger_entries").select("id, adjusts_id").in("id", entryIds)
        : { data: [] };
      const gone = reversedIds((entryRows ?? []) as { id: string; adjusts_id: string | null }[]);
      const facts = ((entryRows ?? []) as { id: string; adjusts_id: string | null }[]).map((e) => ({
        id: e.id,
        adjusts_id: e.adjusts_id,
        reversed: gone.has(e.id),
      }));
      owing = (jobRows ?? []).reduce((n: number, j: { id: string; amount_cents: number | null }) => {
        const s = settleDocument({
          documentCents: j.amount_cents,
          allocations: ((allocRows ?? []) as {
            entry_id: string; record_id: string; term_id: string | null; amount_cents: number;
          }[]).filter((a) => a.record_id === j.id),
          entries: facts,
        });
        return n + s.outstandingCents;
      }, 0);
    }

    addresses = (addrRows ?? []).map(
      (a: { id: string; label: string | null; line: string | null; region: string | null; is_billing: boolean | null }) => ({
        id: a.id,
        label: a.label ?? "",
        line: a.line ?? "",
        region: a.region ?? "",
        isBilling: !!a.is_billing,
      }),
    );
  } else if (ctx.shape === "catalog") {
    /* Two reads, because the thing and how much of it there is live in two
       places on purpose -- see 20260901070000. The quantity comes from the
       view and is shown locked; changing it means recording a movement, which
       is the only honest way to change a total that is a sum. */
    const { data } = await supabase
      .from("catalog_items")
      .select("id, name, unit, location, sku, pack_size, pack_unit, reorder_at, note, extra, archived_at")
      .eq("id", recordId)
      .eq("module_key", pageKey)
      .maybeSingle();
    if (!data) notFound();
    const { data: hand } = await supabase
      .from("stock_on_hand")
      .select("on_hand")
      .eq("item_id", recordId)
      .maybeSingle();
    Object.assign(values, {
      primary: data.name ?? "",
      unit: data.unit ?? "",
      location: data.location ?? "",
      sku: data.sku ?? "",
      /* numeric(14,3) comes back as 「24.000」; he typed 24. */
      pack_size: data.pack_size == null ? "" : String(Number(data.pack_size)),
      pack_unit: data.pack_unit ?? "",
      reorder_at: data.reorder_at == null ? "" : String(Number(data.reorder_at)),
      note: data.note ?? "",
      amount: hand?.on_hand == null ? "0" : String(Number(hand.on_hand)),
    });
    Object.assign(values, ownColumns(data.extra));
    archivedAt = data.archived_at;
  } else if (ctx.shape === "calendar") {
    const { data } = await supabase
      .from("appointments")
      .select("id, starts_at, ends_at, kind, party, service, note, extra, archived_at")
      .eq("id", recordId)
      .eq("module_key", pageKey)
      .maybeSingle();
    if (!data) notFound();
    /* The instant back into the day and two clock times the form asks for, IN
       MALAYSIA. `toISOString().slice(11,16)` would give UTC and a 10am
       appointment would open at 02:00 -- the same eight hours, and here it is
       not a rounding question, it is who turns up when. */
    const parts = (iso: string) => {
      const got = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kuala_Lumpur",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(new Date(iso));
      const at = (type: string) => got.find((x) => x.type === type)?.value ?? "";
      /* 24-hour, and Intl says 「24」 for midnight in some locales where a time
         input wants 「00」. en-CA with hour12:false gives 24 for the hour that
         starts a day, which a <input type="time"> refuses outright. */
      const hour = at("hour") === "24" ? "00" : at("hour");
      return {
        day: `${at("year")}-${at("month")}-${at("day")}`,
        time: `${hour}:${at("minute")}`,
      };
    };
    const from = parts(data.starts_at);
    const to = parts(data.ends_at);
    Object.assign(values, {
      day: from.day,
      from: from.time,
      to: to.time,
      kind: data.kind ?? "booking",
      primary: data.party ?? "",
      service: data.service ?? "",
      note: data.note ?? "",
    });
    Object.assign(values, ownColumns(data.extra));
    archivedAt = data.archived_at;

  } else if (ctx.shape === "reconcile") {
    /* Read from the TABLE and not from the view: what is being edited is what
       the outside said, and our own side is not editable -- it is the sum of
       the ledger and there is deliberately no column holding it. */
    const { data } = await supabase
      .from("reconciliations")
      .select("id, period, source, direction, their_cents, reference, note, extra, archived_at")
      .eq("id", recordId)
      .eq("module_key", pageKey)
      .maybeSingle();
    if (!data) notFound();
    Object.assign(values, {
      /* A month input wants 「2026-08」, and the column holds the first of the
         month. Sliced off the digits, never through new Date(): the server runs
         UTC and the owner is UTC+8, so a first-of-month parsed as UTC is the
         last day of the previous month to him. */
      period: (data.period ?? "").slice(0, 7),
      source: data.source ?? "",
      direction: data.direction ?? "in",
      their: data.their_cents == null ? "" : String(Number(data.their_cents) / 100),
      reference: data.reference ?? "",
      note: data.note ?? "",
    });
    Object.assign(values, ownColumns(data.extra));
    archivedAt = data.archived_at;
  } else if (ctx.shape === "ledger") {
    const { data } = await supabase
      .from("ledger_entries")
      .select("id, doc_no, note, party, amount_cents, adjusts_id, branch_id, done_by, extra")
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
    branchId = data.branch_id ?? null;
    /* 读得回来，不然他每次打开都是「没有指定」—— 而那会在下一次保存的
       时候把「谁做的」清掉，而他不会知道自己刚刚删掉了一个人的业绩。 */
    doneBy = data.done_by ?? null;

    /* 这笔钱已经分摊给哪几张单。⚠️ `ledger_allocations` 是 sees_money，
       所以一个师傅拿回来的是空的 —— 而他根本打不开这一页
       （canOpenModule 在 loadRecordPage 里已经挡掉了）。 */
    const { data: allocRows } = await supabase
      .from("ledger_allocations")
      .select("record_id, term_id, amount_cents")
      .eq("entry_id", recordId)
      .order("created_at");
    allocations = (allocRows ?? []).map(
      (a: { record_id: string; term_id: string | null; amount_cents: number }) => ({
        recordId: a.record_id,
        termId: a.term_id ?? "",
        amount: ringgit(a.amount_cents) ?? "",
      }),
    );
  } else {
    const { data } = await supabase
      .from("pipeline_records")
      /* doc_no for the preview's head. It exists on a saved document and
         never on a new one -- next_doc_no() issues it inside the write -- so
         this is the only place it can honestly come from. */
      .select("id, doc_no, title, party, amount_cents, stage, due_on, site_address_id, branch_id, extra, archived_at")
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
    docNo = data.doc_no ?? null;
    dueOn = data.due_on ?? null;
    siteAddressId = data.site_address_id ?? null;
    branchId = data.branch_id ?? null;
    archivedAt = data.archived_at;

    const { data: rows } = await supabase
      .from("record_lines")
      .select("description, qty, unit, unit_price_cents, amount_cents")
      .eq("record_id", recordId)
      .order("sort_order");

    /* 分期付款表。他写的原话读回来 —— 比例存的是 30，不是 RM 14,550，
       所以画面上那个金额是算出来的（lib/portal/payment-terms.ts）。 */
    const { data: termRows } = await supabase
      .from("record_terms")
      .select("id, description, portion, amount_cents, due_on")
      .eq("record_id", recordId)
      .order("sort_order");
    terms = (termRows ?? []).map((t) => ({
      id: t.id,
      description: t.description ?? "",
      /* 「30.00」 回来是 numeric(5,2)；他打的是 30，看到的也该是 30。 */
      portion: t.portion == null ? "" : String(Number(t.portion)),
      amount: t.amount_cents == null ? "" : ringgit(t.amount_cents) ?? "",
      dueOn: t.due_on ?? "",
    }));
    /* ── 工地的照片 ────────────────────────────────────────────────────
       存的是路径，签的是网址。一小时 —— 够他看完一单，而一个永不过期的
       网址等於把一个 private 的桶变成公开的。 */
    const { data: picRows } = await supabase
      .from("record_photos")
      .select("id, path, caption")
      .eq("record_id", recordId)
      .order("sort_order")
      .order("created_at");
    if ((picRows ?? []).length) {
      const { data: signed } = await supabase.storage
        .from("job-photos")
        .createSignedUrls((picRows ?? []).map((x: { path: string }) => x.path), 3600);
      /* ⚠️ 每一个都可能签失败（那个档案不在了），所以型别上 signedUrl 是
         可空的 —— 而它就是可空的，不要断言掉它。 */
      const urlByPath = new Map<string, string>(
        (signed ?? [])
          .filter((x) => !!x.path && !!x.signedUrl)
          .map((x) => [x.path as string, x.signedUrl as string]),
      );
      photos = ((picRows ?? []) as { id: string; path: string; caption: string | null }[])
        .map((x) => ({
          id: x.id,
          path: x.path,
          caption: x.caption ?? "",
          url: urlByPath.get(x.path) ?? "",
        }))
        /* 签不出来的那一张不画。一张破掉的图比少一张糟 ——
           而「签不出来」通常表示那个档案已经不在了。 */
        .filter((x) => x.url);
    }

    /* ── 这张单收到多少 ────────────────────────────────────────────────
       🔴 只问看得到钱的人。一个师傅问 `ledger_allocations` 拿回来的是空的，
       而空的会画成「还欠 RM 48,500」—— 一张已经收齐的单，对他撒谎。
       所以是**整段不画**，不是画一个 0（20260903030000 的档头）。 */
    if (ctx.role === "owner") {
      const { data: allocRows } = await supabase
        .from("ledger_allocations")
        .select("entry_id, record_id, term_id, amount_cents")
        .eq("record_id", recordId);
      const entryIds = [...new Set((allocRows ?? []).map((a: { entry_id: string }) => a.entry_id))];
      const { data: entryRows } = entryIds.length
        ? await supabase.from("ledger_entries").select("id, adjusts_id").in("id", entryIds)
        : { data: [] };
      const gone = reversedIds((entryRows ?? []) as { id: string; adjusts_id: string | null }[]);
      /* 每一期今天等於多少 —— 比例存的是 30，不是 RM 14,550。
         `settleDocument` 要这个才答得出「这一期收齐了没有」。 */
      const dueByTerm = Object.fromEntries(
        priceSchedule(
          (termRows ?? []).map((t) => ({
            description: t.description ?? "",
            portion: t.portion,
            amount_cents: t.amount_cents,
          })),
          data.amount_cents,
        ).terms.map((t, i) => [(termRows ?? [])[i]?.id as string, t.cents]),
      );
      settlement = settleDocument({
        dueByTerm,
        documentCents: data.amount_cents,
        allocations: (allocRows ?? []) as {
          entry_id: string; record_id: string; term_id: string | null; amount_cents: number;
        }[],
        entries: ((entryRows ?? []) as { id: string; adjusts_id: string | null }[]).map((e) => ({
          id: e.id,
          adjusts_id: e.adjusts_id,
          reversed: gone.has(e.id),
        })),
      });
    }

    /* Whether goods from THIS order are already on a shelf. Read from the
       movements and not from the stage: the stage is a word the owner can type
       and change, the movements are the fact. */
    if (pageKey === "purchases") {
      const { count } = await supabase
        .from("stock_moves")
        .select("id", { count: "exact", head: true })
        .eq("against_id", recordId);
      received = (count ?? 0) > 0;
    }

    lines = (rows ?? []).map((r) => ({
      description: r.description ?? "",
      /* 「2.500」 comes back from numeric(14,3); he typed 2.5 and that is what
         he should see again. */
      qty: r.qty == null ? "" : String(Number(r.qty)),
      unit: r.unit ?? "",
      unitPrice: ringgit(r.unit_price_cents) ?? "",
      amount: ringgit(r.amount_cents) ?? "",
    }));
  }

  /* ── 改过什么 ────────────────────────────────────────────────────────
     🔴 只问看得到钱的人。`record_changes` 的 policy 就是 sees_money，
     所以师傅问它拿回来的是空的 —— 而空的会画成「从来没有人改过」，
     那是一句假话。所以问都不问，整段不画。 */
  if (ctx.role === "owner") {
    const { data: changeRows } = await supabase
      .from("record_changes")
      .select("id, entity, entity_id, label, field, was, now_is, changed_by, created_at")
      .eq("entity_id", recordId)
      .order("created_at", { ascending: false })
      .limit(30);
    /* 谁改的。查得到名字才印 —— 一串 uuid 对他没有意义。
       ⚠️ 这个 schema 里没有「员工叫什么」那一栏，只有他登入的 email
       （`list_project_members`，20260901030000）。所以印的是 @ 前面那一段：
       `ahmad@…` 印「ahmad」。那不是他的真名，而**它是我们真的有的东西** ——
       编一个名字出来比印一段 email 糟得多。
       他哪天真的加了一栏名字，改这一句就好。 */
    const { data: members } = await supabase.rpc("list_project_members");
    const names = Object.fromEntries(
      ((members ?? []) as { user_id: string; email: string | null }[])
        .filter((m) => (m.email ?? "").includes("@"))
        .map((m) => [m.user_id, (m.email ?? "").split("@")[0]]),
    );
    changes = showChanges(
      ((changeRows ?? []) as {
        id: string; entity: string; entity_id: string; label: string | null;
        field: string; was: string | null; now_is: string | null;
        changed_by: string | null; created_at: string;
      }[]).map((r) => ({
        id: r.id,
        entity: r.entity as ChangeRow["entity"],
        entityId: r.entity_id,
        label: r.label ?? "",
        field: r.field,
        was: r.was,
        nowIs: r.now_is,
        changedBy: r.changed_by,
        createdAt: r.created_at,
      })),
      {
        lang: ctx.lang,
        blank: copy.form.changeBlank,
        /* 那一页自己的栏名赢：「金额」在报价单上是他自己给它的名字。 */
        labels: Object.fromEntries(
          ctx.columns.map((c) => [
            c.key === "primary" ? "title" : c.key === "secondary" ? "party" : c.key === "amount" ? "amount_cents" : c.key === "status" ? "stage" : c.key,
            c.label,
          ]),
        ),
        names,
      },
    );
  }

  return (
    <StyleScope register={ctx.style} palette={ctx.palette} className="min-h-screen">
      {/* Wider when there is a document beside the form. A quotation is the
          only thing this system makes that somebody outside the business
          reads, and 560px cannot hold the form and the paper. */}
      <main
        className={`mx-auto w-full px-6 py-10 ${
          ctx.shape === "pipeline" ? "max-w-[1080px]" : "max-w-[560px]"
        }`}
      >
        <h1 className="ds-display [font-size:var(--text-title)] tracking-[var(--tracking-title)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
          {copy.editHeading(ctx.title)}
        </h1>
        <p className="mt-1 mb-7 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
          {archivedAt ? copy.form.archived : copy.editLede}
        </p>
        <NewRecordForm
          projectId={ctx.projectId}
          moduleKey={ctx.pageKey}
          received={received}
          shape={ctx.shape as "pipeline" | "ledger" | "directory" | "catalog" | "reconcile" | "calendar"}
          parties={ctx.parties}
          columns={ctx.columns}
          title={ctx.title}
          today={todayInMalaysia()}
          stages={ctx.stages}
          trade={ctx.trade}
          backHref={ctx.backHref}
          openDocuments={ctx.openDocuments}
          partyAddresses={ctx.partyAddresses}
          partyDebts={ctx.partyDebts}
          branches={ctx.branches}
          staff={ctx.staff}
          earnedLocked={pageKey === "staff"}
          earnedValue={tiers ? ringgit(earnedCents) ?? "RM 0" : null}
          photos={photos}
          changes={changes}
          record={{ id: recordId, values, archivedAt, reversed, lines, terms, allocations, addresses, siteAddressId, branchId, docNo, dueOn, doneBy }}
          settlement={settlement}
          copy={copy.form}
        />

        {/* 他的单子。画在表单**底下**，因为它是读的，不是填的 ——
            而一个客户页上的第二颗「保存」会让他不知道按哪一颗。
            ⚠️ 只在名册页上。 */}
        {/* ⚠️ 师傅那一页不画这两段。
            两段读的都是 `party_id`，而 `party_id` 只会是客户或供应商 ——
            一个师傅永远不会是一张单的对方。所以在他那一页上，
            这两段**永远**写着「还没有来过」跟「还没有单」，
            而一段永远说同一句话的段落，读起来是这一页没做完。 */}
        {ctx.isDirectory && pageKey !== "staff" ? (
          <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
            <PartyHistory
              visits={visits}
              lastOn={lastOn}
              spentCents={spentCents}
              copy={copy.form}
            />
            <div className="mt-6">
              <PartyJobs jobs={jobs} owing={owing} copy={copy.form} />
            </div>
          </div>
        ) : null}

        {/* 客户那一页多一段：他还剩几次。
            ⚠️ `packages === null` 的意思是**没有问**（这一页不是客户页）——
            那时候整段不画，而不是画一份空的套票。 */}
        {packages ? (
          <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
            <PackagesPanel partyId={recordId} rows={packages} copy={copy.form} />
          </div>
        ) : null}

        {/* 师傅那一页多一段：他的抽成，跟这个月他做了多少。
            ⚠️ `tiers === null` 的意思是**没有问**（不是师傅页，或者
            读的人看不到钱）—— 那时候整段不画，而不是画一份空的抽成。 */}
        {tiers ? (
          <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
            <CommissionPanel
              partyId={recordId}
              tiers={tiers}
              earnedCents={earnedCents}
              copy={copy.form}
            />
          </div>
        ) : null}
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

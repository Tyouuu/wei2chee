import { notFound } from "next/navigation";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { StyleScope } from "@/design-system/editor/style-scope";
/* 这三页只有工作台会开 —— 加一单 · 改这一单 · 搬旧资料。
   客户挑的那一套（`ctx.style`）从 2026-09-04 起只管官网。 */
import { SYSTEM_REGISTER } from "@/lib/portal/system-register";
import { RecordShell } from "../record-shell";
import { loadRecordPage } from "../record-context";
import { RECORD_COPY } from "../record-copy";
import { todayInMalaysia } from "@/lib/portal/live-months";
import { NewRecordForm } from "../new/new-record-form";
import { ringgit } from "@/lib/portal/live-rows";
import { reversedIds, settleDocument, unallocatedOf, type DocumentSettlement } from "@/lib/portal/allocations";
import { jobProfit, type ProfitFact } from "@/lib/portal/profit";
import { AppointmentStatus } from "../new/appointment-status";
import { PartyStatement } from "../new/party-statement";
import { PartyJobs, type PartyJob } from "../new/party-jobs";
import { SettleMonth } from "../new/settle-month";
import { PartyPortalPanel, type PartyRequest } from "../new/party-portal-panel";
import { ShareRecordPanel } from "../new/share-record-panel";
import {
  DeliveryPanel,
  type DeliveryRun,
  type Shortfall,
} from "../new/delivery-panel";
import {
  ReturnsPanel,
  type PastReturn,
  type Returnable,
} from "../new/returns-panel";
import { isShareableModule } from "@/lib/portal/shared-record";
import { PIPELINE_MODULES } from "@/lib/portal/shape-state";
import { SITE_URL } from "@/lib/site-url";
import { PartyHistory } from "../new/party-history";
import { FollowUpPanel } from "../new/follow-up-panel";
import { CommissionPanel, type CommissionTier } from "../new/commission-panel";
import { ReferralPanel, type ReferralOption } from "../new/referral-panel";
import { ReferredJobs, type ReferralTally, type ReferredJob } from "../new/referred-jobs";
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
  /* 这笔钱是干什么的、属於哪一单（20260904200000）。
     ⚠️ 两个都要读得回来，不然他每次打开都是空的 —— 而那会在下一次保存
     的时候把它们清掉，而他不会知道自己刚刚把一笔成本从那一单上拿掉了。 */
  let category: string | null = null;
  let jobId: string | null = null;
  /* 工地的照片。⚠️ 网址是签出来的、会过期的 —— 桶是 private 的，
     因为那是他客户家里，不是官网（20260904010000）。 */
  let photos: JobPhoto[] = [];
  /* 这一张被改过什么。⚠️ null = 没有问（他看不到这本帐），不是「没有改过」。 */
  let changes: ShownChange[] | null = null;
  /* 客户页那一边：他有几单，还欠多少。 */
  let jobs: PartyJob[] = [];
  /* 他替我带过几单。`null` = **没有带过**（或者读的人看不到钱）——
     那时候整段不画，不是画一份 0 单。 */
  let sent: { tally: ReferralTally; jobs: ReferredJob[] } | null = null;
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
  /* 他先付了、还没用掉的钱。
     🔴 **这个数字从 20260903030000 起就算得出来，而到今天为止全 app
     零个消费端** —— [任务 61 · 67 · 44] 三天各自要过它一次，
     每一次的答案都是「那只是一个减法」，然后没有人把它画出来。
     ⚠️ `null` = 没有问（不是客户页，或者读的人看不到钱），不是「零」。 */
  /* 🔴 预约那一页：他来了没有。null = 不是预约那一页。 */
  let apptStatus: string | null = null;
  /* 🔴 他按下去之前要知道这是**哪一张**预约。标题只写「Edit · Bookings」
     （十八页都一样），而客人的名字在表单卡里、要滑过四个格子才看得到。
     ⚠️ 空的就不印 —— 一个挡起来的休息时段本来就没有客人。 */
  let apptWho: string | null = null;
  let credit: { cents: number; from: { id: string; label: string; cents: number }[] } | null = null;
  let tiers: CommissionTier[] | null = null;
  /* 🔴 这个月那个数字是照**哪一份**办法算的（20260905640000）。
     没有它，他把 2% 改成 3%、按了保存，而画面上那个数字一分都不动 ——
     而那正是这一整件事在保护的东西。不讲，它看起来就是坏的。
     ⚠️ null = 从来没有人记过世代（只可能是有人绕过那支函式直接写表）。 */
  let rateFrom: string | null = null;
  /* 🔴 **这个月的抽成，由资料库算。**
     浏览器那一份算的是「照他现在打的这几档」，而这个月用的是
     **这个月那一份办法** —— 世代一落地，两份就分开了。
     他把 15% 改成 30%，浏览器当场跳到 RM 1,400，而月底真正会付的是
     RM 950：**同一页两个答案，而看得见的那个是错的。**
     ⚠️ null = 没有问（不是这几页，或者读的人看不到钱）。 */
  let commissionCents: number | null = null;
  /* 这个月对完了没有（20260902020000）。
     🔴 `set_reconciliation_settled` 从 9-02 就在，而到 9-05 为止
     **全 app 零个呼叫** —— 他关不了一个月，也重开不了，
     於是 20260905740000 那道期间锁既看不见也碰不到。
     ⚠️ null = 没有问（不是对帐那一页），不是「还没关」。 */
  let settledAt: string | null | undefined = undefined;
  /* 一条发给这个经销商的连结，跟他送进来的那几笔（20260905680000）。
     🔴 六支函式 9-05 就是真的了，而画面上一个入口都没有 ——
     一条没有人发得出去的连结，跟一条不存在的连结是同一件事。
     ⚠️ `undefined` = 没有问（不是名册那一页）。 */
  let portalRef: string | null | undefined = undefined;
  let partyRequests: PartyRequest[] = [];
  let landsIn: string | null = null;
  let landsInLabel: string | null = null;
  /* 一条发给客人的连结，跟他答了什么（20260905230000）。
     🔴 四支函式 9-05 就做好了，而画面上一个入口都没有 ——
     而它同时是[任务 155] 那两句：「客人线上按同意」跟
     「客人自己看得到这一单」底下是同一页。
     ⚠️ `undefined` = 没有问（不是那几种单），不是「还没开」。 */
  /* 送出去了几趟（20260905500000）。
     🔴 五支函式 9-05 就做好了，而画面上一个入口都没有 —— 而且
     客人那一页**已经画得出签收那一颗**，老板却开不了一趟货，
     所以那颗按钮永远不会出现。**半条线跟没有线是同一件事。**
     ⚠️ `undefined` = 没有问（不是订单／工程那两页）。 */
  /* 这一单的下一步（20260905800000）。
     🔴 Pipedrive 整个产品就是 `Processes, pipeline and activities`，
     而我们逐条查过自己的库：这一格是**整片空白**。一个承包商手上
     十二张报价单，今天没有任何地方写着星期五要打给谁。
     ⚠️ `undefined` = 没有问（不是走单那几页）。 */
  let followUp:
    | { id: string; what: string; dueOn: string; daysLate: number }
    | null
    | undefined = undefined;
  let runs: DeliveryRun[] | undefined = undefined;
  let shortfall: Shortfall[] = [];
  /* 货退回来了几件。⚠️ `undefined` = 没有问（不是那三页，或者已经收起来了）。 */
  let returns: PastReturn[] | undefined = undefined;
  let returnable: Returnable[] = [];
  let shareRef: string | null | undefined = undefined;
  /* 这一单是谁介绍的（[任务 156] · 20260905260000）。
     ⚠️ `undefined` = **没有问** —— 不是走单那几页，或者读的人看不到钱。
     `null` 是问了、没有人介绍。**两个在画面上是不一样的事。** */
  let referral:
    | {
        id: string | null;
        name: string | null;
        portion: number | null;
        amountCents: number | null;
        promised: string | null;
        people: ReferralOption[];
      }
    | undefined = undefined;
  let shareAnswer: { answer: string | null; name: string | null; at: string | null; note: string | null } = {
    answer: null, name: null, at: null, note: null,
  };
  /* 他是自己人还是下游（20260905720000）。**放宽那条守卫的时候，
     保护那件事的责任就搬到这一栏上** —— 读的人分不出来，
     原本那条守卫在防的事就真的没有人在防了。 */
  let rateKind: string | null = null;
  /* 改过几次。只回日子跟那一份的档，画面自己组一句话。 */
  let rateHistory: { from: string; tiers: { fromCents: number; percent: number }[] }[] = [];
  /* 这个月算在他名下的收款。⚠️ 它同时喂两个地方：底下那一段，
     跟表单里那一格「本月业绩」—— 而那一格从今天起是**锁住**的，
     因为它现在是算出来的（模板本来就把那一栏叫「This month」，
     而它到今天为止是一个他自己打字进去的框）。 */
  let earnedCents = 0;
  /* 单据那一边：这张单收到多少、还欠多少。
     ⚠️ null 的意思是**没有问**（他看不到钱），不是「零」—— 画面照这个
     决定要不要画那一整段。 */
  let settlement: DocumentSettlement | null = null;
  /* 这一单赚多少 -- 收到的减挂在它身上的开销（20260904200000）。
     ⚠️ `null` = **没有问**（这一页不是一张单，或者读的人看不到钱），
     不是「没赚」。`ledger_entries` 是 sees_money，所以一个师傅拿回来的是
     空的，而空的会算成「这一单赚了全额」-- 那时候整段不画，不是画 0。 */
  let earned: {
    paidCents: number;
    costCents: number;
    profitCents: number;
    byCategory: { name: string | null; cents: number }[];
  } | null = null;

  if (ctx.isDirectory) {
    const { data } = await supabase
      .from("directory_entries")
      .select("id, name, contact_person, phone, whatsapp, email, region, address, reg_no, tax_id, status, note, credit_limit_cents, portal_ref, extra, archived_at")
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

    /* ── 他自己那条连结，跟他送进来的那几笔（20260905680000）────────────
       🔴 **只有客户跟供应商**。师傅有登入，走里面那条路 ——
       `open_party_portal` 自己就会拒绝一个 staff，而画一颗按下去
       一定失败的按钮，正是这个仓库禁的那一种。
       ⚠️ 收起来的人也不画：一条连到一个已经收起来的人的连结，
       打开是死的，而画面上会看起来像它还能用。 */
    if ((pageKey === "customers" || pageKey === "suppliers") && !data.archived_at) {
      portalRef = data.portal_ref ?? null;
      /* 「一按变单」开在哪一页。**从他自己有的那几页里挑第一个走单的** ——
         写死 "orders" 会在一个只开了报价单的系统上开出一张到不了的单。
         🔴 一页都没有就回 null，而画面**不画那颗按钮**：
         一颗按下去一定失败的按钮，就是这个仓库禁的那一种。 */
      /* ⚠️ 那一栏叫 `sort_order`，不是 `position`。第一版写错，
         而一个坏栏位名让**整个查询报错**、静静回 null ——
         於是那颗按钮永远不画，看起来像这个系统没有能放单的页。
         `record-context.ts` 读同一张表用的就是 `sort_order`。 */
      const { data: pageRows, error: pageErr } = await supabase
        .from("project_pages")
        .select("page_key, title, sort_order")
        .eq("project_id", ctx.projectId)
        .order("sort_order");
      if (pageErr) console.error("project_pages:", pageErr.message);
      const holder = ((pageRows ?? []) as { page_key: string; title: string | null }[]).find(
        (r) => PIPELINE_MODULES.has(r.page_key),
      );
      landsIn = holder?.page_key ?? null;
      landsInLabel = holder?.title ?? holder?.page_key ?? null;
      /* `in_open_only: false` —— 已经开成单的、丢掉的都要看得到。
         一笔送进来之后消失的请求，读起来像系统把它吃掉了。 */
      const { data: reqRows } = await supabase.rpc("party_requests_of", {
        in_project_id: ctx.projectId,
        in_open_only: false,
      });
      partyRequests = ((reqRows ?? []) as {
        id: string; party_id: string; what: string; qty: number | null;
        amount_cents: number | null; contact: string | null; status: string;
        /* ⚠️ 它叫 `asked_on`，不是 `created_at` —— 第一版写错，
           而那一栏 undefined 之后 `.slice()` 把整页炸掉，
           画面上写的是「Something broke here」。 */
        doc_no: string | null; asked_on: string;
      }[])
        .filter((r) => r.party_id === recordId)
        .map((r) => ({
          id: r.id,
          what: r.what,
          qty: r.qty == null ? null : Number(r.qty),
          amountCents: r.amount_cents == null ? null : Number(r.amount_cents),
          contact: r.contact ?? "",
          status: r.status,
          docNo: r.doc_no,
          createdAt: r.asked_on,
        }));
    }

    /* 他的地址。帐单一个地方，工地另一个（20260903060000）。 */

    /* ── 他替我带过几单，我还欠他多少（[任务 156] · 20260905260000）───────
       🔴 只给老板：一笔答应给出去的钱是钱，而 20260905280000 把守卫从
          `works_here` 改回 `sees_money` 的时候，`check:referrals` 当场红了
          「师傅算不出老板给了谁多少介绍费」。
       ⚠️ 一单都没带过就整段不画 —— 不是画一份「0 单 · RM 0」。
          绝大多数客户从来没有介绍过人，而一段永远写着 0 的区块，
          读起来是这一页没做完。 */
    if (ctx.role === "owner") {
      const [{ data: owingRows }, { data: sentRows }] = await Promise.all([
        supabase.rpc("referrals_owing", { in_project_id: ctx.projectId }),
        supabase.rpc("referred_jobs", {
          in_project_id: ctx.projectId,
          in_referrer_id: recordId,
        }),
      ]);
      const mine = ((owingRows ?? []) as {
        referrer_id: string; jobs: number | null; received_cents: number | null;
        promised_cents: number | null; paid_cents: number | null; owing_cents: number | null;
      }[]).find((r) => r.referrer_id === recordId);
      const rows = (sentRows ?? []) as {
        record_id: string; doc_no: string | null; title: string | null;
        party: string | null; received_cents: number | null; promised_cents: number | null;
      }[];

      if (mine && rows.length) {
        /* `referred_jobs` 不回是哪一页 —— 那几个 id 在手上，一句就问得到。
           一条连不过去的连结，跟一颗按不动的按钮是同一件事。 */
        const { data: whereRows } = await supabase
          .from("pipeline_records")
          .select("id, module_key")
          .in("id", rows.map((r) => r.record_id));
        const pageOf = new Map(
          ((whereRows ?? []) as { id: string; module_key: string }[]).map((w) => [w.id, w.module_key]),
        );

        sent = {
          tally: {
            jobs: Number(mine.jobs ?? 0),
            received: ringgit(mine.received_cents ?? 0) ?? "",
            promised: ringgit(mine.promised_cents ?? 0) ?? "",
            paid: ringgit(mine.paid_cents ?? 0) ?? "",
            owing: ringgit(mine.owing_cents ?? 0) ?? "",
          },
          jobs: rows
            .filter((r) => pageOf.has(r.record_id))
            .map((r) => ({
              id: r.record_id,
              href: `/${locale}/portal/${pageOf.get(r.record_id)}/${r.record_id}`,
              docNo: r.doc_no ?? "",
              title: r.title ?? "",
              party: r.party ?? "",
              received: ringgit(r.received_cents ?? 0) ?? "",
              promised: ringgit(r.promised_cents ?? 0) ?? "",
            })),
        };
      }
    }

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

    /* ── 客户那一页：他先付了、还没用掉的钱 ────────────────────────────
       🔴 只问看得到钱的人。师傅拿回来的是空的，而空的会画成
       「他没有余额」—— 对一个刚付了一千块的客人撒谎。所以问都不问。
       ⚠️ 冲正过的那几笔不算（`countsAsReceived` 同一条规矩）。 */
    if (ctx.role === "owner") {
      const { data: paid } = await supabase
        .from("ledger_entries")
        .select("id, doc_no, note, entry_on, amount_cents, allocated_cents, adjusts_id, module_key")
        .eq("party_id", recordId)
        .eq("direction", "in")
        .order("entry_on", { ascending: false });
      const rows = (paid ?? []) as {
        id: string; doc_no: string | null; note: string | null; entry_on: string;
        amount_cents: number | null; allocated_cents: number | null;
        adjusts_id: string | null; module_key: string;
      }[];
      const gone = reversedIds(rows);
      const holding = rows
        .filter((e) => !e.adjusts_id && !gone.has(e.id))
        .map((e) => ({
          id: e.id,
          label: [e.doc_no, e.entry_on].filter(Boolean).join(" · "),
          href: `/${locale}/portal/${e.module_key}/${e.id}`,
          cents: unallocatedOf(e),
        }))
        .filter((e) => e.cents > 0);
      credit = {
        cents: holding.reduce((n, e) => n + e.cents, 0),
        from: holding,
      };
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
    /* 🔴 **不再只问师傅那一页。** 抽成 20260905720000 放宽到下游经销商
       之后，一个下游在名册上是**客户**——只问 staff 那一页，等於那笔抽成
       算得出来而永远没有人看得到（这个仓库犯过二十次的那一件）。
       ⚠️ 而客户页不可以每一个人都画一段抽成：**问完之后没有档也没有钱的，
       整段收回 null**（下面那一句），不是画一份空的。 */
    if (ctx.role === "owner" && (pageKey === "staff" || pageKey === "customers" || pageKey === "suppliers")) {
      const month = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kuala_Lumpur",
        year: "numeric",
        month: "2-digit",
      })
        .format(new Date())
        .slice(0, 7);
      const [{ data: tierRows }, { data: earnRows }, { data: schemeRows }] = await Promise.all([
        supabase
          .from("commission_tiers")
          .select("id, from_cents, percent")
          .eq("party_id", recordId)
          .order("from_cents"),
        supabase.rpc("staff_earnings", { in_project_id: ctx.projectId, in_month: month }),
        /* 世代。只加不改的一张表，所以按日子倒着排就是「改过几次」。
           ⚠️ 六份就够了 —— 一份读不完的历史没有人看。 */
        supabase
          .from("commission_schemes")
          .select("effective_from, tiers, created_at")
          .eq("party_id", recordId)
          .order("effective_from", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(24),
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
      const mine = ((earnRows ?? []) as {
        party_id: string; earned_cents: number; commission_cents: number;
        rate_from: string | null; kind: string | null;
      }[]).find((r) => r.party_id === recordId);
      earnedCents = Number(mine?.earned_cents ?? 0);
      commissionCents = mine ? Number(mine.commission_cents) : null;
      rateFrom = mine?.rate_from ?? null;
      rateKind = mine?.kind ?? null;
      /* 🔴 **同一天只留最后存的那一份。**
         那张表是只加不改的，所以同一天存两次就有两行 —— 而资料库
         只认后存的那一份（20260905770000）。两行都列出来，
         等於画面在讲一份已经作废的办法，而他没有办法分出是哪一份。
         已经按日子跟时间倒着排，所以第一次看到那个日子就是那一份。 */
      const seenDay = new Set<string>();
      rateHistory = ((schemeRows ?? []) as { effective_from: string; tiers: unknown }[])
        .filter((r) => {
          if (seenDay.has(r.effective_from)) return false;
          seenDay.add(r.effective_from);
          return true;
        })
        .slice(0, 6)
        .map((r) => ({
          from: r.effective_from,
          tiers: (Array.isArray(r.tiers) ? r.tiers : []).map((t) => {
            const row = t as { from_cents?: unknown; percent?: unknown };
            return { fromCents: Number(row.from_cents ?? 0), percent: Number(row.percent ?? 0) };
          }),
        }));

      /* 🔴 **问完了，没有档也没有钱，就整段收回。**
         师傅那一页照旧永远画（那一页存在的理由就是他的薪水）；
         而客户跟供应商那两页上，绝大多数人跟抽成没有关系 ——
         替每一个客户画一段空的抽成，就是[任务 133] 那句
         「一段永远说同一句话的段落，读起来是没做完」。 */
      if (pageKey !== "staff" && !tiers.length && earnedCents === 0) {
        tiers = null;
        rateFrom = null;
        rateKind = null;
        commissionCents = null;
        rateHistory = [];
      }
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
      .select("id, starts_at, ends_at, kind, party, service, status, note, extra, archived_at")
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
    apptStatus = String((data as { status?: string }).status ?? "booked");
    apptWho =
      [data.party, data.service].filter((x) => String(x ?? "").trim()).join(" · ") || null;
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
      .select("id, period, source, direction, their_cents, reference, note, extra, archived_at, settled_at")
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
    settledAt = data.settled_at ?? null;
  } else if (ctx.shape === "ledger") {
    const { data } = await supabase
      .from("ledger_entries")
      .select("id, doc_no, note, party, amount_cents, adjusts_id, branch_id, done_by, category, job_id, entry_on, extra")
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
      /* 🔴 读得回来，不然打开一笔旧的会看到一格空的日期 —— 而空的意思是
         「没有日期」，这一笔明明是上个月的。⚠️ 那一格在编辑的时候是锁的：
         `update_ledger_words` 没有这一栏，钱不改，只开一张相反的。 */
      entry_on: (data as { entry_on?: string | null }).entry_on ?? "",
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
    category = data.category ?? null;
    jobId = data.job_id ?? null;

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
      .select("id, doc_no, title, party, amount_cents, stage, due_on, site_address_id, branch_id, extra, archived_at, share_ref, answer, answered_name, answered_at, answer_note, referrer_id, referral_portion, referral_amount_cents")
      .eq("id", recordId)
      .eq("module_key", pageKey)
      .maybeSingle();
    if (!data) notFound();

    /* ── 这一单的下一步（20260905800000）───────────────────────────────
       🔴 **收起来的单不问。** `set_follow_up` 自己会拒绝它，
       而画一颗按下去一定失败的按钮正是这个仓库禁的那一种。 */
    if (!data.archived_at) {
      const { data: fuRows } = await supabase.rpc("follow_up_of", {
        in_record_id: recordId,
      });
      const fu = ((fuRows ?? []) as {
        id: string; what: string; due_on: string; days_late: number;
      }[])[0];
      followUp = fu
        ? { id: fu.id, what: fu.what, dueOn: fu.due_on, daysLate: Number(fu.days_late) }
        : null;
    }

    /* ── 一条发给客人的连结，跟他答了什么（20260905230000 · 510000）──────
       🔴 只有**客人本来就是另一方**的那几种单：报价单 · 订单 · 工程。
       「任务」是内部的 ——「打给供应商问货几时到」不是给客人读的，
       而 `is_answerable_module` 在资料库那一边也是这样判的。
       ⚠️ 收起来的单不画：一条连到一张收起来的单的连结，打开是死的。 */
    /* ── 送出去了几趟 ────────────────────────────────────────────────
       🔴 **只有订单跟工程。** 一张报价单还没有答应，没有东西可以送；
       `open_delivery_run` 自己也会拒绝它，而画一颗按下去一定失败的按钮
       正是这个仓库禁的那一种。 */
    if (!data.archived_at && (pageKey === "orders" || pageKey === "projects")) {
      const [{ data: runRows }, { data: shortRows }] = await Promise.all([
        supabase.rpc("deliveries_of", { in_record_id: recordId }),
        supabase.rpc("delivery_shortfall", { in_record_id: recordId }),
      ]);
      runs = ((runRows ?? []) as {
        id: string; run_on: string | null; driver: string | null; received_by: string | null;
        signed_at: string | null; signed_name: string | null; note: string | null; lines: unknown;
      }[]).map((r) => ({
        id: r.id,
        runOn: r.run_on,
        driver: r.driver,
        receivedBy: r.received_by,
        signedAt: r.signed_at,
        signedName: r.signed_name,
        note: r.note,
        lines: (Array.isArray(r.lines) ? r.lines : []).map((l) => {
          const x = l as { description?: unknown; qty?: unknown; unit?: unknown };
          return {
            description: typeof x.description === "string" ? x.description : null,
            qty: x.qty == null ? null : Number(x.qty),
            unit: typeof x.unit === "string" ? x.unit : null,
          };
        }),
      }));
      shortfall = ((shortRows ?? []) as {
        description: string | null; unit: string | null;
        ordered: number; gone: number; still: number;
      }[]).map((r) => ({
        description: r.description,
        unit: r.unit,
        ordered: Number(r.ordered),
        gone: Number(r.gone),
        still: Number(r.still),
      }));
    }

    /* ── 退回来的（[任务 208] · [210]）────────────────────────────────
       🔴 **订单 · 工程 · 进货单，不给报价单。** 资料库那边收报价单，
       而一张报价单还没有人答应，货一件都没有出去过 ——
       退货那一半永远回 `not_out`，而退钱那一半退的是一笔从来没收过的钱。
       **不画一颗按下去一定失败的按钮。** */
    if (
      !data.archived_at &&
      (pageKey === "orders" || pageKey === "projects" || pageKey === "purchases")
    ) {
      const [{ data: retRows }, { data: lineRows }] = await Promise.all([
        supabase.rpc("returns_of", { in_record_id: recordId }),
        /* ⚠️ 自己问一次那几行 —— 上面那一次没有 select `id`，
           而 `record_return` 要的正是 `line_id`。 */
        supabase
          .from("record_lines")
          .select("id, description, qty, unit")
          .eq("record_id", recordId)
          .order("sort_order"),
      ]);
      returns = (
        (retRows ?? []) as {
          id: string;
          returned_on: string | null;
          reason: string | null;
          credit_cents: number | null;
          note: string | null;
          lines: unknown;
        }[]
      ).map((r) => ({
        id: r.id,
        returnedOn: r.returned_on,
        reason: r.reason,
        creditCents: r.credit_cents == null ? null : Number(r.credit_cents),
        note: r.note,
        lines: (Array.isArray(r.lines) ? r.lines : []).map((l) => {
          const x = l as { description?: unknown; qty?: unknown; unit?: unknown };
          return {
            description:
              typeof x.description === "string" ? x.description : null,
            qty: x.qty == null ? null : Number(x.qty),
            unit: typeof x.unit === "string" ? x.unit : null,
          };
        }),
      }));
      returnable = (
        (lineRows ?? []) as {
          id: string;
          description: string | null;
          qty: number | null;
          unit: string | null;
        }[]
      ).map((l) => ({
        id: l.id,
        description: l.description,
        qty: l.qty == null ? null : Number(l.qty),
        unit: l.unit,
      }));
    }

    if (!data.archived_at && isShareableModule(pageKey)) {
      shareRef = data.share_ref ?? null;
      shareAnswer = {
        answer: data.answer ?? null,
        name: data.answered_name ?? null,
        at: data.answered_at ?? null,
        note: data.answer_note ?? null,
      };
    }

    /* ── 这一单是谁介绍的（[任务 156] · 20260905260000）──────────────────
       🔴 只在**走单**那几页，只给老板，而且只在还没收起来的单上。
       ⚠️ 收起来的单不画：一笔挂在收起来的单上的介绍费，`referrals_owing`
          自己就不算它（`archived_at is null`）—— 画一格改得动而算不进去的
          比例，是这一页在说谎。
       ⚠️ `undefined` 是**没有问**，`null` 是问了没有人介绍。 */
    if (!data.archived_at && ctx.role === "owner" && PIPELINE_MODULES.has(pageKey)) {
      /* 挑得到的人：三种名册都要。谁介绍谁是他的生意 ——
         `set_record_referral` 那一支也只查「同一家公司」，不查是哪一种。 */
      const { data: people } = await supabase
        .from("directory_entries")
        .select("id, name")
        .eq("project_id", ctx.projectId)
        .is("archived_at", null)
        .order("name")
        .limit(500);

      let name: string | null = null;
      let promised: string | null = null;
      if (data.referrer_id) {
        /* 🔴 那个数字**只从资料库拿**。`referred_jobs` 跟 `referrals_owing`
           用同一段 SQL 算 promised —— 在这一页拿 received × portion 再算一次，
           就是同一个问题两个答案（这个仓库栽过至少八次）。 */
        const [{ data: whoRow }, { data: jobRows }] = await Promise.all([
          supabase
            .from("directory_entries")
            .select("name")
            .eq("id", data.referrer_id)
            .maybeSingle(),
          supabase.rpc("referred_jobs", {
            in_project_id: ctx.projectId,
            in_referrer_id: data.referrer_id,
          }),
        ]);
        name = (whoRow as { name?: string } | null)?.name ?? null;
        const mine = ((jobRows ?? []) as { record_id: string; promised_cents: number | null }[]).find(
          (j) => j.record_id === recordId,
        );
        promised = mine ? ringgit(mine.promised_cents ?? 0) ?? null : null;
      }

      referral = {
        id: data.referrer_id ?? null,
        name,
        portion: data.referral_portion == null ? null : Number(data.referral_portion),
        amountCents: data.referral_amount_cents == null ? null : Number(data.referral_amount_cents),
        promised,
        people: ((people ?? []) as { id: string; name: string }[]).map((x) => ({
          id: x.id,
          name: x.name,
        })),
      };
    }
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

    /* ── 这一单赚多少 ──────────────────────────────────────────────────
       收到的那一边来自分摊（settleDocument 已经算好），花掉的那一边来自
       挂在这张单上的开销。两边不是同一个机制，理由写在 profit.ts。
       ⚠️ 只在**有钱**的单上算：一张任务单没有金额，一个「赚 RM 0」
       印在它底下，讲的是一件它从来不是的事。 */
    if (settlement && (data.amount_cents ?? 0) > 0) {
      const { data: costRows } = await supabase
        .from("ledger_entries")
        .select("id, direction, amount_cents, entry_on, category, adjusts_id")
        .eq("job_id", recordId);
      /* ⚠️ 读不到就不画（`costRows` 是 undefined），跟读到空阵列不一样：
         空阵列是「这一单还没有成本」，读不到是「我们没问出来」。 */
      if (costRows) {
        earned = jobProfit({
          paidCents: settlement.paidCents,
          costs: costRows as unknown as ProfitFact[],
        });
      }
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
    <StyleScope register={SYSTEM_REGISTER} palette={ctx.palette} data-surface="desk" className="min-h-screen">
      {/* 🔴 2026-09-04：搬进系统的外壳里。老板：`不要设计看起来是好像两个人
          做得一样 一定要统一设计`。见 record-shell.tsx。 */}
      <RecordShell ctx={ctx}>
      {/* Wider when there is a document beside the form. A quotation is the
          only thing this system makes that somebody outside the business
          reads, and 560px cannot hold the form and the paper.
          ⚠️ 左右的内距交给外壳了 —— 两层内距会把这一页推得比别页窄。 */}
      <main
        className={`w-full ${
          ctx.shape === "pipeline" ? "max-w-[1080px]" : "max-w-[560px]"
        }`}
      >
        {/* 🔴 标题跟那一句说明交给表单画（2026-09-04）。参考页的主要动作
            在标题右边，而那颗按钮要知道「现在正在存」—— 这一页是伺服器画的，
            读不到那件事。所以标题跟按钮住在一起。 */}
        <NewRecordForm
          heading={copy.editHeading(ctx.title)}
          lede={archivedAt ? copy.form.archived : copy.editLede}
          /* 🔴 他来了没有 —— **标题底下、表单卡上面**。
             在表单底下：客人站在面前，而他要滑过八个不用碰的格子。
             在标题上面（我第一版）：他还没看到这是哪一张预约就先按了。
             两个看图看出来的，而第二个更严重。 */
          afterHeading={
            apptStatus ? (
              <AppointmentStatus id={recordId} status={apptStatus} who={apptWho} copy={copy.form} />
            ) : null
          }
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
          jobs={ctx.jobsForCost}
          categories={ctx.categories}
          earnedLocked={pageKey === "staff"}
          earnedValue={tiers ? ringgit(earnedCents) ?? "RM 0" : null}
          photos={photos}
          changes={changes}
          record={{ id: recordId, values, archivedAt, reversed, lines, terms, allocations, addresses, siteAddressId, branchId, docNo, dueOn, doneBy, category, jobId }}
          settlement={settlement}
          earned={earned}
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

        {/* 客户那一页多一段：他先付了、还没用掉的钱。
            ⚠️ `credit === null` = 没有问（读的人看不到钱），整段不画；
            而 `cents === 0` 是**问过了，答案是零** —— 那一句要讲出来，
            因为「没有余额」跟「我不知道」在画面上必须长得不一样。 */}
        {credit && ctx.isDirectory && pageKey === "customers" ? (
          <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
            <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
              {copy.form.creditHeading}
            </h2>
            {credit.cents > 0 ? (
              <>
                <div className="mt-2 [font-size:var(--text-stat)] [font-weight:var(--fw-semibold)] tabular-nums text-[color:var(--color-primary)]">
                  {ringgit(credit.cents)}
                </div>
                <p className="mt-1 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                  {copy.form.creditLede}
                </p>
                {/* 来自哪几笔 —— 一个总数答不了「那是哪一次付的」，
                    而那正是他下一句会问的。 */}
                <ul className="mt-3 flex flex-col gap-1">
                  {credit.from.map((e) => (
                    <li key={e.id} className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                      {copy.form.creditFrom} {e.label} — {ringgit(e.cents)}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                {copy.form.creditNone}
              </p>
            )}
          </div>
        ) : null}

        {/* 客户那一页再多一段：月结对帐单。
            八个行业每个月都要跟某一个人对一次帐，而今天他是把
            WhatsApp 往上滑、一张一张单自己加。[任务 147] 把算术做完了，
            而它自己的收尾写着「**那张纸不存在**」。

            🔴 用跟旁边那一段同一个闸（credit）——
            它在看不到钱的人那一边是 null。
            party_statement 自己也是 sees_money 的，一个师傅打它
            拿回来是**零行** —— 而零行会画成一张空的对帐单，
            读起来是「这个客人什么都没欠」。 */}
        {credit && ctx.isDirectory && pageKey === "customers" ? (
          <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
            <PartyStatement
              projectId={ctx.projectId}
              partyId={recordId}
              depositCents={credit.cents}
              copy={copy.form}
            />
          </div>
        ) : null}

        {/* 走单那几页多一段：这一单的下一步。
            排在这几段的最前面 —— 那是他读完这张单**接着要做**的那件事。
            ⚠️ `undefined` = 没有问（不是走单那几页，或者已经收起来了）。 */}
        {followUp !== undefined ? (
          <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
            <FollowUpPanel recordId={recordId} open={followUp} copy={copy.form} />
          </div>
        ) : null}

        {/* 订单 / 工程那一页多一段：送出去了几趟。
            ⚠️ `undefined` = 没有问（不是那两页，或者已经收起来了）。 */}
        {runs !== undefined ? (
          <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
            <DeliveryPanel
              recordId={recordId}
              runs={runs}
              shortfall={shortfall}
              copy={copy.form}
            />
          </div>
        ) : null}

        {/* 订单 · 工程 · 进货单多一段：退回来的。
          ⚠️ `undefined` = 没有问（不是那三页，或者已经收起来了）。 */}
        {returns !== undefined ? (
          <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
            <ReturnsPanel
              recordId={recordId}
              lines={returnable}
              past={returns}
              buying={pageKey === "purchases"}
              copy={copy.form}
            />
          </div>
        ) : null}

        {/* 单据那一页多一段：发给客人的那条连结，跟他答了什么。
            ⚠️ `undefined` = 没有问（不是那几种单，或者已经收起来了）。 */}
        {shareRef !== undefined ? (
          <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
            <ShareRecordPanel
              recordId={recordId}
              shareRef={shareRef}
              origin={SITE_URL}
              answer={shareAnswer.answer}
              answeredName={shareAnswer.name}
              answeredAt={shareAnswer.at}
              answerNote={shareAnswer.note}
              copy={copy.form}
            />
          </div>
        ) : null}

        {/* 客户 / 供应商那一页多一段：他自己那条连结，跟他送进来的那几笔。
            ⚠️ `undefined` = 没有问（不是那两页，或者他已经收起来了）。 */}
        {portalRef !== undefined ? (
          <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
            <PartyPortalPanel
              partyId={recordId}
              portalRef={portalRef}
              origin={SITE_URL}
              requests={partyRequests}
              landsIn={landsIn}
              landsInLabel={landsInLabel}
              copy={copy.form}
            />
          </div>
        ) : null}

        {/* 走单那几页多一段：这一单是谁介绍的。
            ⚠️ `undefined` = 没有问（不是走单那几页 · 收起来了 ·
            或者读的人看不到钱）—— 那时候整段不画。 */}
        {referral ? (
          <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
            <ReferralPanel
              recordId={recordId}
              referrerId={referral.id}
              referrerName={referral.name}
              portion={referral.portion}
              amountCents={referral.amountCents}
              promised={referral.promised}
              people={referral.people}
              copy={copy.form}
            />
          </div>
        ) : null}

        {/* 对帐那一页多一段：这个月对完了没有，跟关起来 / 重开。
            ⚠️ `undefined` 的意思是**没有问**（不是对帐那一页）——
            `null` 是问了、还没关。两个在画面上是不一样的事。 */}
        {settledAt !== undefined ? (
          <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
            <SettleMonth id={recordId} settledAt={settledAt} copy={copy.form} />
          </div>
        ) : null}

        {/* 客户 / 供应商 / 师傅那一页多一段：他替我带过几单。
            ⚠️ `null` = 没有带过（或者读的人看不到钱）—— 整段不画。 */}
        {sent ? (
          <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
            <ReferredJobs tally={sent.tally} jobs={sent.jobs} copy={copy.form} />
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
              commissionCents={commissionCents}
              rateFrom={rateFrom}
              kind={rateKind}
              history={rateHistory}
              copy={copy.form}
            />
          </div>
        ) : null}
      </main>
      </RecordShell>
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

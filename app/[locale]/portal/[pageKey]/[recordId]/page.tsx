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
import {
  reversedIds,
  settleDocument,
  unallocatedOf,
  type DocumentSettlement,
} from "@/lib/portal/allocations";
import { jobProfit, type ProfitFact } from "@/lib/portal/profit";
import { AppointmentStatus } from "../new/appointment-status";
import {
  PurchaseMatch,
  type PurchaseMatchFacts,
} from "../new/purchase-match";
import { RentalsOnJob, type JobRental } from "../new/rentals-on-job";
import { PartyStatement } from "../new/party-statement";
import { PartyJobs, type PartyJob } from "../new/party-jobs";
import { ItemBatches, type ItemBatch } from "./item-batches";
import {
  TreatmentHistory,
  type TreatmentVisit,
} from "./treatment-history";
import { ReadFirst, type ReadField } from "./read-first";
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
import { NoShowPanel } from "../new/no-show-panel";
import { BookingLinkPanel } from "../new/booking-link-panel";
import { StoredCreditPanel } from "../new/stored-credit-panel";
import { StaffShiftPanel } from "../new/staff-shift-panel";
import { VisitLinesPanel } from "../new/visit-lines-panel";
import { RecordTabs } from "../new/record-tabs";
import { CommissionPanel, type CommissionTier } from "../new/commission-panel";
import { ReferralPanel, type ReferralOption } from "../new/referral-panel";
import {
  ReferredJobs,
  type ReferralTally,
  type ReferredJob,
} from "../new/referred-jobs";
import { PackagesPanel, type PackageRow } from "../new/packages-panel";
import {
  ConsentPanel,
  type ConsentSheet,
  type ConsentForm,
} from "../new/consent-panel";
import type { JobPhoto } from "../new/job-photos";
import {
  showChanges,
  type ShownChange,
  type ChangeRow,
} from "@/lib/portal/change-log";
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

/* 一批「做过什么」的笔记，配上它们自己的照片签出网址。
 *
 * 客户那一页（问全部）跟预约那一页（只问这一笔，[任务 397] 补的）现在
 * 共用这一段——两边拿到笔记的方式不一样（一支 RPC vs 直接照 `appointment_id`
 * 查表），但「签出照片网址」那半段逐字一样，抽出来一次，不重写第二次。
 */
async function withTreatmentPhotos(
  supabase: Awaited<ReturnType<typeof createSessionSupabaseClient>>,
  rows: {
    id: string;
    done_on: string;
    what: string;
    area: string;
    note: string;
    staff_name: string;
    archived: boolean;
    products: TreatmentVisit["products"] | null;
  }[],
): Promise<TreatmentVisit[]> {
  return Promise.all(
    rows.map(async (n) => {
      const { data: pics } = await supabase.rpc("treatment_photos_of", {
        in_note_id: n.id,
      });
      const shots = (
        (pics ?? []) as {
          id: string;
          path: string;
          stage: string;
          caption: string;
          may_show: boolean;
        }[]
      ).slice(0, 6);

      /* 🔴 网址是**签出来的**，不存 —— 存一个会过期的字串，
         等於存一个明天变成假的东西（20260904010000 的原话）。 */
      const signed = await Promise.all(
        shots.map(async (x) => {
          const { data } = await supabase.storage
            .from("job-photos")
            .createSignedUrl(x.path, 600);
          return {
            id: x.id,
            url: data?.signedUrl ?? null,
            stage: x.stage,
            caption: x.caption,
            mayShow: x.may_show,
          };
        }),
      );

      return {
        id: n.id,
        doneOn: n.done_on,
        what: n.what,
        area: n.area ?? "",
        note: n.note ?? "",
        staffName: n.staff_name ?? "",
        archived: n.archived,
        products: n.products ?? [],
        shots: signed,
      };
    }),
  );
}

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
  /* 这张进货单对不对得上。⚠️ `undefined` = 没有问（不是进货单，或者不是老板），
     而那跟「对得上」是两句话 —— 后者要有人真的去问过。 */
  let match: PurchaseMatchFacts | undefined;
  /* 这一单借出去的东西。⚠️ 空阵列 = 问过了，这一单一件都没借过 ——
     而那时候整段不画（见 rentals-on-job.tsx）。 */
  let lent: JobRental[] = [];
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
    /** 一台一台管的那几件货，这一行上那个号码。 */
    batchCode: string;
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
  let addresses: {
    id: string;
    label: string;
    line: string;
    region: string;
    isBilling: boolean;
  }[] = [];
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
  /* 🔴 她签了没有（20260909130000）。
     ⚠️ null = **没有问**（这一页不是客户页），不是「一份都没发过」——
     那两句在画面上要长得不一样。
     ⚠️ 而它**不看 role**：那三支都是 works_here，而一份同意书上
     一个金额都没有 —— 开工之前问「她签了没有」的常常就是美疗师自己。 */
  let consents: ConsentSheet[] | null = null;
  let consentForms: ConsentForm[] = [];
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
  let credit: {
    cents: number;
    from: { id: string; label: string; cents: number }[];
  } | null = null;
  /* 储值卡送的那一部分（`credit_of`，[任务 346]）——跟上面 `credit`
   *  分开存，因为它们是两件不同的事：那一个是她自己的钱，这一个是白送的。
   *  `null` = 没有问（看不到钱的人，或者这一页不是客户）；
   *  `0` = 问过了，答案是零，两句话在画面上要长得不一样。 */
  let storedCredit: { giftCents: number } | null = null;
  /* 上下班打卡（20260911240000，[任务 375/401]）——`undefined` = 没有问
     （不是师傅那一页）。 */
  let shiftInfo:
    | { clockedInSince: string | null; hours: number; shifts: number }
    | undefined = undefined;
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
  /* 她放过几次飞机 · 这一单要不要订金（20260909320000，[任务 333]）。
     🔴 `deposit_advice` 从做出来那天起零个呼叫端——[任务 354] 记着的
     那三格「名单 · 那颗『这一单要订金』·『她放过两次』那一行」，这里补的
     是后两格：一张单自己讲得出这个客人放过几次、要不要开口要订金。
     ⚠️ `undefined` = 没有问（不是预约那几页，或者这一笔没有连到客人 ——
     一张挡起来的时段没有这句话）。 */
  let noShowInfo:
    | {
        missed: number;
        came: number;
        lastMissedOn: string | null;
        ruleAfter: number | null;
        advise: boolean;
        suggestCents: number | null;
        onHandCents: number | null;
        depositCents: number | null;
      }
    | null
    | undefined = undefined;
  let runs: DeliveryRun[] | undefined = undefined;
  let shortfall: Shortfall[] = [];
  /* 货退回来了几件。⚠️ `undefined` = 没有问（不是那三页，或者已经收起来了）。 */
  let returns: PastReturn[] | undefined = undefined;
  let returnable: Returnable[] = [];
  let shareRef: string | null | undefined = undefined;
  /* 她自己那张预约的连结（[任务 399] 收尾那一件）——`undefined` = 没有问
     （不是预约那几页，或者这一笔是挡起来的时段，没有客人可以发）。 */
  let bookingPublicRef: string | undefined = undefined;
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
  let shareAnswer: {
    answer: string | null;
    name: string | null;
    at: string | null;
    note: string | null;
  } = {
    answer: null,
    name: null,
    at: null,
    note: null,
  };
  /* 他是自己人还是下游（20260905720000）。**放宽那条守卫的时候，
     保护那件事的责任就搬到这一栏上** —— 读的人分不出来，
     原本那条守卫在防的事就真的没有人在防了。 */
  let rateKind: string | null = null;
  /* 改过几次。只回日子跟那一份的档，画面自己组一句话。 */
  let rateHistory: {
    from: string;
    /** 🔴 这个月那个数字照的就是这一份（20260905650000）。
     *  它跟 `rateFrom` 问的是**同一支、同一个日子**，所以标签跟数字
     *  分不开 —— 那正是[任务 180] 那一条：一个跟旁边那个数字对不上的
     *  标签，比没有标签糟。 */
    usedThisMonth: boolean;
    tiers: { fromCents: number; percent: number }[];
  }[] = [];
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
  /* 她做过什么（20260909040000）。空阵列 = 这一家没有记过 → 整段不画。 */
  let treatments: TreatmentVisit[] = [];

  /* 这一件货自己的批号（20260905320000，`batches_of`）。
     空阵列 = 这一件没有批号 → 整段不画，见 item-batches.tsx 档头。 */
  let itemBatches: ItemBatch[] = [];

  /* 这一笔预约做了什么（[任务 397] 查到的洞）。`treatment_notes.appointment_id`
     建表那天就有，从来没有人送过值——治好的是「读」这一半：一旦表单或助手
     真的开始送这个连结，这一段立刻看得到，不用再改这一页一个字。
     空阵列 = 这一笔还没连过任何一条笔记 → 整段不画，同一条纪律。 */
  let appointmentTreatments: TreatmentVisit[] = [];

  /* 沙龙那一本日记簿——做什么 · 谁做 · 多少钱 · 小费（20260910010000 ·
     20260911190000，[任务 402]）。`undefined` = 没有问（不是预约那几页）。
     跟上面 `appointmentTreatments`（medi spa 的病历）是两件不同的事，
     两段都在，不冲突——一笔预约可以同时有沙龙的几行跟医美的一条笔记。 */
  let visitLines:
    | { id: string; service: string; staffName: string; priceCents: number | null; tipCents: number | null }[]
    | undefined = undefined;
  let visitStaffOptions: { id: string; name: string }[] = [];

  let earned: {
    paidCents: number;
    costCents: number;
    profitCents: number;
    byCategory: { name: string | null; cents: number }[];
  } | null = null;

  if (ctx.isDirectory) {
    const { data } = await supabase
      .from("directory_entries")
      .select(
        "id, name, contact_person, phone, whatsapp, email, region, address, reg_no, tax_id, status, note, credit_limit_cents, portal_ref, extra, archived_at",
      )
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
      credit_limit:
        data.credit_limit_cents == null
          ? ""
          : (ringgit(data.credit_limit_cents) ?? ""),
    });
    Object.assign(values, ownColumns(data.extra));
    archivedAt = data.archived_at;

    /* ── 他自己那条连结，跟他送进来的那几笔（20260905680000）────────────
       🔴 **只有客户跟供应商**。师傅有登入，走里面那条路 ——
       `open_party_portal` 自己就会拒绝一个 staff，而画一颗按下去
       一定失败的按钮，正是这个仓库禁的那一种。
       ⚠️ 收起来的人也不画：一条连到一个已经收起来的人的连结，
       打开是死的，而画面上会看起来像它还能用。 */
    if (
      (pageKey === "customers" || pageKey === "suppliers") &&
      !data.archived_at
    ) {
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
      const holder = (
        (pageRows ?? []) as { page_key: string; title: string | null }[]
      ).find((r) => PIPELINE_MODULES.has(r.page_key));
      landsIn = holder?.page_key ?? null;
      landsInLabel = holder?.title ?? holder?.page_key ?? null;
      /* `in_open_only: false` —— 已经开成单的、丢掉的都要看得到。
         一笔送进来之后消失的请求，读起来像系统把它吃掉了。 */
      const { data: reqRows } = await supabase.rpc("party_requests_of", {
        in_project_id: ctx.projectId,
        in_open_only: false,
      });
      partyRequests = (
        (reqRows ?? []) as {
          id: string;
          party_id: string;
          what: string;
          qty: number | null;
          amount_cents: number | null;
          contact: string | null;
          status: string;
          /* ⚠️ 它叫 `asked_on`，不是 `created_at` —— 第一版写错，
           而那一栏 undefined 之后 `.slice()` 把整页炸掉，
           画面上写的是「Something broke here」。 */
          doc_no: string | null;
          asked_on: string;
        }[]
      )
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
      const mine = (
        (owingRows ?? []) as {
          referrer_id: string;
          jobs: number | null;
          received_cents: number | null;
          promised_cents: number | null;
          paid_cents: number | null;
          owing_cents: number | null;
        }[]
      ).find((r) => r.referrer_id === recordId);
      const rows = (sentRows ?? []) as {
        record_id: string;
        doc_no: string | null;
        title: string | null;
        party: string | null;
        received_cents: number | null;
        promised_cents: number | null;
      }[];

      if (mine && rows.length) {
        /* `referred_jobs` 不回是哪一页 —— 那几个 id 在手上，一句就问得到。
           一条连不过去的连结，跟一颗按不动的按钮是同一件事。 */
        const { data: whereRows } = await supabase
          .from("pipeline_records")
          .select("id, module_key")
          .in(
            "id",
            rows.map((r) => r.record_id),
          );
        const pageOf = new Map(
          ((whereRows ?? []) as { id: string; module_key: string }[]).map(
            (w) => [w.id, w.module_key],
          ),
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
        id: string;
        module_key: string;
        doc_no: string | null;
        title: string | null;
        stage: string | null;
        amount_cents: number | null;
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
       🔴 **读 `party_visits`，不在这里自己数一次。**

       在 2026-09-09 之前这一页有它自己的两个 count —— 而那一天疗程记录
       接上来之后，那一份跟资料库那一支当场分家：图上同一屏写着
       「How often they come — Nothing yet」，而正下方是她的两次疗程。
       [任务 216 · 229 · 259](../../../../../docs/founder-tasks.md) 登记过三次
       「同一个问题两份实作」，而这是它第一次真的说谎。

       ⚠️ 那一支自己带着这一页答不出来的东西：走进来做的那一次也算来过，
       而挂在预约上的那一笔不数两次（20260909120000）。 */
    const { data: seen } = await supabase.rpc("party_visits", {
      in_project_id: ctx.projectId,
      in_party_id: recordId,
    });
    const met = ((seen ?? []) as { visits: number; last_on: string | null }[])[0];
    visits = met?.visits ?? 0;
    lastOn = met?.last_on ?? null;

    /* 「一共多少」是钱。 */
    if (ctx.role === "owner") {
      const { data: spentRows } = await supabase
        .from("pipeline_records")
        .select("amount_cents")
        .eq("party_id", recordId);
      spentCents = (spentRows ?? []).reduce(
        (n: number, r: { amount_cents: number | null }) =>
          n + (r.amount_cents ?? 0),
        0,
      );
    }

    /* ── 客户那一页：她做过什么 ────────────────────────────────────────
       🔴 `works_here` —— 做那个疗程的美疗师**必须**看得到上一次用了什么。
       那一整张表存在的理由就是这一句（20260909040000 的档头）。
       ⚠️ 而它一笔都没有的时候整段不画：一间装修公司的客户页上，
       一段永远写着「还没有记录」的东西，读起来是这一页没做完。 */
    if (pageKey === "customers") {
      const { data: notes } = await supabase.rpc("treatment_notes_of", {
        in_party_id: recordId,
      });
      const rows = (notes ?? []) as {
        id: string;
        done_on: string;
        what: string;
        area: string;
        note: string;
        staff_name: string;
        archived: boolean;
        products: TreatmentVisit["products"] | null;
      }[];

      treatments = await withTreatmentPhotos(supabase, rows);
    }

    /* ── 客户那一页：他先付了、还没用掉的钱 ────────────────────────────
       🔴 只问看得到钱的人。师傅拿回来的是空的，而空的会画成
       「他没有余额」—— 对一个刚付了一千块的客人撒谎。所以问都不问。
       ⚠️ 冲正过的那几笔不算（`countsAsReceived` 同一条规矩）。 */
    if (ctx.role === "owner") {
      const { data: paid } = await supabase
        .from("ledger_entries")
        .select(
          "id, doc_no, note, entry_on, amount_cents, allocated_cents, adjusts_id, module_key",
        )
        .eq("party_id", recordId)
        .eq("direction", "in")
        .order("entry_on", { ascending: false });
      const rows = (paid ?? []) as {
        id: string;
        doc_no: string | null;
        note: string | null;
        entry_on: string;
        amount_cents: number | null;
        allocated_cents: number | null;
        adjusts_id: string | null;
        module_key: string;
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
      /* 🔴 那个总数问资料库，不在这里再加一次。
         `party_deposit`（20260905140000）从写出来那天起零个呼叫，
         而这一页自己拿 `unallocatedOf` 加了一份 —— **同一个问题两份实作**
         （[任务 216](../../../../../docs/founder-tasks.md#216) 登记过，
         [任务 229](../../../../../docs/founder-tasks.md#229) 逐句比过：
         今天两边算出来一样）。而月结那张纸跟「谁欠我钱」读的是资料库那一支，
         所以这里读同一支，这一页上那个数字才不会跟发出去那张纸分家。

         ⚠️ 底下那几行留着，而且它们**不是**第二份算术：那一支只回一个总数，
         答不了「那是哪几笔付的」，而那正好是他下一句会问的。
         🔴 读不到就退回自己加 —— 一个因为读不到而写 RM 0 的余额，
         对一个刚付了一千块的客人是一句假话。 */
      const { data: dep } = await supabase.rpc("party_deposit", {
        p_project_id: ctx.projectId,
        p_party_id: recordId,
      });
      credit = {
        cents:
          dep == null
            ? holding.reduce((n, e) => n + e.cents, 0)
            : Number(dep),
        from: holding,
      };

      /* 🔴 一支自己回三个数字（她自己付的 · 送的 · 加起来），
         这里只要送的那一个 —— 她自己付的那一份上面那一段已经在讲，
         两段都印会变成同一件事说两次。[任务 346] 接的就是这一格：
         `stored_value_moves` 从写出来那天起，这一页零个呼叫。 */
      const { data: sv } = await supabase.rpc("credit_of", {
        in_project_id: ctx.projectId,
        in_party_id: recordId,
      });
      const svRow = Array.isArray(sv) ? sv[0] : sv;
      if (svRow) storedCredit = { giftCents: Number(svRow.gift_cents ?? 0) };
    }

    /* ── 客户那一页：他还剩几次 ────────────────────────────────────────
       剩几次是 `package_balance` 数出来的，不是存起来的一栏。
       ⚠️ 只在客户页 —— 套票是卖给客人的（资料库那边也是这样挡的）。 */
    if (pageKey === "customers") {
      const { data: packRows } = await supabase
        .from("package_balance")
        .select(
          "package_id, name, sessions_total, sessions_left, sold_on, expires_on, expired",
        )
        .eq("party_id", recordId)
        .is("archived_at", null)
        .order("sold_on", { ascending: false });
      packages = (
        (packRows ?? []) as {
          package_id: string;
          name: string | null;
          sessions_total: number;
          sessions_left: number;
          sold_on: string;
          expires_on: string | null;
          expired: boolean;
        }[]
      ).map((x) => ({
        id: x.package_id,
        name: x.name ?? "",
        total: Number(x.sessions_total),
        left: Number(x.sessions_left),
        soldOn: x.sold_on,
        expiresOn: x.expires_on,
        expired: !!x.expired,
      }));
    }

    /* ── 客户那一页：她签了没有 ──────────────────────────────────────
       两支一起问：**她那几份**（consents_of）跟**这门生意有哪几份范本**
       （consent_forms_of）—— 少了后面那一支，那个下拉是空的，
       而一颗选不了东西的按钮是这个仓库禁的第一条。 */
    if (pageKey === "customers") {
      const [sheetRes, formRes] = await Promise.all([
        supabase.rpc("consents_of", { in_party_id: recordId }),
        supabase.rpc("consent_forms_of", { in_project_id: ctx.projectId }),
      ]);
      consents = ((sheetRes.data ?? []) as {
        id: string;
        form_name: string;
        share_ref: string | null;
        sent_at: string;
        signed_at: string | null;
        signed_name: string | null;
        signed_note: string | null;
      }[]).map((x) => ({
        id: x.id,
        formName: x.form_name,
        shareRef: x.share_ref,
        sentAt: x.sent_at,
        signedAt: x.signed_at,
        signedName: x.signed_name,
        signedNote: x.signed_note,
      }));
      /* 收起来的那几份发不出去（那一支会拒绝），所以下拉里不放它们。 */
      consentForms = ((formRes.data ?? []) as {
        id: string;
        name: string;
        archived: boolean;
      }[])
        .filter((f) => !f.archived)
        .map((f) => ({ id: f.id, name: f.name }));
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
    if (
      ctx.role === "owner" &&
      (pageKey === "staff" ||
        pageKey === "customers" ||
        pageKey === "suppliers")
    ) {
      const month = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kuala_Lumpur",
        year: "numeric",
        month: "2-digit",
      })
        .format(new Date())
        .slice(0, 7);
      const [{ data: tierRows }, { data: earnRows }, { data: schemeRows }] =
        await Promise.all([
          supabase
            .from("commission_tiers")
            .select("id, from_cents, percent")
            .eq("party_id", recordId)
            .order("from_cents"),
          supabase.rpc("staff_earnings", {
            in_project_id: ctx.projectId,
            in_month: month,
          }),
          /* 🔴 世代问那一支，不读那张表。
             `commission_schemes_of`（20260905650000）从写出来那天起零个呼叫，
             而这一页自己在 TypeScript 里把「同一天只算后存的那一份」
             重写了一遍 —— **同一个问题两份实作**。
             而它还多回一样这一页答不出来的：`used_this_month` ——
             哪一份是这个月那个数字照着算的。那一条正是[任务 180] 的靶：
             一个跟旁边那个数字对不上的标签，比没有标签糟。 */
          supabase.rpc("commission_schemes_of", { in_party_id: recordId }),
        ]);
      tiers = (
        (tierRows ?? []) as {
          id: string;
          from_cents: number;
          percent: number;
        }[]
      ).map((t) => ({
        id: t.id,
        /* 存的是分，他打的是块。「500000」在那个框里对他没有意义。 */
        from: String(Number(t.from_cents) / 100),
        /* 「10.00」回来是 numeric(5,2)；他打的是 10。 */
        percent: String(Number(t.percent)),
      }));
      const mine = (
        (earnRows ?? []) as {
          party_id: string;
          earned_cents: number;
          commission_cents: number;
          rate_from: string | null;
          kind: string | null;
        }[]
      ).find((r) => r.party_id === recordId);
      earnedCents = Number(mine?.earned_cents ?? 0);
      commissionCents = mine ? Number(mine.commission_cents) : null;
      rateFrom = mine?.rate_from ?? null;
      rateKind = mine?.kind ?? null;
      /* 🔴 **同一天只留最后存的那一份。**
         那张表是只加不改的，所以同一天存两次就有两行 —— 而资料库
         只认后存的那一份（20260905770000）。两行都列出来，
         等於画面在讲一份已经作废的办法，而他分不出是哪一份。

         ⚠️ 我 2026-09-07 拿掉过这一段，以为 `commission_schemes_of` 会去重 ——
         **它不会**（它 `select ... from commission_schemes` 全部回，
         只多算一栏 `used_this_month`）。那把尺当场红：同一天两行都印出来了。
         它真正给的是**顺序**（`effective_from desc, created_at desc`）——
         所以某一天第一次看到的那一行，就是资料库会用的那一行。
         而顺序不可以在这里重排，不然这一句就不成立了。

         ⚠️ 六份就够了 —— 一份读不完的历史没有人看。 */
      const seenDay = new Set<string>();
      rateHistory = (
        (schemeRows ?? []) as {
          effective_from: string;
          tiers: unknown;
          used_this_month: boolean;
        }[]
      )
        .filter((r) => {
          if (seenDay.has(r.effective_from)) return false;
          seenDay.add(r.effective_from);
          return true;
        })
        .slice(0, 6)
        .map((r) => ({
          from: r.effective_from,
          usedThisMonth: !!r.used_this_month,
          tiers: (Array.isArray(r.tiers) ? r.tiers : []).map((t) => {
            const row = t as { from_cents?: unknown; percent?: unknown };
            return {
              fromCents: Number(row.from_cents ?? 0),
              percent: Number(row.percent ?? 0),
            };
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

    /* 上下班打卡——师傅自己打得到，不用先看得到钱（`works_here` 就够）。
       跟抽成那一段不同一道闸，因为「在不在店里」不是薪水。 */
    if (pageKey === "staff") {
      const [{ data: openShift }, { data: hoursRows }] = await Promise.all([
        supabase
          .from("staff_shifts")
          .select("clock_in_at")
          .eq("staff_id", recordId)
          .is("clock_out_at", null)
          .maybeSingle(),
        supabase.rpc("hours_worked_of", {
          in_project_id: ctx.projectId,
          in_days: 30,
        }),
      ]);
      const mine = ((hoursRows ?? []) as { staff_id: string; hours: number; shifts_worked: number }[]).find(
        (r) => r.staff_id === recordId,
      );
      shiftInfo = {
        clockedInSince: openShift?.clock_in_at ?? null,
        hours: mine ? Number(mine.hours) : 0,
        shifts: mine ? Number(mine.shifts_worked) : 0,
      };
    }

    if (ctx.role === "owner" && jobIds.length) {
      const { data: allocRows } = await supabase
        .from("ledger_allocations")
        .select("entry_id, record_id, term_id, amount_cents")
        .in("record_id", jobIds);
      const entryIds = [
        ...new Set(
          (allocRows ?? []).map((a: { entry_id: string }) => a.entry_id),
        ),
      ];
      const { data: entryRows } = entryIds.length
        ? await supabase
            .from("ledger_entries")
            .select("id, adjusts_id")
            .in("id", entryIds)
        : { data: [] };
      const gone = reversedIds(
        (entryRows ?? []) as { id: string; adjusts_id: string | null }[],
      );
      const facts = (
        (entryRows ?? []) as { id: string; adjusts_id: string | null }[]
      ).map((e) => ({
        id: e.id,
        adjusts_id: e.adjusts_id,
        reversed: gone.has(e.id),
      }));
      owing = (jobRows ?? []).reduce(
        (n: number, j: { id: string; amount_cents: number | null }) => {
          const s = settleDocument({
            documentCents: j.amount_cents,
            allocations: (
              (allocRows ?? []) as {
                entry_id: string;
                record_id: string;
                term_id: string | null;
                amount_cents: number;
              }[]
            ).filter((a) => a.record_id === j.id),
            entries: facts,
          });
          return n + s.outstandingCents;
        },
        0,
      );
    }

    addresses = (addrRows ?? []).map(
      (a: {
        id: string;
        label: string | null;
        line: string | null;
        region: string | null;
        is_billing: boolean | null;
      }) => ({
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
      .select(
        "id, name, unit, location, sku, pack_size, pack_unit, reorder_at, note, extra, archived_at",
      )
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
      reorder_at:
        data.reorder_at == null ? "" : String(Number(data.reorder_at)),
      note: data.note ?? "",
      amount: hand?.on_hand == null ? "0" : String(Number(hand.on_hand)),
    });
    Object.assign(values, ownColumns(data.extra));
    archivedAt = data.archived_at;

    /* 这一件货自己的批号 —— 同一支 `expiry` 那一页在用的 RPC，
       这里只问这一件。`sees_money` 判断在资料库那一层，unit_cost_cents
       对看不到钱的人已经是 null，这里原样接住就好。 */
    const { data: batches } = (await supabase.rpc("batches_of", {
      in_item_id: recordId,
    })) as {
      data: {
        batch_id: string;
        code: string;
        expiry_on: string | null;
        received_on: string | null;
        on_hand: number;
        days_left: number | null;
        is_expired: boolean;
        unit_cost_cents: number | null;
      }[] | null;
    };
    itemBatches = (batches ?? []).map((b) => ({
      batchId: b.batch_id,
      code: b.code,
      onHand: Number(b.on_hand ?? 0),
      unit: data.unit ?? "",
      receivedOn: b.received_on,
      expiryOn: b.expiry_on,
      daysLeft: b.days_left,
      isExpired: !!b.is_expired,
      unitCostCents: b.unit_cost_cents ?? null,
    }));
  } else if (ctx.shape === "calendar") {
    const { data } = await supabase
      .from("appointments")
      .select(
        "id, starts_at, ends_at, kind, party, party_id, service, status, note, extra, archived_at, deposit_cents, public_ref",
      )
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
      const at = (type: string) =>
        got.find((x) => x.type === type)?.value ?? "";
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
    /* 🔴 只留服务名，不再重复客人的名字——读的时候大标题已经是她的名字了
       （ReadFirst，2026-09-12），改的时候「Which customer」那一格几行
       之外也看得到。两边都不缺这句话，原样重复反而多讲一次。 */
    apptWho = data.service?.trim() || null;
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

    /* 她自己那张预约的连结——一张挡起来的时段没有客人，没有人可以发。 */
    if (data.kind !== "block") {
      bookingPublicRef = data.public_ref;
    }

    /* 她放过几次飞机 · 这一单要不要订金（20260909320000）。
       🔴 一张挡起来的时段（`kind = "block"`）没有客人，问不出这句话——
       跟同一支自己的 `where a.kind = 'booking'` 同一条判断。 */
    if (data.kind !== "block" && data.party_id) {
      const { data: adv } = await supabase.rpc("deposit_advice", {
        in_project_id: ctx.projectId,
        in_party_id: data.party_id,
      });
      const row = Array.isArray(adv) ? adv[0] : adv;
      noShowInfo = row
        ? {
            missed: Number(row.missed ?? 0),
            came: Number(row.came ?? 0),
            lastMissedOn: row.last_missed_on ?? null,
            ruleAfter: row.rule_after == null ? null : Number(row.rule_after),
            advise: Boolean(row.advise),
            suggestCents:
              row.suggest_cents == null ? null : Number(row.suggest_cents),
            onHandCents:
              row.on_hand_cents == null ? null : Number(row.on_hand_cents),
            depositCents: data.deposit_cents == null ? null : Number(data.deposit_cents),
          }
        : null;
    }

    /* 这一笔预约做了什么（[任务 397]）——直接照 `appointment_id` 查，
       不走 `treatment_notes_of`：那一支只收 `party_id`，答不出「哪一笔」，
       改它的回传形状是功能地基那一层的事，这里只加一段读。 */
    const { data: apptNotesRaw } = await supabase
      .from("treatment_notes")
      .select(
        "id, done_on, what, area, note, archived_at, staff:staff_id(name), treatment_products(id, qty, unit, item:item_id(name), batch:batch_id(code))",
      )
      .eq("appointment_id", recordId)
      .order("done_on", { ascending: false });
    /* ⚠️ 没有生成过资料库型别，PostgREST 的内嵌单笔关联（`staff:staff_id(name)`）
       在这里的推断型别是阵列，不是单一物件——取第一个就是那一笔。 */
    const apptRows = (
      (apptNotesRaw ?? []) as {
        id: string;
        done_on: string;
        what: string;
        area: string | null;
        note: string | null;
        archived_at: string | null;
        staff: { name: string }[] | { name: string } | null;
        treatment_products: {
          id: string;
          qty: number;
          unit: string;
          item: { name: string }[] | { name: string } | null;
          batch: { code: string }[] | { code: string } | null;
        }[];
      }[]
    ).map((n) => {
      const one = <T,>(v: T[] | T | null): T | null =>
        Array.isArray(v) ? (v[0] ?? null) : v;
      return {
        id: n.id,
        done_on: n.done_on,
        what: n.what,
        area: n.area ?? "",
        note: n.note ?? "",
        staff_name: one(n.staff)?.name ?? "",
        archived: n.archived_at != null,
        products: (n.treatment_products ?? []).map((p) => ({
          id: p.id,
          item: one(p.item)?.name ?? "",
          qty: Number(p.qty),
          unit: p.unit ?? "",
          batch: one(p.batch)?.code ?? "",
        })),
      };
    });
    appointmentTreatments = await withTreatmentPhotos(supabase, apptRows);

    /* 沙龙那一本日记簿——做什么 · 谁做 · 多少钱 · 小费。一张挡起来的
       时段没有客人，没有这一段。 */
    if (data.kind !== "block") {
      const [{ data: lineRows }, { data: staffRows }] = await Promise.all([
        supabase
          .from("appointment_lines")
          .select("id, service, price_cents, tip_cents, staff:staff_id(name)")
          .eq("appointment_id", recordId)
          .order("sort_order"),
        supabase
          .from("directory_entries")
          .select("id, name")
          .eq("project_id", ctx.projectId)
          .eq("module_key", "staff")
          .is("archived_at", null)
          .order("name"),
      ]);
      const one = <T,>(v: T[] | T | null): T | null =>
        Array.isArray(v) ? (v[0] ?? null) : v;
      visitLines = (
        (lineRows ?? []) as {
          id: string;
          service: string;
          price_cents: number | null;
          tip_cents: number | null;
          staff: { name: string }[] | { name: string } | null;
        }[]
      ).map((l) => ({
        id: l.id,
        service: l.service,
        staffName: one(l.staff)?.name ?? "",
        priceCents: l.price_cents,
        tipCents: l.tip_cents,
      }));
      visitStaffOptions = (staffRows ?? []) as { id: string; name: string }[];
    }
  } else if (ctx.shape === "reconcile") {
    /* Read from the TABLE and not from the view: what is being edited is what
       the outside said, and our own side is not editable -- it is the sum of
       the ledger and there is deliberately no column holding it. */
    const { data } = await supabase
      .from("reconciliations")
      .select(
        "id, period, source, direction, their_cents, reference, note, extra, archived_at, settled_at",
      )
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
      their:
        data.their_cents == null ? "" : String(Number(data.their_cents) / 100),
      reference: data.reference ?? "",
      note: data.note ?? "",
    });
    Object.assign(values, ownColumns(data.extra));
    archivedAt = data.archived_at;
    settledAt = data.settled_at ?? null;
  } else if (ctx.shape === "ledger") {
    const { data } = await supabase
      .from("ledger_entries")
      .select(
        "id, doc_no, note, party, amount_cents, adjusts_id, branch_id, done_by, category, job_id, entry_on, extra",
      )
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
      (a: {
        record_id: string;
        term_id: string | null;
        amount_cents: number;
      }) => ({
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
      .select(
        "id, doc_no, title, party, amount_cents, stage, due_on, site_address_id, branch_id, extra, archived_at, share_ref, answer, answered_name, answered_at, answer_note, referrer_id, referral_portion, referral_amount_cents",
      )
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
      const fu = (
        (fuRows ?? []) as {
          id: string;
          what: string;
          due_on: string;
          days_late: number;
        }[]
      )[0];
      followUp = fu
        ? {
            id: fu.id,
            what: fu.what,
            dueOn: fu.due_on,
            daysLate: Number(fu.days_late),
          }
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
      runs = (
        (runRows ?? []) as {
          id: string;
          run_on: string | null;
          driver: string | null;
          received_by: string | null;
          signed_at: string | null;
          signed_name: string | null;
          note: string | null;
          lines: unknown;
        }[]
      ).map((r) => ({
        id: r.id,
        runOn: r.run_on,
        driver: r.driver,
        receivedBy: r.received_by,
        signedAt: r.signed_at,
        signedName: r.signed_name,
        note: r.note,
        lines: (Array.isArray(r.lines) ? r.lines : []).map((l) => {
          const x = l as {
            description?: unknown;
            qty?: unknown;
            unit?: unknown;
          };
          return {
            description:
              typeof x.description === "string" ? x.description : null,
            qty: x.qty == null ? null : Number(x.qty),
            unit: typeof x.unit === "string" ? x.unit : null,
          };
        }),
      }));
      shortfall = (
        (shortRows ?? []) as {
          description: string | null;
          unit: string | null;
          ordered: number;
          gone: number;
          still: number;
        }[]
      ).map((r) => ({
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
      const [{ data: retRows }, { data: lineRows }, { data: lentRows }] =
        await Promise.all([
        supabase.rpc("returns_of", { in_record_id: recordId }),
        /* ⚠️ 自己问一次那几行 —— 上面那一次没有 select `id`，
           而 `record_return` 要的正是 `line_id`。 */
        supabase
          .from("record_lines")
          .select("id, description, qty, unit")
          .eq("record_id", recordId)
          .order("sort_order"),
        /* 🔴 这一单借出去的东西。`rentals_of` 从 20260905540000 起就在，
           而画面上一个入口都没有 —— 而 `/rentals` 那一页只回**还没还的**，
           所以它答不了「这一单借过什么、几时还的」，而那正是他收尾这一单
           的时候问的。 */
        supabase.rpc("rentals_of", { in_record_id: recordId }),
      ]);
      lent = (
        (lentRows ?? []) as {
          id: string;
          descr: string;
          qty: number;
          out_on: string;
          due_back_on: string | null;
          returned_on: string | null;
          days_over: number;
        }[]
      ).map((r) => ({
        id: r.id,
        descr: r.descr,
        /* 「2.000」 回来是 numeric —— 他借的是 2。 */
        qty: String(Number(r.qty)),
        outOn: r.out_on,
        dueBackOn: r.due_back_on,
        returnedOn: r.returned_on,
        daysOver: Number(r.days_over),
      }));
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
    if (
      !data.archived_at &&
      ctx.role === "owner" &&
      PIPELINE_MODULES.has(pageKey)
    ) {
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
        const mine = (
          (jobRows ?? []) as {
            record_id: string;
            promised_cents: number | null;
          }[]
        ).find((j) => j.record_id === recordId);
        promised = mine ? (ringgit(mine.promised_cents ?? 0) ?? null) : null;
      }

      referral = {
        id: data.referrer_id ?? null,
        name,
        portion:
          data.referral_portion == null ? null : Number(data.referral_portion),
        amountCents:
          data.referral_amount_cents == null
            ? null
            : Number(data.referral_amount_cents),
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
      .select(
        "description, qty, unit, unit_price_cents, amount_cents, batch_code",
      )
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
      amount: t.amount_cents == null ? "" : (ringgit(t.amount_cents) ?? ""),
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
        .createSignedUrls(
          (picRows ?? []).map((x: { path: string }) => x.path),
          3600,
        );
      /* ⚠️ 每一个都可能签失败（那个档案不在了），所以型别上 signedUrl 是
         可空的 —— 而它就是可空的，不要断言掉它。 */
      const urlByPath = new Map<string, string>(
        (signed ?? [])
          .filter((x) => !!x.path && !!x.signedUrl)
          .map((x) => [x.path as string, x.signedUrl as string]),
      );
      photos = (
        (picRows ?? []) as {
          id: string;
          path: string;
          caption: string | null;
        }[]
      )
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
      const entryIds = [
        ...new Set(
          (allocRows ?? []).map((a: { entry_id: string }) => a.entry_id),
        ),
      ];
      const { data: entryRows } = entryIds.length
        ? await supabase
            .from("ledger_entries")
            .select("id, adjusts_id")
            .in("id", entryIds)
        : { data: [] };
      const gone = reversedIds(
        (entryRows ?? []) as { id: string; adjusts_id: string | null }[],
      );
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
          entry_id: string;
          record_id: string;
          term_id: string | null;
          amount_cents: number;
        }[],
        entries: (
          (entryRows ?? []) as { id: string; adjusts_id: string | null }[]
        ).map((e) => ({
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

      /* 🔴 「这张单我叫了多少、到了多少、付了多少 —— 对得上吗？」
         `purchase_match` 从 20260906070000 起就在，而画面上一个入口都没有。
         ⚠️ 只问看得到钱的人：那一支自己是 `sees_money`，师傅问它会抛，
         而一段抛掉的读数会画成「对得上」—— 那是一句假话。 */
      if (ctx.role === "owner") {
        const { data: m } = await supabase.rpc("purchase_match", {
          in_record_id: recordId,
        });
        const row = (
          m as
            | {
                ordered_cents: number;
                paid_cents: number;
                unpaid_cents: number;
                lines_total: number;
                lines_arrived: number;
                arrived: boolean;
                overpaid_cents: number;
              }[]
            | null
        )?.[0];
        if (row) {
          match = {
            orderedCents: Number(row.ordered_cents),
            paidCents: Number(row.paid_cents),
            unpaidCents: Number(row.unpaid_cents),
            linesTotal: Number(row.lines_total),
            linesArrived: Number(row.lines_arrived),
            arrived: !!row.arrived,
            overpaidCents: Number(row.overpaid_cents),
          };
        }
      }
    }

    lines = (rows ?? []).map((r) => ({
      description: r.description ?? "",
      /* 「2.500」 comes back from numeric(14,3); he typed 2.5 and that is what
         he should see again. */
      qty: r.qty == null ? "" : String(Number(r.qty)),
      unit: r.unit ?? "",
      unitPrice: ringgit(r.unit_price_cents) ?? "",
      amount: ringgit(r.amount_cents) ?? "",
      batchCode: r.batch_code ?? "",
    }));
  }

  /* ── 改过什么 ────────────────────────────────────────────────────────
     🔴 只问看得到钱的人。`record_changes` 的 policy 就是 sees_money，
     所以师傅问它拿回来的是空的 —— 而空的会画成「从来没有人改过」，
     那是一句假话。所以问都不问，整段不画。 */
  if (ctx.role === "owner") {
    const { data: changeRows } = await supabase
      .from("record_changes")
      .select(
        "id, entity, entity_id, label, field, was, now_is, changed_by, created_at",
      )
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
      (
        (changeRows ?? []) as {
          id: string;
          entity: string;
          entity_id: string;
          label: string | null;
          field: string;
          was: string | null;
          now_is: string | null;
          changed_by: string | null;
          created_at: string;
        }[]
      ).map((r) => ({
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
            c.key === "primary"
              ? "title"
              : c.key === "secondary"
                ? "party"
                : c.key === "amount"
                  ? "amount_cents"
                  : c.key === "status"
                    ? "stage"
                    : c.key,
            c.label,
          ]),
        ),
        names,
      },
    );
  }

  /* 🔴 「展示的页面跟要填写资料的页面」（2026-09-12 他讲的两次，
     一次讲预约页，一次讲成一句通用的规矩）——`ReadFirst` 从名册那几页
     ＋ 预约页再往下一页：**库存这一件货自己的页**。理由跟预约同一条：
     `on hand`（架上还有几件）今天已经是**锁住不给直接改**的（改法是记一次
     盘点），所以这一页本来就更像「查一件货现在的样子」，不是「填一张单」——
     跟一张报价单（[重点 29] 讲的「他打开就是要改它」）不是同一种页。 */
  const readFields: ReadField[] =
    ctx.shape === "calendar"
      ? [
          { key: "day", label: copy.form.bookDay, value: values.day ?? "" },
          { key: "from", label: copy.form.bookFrom, value: values.from ?? "" },
          { key: "to", label: copy.form.bookTo, value: values.to ?? "" },
          { key: "service", label: copy.form.bookService, value: values.service ?? "" },
          { key: "staffName", label: copy.form.bookStaff, value: values.staffName ?? "" },
          { key: "note", label: copy.form.note, value: values.note ?? "" },
        ]
      : ctx.shape === "catalog"
        ? [
            { key: "location", label: copy.form.stockWhere, value: values.location ?? "" },
            { key: "unit", label: copy.form.stockUnit, value: values.unit ?? "" },
            { key: "amount", label: copy.form.stockOnHand, value: values.amount ?? "" },
            { key: "reorder_at", label: copy.form.stockReorder, value: values.reorder_at ?? "" },
            { key: "pack_size", label: copy.form.stockPackSize, value: values.pack_size ?? "" },
            { key: "pack_unit", label: copy.form.stockPackUnit, value: values.pack_unit ?? "" },
            { key: "sku", label: "SKU", value: values.sku ?? "" },
            { key: "note", label: copy.form.note, value: values.note ?? "" },
          ]
        : ctx.isDirectory
          ? [
              ...ctx.columns
                .filter((col) => col.key !== "primary")
                .map((col) => ({
                  key: col.key,
                  label: col.label,
                  value: values[col.key] ?? "",
                })),
              { key: "contact_person", label: copy.form.contactPerson, value: values.contact_person ?? "" },
              { key: "email", label: copy.form.email, value: values.email ?? "" },
              { key: "address", label: copy.form.address, value: values.address ?? "" },
              { key: "reg_no", label: copy.form.regNo, value: values.reg_no ?? "" },
              { key: "tax_id", label: copy.form.taxId, value: values.tax_id ?? "" },
              { key: "note", label: copy.form.note, value: values.note ?? "" },
            ]
          : [];

  /* 🔴 天天要按的那个动作，不是「填写资料」——见 read-first.tsx 那一条新档头。
     同一个节点，读的时候（ReadFirst）跟改的时候（NewRecordForm）都用它，
     不是两份：一份会漂，[重点 22e] 那一条老毛病。 */
  const afterHeadingNode = apptStatus ? (
    <AppointmentStatus
      id={recordId}
      status={apptStatus}
      who={apptWho}
      copy={copy.form}
    />
  ) : match ? (
    <PurchaseMatch
      facts={match}
      money={(c) => ringgit(c) ?? "—"}
      copy={copy.form}
    />
  ) : null;

  /* 🔴 客户 / 供应商那一页分两个分页签，不是一条到底——老板截图指出「每一
     页都是一个样式、还很多资料的样子」，真的去看后台系统的参考才动手的
     （`.screenshots/admins/arham-profile.jpg`：抬头之后就是页签，不是
     一条到底）。见 `record-tabs.tsx` 档头：这不是[任务 273] 记过的那个
     坑（页签的字跟段落自己的标题不是同一句），是不同的组法。
     ⚠️ 这两个变数只是把原本写在 JSX 里的几段挪到这里——内容、条件、
     每一段自己的注解一个字都没变，其余形状（预约 · 库存 · 走单……）
     一段都没进这两个变数，照旧在下面一条到底地画。 */
  const overviewTabContent = (
    <>
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
              <ul className="mt-3 flex flex-col gap-1">
                {credit.from.map((e) => (
                  <li
                    key={e.id}
                    className="[font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]"
                  >
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

      {storedCredit && ctx.isDirectory && pageKey === "customers" ? (
        <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
          <h2 className="[font-size:var(--text-sm)] tracking-[var(--tracking-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--color-on-canvas)]">
            {copy.form.storedCreditHeading}
          </h2>
          {storedCredit.giftCents > 0 ? (
            <>
              <div className="mt-2 [font-size:var(--text-stat)] [font-weight:var(--fw-semibold)] tabular-nums text-[color:var(--color-primary)]">
                {ringgit(storedCredit.giftCents)}
              </div>
              <p className="mt-1 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
                {copy.form.storedCreditLede}
              </p>
            </>
          ) : (
            <p className="mt-2 [font-size:var(--text-sm)] text-[color:var(--color-on-canvas-dim)]">
              {copy.form.storedCreditNone}
            </p>
          )}
          <StoredCreditPanel
            projectId={ctx.projectId}
            partyId={recordId}
            copy={copy.form}
          />
        </div>
      ) : null}
    </>
  );

  const accountTabContent = (
    <>
      {credit && ctx.isDirectory && pageKey === "customers" ? (
        <div className="mt-10">
          <PartyStatement
            projectId={ctx.projectId}
            partyId={recordId}
            depositCents={credit.cents}
            copy={copy.form}
          />
        </div>
      ) : null}

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

      {packages ? (
        <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
          <PackagesPanel
            partyId={recordId}
            rows={packages}
            copy={copy.form}
          />
        </div>
      ) : null}

      {consents ? (
        <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
          <ConsentPanel
            partyId={recordId}
            origin={SITE_URL}
            consentHref={`/${locale}/portal/consent`}
            sheets={consents}
            forms={consentForms}
            copy={copy.form}
          />
        </div>
      ) : null}
    </>
  );

  return (
    <StyleScope
      register={SYSTEM_REGISTER}
      palette={ctx.palette}
      data-surface="desk"
      className="min-h-screen"
    >
      {/* 🔴 2026-09-04：搬进系统的外壳里。老板：`不要设计看起来是好像两个人
          做得一样 一定要统一设计`。见 record-shell.tsx。 */}
      <RecordShell ctx={ctx}>
        {/* Wider when there is a document beside the form. A quotation is the
          only thing this system makes that somebody outside the business
          reads, and 560px cannot hold the form and the paper.
          ⚠️ 左右的内距交给外壳了 —— 两层内距会把这一页推得比别页窄。 */}
        {/* 🔴 名册那几页也用整个宽度（2026-09-09）。
          他讲「太长了吧 有点看看别人的如何做这个 UI 设计的」，而图上量出来
          手机 5396px、电脑那一屏**表单只有 450px 宽，右边六成是空的** ——
          十五段读的东西全部叠在一条窄栏里。
          参考那一页（`.screenshots/upstream/up-patient.png`）的做法正好相反：
          左边一列人、右边那个人的全部，**它把宽度用掉了**。 */}
        {/* 🔴 预约那几页也算进来（2026-09-10，[任务 354/357]）——
          `NoShowPanel` 是这个形状第一个用到右边那一栏的东西，加进来才发现：
          右边那一栏的宽度是 `minmax(0,1fr)`，算的是**外面这个容器剩下多少**，
          而 `calendar` 形状原本落在 560px 那一支，容器本身就等于左边那一栏，
          於是右边那一栏算出来是 0——`getBoundingClientRect` 量到的，
          不是眼睛能一次看出来的：`innerText` 照样读得到那些字（它不管宽度），
          Playwright 的 `visible` 断言才会一直说「找到了，但是隐藏的」。
          一个宽度算成 0 的区块，跟一个真的不存在的区块，画面上看起来一样，
          断言上看起来也一样——除非那把尺问的是宽度，不是文字在不在。 */}
        <main
          className={`w-full ${
            ctx.shape === "pipeline" ||
            ctx.shape === "calendar" ||
            ctx.shape === "catalog" ||
            ctx.isDirectory
              ? "max-w-[1080px]"
              : "max-w-[560px]"
          }`}
        >
          {/* 🔴 标题跟那一句说明交给表单画（2026-09-04）。参考页的主要动作
            在标题右边，而那颗按钮要知道「现在正在存」—— 这一页是伺服器画的，
            读不到那件事。所以标题跟按钮住在一起。 */}
          {/* 🔴 左边填，右边读 —— 只在宽的地方。
            窄屏一个字都不变（照旧一条到底），因为 390 上没有第二栏可以给。
            ⚠️ 而它不是分页签：分页签会把那十五段自己的抬头各印两次
            （[任务 273](../../../../../docs/founder-tasks.md) 量过），
            而这一版一个抬头都没有动。 */}
          <div className="lg:grid lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:items-start lg:gap-x-12">
            <div className="min-w-0">
          {/* 🔴 名册那几页 ＋ 预约那一页 ＋ 库存那一页默认是**读**，不是一张
            摊开的表单 —— 见 read-first.tsx 的档头（他 2026-09-09 看完上一版
            讲「我怎么觉得没差」，2026-09-12 又讲两次「展示的页面跟要填写
            资料的页面」——一次讲预约，一次讲成一句通用的规矩：
            「你弄到全部都是填写数据的页面」）。那几栏从 `ctx.columns` 来
            （名册那几页）或者是这个形状自己的几栏（预约 · 库存）——
            在这里手抄一份名单就是这个仓库栽过八次的那件事。
            ⚠️ **走单那几页（报价单 · 订单 · 工程 · 进货单）故意不接**——
            [重点 29] 记着的那条判准还成立：他打开一张报价单，多半就是
            要往上面加一行，多一颗 Edit 是多一次点击，不是省一次。 */}
          <ReadFirst
            enabled={
              ctx.isDirectory ||
              ctx.shape === "calendar" ||
              ctx.shape === "catalog"
            }
            heading={values.primary || ctx.title}
            showAvatar={ctx.isDirectory || ctx.shape === "calendar"}
            editLabel={copy.form.editOne}
            afterHeading={afterHeadingNode}
            fields={readFields}
          >
          <NewRecordForm
            heading={copy.editHeading(ctx.title)}
            lede={archivedAt ? copy.form.archived : copy.editLede}
            /* 🔴 他来了没有 —— **标题底下、表单卡上面**。
             在表单底下：客人站在面前，而他要滑过八个不用碰的格子。
             在标题上面（我第一版）：他还没看到这是哪一张预约就先按了。
             两个看图看出来的，而第二个更严重。
             ⚠️ 同一个节点也传给 `ReadFirst`（读的那一半，不是改的那一半），
             两边共用，见上面 `afterHeadingNode` 那一段。 */
            afterHeading={afterHeadingNode}
            projectId={ctx.projectId}
            moduleKey={ctx.pageKey}
            received={received}
            shape={
              ctx.shape as
                | "pipeline"
                | "ledger"
                | "directory"
                | "catalog"
                | "reconcile"
                | "calendar"
            }
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
            earnedValue={tiers ? (ringgit(earnedCents) ?? "RM 0") : null}
            photos={photos}
            changes={changes}
            record={{
              id: recordId,
              values,
              archivedAt,
              reversed,
              lines,
              terms,
              allocations,
              addresses,
              siteAddressId,
              branchId,
              docNo,
              dueOn,
              doneBy,
              category,
              jobId,
            }}
            settlement={settlement}
            earned={earned}
            copy={copy.form}
          />

            </ReadFirst>

            {/* 🔴 她做过什么，住在**主栏**，不在右边那一条。
              他 2026-09-09 看完上一版讲「我怎么觉得没差」，而图上最刺眼的
              是**左边空掉一千六百像素**：读的那一张卡只有三百多高，
              而整页最高的那一段（她的疗程）挤在右边那一条窄栏里。

              参考那一页（EspoCRM 真的客户记录页）分的就是这一条：
              **主栏放身份 ＋ 那条会长的历史，右边那一条窄栏放几张矮卡。**
              一笔都没有就整段不画（组件自己判）—— 见 treatment-history.tsx。

              ⚠️ 窄屏一个字都没变，只是顺序变了：读的卡 → 她做过什么 →
              其余。而那个顺序更对 —— 她做过什么正是他打开这一页要看的那一件。 */}
            {ctx.isDirectory && pageKey === "customers" && treatments.length > 0 ? (
              <div className="mt-8">
                <TreatmentHistory visits={treatments} copy={copy.form} />
              </div>
            ) : null}
            </div>

            {/* 读的那一边。⚠️ 每一段自己那条上界线留着 —— 在右边那一栏里
              它读起来是段跟段之间的分隔，而不是一条多出来的线。
              🔴 只有**第一段**那一条要拿掉：它上面什么都没有，画出来是
              一条孤单的横线（看图看出来的）。窄屏不动 —— 那时候它上面
              正好是表单，那一条是对的。 */}
            <div className="min-w-0 lg:[&>*:first-child]:mt-0 lg:[&>*:first-child]:border-t-0 lg:[&>*:first-child]:pt-0">
          {/* 他的单子。画在表单**底下**，因为它是读的，不是填的 ——
            而一个客户页上的第二颗「保存」会让他不知道按哪一颗。
            ⚠️ 只在名册页上。 */}
          {/* ⚠️ 师傅那一页不画这两段。
            两段读的都是 `party_id`，而 `party_id` 只会是客户或供应商 ——
            一个师傅永远不会是一张单的对方。所以在他那一页上，
            这两段**永远**写着「还没有来过」跟「还没有单」，
            而一段永远说同一句话的段落，读起来是这一页没做完。 */}
          <RecordTabs
            tabs={[
              {
                key: "overview",
                label: copy.form.recordTabOverview,
                /* 🔴 `overviewTabContent` 是一个 Fragment——就算它三个孩子
                   全是 null，Fragment 本身也不是 null，`!= null` 照样过。
                   真的判有没有内容要看**底下那几个布林值**，不是看 JSX
                   包出来的那个对象是什么。这一支撞过：预约那一页三个
                   条件全部不成立，却照样多画出一个空的「Overview」页签。 */
                content:
                  (ctx.isDirectory && pageKey !== "staff") ||
                  (!!credit && ctx.isDirectory && pageKey === "customers") ||
                  (!!storedCredit && ctx.isDirectory && pageKey === "customers")
                    ? overviewTabContent
                    : null,
              },
              {
                key: "account",
                label: copy.form.recordTabAccount,
                content:
                  (!!credit && ctx.isDirectory && pageKey === "customers") ||
                  portalRef !== undefined ||
                  !!packages ||
                  !!consents
                    ? accountTabContent
                    : null,
              },
            ]}
          />

          {/* 预约那一页多一段：这一笔当场做了什么（[任务 397]）。
            ⚠️ 一笔都没连过就整段不画——同一条纪律，见 treatment-history.tsx 档头。 */}
          {appointmentTreatments.length ? (
            <div className="mt-10">
              <TreatmentHistory visits={appointmentTreatments} copy={copy.form} />
            </div>
          ) : null}

          {/* 预约那一页多一段：沙龙那一本日记簿（[任务 402]）。
            ⚠️ `undefined` = 没有问（不是预约那几页，或者这一笔是挡起来的时段）——
            跟 `appointmentTreatments` 不同，这一段有「加一行」表单，
            所以即使一行都还没有也照样画（不是画一份空的等着填）。 */}
          {visitLines !== undefined ? (
            <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
              <VisitLinesPanel
                appointmentId={recordId}
                lines={visitLines}
                staffOptions={visitStaffOptions}
                copy={copy.form}
              />
            </div>
          ) : null}

          {/* 库存那一页多一段：这一件货自己有几批、哪一批先过期。
            ⚠️ 一批都没有就整段不画（组件自己判，跟「她做过什么」同一条纪律）。 */}
          {itemBatches.length ? (
            <div className="mt-10">
              <ItemBatches batches={itemBatches} copy={copy.form} />
            </div>
          ) : null}

          {/* 走单那几页多一段：这一单的下一步。
            排在这几段的最前面 —— 那是他读完这张单**接着要做**的那件事。
            ⚠️ `undefined` = 没有问（不是走单那几页，或者已经收起来了）。 */}
          {followUp !== undefined ? (
            <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
              <FollowUpPanel
                recordId={recordId}
                open={followUp}
                copy={copy.form}
              />
            </div>
          ) : null}

          {/* 预约那几页多一段：她放过几次飞机 · 这一单要不要订金。
            ⚠️ `undefined` = 没有问（不是预约那几页，或者这一笔没有连到客人）；
            `null` = 问过了，读不到（`deposit_advice` 失败）。 */}
          {noShowInfo ? (
            <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
              <NoShowPanel
                recordId={recordId}
                projectId={ctx.projectId}
                info={noShowInfo}
                copy={copy.form}
              />
            </div>
          ) : null}

          {/* 预约那几页多一段：她自己那条连结——取消 · 留评价（[任务 399]）。
            ⚠️ `undefined` = 没有问（不是预约那几页，或者这一笔是挡起来的时段）。 */}
          {bookingPublicRef !== undefined ? (
            <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
              <BookingLinkPanel
                origin={SITE_URL}
                publicRef={bookingPublicRef}
                copy={copy.form}
              />
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

          {/* 这一单借出去的东西。⚠️ 一件都没借过就整段不画 ——
            那一页已经九段，一段永远说「没有」的区块读起来是没做完。 */}
          {lent.length ? (
            <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
              <RentalsOnJob
                rentals={lent}
                rentalsHref={`/${locale}/portal/rentals`}
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

          {/* 客户 / 供应商那一页的「他自己那条连结」搬进分页签了
            （`accountTabContent`，上面那一段 `<RecordTabs>`）——这里不再
            重复画一次。 */}

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
              <SettleMonth
                id={recordId}
                settledAt={settledAt}
                copy={copy.form}
              />
            </div>
          ) : null}

          {/* 客户 / 供应商 / 师傅那一页多一段：他替我带过几单。
            ⚠️ `null` = 没有带过（或者读的人看不到钱）—— 整段不画。 */}
          {sent ? (
            <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
              <ReferredJobs
                tally={sent.tally}
                jobs={sent.jobs}
                copy={copy.form}
              />
            </div>
          ) : null}

          {/* 客户那一页的套票、同意书都搬进分页签了（`accountTabContent`）——
            这里不再重复画一次。 */}

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

          {/* 师傅那一页多一段：上下班打卡（[任务 401]）。
            ⚠️ `undefined` = 没有问（不是师傅那一页）。 */}
          {shiftInfo !== undefined ? (
            <div className="mt-10 border-t pt-8 [border-color:var(--color-ink-800)]">
              <StaffShiftPanel
                staffId={recordId}
                clockedInSince={shiftInfo.clockedInSince}
                hours={shiftInfo.hours}
                shifts={shiftInfo.shifts}
                copy={copy.form}
              />
            </div>
          ) : null}
            </div>
          </div>
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
    else if (typeof v === "number" || typeof v === "boolean")
      out[k] = String(v);
  }
  return out;
}

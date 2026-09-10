import { notFound, redirect } from "next/navigation";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";
import { firstRecordTable, type PuckLayout } from "@/lib/portal/layout-ops";
import { upgradeLayout } from "@/lib/portal/layout-upgrade";
import {
  buildPageLayout,
  displayOwnerName,
  isUngeneratedLayout,
  pageLabel,
  sortPages,
  systemLangOf,
  tradeLabels,
  stagesForModule,
  railNavNode,
  displayBusinessName,
  navGroup,
  type BusinessContext,
  type PageKey,
} from "@/lib/templates/industry-template";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";
import { chrome } from "@/lib/templates/copy";
import { MODULE_BY_KEY, type ModuleShape } from "@/lib/portal/module-catalog";
import { isLiveShape } from "@/lib/portal/shape-state";
import type { TableColumn, TableModel } from "@/lib/portal/table-model";
import {
  canOpenModule,
  loadWorkspace,
  type WorkspaceRole,
} from "@/lib/portal/workspace";
import { reversedIds, settleDocument } from "@/lib/portal/allocations";
import { priceSchedule } from "@/lib/portal/payment-terms";

/**
 * Everything 「加一单」 and 「改这一单」 both need, loaded once.
 *
 * ── WHY IT IS SHARED AND NOT COPIED ───────────────────────────────────────
 *
 * The two pages ask the same eight questions -- is this shape live, does THIS
 * business have this page, what are its columns, what are its own stage words,
 * who can it be attached to, what style is it wearing. Two copies would answer
 * them the same way today and differently in a month, which is the defect this
 * repo has shipped more times than any other.
 *
 * ⚠️ It calls notFound()/redirect() itself. That is deliberate: every one of
 * those exits is a rule about who may see the page, and a caller that has to
 * remember to check them is a caller that will forget one.
 */

export type RecordPageContext = {
  locale: string;
  pageKey: string;
  shape: ModuleShape;
  isDirectory: boolean;
  projectId: string;
  style: StyleName;
  palette: string | null;
  lang: "zh" | "en";
  /** This page's own table columns, which is what the form's boxes are made
   *  of -- a workshop that added 「车牌号」 gets a box for it. */
  columns: TableColumn[];
  /** This business's own workflow words. Only a pipeline has them. */
  stages: string[];
  /** 这一行是什么生意，给分期付款表建议惯例用。 */
  trade: string | null;
  /* 这门生意会不会**排时段** —— 有预约那一页才算。
     房间只有在会排时段的地方才有意思，而「哪一行」答不了这一句：
     一间沙龙跟一间 medi spa 都是 `beauty`，而只有后者订的是房；
     一间补习中心订的是教室，它是 `education`。
     所以问的是**他有没有那一页**，不是他属於哪一行。 */
  books: boolean;
  /** 他的公司名 —— 那张纸的抬头。见 new/document-preview.tsx。 */
  businessName: string | null;
  /**
   * 这一页的外壳 —— 侧栏那几行，跟顶栏那条面包屑。
   *
   * 🔴 2026-09-04 加的。老板：`不要设计看起来是好像两个人做得一样 一定要统一设计`。
   * 「加一单 · 改这一单 · 搬旧资料」三页本来**没有侧栏也没有顶栏** ——
   * 整个系统只有它们长这样，而客户是从系统里点进去的：一进去导航就不见了，
   * 唯一的出路是「取消」。
   *
   * ⚠️ 侧栏那几行是**读**产生器的（`railNavNode`），不是在这里重写一份 ——
   * 一份手写的导航清单会在客户加一页的那天变成假的。
   */
  rail: Record<string, unknown>;
  /** 顶栏那条面包屑：分组词 · 这一页的名字。跟系统每一页同一个来源。 */
  crumbs: string[];
  /** Who a record can be attached to. Empty on a directory page, which is
   *  where a party is created rather than chosen. */
  parties: { id: string; name: string }[];
  /** The page's own title, in the system's language. */
  title: string;
  backHref: string;
  /** Owner or 师傅. Carried so the form can say what it will not offer. */
  role: WorkspaceRole;
  /** 这笔钱可以分摊给哪几张单。只有钱那几页、而且只有看得到钱的人拿得到 ——
   *  一个空阵列在画面上要讲「没有单可以分」，不是「读不到」。 */
  openDocuments: OpenDocument[];
  /** 这一家所有客户/供应商的地址，给走单那几页挑工地用。
   *  一个客户只有一个地址的时候不用挑 —— 那时候画面上什么都不出现。 */
  partyAddresses: PartyAddress[];
  /** 每一个对象欠多少、欠多久、额度多少。
   *  ⚠️ **只有看得到钱的人拿得到**（`party_debts` 是 sees_money）——
   *  空物件的意思是「没有问」或者「没有人欠钱」，画面上两个都不该画。 */
  partyDebts: Record<string, PartyDebt>;
  /** 还在营业的分店。**只有两间以上才有意义** —— 一间店的生意占绝大多数，
   *  而一个只有一个选项的下拉是一个假的控件。 */
  branches: { id: string; name: string }[];
  /** 这一家的师傅。给钱那几页的「谁做的」挑（佣金算在那上面）。
   *  **一个人都没有的时候是空的，而空的意思是画面上什么都不出现** ——
   *  一人公司占我们客户的大多数，而一个只有「没有指定」的下拉是个假控件。 */
  staff: { id: string; name: string }[];
  /** 这一家自己开过的单，给一笔开销挂上去用（成本）。
   *  ⚠️ **不是 `openDocuments`**：那一份是「还没收齐的、可以分摊的单」，
   *  在开销页上还被过滤成只剩进货单。一笔水泥的成本属於一张**卖出去**的单，
   *  而且那张单收齐了也照样属於它。两份清单，两个问题。 */
  jobsForCost: { id: string; docNo: string; title: string; party: string }[];
  /** 他自己打过的类别。**没有建议清单** —— 任务 117 立过那一条：
   *  没有量过的行业就不建议，猜一份科目表比留白更糟。
   *  所以第一次是空的，而那是诚实的；他打第二笔的时候就有了。 */
  categories: string[];
};

/** 一个对象欠我多少。全部是算出来的，一栏都没有存（除了额度）。 */
export type PartyDebt = {
  owedCents: number;
  /** 最老的那一笔还没收齐的单，欠了几天。null = 那几张单都没有日期。 */
  oldestDays: number | null;
  /** 他自己写的额度。null = 没写，那是常态。 */
  limitCents: number | null;
};

/** 一个对象的一个地址。给「这张单是哪一个工地的」那个下拉。 */
export type PartyAddress = {
  id: string;
  partyId: string;
  label: string;
  line: string;
  region: string;
  isBilling: boolean;
};

/** 一张还没收齐的单，给分摊那个编辑器挑。 */
export type OpenDocument = {
  id: string;
  docNo: string;
  title: string;
  party: string;
  moduleKey: string;
  amountCents: number;
  /** 已经收到多少（冲正过的不算 —— lib/portal/allocations.ts）。 */
  paidCents: number;
  /** 这张单的分期，给他指名「这笔是订金」。 */
  terms: { id: string; description: string; dueCents: number }[];
};

export async function loadRecordPage(
  locale: string,
  pageKey: string,
  /**
   * 正在改的那一笔钱自己的 id。
   *
   * 🔴 只有一个用途，而它是看图才发现的：`openDocuments.paidCents` 是
   * 「这张单收到多少」，而在**改这一笔**的画面上，那个数字里已经含着这一笔。
   * 分摊编辑器又把他打在框里的数字减一次 —— 一张欠 RM 36,500 的单，
   * 旁边写着「还欠 RM 24,500」，同一笔钱扣了两次。
   *
   * 所以这里问的是「**除了这一笔以外**，别人付了多少」。
   */
  excludeEntryId?: string,
): Promise<RecordPageContext> {
  /* Only the shapes that hold real rows. 库存 and 对账 draw a table too, and
     they are still samples -- offering a form there would be a control that
     writes nowhere, which this repo has shipped enough times. */
  const shape = MODULE_BY_KEY[pageKey]?.shape;
  if (!shape || !isLiveShape(shape)) notFound();
  const isDirectory = shape === "directory";

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSessionSupabaseClient();

  /* WHICH BUSINESS, NOT WHOSE ACCOUNT -- see lib/portal/workspace.ts. Writing
     down a job from the site is the whole reason a supervisor has a login, so
     this is the one form he must be able to reach. */
  const workspace = await loadWorkspace();
  const { data: project } = workspace
    ? await supabase
        .from("projects")
        .select("id, style, palette, layout")
        .eq("id", workspace.projectId)
        .single()
    : { data: null };
  if (!project || !workspace) redirect("/login");

  /* And 收款 · 开销 · 佣金 are refused here too, not only on the page they are
     reached from. `add_ledger_entry` would refuse him at the database anyway;
     a form that collects an amount and then cannot save it is worse than no
     form, because he will have typed it. */
  if (!canOpenModule(workspace.role, pageKey)) notFound();

  const { data: pageRows } = await supabase
    .from("project_pages")
    .select("page_key, title, sort_order, layout_json")
    .eq("project_id", project.id);

  const page = (pageRows ?? []).find(
    (r: { page_key: string }) => r.page_key === pageKey,
  );
  /* Not 「this module exists in the catalogue」 -- 「this business has it」. A
     restaurant with no quotations page must not be given a form for one. */
  if (!page) notFound();

  const { data: context } = await supabase.rpc("get_my_business_context");
  const businessContext = (context as BusinessContext | null) ?? {};
  const lang = systemLangOf(businessContext);

  const savedLayout = (page.layout_json as Record<string, unknown>) ?? {};
  const pageRefs = sortPages(
    (pageRows ?? []).map(
      (r: {
        page_key: string;
        title: string | null;
        sort_order: number | null;
      }) => ({
        key: r.page_key,
        title: r.title,
        sortOrder: r.sort_order,
      }),
    ),
  );

  const layout = (isUngeneratedLayout(savedLayout)
    ? buildPageLayout(
        pageKey as PageKey,
        businessContext,
        displayOwnerName(businessContext, user.email?.split("@")[0] || "我"),
        locale,
        pageRefs,
        project.style as StyleName,
        (project.layout as string | null) ?? null,
      )
    : upgradeLayout(savedLayout, lang)) as unknown as PuckLayout;

  /* 🔴 预约那一页从 `d9463f0`（2026-09-09）起底下不再画一张 `RecordTable` ——
     那次的理由是对的（同一批预约印两次），而它漏了一步：这一支的守卫
     还在找一张已经不存在的表，於是从那天起**每一笔预约的连结都是 404**，
     包括那次提交自己讲的「日程上的块点得进那一笔」。`shoot:day` 只拍了
     日程本身，没有人真的点进去过一笔。
     ⚠️ 这不是收紧一条守卫，是接回一条被拿掉桥墩的桥——见 record-context.ts
     [任务 354/357] 的收尾。
     一个日程格没有自订栏位（新增一栏「车牌号」这件事只在报价单/工程那一类
     页面发生），`new-record-form.tsx` 的 `isCalendar` 分支自己也不读这四个
     栏位的 `label`，只读 `key`（`shown = []`）——所以这里给的是四个空白名，
     不是照抄旧表那四句话，因为旧表那四句话从来没有人在这条路上读过。 */
  const table =
    shape === "calendar"
      ? ({
          columns: [
            { key: "primary", label: "", kind: "text" },
            { key: "secondary", label: "", kind: "detail" },
            { key: "amount", label: "", kind: "amount" },
            { key: "status", label: "", kind: "status" },
          ],
          rows: [],
        } as TableModel)
      : firstRecordTable(layout);
  /* No table on the page means nothing to write into. The owner removed it,
     which is allowed; a form writing into a table he cannot see is not. */
  if (!table || !table.columns.length) notFound();

  const { data: parties } = isDirectory
    ? { data: null }
    : await supabase
        .from("directory_entries")
        .select("id, name")
        .eq("project_id", project.id)
        /* WHICH SIDE OF THE BOOK. 进货单 buys, so its picker offers suppliers
           -- the same rule directory_side() applies in the database, and the
           reason it exists: the same person can be both, and a purchase order
           attached to the CUSTOMER of that name files the money against the
           wrong side of the business. */
        .eq("module_key", pageKey === "purchases" ? "suppliers" : "customers")
        .is("archived_at", null)
        .order("name")
        .limit(500);

  const labels = tradeLabels(businessContext, pageRefs);

  /* ── 这笔钱可以分摊给哪几张单 ──────────────────────────────────────────
     只在钱那几页问，而且只问看得到钱的人 —— `ledger_allocations` 是
     sees_money，一个师傅问它拿回来的是空的，而空的跟「没有单」长得一模一样。

     ⚠️ 哪一边的单，照 directory_side() 同一条规矩：进货单是买的那一边。
     一笔客户的收款分摊到一张进货单，是把钱记到生意的反面 ——
     画面上完全正常，而月底对不起来。 */
  let openDocuments: OpenDocument[] = [];
  if (shape === "ledger" && workspace.role === "owner") {
    const buying = pageKey !== "payments";
    let q = supabase
      .from("pipeline_records")
      .select("id, doc_no, title, party, module_key, amount_cents")
      .eq("project_id", project.id)
      .is("archived_at", null)
      .gt("amount_cents", 0)
      .order("created_at", { ascending: false })
      .limit(200);
    q = buying
      ? q.eq("module_key", "purchases")
      : q.neq("module_key", "purchases");
    const { data: docs } = await q;
    const ids = (docs ?? []).map((d: { id: string }) => d.id);

    if (ids.length) {
      const [{ data: allAllocRows }, { data: termRows }] = await Promise.all([
        supabase
          .from("ledger_allocations")
          .select("record_id, entry_id, term_id, amount_cents")
          .in("record_id", ids),
        supabase
          .from("record_terms")
          .select(
            "id, record_id, description, portion, amount_cents, sort_order",
          )
          .in("record_id", ids)
          .order("sort_order"),
      ]);

      /* 除了正在改的这一笔以外。见 excludeEntryId 上面那一段。 */
      const allocRows = (allAllocRows ?? []).filter(
        (a: { entry_id: string }) => a.entry_id !== excludeEntryId,
      );

      /* 哪几笔钱被冲正了。要问，不能假设 —— 一张退过款的单印着「已收」，
         是他照一个假数字决定要不要开工。 */
      const entryIds = [
        ...new Set(allocRows.map((a: { entry_id: string }) => a.entry_id)),
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

      openDocuments = (docs ?? []).map(
        (d: {
          id: string;
          doc_no: string | null;
          title: string | null;
          party: string | null;
          module_key: string;
          amount_cents: number | null;
        }) => {
          const mine = allocRows.filter(
            (a: { record_id: string }) => a.record_id === d.id,
          ) as {
            entry_id: string;
            record_id: string;
            term_id: string | null;
            amount_cents: number;
          }[];
          const myTerms = (
            (termRows ?? []) as {
              id: string;
              record_id: string;
              description: string | null;
              portion: number | null;
              amount_cents: number | null;
            }[]
          ).filter((t) => t.record_id === d.id);
          const priced = priceSchedule(
            myTerms.map((t) => ({
              description: t.description ?? "",
              portion: t.portion,
              amount_cents: t.amount_cents,
            })),
            d.amount_cents ?? null,
          );
          const settled = settleDocument({
            documentCents: d.amount_cents,
            allocations: mine,
            entries: facts,
          });
          return {
            id: d.id,
            docNo: d.doc_no ?? "",
            title: d.title ?? "",
            party: d.party ?? "",
            moduleKey: d.module_key,
            amountCents: d.amount_cents ?? 0,
            paidCents: settled.paidCents,
            terms: myTerms.map((t, i) => ({
              id: t.id,
              description: t.description ?? "",
              dueCents: priced.terms[i]?.cents ?? 0,
            })),
          };
        },
      );
    }
  }

  /* ── 挑工地要的那份清单 ────────────────────────────────────────────────
     只有走单那几页要 —— 名册页自己在编辑地址，钱那几页不挂工地。
     一整家的地址加起来通常几十行，所以一次读完比每换一个客户打一次快。 */
  let partyAddresses: PartyAddress[] = [];
  if (shape === "pipeline") {
    const { data: addrRows } = await supabase
      .from("directory_addresses")
      .select("id, party_id, label, line, region, is_billing")
      .eq("project_id", project.id)
      .order("sort_order")
      .limit(1000);
    partyAddresses = (
      (addrRows ?? []) as {
        id: string;
        party_id: string;
        label: string | null;
        line: string | null;
        region: string | null;
        is_billing: boolean | null;
      }[]
    ).map((a) => ({
      id: a.id,
      partyId: a.party_id,
      label: a.label ?? "",
      line: a.line ?? "",
      region: a.region ?? "",
      isBilling: !!a.is_billing,
    }));
  }

  /* ── 谁欠我多少 ────────────────────────────────────────────────────────
     只在走单那几页问（开单那一刻才有用），而且只问看得到钱的人。 */
  let partyDebts: Record<string, PartyDebt> = {};
  if (shape === "pipeline" && workspace.role === "owner") {
    const { data: debtRows } = await supabase.rpc("party_debts", {
      in_project_id: project.id,
    });
    partyDebts = Object.fromEntries(
      (
        (debtRows ?? []) as {
          party_id: string;
          owed_cents: number;
          oldest_days: number | null;
          limit_cents: number | null;
        }[]
      ).map((r) => [
        r.party_id,
        {
          owedCents: Number(r.owed_cents ?? 0),
          oldestDays: r.oldest_days == null ? null : Number(r.oldest_days),
          limitCents: r.limit_cents == null ? null : Number(r.limit_cents),
        },
      ]),
    );
  }

  /* 还在营业的分店。走单跟钱那几页要挑，名册跟库存不用（客户是共用的，
     而库存分店是它自己的一格 —— 见 20260904110000 的档尾）。 */
  let branches: { id: string; name: string }[] = [];
  if (shape === "pipeline" || shape === "ledger") {
    const { data: brRows } = await supabase
      .from("branches")
      .select("id, name")
      .eq("project_id", project.id)
      .eq("active", true)
      .order("sort_order");
    branches = (brRows ?? []) as { id: string; name: string }[];
  }

  /* 这一家的师傅。只有钱那几页要 —— 佣金算在收到的钱上（20260904120000）。
     ⚠️ 名册页自己不用：一个师傅的页面是**建立**他的地方，不是挑他的地方。 */
  let staff: { id: string; name: string }[] = [];
  if (shape === "ledger") {
    const { data: staffRows } = await supabase
      .from("directory_entries")
      .select("id, name")
      .eq("project_id", project.id)
      .eq("module_key", "staff")
      .is("archived_at", null)
      .order("name");
    staff = (staffRows ?? []) as { id: string; name: string }[];
  }

  /* ── 一笔开销属於哪一单，跟他自己打过哪些类别 ─────────────────────────
     两个都只在钱那几页问。⚠️ 而且只问看得到钱的人：`ledger_entries` 是
     sees_money，一个师傅拿回来的是空的 —— 而空的会画成「他从来没写过类别」。 */
  let jobs: RecordPageContext["jobsForCost"] = [];
  const categories: string[] = [];
  if (shape === "ledger" && workspace.role === "owner") {
    const [{ data: jobRows }, { data: catRows }] = await Promise.all([
      supabase
        .from("pipeline_records")
        .select("id, doc_no, title, party")
        .eq("project_id", project.id)
        .is("archived_at", null)
        /* 进货单不在里面：一张进货单**本身就是**成本，不是一个成本挂得上去的
           工作。把它列进来，他会开始把水泥挂在买水泥那张单上。 */
        .neq("module_key", "purchases")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("ledger_entries")
        .select("category")
        .eq("project_id", project.id)
        .neq("category", "")
        .order("created_at", { ascending: false })
        .limit(400),
    ]);
    jobs = (jobRows ?? []).map((r) => ({
      id: r.id as string,
      docNo: (r.doc_no as string) ?? "",
      title: (r.title as string) ?? "",
      party: (r.party as string) ?? "",
    }));
    /* 最近用过的在前，重复的只留一次 —— 一个下拉里出现三次「材料」，
       读起来是这份清单坏了。 */
    const seen = new Set<string>();
    for (const r of catRows ?? []) {
      const c = ((r.category as string) ?? "").trim();
      if (c && !seen.has(c)) {
        seen.add(c);
        categories.push(c);
      }
    }
  }

  return {
    locale,
    pageKey,
    shape,
    isDirectory,
    projectId: project.id as string,
    style: project.style as StyleName,
    palette: (project.palette as string | null) ?? null,
    lang: lang === "en" ? "en" : "zh",
    columns: table.columns,
    /* 进货单's stages are its own -- see stagesForModule. The form offers
       what the page actually shows. */
    stages:
      shape === "pipeline" ? stagesForModule(businessContext, pageKey) : [],
    parties: (parties as { id: string; name: string }[] | null) ?? [],
    title: pageLabel({ key: pageKey, title: page.title ?? null }, labels, lang),
    backHref: `/${locale}/portal/${pageKey}`,
    role: workspace.role,
    openDocuments,
    partyAddresses,
    partyDebts,
    branches,
    staff,
    jobsForCost: jobs,
    categories,
    /* 他的公司名 —— 那张纸的抬头。2026-09-04：一张只写着「Quotations」的
       报价单，收到的人看不出是谁开的。`identity.business_name` 本来就在
       context 里，只是从来没有人往这一页传。 */
    businessName: businessContext.identity?.business_name ?? null,
    rail: (
      railNavNode(
        labels,
        displayBusinessName(businessContext),
        displayOwnerName(businessContext, user.email?.split("@")[0] || "我"),
        pageKey,
        locale,
        pageRefs,
        lang,
      ) as unknown as { props: Record<string, unknown> }
    ).props,
    crumbs: [
      navGroup(pageKey, pageRefs.length, chrome(lang)),
      pageLabel({ key: pageKey, title: page.title ?? null }, labels, lang),
    ].filter(Boolean) as string[],
    /* 这一行是什么生意 —— 分期付款表拿它去建议「订金三成 · 动工四成 ·
       完工三成」，而那是一颗他要按的按钮，不是一个预设。 */
    trade: businessContext.industry?.slug ?? null,
    books: pageRefs.some((p) => p.key === "bookings"),
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLiveStats, nowInMalaysia } from "./live-stats";
import { buildProfit, signedRinggit, type ProfitFact } from "./profit";
import { ringgit } from "./live-rows";
import { describeOwing, fetchPartyOwing, type OwingRead } from "./debts";
import type { WorkspaceRole } from "./workspace";

/**
 * WHAT THE ASSISTANT MAY SAY ABOUT HIS MONEY.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * The four figures on his first screen have been counted from his own books
 * since 2026-09-01. The assistant could not read one of them. So:
 *
 *   he types  「这个月收了多少」
 *   the page  behind the panel says 「本月收到 RM 12,340」
 *   the reply 「我看不到你的数字」
 *
 * That is the sixteenth time in this repository that a capability existed and
 * nothing was wired to it. The line being connected here is the shortest one
 * of the sixteen: the numbers are computed, localised, and already phrased in
 * this business's own nouns. They were simply never handed to the model.
 *
 * ── WHY IT IS NOT TEXT-TO-SQL ─────────────────────────────────────────────
 *
 * The open-source answer to this question is a model that writes the query
 * (vanna 23.8k★ MIT, DB-GPT 19.9k★ MIT, WrenAI 17.5k★ multi-licensed). Read
 * on 2026-09-03 and deliberately not taken, for a reason WrenAI's own
 * comparison table states first: a bare LLM agent "writes SQL for you ✅
 * (often wrong)". Their whole product is the guard rail around that -- dry
 * plan validation, row limits, structured errors -- and everything they built
 * it out of, we would have to build too.
 *
 * We do not need it. This business asks six questions, not six thousand, and
 * six answers can be counted in advance by code that a person has read. A
 * model that picks from six verified figures can be wrong about WHICH figure
 * the question wanted. A model that writes the query can be wrong about the
 * AMOUNT, silently, in a sentence that reads perfectly. Those two failures
 * are not the same size.
 *
 * What IS taken from them, and it is the expensive half of what they learned:
 *
 *   · the definitions live in a reviewable file, not buried in a prompt
 *     (WrenAI's semantic layer -- this file is ours)
 *   · identity flows through every layer, and the read is bounded by the
 *     same row-level rules a person meets (vanna 2.0's headline)
 *   · a row cap, so 「列出全部客户」 cannot return three thousand lines
 *
 * ── THE ONE RULE ──────────────────────────────────────────────────────────
 *
 * Everything below is COUNTED. Nothing is inferred, and the questions we
 * cannot count are named out loud in `gaps` -- because a model told only what
 * it knows will invent across the space between. Naming the hole is what
 * turns 「我不知道」 into 「那一格还没做，因为开销还挂不到某一单工程上」.
 */

/** Localised scaffolding. The FIGURES arrive already localised from
 *  live-stats -- these are only the words around them. */
const WORDS = {
  zh: {
    heading: "这家生意今天的数字（截至 <at>，全部从他自己的书数出来）",
    vsLast: "上个月",
    trend: "近六个月",
    rows: "最近这几笔（他自己的记录，可以直接引）",
    cannot: "答不了的（要老实讲，并说出为什么）",
    none: "他还没有任何记录，所以一个数字都数不出来。",
    unread: "读不到他的数字（这一次的查询失败了）。不要给任何数字，也不要说 0。",
    /* 🔴 系统自己看出来、而他还没处理的那几件。见下面 `nudges` 那一段。 */
    nudges: "系统自己看出来、今天要跟的（他还没处理）",
    nudgesNone: "系统自己看出来的那几件：今天一件都没有要跟的。",
    /* 🔴 他自己的价目。见下面 `prices` 那一段。 */
    prices: "他自己的价目（他货品页上打的价钱 —— 开单的时候直接用，不要自己估）",
    /* 🔴 陈生人在他官网上问的那几句。见下面 `enquiries`。 */
    enquiries: "他官网上进来、而他还没处理的询价（reply_to_enquiry 用那个编号）",
    /* 🔴 他的班。见下面 `classes`。 */
    classes: "他的班（bill_class 用那个编号；人数跟价钱是他自己设的）",
    /* 🔴 她的师傅。见下面 `crew`。 */
    crew: "他的师傅（book_appointment 的 staff 用那个编号）",
    /* 🔴 他的同意书范本。见下面 `consentForms`。 */
    consentForms: "他的同意书范本（request_consent 的 form_id 用那个编号）",
    /* 🔴 他讲过要记住的那几句。见下面 `memory` 那一段。 */
    memory: "他以前叫你记住的（他自己的规矩跟他纠正过你的地方 —— 照做，不要再问一次）",
  },
  en: {
    heading: "This business's figures today (as at <at>, all counted from their own books)",
    vsLast: "last month",
    trend: "last six months",
    rows: "The last few records (his own — quote them directly)",
    cannot: "Cannot be answered (say so plainly, and say why)",
    none: "They have no records yet, so nothing can be counted.",
    unread: "Their figures could not be read this time. Give no number, and never say 0.",
    nudges: "What the system itself has spotted and he has not dealt with yet",
    nudgesNone: "Nothing the system has spotted is outstanding today.",
    prices: "His own price list (the prices on his items page -- use these when raising a document, never estimate one)",
    enquiries: "Strangers who asked through his website and have not been dealt with (reply_to_enquiry takes the id)",
    classes: "His classes (bill_class takes the id; the head count and the fee are his own)",
    crew: "His people (book_appointment's staff takes the id)",
    consentForms: "His consent forms (request_consent's form_id takes the id)",
    memory: "What he told you to remember (his own rules, and where he corrected you -- follow them, do not ask again)",
  },
} as const;

/**
 * The questions this shape of system cannot answer yet, and the reason.
 *
 * ⚠️ Each line is a REASON, not an apology. 「还没做」 alone teaches the model
 * to say 「我不知道」, which is the answer that makes an owner stop asking.
 * The reason is what lets it say something useful instead.
 *
 * ⚠️ And each line must retire when its gap closes. A stale entry here is the
 * assistant refusing to answer something the product can now do -- which is
 * the same defect as claiming something it cannot, wearing the other face.
 */
const GAPS = {
  zh: {
    /* ⚠️ 「赚多少」2026-09-04 从这里退休了 —— 20260904200000 给了开销一个
       类别跟一个单，所以那个数字现在数得出来，就在下面的 figures 里。
       留下来的是它窄掉之后剩的那一半：**单张的利润页面上看得到，
       而助手还查不了单张**。一条过期的「答不了」，是助手拒绝回答一件
       产品已经做得到的事。 */
    job: "某一单赚多少 —— 那一单自己的页面上写着，而这里查不了单张",
    /* ⚠️ 「某一个客户欠多少」2026-09-05 从这里退休了一半 —— 欠款清单在
       上面了（`party_debts`）。剩下的是**单张**：一张单的逐项、分期、
       分摊，这里还查不了。 */
    doc: "某一张单的细节（逐项 · 分期 · 分摊）—— 单张查询那一支还没做",
    stock: "库存还剩多少 —— 这几个数字里不含库存",
    /* 🔴 只在**真的被截掉**的时候出现。没截的时候留着它，就是助手在说
       「我看不全」而它其实看得全 —— 一条过期的「答不了」。 */
    pricesCut: "他货品页上超过 40 件的那些 —— 这里只列了最近的 40 件，价目不在上面的要问他",
    nothingElse: "上面没有的任何数字 —— 不要自己相加减凑一个出来",
    /* 🔴 只在**没有问到**欠款的时候才出现。有问到的时候它是假的，
       而一条过期的「答不了」跟一句宣称做了却没做，是同一个缺陷的两张脸。 */
    owingUnread:
      "谁欠他钱 —— 这一次没有读到（要嘛他不是老板，要嘛那一支查询失败了）。不要讲「没有人欠你钱」",
  },
  en: {
    job: "What one job made — it is written on that job's own page, but this panel cannot look up a single document",
    doc: "The detail of one document (line items, instalments, allocations) — the single-document lookup does not exist yet",
    stock: "Stock on hand — not among these figures",
    pricesCut: "Items beyond the most recent 40 on his items page — a price not listed above must be asked for, never estimated",
    nothingElse:
      "Any figure not listed above — never add or subtract two of them to make a new one",
    owingUnread:
      "Who owes him money — not read this time (either he is not the owner, or that query failed). Never say that nobody owes him",
  },
} as const;

/** 永远成立的那几条。`owingUnread` 不在里面 —— 它跟着这一次的读数走。 */
const ALWAYS_GAPS = ["job", "doc", "stock", "nothingElse"] as const;

/** At most this many trend points reach the prompt. Six is what the chart
 *  under the tiles already shows, so the assistant and the picture cannot
 *  disagree about how far back the business can see. */
const TREND_CAP = 6;

/**
 * At most this many records reach the prompt.
 *
 * WrenAI's row limit, and the reason is his, not ours: 「列出全部客户」 must
 * not come back as three thousand lines in a chat panel. Five is enough to
 * make a total checkable and short enough that the answer stays an answer
 * rather than becoming a report.
 */
const ROW_CAP = 5;

/**
 * 系统自己看出来的那几件，最多送几条给模型。
 *
 * 跟 `ROW_CAP` 同一个理由，而这一条更硬：一间忙的店月底可能有三十条
 * （十二种信号 × 好几笔），而一个把三十条念完的助手，讲的是一份报告，
 * 不是一个答案。**排序由资料库决定**（`nudges_due` 自己排），
 * 所以截掉的是最不急的那几条，不是随便几条。
 */
const NUDGE_CAP = 6;

/**
 * 他自己的价目，最多送几件。
 *
 * 🔴 **40，而且截掉的时候要讲出来**（`pricesCut`）。一间五金店可以有五百件，
 * 而一个把五百件念进提示里的助手，花的是他每一句话的钱。四十件盖得住
 * 我们卖的那个市场（五个人的店），而**没盖住的那一部分要说出来** ——
 * 一个只看得到四十件、却表现得像看得到全部的助手，会替第四十一件估一个价。
 */
const PRICE_CAP = 40;

/**
 * 还没处理的询价，最多送几封。
 *
 * 五封。一个卡着三十封没回的老板，需要的不是一份名单，
 * 是先回最早那几封（`my_site_enquiries` 自己按时间排）。
 */
const ENQUIRY_CAP = 5;

/** 他有几个班就送几个 —— 一间补习中心开二三十班，而那是他真的要点名的东西。
 *  三十行短的字比一次开错班便宜。 */
const CLASS_CAP = 30;

/** 她有几个师傅就送几个。一间沙龙四到八个，一间大一点的十几个 ——
 *  这个数字不是省 token，是**她不可能有四十个发型师**。 */
const CREW_CAP = 40;

export type BusinessFacts = {
  /** Malaysia's date, not the server's. Every figure below is bounded by a
   *  month, and the server runs on UTC -- see nowInMalaysia. */
  asOf: string;
  figures: { label: string; value: string; previous?: string }[];
  /**
   * The few records behind the figures.
   *
   * A total he cannot open is a total he has to take on trust, and this is
   * the half of vanna's answer worth taking: it returns the number AND the
   * table under it. 「这个月收了 RM 4,321」 is an assertion; 「三笔：陈先生
   * 3,000 · 李太太 1,000 · 王老板 321」 is something he can check against
   * his own memory in two seconds.
   */
  rows: { doc: string; party: string; amount: string; on: string; stage?: string }[];
  trend: { label: string; value: number }[];
  /**
   * 谁欠他钱。
   *
   * 🔴 **三种，不是两种**（见 `lib/portal/debts.ts` 的档头）：
   *   null   没有问 / 读失败  -> 一个字都不要讲，而且 gaps 会多一行
   *   []     问了，没有人欠   -> 可以讲「都收齐了」
   *   [...]  这几个人欠
   *
   * 混掉第一跟第二种，就是对一个师傅讲「没有人欠你钱」，
   * 而他老板的帐上挂着三万。
   */
  owing: OwingRead;
  /**
   * 🔴 系统自己看出来、而他还没处理的那几件。
   *
   * ── 为什么这一栏 2026-09-09 才出现 ────────────────────────────────────
   *
   * 那十二种信号（报价快到期 · 收款过期 · 低过补货线 · 预约没人接 ·
   * 套票剩最后一次 · 客人很久没来 · 合约到期 · 借出去没还回来 · 缺勤两次 ·
   * 签了没付 · 介绍费欠着 · 要货单开着）**2026-09-06 就算得出来了**，
   * 而「今天要跟的」那一页在读它们 —— 这个档案里**一个字都没提过它们**。
   * 所以助手答不出「今天有什么要跟」，而画面上就写着。
   * 第十七次「能力有、线没接」。
   *
   * 外面那几家把这一件当成留客的主力（2026-09-09 读的，[任务 316]）：
   * QuickBooks 的付款代理**先开口** —— 预测哪一张会迟付、自己起草催款。
   * 量出来的：状况变差之后**十四天内**主动联络的，留客明显好过三十天后。
   *
   * ⚠️ **角色不在这里判**。`nudges_due` 自己问 `works_here` 跟 `sees_money`，
   * 而钱那几种信号在那一支里面就滤掉了 —— 一个师傅拿回的本来就少几种。
   * 在这里再判一次，就是同一条规矩两个地方，而这个仓库栽在那上面八次。
   *
   * ⚠️ **空阵列跟读不到不分开**，跟 `owing` 不一样，而这是有理由的：
   * `owing` 分不开会变成对着一个师傅讲「没有人欠你钱」；这里最坏的情况是
   * 少讲一件他本来就在画面上看得到的事（那一页天天开着）。
   */
  nudges: { kind: string; line: string }[];
  /**
   * 🔴 他自己打过的价钱 —— 而这一栏存在的理由是[重点 29](../../docs/founder-points.md)。
   *
   * 「最好的输入是不存在的输入」，而它排第二的那一种是**从他自己以前的
   * 东西挑**。一间五金店的老板每开一张单都要重打一次「水泥 50kg · 包 ·
   * 18.50」—— 而那三个字**本来就在他自己的货架上**（`catalog_items`
   * 从 20260901070000 起就有 `price_cents`）。那不是一个输入，那是一次抄写。
   *
   * ⚠️ **这不是猜。** 他自己在货品页上打的那个数字，原样端出来，而助手
   * 要讲它用了哪一件（`explanation` 那一句）。[任务 89] 那条界线挡的是
   * 「靠猜省他的字」—— 拿他自己写下来的东西不在那条线里面。
   *
   * ⚠️ 超过 `PRICE_CAP` 就截，**而且 gaps 会多一行讲这件事**。
   */
  prices: { line: string }[];
  /** 价目被截掉了没有 —— 决定 `pricesCut` 那一行出不出现。 */
  pricesCut: boolean;
  /**
   * 🔴 他讲过、而且要它**记到下一次开机**的那几句。
   *
   * ── 为什么这一栏 2026-09-09 才出现 ────────────────────────────────────
   *
   * 助手手上一直有「刚才这段对话里发生过的事」——**而那三轮活在一个分页里**。
   * 他纠正它一次（「Madam Chong 是名字，不要翻」）、讲一次他的规矩
   * （「合发那家都是三十天付款」），关掉分页两句都不在了，他明天要再讲一次。
   *
   * 一个每天忘记你纠正过什么的助手，是 [重点 9c](../../docs/founder-points.md)
   * 那张表里最浅的一层：功能好、好用、稳 —— **换一家一样好用的就没了**。
   * 记性不一样：他教了半年的那一个，换一家要从头教起。
   *
   * ⚠️ **没有检索**（读了 mem0 之后决定的，见 20260909300000）：
   * 一间店的记忆是几十条，而几十条**全部送进去**比一套向量检索又便宜又准。
   * 这里拿到什么就全部注进去。
   */
  memory: { line: string }[];
  /**
   * 🔴 陌生人在他官网上问的那几句，而他还没处理。
   *
   * ── 为什么这一栏 2026-09-09 才出现 ────────────────────
   *
   * 量出来的：`site_enquiries` **只进不出** —— 一个陌生人在他官网上
   * 问了一句，而他在这套系统里**回不了**：那一页唯一的动作是
   * 「变成一张报价单」。而[重点 9c] 那张表里最深的两层，
   * 就是「钱跟客人从那里进来」。
   *
   * 外面 2026 那一整类助手的标准形状是：读进来 · 照他自己的资料起草 ·
   * **停在那里等人看过才送**。这一栏是那个形状的第一半。
   *
   * ⚠️ **角色不在这里判**：`my_site_enquiries` 自己问的是
   * `p.account_id = auth.uid()` —— 也就是**只给老板**，师傅拿到的是空的。
   */
  enquiries: { id: string; line: string }[];
  /**
   * 🔴 他的班 —— 而这一栏是为了一句话存在的：
   * **「帮我开这个月全班的学费」**。
   *
   * ── 为什么它今天才有 ──────────────────────────────────────────────
   *
   * `bill_class`（20260909270000 那一批）**已经在跑，尺子也绿** ——
   * 一按开全班的学费单、认得每个学生自己的价钱、认得这个月开过没有。
   * 而助手**一个都不会用**，因为它看不到他有哪几个班：班在 `classes`
   * 那一页上，而那是工具页，助手不在那里。
   * [重点 23] 讲的就是这件事：**能力有、线没接**。
   *
   * ⚠️ 走**同一支** `class_groups_of` —— 班级那一页读的也是它。
   * 另写一句查询就是第二份会漂的定义。
   */
  classes: { id: string; line: string }[];
  /**
   * 🔴 她的师傅 —— 而这一栏不是方便，是**排得对不对**。
   *
   * `appointments_no_double_booking` 排他的键是 `coalesce(staff_id, project_id)`
   * （20260902030000）—— 也就是说**没有指师傅的时候，整间店同一个时段
   * 只排得下一笔**。一间四个发型师的沙龙，第二个三点的客人会被挡掉，
   * 而她读到的是「那个时间已经有人了」。
   *
   * ⚠️ 2026-09-10 量到：**人按的那张表单也没有设过 `staff_id`**
   * （`new-record-form.tsx` 把师傅名字当自由文字写进 `extra`）——
   * 所以今天不管走哪一条路都是这样。那一半登记在[任务 339]，不是我改的。
   */
  crew: { id: string; line: string }[];
  /**
   * 🔴 她要客人签的那几份表单 —— `consent_forms_of` 同一支，
   * `/portal/consent` 那一页读的也是它。另写一句查询就是第二份会漂的定义。
   *
   * ⚠️ 内容我们一个字都不印（`consent-desk.tsx` 的档头写着为什么：
   * 一份同意书上写的是医疗宣称，我们不是诊所）——只印**名字跟编号**，
   * 够模型挑对那一份就好。
   */
  consentForms: { id: string; line: string }[];
  lang: "zh" | "en";
  /** True when the read itself failed, as opposed to succeeding and finding
   *  nothing. The prompt must say different things about those two, because
   *  「你还没有记录」 is a fact and 「我读不到」 is an outage. */
  unread: boolean;
};

/**
 * Read this business's figures, through the CALLER'S OWN SESSION.
 *
 * ⚠️ The client passed in must be the session client, never the service role.
 * This route holds both, and the difference is not stylistic: a 师傅 added
 * under 员工帐号 cannot see 收款, and the ONLY thing enforcing that is
 * row-level security on his own connection. Hand this the service role and
 * the assistant becomes the one door in the product where a staff account can
 * read the money -- with no error, in a friendly sentence.
 *
 * Returns null when there is nothing to say. The caller then sends no figures
 * at all, which is what makes the assistant answer 「我读不到」 rather than
 * a confident RM 0.
 */
export async function fetchBusinessFacts(
  supabase: SupabaseClient,
  projectId: string,
  modules: string[],
  nouns: { customer: string; pipeline: string },
  pipelineModule: string | null,
  workflow: string[],
  /**
   * 谁在问。
   *
   * ⚠️ **必填，而且没有预设**。写成「预设 owner」在测试里会全绿，
   * 而在一个师傅面前会把他老板的欠款清单念出来；写成「零行就是没有人欠」
   * 会在同一个人面前说谎。两个都是这一行避掉的。
   */
  role: WorkspaceRole,
  lang: "zh" | "en" = "en",
  at: Date = new Date(),
): Promise<BusinessFacts | null> {
  const stats = await fetchLiveStats(
    supabase,
    projectId,
    modules,
    nouns,
    pipelineModule,
    workflow,
    lang,
    at,
  );

  /* Three outcomes, and they are not the same thing:
       undefined  the read threw            -> say we could not read
       null       nothing worth showing     -> say he has no records yet
       LiveStats  figures                   -> hand them over
     Collapsing the first two is how a product ends up telling an owner his
     month is empty because a query timed out. */
  if (stats === undefined) {
    return {
      asOf: malaysianDate(at),
      figures: [],
      rows: [],
      trend: [],
      owing: null,
      nudges: [],
      prices: [],
      pricesCut: false,
      /* 🔴 数字读不到，**不代表他讲过的话读不到** —— 那是另一张表。
         这一轮答不了他的数字，而他的规矩照旧要守。 */
      memory: await fetchMemory(supabase, projectId),
      enquiries: [],
      classes: [],
      crew: [],
      consentForms: [],
      lang,
      unread: true,
    };
  }
  /* ⚠️ NOT null. A read that succeeded and found nothing is a FACT about
     his month -- 「你还没有任何记录」 -- and it has to reach the model, because
     the alternative is an empty prompt block and a model with no instruction
     not to invent. Reserve null for 「there is no business context at all」,
     which the caller already guards.

     This was a real bug in the first version of this file: returning null here
     meant the 「还没有记录」 sentence below could never be rendered. */
  if (!stats || !stats.tiles.length) {
    return {
      asOf: malaysianDate(at),
      figures: [],
      rows: [],
      trend: [],
      owing: null,
      /* 🔴 一个数字都数不出来，**不代表没有要跟的事**：一张快到期的报价单
         在他一条记录都还没被这几格数到的时候就已经在那里了。所以这一支
         照读。 */
      nudges: await fetchNudges(supabase, projectId, lang),
      /* 🔴 一个数字都数不出来的时候**价目照读** —— 他可能昨天才把货品
         打进去、今天要开第一张单，而那一刻这几格全部是零。 */
      ...(await fetchPrices(supabase, projectId)),
      /* 🔴 一条记录都还没有的时候**最要记得** —— 第一天他讲的那几句规矩，
         正是他还没有任何数字的那一天讲的。 */
      memory: await fetchMemory(supabase, projectId),
      enquiries: await fetchEnquiries(supabase),
      classes: await fetchClasses(supabase, projectId),
      crew: await fetchCrew(supabase, projectId),
      consentForms: await fetchConsentForms(supabase, projectId),
      lang,
      unread: false,
    };
  }

  return {
    asOf: malaysianDate(at),
    figures: [
      ...stats.tiles.map((t) => ({
        label: t.label,
        value: t.value,
        previous: t.previous,
      })),
      ...(await fetchProfit(supabase, projectId, lang, at)),
    ],
    rows: await fetchRecentRows(supabase, projectId),
    trend: stats.trend.slice(-TREND_CAP),
    owing: await fetchPartyOwing(supabase, projectId, role, lang),
    nudges: await fetchNudges(supabase, projectId, lang),
    ...(await fetchPrices(supabase, projectId)),
    memory: await fetchMemory(supabase, projectId),
    enquiries: await fetchEnquiries(supabase),
    classes: await fetchClasses(supabase, projectId),
    crew: await fetchCrew(supabase, projectId),
    consentForms: await fetchConsentForms(supabase, projectId),
    lang,
    unread: false,
  };
}

/**
 * 🔴 她有哪几个师傅 —— 而这一支存在的理由是排他约束，不是方便。
 *
 * 见 `BusinessFacts.crew` 的注解：没有 `staff_id`，整间店同一时段只排得下一笔。
 *
 * ⚠️ 师傅住在**名册那一页**（`directory_entries`，`module_key = 'staff'`）——
 * 跟客户同一张表、同一套权限。这里不另外判角色：RLS 已经判过了。
 */
/**
 * 🔴 她要客人签的那几份表单 —— 而这一支不是方便，是[任务 89]那条界线
 * 在同意书这一格的样子：`request_consent` 要一个 `form_id`，
 * 模型只能从这份清单里抄一个，不能凭「肉毒同意书」这几个字自己拼一个。
 */
async function fetchConsentForms(
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ id: string; line: string }[]> {
  const { data, error } = await supabase.rpc("consent_forms_of", {
    in_project_id: projectId,
  });
  if (error) return [];
  const rows = (data ?? []) as {
    id?: string | null;
    name?: string | null;
    archived?: boolean | null;
  }[];
  return rows
    .filter((r) => !r.archived)
    .slice(0, CLASS_CAP)
    .map((r) => ({
      id: String(r.id ?? ""),
      line: [`form=${String(r.id ?? "")}`, String(r.name ?? "").trim()]
        .filter(Boolean)
        .join(" · "),
    }));
}

async function fetchCrew(
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ id: string; line: string }[]> {
  const { data, error } = await supabase
    .from("directory_entries")
    .select("id, name, status")
    .eq("project_id", projectId)
    .eq("module_key", "staff")
    .is("archived_at", null)
    .order("name")
    .limit(CREW_CAP);
  if (error) return [];
  return ((data ?? []) as { id?: string; name?: string; status?: string }[]).map(
    (r) => ({
      id: String(r.id ?? ""),
      line: [`staff=${String(r.id ?? "")}`, String(r.name ?? "").trim()]
        .filter(Boolean)
        .join(" \u00b7 "),
    }),
  );
}

/**
 * 🔴 他有哪几个班 —— 而这一支是为了一句话存在的：
 * **「帮我开这个月全班的学费」**。
 *
 * 呼叫的是 `class_groups_of` —— **班级那一页读的同一支**。
 * 另写一句 `from("class_groups")` 就是第二份会漂的定义，而漂的那一天
 * 助手念的班跟他打开那一页看到的不一样。
 *
 * ⚠️ 收起来的班不送（`archived_at`）—— 一个已经收掉的班出现在清单上，
 * 而 `bill_class` 自己会拒绝它，那就是给他一个必定失败的选项。
 */
async function fetchClasses(
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ id: string; line: string }[]> {
  const { data, error } = await supabase.rpc("class_groups_of", {
    in_project_id: projectId,
  });
  if (error) return [];
  const rows = (data ?? []) as {
    id?: string | null;
    name?: string | null;
    staff_name?: string | null;
    capacity?: number | null;
    seats_taken?: number | null;
    archived_at?: string | null;
  }[];
  return rows
    .filter((r) => !r.archived_at)
    .slice(0, CLASS_CAP)
    .map((r) => ({
      id: String(r.id ?? ""),
      line: [
        `class=${String(r.id ?? "")}`,
        String(r.name ?? "").trim(),
        String(r.staff_name ?? "").trim(),
        /* 几个学生在班上 —— 他讲「全班」指的就是这个数字。 */
        r.seats_taken == null ? "" : `${r.seats_taken}人`,
      ]
        .filter(Boolean)
        .join(" \u00b7 "),
    }));
}

/**
 * 🔴 陌生人在他官网上问的那几句，而他还没处理。
 *
 * 呼叫的是 `my_site_enquiries` —— **询价那一页读的同一支**。
 * 另写一句 `from("site_enquiries")` 就是第二份会漂的定义，
 * 而漂的那一天助手讲的跟他打开那一页看到的不一样。
 *
 * ⚠️ 只送 `done` 以外的—— 已经处理完的送上去，是在叫他再回一次。
 *
 * ⚠️ **号码不印完整**：模型不需要它（那条连结是我们建的），
 * 而一个印在提示里的号码只会多一个它可以念错的东西。
 */
async function fetchEnquiries(
  supabase: SupabaseClient,
): Promise<{ id: string; line: string }[]> {
  const { data, error } = await supabase.rpc("my_site_enquiries");
  if (error) return [];
  const rows = (data ?? []) as {
    id?: string | null;
    name?: string | null;
    contact?: string | null;
    answers?: Record<string, unknown> | null;
    status?: string | null;
    created_at?: string | null;
  }[];
  return rows
    .filter((r) => (r.status ?? "new") !== "done")
    .slice(0, ENQUIRY_CAP)
    .map((r) => {
      /* 他们在表单上填的那几句，原样。一封询价的内容就是这一堆字，
         而起草一封回覆靠的就是它。 */
      const said = Object.entries(r.answers ?? {})
        .map(([k, v]) => `${k}: ${String(v ?? "").trim()}`)
        .filter((x) => !x.endsWith(": "))
        .join(" · ")
        .slice(0, 300);
      return {
        id: String(r.id ?? ""),
        line: [
          `enquiry=${String(r.id ?? "")}`,
          String(r.name ?? "").trim(),
          said,
          String(r.created_at ?? "").slice(0, 10),
        ]
          .filter(Boolean)
          .join(" · "),
      };
    });
}

/**
 * 他自己打过的价钱 —— 从他的货品页读回来。
 *
 * ── 为什么这一支 2026-09-09 才出现 ──────────────────────────────────────
 *
 * `catalog_items.price_cents` 从 20260901070000 建表那天就在，货品那一页
 * 一直在画它，而**助手看不到它** —— `describeLayout` 只印他现在开着的那一页，
 * 而他开报价单那一页的时候，货品在另一页。所以他讲「给合发开一张换灯的」，
 * 模型手上**一个价钱都没有**，只能问他、或者估一个。
 *
 * [重点 29](../../docs/founder-points.md) 那张表：
 * ① 算出来 ② **从他自己以前的东西挑** ③ 从别的地方搬 ④ 才轮到他打字。
 * 这一支把「打字」搬到第二格。
 *
 * ── 🔴 只送有价钱的那几件 ────────────────────────────────────────────────
 *
 * 一件没有价钱的货品（他只拿它数库存）送上去，是在教模型
 * 「这一件我看到了，而它没有价」—— 而它下一步就会替它想一个。
 * 送出去的每一行都带着一个真的数字，或者根本不出现。
 *
 * ⚠️ **不判角色。** `catalog_items` 的政策是 `works_here`，一个师傅本来
 * 就看得到货架那一页。在这里再判一次就是同一条规矩两个地方。
 */
/**
 * 🔴 他讲过要它记住的那几句 —— **一次读完，不搜**。
 *
 * 呼叫 `assistant_memory`（20260909300000），而那一支自己做两件事：
 * 做成过的排前面、`works_here` 挡门。两件都不在这里再做一次 ——
 * 同一条规矩两个地方，是这个仓库栽过八次的形状。
 *
 * ⚠️ 读失败回空阵列，**不回 null**：跟 `owing` 不一样。那一边分不开会
 * 变成对着一个师傅讲「没有人欠你钱」；这一边最坏是这一轮少记得几句话，
 * 而他会当场再讲一次。
 */
async function fetchMemory(
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ line: string }[]> {
  const { data, error } = await supabase.rpc("assistant_memory", {
    in_project_id: projectId,
  });
  if (error) return [];
  return ((data ?? []) as { body?: string | null }[])
    .map((r) => String(r.body ?? "").trim())
    .filter(Boolean)
    .map((line) => ({ line }));
}

async function fetchPrices(
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ prices: { line: string }[]; pricesCut: boolean }> {
  const { data, error } = await supabase
    .from("catalog_items")
    .select("name, unit, price_cents, sku")
    .eq("project_id", projectId)
    .not("price_cents", "is", null)
    .gt("price_cents", 0)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(PRICE_CAP + 1);
  if (error) return { prices: [], pricesCut: false };

  const rows = (data ?? []) as {
    name?: string | null;
    unit?: string | null;
    price_cents?: number | null;
    sku?: string | null;
  }[];
  const cut = rows.length > PRICE_CAP;
  return {
    prices: rows.slice(0, PRICE_CAP).map((r) => ({
      line: [
        String(r.name ?? "").trim(),
        String(r.unit ?? "").trim(),
        /* 一份，不是两份 —— `ringgit` 是货品那一页画那个数字用的同一支。 */
        ringgit(Number(r.price_cents ?? 0)),
        String(r.sku ?? "").trim(),
      ]
        .filter(Boolean)
        .join(" · "),
    })),
    pricesCut: cut,
  };
}

/**
 * 系统自己看出来、而他还没处理的那几件。
 *
 * ── 一份定义，不是两份 ────────────────────────────────────────────────────
 *
 * 呼叫的是 `nudges_due` —— **「今天要跟的」那一页读的同一支**。所以助手讲的
 * 跟他打开那一页看到的是同一批东西，不会各说各话（`fetchProfit` 呼叫
 * `buildProfit` 是同一个做法，同一个理由）。
 *
 * ── 🔴 那一句话是资料库写的，不是这里拼的 ────────────────────────────────
 *
 * `nudges_due.body` 是一句写好的、跟着系统语言走的话（那一栏 not null）。
 * 在这里照他的语言重拼一次，就是第二份会漂的字 —— 而画面那一页印的是
 * 资料库那一句。两边不一样，他会以为助手在讲另一件事。
 *
 * ⚠️ **角色不在这里判。** `nudges_due` 自己 `works_here` ＋ `sees_money`，
 * 钱那几种信号在那一支里面就滤掉了。
 *
 * ⚠️ **读失败就当没有。** 跟 `owing` 不一样，那一边分不开会变成对着一个
 * 师傅讲「没有人欠你钱」；这里最坏是少讲一件他在那一页上本来就看得到的事。
 */
export async function fetchNudges(
  supabase: SupabaseClient,
  projectId: string,
  lang: "zh" | "en",
): Promise<{ kind: string; line: string }[]> {
  const { data, error } = await supabase.rpc("nudges_due", {
    in_project_id: projectId,
    /* 不给日子 = 今天加三天，跟那一页预设的那一档一样。「快到期」本来
       就要提前讲，而提前几天是资料库定的，不是这里定的。 */
    in_until: null,
  });
  if (error) return [];
  const rows = (data ?? []) as {
    kind?: string | null;
    body?: string | null;
    party?: string | null;
    title?: string | null;
    days_late?: number | null;
    last_told_on?: string | null;
  }[];
  return rows.slice(0, NUDGE_CAP).map((r) => {
    const late = Number(r.days_late ?? 0);
    const bits = [
      String(r.body ?? "").trim(),
      /* 🔴 迟了几天要讲出来 —— 「过期了」跟「过期二十天了」是两件事，
         而他下一步做什么完全看这个数字。 */
      late > 0 ? (lang === "zh" ? `迟了 ${late} 天` : `${late} days late`) : "",
      /* 🔴 上一次讲过是几时，也要讲 —— 不然助手会叫他再催一次他
         今天早上刚催过的那一个人。资料库明写这是一个日子，不是一条
         把讯号压下去的规矩。 */
      r.last_told_on
        ? lang === "zh"
          ? `${r.last_told_on} 跟过了`
          : `last chased ${r.last_told_on}`
        : "",
    ].filter(Boolean);
    return { kind: String(r.kind ?? ""), line: bits.join(" · ") };
  });
}

/**
 * 花掉多少、赚多少 -- 这个月。
 *
 * 🔴 这两个数字是 `live-answers` 存在过的最长的一条缝：GAPS 的第一行从
 * 这个档案写出来那天就是「赚多少 -- 算不出来」，而 20260904200000 之后
 * 它算得出来了。这一支就是让那一行退休的东西。
 *
 * ⚠️ 一份定义，不是两份。它呼叫 `buildProfit`，跟 `报表` 那一页画那两格
 * 用的是同一支 -- 不然助手讲的数字跟他画面上那一格会不一样，
 * 而那是这个仓库最贵的一种错。
 *
 * ⚠️ 走**呼叫者自己的连线**（跟这个档案其余每一个读一样）：
 * `ledger_entries` 是 sees_money，所以一个师傅拿回来的是空的 --
 * 而空的会算成「这个月赚了全额」。所以读不到就一格都不给，不是给 0。
 *
 * ⚠️ 他从来没记过开销的时候**不给「赚」那一格**，跟 `报表` 同一条：
 * 那时候「赚」等於「收到」，而那是宣称一件我们不知道的事。
 */
async function fetchProfit(
  supabase: SupabaseClient,
  projectId: string,
  lang: "zh" | "en",
  at: Date,
): Promise<BusinessFacts["figures"]> {
  try {
    const { data, error } = await supabase
      .from("ledger_entries")
      .select("id, direction, amount_cents, entry_on, category, adjusts_id")
      .eq("project_id", projectId);
    if (error || !data?.length) return [];

    const now = nowInMalaysia(at);
    const slice = buildProfit(data as unknown as ProfitFact[], now);
    const everSpent = (data as { direction?: string | null }[]).some(
      (e) => (e.direction ?? "in") === "out",
    );
    if (!everSpent) return [];

    const w =
      lang === "en"
        ? { spent: "Spent this month", earned: "Kept this month", on: "Biggest" }
        : { spent: "本月花掉", earned: "本月赚", on: "最大一笔" };
    const top = slice.byCategory[0];
    return [
      {
        label: w.spent,
        value: ringgit(slice.outCents) ?? "RM 0",
        previous: top
          ? `${w.on}: ${top.name ?? (lang === "en" ? "not categorised" : "没写类别")} ${ringgit(top.cents) ?? ""}`
          : undefined,
      },
      { label: w.earned, value: signedRinggit(slice.profitCents) ?? "RM 0" },
    ];
  } catch {
    /* 读不到就一格都不给。给一个 0 出去，助手会照着讲。 */
    return [];
  }
}

/**
 * The last few records, so a total can be opened rather than believed.
 *
 * ⚠️ Its own query rather than a second return value out of fetchLiveStats:
 * that function's job is the four tiles and it is read by the page every
 * time anybody opens the dashboard. Widening it to carry rows it does not
 * draw would make every page load pay for a panel nobody has opened.
 *
 * ⚠️ Failure is silent and returns nothing. The figures are the answer; the
 * rows are the receipt. A missing receipt must not cost him the answer.
 */
async function fetchRecentRows(
  supabase: SupabaseClient,
  projectId: string,
): Promise<BusinessFacts["rows"]> {
  try {
    const [ledger, pipeline] = await Promise.all([
      supabase
        .from("ledger_entries")
        .select("doc_no, party, amount_cents, entry_on, direction")
        .eq("project_id", projectId)
        .order("entry_on", { ascending: false })
        .limit(ROW_CAP),
      supabase
        .from("pipeline_records")
        .select("doc_no, party, amount_cents, issued_on, stage")
        .eq("project_id", projectId)
        .is("archived_at", null)
        .order("issued_on", { ascending: false })
        .limit(ROW_CAP),
    ]);

    const money = (c: number | null) =>
      typeof c === "number" ? `RM ${(c / 100).toLocaleString("en-MY")}` : "";

    return [
      ...((ledger.data ?? []) as Record<string, unknown>[]).map((r) => ({
        doc: String(r.doc_no ?? ""),
        party: String(r.party ?? ""),
        /* Direction rather than a sign: 「out」 on a receipt line is a refund,
           and printing it as a negative is how a reader mistakes it for a
           mistyped amount. The ledger itself made this choice first. */
        amount: `${money(r.amount_cents as number)}${r.direction === "out" ? " (out)" : ""}`,
        on: String(r.entry_on ?? ""),
      })),
      ...((pipeline.data ?? []) as Record<string, unknown>[]).map((r) => ({
        doc: String(r.doc_no ?? ""),
        party: String(r.party ?? ""),
        amount: money(r.amount_cents as number),
        on: String(r.issued_on ?? ""),
        stage: String(r.stage ?? "") || undefined,
      })),
    ];
  } catch {
    return [];
  }
}

/** Malaysia's calendar date. Not toISOString(): at 8am in Kuala Lumpur the
 *  server's UTC clock still reads yesterday, and this string is what the
 *  assistant will quote as 「截至今天」. */
function malaysianDate(at: Date): string {
  const shifted = new Date(at.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * The block that goes into the prompt.
 *
 * ⚠️ Goes with the VOLATILE half of the message, beside the page listing --
 * never above the catalogue. These numbers change the moment he records a
 * payment, and a provider cache is a prefix match: putting them high strands
 * every fixed token behind them, which is the 75% -> 97% lesson already paid
 * for once in this route.
 */
export function renderBusinessFacts(facts: BusinessFacts | null): string {
  const w = WORDS[facts?.lang ?? "en"];
  const g = GAPS[facts?.lang ?? "en"];

  if (!facts) return "";

  /*
    🔴 他讲过要它记住的那几句 —— **一段带标题的话，而且三条路都要带上它**。

    「注入成一段带标题的话」是读 mem0 拿到的第三条（20260909300000）：
    几十句散在提示里，模型分不出哪一句是他的规矩、哪一句是我的指示。
    一个标题就把它们变成一组「他讲过的」。

    ⚠️ 而它要放在**读不到数字**跟**一条记录都没有**那两条路上，
    不是只放在正常那一条：他第一天什么都还没有的时候讲的那几句规矩，
    正是最该记得的。少了这两行，一间新店的助手每一次都忘。
  */
  const memory = facts.memory.length
    ? ["", `${w.memory}:`, ...facts.memory.map((r) => `- ${r.line}`)]
    : [];
  const withMemory = (head: string) =>
    memory.length ? [head, ...memory].join("\n") : head;

  if (facts.unread) return withMemory(w.unread);

  if (!facts.figures.length) return withMemory(w.none);

  const lines = facts.figures.map((f) => {
    const was = f.previous ? ` (${w.vsLast} ${f.previous})` : "";
    return `- ${f.label}: ${f.value}${was}`;
  });

  if (facts.trend.length) {
    lines.push(`- ${w.trend}: ${facts.trend.map((p) => `${p.label} ${p.value}`).join(" · ")}`);
  }

  /* The receipt under the total. Capped upstream; capped again here so a
     future caller cannot widen it by accident. */
  const receipt = facts.rows.length
    ? [
        "",
        `${w.rows}:`,
        ...facts.rows
          .slice(0, ROW_CAP * 2)
          .map((r) =>
            `- ${[r.doc, r.party, r.amount, r.on, r.stage].filter(Boolean).join(" · ")}`,
          ),
      ]
    : [];

  /* 谁欠他钱。**空阵列跟 null 在这里就分开了** —— 见 `debts.ts` 的档头。 */
  const owing = describeOwing(facts.owing, facts.lang);

  /*
    🔴 系统自己看出来、他还没处理的那几件。

    这一段是 2026-09-09 补的第十七条「能力有、线没接」：十二种信号
    9-06 就算得出来，「今天要跟的」那一页在读它们，而助手一个都看不到 ——
    所以他问「今天有什么要跟」，得到的是一句「我看不到」，而画面上就写着。

    ⚠️ **一件都没有的时候也要讲一句**，不可以留白。留白的时候模型会拿
    上面那些数字去凑一个「你大概要跟这几个」出来 —— 而那正是这个档案
    档头那条规矩在挡的东西：没有讲出来的，模型会在空隙里发明。
  */
  const nudges = facts.nudges.length
    ? [`${w.nudges}:`, ...facts.nudges.map((n) => `- ${n.line}`)]
    : [w.nudgesNone];

  /*
    🔴 他自己打过的价钱。[重点 29](../../docs/founder-points.md) 第 2 种：
    从他自己以前的东西挑，而不是叫他再打一次。

    ⚠️ **一件都没有的时候不出这一段** —— 跟 `nudges` 那一段相反，
    而理由不一样：那一边留白模型会自己编一份「要跟的」出来；这一边
    「他还没打过任何价钱」是一件真的事，而下面 `nothingElse` 那一条
    已经在挡「不要自己凑一个数字出来」。多一句空标题只是噪音。
  */
  const prices = facts.prices.length
    ? ["", `${w.prices}:`, ...facts.prices.map((r) => `- ${r.line}`)]
    : [];

  /* 🔴 陌生人在他官网上问的那几句。一封都没有就不出这一段 ——
     跟价目同一个理由：一个空标题只是噪音。 */
  const enquiries = facts.enquiries.length
    ? ["", `${w.enquiries}:`, ...facts.enquiries.map((r) => `- ${r.line}`)]
    : [];

  /* 🔴 他的班。一个都没有就不出这一段 —— 大部分行业没有班。 */
  const classes = facts.classes.length
    ? ["", `${w.classes}:`, ...facts.classes.map((r) => `- ${r.line}`)]
    : [];

  /* 🔴 她的师傅。一个都没有就不出这一段。 */
  const crew = facts.crew.length
    ? ["", `${w.crew}:`, ...facts.crew.map((r) => `- ${r.line}`)]
    : [];

  /* 🔴 她要客人签的那几份表单。一份都没写过就不出这一段 ——
     大部分行业不需要同意书，一个空标题只是噪音。 */
  const consentForms = facts.consentForms.length
    ? ["", `${w.consentForms}:`, ...facts.consentForms.map((r) => `- ${r.line}`)]
    : [];

  /* 🔴 这一次答不了的，跟永远答不了的，放在同一段但来源不同。
     `owingUnread` 只在没有读到欠款的时候出现 —— 读到了还留着它，
     就是助手拒绝回答一件它手上已经有答案的事。 */
  const gaps = [
    ...ALWAYS_GAPS.map((k) => g[k]),
    ...(facts.owing == null ? [g.owingUnread] : []),
    /* 🔴 只在**真的截掉了**的时候。没截还留着它，就是助手说
       「我看不全你的价目」而它其实看得全 —— 一条过期的「答不了」，
       跟宣称做了却没做是同一个缺陷的另一张脸（[任务 110]）。 */
    ...(facts.pricesCut ? [g.pricesCut] : []),
  ];

  return [
    w.heading.replace("<at>", facts.asOf),
    ...lines,
    ...(owing.length ? ["", ...owing] : []),
    ...receipt,
    "",
    ...nudges,
    ...prices,
    ...enquiries,
    ...classes,
    ...crew,
    ...consentForms,
    ...memory,
    "",
    `${w.cannot}:`,
    ...gaps.map((line) => `- ${line}`),
  ].join("\n");
}

/** Exported for the guard: a gap line that names nothing is an apology, and
 *  an apology teaches the model to stop answering. */
export const BUSINESS_FACT_GAPS = GAPS;

/** Exported for the guard: which of them are always true, and which one only
 *  appears when this particular read came back empty-handed. */
export const BUSINESS_FACT_ALWAYS_GAPS = ALWAYS_GAPS;

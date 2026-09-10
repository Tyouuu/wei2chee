/**
 * 助手做不到某一件事的时候，讲给老板听的那一句。
 *
 * ── 🔴 为什么它是一个代号，不是一句话 ────────────────────────────────────
 *
 * 2026-09-07 逐句数出来：**四十九处写死的中文**（版面那一层 28 · 写入那一层 20 ·
 * 路由 1），而
 *
 *   - `projects.system_language` 预设是 **`en`**（20260822060000）
 *   - portal 的 locale 预设也是 **`en`**（任务 18）
 *
 * 也就是**多数情况下，他读到的是一句中文** —— 而 [重点 13](../../docs/founder-points.md)
 * 讲得很清楚：**Formae 的后台介面讲英文，不可以跨语言 fallback**。
 * 他为这件事纠正过一次（`不是這個英文 是我的平台裡面用英文`），
 * 而任务 18 花了一整轮把 386 条清成 0。
 *
 * ⚠️ **而 `check:en` 看不到它们** —— 那把尺走的是画面上的字，
 * 而这几句**只在一个动作失败之后才出现**，那要一次真的模型呼叫。
 * 所以它们躲过了那一轮。
 *
 * ── 为什么词不放在这里 ───────────────────────────────────────────────────
 *
 * 两条路都试着想过：
 *
 *   ① 字典摆在这个档案里，然后把语言一路传进 `applyLayoutOps` 跟写入那几支
 *      —— 要动 **79 个呼叫端**，而且一个忘了传的呼叫端会**静静**拿到预设的
 *      那一种语言，也就是今天这个 bug 的第二版
 *   ② **回一个代号，词住在 `messages/{en,zh}.json`** —— 跟其余每一个字一样的
 *      地方，呼叫端**一个都不用改**，而少一句话是查得出来的
 *
 * 走 ②。而它真正买到的东西是那把守卫：**每一个代号在两份语言档里都要有一句**，
 * 所以第五十句不会再是中文。
 *
 * ── 用法 ─────────────────────────────────────────────────────────────────
 *
 *     skipped.push({ op: op.op, reason: "notFound", vars: { id: String(op.target_id) } });
 *
 * 面板那一端用 `portal.editor.skipped.<代号>` 去取那一句，`vars` 是它的空格。
 * ⚠️ 代号打错是**编译错误** —— `SkipCode` 是一个封闭的联集。
 */
export type SkipCode =
  /* ── 版面那一层（layout-ops.ts）──────────────────────────── */
  /** 这个操作本身看不懂（模型给的形状不对）。`detail` 是那一句机器的话。 */
  | "badShape"
  /** 页面上没有这个编号的块。`id` */
  | "notFound"
  /** 没有这个组件。`name` */
  | "noSuchComponent"
  | "frameNoDelete"
  | "frameNoMove"
  | "moveBeforeSelf"
  /** `id` */
  | "notRecordTable"
  | "maxColumns"
  /** `key` */
  | "noSuchColumn"
  | "minOneColumn"
  /** `type` · `variant` */
  | "noSuchVariant"
  /** `type` */
  | "notSiteSection"
  | "noProse"
  /** `path` */
  | "noSuchPath"
  /** `id` */
  | "notWorkflow"
  | "cannotLogDay"
  | "rowsNotRecords"
  | "notWired"
  /** `type` · `field` —— 宣告过，而这一套版式不画它。 */
  | "fieldNotShown"
  /** `type` · `field` */
  | "noSuchField"

  /* ── 写入那一层（record-ops.ts）──────────────────────────── */
  | "writeCalendar"
  | "writeReconcile"
  | "writeAggregated"
  /** 官网 —— 加一行跟改状态共用这一句，因为它们讲的是同一件事。 */
  | "landingPage"
  /** `shape` —— `never` 那一支，到不了。 */
  | "writeUnknown"
  | "actLedger"
  | "actDirectory"
  | "actCatalog"
  | "actReconcile"
  | "actAggregated"
  /** `shape` —— 同上。 */
  | "actUnknown"
  | "noName"
  | "noSubject"
  | "dayNotStaffPage"
  | "noStaffSaid"
  | "dayKinds"
  | "noRecordSaid"
  | "noStatusSaid"
  /** `list` */
  | "apptStates"
  /** `list` */
  | "pageStates"
  | "noSuchRow"
  | "notPipeline"
  /** 目录认不得这一页。 */
  | "notARecordPage"
  /** 盘点只在货架那一页做得了。 */
  | "notShelfPage"
  /** 没讲数出来几个。 */
  | "noCountSaid"
  /** 数出来那个不是一个数字。`said` */
  | "countNotANumber"
  /** 收货只在进货单那一页做得了。 */
  | "notPurchasePage"
  /** 一条给客人的连结只开得了在单据上。 */
  | "notShareable"
  /** 这一单上没有写着下一步。 */
  | "noFollowUp"
  | "noStepSaid"
  /** 一行明细没有写它是什么。 */
  | "noLineSaid"
  /** 没有这一封询价（编号对不上，或者不是他家的）。 */
  | "noSuchEnquiry"
  /** 没有写要回什么。 */
  | "noMessageSaid"
  /**
   * 🔴 那一封询价上没有一支打得通的号码。
   *
   * `waNumber` 认不出来就回 null（它不猜）—— 而一颗按下去开一张
   * 错误页的按钮，跟一颗按不动的按钮是同一件事。
   * 客人留的可能是一个邮箱，那就讲出来。`contact`
   */
  | "noWayToReach"
  /** 没有讲是哪一个班。 */
  | "noClassSaid"
  /** 没有讲一个学生收多少。 */
  | "noFeeSaid"
  /** 没有讲收了多少钱。**不要拿那张单的总额当预设。** */
  | "noAmountSaid"
  /** 他这套系统里没有收款那一页 —— 钱没有地方落。 */
  | "noMoneyPage"
  /** 排预约只在预约那一页做得了。 */
  | "notBookingPage"
  /** 没有讲哪一天、几点。 */
  | "noWhenSaid"
  /**
   * 🔴 没有讲做到几点，而她以前也没有做过这一样 —— **问一句，不要编**。
   *
   * 一个编出来的长度会占掉别人的位子，或者整笔被那条排他约束挡掉
   * （20260902030000）。两种都是她要收拾的。
   */
  | "noEndSaid"
  /**
   * 🔴 那个时段撞到了，**而她没有讲是哪一位做**。
   *
   * 排他的键是 `coalesce(staff_id, project_id)` —— 不指人的时候整间店
   * 同一时段只排得下一笔。一句笼统的「有人了」会让一间四个发型师的沙龙
   * 以为自己排满了，而她只是没讲是谁做。
   */
  | "whoIsDoingIt"
  /** 冲正只在钱那几页做得了。 */
  | "notMoneyPage"
  /**
   * 🔴 资料库自己那一句，原样。`detail`
   *
   * 三处（两处 `error.message.slice(0, 80)` ＋ `friendly` 的后备）本来是**直接**
   * 把它送到他眼前的 —— 一句机器的话，而且它讲的是英文。包一层至少让他知道
   * 那不是我们在跟他讲话。
   */
  | "dbSaid"

  /* ── 路由 ───────────────────────────────────────────────── */
  | "layoutSaved"
  /**
   * 🔴 这一句要在**他的系统**那一页上讲：那里改不了样子。
   *
   * 2026-09-09 他问的：`這個ai 助手是我們產品的還是平台的 如果是產品為什麼
   * 不是接在產品裡面呢`。接进去之后，同一块面板在两个地方 ——
   * 而那一页没有编辑器，所以一个改版面的操作在那里做不到。
   *
   * ⚠️ 做不到而不讲，就是「说了没做」。这一句是那件事的替代品，
   * 而且它要讲得出**该去哪里做**（改设计那一颗按钮），
   * 不是一句只会说不行的死路（见 `refuseToAct` 的档头）。
   */
  | "designSurfaceOnly"

  /* ── 做成了，而顺手还发生了一件事（notes，接在助手那一句后面）── */
  /**
   * 一天工记在哪一天。`on`
   *
   * 🔴 那一天是**资料库**算的（today_myt()），不是模型推的 —— 半夜到早上
   * 八点两边差一天，而那正好是他补记昨天工的时段。所以它要念出来。
   */
  | "dayLogged"
  /**
   * 顺手扣了一次套票。`name` · `left`
   *
   * 🔴 任务 225 让「客人来了」同时扣一次 —— 助手按同一支而**不讲**，就是一次
   * 静静少掉的套票，而他要到客人下次来才发现。
   */
  | "packageUsed"
  /**
   * 盘完了，差几个。`before` · `counted` · `moved`
   *
   * 🔴 差几个是**资料库算的** —— 助手不讲出来，他就不知道刚才那一句
   * 让架上少了七包。而少掉的那七包，没有人用眼睛看得出来（任务 123）。
   */
  | "stockCounted"
  /** 数出来跟系统一样 —— 什么都没记，而那要讲出来。 */
  | "stockSame"
  /** 收货：几行进了货架。`moved` */
  | "goodsReceived"
  /** 收货：其中几件是新开的货品。`created` */
  | "goodsNew"
  /**
   * 收货：几行对不上。`short` · `over`
   *
   * 🔴 非讲不可 —— 「叫了一百到了九十」正是他要在罗厘还没走的时候知道的
   * 那一件（任务 149 · 151）。
   */
  | "goodsMismatch"
  /** 收货：这张单上没有可以进货架的行。 */
  | "goodsNothing"
  /**
   * 连结开好了。`link`
   *
   * 🔴 **那一条网址非讲不可** —— 助手开了而不给，他就没有东西可以贴进
   * WhatsApp，而那一条连结正是[重点 9c] 换掉这套系统的代价里第二深的一层。
   */
  | "shareOpened"
  /** 收回了。 */
  | "shareClosed"
  /** 那件事做完了。`what` */
  | "followUpDone"
  /** 不跟了。`what` */
  | "followUpDropped"
  | "followUpSet"
  /**
   * 开了一张相反的。`amount`
   *
   * 🔴 钱不改也不删（任务 77）—— 开一张冲正，两张都留着。所以要讲的是
   * 「多开了一张」，不是「改掉了」。
   */
  /**
   * 🔴 写好了一封回覆，**而且没有送出去**。`name` · `link`
   *
   * 这一句是 2026 外面那一整类助手的标准形状（读进来 · 起草 ·
   * **停在那里等人看过才送**），而它同时绕开了[重点 32] 里
   * 老板自己怕的那件事：**机器人对他的客人讲话**。
   *
   * ⚠️ 那一句非讲不可，而且要讲清楚**还没送** —— 一句听起来像
   * 已经送了的话，会让他以为客人收到了。
   */
  /**
   * 🔴 全班的学费单开好了。`made` · `again` · `free` · `total` · `period`
   *
   * 四个数字非讲不可：一间十个学生的补习中心开出八张单，
   * 第九第十去了哪里要讲得出来 —— **不讲就是静静少了两笔钱**。
   */
  /**
   * 🔴 收了一笔，挂在那一张单上。`amount` · `left`
   *
   * **还欠多少非讲不可** —— 他收完订金的下一个念头就是这个数字，
   * 而它是资料库算的，不是我们减的。
   */
  /**
   * 🔴 排好了。`who` · `when` · `how`
   *
   * `how` 是那个长度**从哪里来的** —— 她讲的，还是照她上次那一笔抄的。
   * 抄来的长度不讲出来，就是一个她看不见的假设。
   */
  /**
   * 🔴 这一单要先收多少订金。`amount`
   *
   * ⚠️ 这一句讲的是「**要收**」，不是「**收到了**」—— 两件事分开是故意的。
   * 一句听起来像已经收到的话，会让她以为钱进来了。
   */
  /**
   * 🔴 那张单上放了几行。`count`
   *
   * 一张从纸上抄下来的单，他能拿去跟手上那张纸对一次的东西，只有这一句。
   */
  /**
   * 🔴 这一件不是一张纸讲得出来的，所以「核对」那一趟没有带上它。
   *
   * 今天挡不到任何东西（route 只送纸上那三件进去）—— 它在，是因为
   * 以后一定会多一个动词，而那一天它会静静从那一趟里掉出去。
   */
  | "notFromPaper"
  /**
   * 🔴 撤销了：那一张单／那一个人／那一件货**收起来了，没有删掉**。`what`
   *
   * 一张丢掉的单是明年「上次我们报多少」的答案，而删掉一个号码
   * 会让整串单号看起来是坏的（20260831040000 已经学过一次）。
   */
  | "undoneKept"
  /**
   * 🔴 撤销了一笔钱：**开了一笔相反的，两笔都留着**。`what`
   *
   * ⚠️ 这一句不可以写成「删掉了」—— 一个改过而看不出改过的数字，
   * 跟一句谎话分不出来。他月底对帐看得到的是两笔，不是零笔。
   */
  | "undoneMoney"
  /** 那一次没有留下任何写进去的东西，所以没有东西可以撤销。 */
  | "nothingToUndo"
  | "linesFromPaper"
  /**
   * 🔴 那几行没有留下来 —— 这一页一行就是一行，没有明细。
   *
   * ⚠️ 静静掉几行金额，比一句失败更贵：帐上那个总额会看起来像他自己填的。
   */
  | "linesNotKept"
  /**
   * 🔴 官网上订进来的那一笔，认成客人了。`who`
   *
   * 她本来只是一串字在那笔预约上，现在是名册上一个真的人 ——
   * 下一次讲「陈太太来了」，那笔预约才对得起来是同一个人。
   */
  | "bookingClaimed"
  | "depositAsked"
  /** 这一单不用订金了。 */
  | "depositDropped"
  | "appointmentBooked"
  | "paymentTaken"
  | "classBilled"
  | "replyDrafted"
  | "entryReversed"
  /**
   * 🔴 记住了他讲的那一句，**而且是关掉分页也还在的那一种**。`what`
   *
   * 那一句要念回去给他听 —— 一个说「我记住了」而没有人看得到记了什么的
   * 助手，跟一个根本没记的助手，在画面上长得一模一样。
   */
  | "remembered"
  | "nothingToRemember"
  | "couldNotRemember";

/** 一件没做成的事，讲给老板听。`vars` 是那一句里的空格。 */
export type Skip = {
  op: string;
  reason: SkipCode;
  vars?: Record<string, string>;
};

/**
 * 每一个代号，摆着给守卫数。
 *
 * ⚠️ 手写的第二份清单是这个仓库栽过八次的东西 —— 所以这一份**不是**给
 * 程式用的，它只服务一件事：让那把守卫**逐个**去两份语言档里找那一句。
 * 少一个代号在这里，那把守卫就查不到它，所以加代号的时候两个地方一起加，
 * 而 `SkipCode` 那个联集是编译器在守的那一半。
 */
export const SKIP_CODES = [
  "badShape",
  "notFound",
  "noSuchComponent",
  "frameNoDelete",
  "frameNoMove",
  "moveBeforeSelf",
  "notRecordTable",
  "maxColumns",
  "noSuchColumn",
  "minOneColumn",
  "noSuchVariant",
  "notSiteSection",
  "noProse",
  "noSuchPath",
  "notWorkflow",
  "cannotLogDay",
  "rowsNotRecords",
  "notWired",
  "fieldNotShown",
  "noSuchField",
  "writeCalendar",
  "writeReconcile",
  "writeAggregated",
  "landingPage",
  "writeUnknown",
  "actLedger",
  "actDirectory",
  "actCatalog",
  "actReconcile",
  "actAggregated",
  "actUnknown",
  "noName",
  "noSubject",
  "dayNotStaffPage",
  "noStaffSaid",
  "dayKinds",
  "noRecordSaid",
  "noStatusSaid",
  "apptStates",
  "pageStates",
  "noSuchRow",
  "notPipeline",
  "notARecordPage",
  "notShelfPage",
  "noCountSaid",
  "countNotANumber",
  "notPurchasePage",
  "notShareable",
  "noFollowUp",
  "noStepSaid",
  "noLineSaid",
  "noSuchEnquiry",
  "noMessageSaid",
  "noWayToReach",
  "noClassSaid",
  "noFeeSaid",
  "noAmountSaid",
  "noMoneyPage",
  "notBookingPage",
  "noWhenSaid",
  "noEndSaid",
  "whoIsDoingIt",
  "notMoneyPage",
  "dbSaid",
  "layoutSaved",
  "designSurfaceOnly",
  "dayLogged",
  "packageUsed",
  "stockCounted",
  "stockSame",
  "goodsReceived",
  "goodsNew",
  "goodsMismatch",
  "goodsNothing",
  "shareOpened",
  "shareClosed",
  "followUpDone",
  "followUpDropped",
  "followUpSet",
  "notFromPaper",
  "undoneKept",
  "undoneMoney",
  "nothingToUndo",
  "linesFromPaper",
  "linesNotKept",
  "bookingClaimed",
  "depositAsked",
  "depositDropped",
  "appointmentBooked",
  "paymentTaken",
  "classBilled",
  "replyDrafted",
  "entryReversed",
  "remembered",
  "nothingToRemember",
  "couldNotRemember",
] as const satisfies readonly SkipCode[];

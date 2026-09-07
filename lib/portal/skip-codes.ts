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
  | "shareClosed";

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
  "dbSaid",
  "layoutSaved",
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
] as const satisfies readonly SkipCode[];

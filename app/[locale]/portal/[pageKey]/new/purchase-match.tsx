import type { RecordFormCopy } from "../record-copy";

/**
 * 「这张单我叫了多少、到了多少、付了多少 —— 对得上吗？」
 *
 * ── 那一句就是这一格的全部 ────────────────────────────────────────────────
 *
 * [任务 149](../../../../../docs/founder-tasks.md#149) 读过 ERPNext 的
 * `Purchase Invoice`：**199 个栏位**，三方核对是**三份单据**
 * （采购单 → 收货单 → 供应商发票）加一整套回写。照抄下去，一个五金店老板
 * 买一车水泥要填三张表。
 *
 * 而他真正问的是**一张单上的三个数字**，而三个数字在他今天已经在做的
 * 三个动作里全部有了：开那张进货单 · 按「货到了」· 记一笔开销分摊上去。
 * **所以这一格不是新表单，是一个「读」—— 他一步都不用多做。**
 *
 * `purchase_match` 从 20260906070000 起就在，而画面上一个入口都没有。
 *
 * ── 🔴 为什么它在标题底下，不是第十段 ────────────────────────────────────
 *
 * 那一页今天 3080px、九段叠着（[任务 273](../../../../../docs/founder-tasks.md#273)），
 * 而这三个数字**本来就是底下那几段的摘要** —— 收货那一段 · 退货那一段 ·
 * 分摊那一段。再叠一段，等於把一个摘要放在它摘要的东西后面。
 *
 * 所以它是**标题底下一条**：一句判决 ＋ 三个数字。形状拿的是
 * `up-patient` 那条警报带（一句话讲发生什么 · 底下一行小字）——
 * 而**对得上的时候那一条是安静的**，不是同一块红。
 *
 * ── 顺序按「他会赔多少钱」排，不按栏位顺序 ────────────────────────────────
 *
 * 付多了 → 钱付了货没到 → 货到了钱没付。
 * ⚠️ 而「到了几行」只数**有数量**的行 —— 一口价那种行（「运费 RM 300」）
 * 架上没有东西要动，把它算成「没到」会让每一张单都对不上（那一条写在
 * 20260906070000 里，这里只是把它的结论印出来）。
 */

export type PurchaseMatchFacts = {
  orderedCents: number;
  paidCents: number;
  unpaidCents: number;
  linesTotal: number;
  linesArrived: number;
  arrived: boolean;
  overpaidCents: number;
};

export function PurchaseMatch({
  facts,
  money,
  copy,
}: {
  facts: PurchaseMatchFacts;
  /** 分变成他看得懂的那一串。`ringgit` 住在伺服器那一边，
   *  而这一格是伺服器画的 —— 传进来的是已经排好版的字。 */
  money: (cents: number) => string;
  copy: RecordFormCopy;
}) {
  const { orderedCents, paidCents, unpaidCents, linesTotal, linesArrived } =
    facts;
  /* 一口价那种单（一行数量都没有）—— 「到了几行」在它身上没有意义，
     而印一个「0/0 行」读起来像还没到。 */
  const countsLines = linesTotal > 0;

  /* 🔴 排的是「他会赔多少钱」，不是栏位顺序。
     ⚠️ 而一张什么都还没发生的新单不是「对不上」—— 那是一张进货单
     大部分时间待着的状态，讲成警报就是天天叫狼。
     🔴 而挡住那件事的**不是**这里多一个条件，是 `arrived` 本身：
     20260906070000 对一行数量都没有的单也回 false（「而不是回一个假的
     true」，它自己的注解）。我第一版在这里多写了一个 `nothingYet`，
     故意弄坏它**没有红** —— 那一条从写下来那天就没有挡过任何东西，
     而一个读起来像在保护什么、实际什么都没保护的条件，
     比没有那一条更糟：它会让下一个人相信它。 */
  const alarm =
    facts.overpaidCents > 0
      ? copy.matchOverpaid
      : paidCents > 0 && countsLines && linesArrived === 0
        ? copy.matchPaidNotArrived
        : facts.arrived && unpaidCents > 0
          ? copy.matchArrivedNotPaid
          : null;
  const settled = !alarm && facts.arrived && unpaidCents === 0;

  return (
    <div
      data-purchase-match=""
      className={
        alarm
          ? "mb-6 [border-radius:var(--radius-md)] border p-4 [border-color:var(--color-clay-bright)] [background-color:color-mix(in_srgb,var(--color-clay-bright)_8%,transparent)]"
          : "mb-6 [border-radius:var(--radius-md)] border p-4 [border-color:var(--color-ink-800)]"
      }
    >
      {alarm ? (
        <p
          data-match-alarm=""
          role="status"
          className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
        >
          {alarm}
        </p>
      ) : (
        <p className="[font-size:var(--text-sm)] [font-weight:var(--fw-medium)] text-[color:var(--color-on-canvas)]">
          {settled ? copy.matchSettled : copy.matchOpen}
        </p>
      )}

      {/* 三个数字。它们是那一句判决的理由 —— 一句没有数字的判决，
        他没有办法自己去对。 */}
      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 [font-size:var(--text-sm)]">
        <div>
          <dt className="text-[color:var(--color-on-canvas-dim)]">
            {copy.matchOrdered}
          </dt>
          <dd className="[font-variant-numeric:tabular-nums] text-[color:var(--color-on-canvas)]">
            {money(orderedCents)}
          </dd>
        </div>
        {countsLines ? (
          <div>
            <dt className="text-[color:var(--color-on-canvas-dim)]">
              {copy.matchArrived}
            </dt>
            <dd className="[font-variant-numeric:tabular-nums] text-[color:var(--color-on-canvas)]">
              {linesArrived}/{linesTotal}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[color:var(--color-on-canvas-dim)]">
            {copy.matchPaid}
          </dt>
          <dd className="[font-variant-numeric:tabular-nums] text-[color:var(--color-on-canvas)]">
            {money(paidCents)}
          </dd>
        </div>
        {/* ⚠️ 还欠 0 的时候不画 —— 一个永远写着 RM 0 的格子是杂讯，
          而「付清了」那一句已经在上面讲过。 */}
        {unpaidCents > 0 ? (
          <div>
            <dt className="text-[color:var(--color-on-canvas-dim)]">
              {copy.matchUnpaid}
            </dt>
            <dd className="[font-variant-numeric:tabular-nums] text-[color:var(--color-on-canvas)]">
              {money(unpaidCents)}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

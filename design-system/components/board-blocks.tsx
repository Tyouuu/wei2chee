"use client";

/**
 * Three Kibo UI blocks turned into things a business owner can describe.
 *
 * Kibo's components are headless and compound: you compose
 * `<KanbanProvider><KanbanBoard><KanbanHeader><KanbanCards>` yourself and hand
 * each level a render function. That is the right shape for a developer and
 * the wrong shape for Puck, whose fields can only carry primitives. Each
 * wrapper below owns the composition and the render functions, and exposes
 * only what a contractor can actually answer: what are the stages, what is on
 * the board, what did it look like before.
 *
 * Same pattern `record-table.tsx` already uses over `data-grid.tsx` — the
 * registry gives us the hard part, this file gives it a vocabulary.
 *
 * Source: kibo-ui.com, MIT (`shadcnblocks/kibo`, 3.9k stars). Measured 100%
 * token purity on all three before pulling, so they re-colour with the
 * customer's 配色 like everything else.
 */

import { useId } from "react";
import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from "@/components/kibo-ui/kanban";
import { Comparison, ComparisonHandle, ComparisonItem } from "@/components/kibo-ui/comparison";
import { Rating, RatingButton } from "@/components/kibo-ui/rating";

/* ------------------------------------------------------------------ 看板 */

export type BoardCard = {
  title: string
  stage: string
  note?: string
  /** 金额自己一行、靠右 —— 跟表格那一栏同一条：断成两行的金额读起来是错的。 */
  amount?: string
  /** 这一单自己那一页。只有真的记录有（`live-rows.ts` 给的），示例没有。 */
  href?: string
}

export function TaskBoard({
  stages,
  cards,
}: {
  /** The columns, in order. Named after the trade's own steps —「报价」
   *  「施工」「收尾」— rather than 「To do / Doing / Done」. */
  stages: { name: string }[];
  cards: BoardCard[];
}) {
  const boardId = useId();
  const columns = (stages ?? [])
    .filter((s) => s?.name)
    .map((s, i) => ({ id: `col${i}`, name: s.name }));

  // A card whose stage does not match any column would vanish silently, which
  // in a design tool reads as "the editor ate my card". Anything unmatched
  // lands in the first column instead.
  const data = (cards ?? []).map((c, i) => {
    const hit = columns.find((col) => col.name === c.stage);
    return {
      id: `card${i}`,
      name: c.title,
      column: hit ? hit.id : (columns[0]?.id ?? "col0"),
      note: c.note ?? "",
      amount: c.amount ?? "",
      href: c.href ?? "",
    };
  });
  /* 每一栏几张 —— 参考那一页每一个栏名底下就写着「5 tasks」。
     一个看得见的数字，跟表格底下那一行「显示 7 笔」是同一件事。 */
  const count = new Map<string, number>();
  for (const d of data) count.set(d.column, (count.get(d.column) ?? 0) + 1);

  if (!columns.length) return null;

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────────
          手机上一行一笔，不是六栏挤在一起。

          🔴 2026-09-08 拍 390 才看到：六栏塞进 390px，一栏 48px，
          栏名切成「Enqu… Quot… Appr…」，单名断成「Set / bat」，
          金额只剩「RM」，而六栏里五栏是空的。
          **而尺子报「横滑 无」** —— 因为它不是滑出去，是被压扁。
          [重点 7l](../../docs/founder-tasks.md)：读数全绿而画面是坏的。

          做法照 `record-table.tsx` 已经定过的那一条（[任务 141e]）：
          同一批资料、同一条 `href`、同一个「标题切、金额靠右、第二行小字」，
          只是把**栏**换成**一段**。而 Apple 那一句也是同一个意思：
          「list item titles only, letting people choose an item to reveal
          its content in a detail view」。

          ⚠️ **空的那几段不画** —— 一个装修老板手上六个阶段常常只有两个有单，
          印四段「0」是四段要他滑过去的东西。而**栏名底下那个数字留着**，
          跟宽的那一边同一个事实。 */}
      <div className="flex flex-col [gap:var(--gap-stack)] @3xl:hidden">
        {columns.map((column) => {
          const mine = data.filter((d) => d.column === column.id);
          if (!mine.length) return null;
          return (
            <section key={column.id}>
              <h3 className="flex items-baseline [gap:var(--gap-inline)] [color:var(--color-paper-dim)] [font-size:var(--text-micro)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
                <span>{column.name}</span>
                <span className="tnum [font-weight:var(--fw-regular)]">{mine.length}</span>
              </h3>
              <ul className="mt-1 flex flex-col">
                {mine.map((item) => {
                  const body = (
                    <>
                      <span className="flex items-baseline [gap:var(--gap-inline)]">
                        <span className="min-w-0 flex-1 truncate [color:var(--color-paper)] [font-weight:var(--fw-medium)]">
                          {item.name}
                        </span>
                        {item.amount ? (
                          <span className="shrink-0 whitespace-nowrap tabular-nums [color:var(--color-paper)] [font-family:var(--font-numeric)]">
                            {item.amount}
                          </span>
                        ) : null}
                      </span>
                      {item.note ? (
                        <span className="truncate [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                          {item.note}
                        </span>
                      ) : null}
                    </>
                  );
                  /* 整行都点得到 —— 一个拇指按不准一句字里的那几个字。
                     示例没有 `href`，所以示范的板照旧点不动（跟表格同一条）。 */
                  return (
                    <li
                      key={item.id}
                      className="[&:not(:last-child)]:border-b [&:not(:last-child)]:[border-color:var(--color-ink-800)]"
                    >
                      {item.href ? (
                        <a
                          href={item.href}
                          className="flex min-h-11 flex-col justify-center [gap:2px] [padding-block:var(--pad-cell-y)]"
                        >
                          {body}
                        </a>
                      ) : (
                        <div className="flex min-h-11 flex-col justify-center [gap:2px] [padding-block:var(--pad-cell-y)]">
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {/* A STABLE id, not dnd-kit's default.

          DndContext hands every sortable an `aria-describedby="DndDescribedBy-N"`
          off a module-level counter that starts fresh in each environment, so the
          server said `-6` and the browser said `-0` and React threw away the whole
          subtree it was hydrating — once in the editor palette and again on the
          component library page. `useId` is the exact tool for this: React
          guarantees the same value on both sides of the render.

          🔴 这几行本来是 `//`，因为它当时坐在 `return (` 后面 —— 那是一个
          **表达式**位置，`//` 在那里是真的注解。2026-09-08 把板包进一个
          `<div>` 之后它掉进了**子元素**位置，於是**整段注解被原样印在
          客户的页面上**，而 `tsc` 一个字都没讲。是拍图看到的
          （[重点 7l](../../docs/founder-points.md)）。 */}
      <div className="hidden @3xl:block">
    <KanbanProvider id={boardId} columns={columns} data={data} onDataChange={() => {}}>
      {(column) => (
        <KanbanBoard id={column.id} key={column.id}>
          <KanbanHeader>
            <span className="flex items-baseline [gap:var(--gap-inline)]">
              <span>{column.name}</span>
              <span className="tnum [color:var(--color-paper-dim)] [font-size:var(--text-xs)] [font-weight:var(--fw-regular)]">
                {count.get(column.id) ?? 0}
              </span>
            </span>
          </KanbanHeader>
          <KanbanCards id={column.id}>
            {(item) => (
              <KanbanCard key={item.id} id={item.id} name={item.name} column={item.column}>
                {/*
                  🔴 卡片是「打开这一单」的入口（2026-09-05）。

                  工程那一页本来是**看板加一张一模一样的表**：同一批七笔画两次。
                  参考那一页（Studio Admin 的 Kanban）只有板 —— 而「同一行印两次
                  同一个数字」正是[印那一套风格被砍掉的理由](../../docs/founder-tasks.md)。
                  拿掉那张表就要把它唯一不可替代的东西补上：**表格第一格是连结**。

                  一个连结，不是一颗按钮：这块也画在风格画廊、几百张缩图跟纸上，
                  那些地方没有 session。示例没有 href，所以示范的板点不动 ——
                  跟表格同一条规矩。
                  ⚠️ 能点得下去是因为同一天给 dnd 的感应器加了 6px 的启动门槛。
                */}
                {typeof item.href === "string" && item.href ? (
                  <a
                    href={item.href}
                    className="m-0 block [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] underline decoration-[color:var(--color-ink-700)] underline-offset-[3px] hover:decoration-[color:var(--color-primary)]"
                  >
                    {item.name}
                  </a>
                ) : (
                  <p className="m-0 [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                    {item.name}
                  </p>
                )}
                {typeof item.note === "string" && item.note ? (
                  <p className="m-0 mt-0.5 [font-size:var(--text-xs)] text-muted-foreground">
                    {item.note}
                  </p>
                ) : null}
                {typeof item.amount === "string" && item.amount ? (
                  /* 金额自己一行、靠右、不断行 —— 跟表格那一栏同一条。 */
                  <p className="m-0 mt-1 whitespace-nowrap text-right tabular-nums [font-family:var(--font-numeric)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
                    {item.amount}
                  </p>
                ) : null}
              </KanbanCard>
            )}
          </KanbanCards>
        </KanbanBoard>
      )}
        </KanbanProvider>
      </div>
    </>
  );
}

/* -------------------------------------------------------------- 前后对比 */

export function BeforeAfter({
  beforeSrc,
  afterSrc,
  beforeLabel,
  afterLabel,
}: {
  beforeSrc?: string;
  afterSrc?: string;
  beforeLabel: string;
  afterLabel: string;
}) {
  // No image yet is the NORMAL state here: this is a design of a system, and
  // the customer's real photos arrive when the system is built. Two labelled
  // panels say「a picture goes here」far better than a broken-image icon, and
  // they still demonstrate the drag handle, which is the point of the block.
  const panel = (label: string, src: string | undefined, tone: string) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={label} className="h-full w-full object-cover" />
    ) : (
      <div className={`flex h-full w-full items-center justify-center ${tone}`}>
        <span className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">{label}</span>
      </div>
    );

  return (
    <Comparison className="aspect-[16/9] w-full overflow-hidden [border-radius:var(--radius-lg)]">
      <ComparisonItem position="left">{panel(beforeLabel, beforeSrc, "bg-muted text-muted-foreground")}</ComparisonItem>
      <ComparisonItem position="right">{panel(afterLabel, afterSrc, "bg-primary/10 text-foreground")}</ComparisonItem>
      <ComparisonHandle />
    </Comparison>
  );
}

/* ------------------------------------------------------------------ 评分 */

export function Stars({ value, outOf }: { value: number; outOf: number }) {
  const total = Math.max(1, Math.min(10, Math.round(outOf || 5)));
  // `key` goes on RatingButton itself, not on a Fragment around it: Rating
  // clones each child to inject `index`, and a Fragment wrapper swallowed the
  // clone — React then warned `Invalid prop index supplied to React.Fragment`
  // once per star, five times per preview.
  return (
    <Rating value={Math.max(0, Math.min(total, value))} readOnly>
      {Array.from({ length: total }).map((_, i) => (
        <RatingButton key={i} />
      ))}
    </Rating>
  );
}

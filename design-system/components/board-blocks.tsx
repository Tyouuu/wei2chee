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

import { Fragment } from "react";
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

export type BoardCard = { title: string; stage: string; note?: string };

export function TaskBoard({
  stages,
  cards,
}: {
  /** The columns, in order. Named after the trade's own steps —「报价」
   *  「施工」「收尾」— rather than 「To do / Doing / Done」. */
  stages: { name: string }[];
  cards: BoardCard[];
}) {
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
    };
  });

  if (!columns.length) return null;

  return (
    <KanbanProvider columns={columns} data={data} onDataChange={() => {}}>
      {(column) => (
        <KanbanBoard id={column.id} key={column.id}>
          <KanbanHeader>{column.name}</KanbanHeader>
          <KanbanCards id={column.id}>
            {(item) => (
              <KanbanCard key={item.id} id={item.id} name={item.name} column={item.column}>
                <p className="m-0 [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                  {item.name}
                </p>
                {typeof item.note === "string" && item.note ? (
                  <p className="m-0 mt-0.5 [font-size:var(--text-xs)] text-muted-foreground">
                    {item.note}
                  </p>
                ) : null}
              </KanbanCard>
            )}
          </KanbanCards>
        </KanbanBoard>
      )}
    </KanbanProvider>
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
  return (
    <Rating value={Math.max(0, Math.min(total, value))} readOnly>
      {Array.from({ length: total }).map((_, i) => (
        <Fragment key={i}>
          <RatingButton />
        </Fragment>
      ))}
    </Rating>
  );
}

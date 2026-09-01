import { MODULE_CATALOG, type ModuleShape } from "./module-catalog";

/**
 * Which shapes hold a business's own records, and which are still drawings.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 *
 * It is the single most important fact about this product right now, and
 * until today it was written down nowhere. It lived as two hand-copied Sets --
 * `PIPELINE_MODULES` and `LEDGER_MODULES` -- in live-rows.ts AND in
 * record-ops.ts, both added the same afternoon. A hand-written list that
 * outlives the thing it describes is the defect this repo has shipped four
 * times; two copies of one, one day old, is that defect being born.
 *
 * So the membership is derived from the catalogue, and the only judgement --
 * does this shape have a table behind it -- is stated once, here.
 *
 * ── WHAT THE STATES MEAN ──────────────────────────────────────────────────
 *
 *   live   There is a table, an RPC, RLS, document numbers, and BOTH ways in:
 *          a person's button and the assistant calling the same function.
 *          A row written here is the business's own record.
 *
 *   reads  It holds NOTHING and never will. 总览, 报表 and 排名 add not one
 *          row of their own -- the catalogue filed them under its own heading
 *          「月底才看的 — 一行资料都不新增」 -- they are questions asked of the
 *          shapes that do hold rows. Real to the owner, and correctly without
 *          a table, an RPC or a 加一单 button.
 *
 *   drawn  The page renders and teaches what the module is for, and every
 *          customer sees the same 陈先生 · RM 48,500. Honest as a
 *          demonstration, and the thing that has to end before a monthly fee
 *          means anything (任务 22).
 *
 * There is deliberately no state for "half". A shape whose rows exist but
 * which nobody can write to without an AI is not 60% done, it is `drawn` with
 * extra steps -- which is exactly what the ledger was for one day, until the
 * button behind 加一单 was built.
 *
 * ⚠️ `reads` WAS ADDED BECAUSE THE TWO-STATE VERSION MADE THIS FILE LIE, AND
 * IT LIED ON THE ONE SCREEN THAT DECIDES WHAT GETS BUILT NEXT. 总览 has read
 * his own figures and his own rows since 2026-08-31 (live-stats.ts), and the
 * console still printed 「还是画的」 over it, because the only other word
 * available meant 「has a table」. Two states forced one question -- 「does it
 * hold records」 -- to answer a different one -- 「is what he sees real」. They
 * are not the same question and three of the ten shapes are the difference.
 */

export type ShapeState = "live" | "reads" | "drawn";

/**
 * ⚠️ ONLY MOVE A SHAPE TO `live` WHEN ALL FIVE ARE TRUE.
 *
 *   1. a table, with RLS keyed to the owner
 *   2. an RPC that assigns the document number -- never the client
 *   3. the projection that puts real rows on the page in place of samples
 *   4. a person's own way in (the form behind 加一单)
 *   5. the assistant routed through the SAME RPC, not one of its own (重点 23)
 *
 * Four of five is how this product spent 2026-08-31 believing the ledger was
 * finished while the only writer was a chatbot.
 */
export const SHAPE_STATE: Record<ModuleShape, ShapeState> = {
  pipeline: "live",
  ledger: "live",
  directory: "live",
  catalog: "live",

  /* Nothing of their own to hold. See `reads` above -- and see live-months.ts
     for what each one counts and where it counts it from. */
  overview: "reads",
  report: "reads",
  leaderboard: "reads",

  /* 对账 needs ONE small table: the outside total (bank, principal, platform)
     to compare the books against. Until there is a statement to reconcile TO,
     the page can only show its own sum twice, which is why it is NOT `reads`
     -- 「asks a question of the other tables」 is precisely what it cannot do
     with only one side of the comparison. */
  reconcile: "drawn",

  /* 预约 needs a real table: a time, an overlap rule, and the prepaid balance
     任务 44 and 67 both named. The biggest of the five, and the salon that
     needs it does not start until next year. */
  calendar: "drawn",

  landing: "drawn",
};

/** The shapes that show real figures without holding any rows. Derived, so a
 *  shape moving between states cannot leave a second list behind. */
export const READS_SHAPES: ReadonlySet<ModuleShape> = new Set(
  (Object.keys(SHAPE_STATE) as ModuleShape[]).filter((s) => SHAPE_STATE[s] === "reads"),
);

/** True when what the owner sees on this shape's pages is his own -- whether
 *  it is rows he wrote or figures counted from them. `isLiveShape` answers a
 *  narrower question (may he add one here) and both are needed: 报表 shows him
 *  his own money and must never grow an 加一单 button. */
export function isRealShape(shape: ModuleShape): boolean {
  return SHAPE_STATE[shape] !== "drawn";
}

export function isLiveShape(shape: ModuleShape): boolean {
  return SHAPE_STATE[shape] === "live";
}

/** The modules of one shape, from the catalogue. Never a second list. */
export function modulesOfShape(shape: ModuleShape): string[] {
  return MODULE_CATALOG.filter((m) => m.shape === shape).map((m) => m.key);
}

/** Every module whose rows are real, derived. Consumed by the projection, by
 *  the assistant's write path and by the console -- one fact, three readers. */
export const LIVE_MODULES: ReadonlySet<string> = new Set(
  MODULE_CATALOG.filter((m) => isLiveShape(m.shape)).map((m) => m.key),
);

export const PIPELINE_MODULES: ReadonlySet<string> = new Set(modulesOfShape("pipeline"));
export const LEDGER_MODULES: ReadonlySet<string> = new Set(modulesOfShape("ledger"));
export const DIRECTORY_MODULES: ReadonlySet<string> = new Set(modulesOfShape("directory"));
export const CATALOG_MODULES: ReadonlySet<string> = new Set(modulesOfShape("catalog"));

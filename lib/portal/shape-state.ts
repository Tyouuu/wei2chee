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
 *   drawn  The page renders and teaches what the module is for, and every
 *          customer sees the same 陈先生 · RM 48,500. Honest as a
 *          demonstration, and the thing that has to end before a monthly fee
 *          means anything (任务 22).
 *
 * There is deliberately no third state for "half". A shape whose rows exist
 * but which nobody can write to without an AI is not 60% done, it is `drawn`
 * with extra steps -- which is exactly what the ledger was for one day, until
 * the button behind 加一单 was built.
 */

export type ShapeState = "live" | "drawn";

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
  directory: "drawn",
  calendar: "drawn",
  catalog: "drawn",
  reconcile: "drawn",
  report: "drawn",
  leaderboard: "drawn",
  overview: "drawn",
  landing: "drawn",
};

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

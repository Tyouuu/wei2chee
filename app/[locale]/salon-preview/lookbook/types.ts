/** One look as the page draws it: a saved work, or (only while the lookbook is empty) an example. */
export type LookCard = {
  id: string;
  title: string;
  category: string;
  /** Lift level as she typed it ("6.1", "L8"); the chart only looks at its whole-number part. */
  level: string;
  formula: string;
  note: string;
  tags: string[];
  stylistName: string | null;
  stylistColor: string;
  /** A signed, expiring URL from the server, or null when the look has no photo. */
  photoUrl: string | null;
  /** "12 Sep 2026", formatted on the server in Kuala Lumpur time. */
  addedLabel: string;
  /** ISO time it was added; only used to sort. */
  addedAt: string;
  /** An example card: drawn to show what a look holds, never actionable. */
  example?: boolean;
};

/** A stable colour for a stylist's dot, from her id: the same person is always the same colour. */
const DOTS = ["#1a9a4d", "#3b62d9", "#a8710a", "#b0369a", "#c2410c", "#0f766e"];
export function stylistDot(id: string | null): string {
  if (!id) return "#77767b";
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return DOTS[h % DOTS.length];
}

/** The whole-number part of a lift level ("L6.1" -> 6, "10.2" -> 10), or null when there is none. */
export function liftOf(level: string): number | null {
  const m = level.match(/\d+(\.\d+)?/);
  if (!m) return null;
  const n = Math.floor(parseFloat(m[0]));
  return Number.isFinite(n) ? n : null;
}

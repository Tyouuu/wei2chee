/**
 * 这一块自己的颜色 — one block on a different ground from the page it sits on.
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * Durable's per-block Design tab opens with a row of colour swatches, and the
 * founder marked it 拿 on 2026-08-25 for the plainest reason: a page where one
 * block can be dark and the rest light has an emphasis a page of uniform cards
 * does not. Ours could not do it at all — the register painted the whole page
 * and every block took what it was given.
 *
 * ── WHY IT IS A TOKEN REMAP AND NOT A `bg-` CLASS ────────────────────────
 *
 * A block is not one surface. A RecordTable is a heading, a filter row, a
 * table head, banded rows, hairlines and status dots, and every one of those
 * reads a different `--color-*`. Painting the wrapper dark would leave all of
 * them resolving against the page's light values, which is the exact failure
 * the landing page's ink band hit the same afternoon: a white heading over
 * three rows of invisible grey.
 *
 * So a tone re-points the surface FAMILY on the wrapper and lets the cascade
 * carry it — the same move `SystemShell.navTone` and `chrome.module.css`'s
 * `.paper` already make in this codebase, and the reason nothing inside a
 * toned block needs to know it has been toned.
 *
 * ── WHY THESE FOUR ────────────────────────────────────────────────────────
 *
 * `page` is the absence of a choice, and it has to stay the default: a block
 * that follows the register is how sixteen registers stay sixteen registers.
 * The other three are the only ones that are legible in EVERY register — a
 * fifth (say "brand red") would look considered in 招牌 and wrong in 墨. What
 * is offered is a RELATIONSHIP to the page's own ground, not a colour.
 */

export type BlockTone = "page" | "ink" | "tint" | "paper";

export const BLOCK_TONES: BlockTone[] = ["page", "ink", "tint", "paper"];

/**
 * The swatch the customer clicks. Two stops so the chip reads as a surface
 * with something on it rather than as a flat square of paint.
 */
export const TONE_SWATCH: Record<BlockTone, { bg: string; fg: string; ring: string }> = {
  // Transparent, not grey: see the note on the slash in variant-picker.tsx.
  page: { bg: "transparent", fg: "var(--color-paper-dim)", ring: "var(--color-ink-700)" },
  ink: { bg: "var(--color-paper)", fg: "var(--color-ink-900)", ring: "var(--color-paper-dim)" },
  tint: {
    bg: "var(--color-primary-soft)",
    fg: "var(--color-primary)",
    ring: "var(--color-primary)",
  },
  paper: { bg: "#ffffff", fg: "#1a1d24", ring: "var(--color-ink-700)" },
};

/**
 * TWO LAYERS, AND THE REASON IS A CSS RULE THAT BITES SILENTLY.
 *
 * The first version put everything on one element:
 *
 *     --color-canvas: var(--color-paper);
 *     --color-paper:  var(--color-ink-900);
 *     --color-ink-900: var(--color-paper);
 *
 * which is a cycle -- `--color-paper` reads a property that reads it back --
 * and CSS discards every declaration in a cycle. The variables all appeared in
 * the DOM, the wrapper computed `background-color: rgba(0,0,0,0)`, and nothing
 * anywhere threw. Found by measuring the computed style rather than by looking
 * at the screenshot, because a transparent block on a light page looks exactly
 * like a block that was never toned.
 *
 * `capture` goes on the outer element and copies the register's CURRENT values
 * into names nothing else uses. `apply` goes on the inner one and assigns from
 * those copies, so every read resolves against the layer above and no property
 * ever reads itself.
 *
 * (record-table.tsx already carries this exact warning about `--row-height`
 * reading itself. Second time in this codebase.)
 */
export function toneLayers(
  tone: BlockTone | undefined,
): { capture: Record<string, string>; apply: Record<string, string> } | undefined {
  if (!tone || tone === "page") return undefined;

  // The register's own values, frozen under private names.
  const capture = {
    "--tone-paper": "var(--color-paper)",
    "--tone-paper-dim": "var(--color-paper-dim)",
    "--tone-ink": "var(--color-ink-900)",
    "--tone-primary-soft": "var(--color-primary-soft)",
  };

  if (tone === "ink") {
    // Inverted: the register's ink becomes the ground, its paper the writing.
    // Derived from the register rather than from a literal, so 夜 -- already
    // dark -- inverts to its own light and does not become a black square on
    // a black page.
    return {
      capture,
      apply: {
        "--color-canvas": "var(--tone-paper)",
        "--color-ink-900": "var(--tone-paper)",
        "--color-ink-850": "color-mix(in oklab, var(--tone-paper) 92%, var(--tone-ink))",
        "--color-ink-800": "color-mix(in oklab, var(--tone-paper) 78%, var(--tone-ink))",
        "--color-ink-700": "color-mix(in oklab, var(--tone-paper) 64%, var(--tone-ink))",
        "--color-paper": "var(--tone-ink)",
        "--color-paper-dim": "color-mix(in oklab, var(--tone-ink) 72%, var(--tone-paper))",
        "--color-on-canvas": "var(--tone-ink)",
        "--color-on-canvas-dim": "color-mix(in oklab, var(--tone-ink) 72%, var(--tone-paper))",
        "--card": "var(--tone-paper)",
        "--border": "color-mix(in oklab, var(--tone-paper) 74%, var(--tone-ink))",
        "--border-subtle": "color-mix(in oklab, var(--tone-paper) 82%, var(--tone-ink))",
        // The table draws its head from its OWN pair of tokens (印 fills the
        // band, seven others rule it), and leaving them out produced a dark
        // table with a white head -- visible immediately, invisible to any
        // test. Every surface family a toned block can contain has to be in
        // this map or the block is toned "except for one thing".
        "--color-table-head-bg": "color-mix(in oklab, var(--tone-paper) 88%, var(--tone-ink))",
        "--color-table-head-fg": "color-mix(in oklab, var(--tone-ink) 72%, var(--tone-paper))",
        "--color-table-bg": "transparent",
      },
    };
  }

  if (tone === "tint") {
    // The register's own accent at low strength. Every register defines
    // --color-primary-soft and every one tuned it to sit just above its own
    // page background, so this is a step and never a clash.
    return {
      capture,
      apply: {
        "--color-canvas": "var(--tone-primary-soft)",
        "--color-table-bg": "transparent",
        "--color-ink-900": "var(--tone-primary-soft)",
        "--card": "var(--tone-primary-soft)",
      },
    };
  }

  // paper -- the one surface identical in every register, for the block that
  // has to read as a document lying on the page.
  return {
    capture,
    apply: {
      "--color-canvas": "#ffffff",
      "--color-ink-900": "#ffffff",
      "--card": "#ffffff",
    },
  };
}

// Derives design-system/tokens/glass.css from soft.css.
//
// Same method as derive-brut.mjs and derive-ink.mjs: take the closest existing
// register and move only the axes that make the new one a different register,
// by script rather than by hand, so the ~120 tokens that should NOT change
// cannot drift.
//
//   node scripts/derive-glass.mjs
//   npm run build:tokens
//
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "design-system/tokens/soft.css";
const OUT = "design-system/tokens/glass.css";

let css = readFileSync(SRC, "utf8");

const HEADER = `/* 玻璃 (Glass) — the first register that is not a flat rectangle.

   WHY IT EXISTS, MEASURED. The twelve registers were audited on 2026-08-23 the
   way the weight audit ran before 粗野 and the space audit before 墨. Radius
   had ten distinct values and row height eleven, so the NUMBERS were spread
   wide. The vocabulary was not:

     backdrop-filter 0   radial gradient 0   noise 0   animation 0
     text-shadow 0   dashed border 0   double border 0   outline 0

   Every one of the twelve was a flat rectangle with a colour, a radius, a
   border width and a font. Four words. That is why they read as variations of
   each other, and why a thirteenth in the same four words would have been a
   thirteenth variation. The founder's objection was 「我不要很大同小异」 and it
   was correct.

   So the surface vocabulary was built first (app/globals.css, the four
   .ds-* classes, and four new tokens on every register). This register is the
   first one that says something the old four words could not.

   WHERE IT CAME FROM. uiprompt.site's Glassmorphism brief, recovered in
   docs/style-briefs/README.md, which that file's own preamble listed as
   buildable — 「讲表面的那些才做得出来:粗野、剪纸、玻璃、颗粒、黏土」 — and
   which nothing could build until now, because the token layer had no word for
   blur.

   THE MOVES, and only two of them are new kinds of thing:

     1. THE CARD IS TRANSLUCENT.  --color-ink-900 becomes rgba white at 55%.
        Every card, every dropdown, every input in the system is now something
        you see the page THROUGH. This is the whole register; everything else
        below exists to make it legible.

     2. THE CARD BLURS WHAT IS BEHIND IT.  --surface-blur: blur(20px)
        saturate(180%). Without this, translucency is just a washed-out colour;
        with it, the card reads as a physical pane. The token did not exist
        before 2026-08-23.

     3. THE GROUND HAS SOMETHING TO SEE.  --canvas-image paints three soft
        colour fields. A glass pane over a flat grey is indistinguishable from
        a grey card — glass needs something behind it or it is not glass. This
        is the second new token doing work.

     4. HAIRLINE OF LIGHT.  A 1px white-at-70% border, which is how a real pane
        catches light at its edge, and the only thing separating two overlapping
        panes.

     5. SOFT SHADOW, WIDER AND COOLER than Soft's own — the pane floats above
        the field rather than being pressed into it.

   Type, density and radius stay Soft's: 18px corners and generous padding are
   already the right shape for this, and a register that changed everything at
   once would not be a register, it would be a different product.

   @structural --color-ink-900, --color-ink-800, --canvas-image

   Three tokens outrank the 配色 layer here, for the same reason 粗野's 3px
   stroke does. The palette repaints colour after the register is applied,
   which is right for a register whose cards are opaque. Repaint a translucent
   card with a solid palette colour and the blur has nothing to show: the whole
   register collapses back into Soft with different paint. The accent, the text
   and the ground colour still follow the palette, so 玻璃 + 石板灰 is a grey
   glass system rather than a grey one. */`;

// Replace soft.css's own header comment (the one immediately before @theme).
const start = css.indexOf("/* 柔和 (Soft");
const end = css.indexOf("@theme", start);
if (start < 0 || end < 0) throw new Error("soft.css header not found");
css = css.slice(0, start) + HEADER + "\n" + css.slice(end);

/** token -> value. Every one of these is argued in the header above. */
const MOVES = {
  // ── 1. the pane ─────────────────────────────────────────────────────────
  // Translucent white, not a light grey. The alpha is what the blur reads
  // through; at 0.70 the field behind stops being visible and the register
  // stops existing, at 0.40 body text loses contrast against a coloured field.
  "--color-ink-900": "rgba(255, 255, 255, 0.55)",
  "--color-ink-850": "rgba(255, 255, 255, 0.72)",
  "--color-ink-950": "rgba(255, 255, 255, 0.38)",

  // ── 2. blur ─────────────────────────────────────────────────────────────
  // Saturation is not decoration: blurring alone greys out the colour behind
  // the pane, and pushing saturation back up is what keeps the field readable
  // through it. Both halves are what every real implementation of this does.
  "--surface-blur": "blur(20px) saturate(180%)",

  // ── 3. something to see through it ──────────────────────────────────────
  // Three fields, wide and low-contrast. Not a photograph: a customer's system
  // has to stay readable for eight hours, and a picture behind the text is the
  // reason most glass interfaces are unusable.
  "--color-canvas": "#eaeefb",
  "--canvas-image":
    "radial-gradient(60rem 40rem at 12% 8%, rgba(120, 140, 255, 0.28), transparent 60%), radial-gradient(50rem 36rem at 88% 22%, rgba(255, 140, 200, 0.22), transparent 60%), radial-gradient(56rem 40rem at 60% 96%, rgba(120, 220, 220, 0.24), transparent 62%)",

  // ── 4. the lit edge ─────────────────────────────────────────────────────
  "--border-card-width": "1px",
  "--color-ink-800": "rgba(255, 255, 255, 0.70)",
  "--color-ink-700": "rgba(255, 255, 255, 0.45)",
  "--hairline": "1px",

  // ── 5. floating, not pressed ────────────────────────────────────────────
  // Soft's shadow is offset down-right, which is what makes it read as pressed
  // plastic. A pane hangs: centred, wide, and cool.
  "--shadow-card": "0 8px 32px rgba(31, 38, 100, 0.12)",
  "--shadow-raised": "0 12px 40px rgba(31, 38, 100, 0.18)",
  "--shadow-overlay": "0 24px 64px rgba(31, 38, 100, 0.28)",

  // Ink dark enough to hold against a coloured field seen through 55% white.
  "--color-paper": "#1c2233",
  "--color-paper-dim": "#5a6379",

  // The accent stays in the blue-violet family Soft already used, deepened so
  // a filled button still reads as filled on top of a translucent card.
  "--color-primary": "#4f46e5",
  "--color-primary-deep": "#3f37c9",
  "--color-primary-soft": "rgba(79, 70, 229, 0.12)",

  // The rail is the one opaque object on the page. A translucent navigation
  // over a moving canvas is where glass interfaces become unusable, and it is
  // also the thing a customer looks at while doing something else.
  "--color-nav-bg": "#171a2e",
  "--color-nav-bg-deep": "#101223",
  "--color-nav-border": "rgba(255, 255, 255, 0.10)",
};

for (const [token, value] of Object.entries(MOVES)) {
  // Exactly TWO spaces of indent, and the value may span lines.
  //
  // `^s*` used to match the prose inside the surface-token comment box
  // first: those lines read `     --surface-blur: backdrop-filter for the
  // card`, which is indistinguishable from a declaration to a regex. The
  // derive reported 21 tokens moved and had rewritten a sentence inside a
  // comment. The comment lines were renamed too, so this is the second lock.
  const re = new RegExp(`(^  ${token}\s*:\s*)([^;]+)(;)`, "m");
  if (!re.test(css)) throw new Error(`token not found in ${SRC}: ${token}`);
  css = css.replace(re, `$1${value}$3`);
}

writeFileSync(OUT, css);
console.log(`wrote ${OUT} (${Object.keys(MOVES).length} tokens moved)`);

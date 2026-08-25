"use client";

import type { ReactElement } from "react";
import type { Config } from "@puckeditor/core";
import { puckConfig } from "@/design-system/editor/puck-config";
import { LABELS_EN } from "@/design-system/editor/labels-en";
import { sampleProps } from "@/design-system/editor/sample-en";
import { useRegisterVariant } from "@/design-system/editor/style-scope";
import { toneLayers, type BlockTone } from "@/design-system/editor/block-tone";

/**
 * The register's preferences, actually delivered.
 *
 * ── WHAT WAS MEASURED ─────────────────────────────────────────────────────
 *
 * `useRegisterVariant` and `useRegisterProp` have existed in style-scope.tsx
 * since the register/variant pairing was designed, under seventy lines of
 * comment explaining the precedence rule. Grepped across the whole repository
 * on 2026-08-23: NOTHING CALLED THEM. The only consumer of `preferredVariants`
 * was variant-picker.tsx, which uses it to light up a tile in the UI.
 *
 * So twenty-one registers declared fifteen component preferences each — three
 * hundred and fifteen statements — and not one of them reached a component.
 * Verified in a browser rather than reasoned about: 墨 (light rail, text-only),
 * 台账 (deep rail, icons-only) and 玻璃 (top bar) rendered byte-identical
 * navigation — width 228, ground lab(9.59 -14.58 10.86), fourteen labels
 * visible, side axis — in all three.
 *
 * That is the whole of 「我怎么看到还是一样的东西」. It was never a shortage of
 * variants. It was a wire that was drawn and never connected.
 *
 * ── WHY THIS IS A SEPARATE, CLIENT-ONLY MODULE ────────────────────────────
 *
 * The first attempt wrapped the config inside puck-config.tsx itself and took
 * the whole product down with a 500 on every page:
 *
 *   Attempted to call useRegisterVariant() from the server but
 *   useRegisterVariant is on the client.
 *
 * puck-config.tsx is imported by two SERVER modules — `lib/portal/layout-ops.ts`
 * (which validates layouts against the component list) and
 * `components/auth-shell.tsx` — so it must stay renderable on the server, and
 * it cannot contain a hook. Marking it `"use client"` instead would hand those
 * two server modules a client reference rather than the object, which is the
 * same failure this codebase has already hit twice (BLOCKS, BLOCK_COPY).
 *
 * Splitting is what satisfies both: the raw config stays server-safe, this
 * module is entirely client, and because the wrapping happens at module scope
 * INSIDE a client module, the `render` functions never cross a boundary.
 *
 * ── WHY WRAP RATHER THAN EDIT FIFTEEN COMPONENTS ──────────────────────────
 *
 * The alternative is editing fifteen `render` functions to read the hook and
 * merge. Fifteen edits is fifteen chances to miss one, and the sixteenth
 * component registered next month starts life disconnected — which is exactly
 * how this got here. Wrapping means a component is connected by being
 * registered, with no second step to remember.
 *
 * ── THE PRECEDENCE RULE, ENFORCED ─────────────────────────────────────────
 *
 *     the customer's own prop  >  the register's preference  >  the default
 *
 * A prop the customer set through 换个款式 is PRESENT in the layout and wins.
 * A prop nobody ever set is `undefined`, and only those are filled from the
 * register. `undefined` is the entire test, which is why these components take
 * their appearance props without default parameters: a default in the
 * signature would make "never chosen" indistinguishable from "chosen, and it
 * happens to equal the default".
 */
function RegisterResolved({
  name,
  render,
  props,
}: {
  name: string;
  render: (props: never) => ReactElement | null;
  props: Record<string, unknown>;
}) {
  const preferred = useRegisterVariant(name);
  const merged = { ...props };
  for (const [key, value] of Object.entries(preferred)) {
    if (merged[key] === undefined) merged[key] = value;
  }

  /*
    这一块自己的颜色, applied HERE and nowhere else.

    `tone` is not declared on any of the sixty-six components and does not need
    to be: Puck stores whatever props an item carries, the 换款式 picker writes
    it the same way it writes every other appearance prop, and this is the one
    place every component's render already passes through. Declaring it
    component by component would be sixty-six edits and sixty-six chances for
    the sixty-seventh to be added without it -- the failure this file's own
    header comment exists to describe.

    See block-tone.ts for why it re-points variables instead of setting a
    background.
  */
  const layers = toneLayers(merged.tone as BlockTone | undefined);
  const drawn = render(merged as never);
  if (!layers) return drawn;
  // The ground goes in the STYLE object, not in a Tailwind class. Measured:
  // the arbitrary-property version compiled to nothing and the wrapper rendered
  // with `background-color: rgba(0,0,0,0)` -- the variables were all correctly
  // re-pointed on an element that then painted none of them. This file had
  // never carried a class before, so there was nothing to notice it by.
  return (
    <div style={layers.capture as React.CSSProperties}>
      <div
        style={{ ...layers.apply, backgroundColor: "var(--color-canvas)" } as React.CSSProperties}
      >
        {drawn}
      </div>
    </div>
  );
}

type AnyComponent = { render: (props: never) => ReactElement | null };

/**
 * The same config, with every component's render passing through the register.
 *
 * Every surface that RENDERS a customer's system imports this one; the two
 * server modules that only READ the config (layout validation, the auth shell)
 * keep importing `puckConfig` directly.
 */
export const registerAwarePuckConfig: Config = {
  ...puckConfig,
  components: Object.fromEntries(
    Object.entries(puckConfig.components as unknown as Record<string, AnyComponent>).map(
      ([name, component]) => [
        name,
        {
          ...component,
          render: (props: Record<string, unknown>) => (
            <RegisterResolved name={name} render={component.render} props={props} />
          ),
        },
      ],
    ),
  ),
} as unknown as Config;

/* ─────────────────────────────────────────────────────────────────────────
   THE SAME CONFIG, IN THE OWNER'S LANGUAGE.

   「明明选择了英文 作为language 为什么还是有那么多华语字的呢」 -- 2026-08-25, with
   a screenshot of ＋ 加一段 on an otherwise English page.

   The top bar was already translated (next-intl), and nothing else was: every
   block name, category heading, field label and 换个款式 option in
   puck-config.tsx is a Chinese string literal, and a literal cannot follow a
   locale. See labels-en.ts for why the fix is a projection of the Chinese
   config rather than 489 next-intl keys.

   WHAT IS TRANSLATED: `label` on a component, `title` on a category, `label`
   on every field including the ones nested inside `arrayFields` and `objectFields`,
   and the `label` of every select option. Those are the four places the owner
   reads a word Formae wrote.

   WHAT IS NOT: `defaultProps`. That is the sample content a new block arrives
   with, which belongs to the CUSTOMER'S system and follows its language, not
   the owner's interface -- see labels-en.ts.

   Memoised per locale because a new config object identity remounts Puck's
   whole tree, and this is read on every render of the editor.
   ───────────────────────────────────────────────────────────────────────── */

function tr(value: unknown): unknown {
  return typeof value === "string" ? (LABELS_EN[value] ?? value) : value;
}

/** Fields nest: an `array` field has `arrayFields`, an `object` field has
 *  `objectFields`, and both hold more fields. Written as a recursion rather
 *  than two loops because the depth is a property of the config, not a
 *  constant -- and a config that grows a third level should not silently ship
 *  half-translated. */
function localiseFields(fields: unknown): unknown {
  if (!fields || typeof fields !== "object") return fields;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(fields as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") {
      out[key] = raw;
      continue;
    }
    const f = { ...(raw as Record<string, unknown>) };
    if (f.label !== undefined) f.label = tr(f.label);
    if (Array.isArray(f.options)) {
      f.options = (f.options as Record<string, unknown>[]).map((o) =>
        o && typeof o === "object" ? { ...o, label: tr(o.label) } : o,
      );
    }
    if (f.arrayFields) f.arrayFields = localiseFields(f.arrayFields);
    if (f.objectFields) f.objectFields = localiseFields(f.objectFields);
    out[key] = f;
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────
   THE SAMPLE CONTENT FOLLOWS THE SYSTEM, NOT THE INTERFACE.

   Reported with a screenshot on 2026-08-25: an English system whose 加一段
   gallery offered 「本月新客户」 and 「工程进度」. Those are not Formae's words --
   they are the CUSTOMER'S content, the text that lands on their page when the
   block does, and their page speaks `projects.system_language`.

   So there are two projections over one Chinese config, keyed off two
   different settings, and keeping them apart is the whole of founder-points
   13: an owner reading the editor in English who runs a Chinese-language shop
   must get 「本月收款」 in the block; an owner reading it in Chinese who runs an
   English-language one must get "Paid this month". One setting for both would
   be the cross-language fallback that rule forbids.

   ONLY STRINGS WITH CJK IN THEM. `defaultProps` also carries ids, hrefs, icon
   names, colour tokens and variant keys -- `iconName: "person"`,
   `color: "var(--chart-1)"` -- and running those through a translation table
   is how a working block becomes a broken one. Every content string has a
   Chinese character in it and no structural one does.
   ───────────────────────────────────────────────────────────────────────── */

/** Two keys, because the two projections are independent: an owner can read
 *  the editor in one language and build a system in the other. */
const cache = new Map<string, Config>();

export function localisedPuckConfig(locale: string, systemLang: string = "en"): Config {
  const chromeEn = locale !== "zh";
  const contentEn = systemLang !== "zh";
  // Chinese on both sides is the config's own language: nothing to project.
  if (!chromeEn && !contentEn) return registerAwarePuckConfig;
  const key = `${chromeEn ? "en" : "zh"}:${contentEn ? "en" : "zh"}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const base = registerAwarePuckConfig as unknown as {
    components: Record<string, Record<string, unknown>>;
    categories?: Record<string, Record<string, unknown>>;
    root?: Record<string, unknown>;
  };

  const built = {
    ...registerAwarePuckConfig,
    components: Object.fromEntries(
      Object.entries(base.components).map(([name, c]) => [
        name,
        {
          ...c,
          label: chromeEn ? tr(c.label) : c.label,
          fields: chromeEn ? localiseFields(c.fields) : c.fields,
          defaultProps: sampleProps(c.defaultProps, contentEn ? "en" : "zh"),
        },
      ]),
    ),
    categories:
      base.categories && chromeEn
        ? Object.fromEntries(
            Object.entries(base.categories).map(([k, c]) => [k, { ...c, title: tr(c.title) }]),
          )
        : base.categories,
    root: base.root && chromeEn ? { ...base.root, label: tr(base.root.label) } : base.root,
  } as unknown as Config;

  cache.set(key, built);
  return built;
}

"use client";

import type { ReactElement } from "react";
import type { Config } from "@puckeditor/core";
import { puckConfig } from "@/design-system/editor/puck-config";
import { useRegisterVariant } from "@/design-system/editor/style-scope";

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
  return render(merged as never);
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

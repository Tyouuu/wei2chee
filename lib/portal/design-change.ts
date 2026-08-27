/**
 * 换风格 / 换配色 / 换排法 -- deciding which RPCs a design answer turns into.
 *
 * WHY THIS IS A FUNCTION AND NOT SIX LINES INSIDE THE ASSISTANT.
 *
 * The assistant's `design` reply has grown a field at a time -- style, then
 * palette, then arrangement -- and each time the handler that spends it was
 * edited by hand. `layout` was added to the prompt, to the JSON schema, to
 * validDesign and to the database, and the handler was not touched: the model
 * answered 「表格放前面」 correctly and the browser dropped it, then told the
 * owner it was done. Nothing failed, nothing logged, and the only way to see it
 * was to type the sentence and watch the page not move.
 *
 * A pure function turns that class of miss into a failing test: adding a field
 * to the reply without giving it an RPC here is now visible in one file, and
 * `design-change.test.ts` asserts that every field the route can return lands
 * somewhere.
 */

/** Exactly what validDesign in app/api/portal/edit/route.ts returns. A KEY THAT
 *  IS ABSENT means the owner did not ask about it; `palette: null` means they
 *  asked to take the palette off. Those are different requests. */
export type DesignChange = {
  style?: string;
  palette?: string | null;
  layout?: string;
};

export type DesignRpc =
  | {
      rpc: "set_project_style";
      args: { new_style: string; new_palette: string | null; clear_palette: boolean };
    }
  | { rpc: "set_project_layout"; args: { new_layout: string } };

/** Every field of the reply that must be spent somewhere below. Kept beside the
 *  planner so the test can walk it, rather than in the test where it would be a
 *  second copy that drifts. */
export const DESIGN_FIELDS = ["style", "palette", "layout"] as const;

export function planDesignChange(
  design: DesignChange | null | undefined,
  activeStyle: string,
): DesignRpc[] {
  if (!design) return [];
  const calls: DesignRpc[] = [];

  /*
    set_project_style has THREE states and the third one is the important one:
    clear_palette wipes the palette, a non-null new_palette sets it, and
    neither leaves it alone. 「换成台账」 must not take the colours the owner
    chose down with it, so a style-only answer has to reach that third state.
    Hence `!== undefined` rather than a truthiness test -- null here is a
    request, not a silence.
  */
  const wantsStyle = design.style !== undefined;
  const wantsPalette = design.palette !== undefined;
  if (wantsStyle || wantsPalette) {
    calls.push({
      rpc: "set_project_style",
      args: {
        // The RPC's first argument is NOT NULL, so a palette-only answer still
        // has to name the register the project is already wearing.
        new_style: design.style ?? activeStyle,
        new_palette: design.palette ?? null,
        clear_palette: design.palette === null,
      },
    });
  }

  // The arrangement is its own column with its own five-value CHECK
  // (20260825090000), so it is its own call rather than a sixth argument that
  // would need a second copy of that list.
  if (design.layout !== undefined) {
    calls.push({ rpc: "set_project_layout", args: { new_layout: design.layout } });
  }

  return calls;
}

import type { ReactNode } from "react";

/**
 * A marker around one piece of a block's text that says which field it is.
 *
 * The customer's own words — a page's title, a card's label, a table's heading
 * — are the thing they change most, and until now changing one of them cost
 * five steps: select the block, press 改文字, wait for the panel, find the right
 * box in it, type. Durable costs two: press the words, type. The founder's
 * comparison was 「我们:选中 → 改文字 → 面板 → 在面板里找到那一格 → 打字」.
 *
 * THIS COMPONENT DOES NOT DO THE EDITING. It renders a span with two data
 * attributes and nothing else — no context, no hooks, no Puck import. That is
 * deliberate: these render functions also run in the block palette's live
 * previews, in the component gallery, and (eventually) in whatever renders the
 * customer's real system, none of which are inside a Puck provider. A component
 * that called usePuck() here would throw in three places to save five steps in
 * one. inline-editing.tsx does all the work, from inside the editor, by finding
 * these attributes in the DOM.
 *
 * WHY A SPAN. It has to add a hit target without changing a layout: every one
 * of these sits inside an <h1>, a <div class="truncate"> or a table <th> whose
 * spacing is already settled. `display: inline` inherits everything and adds
 * nothing. The editor gives it a hover treatment through puck-theme.css, scoped
 * under `.portal-editor-scope`, so outside the editor it is invisible.
 */
export function Inline({
  id,
  field,
  children,
}: {
  /** The block's Puck id, from the render function's own props. Undefined
   *  outside the editor — a preview, a gallery tile — where it renders bare. */
  id?: string;
  /** The prop name on that block, e.g. "heading". Must match puck-config. */
  field: string;
  children: ReactNode;
}) {
  if (!id) return <>{children}</>;
  return (
    <span data-inline-id={id} data-inline-field={field}>
      {children}
    </span>
  );
}

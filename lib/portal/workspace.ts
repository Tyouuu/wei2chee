import { redirect } from "next/navigation";
import {
  createSessionSupabaseClient,
  getSessionUser,
} from "@/lib/supabase/server-session";
import { MODULE_BY_KEY } from "@/lib/portal/module-catalog";

/**
 * Which business is this person standing in, and as what.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 *
 * Thirteen files used to answer that question themselves, all the same way:
 * `.from("projects").eq("account_id", user.id)`. Every one of them means
 * 「the project I OWN」, and after 20260901010000 that is no longer the same
 * question -- a site supervisor owns an empty shell project the signup trigger
 * made for him, and works in somebody else's.
 *
 * Left as it was, an invited supervisor would log in, land in his own empty
 * shell, and never see the business he was just given the right to work in.
 * That is this repository's signature defect (「能力有、线没接」), which has
 * shipped fifteen times. The rule therefore lives in ONE place, and that place
 * is the database -- `my_workspace()` -- with this file as its only reader.
 *
 * ── AND THE SECOND HALF, WHICH IS THE POINT OF THE ROLE ───────────────────
 *
 * 「谁看得到钱」 is enforced by RLS: `ledger_entries` asks `sees_money()`, so a
 * supervisor opening 收款 would get a page that renders correctly and is empty.
 * Empty is worse than absent -- it reads as 「the boss has taken no money」
 * rather than 「this is not yours to see」. So the money pages are removed from
 * his rail and refused at their own route, and the database stays the thing
 * that actually enforces it.
 */

export type WorkspaceRole = "owner" | "staff";

export type Workspace = {
  projectId: string;
  role: WorkspaceRole;
  /** Owners see the money, the editor, the libraries and the handoff. */
  isOwner: boolean;
};

/**
 * Resolve it, or leave. Returns null only when the caller is a founder with no
 * project -- the layout decides where those go, because it is the only caller
 * that has somewhere else to send them.
 */
export async function loadWorkspace(): Promise<Workspace | null> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createSessionSupabaseClient();
  const { data } = await supabase.rpc("my_workspace");
  const row = (data as { project_id: string; role: string }[] | null)?.[0];
  if (!row?.project_id) return null;

  const role: WorkspaceRole = row.role === "staff" ? "staff" : "owner";
  return { projectId: row.project_id, role, isOwner: role === "owner" };
}

/**
 * Can this person open this module page?
 *
 * ⚠️ Keyed off the module's SHAPE rather than a list of page keys, for the same
 * reason `sees_money()` is one function: 佣金 was added to the ledger shape
 * after 收款 and 开销 were, and a hand-written key list would have let it
 * through. A new money module is covered the day it is catalogued.
 */
export function canOpenModule(role: WorkspaceRole, pageKey: string): boolean {
  if (role === "owner") return true;
  return MODULE_BY_KEY[pageKey]?.shape !== "ledger";
}

/**
 * Take the money pages out of the rail that is drawn INSIDE the customer's own
 * system page.
 *
 * ── WHY THIS IS SEPARATE FROM THE SHELL'S FILTER ──────────────────────────
 *
 * There are two rails on the screen and they come from different places. The
 * dark one on the left is Formae's, built in the layout from `pageRefs`. The
 * one inside the canvas is the CUSTOMER'S system -- a `RailNav` block whose
 * items were frozen into the page's saved props the day he saved it.
 *
 * Filtering only the first would leave a supervisor looking at a 收款 row he
 * can see, click, and be refused by. A dead link is not a permission failure,
 * but it is the product telling him something exists for him when it does not.
 *
 * ⚠️ Presentation only. The refusal is `sees_money()` in the database and the
 * route's own check; this just stops offering the door.
 */
export function hideMoneyFromRail<T>(tree: T, role: WorkspaceRole): T {
  if (role === "owner") return tree;

  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const obj = node as Record<string, unknown>;

    if (obj.type === "RailNav" && obj.props && typeof obj.props === "object") {
      const props = obj.props as Record<string, unknown>;
      const items = Array.isArray(props.items) ? props.items : null;
      if (items) {
        return {
          ...obj,
          props: {
            ...props,
            items: items.filter((item) => {
              const href = (item as { href?: string })?.href;
              if (typeof href !== "string") return true;
              /* The page key is the last segment of /<locale>/portal/<key>.
                 Read off the href rather than carried alongside it, because
                 the href is the thing that would actually be followed. */
              const key = href.split("/").filter(Boolean).pop() ?? "";
              return canOpenModule(role, key);
            }),
          },
        };
      }
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = walk(v);
    return out;
  };

  return walk(tree) as T;
}

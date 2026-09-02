import { z } from "zod";
import { puckConfig } from "@/design-system/editor/puck-config";
import { heroDeadFields } from "@/design-system/components/site-hero";
import { VARIANTS, activeVariant } from "@/design-system/editor/variants";
// Straight from the generated data module, not through components/blocks --
// the barrel imports 250 client components, and this file runs on the server.
import { BLOCK_COPY } from "@/components/blocks/copy.generated";
import {
  COLUMN_KINDS,
  KIND_LABELS,
  blankRow,
  newColumnKey,
  normalizeTable,
  upgradeRecordTableProps,
  type TableModel,
} from "./table-model";

/**
 * The edit language an LLM is allowed to speak when a customer asks for a
 * change in plain Chinese ("加一个记录客人生日的地方", "把'客户'改成'病人'").
 *
 * WHY OPERATIONS AND NOT LAYOUT JSON
 *
 * The obvious design -- hand the model the page's Puck JSON and ask for the
 * edited JSON back -- is the one that cannot be made reliable. A single
 * hallucinated component name, a dropped `id`, or a truncated response is not a
 * slightly-wrong page: it is a blank editor for someone who was mid-sentence
 * describing their business. And the failure is silent, because malformed
 * layout JSON still parses as JSON.
 *
 * So the model never writes layout. It emits a short list of OPERATIONS against
 * a strict schema, and this module applies them deterministically. Three things
 * follow from that, all of which matter more than the elegance of the approach:
 *
 *   - every component name the model can utter is an enum drawn from the live
 *     registry, so "add a calendar widget" cannot invent `CalendarWidget`
 *   - every target id is checked against the ids actually on the page, so an
 *     operation aimed at something that does not exist is dropped, not applied
 *     to the wrong thing
 *   - a partial failure is partial: four good operations still land when the
 *     fifth is nonsense, and the customer is told exactly what was skipped
 *
 * This is the same principle lib/templates/industry-template.ts is built on --
 * the model decides, code executes -- applied to the editing half of the
 * product rather than the generation half.
 */

/** Every component the editor actually has. The single source of truth for
 *  what the model is permitted to name.
 *
 *  Widened to a plain string-keyed record: `puckConfig.components` is typed as
 *  an exact object literal (one key per registered component), which is right
 *  for the editor but cannot be indexed by a runtime string like a component
 *  name that arrived from a model. Every such lookup here is already guarded by
 *  a REGISTERED_COMPONENTS membership check or a null test. */
const COMPONENT_CONFIGS = puckConfig.components as Record<
  string,
  {
    label?: string;
    defaultProps?: Record<string, unknown>;
    fields?: Record<string, { type?: string }>;
  }
>;

export const REGISTERED_COMPONENTS = Object.keys(COMPONENT_CONFIGS);

/**
 * Blocks with a picture slot of their own, read off the config.
 *
 * The assistant could not reach a photo at all: the picker exists, it uploads
 * to the customer's own storage, and it even knows this trade's search words --
 * but nothing in the prompt said which blocks have somewhere to put a picture,
 * so 「第一屏换一张工地的照片」 had no answer.
 *
 * Derived rather than listed for the reason this repo has now paid for five
 * times in one day: a block gains or loses a photo field and a hand-written
 * list goes on describing the old shape, silently.
 *
 * Only top-level `photo` fields. SiteTeam holds one per person inside an array
 * and pointing the customer at the block would not tell them WHICH person's
 * picture is being changed -- that one is a job for the fields panel, not for
 * a sentence.
 */
export const PHOTO_BLOCKS = Object.entries(COMPONENT_CONFIGS)
  .filter(([, cfg]) => {
    const fields = (cfg as { fields?: Record<string, unknown> })?.fields;
    return fields ? Object.prototype.hasOwnProperty.call(fields, "photo") : false;
  })
  .map(([name]) => name);

const STATUS_TONES = ["positive", "warning", "negative", "neutral"] as const;

/** Text-ish fields an edit is allowed to rewrite. Deliberately a fixed list:
 *  it keeps the model away from structural props (`gridId`, `href`, `name`)
 *  where a plausible-looking string quietly breaks behaviour instead of
 *  changing wording. */
/**
 * WHICH WORDS THE ASSISTANT MAY REWRITE, READ OFF THE BLOCKS THEMSELVES.
 *
 * ── WHY THIS IS DERIVED ───────────────────────────────────────────────────
 *
 * This was a HAND-WRITTEN LIST of eleven names, and the fields it was supposed
 * to describe are declared per component. Measured 2026-08-27: **31 components
 * had text a customer can see and NOT ONE FIELD the assistant could name** --
 * including `EnquiryForm`, the only block on the public site that produces
 * money, and almost the whole of that site (`SiteBar`, `SiteCta`, `SiteFoot`,
 * `SiteFeatures`, `SiteGallery`, `SiteTestimonials`, `SiteStatement`).
 *
 * The product's promise is 「用讲的改」. On those blocks, talking did nothing.
 *
 * It looked like it worked, which is why it lasted: with no legal field for
 * 「把第一屏那句大标题改成…」 the model reached for `title`, the applier wrote a
 * prop `SiteHero` does not declare, and the reply said 「改了 1 处」. The list
 * being wrong and the edit reporting success were the same bug wearing two
 * faces.
 *
 * So the list is no longer written down. It is read off the component
 * registry, which is the thing it was always trying to describe -- the same
 * cure this repo has reached five times now for the same disease.
 */

/**
 * A text input that is NOT a word anybody reads.
 *
 * The one judgement call in the derivation, so it is a named predicate rather
 * than a filter buried in a chain: a link target, an image path, a QR payload,
 * a DOM id, a file-type filter and a date are all typed into a text box and
 * none of them is prose. Letting the assistant rewrite `primaryHref` because
 * the owner said 「按钮改成联络我们」 breaks the button.
 */
const NOT_PROSE = (name: string): boolean =>
  /Href$|Src$/.test(name) ||
  ["href", "src", "data", "gridId", "accept", "start", "end"].includes(name);

/** Every prose field each component actually declares. The per-block answer,
 *  which is what `set_text` is checked against -- one global list cannot say
 *  that `headline` belongs to SiteHero and `heading` to EnquiryForm. */
/**
 * The fields on THIS node, in the shape it is actually in.
 *
 * TEXT_FIELDS_BY_COMPONENT answers 「what can a SiteHero be told?」. It cannot
 * answer 「what can THIS SiteHero be told?」, and the difference is a whole
 * class of 「说了没做」: on three of its layouts the first screen's big line is
 * the business name and `headline` has no slot, so an edit lands in props,
 * reports 「改了 1 处」, and the page does not move. `eval:browser` caught
 * exactly that on 2026-08-31 — the twelfth of these.
 *
 * The component owns the fact (`heroDeadFields`) because the component owns the
 * markup, and a test renders every layout to keep the two honest. Anything else
 * here is a second copy of a truth that lives elsewhere, which is how the last
 * six of these were built.
 */
export function proseFieldsOn(node: { type?: unknown; props?: Record<string, unknown> }): string[] {
  const type = String(node.type ?? "");
  const all = TEXT_FIELDS_BY_COMPONENT[type] ?? [];
  if (type !== "SiteHero") return all;
  const dead = new Set(
    heroDeadFields({
      layout: typeof node.props?.layout === "string" ? node.props.layout : null,
      photo: typeof node.props?.photo === "string" ? node.props.photo : null,
    }),
  );
  return all.filter((f) => !dead.has(f));
}

export const TEXT_FIELDS_BY_COMPONENT: Record<string, string[]> = Object.fromEntries(
  Object.entries(COMPONENT_CONFIGS).map(([name, cfg]) => [
    name,
    Object.entries(cfg?.fields ?? {})
      .filter(
        ([k, f]) =>
          ((f as { type?: string } | undefined)?.type === "text" ||
            (f as { type?: string } | undefined)?.type === "textarea") &&
          !NOT_PROSE(k),
      )
      .map(([k]) => k),
  ]),
);

/** The union, for the schema. A name the model may legally say; WHICH block it
 *  may say it about is decided by TEXT_FIELDS_BY_COMPONENT when the operation
 *  is applied. */
export const EDITABLE_TEXT_FIELDS = [
  ...new Set(Object.values(TEXT_FIELDS_BY_COMPONENT).flat()),
].sort() as unknown as readonly [string, ...string[]];

export const layoutOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("set_text"),
    target_id: z.string().min(1),
    field: z.enum(EDITABLE_TEXT_FIELDS),
    /*
      EMPTY IS ALLOWED, and it was `min(1)`.

      Measured by scripts/eval-editor.mjs: 「打开来第一眼太多字了，看不到重点」
      made the model emit set_text with an empty value four times out of six --
      it wanted to CLEAR the subtitle, which is exactly what was asked for and
      exactly what the owner can already do by hand in the side panel. The AI
      has no business being more restricted than the field it is driving.

      It was also worse than a refusal: the whole response failed validation,
      so every OTHER operation in the same batch died with it and the endpoint
      answered 502. See parseLayoutOps below for that half.
    */
    value: z.string(),
  }),
  z.object({
    op: z.literal("add_component"),
    component: z.string().min(1),
    /** Placed after this id, or at the end of the main column when omitted. */
    after_id: z.string().nullable(),
    title: z.string().nullable(),
  }),
  z.object({
    op: z.literal("remove_component"),
    target_id: z.string().min(1),
  }),
  /*
    THE OPERATION THAT WAS MISSING, AND IT IS THE FIRST THING ANYONE ASKS FOR.

    The founder's direction, 2026-08-26: 「很方便可以調整完一切的東西 用Ai Agent
    的輔助」. Audited against it, the assistant had ten operations and not one of
    them moved anything. It could add a block and delete a block, so 「把表格搬到
    上面」 was answerable only as delete-then-add -- which loses every edit the
    customer had already made to that block, silently, and reads to them as the
    assistant destroying their work.

    `before_id` rather than an index. An index is a number the model has to
    count to, and it counts from a list it was shown a moment ago that may have
    changed; an id is a thing it can see. Null means the end of the column,
    which is the same convention `add_component` already uses.
  */
  z.object({
    op: z.literal("move_component"),
    target_id: z.string().min(1),
    /** Placed immediately BEFORE this id. Null puts it last. */
    before_id: z.string().nullable(),
  }),
  // Cells are positional, aligned to the column list the model is shown, rather
  // than a fixed primary/secondary/amount/status quartet -- a table can now have
  // any columns at all, so there is no fixed set of names to key them by.
  // Everything is nullable and back-filled on apply: a model that omits one cell
  // should produce a row with one blank cell, not a 502 that loses the other
  // eleven operations in the same response.
  z.object({
    op: z.literal("add_table_row"),
    target_id: z.string().min(1),
    cells: z.array(z.string()).max(8).nullable(),
    status_tone: z.enum(STATUS_TONES).nullable(),
  }),
  // THE THREE OPERATIONS THIS PRODUCT WAS MISSING. Until columns became an
  // array (lib/portal/table-model.ts) the assistant had to answer「表格加一列
  // 负责的师傅」with「现有操作不支持」-- not because the model was weak but
  // because the component could not represent the result. These are what make
  // "tell it what you want and the system changes" true of the most-used
  // component in the product.
  z.object({
    op: z.literal("add_table_column"),
    target_id: z.string().min(1),
    column_label: z.string().min(1).max(16),
    column_kind: z.enum(COLUMN_KINDS).nullable(),
  }),
  z.object({
    op: z.literal("remove_table_column"),
    target_id: z.string().min(1),
    column_key: z.string().min(1),
  }),
  z.object({
    op: z.literal("set_table_column"),
    target_id: z.string().min(1),
    column_key: z.string().min(1),
    column_label: z.string().min(1).max(16),
    column_kind: z.enum(COLUMN_KINDS).nullable(),
  }),
  z.object({
    op: z.literal("set_workflow"),
    target_id: z.string().min(1),
    stages: z.array(z.string().min(1)).min(2).max(6),
  }),
  // 换个款式, spoken. The variant ids are listed per block in describeLayout,
  // so the model picks from what that block actually offers rather than
  // guessing a name.
  z.object({
    op: z.literal("set_variant"),
    target_id: z.string().min(1),
    variant_id: z.string().min(1),
  }),
  // ── THE WORDS INSIDE A PULLED SECTION ─────────────────────────────────────
  //
  // `set_text` writes ONE named prop from a fixed whitelist, which is right for
  // this repo's own blocks: 官网大标题 has `headline`, `sub`, `primaryLabel`.
  // The 216 sections pulled from @7Ovr do not work that way. Their words are an
  // object -- `tiers`, `faqs`, `stats` -- lifted out of the file on 2026-08-23
  // so that they COULD be reached at all. Before that, selecting one and
  // pressing 改文字 opened a panel with a single dropdown and no text field
  // anywhere: the AI was working, the block had nothing to write into.
  //
  // A PATH rather than a field name, because that is the shape of the thing:
  // `tiers.0.name`, `faqs.2.a`. The field whitelist that guards `set_text`
  // cannot apply -- the keys belong to whichever section was pulled -- so the
  // guard here is different and stricter: it only ever writes into `copy`, it
  // only ever writes a STRING, and it refuses to create a key that the
  // section's own defaults do not already have. A hallucinated path changes
  // nothing instead of adding a field nothing renders.
  z.object({
    op: z.literal("set_copy"),
    target_id: z.string().min(1),
    /** Dot path inside the section's own copy object: `tiers.0.name`. */
    path: z.string().min(1),
    value: z.string().min(1),
  }),
]);

export type LayoutOp = z.infer<typeof layoutOpSchema>;

/**
 * A page-level change the assistant is offering to make, but has not made.
 *
 * WHY AN OFFER AND NOT AN OPERATION. Everything in `layoutOpSchema` edits the
 * page in front of the customer and persists NOTHING -- the result goes into
 * Puck's state exactly as a drag would, which is what keeps the paid gate on
 * `save_project_page` meaningful and lets any AI edit be undone with the same
 * button as everything else. Adding or removing a page is a database write
 * (`add_project_page`), so routing it through the same channel would either
 * break that contract or hide an unpaid write behind a chat box.
 *
 * So the assistant answers「帮我加一个员工排班的页面」with a button instead of a
 * refusal. The customer presses it, the RPC runs with their own credentials,
 * and the write is theirs. This is the same division Durable settled on: the
 * conversation proposes structure, the customer confirms it.
 */
export const pageSuggestionSchema = z.object({
  /*
    `pick_photo` is an OFFER, not an operation, and deliberately so.

    A picture is the one thing on the page that has to be chosen by eye --
    「审美这种东西都是用看的」. An assistant that searches stock and drops a
    result in has picked for him, and nine times in ten he changes it. What it
    can do is take him to the slot with the right search already loaded, which
    is one press away from the picture he actually wants.
  */
  action: z.enum(["add_page", "remove_page", "pick_photo", "none"]),
  /** The customer's own name for a new page. */
  page_title: z.string().max(24).nullable(),
  /** A built-in type for `add_page` (so it arrives with real sample data), or
   *  the key of an existing page for `remove_page`. Validated against reality
   *  in the route -- the model is never trusted with a key. */
  page_key: z.string().max(64).nullable(),
  /** `pick_photo` only: the id of the block whose picture slot to open. */
  block_id: z.string().max(64).nullable().optional(),
});

export type PageSuggestion = z.infer<typeof pageSuggestionSchema>;

/**
 * Every operation the schema will accept, read off the schema.
 *
 * There is no `default:` in applyLayoutOps' switch, so an operation added to
 * the union and not to the switch does NOTHING -- it is not applied, it is not
 * refused, it does not appear in `skipped`, and the assistant reports success
 * over a page that did not move. That is the shape of nine of the eleven
 * 「说了没做」 bugs in this repo: a capability declared in one place and never
 * consumed in the next.
 *
 * Derived so the guard in layout-ops.test.ts cannot go stale the way a second
 * hand-written list would.
 */
export const LAYOUT_OP_NAMES: string[] = layoutOpSchema.options.map(
  (o) => (o.shape.op as unknown as { value: string }).value,
);

export const layoutOpsSchema = z.object({
  operations: z.array(layoutOpSchema).max(12),
  /** One sentence, in the customer's language, describing what was done. Shown
   *  back to them so an edit is never silent. */
  explanation: z.string(),
  suggestion: pageSuggestionSchema.nullable().optional(),
});

/**
 * The model's answer, with unusable operations set aside instead of thrown.
 *
 * `layoutOpsSchema.parse` is all-or-nothing: one operation that does not fit
 * the schema rejects the whole object, so a batch of five good edits and one
 * malformed one produced a 502 and the customer saw 「改不动」 with nothing
 * changed. Measured at four failures in six runs on a single ordinary sentence
 * before `set_text` stopped requiring a non-empty value -- and that fix removes
 * one cause, not the class.
 *
 * This is the same rule applyLayoutOps already lives by, moved one step
 * earlier: an operation that cannot be carried out is reported with a reason,
 * and the ones that can are still carried out. The customer gets four of their
 * five edits and a line saying what the fifth was.
 */
export function parseLayoutOps(raw: unknown): {
  operations: LayoutOp[];
  explanation: string;
  suggestion?: PageSuggestion | null;
  /** 风格 / 配色 / 排法 -- not layout, so it passes through untouched and the
   *  route validates it against the lists the product renders from. */
  design?: unknown;
  rejected: { op: string; reason: string }[];
} {
  const outer = z
    .object({
      // Parsed loosely here so a single bad member cannot reject the array.
      operations: z.array(z.unknown()).max(12).optional(),
      explanation: z.string().optional(),
      suggestion: pageSuggestionSchema.nullable().optional(),
      design: z.unknown().optional(),
    })
    .parse(raw);

  const operations: LayoutOp[] = [];
  const rejected: { op: string; reason: string }[] = [];
  for (const candidate of outer.operations ?? []) {
    const one = layoutOpSchema.safeParse(candidate);
    if (one.success) {
      operations.push(one.data);
      continue;
    }
    const name =
      typeof candidate === "object" && candidate !== null && "op" in candidate
        ? String((candidate as { op: unknown }).op)
        : "?";
    // The first issue only. A customer reads one reason; a Zod tree is for us.
    const issue = one.error.issues[0];
    rejected.push({
      op: name,
      reason: issue ? `${issue.path.join(".") || "?"}: ${issue.message}` : "格式不对",
    });
  }

  return {
    operations,
    explanation: outer.explanation ?? "",
    suggestion: outer.suggestion ?? null,
    design: outer.design,
    rejected,
  };
}

export type PuckNode = { type: string; props: Record<string, unknown> };
export type PuckLayout = { root: Record<string, unknown>; content: PuckNode[] };

/**
 * Which props of a component hold other components, READ OFF THE CONFIG.
 *
 * This used to be the literal `["sidebar", "main"]` -- SystemShell's two slots,
 * correct on the day it was written and wrong the moment anything else nested.
 * On 2026-08-25 the dashboard started wrapping its blocks in `Panel` (slot
 * `body`) and putting pairs side by side in `Columns` (slots `a`/`b`/`c`), and
 * every one of those blocks went INVISIBLE to this file: `describeLayout` gave
 * the model a page whose table, workflow and ranking did not exist, and
 * `applyLayoutOps` could not target them. Ten tests caught it; nothing on
 * screen would have.
 *
 * Deriving it from the config means a component is walkable BY BEING
 * REGISTERED. The same argument as puck-config-client.tsx: a list maintained
 * by hand beside a list that grows is a list that is already wrong.
 */
const SLOT_KEYS: string[] = Array.from(
  new Set(
    Object.values(COMPONENT_CONFIGS).flatMap((c) =>
      Object.entries(c.fields ?? {})
        .filter(([, f]) => f?.type === "slot")
        .map(([k]) => k),
    ),
  ),
);

/** Every node on the page, including the ones inside any component's slots. */
/** Puck's own name for the top level, `rootAreaId:rootZone` in 0.23.0. Not
 *  exported by the package; the same constant is read in inline-editing.tsx. */
export const ROOT_ZONE = "root:default-zone";

/**
 * Where a block sits, in the shape Puck's `setUi` wants.
 *
 * Needed because an offer to open a picture slot has to SELECT that block --
 * the photo field lives in the fields panel, and the panel shows whatever is
 * selected. A zone is `parentId:propName`, Puck's `zoneCompound` convention.
 *
 * Returns null rather than guessing at the root: selecting the wrong block
 * would open the wrong panel, and the customer would replace a picture he
 * never meant to touch.
 */
export function findSelector(
  nodes: PuckNode[],
  id: string,
  zone: string = ROOT_ZONE,
): { index: number; zone: string } | null {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (String(n.props?.id ?? "") === id) return { index: i, zone };
    for (const k of SLOT_KEYS) {
      const kids = n.props?.[k];
      if (Array.isArray(kids)) {
        const hit = findSelector(kids as PuckNode[], id, `${String(n.props?.id ?? "")}:${k}`);
        if (hit) return hit;
      }
    }
  }
  return null;
}

/**
 * The array a block actually lives in, and where in it.
 *
 * `mainColumn` only ever sees the shell's top level, and blocks stopped being
 * top-level on 2026-08-25 when the dashboard began wrapping them in `Panel`
 * (slot `body`) and pairing them inside `Columns`. So on most registers the
 * block the customer names is one or two levels down, and a search that only
 * looks at the top returns -1 for it.
 *
 * That -1 was being read as "no target given" and the block was pushed to the
 * end -- 「把表格搬到收款进度上面」 answered 「已把表格移到上面了」 while the table
 * travelled to the bottom of the page. Not a missed edit, a wrong one,
 * reported as done.
 */
function findHome(nodes: PuckNode[], id: string): { arr: PuckNode[]; index: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (String(n.props?.id ?? "") === id) return { arr: nodes, index: i };
    for (const k of SLOT_KEYS) {
      const kids = n.props?.[k];
      if (Array.isArray(kids)) {
        const hit = findHome(kids as PuckNode[], id);
        if (hit) return hit;
      }
    }
  }
  return null;
}

export function walkNodes(nodes: PuckNode[]): PuckNode[] {
  return nodes.flatMap((n) => [
    n,
    ...SLOT_KEYS.flatMap((k) =>
      Array.isArray(n.props?.[k]) ? walkNodes(n.props[k] as PuckNode[]) : [],
    ),
  ]);
}

/**
 * The compact description of the page handed to the model.
 *
 * Not the raw layout: sending the full JSON would spend most of the context on
 * ids, hrefs and sample rows the model must not touch anyway, and every extra
 * field is one more thing for it to "helpfully" rewrite. This is the smallest
 * description that still lets it target the right block.
 */
/**
 * @param selected  The block the owner has open in the panel, if any. Marked in
 *   the listing rather than described separately, because 「短一点」 and 「拿掉」
 *   are sentences ABOUT that block and the model reads them next to it.
 */
/** Whether this page actually contains that block. Used to check a selection
 *  the browser sent before repeating it back to the model -- see the route. */
export function hasBlock(layout: PuckLayout, id: string): boolean {
  return walkNodes(layout.content ?? []).some((n) => String(n.props?.id ?? "") === id);
}

export function describeLayout(layout: PuckLayout, selected?: string | null): string {
  return walkNodes(layout.content ?? [])
    .map((n) => {
      const id = String(n.props?.id ?? "");
      const here = selected && id === selected ? "  ← 他现在点开的就是这一块" : "";
      const label = COMPONENT_CONFIGS[n.type]?.label ?? n.type;
      /*
        THIS BLOCK'S OWN FIELDS, NOT THE WHOLE LIBRARY'S.

        Read from the global union, this showed nothing for the 31 components
        whose text fields were not on the hand-written list -- so the public
        site's headline, and every word of the enquiry form, were invisible to
        the model, and 「把第一屏那句大标题改成…」 had nothing to aim at.

        Per component it is also SHORTER: a block has three or four fields, not
        sixty. The model no longer has to guess which of `title` / `heading` /
        `headline` this particular block calls it -- guessing is exactly what
        produced an edit onto a prop SiteHero does not declare.
      */
      const mine = proseFieldsOn(n);
      const texts = mine
        .filter((f) => typeof n.props?.[f] === "string" && n.props[f])
        .map((f) => `${f}="${n.props[f]}"`)
        .join(" ");

      /* The fields it HAS but has not filled. Without this 「这里加一句说明」 can
         only be answered by adding a block, because an empty `note` looks from
         here exactly like a block that has no note at all. */
      const blank = mine.filter((f) => !n.props?.[f]);
      const spare = blank.length ? ` 还可以填=[${blank.join(",")}]` : "";

      /*
        A PICTURE SLOT, AND WHETHER IT IS EMPTY.

        Without this the model cannot answer 「第一屏换一张工地的照片」 -- it has
        no way to know this block takes a picture, let alone that the customer
        has not put one in yet. Empty is the interesting state: it is the gap
        the founder keeps pointing at (「三个空的『Add a photo』灰盒子」), and it
        is what makes an offer worth making rather than noise.
      */
      const photo = PHOTO_BLOCKS.includes(n.type)
        ? typeof n.props?.photo === "string" && n.props.photo
          ? " photo=有"
          : " photo=还没放"
        : "";

      // A table's columns have to be listed, or the model cannot target one:
      // `column_key` is a stable identifier ("primary", "c3") that appears
      // nowhere on screen, so it can only come from here. Listed in display
      // order, which is also the order `add_table_row`'s cells are read in.
      // Which 款式 this block is on, and what else it could be. Without this
      // the model can be told the customer is on Docket and still have no name
      // to put in a set_variant -- and no way to notice a block is already
      // where it should be.
      let variants = "";
      const list = VARIANTS[n.type];
      if (list?.length) {
        const defaults = COMPONENT_CONFIGS[n.type]?.defaultProps ?? {};
        const now = activeVariant(n.type, n.props ?? {}, defaults);
        variants =
          ` variant=${now?.id ?? "?"} options=[${list.map((v) => `${v.id}:"${v.label}"`).join(" ")}]`;
      }

      let extra = "";
      // A pulled section's words are an object, not props, so the model has no
      // way to name one unless the paths are listed. Without this it can be
      // told to change the price list and have nothing to aim at -- the same
      // failure `columns=[...]` exists to prevent for tables.
      //
      // Only STRING leaves, because only strings are writable, and capped
      // because a section with a forty-row comparison table would otherwise
      // fill the whole prompt on its own.
      if (n.type === "SiteBlock") {
        const block = typeof n.props?.block === "string" ? n.props.block : null;
        const defaults = block ? BLOCK_COPY[block] : undefined;
        if (defaults) {
          const paths: string[] = [];
          const walk = (value: unknown, prefix: string) => {
            if (paths.length >= 40) return;
            if (typeof value === "string") {
              paths.push(`${prefix}="${value.length > 48 ? value.slice(0, 48) + "…" : value}"`);
              return;
            }
            if (Array.isArray(value)) {
              value.forEach((v, i) => walk(v, `${prefix}${prefix ? "." : ""}${i}`));
              return;
            }
            if (value && typeof value === "object") {
              for (const [k, v] of Object.entries(value)) {
                walk(v, `${prefix}${prefix ? "." : ""}${k}`);
              }
            }
          };
          // What is on the page: the customer's overrides over the defaults.
          walk({ ...defaults, ...((n.props?.copy ?? {}) as object) }, "");
          extra = ` section=${block} words=[${paths.join(" ")}]`;
        }
      }
      if (n.type === "RecordTable") {
        const cols = normalizeTable(n.props ?? {})
          .columns.map((c) => `${c.key}:"${c.label}"(${KIND_LABELS[c.kind]})`)
          .join(" ");
        extra = ` columns=[${cols}]`;
      }

      return `- id=${id} type=${n.type} (${label})${texts ? " " + texts : ""}${spare}${photo}${variants}${extra}${here}`;
    })
    .join("\n");
}

/** Deep clone that survives the plain-JSON shape a Puck layout always has. */
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function findNode(nodes: PuckNode[], id: string): PuckNode | null {
  for (const n of nodes) {
    if (String(n.props?.id) === id) return n;
    for (const k of SLOT_KEYS) {
      if (Array.isArray(n.props?.[k])) {
        const hit = findNode(n.props[k] as PuckNode[], id);
        if (hit) return hit;
      }
    }
  }
  return null;
}

/** Removes by id, wherever it lives. Returns true if something was removed. */
function removeNode(nodes: PuckNode[], id: string): boolean {
  const i = nodes.findIndex((n) => String(n.props?.id) === id);
  if (i !== -1) {
    nodes.splice(i, 1);
    return true;
  }
  for (const n of nodes) {
    for (const k of SLOT_KEYS) {
      if (Array.isArray(n.props?.[k]) && removeNode(n.props[k] as PuckNode[], id)) return true;
    }
  }
  return false;
}

/**
 * The live `{columns, rows}` of a RecordTable, or null if the id is not one.
 *
 * Upgrades the node's props as a side effect, so an operation aimed at a table
 * still saved in the legacy four-prop shape works on the same data the editor
 * shows -- and hands back the SAME object that now sits in `props.table`, so
 * the caller mutates the layout by mutating what it is given.
 */
/**
 * The column keys of one table, in the order the model was shown them -- which
 * is the order `add_table_row`'s cells are read in.
 *
 * Exported because a row is written in TWO places now: into the page, here,
 * and into the customer's own table, in lib/portal/record-ops.ts. The second
 * one has to know which key each cell belongs to, because a key that is not
 * one of the built-in four is the owner's own column and its value belongs in
 * `extra` rather than nowhere. A second copy of 「which columns does this
 * table have」 is the shape of mistake this repo has made four times.
 */
export function tableColumnKeys(layout: PuckLayout, id: string): string[] | null {
  const table = tableOf(layout, id);
  return table ? table.columns.map((c) => c.key) : null;
}

/**
 * The record table on this page, wherever it is in the tree.
 *
 * For the form behind 「加一单」: its inputs are this table's OWN columns, so a
 * business that added 「车牌号」 gets a box for it without anyone writing that
 * business a form. A page with no record table has no form, which is correct
 * -- there is nothing on it to add a row to.
 *
 * Recurses into slots for the reason live-rows.ts records at length: a
 * generated page is one SystemShell whose `main` prop holds the blocks, and a
 * projection that only walks `content` finds nothing on any real page.
 */
export function firstRecordTable(layout: PuckLayout): TableModel | null {
  const find = (nodes: PuckNode[] | undefined): TableModel | null => {
    for (const n of nodes ?? []) {
      if (!n || typeof n !== "object") continue;
      if (n.type === "RecordTable") {
        n.props = upgradeRecordTableProps(n.props);
        return n.props.table as TableModel;
      }
      for (const value of Object.values(n.props ?? {})) {
        if (Array.isArray(value) && value.some((v) => v && typeof v === "object" && "type" in (v as object))) {
          const hit = find(value as PuckNode[]);
          if (hit) return hit;
        }
      }
    }
    return null;
  };
  return find(layout.content);
}

function tableOf(layout: PuckLayout, id: string): TableModel | null {
  const node = findNode(layout.content, id);
  if (!node || node.type !== "RecordTable") return null;
  node.props = upgradeRecordTableProps(node.props);
  return node.props.table as TableModel;
}

/** The list a new block should join: the shell's main column when there is a
 *  shell, otherwise the top level. Never the sidebar -- "add a table" meaning
 *  "put a table in the nav rail" is never what was asked. */
/** The column a page's blocks live in. Exported because relayout.ts needs the
 *  same answer, and a second copy of 「where the blocks are」 is the shape of
 *  mistake this repo has made four times. */
export function mainColumn(layout: PuckLayout): PuckNode[] {
  const shell = layout.content?.find((n) => n.type === "SystemShell");
  if (shell && Array.isArray(shell.props?.main)) return shell.props.main as PuckNode[];
  return layout.content;
}

export type ApplyResult = {
  layout: PuckLayout;
  applied: number;
  /** Operations that could not be applied, each with a plain reason. Surfaced
   *  to the customer rather than swallowed: an edit that silently does nothing
   *  is worse than one that says what it could not do. */
  skipped: { op: string; reason: string }[];
};

export function applyLayoutOps(
  input: PuckLayout,
  ops: LayoutOp[],
  /** Which 款式 a newly added block of each type should arrive on, from the
   *  customer's 版式. Omitted in tests and anywhere without a project, where
   *  the component's own defaults are the right answer. */
  prefer?: Record<string, string>,
): ApplyResult {
  const layout = clone(input);
  const skipped: ApplyResult["skipped"] = [];
  let applied = 0;

  // Suffixed so a block added twice in one conversation cannot collide with
  // an existing id -- Puck uses id for selection and undo, and a duplicate
  // makes the editor select the wrong thing.
  let added = 0;
  const newId = (type: string) => `ai-${type.toLowerCase()}-${Date.now()}-${added++}`;

  for (const op of ops) {
    switch (op.op) {
      case "set_text": {
        const node = findNode(layout.content, op.target_id);
        if (!node) {
          skipped.push({ op: op.op, reason: `找不到 ${op.target_id}` });
          break;
        }
        /*
          A FIELD THE BLOCK DOES NOT HAVE IS NOT AN EDIT.

          EDITABLE_TEXT_FIELDS is one global list and the fields are PER
          COMPONENT, so nothing stopped a `set_text` writing `title` onto a
          block whose text lives in `headline`. Measured in a browser on
          2026-08-27: 「把第一屏那句大标题改成「二十年装修经验」」 answered
          「改了 1 处」, wrote a prop SiteHero does not even declare, and left
          the page exactly as it was. Eleventh 「说了没做」 in this repo, and the
          comment on that list had already described this exact failure for the
          table-label fields -- one instance was fixed, the shape was not.

          Refused rather than written, and the refusal reaches the customer in
          `skipped`. Silently dropping it is what this was already doing.
        */
        const declared = TEXT_FIELDS_BY_COMPONENT[String(node.type ?? "")];
        const prose = proseFieldsOn(node);
        if (declared && !prose.includes(op.field)) {
          skipped.push({
            op: op.op,
            reason: declared.includes(op.field)
              ? // Declared, but this block's current shape does not put it on
                // the page. Writing it would be the silent no-op this whole
                // mechanism exists to stop.
                `${String(node.type ?? "")} 这一套版式不显示「${op.field}」`
              : `${String(node.type ?? "")} 没有「${op.field}」这个字段`,
          });
          break;
        }
        node.props[op.field] = op.value;
        applied++;
        break;
      }

      case "add_component": {
        // The enum check that makes a hallucinated component name a no-op
        // rather than an empty slot on a paying customer's page.
        if (!REGISTERED_COMPONENTS.includes(op.component)) {
          skipped.push({ op: op.op, reason: `没有这个组件：${op.component}` });
          break;
        }
        const config = COMPONENT_CONFIGS[op.component];
        // The 款式 this customer's 版式 calls for, merged over the component's
        // own defaults. A Docket page gets 有格线 tables and a Hearth page gets
        // 隔行底色 ones, without either the model or the owner having to say so
        // -- which is the whole point of them having chosen a 版式.
        const preferId = prefer?.[op.component];
        const preferProps = preferId
          ? VARIANTS[op.component]?.find((v) => v.id === preferId)?.props
          : undefined;
        const node: PuckNode = {
          type: op.component,
          props: {
            ...clone(config.defaultProps ?? {}),
            ...(preferProps ?? {}),
            id: newId(op.component),
          },
        };
        if (op.title && typeof node.props.title === "string") node.props.title = op.title;

        /*
          Same wrapper problem as move_component, milder consequence: 「在收款
          进度下面加一个」 aimed at a block inside a Panel used to land at the
          bottom of the page instead. Nothing of his is lost -- the block is
          new -- but it is still not where he said, so it resolves the same way.

          Unlike move_component this does NOT refuse when the anchor is
          missing: 「加一个收款进度」 with a stale after_id still wants the
          block, and the end of the page is a defensible place for it. Losing
          an edit he asked for would be worse than placing it low.
        */
        const home = op.after_id ? findHome(layout.content, op.after_id) : null;
        const column = home ? home.arr : mainColumn(layout);
        const at = home ? home.index : -1;
        if (at === -1) column.push(node);
        else column.splice(at + 1, 0, node);
        applied++;
        break;
      }

      case "remove_component": {
        // The shell is the page's frame, not content. Removing it would strand
        // everything inside its two slots -- an instruction the model should
        // never be able to carry out by accident.
        const node = findNode(layout.content, op.target_id);
        if (node?.type === "SystemShell") {
          skipped.push({ op: op.op, reason: "页面框架不能删除" });
          break;
        }
        if (!removeNode(layout.content, op.target_id)) {
          skipped.push({ op: op.op, reason: `找不到 ${op.target_id}` });
          break;
        }
        applied++;
        break;
      }

      /*
        MOVE IS LIFT-THEN-PLACE, and the order matters.

        The node is detached first and its target looked up AFTER, because
        removing it shifts every index behind it -- computing the destination
        first and splicing second puts the block one place off whenever it
        moves downward. Found by writing the test before the code.

        Everything lands in the MAIN column, which is where a page's blocks
        live. A model asked to move something has no business posting it into
        the navigation rail, and 「把表格搬到侧栏」 is not a request anybody makes.
      */
      case "move_component": {
        const node = findNode(layout.content, op.target_id);
        if (!node) {
          skipped.push({ op: op.op, reason: `找不到 ${op.target_id}` });
          break;
        }
        if (node.type === "SystemShell") {
          skipped.push({ op: op.op, reason: "页面框架不能搬动" });
          break;
        }
        if (op.before_id === op.target_id) {
          skipped.push({ op: op.op, reason: "搬到自己前面" });
          break;
        }
        if (!removeNode(layout.content, op.target_id)) {
          skipped.push({ op: op.op, reason: `找不到 ${op.target_id}` });
          break;
        }
        /*
          Landing spot resolved against the WHOLE tree, and a missing one is a
          refusal. Falling back to "the end of the main column" is what turned
          a wrapped target into a block at the bottom of the page while the
          reply said it had gone to the top.
        */
        let col = mainColumn(layout);
        let at = -1;
        if (op.before_id) {
          const home = findHome(layout.content, op.before_id);
          if (!home) {
            // Put it back where it was rather than leaving the page short.
            col.push(node);
            skipped.push({ op: op.op, reason: `找不到 ${op.before_id}` });
            break;
          }
          col = home.arr;
          at = home.index;
        }
        if (at === -1) col.push(node);
        else col.splice(at, 0, node);
        applied++;
        break;
      }

      case "add_table_row": {
        const table = tableOf(layout, op.target_id);
        if (!table) {
          skipped.push({ op: op.op, reason: `${op.target_id} 不是记录表格` });
          break;
        }
        const row = blankRow(table.columns);
        // Positional: cells[i] belongs to columns[i], which is the order the
        // model was shown. Extra cells are dropped and missing ones stay blank
        // rather than shifting every value one column left.
        (op.cells ?? []).forEach((value, i) => {
          const col = table.columns[i];
          if (col) row.cells[col.key] = value;
        });
        for (const col of table.columns) {
          if (col.kind === "status") {
            row.tones = { ...(row.tones ?? {}), [col.key]: op.status_tone ?? "neutral" };
          }
        }
        table.rows.push(row);
        applied++;
        break;
      }

      case "add_table_column": {
        const table = tableOf(layout, op.target_id);
        if (!table) {
          skipped.push({ op: op.op, reason: `${op.target_id} 不是记录表格` });
          break;
        }
        // Same ceiling the fields panel enforces (table-field.tsx). Stated in
        // both places on purpose: the customer's own limit should not depend on
        // which of the two ways they add a column.
        if (table.columns.length >= 8) {
          skipped.push({ op: op.op, reason: "表格最多八列" });
          break;
        }
        const key = newColumnKey(table.columns);
        table.columns.push({ key, label: op.column_label, kind: op.column_kind ?? "text" });
        for (const row of table.rows) row.cells[key] = "";
        applied++;
        break;
      }

      case "remove_table_column": {
        const table = tableOf(layout, op.target_id);
        if (!table) {
          skipped.push({ op: op.op, reason: `${op.target_id} 不是记录表格` });
          break;
        }
        const at = table.columns.findIndex((c) => c.key === op.column_key);
        if (at === -1) {
          skipped.push({ op: op.op, reason: `表格里没有 ${op.column_key} 这一列` });
          break;
        }
        // A table with no columns cannot be rendered and cannot be recovered
        // from -- there would be no header to add one back through.
        if (table.columns.length <= 1) {
          skipped.push({ op: op.op, reason: "表格至少要有一列" });
          break;
        }
        table.columns.splice(at, 1);
        for (const row of table.rows) {
          delete row.cells[op.column_key];
          if (row.tones) delete row.tones[op.column_key];
        }
        applied++;
        break;
      }

      case "set_table_column": {
        const table = tableOf(layout, op.target_id);
        if (!table) {
          skipped.push({ op: op.op, reason: `${op.target_id} 不是记录表格` });
          break;
        }
        const col = table.columns.find((c) => c.key === op.column_key);
        if (!col) {
          skipped.push({ op: op.op, reason: `表格里没有 ${op.column_key} 这一列` });
          break;
        }
        col.label = op.column_label;
        if (op.column_kind) col.kind = op.column_kind;
        applied++;
        break;
      }

      case "set_variant": {
        const node = findNode(layout.content, op.target_id);
        if (!node) {
          skipped.push({ op: op.op, reason: `找不到 ${op.target_id}` });
          break;
        }
        const list = VARIANTS[node.type];
        const variant = list?.find((v) => v.id === op.variant_id);
        if (!variant) {
          skipped.push({ op: op.op, reason: `${node.type} 没有「${op.variant_id}」这个款式` });
          break;
        }
        // The variant's own props, not the model's. Same object the picker
        // merges, so 用讲的 and 用点的 cannot drift apart -- and because every
        // variant only ever sets APPEARANCE props, an AI edit here can never
        // delete something the customer typed.
        Object.assign(node.props, variant.props);
        applied++;
        break;
      }

      case "set_copy": {
        const node = findNode(layout.content, op.target_id);
        if (!node) {
          skipped.push({ op: op.op, reason: `找不到 ${op.target_id}` });
          break;
        }
        if (node.type !== "SiteBlock") {
          skipped.push({ op: op.op, reason: `${node.type} 不是官网版段` });
          break;
        }
        const block = typeof node.props.block === "string" ? node.props.block : null;
        const defaults = block ? BLOCK_COPY[block] : undefined;
        if (!defaults) {
          skipped.push({ op: op.op, reason: `这一段没有可改的字` });
          break;
        }
        // Walk the DEFAULTS, not the override: the shape a section actually
        // has is the shape it shipped with, and refusing to invent a key is
        // what keeps a wrong path harmless.
        const parts = op.path.split(".");
        let shape: unknown = defaults;
        for (const part of parts) {
          if (shape === null || typeof shape !== "object") { shape = undefined; break; }
          shape = (shape as Record<string, unknown>)[part];
        }
        if (typeof shape !== "string") {
          skipped.push({ op: op.op, reason: `这一段没有「${op.path}」这个位置` });
          break;
        }
        // Copy-on-write down the path so a section that has never been edited
        // does not start sharing its defaults object with the saved layout.
        const existing = (node.props.copy ?? {}) as Record<string, unknown>;
        const merged: Record<string, unknown> = { ...defaults, ...existing };
        let cursor: Record<string, unknown> = merged;
        for (let i = 0; i < parts.length - 1; i++) {
          const key = parts[i];
          const next = cursor[key];
          cursor[key] = Array.isArray(next) ? [...next] : { ...(next as object) };
          cursor = cursor[key] as Record<string, unknown>;
        }
        cursor[parts[parts.length - 1]] = op.value;
        node.props.copy = merged;
        applied++;
        break;
      }

      case "set_workflow": {
        const node = findNode(layout.content, op.target_id);
        if (!node || node.type !== "WorkflowStrip") {
          skipped.push({ op: op.op, reason: `${op.target_id} 不是业务流程` });
          break;
        }
        node.props.stages = op.stages.map((label) => ({ label, tone: "normal" }));
        applied++;
        break;
      }

      /*
        AN OPERATION WITH NO CASE MUST NOT BE SILENCE.

        This switch had no default. An operation added to layoutOpSchema and
        not to this switch would fall straight through: not applied, not
        refused, absent from `skipped` -- and the assistant would report
        success over a page that had not moved. That is the shape of nine of
        the eleven 「说了没做」 bugs here: a capability declared in one place and
        never consumed in the next.

        Two guards, and the first is the one that matters. The `never`
        assignment makes the COMPILER refuse a new operation that has no case,
        so this cannot ship. The push below is what happens if it somehow does:
        the customer is told, instead of being lied to.
      */
      default: {
        const unhandled: never = op;
        skipped.push({
          op: (unhandled as { op: string }).op,
          reason: "这个操作还没接上",
        });
        break;
      }
    }
  }

  return { layout, applied, skipped };
}

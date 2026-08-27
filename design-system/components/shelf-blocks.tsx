import { AspectRatio } from "@/components/ui/aspect-ratio"
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { ButtonGroup } from "@/components/ui/button-group"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { icon } from "@/design-system/components/trade-blocks"
import { useSystemWords } from "@/design-system/system-lang-context"

/**
 * Blocks built from the primitives taken out of
 * arhamkhnz/next-shadcn-admin-dashboard (MIT).
 *
 * ── WHY COMPOSE RATHER THAN REGISTER THE PRIMITIVES ───────────────────────
 *
 * The founder's complaint was 「太少了」, measured: 57 components in 组件库, 14
 * of them with any alternative look. The obvious answer to that is to register
 * the fifteen primitives just pulled — and it would be the wrong one. `Item`,
 * `Attachment` and `Marker` are COMPOUND: Item alone renders nothing, and a
 * customer dragging in an `ItemMedia` has been handed a part rather than a
 * thing. Every existing block in this system is a thing a business recognises
 * (报价表格, 今天的安排, 收费), and a shelf of parts would make the library
 * bigger and less usable at the same time.
 *
 * So each of these is one recognisable object assembled from the parts, taking
 * a serialisable array the way every other block here does.
 *
 * ── AND WHY EACH HAS A VARIANT AXIS FROM THE START ────────────────────────
 *
 * 43 of the 57 had none, which is why twenty-two registers still read as one
 * design: the register can only differ where a component offers it a choice.
 * A block registered without an axis is a block every register must draw the
 * same way. These ship with one.
 */

/** `icon()` returns a COMPONENT, not an element -- InfoList takes the type and
 *  mounts it itself. These blocks need the element. */
const renderIcon = (k?: string) => {
  const I = icon(k)
  return <I />
}

/* ------------------------------------------------------------------ 项目清单 */

export type ShelfItem = {
  title: string
  description?: string
  icon?: string
  action?: string
}

/**
 * A list of things with an icon, a name, a line of detail and one action.
 *
 * Not the same as 图标资料列 (InfoRows), and the difference is the ACTION: this
 * is a list you DO something to — approve a claim, chase a payment, assign a
 * job — while InfoRows is a list you read.
 */
export function ShelfList({
  heading,
  items,
  size,
  separated,
}: {
  heading?: string
  items: ShelfItem[]
  /** `default` / `sm` — how much room each row takes. */
  size?: "default" | "sm"
  /** A hairline between rows, or nothing. */
  separated?: boolean
}) {
  const w = useSystemWords()
  const rows = items ?? []
  if (rows.length === 0) {
    return (
      <p className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)]">{w.empty}</p>
    )
  }
  return (
    <section className="flex flex-col [gap:var(--gap-stack)]">
      {heading && (
        <h3 className="ds-display [color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
          {heading}
        </h3>
      )}
      <ItemGroup>
        {rows.map((r, i) => (
          <div key={`${r.title}-${i}`}>
            {separated && i > 0 && <ItemSeparator />}
            <Item size={size} variant={separated ? "default" : "outline"}>
              {r.icon && <ItemMedia variant="icon">{renderIcon(r.icon)}</ItemMedia>}
              <ItemContent>
                <ItemTitle>{r.title}</ItemTitle>
                {r.description && <ItemDescription>{r.description}</ItemDescription>}
              </ItemContent>
              {r.action && (
                <ItemActions>
                  <Button size="sm" variant="outline">
                    {r.action}
                  </Button>
                </ItemActions>
              )}
            </Item>
          </div>
        ))}
      </ItemGroup>
    </section>
  )
}

/* ------------------------------------------------------------------ 附件清单 */

export type ShelfFile = {
  name: string
  meta?: string
}

/** 报价单的 PDF、工地照片、收据。A business's paperwork, listed as objects. */
export function AttachmentList({
  heading,
  files,
  orientation,
}: {
  heading?: string
  files: ShelfFile[]
  orientation?: "horizontal" | "vertical"
}) {
  const w = useSystemWords()
  const rows = files ?? []
  if (rows.length === 0) {
    return (
      <p className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)]">{w.empty}</p>
    )
  }
  return (
    <section className="flex flex-col [gap:var(--gap-stack)]">
      {heading && (
        <h3 className="ds-display [color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
          {heading}
        </h3>
      )}
      <AttachmentGroup>
        {rows.map((f, i) => (
          <Attachment key={`${f.name}-${i}`} orientation={orientation}>
            <AttachmentMedia variant="icon">{renderIcon("file")}</AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{f.name}</AttachmentTitle>
              {f.meta && <AttachmentDescription>{f.meta}</AttachmentDescription>}
            </AttachmentContent>
          </Attachment>
        ))}
      </AttachmentGroup>
    </section>
  )
}

/* ------------------------------------------------------------------ 标注清单 */

export type ShelfMark = {
  text: string
  /** Reads off the system's own status colours, not the marker's variants --
   *  Marker's axis is default / separator / border, which is about the RULE
   *  around the line rather than about what the line means. */
  tone?: "good" | "warn" | "bad"
  icon?: string
}

/**
 * Short marked lines — what is included, what is not, what to bring.
 *
 * The one block here whose whole job is a TONE per row, which is why it is
 * separate from 项目清单 rather than a variant of it.
 */
const TONE_COLOUR: Record<string, string> = {
  good: "var(--color-jade)",
  warn: "var(--color-brass)",
  bad: "var(--color-clay)",
}

export function MarkList({
  heading,
  marks,
  rule,
}: {
  heading?: string
  marks: ShelfMark[]
  /** The line's own treatment: nothing, a hairline under each, or a rule that
   *  runs out on both sides. */
  rule?: "default" | "border" | "separator"
}) {
  const rows = marks ?? []
  return (
    <section className="flex flex-col [gap:var(--gap-stack)]">
      {heading && (
        <h3 className="ds-display [color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
          {heading}
        </h3>
      )}
      <div className="flex flex-col [gap:calc(var(--gap-stack)*0.5)]">
        {rows.map((m, i) => (
          <Marker
            key={`${m.text}-${i}`}
            variant={rule}
            style={m.tone ? { color: TONE_COLOUR[m.tone] } : undefined}
          >
            {m.icon && <MarkerIcon>{renderIcon(m.icon)}</MarkerIcon>}
            <MarkerContent>{m.text}</MarkerContent>
          </Marker>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ 照片框 */

/**
 * A fixed-ratio frame.
 *
 * It renders an honest EMPTY frame that names what belongs in it until the
 * owner supplies a URL — the same rule as the hero figure's work grid, and for
 * the same reason: a stock photo of somebody else's kitchen is worse than a
 * frame that says 「放这里」, because a customer can tell the difference.
 */
export function PhotoFrame({
  src,
  alt,
  ratio,
  caption,
}: {
  src?: string
  alt?: string
  ratio?: "wide" | "photo" | "square"
  caption?: string
}) {
  /* AN EMPTY FRAME IS SHORT. Photographed on the founder's own phone,
     2026-08-27: three unfilled frames at 4:3 on a 390px screen is nearly 900px
     of 「Add a photo」 to scroll past. The prompt has to stay -- an owner who
     never sees where the photographs go never adds one -- but a prompt is a
     line, not a screen. A frame WITH a photograph keeps its real proportion,
     because that one is the content. */
  const declared = ratio === "square" ? 1 : ratio === "wide" ? 16 / 9 : 4 / 3
  const r = src ? declared : 5 / 2
  return (
    <figure className="flex flex-col [gap:calc(var(--gap-stack)*0.5)]">
      <AspectRatio
        ratio={r}
        className="overflow-hidden [background-color:var(--color-ink-850)] [border-radius:var(--radius-lg)] [border:var(--hairline)_solid_var(--color-ink-800)]"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt ?? caption ?? ""} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
            {caption || alt || "照片"}
          </span>
        )}
      </AspectRatio>
      {caption && (
        <figcaption className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

/* ------------------------------------------------------------------ 按钮组 */

export function ActionRow({
  actions,
  orientation,
}: {
  actions: { label: string; tone?: "default" | "outline" | "secondary" | "ghost" }[]
  orientation?: "horizontal" | "vertical"
}) {
  const rows = actions ?? []
  return (
    <ButtonGroup orientation={orientation}>
      {rows.map((a, i) => (
        <Button key={`${a.label}-${i}`} variant={a.tone ?? "outline"}>
          {a.label}
        </Button>
      ))}
    </ButtonGroup>
  )
}

/* ------------------------------------------------------------------ 下拉选择 */

/**
 * A plain `<select>`.
 *
 * The system already has 单选清单 (Listbox) and 可搜寻选择 (Combobox), both of
 * which are richer and both of which are custom. This one exists because on a
 * phone a native select opens the OS picker — a wheel the owner's staff have
 * used since their first phone — and no custom listbox is better than that for
 * a short list of fixed options.
 */
export function ChoiceSelect({
  label,
  name,
  options,
  size,
}: {
  label?: string
  name?: string
  options: { label: string }[]
  size?: "default" | "sm"
}) {
  const rows = options ?? []
  return (
    <label className="flex flex-col [gap:calc(var(--gap-stack)*0.4)]">
      {label && (
        <span className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
          {label}
        </span>
      )}
      <NativeSelect name={name} size={size}>
        {rows.map((o, i) => (
          <NativeSelectOption key={`${o.label}-${i}`} value={o.label}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  )
}

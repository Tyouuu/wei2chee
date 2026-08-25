"use client"

import type { ReactNode } from "react"
import { Avatar } from "./avatar"
import { railIcon } from "./rail-icons"

/**
 * 成品 — blocks that arrive finished.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────
 *
 * The founder, 2026-08-25, with our library beside 21st.dev's:
 * 「我们自己手工做的那些也远远比不上别人的设计啊」. He is right, and putting the two
 * galleries side by side said why in one look rather than in an adjective.
 *
 * Eight of our tiles were a grey rectangle with a little text in one corner —
 * 长文, 收合区块, 资料列表, 页面标题 — while every one of theirs was full: a
 * complete "Create project" form with fields, a select and two buttons; four
 * stat tiles with deltas; a list of users with avatars and status.
 *
 * The difference is not taste. THEIR COMPONENTS ARE OUR SECTIONS. What
 * 21st.dev calls a "Card" is a whole form; we had shipped Field, ActionButton
 * and Panel as three separate entries in the gallery. A screw does not
 * photograph well next to a chair.
 *
 * So these are assemblies of parts this library already had. They add no new
 * capability — every one of them could be built by hand out of four or five
 * existing blocks — and that is exactly the point: the owner should not have
 * to. He adds 「新客户登记表」 and gets a form, not a label and an input he then
 * has to arrange.
 *
 * ── WHY THEY ARE NOT SLOTS ───────────────────────────────────────────────
 *
 * A slotted version would be more flexible and would defeat the purpose: an
 * empty slot renders as an empty box in the gallery, which is the thing being
 * fixed. These carry their content as props, so the tile is full the moment it
 * is drawn and the customer edits words rather than assembles furniture.
 */

/* ---------------------------------------------------------------- 登记表 */

export type IntakeField = { label: string; placeholder?: string; wide?: "yes" | "no" }

/**
 * 新客户登记表 — the shape every one of these businesses has, and the one
 * 21st.dev's most-copied card also is: a heading, a handful of fields, and two
 * buttons where the primary one is on the right.
 */
export function IntakeForm({
  heading,
  note,
  fields,
  submitLabel,
  cancelLabel,
}: {
  heading: string
  note?: string
  fields: IntakeField[]
  submitLabel: string
  cancelLabel?: string
}) {
  return (
    <section className="[background:var(--card)] [border:var(--border-card-width)_solid_var(--border-subtle)] [border-radius:var(--radius)] [box-shadow:var(--shadow-card)] [padding:var(--pad-card-lg)]">
      <h3 className="[color:var(--color-paper)] [font-family:var(--font-display)] [font-size:var(--text-title)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-title)]">
        {heading}
      </h3>
      {note ? (
        <p className="mt-1.5 [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
          {note}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {(fields ?? []).map((f, i) => (
          <div key={i} className={f.wide === "yes" ? "sm:col-span-2" : undefined}>
            <label className="block [color:var(--color-paper-dim)] [font-size:var(--text-xs)] [font-weight:var(--fw-medium)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
              {f.label}
            </label>
            {/* A drawn field rather than a live input: this renders in a
                gallery tile and inside a page a stranger may be reading. A
                real <input> in a preview invites a click that goes nowhere. */}
            <div className="mt-1.5 flex h-[var(--row-h)] items-center [background:var(--color-ink-900)] [border:var(--hairline)_solid_var(--border)] [border-radius:var(--radius-control)] [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [padding-inline:var(--pad-cell-x)]">
              {f.placeholder ?? ""}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        {cancelLabel ? (
          <span className="[border-radius:var(--radius-control)] [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)]">
            {cancelLabel}
          </span>
        ) : null}
        <span className="[background:var(--color-primary)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)]">
          {submitLabel}
        </span>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- 资料卡 */

export type CardRow = { label: string; value: string; icon?: string }

/**
 * 客户资料卡 — a face, a name, what they are, how to reach them, and the one
 * button an owner actually presses. This is InfoRows with a head and a foot,
 * which is the difference between a list of pairs and a card about a person.
 */
export function PersonCard({
  name,
  role,
  tag,
  rows,
  actionLabel,
}: {
  name: string
  role?: string
  tag?: string
  rows: CardRow[]
  actionLabel?: string
}) {
  return (
    <section className="overflow-hidden [background:var(--card)] [border:var(--border-card-width)_solid_var(--border-subtle)] [border-radius:var(--radius)] [box-shadow:var(--shadow-card)]">
      <div className="flex items-center [gap:var(--gap-stack)] [border-bottom:var(--hairline)_solid_var(--border-subtle)] [padding:var(--pad-card)]">
        <Avatar name={name} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
            {name}
          </div>
          {role ? (
            <div className="truncate [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
              {role}
            </div>
          ) : null}
        </div>
        {tag ? (
          <span className="shrink-0 [background:var(--color-primary-soft)] [border-radius:var(--radius-pill)] [color:var(--color-primary)] [font-size:var(--text-xs)] [font-weight:var(--fw-medium)] [padding-block:2px] [padding-inline:var(--pad-control-x)]">
            {tag}
          </span>
        ) : null}
      </div>

      <dl className="[padding-inline:var(--pad-card)]">
        {(rows ?? []).map((r, i) => (
          <div
            key={i}
            className="flex items-center [gap:var(--gap-inline)] [padding-block:calc(var(--pad-cell-y)*1.1)] [&:not(:last-child)]:[border-bottom:var(--hairline)_solid_var(--border-subtle)]"
          >
            <span className="shrink-0 [color:var(--color-paper-dim)]" aria-hidden>
              {r.icon ? railIcon(r.icon, "h-[15px] w-[15px]") : null}
            </span>
            <dt className="w-[6.5rem] shrink-0 [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
              {r.label}
            </dt>
            <dd className="min-w-0 flex-1 truncate [color:var(--color-paper)] [font-size:var(--text-sm)]">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>

      {actionLabel ? (
        <div className="[padding:var(--pad-card)]">
          <span className="block text-center [background:var(--color-primary)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [padding-block:var(--pad-control-y)]">
            {actionLabel}
          </span>
        </div>
      ) : null}
    </section>
  )
}

/* ---------------------------------------------------------------- 工程卡 */

/**
 * 工程卡片 — one job, complete: what it is, whose it is, where it has got to,
 * what it is worth. The board and the table both hold rows about jobs; neither
 * of them is a card you can put on a page on its own.
 */
export function JobCard({
  title,
  client,
  status,
  tone = "normal",
  amount,
  amountLabel,
  percent = 0,
  stageLabel,
}: {
  title: string
  client?: string
  status?: string
  tone?: "normal" | "good" | "warn" | "bad"
  amount?: string
  amountLabel?: string
  percent?: number
  stageLabel?: string
}) {
  const TONE: Record<string, string> = {
    normal: "var(--color-slate-bright)",
    good: "var(--color-jade-bright)",
    warn: "var(--color-brass-bright)",
    bad: "var(--color-clay-bright)",
  }
  const c = TONE[tone] ?? TONE.normal
  const pct = Math.max(0, Math.min(100, Number(percent) || 0))

  return (
    <section className="[background:var(--card)] [border:var(--border-card-width)_solid_var(--border-subtle)] [border-radius:var(--radius)] [box-shadow:var(--shadow-card)] [padding:var(--pad-card)]">
      <div className="flex items-start [gap:var(--gap-inline)]">
        <div className="min-w-0 flex-1">
          <div className="truncate [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
            {title}
          </div>
          {client ? (
            <div className="mt-0.5 truncate [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
              {client}
            </div>
          ) : null}
        </div>
        {status ? (
          <span
            className="shrink-0 whitespace-nowrap [border-radius:var(--radius-control)] [font-size:var(--text-xs)] [font-weight:var(--fw-medium)] [padding-block:2px] [padding-inline:var(--pad-control-x)]"
            style={{
              color: c,
              background: `color-mix(in oklab, ${c} 14%, transparent)`,
              border: `var(--hairline) solid color-mix(in oklab, ${c} 32%, transparent)`,
            }}
          >
            {status}
          </span>
        ) : null}
      </div>

      {amount ? (
        <div className="mt-4 flex items-baseline [gap:var(--gap-inline)]">
          <span className="tnum [color:var(--color-paper)] [font-family:var(--font-numeric)] [font-size:var(--text-title)] [font-weight:var(--fw-semibold)]">
            {amount}
          </span>
          {amountLabel ? (
            <span className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
              {amountLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between [font-size:var(--text-xs)]">
          <span className="[color:var(--color-paper-dim)]">{stageLabel}</span>
          <span className="tnum [color:var(--color-paper-dim)]">{pct}%</span>
        </div>
        <div
          className="h-[6px] w-full overflow-hidden [border-radius:var(--radius-sm)]"
          style={{ background: "var(--color-ink-800)" }}
        >
          <div className="h-full" style={{ width: `${pct}%`, background: c }} />
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- 条款 */

/**
 * 报价条款 — the paragraph 长文 rendered as a bare wall of grey, given the
 * head and the signature line that make it a document. Every quotation in this
 * trade ends in one; none of them ends in an unlabelled paragraph.
 */
export function TermsBlock({
  heading,
  body,
  signLabel,
  dateLabel,
}: {
  heading: string
  body: string
  signLabel?: string
  dateLabel?: string
}) {
  return (
    <section className="[background:var(--card)] [border:var(--border-card-width)_solid_var(--border-subtle)] [border-radius:var(--radius)] [padding:var(--pad-card-lg)]">
      <h3 className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
        {heading}
      </h3>
      <p className="mt-3 max-w-[68ch] [color:var(--color-paper)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
        {body}
      </p>
      {signLabel ? (
        <div className="mt-8 flex flex-wrap [gap:var(--gap-section)]">
          {[signLabel, dateLabel].filter(Boolean).map((l) => (
            <div key={l as string} className="min-w-[11rem] flex-1">
              <div className="h-8" />
              <div className="[border-top:var(--hairline)_solid_var(--border)]" />
              <div className="mt-1.5 [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                {l}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

/* ---------------------------------------------------------------- 对账条 */

export type SummaryFigure = { label: string; value: string; note?: string; tone?: string }

/**
 * 本月对账 — four figures and a line under them, as ONE object. StatRow and
 * TrendChart are two entries in the gallery and two blocks on the page; every
 * dashboard worth copying treats "the month's numbers" as a single card.
 */
export function MonthSummary({
  heading,
  figures,
  footNote,
}: {
  heading: string
  figures: SummaryFigure[]
  footNote?: string
}) {
  const TONE: Record<string, string> = {
    good: "var(--color-jade-bright)",
    warn: "var(--color-brass-bright)",
    bad: "var(--color-clay-bright)",
  }
  return (
    <section className="overflow-hidden [background:var(--card)] [border:var(--border-card-width)_solid_var(--border-subtle)] [border-radius:var(--radius)] [box-shadow:var(--shadow-card)]">
      <div className="[border-bottom:var(--hairline)_solid_var(--border-subtle)] [padding-block:var(--pad-card)] [padding-inline:var(--pad-card-lg)]">
        <h3 className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
          {heading}
        </h3>
      </div>
      <div className="grid grid-cols-2 [gap:1px] [background:var(--border-subtle)] @2xl:grid-cols-4">
        {(figures ?? []).map((f, i) => (
          <div key={i} className="[background:var(--card)] [padding:var(--pad-card-lg)]">
            <div className="truncate [color:var(--color-paper-dim)] [font-size:var(--text-xs)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
              {f.label}
            </div>
            <div
              className="tnum mt-2 [font-family:var(--font-numeric)] [font-size:var(--text-title)] [font-weight:var(--fw-semibold)]"
              style={{ color: TONE[f.tone ?? ""] ?? "var(--color-paper)" }}
            >
              {f.value}
            </div>
            {f.note ? (
              <div className="mt-1 truncate [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                {f.note}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {footNote ? (
        <div className="[border-top:var(--hairline)_solid_var(--border-subtle)] [color:var(--color-paper-dim)] [font-size:var(--text-xs)] [padding-block:var(--pad-card)] [padding-inline:var(--pad-card-lg)]">
          {footNote}
        </div>
      ) : null}
    </section>
  )
}

/** Shared by the config's render functions; keeps the file's exports tidy. */
export type Assembled = ReactNode

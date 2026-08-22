// "use client" BECAUSE THIS COMPONENT NOW READS THE REGISTER. An absent variant
// prop means "follow the 版式", which is a React context lookup, and a context
// cannot be read from a server component. The portal's page route renders Puck's
// <Render> on the SERVER -- the editor is a client tree, but the saved page is
// not -- so without this the first paint of every customer page threw. Nothing
// else here needs the client; the props are all serialisable data.
"use client"

import type { ReactNode } from "react"
import { useRegisterProp } from "@/design-system/editor/style-scope"

export type WorkflowStage = {
  /** The stage's name in the business's own words — "报价", "订金", "施工". */
  label: string
  /** How many records are sitting at this stage right now. */
  count?: string
  /** Marks the stage the business is currently bottlenecked at. */
  tone?: "normal" | "attention"
}

/**
 * A business's pipeline, drawn as the row of stages it actually is.
 *
 * WHY THIS COMPONENT EXISTS: the single most valuable thing the AI produces
 * about a customer's business is its recommended workflow — "客户 → 报价 →
 * 订金 → 施工 → 尾款". Before this component there was nowhere to put it. The
 * registered set could render a table of records, a filter row and a headline
 * number, but nothing that showed a PROCESS, so the analysis's most
 * business-specific output had to be crammed into filter chips, where six
 * stages read as six applied filters rather than as a pipeline.
 *
 * It is deliberately not a chart and not interactive: it is the diagram a
 * business owner draws on a whiteboard when asked "how does a job move through
 * your shop", which is exactly the thing they are being asked to confirm or
 * correct in the editor.
 *
 * Every measurement reads from the style's own axis tokens, so the same
 * pipeline renders as a tight ruled ops strip under Ledger and a row of soft
 * rounded pills under Hearth.
 */
export function WorkflowStrip({
  title,
  stages,
  layout,
}: {
  /** ReactNode so the editor can make it editable in place. */
  title?: ReactNode
  stages: WorkflowStage[]
  /** `row` is the whiteboard drawing: left to right, arrows between stages.
      `timeline` is the same pipeline turned down the page, which is the only
      one of the three that survives a 390px screen -- five stages wrap the row
      into three ragged lines. `numbered` drops the boxes entirely, for a
      freshly drafted pipeline that has no counts in it yet. */
  layout?: "row" | "timeline" | "numbered"
}) {
  // Absent means "follow the register", not "row" -- see style-scope.tsx.
  const lay =
    layout ?? useRegisterProp<"row" | "timeline" | "numbered">("WorkflowStrip", "layout") ?? "row"
  if (stages.length === 0) return null

  return (
    <section
      className="w-full [border-radius:var(--radius-lg)] [box-shadow:var(--shadow-card)] [padding:var(--pad-card)] [background-color:var(--color-ink-900)]"
      style={{
        // Hearth sets --border-card-width to 0 and separates cards by shadow
        // alone; Ledger sets --shadow-card to none and separates them by a
        // hard border. Declaring both, each driven by its own token, is what
        // lets one component express both languages without a style prop.
        borderWidth: "var(--border-card-width)",
        borderStyle: "solid",
        borderColor: "var(--color-ink-800)",
      }}
    >
      {title && (
        <h2 className="mb-[var(--gap-stack)] [color:var(--color-paper-dim)] [font-size:var(--text-micro)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
          {title}
        </h2>
      )}

      {lay === "timeline" ? (
        <ol className="flex flex-col">
          {stages.map((stage, i) => (
            <li key={`${stage.label}-${i}`} className="flex [gap:var(--gap-inline)]">
              {/* The rail is one column: a dot per stage, and the segment of
                  rule that connects it to the next one. Drawing the rule as a
                  flex-grow child rather than as a border on the <li> keeps it
                  from running past the last dot into empty space. */}
              <div className="flex flex-col items-center">
                <span
                  aria-hidden
                  className="mt-1.5 size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      stage.tone === "attention"
                        ? "var(--color-primary)"
                        : "var(--color-paper-dim)",
                  }}
                />
                {i < stages.length - 1 && (
                  <span
                    aria-hidden
                    className="w-px flex-1"
                    style={{ backgroundColor: "var(--border-subtle)", minHeight: 18 }}
                  />
                )}
              </div>
              {/* One line per stage, spanning the card: ordinal and name on
                  the left margin, count on the right. Stacking the three in a
                  40px column made a timeline that ignored five sixths of the
                  width it was given and read as a rendering fault. */}
              <div
                className={`flex min-w-0 flex-1 items-baseline [gap:var(--gap-inline)] ${
                  i < stages.length - 1 ? "pb-[var(--gap-stack)]" : ""
                }`}
              >
                <span className="[color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-micro)] [letter-spacing:var(--tracking-label)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="min-w-0 flex-1 truncate [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]"
                  style={{
                    color:
                      stage.tone === "attention"
                        ? "var(--color-primary)"
                        : "var(--color-paper)",
                  }}
                >
                  {stage.label}
                </span>
                {stage.count && (
                  <span className="shrink-0 [color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
                    {stage.count}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : lay === "numbered" ? (
        <ol className="flex flex-wrap [gap:var(--gap-section)]">
          {stages.map((stage, i) => (
            <li key={`${stage.label}-${i}`} className="min-w-[84px]">
              {/* No box, no arrow. The numeral is set at hero scale and dimmed
                  so it reads as an ordinal rather than as a figure the reader
                  is supposed to add up -- these are step numbers, and a
                  business owner scanning a dashboard should never mistake one
                  for money. */}
              <span
                className="tnum block leading-none [font-family:var(--font-numeric)] [font-size:var(--text-2xl)] [font-weight:var(--fw-semibold)]"
                style={{
                  color:
                    stage.tone === "attention"
                      ? "var(--color-primary)"
                      : "var(--border-subtle)",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="mt-1.5 [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                {stage.label}
              </div>
              {stage.count && (
                <div className="[color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
                  {stage.count}
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
      <ol
        className="grid items-stretch [gap:var(--gap-inline)]"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))" }}
      >
        {stages.map((stage, i) => (
          <li key={`${stage.label}-${i}`} className="flex min-w-0 items-center [gap:var(--gap-inline)]">
            {/* The connector LEADS each stage after the first, rather than
                trailing each stage before the last. Both are correct on one
                line; only this one survives a wrap. Trailing arrows left a "→"
                dangling at the end of the first row, pointing at nothing, with
                the wrapped stage below starting bare -- seen with a real
                five-stage renovation pipeline in a narrow column. Leading
                arrows make a wrapped row read as a continuation instead. */}
            {i > 0 && (
              <span aria-hidden className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
                →
              </span>
            )}
            <div
              className="flex min-w-0 flex-1 flex-col [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)]"
              style={{
                backgroundColor:
                  stage.tone === "attention"
                    ? "var(--color-primary-soft)"
                    : "var(--color-ink-850)",
                borderWidth: "var(--hairline)",
                borderStyle: "solid",
                borderColor:
                  stage.tone === "attention" ? "var(--color-primary)" : "var(--border-subtle)",
              }}
            >
              {/* The stage index. Under Ledger this is the drafted step number
                  an ops sheet would carry; under the softer registers it just
                  reads as a quiet ordinal. */}
              <span className="[color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-micro)] [letter-spacing:var(--tracking-label)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="truncate [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                {stage.label}
              </span>
              {stage.count && (
                <span className="[color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
                  {stage.count}
                </span>
              )}
            </div>

          </li>
        ))}
      </ol>
      )}
    </section>
  )
}

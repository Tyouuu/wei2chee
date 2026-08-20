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
}: {
  title?: string
  stages: WorkflowStage[]
}) {
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

      <ol className="flex flex-wrap items-stretch [gap:var(--gap-inline)]">
        {stages.map((stage, i) => (
          <li key={`${stage.label}-${i}`} className="flex items-center [gap:var(--gap-inline)]">
            <div
              className="flex min-w-[92px] flex-col [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)]"
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
              <span className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                {stage.label}
              </span>
              {stage.count && (
                <span className="[color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
                  {stage.count}
                </span>
              )}
            </div>

            {/* The connector belongs BETWEEN stages, so the last one doesn't
                trail an arrow pointing at nothing. */}
            {i < stages.length - 1 && (
              <span aria-hidden className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

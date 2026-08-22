import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const ITEMS = [
  {
    label: "Unlimited workspaces",
    detail:
      "Create as many projects as your team needs with no per-workspace fees.",
  },
  {
    label: "Role-based access control",
    detail:
      "Assign viewer, editor, or admin permissions down to the resource level.",
  },
  {
    label: "SSO via SAML 2.0 & OIDC",
    detail:
      "Connect your identity provider in minutes: Okta, Azure AD, and more.",
  },
  {
    label: "Real-time sync",
    detail: "Changes propagate across all clients in under 50 ms on average.",
  },
  {
    label: "Audit log & SIEM export",
    detail:
      "Every action is timestamped, immutable, and exportable to your SIEM.",
  },
  {
    label: "99.99% uptime SLA",
    detail:
      "Geo-redundant infrastructure backed by a contractual availability guarantee.",
  },
  {
    label: "REST & GraphQL APIs",
    detail:
      "Build on top of Acme with fully documented, versioned API endpoints.",
  },
  {
    label: "Webhooks & event streams",
    detail:
      "Push real-time events to your own endpoints the moment something changes.",
  },
  {
    label: "CSV, JSON & Parquet export",
    detail: "Take your data anywhere, with no lock-in or extraction fees.",
  },
  {
    label: "Scheduled reports",
    detail:
      "Deliver PDF or email digests to stakeholders on any cadence you set.",
  },
  {
    label: "End-to-end encryption",
    detail:
      "Data is encrypted in transit with TLS 1.3 and at rest with AES-256.",
  },
  {
    label: "EU & US data residency",
    detail:
      "Choose which region stores your data to meet local compliance requirements.",
  },
]

/**
 * EVERY WORD THIS SECTION SHOWS, IN ONE OBJECT.
 *
 * The section was pulled from the @7Ovr registry with its own copy baked in as
 * module-level consts. That made it un-editable: the editor's AI writes into
 * PROPS (`set_text` in lib/portal/layout-ops.ts), and a block whose words live
 * in its source has no prop to write into. Selecting one and pressing 改文字
 * opened a panel with a single dropdown -- change the whole section, or nothing.
 *
 * Lifting the consts here changes nothing on screen: the component falls back
 * to exactly these values when no `copy` is passed. What it adds is a surface
 * the AI can reach, so a customer can say "put my own prices in" and get their
 * own prices rather than Acme's.
 *
 * GENERATED. Re-run the opener rather than editing this block by hand.
 */
export const copy = { ITEMS }
export type Copy = typeof copy


export default function FeaturesBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { ITEMS } = { ...copy, ...override }
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-12 max-w-xl">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Everything included
          </p>
          <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            No hidden add-ons. No surprises.
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Every plan ships with the full Acme feature set. Pick the tier that
            fits your team size. The capability is identical across the board.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-x-12 gap-y-0 sm:grid-cols-2">
          {ITEMS.map(({ label, detail }) => (
            <div
              key={label}
              className="flex items-start gap-3 border-t border-border py-4"
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <IconPlaceholder
                  lucide="Check"
                  tabler="IconCheck"
                  hugeicons="Tick02Icon"
                  phosphor="Check"
                  remixicon="RiCheckLine"
                  className="size-3"
                  aria-hidden="true"
                />
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm leading-snug font-semibold">
                  {label}
                </span>
                <span className="text-sm leading-snug text-muted-foreground">
                  {detail}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

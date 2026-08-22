import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const checklist = [
  "Role-based access with per-workspace permissions",
  "SAML and SCIM for automated provisioning",
  "Audit logs exported to your warehouse",
  "Regional data residency on every plan",
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
export const copy = { checklist }
export type Copy = typeof copy


export default function FeaturesBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { checklist } = { ...copy, ...override }
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-20 text-foreground">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <div className="flex flex-col items-start gap-6">
          <Badge variant="secondary">Security</Badge>
          <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Enterprise controls, without the enterprise setup
          </h2>
          <p className="text-base text-muted-foreground">
            Everything you need to pass a security review is on by default. Turn
            on the controls your team requires and leave the rest — no sales
            call required.
          </p>
          <ul className="flex flex-col gap-3">
            {checklist.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <IconPlaceholder
                  lucide="Check"
                  tabler="IconCheck"
                  hugeicons="Tick02Icon"
                  phosphor="Check"
                  remixicon="RiCheckLine"
                  className="mt-0.5 size-4 shrink-0 text-foreground"
                  aria-hidden="true"
                />
                <span className="text-foreground">{item}</span>
              </li>
            ))}
          </ul>
          <Button className="mt-2" asChild><a href="#" >
            Explore security
            <IconPlaceholder
              lucide="ChevronRight"
              tabler="IconChevronRight"
              hugeicons="ArrowRight01Icon"
              phosphor="CaretRight"
              remixicon="RiArrowRightSLine"
              data-icon="inline-end"
              aria-hidden="true"
            />
          </a></Button>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="rounded-lg border border-border bg-background">
            <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
              <span className="size-2 rounded-full bg-foreground/20" />
              <span className="size-2 rounded-full bg-foreground/20" />
              <span className="size-2 rounded-full bg-foreground/20" />
            </div>
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <div className="h-2.5 w-28 rounded-full bg-muted" />
                <div className="h-6 w-16 rounded-md border border-border" />
              </div>
              {[
                { label: "Two-factor authentication", on: true },
                { label: "SSO enforcement", on: true },
                { label: "IP allow-list", on: false },
                { label: "Session timeout", on: true },
              ].map(({ label, on }) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="h-2 w-40 rounded-full bg-muted" />
                    <div className="h-2 w-24 rounded-full bg-muted/60" />
                  </div>
                  <span
                    aria-hidden="true"
                    className={
                      on
                        ? "flex h-5 w-9 items-center justify-end rounded-full bg-primary px-0.5"
                        : "flex h-5 w-9 items-center rounded-full bg-muted px-0.5"
                    }
                  >
                    <span className="size-4 rounded-full bg-background" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const stats = [
  { value: "12k+", label: "Active customers", delta: "+18%" },
  { value: "99.9%", label: "Uptime guarantee", delta: "+0.1%" },
  { value: "4.9/5", label: "Average rating", delta: "+0.3" },
  { value: "150+", label: "Countries served", delta: "+12" },
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
export const copy = { stats }
export type Copy = typeof copy


export default function StatsBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { stats } = { ...copy, ...override }
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Trusted at scale
          </h2>
          <p className="mt-3 text-muted-foreground">
            The numbers product teams rely on every day.
          </p>
        </div>

        <Separator className="mt-12" />
        <dl className="grid grid-cols-2 md:grid-cols-4">
          {stats.map(({ value, label, delta }) => (
            <div
              key={label}
              className="flex flex-col items-center border-border px-6 py-8 text-center md:[&:nth-child(2)]:border-r [&:nth-child(odd)]:border-r"
            >
              <dt className="text-4xl font-bold tracking-tight sm:text-5xl">
                {value}
              </dt>
              <dd className="mt-2 text-sm text-muted-foreground">{label}</dd>
              <Badge variant="secondary" className="mt-2">
                <IconPlaceholder
                  lucide="ArrowUp"
                  tabler="IconArrowUp"
                  hugeicons="ArrowUpIcon"
                  phosphor="ArrowUp"
                  remixicon="RiArrowUpLine"
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                {delta}
              </Badge>
            </div>
          ))}
        </dl>
        <Separator />
      </div>
    </section>
  )
}

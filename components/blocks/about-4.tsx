import { Separator } from "@/components/ui/separator"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

const columns = [
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Flag"
        tabler="IconFlag2"
        hugeicons="FlagIcon"
        phosphor="Flag"
        remixicon="RiFlag2Line"
        {...p}
      />
    ),
    eyebrow: "Mission",
    heading: "Give every team production-grade UI",
    body: "We exist so that a two-person startup and a thousand-person enterprise can ship the same caliber of interface — without rebuilding the basics every time.",
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Eye"
        tabler="IconEye"
        hugeicons="EyeIcon"
        phosphor="Eye"
        remixicon="RiEyeLine"
        {...p}
      />
    ),
    eyebrow: "Vision",
    heading: "A web where good design is the default",
    body: "We picture a world where accessible, consistent, well-crafted products are the norm, not the exception reserved for teams with a dedicated design system.",
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Compass"
        tabler="IconCompass"
        hugeicons="CompassIcon"
        phosphor="Compass"
        remixicon="RiCompass3Line"
        {...p}
      />
    ),
    eyebrow: "Values",
    heading: "Craft, clarity, and trust",
    body: "We optimize for the long game: code others can maintain, decisions we can explain, and a product our customers can depend on in production.",
  },
]

export default function AboutBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-20 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mx-auto max-w-xl text-center">
          <span className="inline-block rounded-4xl border border-border px-3 py-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Who we are
          </span>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            What drives the work
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          {columns.map(({ icon: Icon, eyebrow, heading, body }) => (
            <div
              key={eyebrow}
              className="flex flex-col gap-4 bg-background p-8"
            >
              <Icon className="size-7 text-foreground" aria-hidden="true" />
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  {eyebrow}
                </span>
                <h3 className="font-heading text-lg font-bold tracking-tight">
                  {heading}
                </h3>
              </div>
              <Separator />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

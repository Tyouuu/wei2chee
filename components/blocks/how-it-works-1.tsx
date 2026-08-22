import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

const steps = [
  {
    number: "01",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="UploadCloud"
        tabler="IconCloudUpload"
        hugeicons="CloudUploadIcon"
        phosphor="CloudArrowUp"
        remixicon="RiUploadCloudLine"
        {...p}
      />
    ),
    title: "Connect your data",
    copy: "Link your existing sources in seconds, no migration scripts, no downtime.",
  },
  {
    number: "02",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Search"
        tabler="IconSearch"
        hugeicons="SearchIcon"
        phosphor="MagnifyingGlass"
        remixicon="RiSearchEyeLine"
        {...p}
      />
    ),
    title: "Analyze and configure",
    copy: "Acme maps your schema, surfaces anomalies, and suggests optimal settings automatically.",
  },
  {
    number: "03",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Flashlight"
        tabler="IconBulb"
        hugeicons="FlashlightIcon"
        phosphor="Flashlight"
        remixicon="RiFlashlightLine"
        {...p}
      />
    ),
    title: "Go live instantly",
    copy: "Publish with a single click and start delivering results to your team right away.",
  },
]

export default function HowItWorksBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
            How It Works
          </span>
          <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            From setup to results in three steps
          </h2>
          <p className="mt-3 text-muted-foreground">
            Acme keeps the process simple so your team spends time on outcomes,
            not configuration.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {steps.map(({ number, icon: Icon, title, copy }) => (
            <Card key={number} className="relative p-6">
              <Badge
                variant="secondary"
                className="absolute top-6 right-6 font-mono text-xs tabular-nums"
              >
                {number}
              </Badge>

              <CardHeader className="p-0">
                <span className="flex size-12 items-center justify-center rounded-lg border border-border bg-muted">
                  <Icon className="size-5 text-foreground" aria-hidden="true" />
                </span>

                <CardTitle className="mt-5 text-base font-semibold">
                  {title}
                </CardTitle>
                <CardDescription className="mt-2 text-sm">
                  {copy}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

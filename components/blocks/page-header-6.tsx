import { Button } from "@/components/ui/button"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const stats = [
  { label: "Total revenue", value: "$128.4k", delta: "+12.4%" },
  { label: "Active users", value: "8,240", delta: "+3.1%" },
  { label: "Conversion", value: "4.7%", delta: "+0.6%" },
  { label: "Churn", value: "1.2%", delta: "-0.3%" },
]

export default function PageHeaderBlock() {
  return (
    <section className="w-full bg-background px-6 py-10 text-foreground">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
              Overview
            </p>
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              Analytics
            </h1>
            <p className="text-sm text-muted-foreground">
              Performance across your workspace for the last 30 days.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <IconPlaceholder
                lucide="Download"
                tabler="IconDownload"
                hugeicons="DownloadIcon"
                phosphor="Download"
                remixicon="RiDownloadLine"
                data-icon="inline-start"
                aria-hidden="true"
              />
              Export
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Settings">
              <IconPlaceholder
                lucide="Settings"
                tabler="IconSettings"
                hugeicons="SettingsIcon"
                phosphor="GearSix"
                remixicon="RiSettings3Line"
                className="size-4"
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
          {stats.map(({ label, value, delta }) => (
            <div key={label} className="flex flex-col gap-1 bg-background p-4">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-xl font-bold tracking-tight tabular-nums">
                {value}
              </dd>
              <dd className="text-xs font-medium text-muted-foreground tabular-nums">
                {delta} vs last period
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

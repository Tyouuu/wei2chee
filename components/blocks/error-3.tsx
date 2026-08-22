import { Button } from "@/components/ui/button"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

export default function ErrorBlock() {
  return (
    <section className="flex min-h-svh w-full flex-col items-center justify-center gap-6 bg-background px-6 py-12 text-center text-foreground">
      <div className="flex size-16 items-center justify-center rounded-lg border border-border bg-muted/30">
        <IconPlaceholder
          lucide="CircleAlert"
          tabler="IconAlertCircle"
          hugeicons="AlertCircleIcon"
          phosphor="WarningCircle"
          remixicon="RiErrorWarningLine"
          className="size-8 text-muted-foreground"
          aria-hidden="true"
        />
      </div>

      <div className="flex flex-col items-center gap-2">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Something went wrong
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          An unexpected error occurred while processing your request. Please try
          again, and contact support if the problem persists.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 sm:flex-row">
        <Button className="w-full sm:w-auto">
          <IconPlaceholder
            lucide="RefreshCw"
            tabler="IconRefresh"
            hugeicons="RefreshIcon"
            phosphor="ArrowsClockwise"
            remixicon="RiRefreshLine"
            data-icon="inline-start"
            aria-hidden="true"
          />
          Try Again
        </Button>
        <Button
          variant="outline"
         
         
          className="w-full sm:w-auto"
         asChild><a href="#" >
          Contact Support
        </a></Button>
      </div>

      <p className="font-mono text-xs text-muted-foreground">
        Reference: 7OVR-4F2A9
      </p>
    </section>
  )
}

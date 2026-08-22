import { Button } from "@/components/ui/button"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

export default function ErrorBlock() {
  return (
    <section className="flex min-h-svh w-full flex-col items-center justify-center gap-6 bg-background px-6 py-12 text-center text-foreground">
      <p className="font-mono text-7xl font-bold tracking-tighter sm:text-8xl">
        404
      </p>

      <div className="flex flex-col items-center gap-2">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Page not found
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The page you are looking for does not exist or has been moved. Check
          the URL, or head back to safety.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 sm:flex-row">
        <Button
         
         
          className="w-full sm:w-auto"
         asChild><a href="#" >
          <IconPlaceholder
            lucide="Compass"
            tabler="IconCompass"
            hugeicons="CompassIcon"
            phosphor="Compass"
            remixicon="RiCompass3Line"
            data-icon="inline-start"
            aria-hidden="true"
          />
          Go Home
        </a></Button>
        <Button
          variant="outline"
         
         
          className="w-full sm:w-auto"
         asChild><a href="#" >
          <IconPlaceholder
            lucide="ArrowLeft"
            tabler="IconArrowLeft"
            hugeicons="ArrowLeftIcon"
            phosphor="ArrowLeft"
            remixicon="RiArrowLeftLine"
            data-icon="inline-start"
            aria-hidden="true"
          />
          Go Back
        </a></Button>
      </div>
    </section>
  )
}

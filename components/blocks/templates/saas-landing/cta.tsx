import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

export default function Cta() {
  return (
    <section className="flex w-full items-center justify-center px-6 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-6xl rounded-xl border border-border bg-muted/30 px-6 py-14 text-center sm:px-12 sm:py-20">
        <Badge variant="outline" className="mb-4 tracking-widest uppercase">
          Get Started
        </Badge>
        <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Start building faster today.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
          Ship production-ready interfaces in minutes with composable blocks,
          sensible defaults, and zero configuration.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
           
           
            className="w-full sm:w-auto"
           asChild><a href="#" >
            Get Started
            <IconPlaceholder
              lucide="ArrowRight"
              tabler="IconArrowRight"
              hugeicons="ArrowRightIcon"
              phosphor="ArrowRight"
              remixicon="RiArrowRightLine"
              data-icon="inline-end"
              aria-hidden="true"
            />
          </a></Button>
          <Button
            variant="secondary"
           
           
            className="w-full sm:w-auto"
           asChild><a href="#" >
            Read the Docs
          </a></Button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          No credit card required.
        </p>
      </div>
    </section>
  )
}

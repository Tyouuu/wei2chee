import { Button } from "@/components/ui/button"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

export default function CtaBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-muted px-6 py-12 text-foreground">
      <div className="w-full max-w-md rounded-lg border border-border bg-card px-8 py-10 text-center">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          Ready to ship your next product?
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm text-pretty text-muted-foreground">
          Acme gives your team everything it needs to go from idea to
          production. Start free, no credit card required.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
           
           
            className="w-full sm:w-auto"
           asChild><a href="#" >
            Get Started For Free
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
            variant="outline"
           
           
            className="w-full sm:w-auto"
           asChild><a href="#" >
            Talk To Sales
          </a></Button>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          Join 10,000+ teams already building with Acme.
        </p>
      </div>
    </section>
  )
}

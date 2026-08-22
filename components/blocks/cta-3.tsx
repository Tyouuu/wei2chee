import { Button } from "@/components/ui/button"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

export default function CtaBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="w-full rounded-xl bg-primary px-8 py-16 sm:px-16 sm:py-20">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
              Acme is the fastest way to ship.
            </h2>
            <p className="max-w-xl text-base text-primary-foreground/80">
              Join thousands of teams who build and deploy production interfaces
              without the overhead.
            </p>
          </div>
          <div className="shrink-0">
            <Button
              variant="secondary"
             
             
              className="w-full sm:w-auto"
             asChild><a href="#" >
              Get Started Free
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
          </div>
        </div>
      </div>
    </section>
  )
}

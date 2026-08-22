import { Button } from "@/components/ui/button"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

export default function ErrorBlock() {
  return (
    <section className="flex min-h-svh w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <span
          className="text-[8rem] leading-none font-bold tracking-tighter text-foreground tabular-nums select-none sm:text-[11rem]"
          aria-hidden="true"
        >
          404
        </span>
        <h1 className="-mt-2 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          This page took a wrong turn
        </h1>
        <p className="mt-3 max-w-sm text-sm text-pretty text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have been
          moved. Let&apos;s get you back on track.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild><a href="#" >
            <IconPlaceholder
              lucide="Home"
              tabler="IconHome"
              hugeicons="HomeIcon"
              phosphor="House"
              remixicon="RiHome4Line"
              data-icon="inline-start"
              aria-hidden="true"
            />
            Go home
          </a></Button>
          <Button
           
           
            variant="outline"
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
            Go back
          </a></Button>
        </div>
      </div>
    </section>
  )
}

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const LOGOS = ["Northwind", "Vertex", "Lumina", "Cascade", "Quantel"]

export default function HeroBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <Badge variant="secondary">
          <IconPlaceholder
            lucide="Sparkles"
            tabler="IconSparkles"
            hugeicons="SparklesIcon"
            phosphor="Sparkle"
            remixicon="RiSparkling2Line"
            data-icon="inline-start"
            aria-hidden="true"
          />
          Now In Beta
        </Badge>

        <h1 className="mt-6 font-heading text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Build your next product, faster
        </h1>

        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          The all-in-one platform to design, build, and ship your ideas, with
          everything your team needs in one place.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild><a href="#" >
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
            variant="outline"
           
           
           asChild><a href="#" >
            Learn More
            <IconPlaceholder
              lucide="ArrowUpRight"
              tabler="IconArrowUpRight"
              hugeicons="ArrowUpRightIcon"
              phosphor="ArrowUpRight"
              remixicon="RiArrowRightUpLine"
              data-icon="inline-end"
              aria-hidden="true"
            />
          </a></Button>
        </div>

        <Separator className="mt-12 w-full max-w-md" />

        <p className="mt-6 text-sm text-muted-foreground">
          Trusted by thousands of teams around the world.
        </p>

        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {LOGOS.map((logo) => (
            <li
              key={logo}
              className="text-base font-bold tracking-tight text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              {logo}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

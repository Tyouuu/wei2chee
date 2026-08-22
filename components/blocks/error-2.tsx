import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const popularPages = [
  "Getting started",
  "Installation guide",
  "Components reference",
  "Theming and tokens",
]

export default function ErrorBlock() {
  return (
    <section className="flex min-h-svh w-full flex-col items-center justify-center gap-8 bg-background px-6 py-12 text-center text-foreground">
      <div className="flex flex-col items-center gap-2">
        <span className="text-6xl font-bold tracking-tight tabular-nums sm:text-7xl">
          404
        </span>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Page not found
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          We could not find the page you were looking for. Try searching, or
          pick one of the popular pages below.
        </p>
      </div>

      <form
        action="#"
        className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
      >
        <Input
          type="search"
          placeholder="Search the docs..."
          aria-label="Search the docs"
          className="h-9 flex-1 text-sm"
        />
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          <IconPlaceholder
            lucide="Search"
            tabler="IconSearch"
            hugeicons="SearchIcon"
            phosphor="MagnifyingGlass"
            remixicon="RiSearchLine"
            data-icon="inline-start"
            aria-hidden="true"
          />
          Search
        </Button>
      </form>

      <div className="flex w-full max-w-md flex-col gap-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Popular pages
        </p>
        <ul className="flex flex-col border-t border-border">
          {popularPages.map((page) => (
            <li key={page} className="border-b border-border">
              <a
                href="#"
                className="group flex items-center justify-between gap-4 py-2.5 text-sm text-foreground"
              >
                <span>{page}</span>
                <IconPlaceholder
                  lucide="ArrowRight"
                  tabler="IconArrowRight"
                  hugeicons="ArrowRightIcon"
                  phosphor="ArrowRight"
                  remixicon="RiArrowRightLine"
                  className="size-4 text-muted-foreground transition-colors group-hover:text-foreground"
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

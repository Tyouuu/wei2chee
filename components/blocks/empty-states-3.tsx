"use client"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Toaster } from "@/components/ui/sonner"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

export default function EmptyStatesBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-muted/30 px-6 py-16 text-foreground">
      <Toaster />
      <div className="w-full max-w-md rounded-lg border border-border bg-card">
        <Empty className="border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconPlaceholder
                lucide="Search"
                tabler="IconSearch"
                hugeicons="SearchIcon"
                phosphor="MagnifyingGlass"
                remixicon="RiSearchLine"
                className="size-4"
              />
            </EmptyMedia>
            <EmptyTitle>No results found</EmptyTitle>
            <EmptyDescription>
              We couldn&apos;t find anything matching &ldquo;quarterly&rdquo;.
              Try a different keyword or clear your filters to see all records.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              onClick={() =>
                toast("Filters cleared", {
                  id: "filters-cleared",
                  description: "Showing all records.",
                })
              }
            >
              <IconPlaceholder
                lucide="RefreshCw"
                tabler="IconRefresh"
                hugeicons="RefreshIcon"
                phosphor="ArrowsClockwise"
                remixicon="RiRefreshLine"
                data-icon="inline-start"
              />
              Clear Filters
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    </section>
  )
}

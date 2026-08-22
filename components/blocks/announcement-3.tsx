"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const STORAGE_KEY = "acme-announcement-3-dismissed"

export default function AnnouncementBlock() {
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        if (localStorage.getItem(STORAGE_KEY) === "true") {
          setDismissed(true)
        }
      } catch {}
      setMounted(true)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  function handleDismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(STORAGE_KEY, "true")
    } catch {}
  }

  function handleReset() {
    setDismissed(false)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

  return (
    <section className="flex min-h-svh w-full flex-col items-center bg-muted/30 px-6 py-16 text-foreground">
      <div className="w-full max-w-5xl">
        {mounted && !dismissed && (
          <div className="flex w-full items-center gap-3 rounded-lg border border-border bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
            <IconPlaceholder
              lucide="Rocket"
              tabler="IconRocket"
              hugeicons="RocketIcon"
              phosphor="Rocket"
              remixicon="RiRocket2Line"
              className="hidden size-4 shrink-0 sm:block"
              aria-hidden="true"
            />
            <p className="min-w-0 flex-1 truncate font-medium">
              <span className="font-semibold">Acme Cloud is live.</span>{" "}
              <span className="text-primary-foreground/80">
                Deploy in seconds with zero config.
              </span>{" "}
              <Button
                variant="link"
                size="sm"
               
               
                className="h-auto p-0 align-baseline text-primary-foreground underline underline-offset-2 hover:text-primary-foreground/80"
               asChild><a href="#" >
                Get Started
              </a></Button>
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Dismiss announcement"
              onClick={handleDismiss}
              className="-mr-1 shrink-0 hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <IconPlaceholder
                lucide="X"
                tabler="IconX"
                hugeicons="Cancel01Icon"
                phosphor="X"
                remixicon="RiCloseLine"
                aria-hidden="true"
              />
            </Button>
          </div>
        )}

        <div className="mx-auto mt-8 w-4/5 space-y-6" aria-hidden="true">
          <div className="flex items-center justify-between">
            <div className="h-6 w-28 rounded-md bg-muted" />
            <div className="hidden items-center gap-3 sm:flex">
              <div className="h-3 w-12 rounded-md bg-muted" />
              <div className="h-3 w-12 rounded-md bg-muted" />
              <div className="h-7 w-16 rounded-md bg-muted" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="h-6 w-1/2 rounded-md bg-muted" />
            <div className="h-3 w-full rounded-md bg-muted" />
            <div className="h-3 w-4/5 rounded-md bg-muted" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="h-20 rounded-md bg-muted" />
            <div className="h-20 rounded-md bg-muted" />
            <div className="h-20 rounded-md bg-muted" />
          </div>
        </div>

        {mounted && dismissed && (
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Banner dismissed and saved to your browser.{" "}
            <Button
              variant="link"
              size="sm"
              onClick={handleReset}
              className="h-auto p-0 align-baseline text-xs"
            >
              Show It Again
            </Button>
          </p>
        )}
      </div>
    </section>
  )
}

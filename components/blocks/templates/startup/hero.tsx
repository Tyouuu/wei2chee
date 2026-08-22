"use client"

import { useState } from "react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

export default function Hero() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email) return
    setSubmitted(true)
    toast.success("You're on the list", {
      description: `We'll reach out to ${email} when your spot is ready.`,
    })
  }

  return (
    <section className="relative isolate flex w-full items-center justify-center overflow-hidden px-6 py-16 sm:py-24">
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 -z-10",
          "bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)]",
          "bg-[size:56px_56px] opacity-40",
          "[mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]"
        )}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,var(--color-primary)/0.12,transparent)]"
      />

      <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
        <Badge variant="secondary" className="px-3 py-1">
          <IconPlaceholder
            lucide="Sparkles"
            tabler="IconSparkles"
            hugeicons="SparklesIcon"
            phosphor="Sparkle"
            remixicon="RiSparkling2Line"
            data-icon="inline-start"
            className="size-3.5"
          />
          Now in public beta
        </Badge>

        <h1 className="mt-6 font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
          Ship your next idea with Acme
        </h1>

        <p className="mt-5 max-w-xl text-base text-balance text-muted-foreground sm:text-lg">
          The all-in-one platform that turns rough sketches into
          production-ready apps. Build faster, launch sooner, and scale without
          the busywork.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-9 flex w-full max-w-md flex-col gap-3 sm:flex-row"
        >
          <div className="flex-1">
            <Label htmlFor="hero-email" className="sr-only">
              Email address
            </Label>
            <Input
              id="hero-email"
              type="email"
              required
              placeholder="you@acme.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11"
            />
          </div>
          <Button type="submit" size="lg" className="h-11 shrink-0">
            {submitted ? "You're on the list" : "Get Started"}
            {!submitted && (
              <IconPlaceholder
                lucide="ArrowRight"
                tabler="IconArrowRight"
                hugeicons="ArrowRightIcon"
                phosphor="ArrowRight"
                remixicon="RiArrowRightLine"
                data-icon="inline-end"
                className="size-4"
              />
            )}
          </Button>
        </form>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <IconPlaceholder
            lucide="ShieldCheck"
            tabler="IconShieldCheck"
            hugeicons="Shield01Icon"
            phosphor="ShieldCheck"
            remixicon="RiShieldCheckLine"
            className="size-3.5"
          />
          No credit card required. Unsubscribe anytime.
        </p>
      </div>
    </section>
  )
}

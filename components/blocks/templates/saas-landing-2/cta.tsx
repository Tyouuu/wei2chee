"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

export default function Cta() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email) return
    setSubmitted(true)
  }

  return (
    <section className="flex w-full items-center justify-center px-6 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-2xl rounded-lg border border-border bg-muted/30 px-6 py-12 text-center sm:px-12 sm:py-16">
        <span className="mb-4 block text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Get Started
        </span>
        <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Start building with Acme today
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-base text-pretty text-muted-foreground">
          Join thousands of teams shipping faster. Get a 14-day free trial, no
          credit card required.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row"
        >
          <div className="flex-1 text-left">
            <Label htmlFor="cta-email" className="sr-only">
              Email address
            </Label>
            <Input
              id="cta-email"
              type="email"
              required
              placeholder="you@acme.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full"
            />
          </div>
          <Button type="submit" className="h-11 shrink-0">
            Start Free Trial
            <IconPlaceholder
              lucide="ArrowRight"
              tabler="IconArrowRight"
              hugeicons="ArrowRightIcon"
              phosphor="ArrowRight"
              remixicon="RiArrowRightLine"
              data-icon="inline-end"
              aria-hidden="true"
            />
          </Button>
        </form>

        <p
          className={cn(
            "mt-3 text-sm text-primary transition-opacity",
            submitted ? "opacity-100" : "opacity-0"
          )}
          aria-live="polite"
        >
          Thanks! Check your inbox to confirm your trial.
        </p>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <IconPlaceholder
            lucide="ShieldCheck"
            tabler="IconShieldCheck"
            hugeicons="Shield01Icon"
            phosphor="ShieldCheck"
            remixicon="RiShieldCheckLine"
            className="size-3.5"
            data-icon="inline-start"
            aria-hidden="true"
          />
          We respect your privacy. No spam, unsubscribe anytime.
        </p>
      </div>
    </section>
  )
}

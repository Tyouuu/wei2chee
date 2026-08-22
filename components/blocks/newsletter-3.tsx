"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type Status = "idle" | "loading" | "success" | "error"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function NewsletterBlock() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const submitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isLoading = status === "loading"

  useEffect(() => {
    return () => {
      if (submitTimer.current) clearTimeout(submitTimer.current)
    }
  }, [])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isLoading) return

    const value = email.trim()

    if (value.length === 0) {
      setStatus("error")
      setError("Please enter your email address.")
      return
    }

    if (!EMAIL_PATTERN.test(value)) {
      setStatus("error")
      setError("That doesn’t look like a valid email address.")
      return
    }

    setError(null)
    setStatus("loading")

    submitTimer.current = setTimeout(() => {
      setStatus("success")
    }, 1400)
  }

  function reset() {
    setEmail("")
    setError(null)
    setStatus("idle")
  }

  return (
    <section className="flex w-full items-center justify-center bg-muted/30 px-6 py-16 text-foreground">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <IconPlaceholder
              lucide="Send"
              tabler="IconSend"
              hugeicons="MailSendIcon"
              phosphor="PaperPlane"
              remixicon="RiMailSendLine"
              size={20}
              aria-hidden="true"
            />
          </span>
          <CardTitle className="mt-4 text-xl">
            Subscribe to the Acme digest
          </CardTitle>
          <CardDescription>
            Product updates, engineering deep-dives, and early access. Once a
            week, no spam.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {status === "success" ? (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card px-6 py-8 text-center">
              <span
                className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <IconPlaceholder
                  lucide="Check"
                  tabler="IconCheck"
                  hugeicons="Tick02Icon"
                  phosphor="Check"
                  remixicon="RiCheckLine"
                  size={26}
                />
              </span>
              <div className="space-y-1">
                <p className="text-base font-medium">You’re on the list</p>
                <p className="text-sm text-muted-foreground">
                  We sent a confirmation to{" "}
                  <span className="font-medium text-foreground">{email}</span>.
                  Check your inbox to finish signing up.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                className="mt-1"
              >
                <IconPlaceholder
                  lucide="RefreshCw"
                  tabler="IconRefresh"
                  hugeicons="RefreshIcon"
                  phosphor="ArrowsClockwise"
                  remixicon="RiRefreshLine"
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                Use a different email
              </Button>
            </div>
          ) : (
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="newsletter-email">Email address</Label>
                <Input
                  id="newsletter-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  disabled={isLoading}
                  aria-invalid={status === "error"}
                  aria-describedby={
                    status === "error" ? "newsletter-error" : undefined
                  }
                  onChange={(event) => {
                    setEmail(event.target.value)
                    if (status === "error") {
                      setStatus("idle")
                      setError(null)
                    }
                  }}
                  className={cn(
                    status === "error" &&
                      "border-destructive focus-visible:ring-destructive/30"
                  )}
                />
                {status === "error" && error ? (
                  <p
                    id="newsletter-error"
                    role="alert"
                    className="flex items-center gap-1.5 text-sm text-destructive"
                  >
                    <IconPlaceholder
                      lucide="CircleAlert"
                      tabler="IconAlertCircle"
                      hugeicons="AlertCircleIcon"
                      phosphor="WarningCircle"
                      remixicon="RiErrorWarningLine"
                      size={15}
                      className="shrink-0"
                      aria-hidden="true"
                    />
                    {error}
                  </p>
                ) : null}
              </div>

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    <span className="shimmer">Subscribing…</span>
                  </>
                ) : (
                  <>
                    <IconPlaceholder
                      lucide="Send"
                      tabler="IconSend"
                      hugeicons="MailSendIcon"
                      phosphor="PaperPlane"
                      remixicon="RiMailSendLine"
                      data-icon="inline-start"
                      aria-hidden="true"
                    />
                    Subscribe
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Join 24,000+ developers. Unsubscribe anytime.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

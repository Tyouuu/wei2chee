"use client"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

export default function Newsletter() {
  return (
    <section className="flex w-full items-center justify-center px-6 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-5xl rounded-xl border border-border bg-card px-8 py-10 sm:px-12 sm:py-14">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between md:gap-16">
          <div className="flex flex-col gap-4 md:max-w-sm">
            <Badge variant="secondary" className="tracking-widest uppercase">
              Acme Weekly
            </Badge>
            <h2 className="font-heading text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
              Insights that move your work forward
            </h2>
            <p className="text-sm text-muted-foreground">
              Product deep-dives, industry trends, and practical guides from the
              Acme team, landing in your inbox every Tuesday morning.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:max-w-md md:min-w-0 md:flex-1">
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                toast.success("You're subscribed. See you Tuesday!")
              }}
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  placeholder="work@company.com"
                  aria-label="Email address"
                  className="flex-1 border-border bg-background"
                />
                <Button type="submit" className="shrink-0">
                  Subscribe
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
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="newsletter-consent" name="consent" />
                <label
                  htmlFor="newsletter-consent"
                  className="text-sm font-normal text-muted-foreground"
                >
                  I agree to receive the Acme Weekly newsletter.
                </label>
              </div>
            </form>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <IconPlaceholder
                lucide="Lock"
                tabler="IconLock"
                hugeicons="LockIcon"
                phosphor="Lock"
                remixicon="RiLockLine"
                aria-hidden="true"
                className="shrink-0"
                size={12}
              />
              Your data stays private. Unsubscribe any time, no questions asked.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

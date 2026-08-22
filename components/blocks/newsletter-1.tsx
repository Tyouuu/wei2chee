"use client"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Toaster } from "@/components/ui/sonner"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

export default function NewsletterBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <Toaster />
      <div className="mx-auto flex w-full max-w-lg flex-col items-center text-center">
        <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Stay in the loop
        </h2>
        <p className="mt-3 text-base text-muted-foreground">
          Get product updates, curated articles, and early access to new Acme
          features, delivered weekly, no noise.
        </p>

        <form
          className="mt-8 flex w-full flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            toast.success("You're subscribed. Welcome aboard!")
          }}
        >
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              placeholder="you@company.com"
              aria-label="Email address"
              className="h-9 flex-1"
            />
            <Button type="submit" size="lg" className="shrink-0">
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
            </Button>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Checkbox id="newsletter-consent" name="consent" />
            <label
              htmlFor="newsletter-consent"
              className="text-sm font-normal text-muted-foreground"
            >
              I agree to receive marketing emails.
            </label>
          </div>
        </form>

        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <IconPlaceholder
            lucide="ShieldCheck"
            tabler="IconShieldCheck"
            hugeicons="Shield01Icon"
            phosphor="ShieldCheck"
            remixicon="RiShieldCheckLine"
            aria-hidden="true"
            className="shrink-0 text-muted-foreground"
            size={13}
          />
          No spam, ever. Unsubscribe at any time. We respect your privacy.
        </p>
      </div>
    </section>
  )
}

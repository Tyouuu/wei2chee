"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

function FauxPage() {
  return (
    <div
      className="mx-auto w-full max-w-3xl space-y-6 opacity-60"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between">
        <div className="h-6 w-28 rounded-md bg-muted" />
        <div className="flex gap-2">
          <div className="h-6 w-16 rounded-md bg-muted" />
          <div className="h-6 w-16 rounded-md bg-muted" />
        </div>
      </div>
      <div className="h-48 w-full rounded-lg bg-muted" />
      <div className="space-y-3">
        <div className="h-4 w-3/4 rounded-md bg-muted" />
        <div className="h-4 w-full rounded-md bg-muted" />
        <div className="h-4 w-5/6 rounded-md bg-muted" />
      </div>
    </div>
  )
}

export default function CookieConsentBlock() {
  const [open, setOpen] = React.useState(true)

  return (
    <section className="flex min-h-svh w-full items-start justify-center bg-background px-6 py-16 text-foreground">
      <FauxPage />
      <Dialog open={open} onOpenChange={setOpen} modal>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
              <IconPlaceholder
                lucide="ShieldCheck"
                tabler="IconShieldCheck"
                hugeicons="Shield01Icon"
                phosphor="ShieldCheck"
                remixicon="RiShieldCheckLine"
                className="size-5"
                aria-hidden="true"
              />
            </div>
            <DialogTitle className="mt-3 text-base">We Use Cookies</DialogTitle>
            <DialogDescription>
              We use cookies to keep you signed in, remember your preferences,
              and understand how the product is used. Read our{" "}
              <a href="#">cookie policy</a> for the details.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-1 sm:flex-col sm:gap-2">
            <Button className="w-full" onClick={() => setOpen(false)}>
              Accept All
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
              >
                Reject
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
              >
                Manage
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

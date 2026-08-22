"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

export default function CookieConsentBlock() {
  const [visible, setVisible] = React.useState(true)

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 w-full max-w-sm rounded-lg border border-border bg-background p-5 shadow-lg">
      <div className="flex items-center gap-2">
        <IconPlaceholder
          lucide="ShieldCheck"
          tabler="IconShieldCheck"
          hugeicons="Shield01Icon"
          phosphor="ShieldCheck"
          remixicon="RiShieldCheckLine"
          className="size-5 text-foreground"
          aria-hidden="true"
        />
        <h2 className="font-heading text-sm font-semibold text-foreground">
          We value your privacy
        </h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        We use cookies to enhance your browsing experience and analyze our
        traffic. You can accept all, reject, or set your own preferences.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => setVisible(false)}>Accept all</Button>
        <Button variant="outline" onClick={() => setVisible(false)}>
          Reject
        </Button>
        <Button variant="ghost" onClick={() => setVisible(false)}>
          Preferences
        </Button>
      </div>
    </div>
  )
}

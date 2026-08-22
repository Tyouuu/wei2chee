"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

export default function CookieConsentBlock() {
  const [analytics, setAnalytics] = React.useState(true)
  const [marketing, setMarketing] = React.useState(false)

  return (
    <div className="flex w-full items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Cookie preferences
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage how we use cookies to improve your experience. You can change
          these settings at any time.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="cookie-necessary"
                  className="text-sm font-medium text-foreground"
                >
                  Necessary
                </label>
                <Badge variant="secondary" className="px-1.5 text-[10px]">
                  Always on
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Required for the site to function
              </p>
            </div>
            <Switch id="cookie-necessary" checked disabled />
          </div>

          <Separator />

          <div className="flex items-start justify-between gap-4">
            <div>
              <label
                htmlFor="cookie-analytics"
                className="text-sm font-medium text-foreground"
              >
                Analytics
              </label>
              <p className="text-sm text-muted-foreground">
                Helps us understand how visitors use the site
              </p>
            </div>
            <Switch
              id="cookie-analytics"
              checked={analytics}
              onCheckedChange={(checked) => setAnalytics(checked)}
            />
          </div>

          <Separator />

          <div className="flex items-start justify-between gap-4">
            <div>
              <label
                htmlFor="cookie-marketing"
                className="text-sm font-medium text-foreground"
              >
                Marketing
              </label>
              <p className="text-sm text-muted-foreground">
                Used to deliver personalized ads and offers
              </p>
            </div>
            <Switch
              id="cookie-marketing"
              checked={marketing}
              onCheckedChange={(checked) => setMarketing(checked)}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <Button>Save preferences</Button>
          <Button variant="outline">Reject all</Button>
        </div>
      </div>
    </div>
  )
}

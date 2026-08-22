"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

/** An icon held in data and rendered later, e.g. `<item.icon className="size-4" />`. */
type IconRenderer = (props: IconProps) => React.ReactNode

type Topic = {
  id: string
  label: string
  description: string
  icon: IconRenderer
}

const topics: Topic[] = [
  {
    id: "product",
    label: "Product",
    description: "Release notes & roadmap",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Shapes"
        tabler="IconShape"
        hugeicons="ShapesIcon"
        phosphor="Shapes"
        remixicon="RiShapesLine"
        {...p}
      />
    ),
  },
  {
    id: "engineering",
    label: "Engineering",
    description: "Deep dives & best practices",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Code"
        tabler="IconCode"
        hugeicons="CodeIcon"
        phosphor="Code"
        remixicon="RiCodeSSlashLine"
        {...p}
      />
    ),
  },
  {
    id: "design",
    label: "Design",
    description: "Systems, craft & process",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Palette"
        tabler="IconPalette"
        hugeicons="PaintBoardIcon"
        phosphor="Palette"
        remixicon="RiPaletteLine"
        {...p}
      />
    ),
  },
]

export default function NewsletterBlock() {
  const [email, setEmail] = useState("")
  const [selected, setSelected] = useState<string[]>(["product"])
  const [submitted, setSubmitted] = useState(false)

  function toggleTopic(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || selected.length === 0) return
    setSubmitted(true)
  }

  return (
    <section className="flex w-full items-center justify-center bg-muted/30 px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-md">
        <Card className="[--card-spacing:--spacing(6)]">
          {submitted ? (
            <CardContent className="flex flex-col items-center gap-5 py-6 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                <IconPlaceholder
                  lucide="Inbox"
                  tabler="IconInbox"
                  hugeicons="InboxIcon"
                  phosphor="Tray"
                  remixicon="RiInboxLine"
                  aria-hidden="true"
                  size={26}
                />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="font-heading text-xl font-bold tracking-tight">
                  Check your inbox
                </h2>
                <p className="text-sm text-muted-foreground">
                  We sent a confirmation link to{" "}
                  <span className="font-medium text-foreground">{email}</span>.
                  Click it to start receiving the Acme newsletter.
                </p>
              </div>

              <div className="w-full rounded-lg border border-border bg-muted/40 p-4 text-left">
                <p className="text-xs font-medium text-muted-foreground">
                  Your selected topics
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {topics
                    .filter((t) => selected.includes(t.id))
                    .map((t) => (
                      <li
                        key={t.id}
                        className="inline-flex items-center gap-1 rounded-4xl bg-background px-2 py-1 text-xs font-medium ring-1 ring-border"
                      >
                        <t.icon aria-hidden="true" size={13} />
                        {t.label}
                      </li>
                    ))}
                </ul>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setSubmitted(false)}
              >
                Use a different email
              </Button>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-xl tracking-tight">
                  Subscribe To Acme
                </CardTitle>
                <CardDescription className="text-sm">
                  Pick the topics you care about. One email per week, no noise.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="flex flex-col gap-5"
                  onSubmit={handleSubmit}
                  noValidate
                >
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="newsletter-email">Email address</Label>
                    <Input
                      id="newsletter-email"
                      type="email"
                      required
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-sm font-medium">
                      What should we send you?
                    </legend>
                    {topics.map((topic) => {
                      const active = selected.includes(topic.id)
                      return (
                        <Label
                          key={topic.id}
                          htmlFor={`topic-${topic.id}`}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                            active
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background hover:bg-muted/50"
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-md",
                              active
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <topic.icon aria-hidden="true" size={18} />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="text-sm font-medium">
                              {topic.label}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {topic.description}
                            </span>
                          </span>
                          <Checkbox
                            id={`topic-${topic.id}`}
                            checked={active}
                            onCheckedChange={() => toggleTopic(topic.id)}
                            className="size-5 shrink-0"
                            aria-label={topic.label}
                          />
                        </Label>
                      )
                    })}
                  </fieldset>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!email.trim() || selected.length === 0}
                  >
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

                  <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <IconPlaceholder
                      lucide="ShieldCheck"
                      tabler="IconShieldCheck"
                      hugeicons="Shield01Icon"
                      phosphor="ShieldCheck"
                      remixicon="RiShieldCheckLine"
                      aria-hidden="true"
                      className="shrink-0"
                      size={13}
                    />
                    Double opt-in. Unsubscribe anytime, no questions asked.
                  </p>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </section>
  )
}

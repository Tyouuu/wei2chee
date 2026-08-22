"use client"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/sonner"
import { Textarea } from "@/components/ui/textarea"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const TOPICS = ["General inquiry", "Sales", "Support", "Partnership", "Other"]

const OFFICES = [
  {
    city: "San Francisco",
    address: "548 Market St, Suite 200, CA 94104",
    phone: "+1 (415) 555-0188",
  },
  {
    city: "Berlin",
    address: "Torstraße 35, 10119 Berlin, Germany",
    phone: "+49 30 555 0142",
  },
  {
    city: "Singapore",
    address: "12 Marina Blvd, #18-01, 018982",
    phone: "+65 6555 0117",
  },
]

/**
 * EVERY WORD THIS SECTION SHOWS, IN ONE OBJECT.
 *
 * The section was pulled from the @7Ovr registry with its own copy baked in as
 * module-level consts. That made it un-editable: the editor's AI writes into
 * PROPS (`set_text` in lib/portal/layout-ops.ts), and a block whose words live
 * in its source has no prop to write into. Selecting one and pressing 改文字
 * opened a panel with a single dropdown -- change the whole section, or nothing.
 *
 * Lifting the consts here changes nothing on screen: the component falls back
 * to exactly these values when no `copy` is passed. What it adds is a surface
 * the AI can reach, so a customer can say "put my own prices in" and get their
 * own prices rather than Acme's.
 *
 * GENERATED. Re-run the opener rather than editing this block by hand.
 */
export const copy = { TOPICS, OFFICES }
export type Copy = typeof copy


export default function ContactBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { TOPICS, OFFICES } = { ...copy, ...override }
  return (
    <section className="flex w-full items-center justify-center bg-muted/30 px-6 py-16 text-foreground">
      <Toaster />
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-10 max-w-2xl">
          <Badge variant="secondary">
            <IconPlaceholder
              lucide="Send"
              tabler="IconSend"
              hugeicons="MailSendIcon"
              phosphor="PaperPlane"
              remixicon="RiMailSendLine"
              data-icon="inline-start"
            />
            Contact
          </Badge>
          <h2 className="mt-4 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Let&apos;s talk about your project
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Send the Acme team a message or drop by one of our offices. We reply
            within one business day.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="w-full">
            <form
              className="flex flex-col gap-(--card-spacing)"
              onSubmit={(event) => {
                event.preventDefault()
                toast.success(
                  "Message sent. We'll reply within one business day."
                )
              }}
            >
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  Send a message
                </CardTitle>
                <CardDescription>
                  Tell us a bit about what you need.
                </CardDescription>
              </CardHeader>

              <Separator />

              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="name">Full name</FieldLabel>
                    <Input id="name" type="text" placeholder="Jane Doe" />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="email">Work email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      placeholder="jane@company.com"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="topic">Topic</FieldLabel>
                    <Select name="topic">
                      <SelectTrigger id="topic" className="w-full">
                        <SelectValue placeholder="Select a topic…" />
                      </SelectTrigger>
                      <SelectContent>
                        {TOPICS.map((topic) => (
                          <SelectItem key={topic} value={topic}>
                            {topic}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="message">Message</FieldLabel>
                    <Textarea
                      id="message"
                      rows={6}
                      className="min-h-32 resize-none"
                      placeholder="How can we help?"
                    />
                  </Field>
                </FieldGroup>
              </CardContent>

              <CardFooter className="flex flex-col items-stretch gap-4">
                <div className="flex items-center gap-2.5">
                  <Checkbox id="consent" name="consent" required />
                  <label
                    htmlFor="consent"
                    className="text-xs leading-snug font-normal text-muted-foreground"
                  >
                    I agree to the{" "}
                    <a
                      href="#"
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Privacy Policy
                    </a>
                    .
                  </label>
                </div>
                <Button type="submit" className="w-full">
                  <IconPlaceholder
                    lucide="Send"
                    tabler="IconSend"
                    hugeicons="MailSendIcon"
                    phosphor="PaperPlane"
                    remixicon="RiMailSendLine"
                    data-icon="inline-start"
                  />
                  Send Message
                </Button>
              </CardFooter>
            </form>
          </Card>

          <div className="flex flex-col gap-6">
            <div
              className="relative h-52 w-full overflow-hidden rounded-lg border border-border bg-muted/40"
              aria-hidden="true"
            >
              <div className="absolute inset-0 grid grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="border-r border-border/40 last:border-r-0"
                  />
                ))}
              </div>
              <div className="absolute inset-0 grid grid-rows-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="border-b border-border/40 last:border-b-0"
                  />
                ))}
              </div>

              {/* location radius */}
              <div className="absolute top-1/2 left-1/2 size-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/15 bg-primary/[0.03]" />
              <div className="absolute top-1/2 left-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20 bg-primary/[0.04]" />

              <span className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-background/70">
                <IconPlaceholder
                  lucide="MapPin"
                  tabler="IconMapPin2"
                  hugeicons="MapPinIcon"
                  phosphor="MapPin"
                  remixicon="RiMapPin2Line"
                  className="size-5"
                />
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
              {OFFICES.map((office) => (
                <Card key={office.city}>
                  <CardContent className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                      <IconPlaceholder
                        lucide="MapPin"
                        tabler="IconMapPin2"
                        hugeicons="MapPinIcon"
                        phosphor="MapPin"
                        remixicon="RiMapPin2Line"
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{office.city}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {office.address}
                      </p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <IconPlaceholder
                          lucide="Phone"
                          tabler="IconPhone"
                          hugeicons="TelephoneIcon"
                          phosphor="Phone"
                          remixicon="RiPhoneLine"
                          className="size-3.5"
                          aria-hidden="true"
                        />
                        {office.phone}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

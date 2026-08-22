"use client"
import { toast } from "sonner"

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
import { Toaster } from "@/components/ui/sonner"
import { Textarea } from "@/components/ui/textarea"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const TOPICS = ["General inquiry", "Sales", "Support", "Partnership", "Other"]

export default function ContactBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <Toaster />
      <Card className="w-full max-w-lg">
        <form
          className="flex flex-col gap-(--card-spacing)"
          onSubmit={(e) => {
            e.preventDefault()
            toast.success("Message sent. We'll reply within one business day.")
          }}
        >
          <CardHeader className="border-b">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-md border border-border bg-muted">
                <IconPlaceholder
                  lucide="Send"
                  tabler="IconSend"
                  hugeicons="MailSendIcon"
                  phosphor="PaperPlane"
                  remixicon="RiMailSendLine"
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </span>
              <div>
                <CardTitle className="text-sm font-semibold">
                  Contact us
                </CardTitle>
                <CardDescription>
                  We reply within one business day.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <FieldGroup>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="first-name">First name</FieldLabel>
                  <Input id="first-name" type="text" placeholder="Jane" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="last-name">Last name</FieldLabel>
                  <Input id="last-name" type="text" placeholder="Doe" />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="email">Work email</FieldLabel>
                <Input id="email" type="email" placeholder="jane@company.com" />
              </Field>

              <Field>
                <FieldLabel htmlFor="topic">Topic</FieldLabel>
                <Select name="topic">
                  <SelectTrigger id="topic" className="w-full">
                    <SelectValue placeholder="Select a topic…" />
                  </SelectTrigger>
                  <SelectContent>
                    {TOPICS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
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
                  placeholder="Tell us how we can help…"
                />
              </Field>
            </FieldGroup>
          </CardContent>

          <CardFooter className="flex flex-col items-stretch gap-4">
            <div className="flex items-center gap-2.5">
              <Checkbox id="consent" name="consent" />
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
    </section>
  )
}

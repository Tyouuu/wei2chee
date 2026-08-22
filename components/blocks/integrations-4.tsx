"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
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
import { Switch } from "@/components/ui/switch"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

type Integration = {
  id: string
  name: string
  description: string
  icon: typeof SlackMark
  category: string
  defaultConnected?: boolean
}

const integrations: Integration[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Send deploy alerts and digests to any channel.",
    icon: (p: IconProps) => <SlackMark {...p} />,
    category: "Messaging",
    defaultConnected: true,
  },
  {
    id: "github",
    name: "GitHub",
    description: "Sync pull requests, issues and CI status.",
    icon: (p: IconProps) => <GithubMark {...p} />,
    category: "Developer",
  },
  {
    id: "drive",
    name: "Acme Drive",
    description: "Back up exports and attachments automatically.",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="HardDrive"
        tabler="IconServer2"
        hugeicons="HardDriveIcon"
        phosphor="HardDrive"
        remixicon="RiHardDrive2Line"
        {...p}
      />
    ),
    category: "Storage",
  },
  {
    id: "mailer",
    name: "Mailer",
    description: "Trigger transactional emails from workflows.",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Mail"
        tabler="IconMail"
        hugeicons="MailIcon"
        phosphor="Envelope"
        remixicon="RiMailLine"
        {...p}
      />
    ),
    category: "Email",
  },
  {
    id: "datastore",
    name: "Datastore",
    description: "Stream events into your warehouse in real time.",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Layers"
        tabler="IconStack"
        hugeicons="Layers01Icon"
        phosphor="Stack"
        remixicon="RiStackLine"
        {...p}
      />
    ),
    category: "Analytics",
  },
  {
    id: "cdn",
    name: "Edge CDN",
    description: "Purge caches and manage edge config remotely.",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Cloud"
        tabler="IconCloud"
        hugeicons="CloudIcon"
        phosphor="Cloud"
        remixicon="RiCloudLine"
        {...p}
      />
    ),
    category: "Infra",
  },
]

export default function IntegrationsBlock() {
  const [connected, setConnected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      integrations.map((i) => [i.id, Boolean(i.defaultConnected)])
    )
  )

  const toggle = (id: string) =>
    setConnected((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <section className="flex w-full justify-center bg-muted/30 px-6 py-20 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 space-y-2">
          <Badge variant="secondary">
            <IconPlaceholder
              lucide="Layers"
              tabler="IconStack"
              hugeicons="Layers01Icon"
              phosphor="Stack"
              remixicon="RiStackLine"
              data-icon="inline-start"
              className="size-3.5"
            />
            Acme workspace
          </Badge>
          <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Integrations
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Connect your favorite tools to automate the boring parts of your
            workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {integrations.map((integration) => {
            const isOn = Boolean(connected[integration.id])
            const Icon = integration.icon
            return (
              <Card
                key={integration.id}
                className={cn(
                  "flex flex-col gap-0 transition-colors",
                  isOn && "border-primary/40 bg-primary/[0.03]"
                )}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground transition-colors",
                        isOn && "border-primary/30 bg-primary/10 text-primary"
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div className="space-y-0.5">
                      <CardTitle className="text-base leading-none">
                        {integration.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {integration.category}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={isOn}
                    onCheckedChange={() => toggle(integration.id)}
                    aria-label={`Toggle ${integration.name}`}
                  />
                </CardHeader>

                <CardContent className="flex-1 py-4">
                  <p className="text-sm text-muted-foreground">
                    {integration.description}
                  </p>
                </CardContent>

                <CardFooter className="items-center justify-between">
                  {isOn ? (
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                      <IconPlaceholder
                        lucide="Check"
                        tabler="IconCheck"
                        hugeicons="Tick02Icon"
                        phosphor="Check"
                        remixicon="RiCheckLine"
                        data-icon="inline-start"
                        className="size-3.5"
                      />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline">Not connected</Badge>
                  )}
                  <Button
                    variant={isOn ? "ghost" : "default"}
                    size="sm"
                    onClick={() => toggle(integration.id)}
                    className={cn(isOn && "text-muted-foreground")}
                  >
                    {isOn ? "Disconnect" : "Connect"}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// Brand marks are inlined rather than imported from an icon library: the rest
// of this file uses IconPlaceholder, which resolves to whichever icon set the
// consumer already has, and one brand import would drag a whole extra package
// into their install for a handful of glyphs.
type MarkProps = React.ComponentProps<"svg"> & { size?: number | string }

function GithubMark({ size = 24, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12.001 2C6.47598 2 2.00098 6.475 2.00098 12C2.00098 16.425 4.86348 20.1625 8.83848 21.4875C9.33848 21.575 9.52598 21.275 9.52598 21.0125C9.52598 20.775 9.51348 19.9875 9.51348 19.15C7.00098 19.6125 6.35098 18.5375 6.15098 17.975C6.03848 17.6875 5.55098 16.8 5.12598 16.5625C4.77598 16.375 4.27598 15.9125 5.11348 15.9C5.90098 15.8875 6.46348 16.625 6.65098 16.925C7.55098 18.4375 8.98848 18.0125 9.56348 17.75C9.65098 17.1 9.91348 16.6625 10.201 16.4125C7.97598 16.1625 5.65098 15.3 5.65098 11.475C5.65098 10.3875 6.03848 9.4875 6.67598 8.7875C6.57598 8.5375 6.22598 7.5125 6.77598 6.1375C6.77598 6.1375 7.61348 5.875 9.52598 7.1625C10.326 6.9375 11.176 6.825 12.026 6.825C12.876 6.825 13.726 6.9375 14.526 7.1625C16.4385 5.8625 17.276 6.1375 17.276 6.1375C17.826 7.5125 17.476 8.5375 17.376 8.7875C18.0135 9.4875 18.401 10.375 18.401 11.475C18.401 15.3125 16.0635 16.1625 13.8385 16.4125C14.201 16.725 14.5135 17.325 14.5135 18.2625C14.5135 19.6 14.501 20.675 14.501 21.0125C14.501 21.275 14.6885 21.5875 15.1885 21.4875C19.259 20.1133 21.9999 16.2963 22.001 12C22.001 6.475 17.526 2 12.001 2Z" />
    </svg>
  )
}

function SlackMark({ size = 24, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M6.52739 14.5136C6.52739 15.5966 5.64264 16.4814 4.55959 16.4814C3.47654 16.4814 2.5918 15.5966 2.5918 14.5136C2.5918 13.4305 3.47654 12.5458 4.55959 12.5458H6.52739V14.5136ZM7.51892 14.5136C7.51892 13.4305 8.40366 12.5458 9.48671 12.5458C10.5698 12.5458 11.4545 13.4305 11.4545 14.5136V19.4407C11.4545 20.5238 10.5698 21.4085 9.48671 21.4085C8.40366 21.4085 7.51892 20.5238 7.51892 19.4407V14.5136ZM9.48671 6.52715C8.40366 6.52715 7.51892 5.6424 7.51892 4.55935C7.51892 3.4763 8.40366 2.59155 9.48671 2.59155C10.5698 2.59155 11.4545 3.4763 11.4545 4.55935V6.52715H9.48671ZM9.48671 7.51867C10.5698 7.51867 11.4545 8.40342 11.4545 9.48647C11.4545 10.5695 10.5698 11.4543 9.48671 11.4543H4.55959C3.47654 11.4543 2.5918 10.5695 2.5918 9.48647C2.5918 8.40342 3.47654 7.51867 4.55959 7.51867H9.48671ZM17.4732 9.48647C17.4732 8.40342 18.3579 7.51867 19.4409 7.51867C20.524 7.51867 21.4087 8.40342 21.4087 9.48647C21.4087 10.5695 20.524 11.4543 19.4409 11.4543H17.4732V9.48647ZM16.4816 9.48647C16.4816 10.5695 15.5969 11.4543 14.5138 11.4543C13.4308 11.4543 12.546 10.5695 12.546 9.48647V4.55935C12.546 3.4763 13.4308 2.59155 14.5138 2.59155C15.5969 2.59155 16.4816 3.4763 16.4816 4.55935V9.48647ZM14.5138 17.4729C15.5969 17.4729 16.4816 18.3577 16.4816 19.4407C16.4816 20.5238 15.5969 21.4085 14.5138 21.4085C13.4308 21.4085 12.546 20.5238 12.546 19.4407V17.4729H14.5138ZM14.5138 16.4814C13.4308 16.4814 12.546 15.5966 12.546 14.5136C12.546 13.4305 13.4308 12.5458 14.5138 12.5458H19.4409C20.524 12.5458 21.4087 13.4305 21.4087 14.5136C21.4087 15.5966 20.524 16.4814 19.4409 16.4814H14.5138Z" />
    </svg>
  )
}

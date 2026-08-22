"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Toaster } from "@/components/ui/sonner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

type Filter = "All" | "Communication" | "Analytics" | "Payments" | "Dev Tools"

const filters: Filter[] = [
  "All",
  "Communication",
  "Analytics",
  "Payments",
  "Dev Tools",
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
export const copy = { filters }
export type Copy = typeof copy


type Integration = {
  name: string
  description: string
  category: Exclude<Filter, "All">
  Icon: typeof SlackMark
}

const integrations: Integration[] = [
  {
    name: "Slack",
    description: "Send alerts and approvals straight to your channels.",
    category: "Communication",
    Icon: (p: IconProps) => <SlackMark {...p} />,
  },
  {
    name: "Intercom",
    description: "Sync conversations and route tickets automatically.",
    category: "Communication",
    Icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Layers"
        tabler="IconStack"
        hugeicons="Layers01Icon"
        phosphor="Stack"
        remixicon="RiStackLine"
        {...p}
      />
    ),
  },
  {
    name: "Gmail",
    description: "Trigger workflows from inbound and outbound mail.",
    category: "Communication",
    Icon: (p: IconProps) => <GoogleMark {...p} />,
  },
  {
    name: "Mixpanel",
    description: "Stream product events into actionable funnels.",
    category: "Analytics",
    Icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="BarChart2"
        tabler="IconChartBar"
        hugeicons="BarChartIcon"
        phosphor="ChartBar"
        remixicon="RiBarChart2Line"
        {...p}
      />
    ),
  },
  {
    name: "Looker",
    description: "Embed dashboards and share live reports with teams.",
    category: "Analytics",
    Icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Layers"
        tabler="IconStack"
        hugeicons="Layers01Icon"
        phosphor="Stack"
        remixicon="RiStackLine"
        {...p}
      />
    ),
  },
  {
    name: "Stripe",
    description: "Reconcile payments, refunds and subscriptions.",
    category: "Payments",
    Icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="CreditCard"
        tabler="IconCreditCard"
        hugeicons="CreditCardIcon"
        phosphor="CreditCard"
        remixicon="RiBankCardFill"
        {...p}
      />
    ),
  },
  {
    name: "Paddle",
    description: "Handle global tax and merchant-of-record billing.",
    category: "Payments",
    Icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="CreditCard"
        tabler="IconCreditCard"
        hugeicons="CreditCardIcon"
        phosphor="CreditCard"
        remixicon="RiBankCardLine"
        {...p}
      />
    ),
  },
  {
    name: "GitHub",
    description: "Link commits and deploys to your release pipeline.",
    category: "Dev Tools",
    Icon: (p: IconProps) => <GithubMark {...p} />,
  },
  {
    name: "Sentry",
    description: "Capture errors and open issues without leaving Acme.",
    category: "Dev Tools",
    Icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="SquareTerminal"
        tabler="IconTerminal2"
        hugeicons="ComputerTerminal01Icon"
        phosphor="TerminalWindow"
        remixicon="RiTerminalBoxLine"
        {...p}
      />
    ),
  },
]

const categoryIcon: Record<Exclude<Filter, "All">, typeof SlackMark> = {
  Communication: (p: IconProps) => (
    <IconPlaceholder
      lucide="Layers"
      tabler="IconStack"
      hugeicons="Layers01Icon"
      phosphor="Stack"
      remixicon="RiStackLine"
      {...p}
    />
  ),
  Analytics: (p: IconProps) => (
    <IconPlaceholder
      lucide="BarChart2"
      tabler="IconChartBar"
      hugeicons="BarChartIcon"
      phosphor="ChartBar"
      remixicon="RiBarChart2Line"
      {...p}
    />
  ),
  Payments: (p: IconProps) => (
    <IconPlaceholder
      lucide="CircleDollarSign"
      tabler="IconCoin"
      hugeicons="DollarCircleIcon"
      phosphor="CurrencyCircleDollar"
      remixicon="RiMoneyDollarCircleLine"
      {...p}
    />
  ),
  "Dev Tools": (p: IconProps) => (
    <IconPlaceholder
      lucide="SquareTerminal"
      tabler="IconTerminal2"
      hugeicons="ComputerTerminal01Icon"
      phosphor="TerminalWindow"
      remixicon="RiTerminalBoxLine"
      {...p}
    />
  ),
}

export default function IntegrationsBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { filters } = { ...copy, ...override }
  const [query, setQuery] = useState("")
  const [active, setActive] = useState<Filter>("All")
  const [selected, setSelected] = useState<Integration | null>(null)
  const [notify, setNotify] = useState(true)

  const normalized = query.trim().toLowerCase()
  const results = integrations.filter((item) => {
    const matchesFilter = active === "All" || item.category === active
    const matchesQuery =
      normalized === "" ||
      item.name.toLowerCase().includes(normalized) ||
      item.description.toLowerCase().includes(normalized) ||
      item.category.toLowerCase().includes(normalized)
    return matchesFilter && matchesQuery
  })

  function openConnect(item: Integration) {
    setNotify(true)
    setSelected(item)
  }

  function handleConnect() {
    if (selected) {
      toast.success(`${selected.name} connected`, {
        description: notify
          ? `Notifications enabled for your ${selected.category} workflows.`
          : `Added to your ${selected.category} integrations.`,
      })
    }
    setSelected(null)
  }

  const SelectedIcon = selected?.Icon

  return (
    <section className="flex min-h-svh w-full justify-center bg-muted/30 px-6 py-16 text-foreground">
      <Toaster />
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col gap-4">
          <Badge variant="outline" className="w-fit">
            <IconPlaceholder
              lucide="Layers"
              tabler="IconStack"
              hugeicons="Layers01Icon"
              phosphor="Stack"
              remixicon="RiStackLine"
              data-icon="inline-start"
            />
            Integration directory
          </Badge>
          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Connect Acme to your stack
            </h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              Browse our directory of native integrations. Search by name or
              filter by category to find the right connection.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          <div className="relative w-full max-w-sm">
            <IconPlaceholder
              lucide="Search"
              tabler="IconSearch"
              hugeicons="SearchIcon"
              phosphor="MagnifyingGlass"
              remixicon="RiSearchLine"
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search integrations..."
              aria-label="Search integrations"
              className="h-9 pl-8 text-sm"
            />
          </div>

          <ToggleGroup type="multiple"
            variant="outline"
            size="sm"
            value={[active]}
            onValueChange={(value) => {
              const next = value[0] as Filter | undefined
              if (next) setActive(next)
            }}
            aria-label="Filter integrations by category"
            className="flex-wrap"
          >
            {filters.map((filter) => (
              <ToggleGroupItem
                key={filter}
                value={filter}
                aria-label={`Show ${filter} integrations`}
                className="text-xs font-medium tracking-wide"
              >
                {filter}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {results.length > 0 ? (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {results.map((item) => {
              const CategoryIcon = categoryIcon[item.category]
              return (
                <Card
                  key={item.name}
                  className="group/tile transition-shadow hover:ring-foreground/25"
                >
                  <CardContent className="flex h-full flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex size-10 items-center justify-center rounded-md bg-muted text-foreground">
                        <item.Icon className="size-5" aria-hidden="true" />
                      </div>
                      <Badge variant="secondary" className="gap-1">
                        <CategoryIcon data-icon="inline-start" />
                        {item.category}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-heading text-sm font-medium">
                        {item.name}
                      </h3>
                      <p className="text-xs/relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <div className="mt-auto pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openConnect(item)}
                        className="-ml-2 text-primary"
                      >
                        Connect
                        <IconPlaceholder
                          lucide="ArrowRight"
                          tabler="IconArrowRight"
                          hugeicons="ArrowRightIcon"
                          phosphor="ArrowRight"
                          remixicon="RiArrowRightLine"
                          className="transition-transform group-hover/tile:translate-x-0.5"
                        />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-6 py-16 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <IconPlaceholder
                lucide="Search"
                tabler="IconSearch"
                hugeicons="SearchIcon"
                phosphor="MagnifyingGlass"
                remixicon="RiSearchLine"
                className="size-5"
                aria-hidden="true"
              />
            </div>
            <p className="text-sm font-medium">No integrations found</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Try a different search term or clear the active filter.
            </p>
          </div>
        )}
      </div>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-background">
              {SelectedIcon && (
                <SelectedIcon className="size-5" aria-hidden="true" />
              )}
            </span>
            <DialogTitle className="mt-3">Connect {selected?.name}</DialogTitle>
            <DialogDescription>
              Authorize Acme to access your {selected?.name} account. This adds
              it to your{" "}
              <span className="text-foreground">{selected?.category}</span>{" "}
              integrations. You can disconnect any time.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workspace" className="text-xs font-medium">
                Workspace
              </Label>
              <Input
                id="workspace"
                defaultValue="acme-team"
                className="h-9 text-sm"
              />
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="notify" className="text-xs font-medium">
                  Enable notifications
                </Label>
                <span className="text-xs text-muted-foreground">
                  Send workflow updates to this integration.
                </span>
              </div>
              <Switch
                id="notify"
                checked={notify}
                onCheckedChange={setNotify}
                aria-label="Enable notifications"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild><Button variant="outline" >
              Cancel
            </Button></DialogClose>
            <Button onClick={handleConnect}>Connect {selected?.name}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function GoogleMark({ size = 24, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M3.06364 7.50914C4.70909 4.24092 8.09084 2 12 2C14.6954 2 16.959 2.99095 18.6909 4.60455L15.8227 7.47274C14.7864 6.48185 13.4681 5.97727 12 5.97727C9.39542 5.97727 7.19084 7.73637 6.40455 10.1C6.2045 10.7 6.09086 11.3409 6.09086 12C6.09086 12.6591 6.2045 13.3 6.40455 13.9C7.19084 16.2636 9.39542 18.0227 12 18.0227C13.3454 18.0227 14.4909 17.6682 15.3864 17.0682C16.4454 16.3591 17.15 15.3 17.3818 14.05H12V10.1818H21.4181C21.5364 10.8363 21.6 11.5182 21.6 12.2273C21.6 15.2727 20.5091 17.8363 18.6181 19.5773C16.9636 21.1046 14.7 22 12 22C8.09084 22 4.70909 19.7591 3.06364 16.4909C2.38638 15.1409 2 13.6136 2 12C2 10.3864 2.38638 8.85911 3.06364 7.50914Z" />
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

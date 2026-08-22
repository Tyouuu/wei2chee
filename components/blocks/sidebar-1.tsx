"use client"

import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

const mainNav = [
  {
    label: "Home",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Home"
        tabler="IconHome"
        hugeicons="HomeIcon"
        phosphor="House"
        remixicon="RiHome5Line"
        {...p}
      />
    ),
    active: false,
  },
  {
    label: "Dashboard",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="LayoutDashboard"
        tabler="IconDashboard"
        hugeicons="DashboardSquare01Icon"
        phosphor="SquaresFour"
        remixicon="RiDashboardLine"
        {...p}
      />
    ),
    active: true,
  },
  {
    label: "Analytics",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="ChartBar"
        tabler="IconChartBar"
        hugeicons="BarChartIcon"
        phosphor="ChartBar"
        remixicon="RiBarChartBoxLine"
        {...p}
      />
    ),
    active: false,
  },
  {
    label: "Projects",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Folder"
        tabler="IconFolder"
        hugeicons="FolderIcon"
        phosphor="Folder"
        remixicon="RiFolderLine"
        {...p}
      />
    ),
    active: false,
    badge: "4",
  },
]

const workspaceNav = [
  {
    label: "Team",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Users"
        tabler="IconUsersGroup"
        hugeicons="UserGroupIcon"
        phosphor="UsersThree"
        remixicon="RiTeamLine"
        {...p}
      />
    ),
  },
  {
    label: "Settings",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Settings"
        tabler="IconSettings"
        hugeicons="SettingsIcon"
        phosphor="GearSix"
        remixicon="RiSettings3Line"
        {...p}
      />
    ),
  },
]

const stats = [
  {
    label: "Open Tasks",
    value: "24",
    delta: "+3",
    up: true,
    note: "Vs. Last Week",
  },
  {
    label: "Deployments",
    value: "11",
    delta: "-2",
    up: false,
    note: "Vs. Last Week",
  },
  {
    label: "Team Members",
    value: "8",
    delta: "+1",
    up: true,
    note: "New This Month",
  },
  {
    label: "Uptime",
    value: "99.9%",
    delta: "+0.1%",
    up: true,
    note: "30-Day Average",
  },
]

const recentActivity = [
  {
    user: "Marcus Holt",
    initials: "MH",
    avatar: "https://i.pravatar.cc/150?img=13",
    action: "Merged pull request",
    target: "feat/auth-refresh",
    time: "2 Min Ago",
    done: true,
  },
  {
    user: "Priya Nair",
    initials: "PN",
    avatar: "https://i.pravatar.cc/150?img=45",
    action: "Opened issue",
    target: "Dashboard: chart overflow on mobile",
    time: "14 Min Ago",
    done: false,
  },
  {
    user: "Leon Fischer",
    initials: "LF",
    avatar: "https://i.pravatar.cc/150?img=8",
    action: "Deployed to production",
    target: "v2.4.1",
    time: "1 Hour Ago",
    done: true,
  },
  {
    user: "Suki Tanaka",
    initials: "ST",
    avatar: "https://i.pravatar.cc/150?img=29",
    action: "Created project",
    target: "Rebrand: Q3",
    time: "3 Hours Ago",
    done: false,
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
export const copy = { stats, recentActivity }
export type Copy = typeof copy


export default function SidebarBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { stats, recentActivity } = { ...copy, ...override }
  const [query, setQuery] = React.useState("")
  const normalized = query.trim().toLowerCase()
  const filteredActivity = normalized
    ? recentActivity.filter((item) =>
        [item.user, item.action, item.target].some((field) =>
          field.toLowerCase().includes(normalized)
        )
      )
    : recentActivity

  return (
    <SidebarProvider defaultOpen className="min-h-svh">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex h-10 items-center gap-2.5 px-2">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="size-5 shrink-0 text-primary"
            >
              <rect
                x="3"
                y="3"
                width="8"
                height="8"
                transform="rotate(-6 7 7)"
              />
              <rect
                x="3"
                y="13"
                width="8"
                height="8"
                transform="rotate(5 7 17)"
              />
              <rect
                x="13"
                y="13"
                width="8"
                height="8"
                transform="rotate(-4 17 17)"
              />
              <rect
                x="13"
                y="3"
                width="8"
                height="8"
                transform="rotate(15 17 7)"
              />
            </svg>
            <span className="text-sm font-bold tracking-tight group-data-[collapsible=icon]:hidden">
              Acme Corp
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNav.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      isActive={item.active}
                      tooltip={item.label}
                     
                     asChild><a href="#" >
                      <item.icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </a></SidebarMenuButton>
                    {item.badge && (
                      <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {workspaceNav.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      tooltip={item.label}
                     
                     asChild><a href="#" >
                      <item.icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </a></SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="flex items-center gap-3 p-1">
            <Avatar className="size-8 shrink-0">
              <AvatarImage
                src="https://i.pravatar.cc/150?img=47"
                alt="Ada Lovelace"
                className="grayscale"
              />
              <AvatarFallback>AL</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold">Ada Lovelace</p>
              <p className="truncate text-xs text-muted-foreground">
                ada@acme.com
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground transition-colors duration-150 group-data-[collapsible=icon]:hidden hover:text-foreground"
              aria-label="Sign out"
            >
              <IconPlaceholder
                lucide="LogOut"
                tabler="IconLogout"
                hugeicons="Logout01Icon"
                phosphor="SignOut"
                remixicon="RiLogoutBoxRLine"
                aria-hidden="true"
              />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b border-border px-5">
          <SidebarTrigger className="-ml-1" />
          <div>
            <h1 className="font-heading text-sm font-bold tracking-tight">
              Dashboard
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Input
              type="search"
              placeholder="Search activity…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="hidden w-48 sm:inline-flex"
              aria-label="Search activity"
            />
            <Button
              variant="outline"
              size="icon"
              className="relative"
              aria-label="Notifications"
            >
              <IconPlaceholder
                lucide="Bell"
                tabler="IconNotification"
                hugeicons="NotificationIcon"
                phosphor="Notification"
                remixicon="RiNotification3Line"
                aria-hidden="true"
              />
              <span
                className="absolute top-1.5 right-1.5 size-1.5 bg-primary"
                aria-hidden="true"
              />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight">
                Good morning, Ada
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Here&apos;s what&apos;s happening across your projects today.
              </p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0">
              <IconPlaceholder
                lucide="Clock"
                tabler="IconClock"
                hugeicons="TimeIcon"
                phosphor="Clock"
                remixicon="RiTimeLine"
                className="mr-1.5 size-3.5"
                aria-hidden="true"
              />
              Jun 20, 2026
            </Button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-shadow duration-150 hover:shadow-sm"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {s.label}
                </p>
                <p className="text-2xl font-bold tracking-tight">{s.value}</p>
                <div className="flex items-center gap-1.5">
                  {s.up ? (
                    <IconPlaceholder
                      lucide="ArrowUp"
                      tabler="IconArrowUp"
                      hugeicons="ArrowUpIcon"
                      phosphor="ArrowUp"
                      remixicon="RiArrowUpLine"
                      className="size-3.5 text-foreground"
                      aria-hidden="true"
                    />
                  ) : (
                    <IconPlaceholder
                      lucide="ArrowDown"
                      tabler="IconArrowDown"
                      hugeicons="ArrowDownIcon"
                      phosphor="ArrowDown"
                      remixicon="RiArrowDownLine"
                      className="size-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={
                      "text-xs font-semibold " +
                      (s.up ? "text-foreground" : "text-muted-foreground")
                    }
                  >
                    {s.delta}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.note}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between gap-4 pb-3">
              <h3 className="font-heading text-sm font-semibold tracking-tight">
                Recent Activity
              </h3>
              <Button
               
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
               
               asChild><a href="#" >
                View All
              </a></Button>
            </div>

            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {filteredActivity.length === 0 && (
                <p className="px-4 py-10 text-center text-xs text-muted-foreground">
                  No activity matches “{query}”.
                </p>
              )}
              {filteredActivity.map((item) => (
                <div
                  key={`${item.user}-${item.time}`}
                  className="flex items-center gap-4 px-4 py-3 transition-colors duration-150 hover:bg-muted/50"
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarImage
                      src={item.avatar}
                      alt={item.user}
                      className="grayscale"
                    />
                    <AvatarFallback className="text-[10px]">
                      {item.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-semibold">{item.user}</span>
                      <span className="text-sm text-muted-foreground">
                        {item.action}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.target}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {item.done ? (
                      <IconPlaceholder
                        lucide="CircleCheck"
                        tabler="IconCircleCheck"
                        hugeicons="CheckmarkCircle02Icon"
                        phosphor="CheckCircle"
                        remixicon="RiCheckboxCircleLine"
                        className="size-4 text-foreground"
                        aria-label="Completed"
                      />
                    ) : (
                      <IconPlaceholder
                        lucide="Clock"
                        tabler="IconClock"
                        hugeicons="TimeIcon"
                        phosphor="Clock"
                        remixicon="RiTimeLine"
                        className="size-4 text-muted-foreground"
                        aria-label="In progress"
                      />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {item.time}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground"
                            aria-label={`Actions for ${item.user}`}
                          >
                            <IconPlaceholder
                              lucide="Ellipsis"
                              tabler="IconDots"
                              hugeicons="MoreHorizontalIcon"
                              phosphor="DotsThree"
                              remixicon="RiMoreLine"
                              aria-hidden="true"
                            />
                          </Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem>
                          <IconPlaceholder
                            lucide="Eye"
                            tabler="IconEye"
                            hugeicons="EyeIcon"
                            phosphor="Eye"
                            remixicon="RiEyeLine"
                            aria-hidden="true"
                          />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <IconPlaceholder
                            lucide="User"
                            tabler="IconUser"
                            hugeicons="UserIcon"
                            phosphor="User"
                            remixicon="RiUser3Line"
                            aria-hidden="true"
                          />
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Mark as Read</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

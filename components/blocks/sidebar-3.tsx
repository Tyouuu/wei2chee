"use client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import type * as React from "react"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

/** An icon held in data and rendered later, e.g. `<item.icon className="size-4" />`. */
type IconRenderer = (props: IconProps) => React.ReactNode

type NavItem = {
  label: string
  icon: IconRenderer
  active?: boolean
  badge?: string
}

const navGroups: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Overview",
    items: [
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
      },
    ],
  },
  {
    heading: "Workspace",
    items: [
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
        badge: "6",
      },
      {
        label: "Calendar",
        icon: (p: IconProps) => (
          <IconPlaceholder
            lucide="Calendar"
            tabler="IconCalendar"
            hugeicons="CalendarIcon"
            phosphor="Calendar"
            remixicon="RiCalendarLine"
            {...p}
          />
        ),
      },
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
        badge: "3",
      },
    ],
  },
  {
    heading: "System",
    items: [
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
      {
        label: "Support",
        icon: (p: IconProps) => (
          <IconPlaceholder
            lucide="LifeBuoy"
            tabler="IconLifebuoy"
            hugeicons="LifebuoyIcon"
            phosphor="Lifebuoy"
            remixicon="RiLifebuoyLine"
            {...p}
          />
        ),
      },
    ],
  },
]

export default function SidebarBlock() {
  return (
    <SidebarProvider className="min-h-svh text-foreground">
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
          <div className="flex items-center gap-2.5 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 p-2"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-full text-primary"
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
            </div>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-bold tracking-tight">Acme</p>
              <p className="truncate text-xs text-muted-foreground">
                Workspace
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="gap-2 py-2">
          {navGroups.map((group) => (
            <SidebarGroup key={group.heading}>
              <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest uppercase">
                {group.heading}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        size="lg"
                        isActive={item.active}
                        tooltip={
                          item.badge
                            ? `${item.label} (${item.badge})`
                            : item.label
                        }
                       
                        aria-current={item.active ? "page" : undefined}
                        className="group-data-[collapsible=icon]:justify-center"
                       asChild><a href="#" >
                        <item.icon aria-hidden="true" />
                        <span className="group-data-[collapsible=icon]:hidden">
                          {item.label}
                        </span>
                      </a></SidebarMenuButton>
                      {item.badge && (
                        <SidebarMenuBadge className="top-1/2 -translate-y-1/2 tabular-nums">
                          {item.badge}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          <div className="flex items-center gap-3 p-1 group-data-[collapsible=icon]:justify-center">
            <Avatar className="size-9 shrink-0">
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
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-muted/30">
        <header className="flex h-16 items-center gap-3 border-b border-border px-4 sm:px-6">
          <SidebarTrigger className="-ml-1" />
          <div className="h-7 w-40 rounded-md bg-muted" aria-hidden="true" />
          <div
            className="ml-auto h-8 w-24 rounded-lg bg-muted/70"
            aria-hidden="true"
          />
        </header>

        <div className="flex min-w-0 flex-1 flex-col p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-5"
                aria-hidden="true"
              >
                <div className="h-4 w-1/2 rounded-md bg-muted" />
                <div className="h-8 w-2/3 rounded-md bg-muted/80" />
                <div className="h-3 w-full rounded-md bg-muted/50" />
                <div className="h-3 w-4/5 rounded-md bg-muted/50" />
              </div>
            ))}
          </div>
          <div
            className="mt-4 flex-1 rounded-lg border border-border bg-card/40"
            aria-hidden="true"
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

"use client"

import * as React from "react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

const navItems = [
  {
    label: "Overview",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="LayoutGrid"
        tabler="IconLayoutGrid"
        hugeicons="LayoutGridIcon"
        phosphor="GridFour"
        remixicon="RiLayoutGridLine"
        {...p}
      />
    ),
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
  {
    label: "Projects",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Folder"
        tabler="IconFolder"
        hugeicons="FolderIcon"
        phosphor="Folder"
        remixicon="RiFolder3Line"
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

const notifications = [
  {
    id: 1,
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Rocket"
        tabler="IconRocket"
        hugeicons="RocketIcon"
        phosphor="Rocket"
        remixicon="RiRocketLine"
        {...p}
      />
    ),
    title: "Deployment succeeded",
    detail: "acme-web v2.4 is live in production.",
    time: "2 Min Ago",
    unread: true,
    tone: "primary" as const,
  },
  {
    id: 2,
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="UserPlus"
        tabler="IconUserPlus"
        hugeicons="UserAddIcon"
        phosphor="UserPlus"
        remixicon="RiUserAddLine"
        {...p}
      />
    ),
    title: "New team member",
    detail: "Priya Nair accepted your invite.",
    time: "1 Hour Ago",
    unread: true,
    tone: "primary" as const,
  },
  {
    id: 3,
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="CircleAlert"
        tabler="IconAlertCircle"
        hugeicons="AlertCircleIcon"
        phosphor="WarningCircle"
        remixicon="RiErrorWarningLine"
        {...p}
      />
    ),
    title: "Usage at 80%",
    detail: "You're approaching your monthly request limit.",
    time: "3 Hours Ago",
    unread: false,
    tone: "destructive" as const,
  },
]

const recentItems = [
  {
    label: "Acme Web Redesign",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Folder"
        tabler="IconFolder"
        hugeicons="FolderIcon"
        phosphor="Folder"
        remixicon="RiFolder3Line"
        {...p}
      />
    ),
  },
  {
    label: "Q3 Analytics report",
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
  {
    label: "Priya Nair",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="User"
        tabler="IconUser"
        hugeicons="UserIcon"
        phosphor="User"
        remixicon="RiUser3Line"
        {...p}
      />
    ),
  },
]

const commands = [
  {
    label: "Go to Overview",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="LayoutGrid"
        tabler="IconLayoutGrid"
        hugeicons="LayoutGridIcon"
        phosphor="GridFour"
        remixicon="RiLayoutGridLine"
        {...p}
      />
    ),
    shortcut: ["G", "O"],
  },
  {
    label: "Go to Analytics",
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
    shortcut: ["G", "A"],
  },
  {
    label: "Go to Projects",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Folder"
        tabler="IconFolder"
        hugeicons="FolderIcon"
        phosphor="Folder"
        remixicon="RiFolder3Line"
        {...p}
      />
    ),
    shortcut: ["G", "P"],
  },
  {
    label: "Go to Team",
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
    shortcut: ["G", "T"],
  },
  {
    label: "Invite a teammate",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="UserPlus"
        tabler="IconUserPlus"
        hugeicons="UserAddIcon"
        phosphor="UserPlus"
        remixicon="RiUserAddLine"
        {...p}
      />
    ),
    shortcut: ["I"],
  },
  {
    label: "Open settings",
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
    shortcut: ["⌘", ","],
  },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [activeNav, setActiveNav] = React.useState("Overview")
  const [commandOpen, setCommandOpen] = React.useState(false)
  const [notes, setNotes] = React.useState(notifications)
  const unreadCount = notes.filter((n) => n.unread).length
  const markAllRead = () =>
    setNotes((prev) => prev.map((n) => ({ ...n, unread: false })))

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setCommandOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <SidebarProvider className="min-h-svh bg-muted/30 text-foreground">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex h-10 items-center gap-2 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="size-5 shrink-0 text-foreground"
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
            <span className="truncate text-base font-semibold group-data-[collapsible=icon]:hidden">
              Acme
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    isActive={activeNav === item.label}
                    tooltip={item.label}
                    onClick={() => setActiveNav(item.label)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <AccountMenu
                trigger={
                  <SidebarMenuButton
                    size="lg"
                    tooltip="Account"
                    className="gap-2 group-data-[collapsible=icon]:justify-center"
                  >
                    <Avatar size="sm">
                      <AvatarImage
                        src="https://i.pravatar.cc/150?img=15"
                        alt="Avery Cole"
                        className="grayscale"
                      />
                      <AvatarFallback>AC</AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
                      <span className="truncate text-xs font-medium">
                        Avery Cole
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        avery@acme.com
                      </span>
                    </span>
                  </SidebarMenuButton>
                }
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
          <SidebarTrigger className="-ml-1" />

          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="relative flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
          >
            <IconPlaceholder
              lucide="Search"
              tabler="IconSearch"
              hugeicons="SearchIcon"
              phosphor="MagnifyingGlass"
              remixicon="RiSearchLine"
              className="size-4 shrink-0"
              aria-hidden="true"
            />
            <span className="flex-1 text-left">Search projects, people...</span>
            <KbdGroup className="hidden sm:inline-flex">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild><Button
                    variant="ghost"
                    size="icon"
                    aria-label="Notifications"
                    className="relative"
                  >
                    <IconPlaceholder
                      lucide="Bell"
                      tabler="IconNotification"
                      hugeicons="NotificationIcon"
                      phosphor="Notification"
                      remixicon="RiNotification3Line"
                      className="size-5"
                    />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-md bg-primary text-[9px] leading-none font-bold text-primary-foreground ring-2 ring-background">
                        {unreadCount}
                      </span>
                    )}
                  </Button></SheetTrigger>
              <SheetContent className="w-full sm:max-w-sm">
                <SheetHeader className="gap-0.5 border-b border-border">
                  <SheetTitle>Notifications</SheetTitle>
                  <SheetDescription>
                    {unreadCount > 0
                      ? `${unreadCount} unread updates`
                      : "You're all caught up"}
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-1 flex-col overflow-y-auto">
                  {notes.map((note) => (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() =>
                        setNotes((prev) =>
                          prev.map((n) =>
                            n.id === note.id ? { ...n, unread: false } : n
                          )
                        )
                      }
                      className={[
                        "flex items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                        note.unread ? "bg-muted/30" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <span
                        className={[
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
                          note.tone === "destructive"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-primary/10 text-primary",
                        ].join(" ")}
                      >
                        <note.icon className="size-4" aria-hidden="true" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {note.title}
                          </p>
                          <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                            {note.time}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {note.detail}
                        </p>
                      </div>
                      {note.unread && (
                        <span
                          className="mt-1.5 size-2 shrink-0 bg-primary"
                          aria-label="Unread"
                        />
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-border p-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={markAllRead}
                    disabled={unreadCount === 0}
                  >
                    Mark all read
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      toast("Notifications", {
                        description: "Opening all notifications.",
                      })
                    }
                  >
                    View all
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <AccountMenu
              trigger={
                <Button variant="ghost" size="icon" aria-label="Account menu">
                  <Avatar>
                    <AvatarImage
                      src="https://i.pravatar.cc/150?img=15"
                      alt="Avery Cole"
                      className="grayscale"
                    />
                    <AvatarFallback>AC</AvatarFallback>
                  </Avatar>
                </Button>
              }
            />
          </div>
        </header>

        {/* A div, not a <main>: SidebarInset already renders the page's main
            landmark, and nesting a second one is invalid and gives a screen
            reader two "main" regions. */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">{children}</div>
      </SidebarInset>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <Command>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Recent">
              {recentItems.map((item) => (
                <CommandItem
                  key={item.label}
                  value={item.label}
                  onSelect={() => {
                    setCommandOpen(false)
                    toast(item.label, { description: "Opening recent item." })
                  }}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Commands">
              {commands.map((command) => (
                <CommandItem
                  key={command.label}
                  value={command.label}
                  onSelect={() => {
                    setCommandOpen(false)
                    toast(command.label, { description: "Command executed." })
                  }}
                >
                  <command.icon />
                  <span>{command.label}</span>
                  <CommandShortcut>
                    <KbdGroup>
                      {command.shortcut.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </KbdGroup>
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </SidebarProvider>
  )
}

function AccountMenu({ trigger }: { trigger: React.ReactElement }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="flex flex-col px-2 py-1.5">
          <span className="text-xs font-medium text-foreground">
            Avery Cole
          </span>
          <span className="text-xs text-muted-foreground">avery@acme.com</span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            toast("Account", { description: "Opening your account." })
          }
        >
          <IconPlaceholder
            lucide="User"
            tabler="IconUser"
            hugeicons="UserIcon"
            phosphor="User"
            remixicon="RiUser3Line"
          />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            toast("Settings", { description: "Opening your settings." })
          }
        >
          <IconPlaceholder
            lucide="Settings"
            tabler="IconSettings"
            hugeicons="SettingsIcon"
            phosphor="GearSix"
            remixicon="RiSettings3Line"
          />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() =>
            toast.success("Logged out", { description: "See you soon." })
          }
        >
          <IconPlaceholder
            lucide="LogOut"
            tabler="IconLogout"
            hugeicons="Logout01Icon"
            phosphor="SignOut"
            remixicon="RiLogoutBoxRLine"
          />
          Log Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

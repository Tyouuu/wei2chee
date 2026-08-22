"use client"

import React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

const members: Record<string, { name: string; avatar: string }> = {
  KS: { name: "Kenji Sato", avatar: "https://i.pravatar.cc/150?img=11" },
  LM: { name: "Layla Mori", avatar: "https://i.pravatar.cc/150?img=23" },
  TP: { name: "Tariq Patel", avatar: "https://i.pravatar.cc/150?img=14" },
  RM: { name: "Roma Müller", avatar: "https://i.pravatar.cc/150?img=32" },
  SJ: { name: "Sofia Jiménez", avatar: "https://i.pravatar.cc/150?img=44" },
  NW: { name: "Noa Weiss", avatar: "https://i.pravatar.cc/150?img=5" },
  AL: { name: "André Lefèvre", avatar: "https://i.pravatar.cc/150?img=68" },
  CB: { name: "Chloe Byrne", avatar: "https://i.pravatar.cc/150?img=47" },
}

const projects = [
  {
    name: "Website Redesign",
    description: "Revamp the public-facing marketing site and docs hub.",
    status: "In Progress",
    dueDate: "Jun 30",
    progress: 68,
    memberKeys: ["KS", "LM", "TP"],
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    imageAlt: "Analytics dashboard on a laptop screen",
  },
  {
    name: "Mobile App v2",
    description: "Next major release with offline sync and push notifications.",
    status: "Planning",
    dueDate: "Jul 15",
    progress: 24,
    memberKeys: ["RM", "SJ"],
    image:
      "https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800&q=80",
    imageAlt: "Source code on a dark editor screen",
  },
  {
    name: "API Gateway",
    description: "Unified gateway layer across all internal microservices.",
    status: "Review",
    dueDate: "Jun 22",
    progress: 91,
    memberKeys: ["NW", "AL", "CB"],
    image:
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80",
    imageAlt: "Server racks in a data center",
  },
]

const tasks = [
  {
    title: "Finalize design tokens",
    assigneeKey: "KS",
    priority: "High",
    done: false,
  },
  {
    title: "Write integration tests",
    assigneeKey: "RM",
    priority: "Medium",
    done: false,
  },
  {
    title: "Deploy staging environment",
    assigneeKey: "LM",
    priority: "High",
    done: true,
  },
  {
    title: "Update API documentation",
    assigneeKey: "NW",
    priority: "Low",
    done: false,
  },
  {
    title: "Accessibility audit",
    assigneeKey: "TP",
    priority: "Medium",
    done: true,
  },
]

const activity = [
  {
    actorKey: "KS",
    action: "merged",
    target: "#241 Add dark mode support",
    time: "2 Min Ago",
    icon: "merge",
  },
  {
    actorKey: "LM",
    action: "commented on",
    target: "Website Redesign milestone",
    time: "18 Min Ago",
    icon: "comment",
  },
  {
    actorKey: "RM",
    action: "closed issue",
    target: "#198 Button focus ring",
    time: "1 Hour Ago",
    icon: "close",
  },
  {
    actorKey: "TP",
    action: "opened pull request",
    target: "#242 Tabs refactor",
    time: "3 Hours Ago",
    icon: "pr",
  },
  {
    actorKey: "NW",
    action: "created task",
    target: "Update API documentation",
    time: "5 Hours Ago",
    icon: "task",
  },
]

const statusConfig: Record<
  string,
  { variant: "default" | "secondary" | "outline"; dot: string }
> = {
  "In Progress": { variant: "default", dot: "bg-primary-foreground" },
  Planning: { variant: "outline", dot: "bg-muted-foreground" },
  Review: { variant: "secondary", dot: "bg-foreground" },
}

const priorityConfig: Record<
  string,
  { variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  High: { variant: "destructive" },
  Medium: { variant: "secondary" },
  Low: { variant: "outline" },
}

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
export const copy = { members, projects, tasks, activity, statusConfig, priorityConfig }
export type Copy = typeof copy


const activityIcon: Record<string, React.ReactNode> = {
  merge: (
    <IconPlaceholder
      lucide="GitMerge"
      tabler="IconGitMerge"
      hugeicons="GitMergeIcon"
      phosphor="GitMerge"
      remixicon="RiGitMergeLine"
      className="size-3.5"
      aria-hidden="true"
    />
  ),
  comment: (
    <IconPlaceholder
      lucide="MessageCircle"
      tabler="IconMessageCircle"
      hugeicons="Message01Icon"
      phosphor="ChatCircle"
      remixicon="RiChat1Line"
      className="size-3.5"
      aria-hidden="true"
    />
  ),
  close: (
    <IconPlaceholder
      lucide="CircleX"
      tabler="IconCircleX"
      hugeicons="CancelCircleIcon"
      phosphor="XCircle"
      remixicon="RiCloseCircleLine"
      className="size-3.5"
      aria-hidden="true"
    />
  ),
  pr: (
    <IconPlaceholder
      lucide="GitPullRequest"
      tabler="IconGitPullRequest"
      hugeicons="GitPullRequestIcon"
      phosphor="GitPullRequest"
      remixicon="RiGitPullRequestLine"
      className="size-3.5"
      aria-hidden="true"
    />
  ),
  task: (
    <IconPlaceholder
      lucide="ListChecks"
      tabler="IconChecklist"
      hugeicons="TaskIcon"
      phosphor="ListChecks"
      remixicon="RiTaskLine"
      className="size-3.5"
      aria-hidden="true"
    />
  ),
}

const navCommands = [
  {
    label: "View Projects",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="ListChecks"
        tabler="IconChecklist"
        hugeicons="TaskIcon"
        phosphor="ListChecks"
        remixicon="RiTaskLine"
        {...p}
      />
    ),
  },
  {
    label: "View Tasks",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="CircleCheck"
        tabler="IconCircleCheck"
        hugeicons="CheckmarkCircle02Icon"
        phosphor="CheckCircle"
        remixicon="RiCheckboxCircleLine"
        {...p}
      />
    ),
  },
  {
    label: "View Activity",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Clock"
        tabler="IconClock"
        hugeicons="TimeIcon"
        phosphor="Clock"
        remixicon="RiTimeLine"
        {...p}
      />
    ),
  },
]

const actionCommands = [
  {
    label: "New Project",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Plus"
        tabler="IconPlus"
        hugeicons="Add01Icon"
        phosphor="Plus"
        remixicon="RiAddLine"
        {...p}
      />
    ),
  },
  {
    label: "View Profile",
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

export default function AppShellBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { members, projects, tasks, activity, statusConfig, priorityConfig } = { ...copy, ...override }
  const [commandOpen, setCommandOpen] = React.useState(false)
  const [taskList, setTaskList] = React.useState(tasks)

  function toggleTask(title: string) {
    setTaskList((prev) =>
      prev.map((t) => (t.title === title ? { ...t, done: !t.done } : t))
    )
  }

  function removeTask(title: string) {
    setTaskList((prev) => prev.filter((t) => t.title !== title))
  }

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
    <section className="flex min-h-svh w-full flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background/95 px-6 backdrop-blur-sm">
        <div className="flex shrink-0 items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="size-5 shrink-0 text-foreground"
          >
            <rect x="3" y="3" width="8" height="8" transform="rotate(-6 7 7)" />
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
          <span className="text-sm font-semibold tracking-tight">Acme</span>
        </div>

        <Separator
          orientation="vertical"
          className="-my-px shrink-0 self-stretch"
        />

        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="flex h-8 max-w-xs flex-1 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <IconPlaceholder
            lucide="Search"
            tabler="IconSearch"
            hugeicons="SearchIcon"
            phosphor="MagnifyingGlass"
            remixicon="RiSearchLine"
            className="size-3.5 shrink-0"
            aria-hidden="true"
          />
          <span className="flex-1 text-left">Search projects, tasks…</span>
          <KbdGroup className="hidden sm:inline-flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="h-8 gap-1.5 text-xs">
            <IconPlaceholder
              lucide="Plus"
              tabler="IconPlus"
              hugeicons="Add01Icon"
              phosphor="Plus"
              remixicon="RiAddLine"
              className="size-3.5"
              aria-hidden="true"
            />
            New Project
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="cursor-pointer outline-none"
              aria-label="User menu"
            >
              <Avatar className="size-7 ring-1 ring-border ring-offset-1 ring-offset-background transition-opacity hover:opacity-80">
                <AvatarImage
                  src={members.KS.avatar}
                  alt={members.KS.name}
                  className="grayscale"
                />
                <AvatarFallback className="text-[10px]">KS</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Avatar className="size-6">
                  <AvatarImage
                    src={members.KS.avatar}
                    alt={members.KS.name}
                    className="grayscale"
                  />
                  <AvatarFallback className="text-[9px]">KS</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-xs font-medium">Kenji Sato</span>
                  <span className="text-[10px] text-muted-foreground">
                    k.sato@acme.io
                  </span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <IconPlaceholder
                  lucide="User"
                  tabler="IconUser"
                  hugeicons="UserIcon"
                  phosphor="User"
                  remixicon="RiUser3Line"
                  className="size-3.5"
                  aria-hidden="true"
                />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive">
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              Good morning, Kenji
            </h1>
            <p className="text-sm text-muted-foreground">
              3 open tasks, 2 projects due this week
            </p>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
              <IconPlaceholder
                lucide="CircleCheck"
                tabler="IconCircleCheck"
                hugeicons="CheckmarkCircle02Icon"
                phosphor="CheckCircle"
                remixicon="RiCheckboxCircleLine"
                className="size-3.5 text-primary"
                aria-hidden="true"
              />
              <span>
                <span className="font-semibold text-foreground">12</span>{" "}
                Completed
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
              <IconPlaceholder
                lucide="Clock"
                tabler="IconClock"
                hugeicons="TimeIcon"
                phosphor="Clock"
                remixicon="RiTimeLine"
                className="size-3.5"
                aria-hidden="true"
              />
              <span>
                <span className="font-semibold text-foreground">3</span>{" "}
                Projects Active
              </span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="projects">
          <TabsList variant="line">
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="projects">
            <div className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {projects.map((project) => (
                <Card
                  key={project.name}
                  className="group flex flex-col overflow-hidden pt-0 transition-shadow hover:shadow-md"
                >
                  <div className="aspect-[16/7] w-full overflow-hidden border-b border-border bg-muted">
                    <img
                      src={project.image}
                      alt={project.imageAlt}
                      className="size-full object-cover grayscale transition-all duration-300 group-hover:grayscale-0"
                    />
                  </div>

                  <CardHeader className="gap-2 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm leading-tight font-semibold">
                        {project.name}
                      </span>
                      <Badge
                        variant={statusConfig[project.status].variant}
                        className="shrink-0 text-[10px]"
                      >
                        {project.status}
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {project.description}
                    </p>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-3 pb-4">
                    <Progress value={project.progress} className="gap-1">
                      <div className="flex w-full items-center justify-between text-[10px] text-muted-foreground">
                        <ProgressLabel className="text-[10px]">
                          Progress
                        </ProgressLabel>
                        <ProgressValue className="ml-0 text-[10px] font-medium text-foreground" />
                      </div>
                    </Progress>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <IconPlaceholder
                          lucide="Clock"
                          tabler="IconClock"
                          hugeicons="TimeIcon"
                          phosphor="Clock"
                          remixicon="RiTimeLine"
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>Due {project.dueDate}</span>
                      </div>
                      <div className="flex -space-x-1.5">
                        {project.memberKeys.map((key) => (
                          <Avatar
                            key={key}
                            className="size-5 ring-1 ring-background"
                            title={members[key].name}
                          >
                            <AvatarImage
                              src={members[key].avatar}
                              alt={members[key].name}
                              className="grayscale"
                            />
                            <AvatarFallback className="text-[8px]">
                              {key}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="border-t border-border pt-3">
                    <Button
                     
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-7 gap-1 text-xs"
                     
                     asChild><a href="#" >
                      View Project
                      <IconPlaceholder
                        lucide="ArrowRight"
                        tabler="IconArrowRight"
                        hugeicons="ArrowRightIcon"
                        phosphor="ArrowRight"
                        remixicon="RiArrowRightLine"
                        className="size-3.5"
                        aria-hidden="true"
                      />
                    </a></Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tasks">
            <div className="mt-5 flex flex-col overflow-hidden rounded-xl border border-border">
              {taskList.length === 0 && (
                <div className="bg-card px-4 py-10 text-center text-xs text-muted-foreground">
                  All tasks cleared. Nice work.
                </div>
              )}
              {taskList.map((task, idx) => {
                const assignee = members[task.assigneeKey]
                return (
                  <div
                    key={task.title}
                    className={[
                      "group flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-muted/50",
                      idx !== taskList.length - 1
                        ? "border-b border-border"
                        : "",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => toggleTask(task.title)}
                      aria-pressed={task.done}
                      aria-label={
                        task.done
                          ? `Mark "${task.title}" as incomplete`
                          : `Mark "${task.title}" as complete`
                      }
                      className={
                        task.done
                          ? "shrink-0 text-primary transition-colors focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:outline-none"
                          : "shrink-0 text-muted-foreground/30 transition-colors hover:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:outline-none"
                      }
                    >
                      <IconPlaceholder
                        lucide="CircleCheck"
                        tabler="IconCircleCheck"
                        hugeicons="CheckmarkCircle02Icon"
                        phosphor="CheckCircle"
                        remixicon="RiCheckboxCircleLine"
                        className="size-4"
                        aria-hidden="true"
                      />
                    </button>
                    <span
                      className={
                        task.done
                          ? "flex-1 truncate text-xs text-muted-foreground line-through"
                          : "flex-1 truncate text-xs text-foreground"
                      }
                    >
                      {task.title}
                    </span>
                    <Badge
                      variant={priorityConfig[task.priority].variant}
                      className="shrink-0 text-[10px]"
                    >
                      {task.priority}
                    </Badge>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Avatar className="size-5">
                        <AvatarImage
                          src={assignee.avatar}
                          alt={assignee.name}
                          className="grayscale"
                        />
                        <AvatarFallback className="text-[8px]">
                          {task.assigneeKey}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden text-[10px] text-muted-foreground sm:inline">
                        {assignee.name.split(" ")[0]}
                      </span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`More options for ${task.title}`}
                            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100 focus:opacity-100 data-[popup-open]:opacity-100"
                          >
                            <IconPlaceholder
                              lucide="Ellipsis"
                              tabler="IconDots"
                              hugeicons="MoreHorizontalIcon"
                              phosphor="DotsThree"
                              remixicon="RiMoreLine"
                              className="size-3.5"
                              aria-hidden="true"
                            />
                          </Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={() => toggleTask(task.title)}
                        >
                          <IconPlaceholder
                            lucide="CircleCheck"
                            tabler="IconCircleCheck"
                            hugeicons="CheckmarkCircle02Icon"
                            phosphor="CheckCircle"
                            remixicon="RiCheckboxCircleLine"
                            className="size-3.5"
                            aria-hidden="true"
                          />
                          {task.done
                            ? "Mark as incomplete"
                            : "Mark as complete"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => removeTask(task.title)}
                          className="text-destructive focus:text-destructive"
                        >
                          <IconPlaceholder
                            lucide="Trash"
                            tabler="IconTrash"
                            hugeicons="Delete02Icon"
                            phosphor="Trash"
                            remixicon="RiDeleteBinLine"
                            className="size-3.5"
                            aria-hidden="true"
                          />
                          Remove task
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <div className="mt-5 flex flex-col overflow-hidden rounded-xl border border-border">
              {activity.map((item, idx) => {
                const actor = members[item.actorKey]
                const initials = item.actorKey
                return (
                  <div
                    key={`${item.actorKey}-${item.time}-${item.target}`}
                    className={[
                      "flex items-start gap-3 bg-card px-4 py-3.5 transition-colors hover:bg-muted/50",
                      idx !== activity.length - 1
                        ? "border-b border-border"
                        : "",
                    ].join(" ")}
                  >
                    <div className="relative mt-0.5 shrink-0">
                      <Avatar className="size-7">
                        <AvatarImage
                          src={actor.avatar}
                          alt={actor.name}
                          className="grayscale"
                        />
                        <AvatarFallback className="text-[10px]">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                        {activityIcon[item.icon]}
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="text-xs leading-relaxed">
                        <span className="font-medium">{actor.name}</span>{" "}
                        <span className="text-muted-foreground">
                          {item.action}
                        </span>{" "}
                        <span className="font-medium">{item.target}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.time}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <Command>
          <CommandInput
            aria-label="Type a command or search"
            placeholder="Type a command or search…"
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              {navCommands.map((command) => (
                <CommandItem
                  key={command.label}
                  onSelect={() => setCommandOpen(false)}
                >
                  <command.icon />
                  <span>{command.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Actions">
              {actionCommands.map((command) => (
                <CommandItem
                  key={command.label}
                  onSelect={() => setCommandOpen(false)}
                >
                  <command.icon />
                  <span>{command.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </section>
  )
}

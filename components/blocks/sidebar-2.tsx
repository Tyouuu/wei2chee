"use client"

import * as React from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Toaster } from "@/components/ui/sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

const navItems = [
  {
    label: "Inbox",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Inbox"
        tabler="IconInbox"
        hugeicons="InboxIcon"
        phosphor="Tray"
        remixicon="RiInboxLine"
        {...p}
      />
    ),
    badge: 12,
    active: false,
  },
  {
    label: "My Tasks",
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
    badge: 0,
    active: true,
  },
  {
    label: "Schedule",
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
    badge: 3,
    active: false,
  },
  {
    label: "Documents",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="FileText"
        tabler="IconFileText"
        hugeicons="File01Icon"
        phosphor="FileText"
        remixicon="RiFileTextLine"
        {...p}
      />
    ),
    badge: 0,
    active: false,
  },
  {
    label: "Settings",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Settings"
        tabler="IconSettings"
        hugeicons="SettingsIcon"
        phosphor="GearSix"
        remixicon="RiSettings4Line"
        {...p}
      />
    ),
    badge: 0,
    active: false,
  },
]

type Priority = "high" | "medium" | "low"
type Status = "In Progress" | "Review" | "Done" | "Blocked"

const tasks: {
  id: string
  title: string
  project: string
  priority: Priority
  status: Status
  due: string
}[] = [
  {
    id: "T-104",
    title: "Migrate auth service to OAuth 2.1",
    project: "Platform",
    priority: "high",
    status: "In Progress",
    due: "Jun 20",
  },
  {
    id: "T-108",
    title: "Write onboarding copy for new users",
    project: "Marketing",
    priority: "medium",
    status: "Review",
    due: "Jun 22",
  },
  {
    id: "T-112",
    title: "Fix pagination bug on reports page",
    project: "Dashboard",
    priority: "high",
    status: "Blocked",
    due: "Jun 19",
  },
  {
    id: "T-117",
    title: "Add CSV export to analytics view",
    project: "Dashboard",
    priority: "low",
    status: "In Progress",
    due: "Jun 28",
  },
  {
    id: "T-121",
    title: "Update API rate-limit documentation",
    project: "Platform",
    priority: "low",
    status: "Done",
    due: "Jun 15",
  },
  {
    id: "T-125",
    title: "Redesign notification preferences UI",
    project: "Marketing",
    priority: "medium",
    status: "Review",
    due: "Jun 30",
  },
]

const priorityColor: Record<Priority, string> = {
  high: "text-destructive",
  medium: "text-foreground",
  low: "text-muted-foreground",
}

const statusVariant: Record<
  Status,
  "default" | "secondary" | "destructive" | "outline"
> = {
  "In Progress": "secondary",
  Review: "outline",
  Done: "default",
  Blocked: "destructive",
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
export const copy = { tasks, statusVariant }
export type Copy = typeof copy


function NewTaskDialog() {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="default" size="sm" className="ml-auto">
            <IconPlaceholder
              lucide="Plus"
              tabler="IconPlus"
              hugeicons="Add01Icon"
              phosphor="Plus"
              remixicon="RiAddLine"
              className="mr-1 size-3.5"
              aria-hidden="true"
            />
            New Task
          </Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Add a task to your board. You can refine the details later.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setOpen(false)
          }}
        >
          <Field>
            <FieldLabel htmlFor="task-title">Title</FieldLabel>
            <Input
              id="task-title"
              placeholder="e.g. Review staging deploy"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="task-project">Project</FieldLabel>
            <Input id="task-project" placeholder="e.g. Platform" />
          </Field>
          <Field>
            <FieldLabel htmlFor="task-due">Due date</FieldLabel>
            <Input id="task-due" placeholder="Jun 30" />
          </Field>
          <DialogFooter className="mt-2">
            <DialogClose asChild><Button variant="outline" type="button" >
              Cancel
            </Button></DialogClose>
            <Button type="submit">Create Task</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function SidebarBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { tasks, statusVariant } = { ...copy, ...override }
  const [selected, setSelected] = React.useState<Record<string, boolean>>({})

  const selectedCount = Object.values(selected).filter(Boolean).length
  const allSelected = selectedCount === tasks.length && tasks.length > 0
  const someSelected = selectedCount > 0 && !allSelected

  const toggleAll = (checked: boolean) => {
    setSelected(
      checked ? Object.fromEntries(tasks.map((t) => [t.id, true])) : {}
    )
  }

  return (
    <SidebarProvider defaultOpen className="min-h-svh">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex h-9 items-center gap-2 px-2">
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
              Acme
            </span>
            <Badge
              variant="outline"
              className="ml-auto group-data-[collapsible=icon]:hidden"
            >
              Beta
            </Badge>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      isActive={item.active}
                      tooltip={item.label}
                     
                     asChild><a href="#" >
                      <item.icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </a></SidebarMenuButton>
                    {item.badge > 0 && (
                      <SidebarMenuBadge className="tabular-nums">
                        {item.badge}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
          <h1 className="font-heading text-sm font-semibold">My Tasks</h1>
          <span className="text-xs text-muted-foreground">
            {tasks.filter((t) => t.status !== "Done").length} Open
          </span>
          <NewTaskDialog />
        </header>

        {selectedCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground tabular-nums">
                {selectedCount} Selected
              </span>
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setSelected({})}
              >
                Clear
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast("Tasks completed", {
                    id: "tasks-completed",
                    description: `${selectedCount} tasks marked as complete.`,
                  })
                }
              >
                <IconPlaceholder
                  lucide="Check"
                  tabler="IconCheck"
                  hugeicons="Tick02Icon"
                  phosphor="Check"
                  remixicon="RiCheckLine"
                  className="size-3.5"
                  aria-hidden="true"
                />
                Mark Complete
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() =>
                  toast("Tasks deleted", {
                    id: "tasks-deleted",
                    description: `${selectedCount} tasks deleted.`,
                  })
                }
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
                Delete
              </Button>
            </div>
          </div>
        )}

        <div className="min-w-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={(someSelected) ? "indeterminate" : (allSelected)}
                    
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                    aria-label="Select all tasks"
                  />
                </TableHead>
                <TableHead className="w-20">ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="hidden sm:table-cell">Project</TableHead>
                <TableHead className="hidden md:table-cell">Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden text-right md:table-cell">
                  Due
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const isSelected = !!selected[task.id]
                return (
                  <TableRow
                    key={task.id}
                    data-state={isSelected ? "selected" : undefined}
                  >
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          setSelected((prev) => ({
                            ...prev,
                            [task.id]: checked === true,
                          }))
                        }
                        aria-label={`Select ${task.title}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {task.id}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "font-medium",
                          task.status === "Done" &&
                            "text-muted-foreground line-through"
                        )}
                      >
                        {task.title}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {task.project}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span
                        className={cn(
                          "flex items-center gap-1.5",
                          priorityColor[task.priority]
                        )}
                      >
                        <IconPlaceholder
                          lucide="Circle"
                          tabler="IconCircle"
                          hugeicons="CircleIcon"
                          phosphor="Circle"
                          remixicon="RiCircleFill"
                          className="size-1.5"
                          aria-hidden="true"
                        />
                        {task.priority.charAt(0).toUpperCase() +
                          task.priority.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[task.status]}>
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground md:table-cell">
                      {task.due}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground"
                              aria-label={`Actions for ${task.title}`}
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
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem>
                            <IconPlaceholder
                              lucide="Edit2"
                              tabler="IconEdit"
                              hugeicons="EditIcon"
                              phosphor="Pencil"
                              remixicon="RiEdit2Line"
                              aria-hidden="true"
                            />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <IconPlaceholder
                              lucide="Copy"
                              tabler="IconCopy"
                              hugeicons="CopyIcon"
                              phosphor="Copy"
                              remixicon="RiFileCopyLine"
                              aria-hidden="true"
                            />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive">
                            <IconPlaceholder
                              lucide="Trash"
                              tabler="IconTrash"
                              hugeicons="Delete02Icon"
                              phosphor="Trash"
                              remixicon="RiDeleteBinLine"
                              aria-hidden="true"
                            />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  )
}

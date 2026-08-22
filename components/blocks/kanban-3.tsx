"use client"

import * as React from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type Label = "Design" | "Engineering" | "Marketing" | "Ops"

const labelVariant: Record<Label, "default" | "secondary" | "outline"> = {
  Design: "secondary",
  Engineering: "default",
  Marketing: "outline",
  Ops: "outline",
}

type Task = {
  id: string
  title: string
  label: Label
  assignee: string
  initials: string
  avatarSrc: string
}

type Column = { id: string; title: string; tasks: Task[] }

const initialColumns: Column[] = [
  {
    id: "todo",
    title: "To Do",
    tasks: [
      {
        id: "k1",
        title: "Draft Q3 launch announcement",
        label: "Marketing",
        assignee: "Ravi Patel",
        initials: "RP",
        avatarSrc: "https://i.pravatar.cc/32?img=15",
      },
      {
        id: "k2",
        title: "Design empty states for reports",
        label: "Design",
        assignee: "Mia Cho",
        initials: "MC",
        avatarSrc: "https://i.pravatar.cc/32?img=47",
      },
      {
        id: "k3",
        title: "Set up staging environment",
        label: "Ops",
        assignee: "Leo Fenn",
        initials: "LF",
        avatarSrc: "https://i.pravatar.cc/32?img=51",
      },
    ],
  },
  {
    id: "in-progress",
    title: "In Progress",
    tasks: [
      {
        id: "k4",
        title: "Build billing usage endpoint",
        label: "Engineering",
        assignee: "Dana Wu",
        initials: "DW",
        avatarSrc: "https://i.pravatar.cc/32?img=32",
      },
      {
        id: "k5",
        title: "Rework onboarding checklist",
        label: "Design",
        assignee: "Mia Cho",
        initials: "MC",
        avatarSrc: "https://i.pravatar.cc/32?img=47",
      },
    ],
  },
  {
    id: "review",
    title: "Review",
    tasks: [
      {
        id: "k6",
        title: "Audit tracking events",
        label: "Marketing",
        assignee: "Ravi Patel",
        initials: "RP",
        avatarSrc: "https://i.pravatar.cc/32?img=15",
      },
    ],
  },
  {
    id: "done",
    title: "Done",
    tasks: [
      {
        id: "k7",
        title: "Migrate assets to CDN",
        label: "Ops",
        assignee: "Leo Fenn",
        initials: "LF",
        avatarSrc: "https://i.pravatar.cc/32?img=51",
      },
      {
        id: "k8",
        title: "Ship dark-mode tokens",
        label: "Engineering",
        assignee: "Dana Wu",
        initials: "DW",
        avatarSrc: "https://i.pravatar.cc/32?img=32",
      },
    ],
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
export const copy = { initialColumns }
export type Copy = typeof copy


function TaskCardBody({ task, dragging }: { task: Task; dragging?: boolean }) {
  return (
    <Card
      size="sm"
      className={cn(
        "gap-2 transition-shadow duration-150 hover:shadow-md",
        dragging && "shadow-lg ring-1 ring-foreground/15"
      )}
    >
      <CardContent className="flex flex-col gap-2.5">
        <p className="text-sm leading-snug font-medium">{task.title}</p>
        <div className="flex items-center justify-between gap-2">
          <Badge variant={labelVariant[task.label]}>{task.label}</Badge>
          <Avatar size="sm">
            <AvatarImage
              src={task.avatarSrc}
              alt={task.assignee}
              className="grayscale"
            />
            <AvatarFallback>{task.initials}</AvatarFallback>
          </Avatar>
        </div>
      </CardContent>
    </Card>
  )
}

function SortableTaskCard({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
      }}
      {...attributes}
      {...listeners}
      className="cursor-grab touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
    >
      <TaskCardBody task={task} />
    </div>
  )
}

function BoardColumn({
  column,
  reflowKey,
}: {
  column: Column
  reflowKey: number
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  return (
    <div className="flex w-[80%] shrink-0 flex-col gap-3 sm:w-auto sm:shrink">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {column.title}
        </span>
        <span className="flex size-5 items-center justify-center rounded-md border border-border text-[10px] font-semibold text-muted-foreground tabular-nums">
          {column.tasks.length}
        </span>
      </div>
      <SortableContext
        items={column.tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <ScrollArea
          key={reflowKey}
          className={cn(
            "h-80 rounded-lg border border-border transition-colors [&_[data-slot=scroll-area-viewport]]:scroll-fade-y",
            isOver ? "border-foreground/30 bg-muted/40" : "bg-muted/20"
          )}
        >
          <div ref={setNodeRef} className="flex min-h-full flex-col gap-2 p-2">
            {column.tasks.map((task) => (
              <SortableTaskCard key={task.id} task={task} />
            ))}
            {column.tasks.length === 0 && (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border py-8 text-xs text-muted-foreground">
                Drop here
              </div>
            )}
            <button
              type="button"
              className="mt-auto flex items-center gap-1.5 px-1 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <IconPlaceholder
                lucide="Plus"
                tabler="IconPlus"
                hugeicons="Add01Icon"
                phosphor="Plus"
                remixicon="RiAddLine"
                className="size-3.5"
                aria-hidden="true"
              />
              Add card
            </button>
          </div>
        </ScrollArea>
      </SortableContext>
    </div>
  )
}

export default function KanbanBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { initialColumns } = { ...copy, ...override }
  const [columns, setColumns] = React.useState<Column[]>(initialColumns)
  const [activeTask, setActiveTask] = React.useState<Task | null>(null)
  const [reflow, setReflow] = React.useState(0)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const findColumnId = React.useCallback(
    (id: string) =>
      columns.some((c) => c.id === id)
        ? id
        : columns.find((c) => c.tasks.some((t) => t.id === id))?.id,
    [columns]
  )

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    setActiveTask(
      columns.flatMap((c) => c.tasks).find((t) => t.id === id) ?? null
    )
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const activeCol = findColumnId(activeId)
    const overCol = findColumnId(overId)
    if (!activeCol || !overCol || activeCol === overCol) return
    setColumns((prev) => {
      const from = prev.find((c) => c.id === activeCol)!
      const moving = from.tasks.find((t) => t.id === activeId)
      if (!moving) return prev
      const to = prev.find((c) => c.id === overCol)!
      const overIndex = to.tasks.findIndex((t) => t.id === overId)
      const insertAt = overIndex >= 0 ? overIndex : to.tasks.length
      return prev.map((c) => {
        if (c.id === activeCol)
          return { ...c, tasks: c.tasks.filter((t) => t.id !== activeId) }
        if (c.id === overCol) {
          const next = [...c.tasks]
          next.splice(insertAt, 0, moving)
          return { ...c, tasks: next }
        }
        return c
      })
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)
    setReflow((n) => n + 1)
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const col = findColumnId(activeId)
    if (!col || col !== findColumnId(overId)) return
    setColumns((prev) =>
      prev.map((c) => {
        if (c.id !== col) return c
        const oldIndex = c.tasks.findIndex((t) => t.id === activeId)
        const newIndex = c.tasks.findIndex((t) => t.id === overId)
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return c
        return { ...c, tasks: arrayMove(c.tasks, oldIndex, newIndex) }
      })
    )
  }

  return (
    <section className="flex min-h-svh w-full items-start justify-center bg-background px-6 py-12 text-foreground">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 border-b border-border pb-5">
          <p className="mb-1 text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Acme Workspace
          </p>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Project Board
          </h1>
        </div>

        <DndContext
          id="kanban-3-board"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveTask(null)
            setReflow((n) => n + 1)
          }}
        >
          <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-3 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0">
            {columns.map((col) => (
              <BoardColumn key={col.id} column={col} reflowKey={reflow} />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? (
              <div className="cursor-grabbing">
                <TaskCardBody task={activeTask} dragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </section>
  )
}

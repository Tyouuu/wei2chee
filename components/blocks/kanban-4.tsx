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
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type Priority = "high" | "medium" | "low"

const priorityDot: Record<Priority, string> = {
  high: "bg-destructive",
  medium: "bg-primary",
  low: "bg-muted-foreground/40",
}

type Task = { id: string; title: string; project: string; priority: Priority }
type Lane = { id: string; title: string; hint: string; tasks: Task[] }

const initialLanes: Lane[] = [
  {
    id: "today",
    title: "Today",
    hint: "Due by end of day",
    tasks: [
      {
        id: "m1",
        title: "Reply to design review comments",
        project: "Web App",
        priority: "high",
      },
      {
        id: "m2",
        title: "Finalize sprint retro notes",
        project: "Team",
        priority: "medium",
      },
      {
        id: "m3",
        title: "Approve new marketing copy",
        project: "Website",
        priority: "low",
      },
    ],
  },
  {
    id: "week",
    title: "This Week",
    hint: "Planned for the next few days",
    tasks: [
      {
        id: "m4",
        title: "Draft the analytics dashboard spec",
        project: "Web App",
        priority: "medium",
      },
      {
        id: "m5",
        title: "Pair on the billing migration",
        project: "Platform",
        priority: "high",
      },
    ],
  },
  {
    id: "later",
    title: "Later",
    hint: "Backlog, not yet scheduled",
    tasks: [
      {
        id: "m6",
        title: "Explore a mobile push strategy",
        project: "Growth",
        priority: "low",
      },
      {
        id: "m7",
        title: "Refactor the settings form",
        project: "Web App",
        priority: "low",
      },
    ],
  },
]

function TaskRowBody({ task, dragging }: { task: Task; dragging?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-shadow duration-150",
        dragging && "shadow-lg ring-1 ring-foreground/15"
      )}
    >
      <IconPlaceholder
        lucide="GripVertical"
        tabler="IconGripVertical"
        hugeicons="Drag01Icon"
        phosphor="DotsSixVertical"
        remixicon="RiDraggable"
        className="size-4 shrink-0 text-muted-foreground/50"
        aria-hidden="true"
      />
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          priorityDot[task.priority]
        )}
        aria-label={`${task.priority} priority`}
      />
      <span className="flex-1 truncate text-sm font-medium">{task.title}</span>
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
        {task.project}
      </span>
    </div>
  )
}

function SortableTaskRow({ task }: { task: Task }) {
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
      <TaskRowBody task={task} />
    </div>
  )
}

function TaskLane({ lane }: { lane: Lane }) {
  const { setNodeRef, isOver } = useDroppable({ id: lane.id })
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          {lane.title}
        </h2>
        <span className="text-xs text-muted-foreground">{lane.hint}</span>
      </div>
      <SortableContext
        items={lane.tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-16 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors",
            isOver ? "border-foreground/30 bg-muted/40" : "border-border"
          )}
        >
          {lane.tasks.map((task) => (
            <SortableTaskRow key={task.id} task={task} />
          ))}
          {lane.tasks.length === 0 && (
            <div className="flex flex-1 items-center justify-center py-4 text-xs text-muted-foreground">
              Drop a task here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

export default function KanbanBlock() {
  const [lanes, setLanes] = React.useState<Lane[]>(initialLanes)
  const [activeTask, setActiveTask] = React.useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const findLaneId = React.useCallback(
    (id: string) =>
      lanes.some((l) => l.id === id)
        ? id
        : lanes.find((l) => l.tasks.some((t) => t.id === id))?.id,
    [lanes]
  )

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    setActiveTask(
      lanes.flatMap((l) => l.tasks).find((t) => t.id === id) ?? null
    )
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const activeLane = findLaneId(activeId)
    const overLane = findLaneId(overId)
    if (!activeLane || !overLane || activeLane === overLane) return
    setLanes((prev) => {
      const from = prev.find((l) => l.id === activeLane)!
      const moving = from.tasks.find((t) => t.id === activeId)
      if (!moving) return prev
      const to = prev.find((l) => l.id === overLane)!
      const overIndex = to.tasks.findIndex((t) => t.id === overId)
      const insertAt = overIndex >= 0 ? overIndex : to.tasks.length
      return prev.map((l) => {
        if (l.id === activeLane)
          return { ...l, tasks: l.tasks.filter((t) => t.id !== activeId) }
        if (l.id === overLane) {
          const next = [...l.tasks]
          next.splice(insertAt, 0, moving)
          return { ...l, tasks: next }
        }
        return l
      })
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const lane = findLaneId(activeId)
    if (!lane || lane !== findLaneId(overId)) return
    setLanes((prev) =>
      prev.map((l) => {
        if (l.id !== lane) return l
        const oldIndex = l.tasks.findIndex((t) => t.id === activeId)
        const newIndex = l.tasks.findIndex((t) => t.id === overId)
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return l
        return { ...l, tasks: arrayMove(l.tasks, oldIndex, newIndex) }
      })
    )
  }

  const total = lanes.reduce((n, l) => n + l.tasks.length, 0)

  return (
    <section className="flex min-h-svh w-full items-start justify-center bg-background px-6 py-12 text-foreground">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex items-end justify-between border-b border-border pb-4">
          <div>
            <p className="mb-1 text-xs font-medium tracking-widest text-muted-foreground uppercase">
              My Tasks
            </p>
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              Today &amp; Beyond
            </h1>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {total} tasks
          </span>
        </div>

        <DndContext
          id="kanban-4-board"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveTask(null)}
        >
          <div className="flex flex-col gap-5">
            {lanes.map((lane) => (
              <TaskLane key={lane.id} lane={lane} />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? (
              <div className="cursor-grabbing">
                <TaskRowBody task={activeTask} dragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </section>
  )
}

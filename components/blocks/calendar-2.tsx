"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type EventStatus = "confirmed" | "tentative" | "cancelled"

interface CalEvent {
  time: string
  duration: string
  title: string
  location?: string
  status: EventStatus
}

interface AgendaDay {
  label: string
  date: number
  isToday: boolean
  events: CalEvent[]
}

interface Week {
  range: string
  days: AgendaDay[]
}

const STANDUP: CalEvent = {
  time: "09:00",
  duration: "30 min",
  title: "Daily standup",
  location: "Zoom",
  status: "confirmed",
}

const WEEKS: Week[] = [
  {
    range: "Jun 9 – Jun 15, 2025",
    days: [
      { label: "Mon", date: 9, isToday: false, events: [STANDUP] },
      {
        label: "Tue",
        date: 10,
        isToday: false,
        events: [
          STANDUP,
          {
            time: "13:00",
            duration: "1 hr",
            title: "Hiring panel: Backend",
            location: "Conf room B",
            status: "confirmed",
          },
        ],
      },
      { label: "Wed", date: 11, isToday: false, events: [STANDUP] },
      {
        label: "Thu",
        date: 12,
        isToday: false,
        events: [
          STANDUP,
          {
            time: "15:00",
            duration: "45 min",
            title: "Budget planning",
            location: "Finance suite",
            status: "tentative",
          },
        ],
      },
      { label: "Fri", date: 13, isToday: false, events: [STANDUP] },
      { label: "Sat", date: 14, isToday: false, events: [] },
      { label: "Sun", date: 15, isToday: false, events: [] },
    ],
  },
  {
    range: "Jun 16 – Jun 22, 2025",
    days: [
      {
        label: "Mon",
        date: 16,
        isToday: false,
        events: [
          STANDUP,
          {
            time: "14:00",
            duration: "1 hr",
            title: "Product roadmap review",
            location: "Conf room A",
            status: "confirmed",
          },
        ],
      },
      {
        label: "Tue",
        date: 17,
        isToday: true,
        events: [
          STANDUP,
          {
            time: "11:00",
            duration: "2 hr",
            title: "Design system workshop",
            location: "Studio 2",
            status: "confirmed",
          },
          {
            time: "16:30",
            duration: "30 min",
            title: "1:1 with Jordan",
            status: "tentative",
          },
        ],
      },
      {
        label: "Wed",
        date: 18,
        isToday: false,
        events: [
          STANDUP,
          {
            time: "13:00",
            duration: "1 hr",
            title: "Q2 retrospective",
            location: "Main boardroom",
            status: "confirmed",
          },
        ],
      },
      {
        label: "Thu",
        date: 19,
        isToday: false,
        events: [
          STANDUP,
          {
            time: "10:30",
            duration: "45 min",
            title: "Engineering sync",
            status: "confirmed",
          },
          {
            time: "15:00",
            duration: "1 hr",
            title: "Vendor call: Acme Payments",
            location: "External",
            status: "tentative",
          },
        ],
      },
      {
        label: "Fri",
        date: 20,
        isToday: false,
        events: [
          STANDUP,
          {
            time: "12:00",
            duration: "30 min",
            title: "Sprint planning kick-off",
            status: "cancelled",
          },
        ],
      },
      { label: "Sat", date: 21, isToday: false, events: [] },
      {
        label: "Sun",
        date: 22,
        isToday: false,
        events: [
          {
            time: "10:00",
            duration: "1 hr",
            title: "Team offsite prep call",
            status: "tentative",
          },
        ],
      },
    ],
  },
  {
    range: "Jun 23 – Jun 29, 2025",
    days: [
      {
        label: "Mon",
        date: 23,
        isToday: false,
        events: [
          STANDUP,
          {
            time: "11:00",
            duration: "6 hr",
            title: "Design sprint",
            location: "Studio 2",
            status: "confirmed",
          },
        ],
      },
      { label: "Tue", date: 24, isToday: false, events: [STANDUP] },
      {
        label: "Wed",
        date: 25,
        isToday: false,
        events: [
          STANDUP,
          {
            time: "14:00",
            duration: "1 hr",
            title: "Customer advisory board",
            location: "External",
            status: "confirmed",
          },
        ],
      },
      { label: "Thu", date: 26, isToday: false, events: [STANDUP] },
      {
        label: "Fri",
        date: 27,
        isToday: false,
        events: [
          STANDUP,
          {
            time: "16:00",
            duration: "1 hr",
            title: "Team social",
            location: "Rooftop",
            status: "tentative",
          },
        ],
      },
      { label: "Sat", date: 28, isToday: false, events: [] },
      { label: "Sun", date: 29, isToday: false, events: [] },
    ],
  },
]

const TODAY_WEEK = 1

const STATUS_ACCENT: Record<EventStatus, string> = {
  confirmed: "bg-primary",
  tentative: "bg-muted-foreground",
  cancelled: "bg-destructive",
}

const STATUS_LABEL: Record<EventStatus, string> = {
  confirmed: "Confirmed",
  tentative: "Tentative",
  cancelled: "Cancelled",
}

export default function CalendarBlock() {
  const [weekIdx, setWeekIdx] = React.useState(TODAY_WEEK)
  const week = WEEKS[weekIdx]
  const totalEvents = week.days.reduce((n, d) => n + d.events.length, 0)

  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="w-full max-w-xl">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <IconPlaceholder
                  lucide="Calendar"
                  tabler="IconCalendar"
                  hugeicons="CalendarIcon"
                  phosphor="Calendar"
                  remixicon="RiCalendarLine"
                  className="size-5"
                  aria-hidden="true"
                />
              </span>
              <div className="flex flex-col">
                <h1 className="font-heading text-sm font-semibold tracking-tight tabular-nums">
                  {week.range}
                </h1>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {totalEvents} {totalEvents === 1 ? "event" : "events"} this
                  week
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous week"
                disabled={weekIdx === 0}
                onClick={() => setWeekIdx((i) => Math.max(0, i - 1))}
              >
                <IconPlaceholder
                  lucide="ChevronLeft"
                  tabler="IconChevronLeft"
                  hugeicons="ArrowLeft01Icon"
                  phosphor="CaretLeft"
                  remixicon="RiArrowLeftSLine"
                  aria-hidden="true"
                />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWeekIdx(TODAY_WEEK)}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next week"
                disabled={weekIdx === WEEKS.length - 1}
                onClick={() =>
                  setWeekIdx((i) => Math.min(WEEKS.length - 1, i + 1))
                }
              >
                <IconPlaceholder
                  lucide="ChevronRight"
                  tabler="IconChevronRight"
                  hugeicons="ArrowRight01Icon"
                  phosphor="CaretRight"
                  remixicon="RiArrowRightSLine"
                  aria-hidden="true"
                />
              </Button>
            </div>
          </div>

          <Separator />

          <div>
            {week.days.map((day, dayIdx) => (
              <div key={day.date}>
                <div
                  className={cn(
                    "flex gap-4 px-4 py-3",
                    day.isToday && "bg-primary/5"
                  )}
                >
                  <div className="flex w-11 shrink-0 flex-col items-center gap-1 pt-1">
                    <span
                      className={cn(
                        "text-[10px] font-semibold tracking-widest uppercase",
                        day.isToday ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {day.label}
                    </span>
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-md text-sm font-semibold tabular-nums",
                        day.isToday
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground"
                      )}
                    >
                      {day.date}
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                    {day.events.length === 0 ? (
                      <p className="py-1.5 text-xs text-muted-foreground/70">
                        No events
                      </p>
                    ) : (
                      day.events.map((event) => (
                        <Popover key={`${event.time}-${event.title}`}>
                          <PopoverTrigger
                           
                           asChild><button
                                type="button"
                                className="group flex w-full items-stretch gap-3 px-2 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"><span
                              className={cn(
                                "w-1 shrink-0",
                                STATUS_ACCENT[event.status]
                              )}
                              aria-label={STATUS_LABEL[event.status]}
                            />

                            <div className="flex w-14 shrink-0 flex-col">
                              <span className="text-xs font-medium text-foreground tabular-nums">
                                {event.time}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {event.duration}
                              </span>
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span
                                className={cn(
                                  "truncate text-sm leading-snug font-medium",
                                  event.status === "cancelled"
                                    ? "text-muted-foreground line-through"
                                    : "text-foreground"
                                )}
                              >
                                {event.title}
                              </span>
                              {event.location && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <IconPlaceholder
                                    lucide="MapPin"
                                    tabler="IconMapPin"
                                    hugeicons="MapPinIcon"
                                    phosphor="MapPin"
                                    remixicon="RiMapPinLine"
                                    className="size-3 shrink-0"
                                    aria-hidden="true"
                                  />
                                  {event.location}
                                </span>
                              )}
                            </div>

                            <IconPlaceholder
                              lucide="ChevronRight"
                              tabler="IconChevronRight"
                              hugeicons="ArrowRight01Icon"
                              phosphor="CaretRight"
                              remixicon="RiArrowRightSLine"
                              className="size-4 shrink-0 self-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                              aria-hidden="true"
                            /></button></PopoverTrigger>

                          <PopoverContent align="start" className="w-64">
                            <PopoverHeader>
                              <PopoverTitle
                                className={cn(
                                  event.status === "cancelled" &&
                                    "text-muted-foreground line-through"
                                )}
                              >
                                {event.title}
                              </PopoverTitle>
                              <PopoverDescription>
                                {day.label} {day.date}
                              </PopoverDescription>
                            </PopoverHeader>
                            <Separator />
                            <div className="flex flex-col gap-1.5 text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <IconPlaceholder
                                  lucide="Clock"
                                  tabler="IconClock"
                                  hugeicons="TimeIcon"
                                  phosphor="Clock"
                                  remixicon="RiTimeLine"
                                  className="size-3.5 shrink-0"
                                  aria-hidden="true"
                                />
                                {event.time} ({event.duration})
                              </span>
                              {event.location && (
                                <span className="flex items-center gap-1.5">
                                  <IconPlaceholder
                                    lucide="MapPin"
                                    tabler="IconMapPin"
                                    hugeicons="MapPinIcon"
                                    phosphor="MapPin"
                                    remixicon="RiMapPinLine"
                                    className="size-3.5 shrink-0"
                                    aria-hidden="true"
                                  />
                                  {event.location}
                                </span>
                              )}
                              <span className="flex items-center gap-1.5">
                                <span
                                  className={cn(
                                    "size-1.5 shrink-0",
                                    STATUS_ACCENT[event.status]
                                  )}
                                  aria-hidden="true"
                                />
                                {STATUS_LABEL[event.status]}
                              </span>
                            </div>
                          </PopoverContent>
                        </Popover>
                      ))
                    )}
                  </div>
                </div>

                {dayIdx < week.days.length - 1 && <Separator />}
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex items-center gap-4 px-4 py-3">
            {(
              [
                ["confirmed", "Confirmed"],
                ["tentative", "Tentative"],
                ["cancelled", "Cancelled"],
              ] as [EventStatus, string][]
            ).map(([status, label]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span
                  className={cn("size-1.5", STATUS_ACCENT[status])}
                  aria-hidden="true"
                />
                <span className="text-[10px] text-muted-foreground">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

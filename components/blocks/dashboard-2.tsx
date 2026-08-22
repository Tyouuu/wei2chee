"use client"

import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

const PERIODS = [
  { value: "jun-2026", label: "June 2026" },
  { value: "may-2026", label: "May 2026" },
  { value: "apr-2026", label: "April 2026" },
  { value: "q2-2026", label: "Q2 2026" },
]

type Stat = {
  label: string
  value: string
  delta: string
  trend: "up" | "down"
  good: boolean
  sub: string
}

const STATS_BY_PERIOD: Record<string, Stat[]> = {
  "jun-2026": [
    {
      label: "Monthly Revenue",
      value: "$94,310",
      delta: "+8.2%",
      trend: "up",
      good: true,
      sub: "Vs. Last Month",
    },
    {
      label: "New Signups",
      value: "1,482",
      delta: "+23.5%",
      trend: "up",
      good: true,
      sub: "Vs. Last Month",
    },
    {
      label: "Churn Rate",
      value: "1.7%",
      delta: "+0.4%",
      trend: "up",
      good: false,
      sub: "Vs. Last Month",
    },
    {
      label: "Support Tickets",
      value: "38",
      delta: "-14.9%",
      trend: "down",
      good: true,
      sub: "Vs. Last Month",
    },
  ],
  "may-2026": [
    {
      label: "Monthly Revenue",
      value: "$87,140",
      delta: "+5.1%",
      trend: "up",
      good: true,
      sub: "Vs. Last Month",
    },
    {
      label: "New Signups",
      value: "1,199",
      delta: "+11.2%",
      trend: "up",
      good: true,
      sub: "Vs. Last Month",
    },
    {
      label: "Churn Rate",
      value: "1.6%",
      delta: "-0.2%",
      trend: "down",
      good: true,
      sub: "Vs. Last Month",
    },
    {
      label: "Support Tickets",
      value: "45",
      delta: "-8.0%",
      trend: "down",
      good: true,
      sub: "Vs. Last Month",
    },
  ],
  "apr-2026": [
    {
      label: "Monthly Revenue",
      value: "$82,920",
      delta: "+3.4%",
      trend: "up",
      good: true,
      sub: "Vs. Last Month",
    },
    {
      label: "New Signups",
      value: "1,078",
      delta: "+6.7%",
      trend: "up",
      good: true,
      sub: "Vs. Last Month",
    },
    {
      label: "Churn Rate",
      value: "1.8%",
      delta: "+0.3%",
      trend: "up",
      good: false,
      sub: "Vs. Last Month",
    },
    {
      label: "Support Tickets",
      value: "49",
      delta: "+4.2%",
      trend: "up",
      good: false,
      sub: "Vs. Last Month",
    },
  ],
  "q2-2026": [
    {
      label: "Quarterly Revenue",
      value: "$264,370",
      delta: "+6.0%",
      trend: "up",
      good: true,
      sub: "Vs. Last Quarter",
    },
    {
      label: "New Signups",
      value: "3,759",
      delta: "+14.1%",
      trend: "up",
      good: true,
      sub: "Vs. Last Quarter",
    },
    {
      label: "Churn Rate",
      value: "1.7%",
      delta: "+0.1%",
      trend: "up",
      good: false,
      sub: "Vs. Last Quarter",
    },
    {
      label: "Support Tickets",
      value: "132",
      delta: "-9.3%",
      trend: "down",
      good: true,
      sub: "Vs. Last Quarter",
    },
  ],
}

const ACTIVITY = [
  {
    id: 1,
    initials: "SN",
    actor: "Sofia N.",
    avatarSrc: "https://i.pravatar.cc/40?img=47",
    action: "exported the Q2 revenue report",
    timestamp: "Just Now",
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
    status: "Completed",
    statusVariant: "default" as const,
  },
  {
    id: 2,
    initials: "JP",
    actor: "James P.",
    avatarSrc: "https://i.pravatar.cc/40?img=12",
    action: "invited two new team members",
    timestamp: "12 Min Ago",
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
    status: "Pending",
    statusVariant: "secondary" as const,
  },
  {
    id: 3,
    initials: "RL",
    actor: "Riya L.",
    avatarSrc: "https://i.pravatar.cc/40?img=32",
    action: "resolved billing dispute #4821",
    timestamp: "1 Hour Ago",
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Check"
        tabler="IconCheck"
        hugeicons="Tick02Icon"
        phosphor="Check"
        remixicon="RiCheckLine"
        {...p}
      />
    ),
    status: "Resolved",
    statusVariant: "outline" as const,
  },
  {
    id: 4,
    initials: "MC",
    actor: "Marco C.",
    avatarSrc: "https://i.pravatar.cc/40?img=15",
    action: "flagged an anomaly in usage metrics",
    timestamp: "3 Hours Ago",
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
    status: "Review",
    statusVariant: "secondary" as const,
  },
  {
    id: 5,
    initials: "HK",
    actor: "Hana K.",
    avatarSrc: "https://i.pravatar.cc/40?img=48",
    action: "scheduled the monthly all-hands",
    timestamp: "Yesterday",
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
    status: "Scheduled",
    statusVariant: "outline" as const,
  },
  {
    id: 6,
    initials: "OB",
    actor: "Owen B.",
    avatarSrc: "https://i.pravatar.cc/40?img=53",
    action: "published the July product changelog",
    timestamp: "2 Days Ago",
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
    status: "Completed",
    statusVariant: "default" as const,
  },
]

export default function DashboardBlock() {
  const [period, setPeriod] = React.useState("jun-2026")
  const stats = STATS_BY_PERIOD[period] ?? STATS_BY_PERIOD["jun-2026"]

  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, here&apos;s what&apos;s happening at Acme.
            </p>
          </div>
          <Select
           
            value={period}
            onValueChange={(v) => v && setPeriod(v)}
          >
            <SelectTrigger className="shrink-0" aria-label="Reporting period">
              <IconPlaceholder
                lucide="Calendar"
                tabler="IconCalendar"
                hugeicons="CalendarIcon"
                phosphor="Calendar"
                remixicon="RiCalendarLine"
                className="size-3.5"
                aria-hidden="true"
              />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 md:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-4 bg-card px-5 py-5 transition-colors hover:bg-muted/40"
            >
              <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                {stat.label}
              </span>
              <span className="text-3xl font-bold tracking-tight tabular-nums">
                {stat.value}
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-semibold",
                    stat.good ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {stat.trend === "up" ? (
                    <IconPlaceholder
                      lucide="ArrowUp"
                      tabler="IconArrowUp"
                      hugeicons="ArrowUpIcon"
                      phosphor="ArrowUp"
                      remixicon="RiArrowUpLine"
                      className="size-3.5"
                      aria-hidden="true"
                    />
                  ) : (
                    <IconPlaceholder
                      lucide="ArrowDown"
                      tabler="IconArrowDown"
                      hugeicons="ArrowDownIcon"
                      phosphor="ArrowDown"
                      remixicon="RiArrowDownLine"
                      className="size-3.5"
                      aria-hidden="true"
                    />
                  )}
                  {stat.delta}
                </span>
                <span className="text-xs text-muted-foreground">
                  {stat.sub}
                </span>
              </div>
            </div>
          ))}
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="text-base font-semibold">
                  Recent Activity
                </CardTitle>
                <CardDescription className="text-xs">
                  The latest actions taken across your workspace.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="shrink-0 gap-1 text-xs">
                <span className="font-semibold tabular-nums">
                  {ACTIVITY.length}
                </span>
                Events
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="flex flex-col">
              {ACTIVITY.map((item, index) => {
                const Icon = item.icon
                return (
                  <li key={item.id}>
                    <div className="group flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-muted/40">
                      <Avatar size="sm" className="shrink-0 ring-1 ring-border">
                        <AvatarImage
                          src={item.avatarSrc}
                          alt={item.actor}
                          className="grayscale"
                        />
                        <AvatarFallback className="text-xs font-medium">
                          {item.initials}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-1.5">
                        <span className="shrink-0 text-sm font-semibold text-foreground">
                          {item.actor}
                        </span>
                        <span className="truncate text-sm text-muted-foreground">
                          {item.action}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <Badge
                          variant={item.statusVariant}
                          className="hidden sm:flex"
                        >
                          <Icon data-icon="inline-start" aria-hidden="true" />
                          {item.status}
                        </Badge>
                        <span className="text-xs whitespace-nowrap text-muted-foreground">
                          {item.timestamp}
                        </span>
                      </div>
                    </div>
                    {index < ACTIVITY.length - 1 && <Separator />}
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

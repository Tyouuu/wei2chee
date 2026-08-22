"use client"

import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

const QUARTERS = [
  { value: "q2-2026", label: "Q2 2026" },
  { value: "q1-2026", label: "Q1 2026" },
  { value: "q4-2025", label: "Q4 2025" },
  { value: "q3-2025", label: "Q3 2025" },
]

type Kpi = { label: string; value: string; delta: string; good: boolean }

const KPIS_BY_QUARTER: Record<string, Kpi[]> = {
  "q2-2026": [
    { label: "Total Revenue", value: "$128,450", delta: "+11.4%", good: true },
    { label: "Active Accounts", value: "3,872", delta: "+6.8%", good: true },
    { label: "Avg. Order Value", value: "$248", delta: "-2.1%", good: false },
    { label: "Net Promoter Score", value: "67", delta: "+4 pts", good: true },
    { label: "Refund Rate", value: "0.9%", delta: "-0.3%", good: true },
    { label: "Support CSAT", value: "94.2%", delta: "+1.7%", good: true },
  ],
  "q1-2026": [
    { label: "Total Revenue", value: "$115,300", delta: "+7.2%", good: true },
    { label: "Active Accounts", value: "3,625", delta: "+4.1%", good: true },
    { label: "Avg. Order Value", value: "$253", delta: "+1.2%", good: true },
    { label: "Net Promoter Score", value: "63", delta: "+2 pts", good: true },
    { label: "Refund Rate", value: "1.2%", delta: "+0.1%", good: false },
    { label: "Support CSAT", value: "92.5%", delta: "+0.8%", good: true },
  ],
  "q4-2025": [
    { label: "Total Revenue", value: "$107,540", delta: "+9.6%", good: true },
    { label: "Active Accounts", value: "3,482", delta: "+5.5%", good: true },
    { label: "Avg. Order Value", value: "$250", delta: "-0.8%", good: false },
    { label: "Net Promoter Score", value: "61", delta: "+5 pts", good: true },
    { label: "Refund Rate", value: "1.1%", delta: "-0.2%", good: true },
    { label: "Support CSAT", value: "91.7%", delta: "+2.3%", good: true },
  ],
  "q3-2025": [
    { label: "Total Revenue", value: "$98,120", delta: "+4.3%", good: true },
    { label: "Active Accounts", value: "3,301", delta: "+3.2%", good: true },
    { label: "Avg. Order Value", value: "$252", delta: "+0.5%", good: true },
    { label: "Net Promoter Score", value: "56", delta: "+1 pt", good: true },
    { label: "Refund Rate", value: "1.3%", delta: "+0.2%", good: false },
    { label: "Support CSAT", value: "89.4%", delta: "+1.1%", good: true },
  ],
}

export default function DashboardBlock() {
  const [quarter, setQuarter] = React.useState("q2-2026")
  const quarterLabel =
    QUARTERS.find((q) => q.value === quarter)?.label ?? "Q2 2026"
  const kpis = KPIS_BY_QUARTER[quarter] ?? KPIS_BY_QUARTER["q2-2026"]

  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
              Acme Corp
            </p>
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              Performance Overview
            </h1>
          </div>
          <Select
           
            value={quarter}
            onValueChange={(v) => v && setQuarter(v)}
          >
            <SelectTrigger aria-label="Quarter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUARTERS.map((q) => (
                <SelectItem key={q.value} value={q.value}>
                  {q.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 md:grid-cols-6">
          {kpis.map((kpi) => {
            const down = kpi.delta.trim().startsWith("-")
            return (
              <div
                key={kpi.label}
                className="flex flex-col gap-3 bg-background px-4 py-5"
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {kpi.label}
                </span>
                <span className="text-2xl font-bold tracking-tight tabular-nums">
                  {kpi.value}
                </span>
                <span
                  className={
                    kpi.good
                      ? "inline-flex w-fit items-center gap-0.5 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-xs font-medium text-foreground tabular-nums"
                      : "inline-flex w-fit items-center gap-0.5 rounded-md border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive tabular-nums"
                  }
                >
                  {down ? (
                    <IconPlaceholder
                      lucide="ChevronDown"
                      tabler="IconChevronDown"
                      hugeicons="ArrowDown01Icon"
                      phosphor="CaretDown"
                      remixicon="RiArrowDownSLine"
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <IconPlaceholder
                      lucide="ChevronUp"
                      tabler="IconChevronUp"
                      hugeicons="ArrowUp01Icon"
                      phosphor="CaretUp"
                      remixicon="RiArrowUpSLine"
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  {kpi.delta}
                </span>
              </div>
            )
          })}
        </div>

        <Separator />

        <p className="text-xs text-muted-foreground">
          Metrics reflect confirmed data for {quarterLabel}. Comparisons are
          against the prior quarter.
        </p>
      </div>
    </section>
  )
}

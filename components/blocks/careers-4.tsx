"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type Job = {
  title: string
  department: string
  location: string
  type: string
}

const jobs: Job[] = [
  {
    title: "Senior Frontend Engineer",
    department: "Engineering",
    location: "Remote",
    type: "Full-time",
  },
  {
    title: "Backend Engineer, Platform",
    department: "Engineering",
    location: "Berlin",
    type: "Full-time",
  },
  {
    title: "Product Designer",
    department: "Design",
    location: "Remote",
    type: "Full-time",
  },
  {
    title: "Design Systems Lead",
    department: "Design",
    location: "London",
    type: "Full-time",
  },
  {
    title: "Growth Marketing Manager",
    department: "Marketing",
    location: "Remote",
    type: "Full-time",
  },
  {
    title: "Content Strategist",
    department: "Marketing",
    location: "Remote",
    type: "Contract",
  },
  {
    title: "Customer Success Manager",
    department: "Operations",
    location: "New York",
    type: "Full-time",
  },
]

const departments = ["All", "Engineering", "Design", "Marketing", "Operations"]

export default function CareersBlock() {
  const [query, setQuery] = useState("")
  const [department, setDepartment] = useState("All")

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return jobs.filter((job) => {
      const matchesQuery =
        !q ||
        job.title.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q)
      const matchesDept = department === "All" || job.department === department
      return matchesQuery && matchesDept
    })
  }, [query, department])

  return (
    <section className="w-full bg-background px-6 py-16 text-foreground">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Careers
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            Open positions
          </h1>
          <p className="text-sm text-muted-foreground">
            Join us in building tools teams love. {jobs.length} roles open
            across the company.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          <div className="relative">
            <IconPlaceholder
              lucide="Search"
              tabler="IconSearch"
              hugeicons="SearchIcon"
              phosphor="MagnifyingGlass"
              remixicon="RiSearchLine"
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title or location..."
              className="pl-8"
              aria-label="Search jobs"
            />
          </div>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Filter by department"
          >
            {departments.map((dept) => (
              <button
                key={dept}
                type="button"
                aria-pressed={department === dept}
                onClick={() => setDepartment(dept)}
                className={cn(
                  "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                  department === dept
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        <p
          className="mt-6 text-xs text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <span className="font-medium text-foreground tabular-nums">
            {results.length}
          </span>{" "}
          {results.length === 1 ? "role" : "roles"}
        </p>

        <ScrollArea className="mt-2 h-96 border-y border-border [&_[data-slot=scroll-area-viewport]]:scroll-fade-y">
          <ul className="flex flex-col divide-y divide-border">
            {results.map((job) => (
              <li key={job.title}>
                <a
                  href="#"
                  className="group flex items-center justify-between gap-4 py-4 pr-3"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium">{job.title}</span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{job.department}</span>
                      <span className="inline-flex items-center gap-1">
                        <IconPlaceholder
                          lucide="MapPin"
                          tabler="IconMapPin2"
                          hugeicons="MapPinIcon"
                          phosphor="MapPin"
                          remixicon="RiMapPin2Line"
                          className="size-3.5"
                          aria-hidden="true"
                        />
                        {job.location}
                      </span>
                      <Badge variant="secondary" className="font-normal">
                        {job.type}
                      </Badge>
                    </span>
                  </div>
                  <IconPlaceholder
                    lucide="ArrowRight"
                    tabler="IconArrowRight"
                    hugeicons="ArrowRightIcon"
                    phosphor="ArrowRight"
                    remixicon="RiArrowRightLine"
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </a>
              </li>
            ))}
            {results.length === 0 && (
              <li className="py-10 text-center text-sm text-muted-foreground">
                No roles match your search.
              </li>
            )}
          </ul>
        </ScrollArea>
      </div>
    </section>
  )
}

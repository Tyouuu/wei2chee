import { Fragment } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type Cell = boolean | string

// Column 0 is always Acme (the highlighted, winning column).
const vendors = ["Acme", "Notion", "Trello", "Asana"]

const groups: { label: string; rows: { feature: string; values: Cell[] }[] }[] =
  [
    {
      label: "Core",
      rows: [
        { feature: "Unlimited projects", values: [true, true, false, true] },
        {
          feature: "Real-time collaboration",
          values: [true, true, true, true],
        },
        {
          feature: "Offline mode",
          values: [true, false, true, false],
        },
      ],
    },
    {
      label: "Automation",
      rows: [
        { feature: "Built-in workflows", values: [true, false, true, true] },
        { feature: "AI assistant", values: [true, true, false, false] },
        {
          feature: "Custom rules",
          values: ["Unlimited", "25", "5", "50"],
        },
      ],
    },
    {
      label: "Enterprise",
      rows: [
        { feature: "SAML SSO", values: [true, true, false, true] },
        { feature: "Audit log", values: [true, false, false, true] },
        { feature: "Data residency", values: [true, false, false, false] },
      ],
    },
  ]

function ValueCell({ value }: { value: Cell }) {
  if (typeof value === "string") {
    return <span className="text-sm text-foreground tabular-nums">{value}</span>
  }
  return value ? (
    <IconPlaceholder
      lucide="Check"
      tabler="IconCheck"
      hugeicons="Tick02Icon"
      phosphor="Check"
      remixicon="RiCheckLine"
      className="mx-auto size-4 text-foreground"
      aria-label="Yes"
    />
  ) : (
    <IconPlaceholder
      lucide="X"
      tabler="IconX"
      hugeicons="Cancel01Icon"
      phosphor="X"
      remixicon="RiCloseLine"
      className="mx-auto size-4 text-muted-foreground/40"
      aria-label="No"
    />
  )
}

export default function ComparisonBlock() {
  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-20 text-foreground">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mx-auto max-w-xl text-center">
          <span className="inline-block rounded-md border border-border px-3 py-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Comparison
          </span>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            How Acme compares
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            A side-by-side look at the features teams switch to us for.
          </p>
        </div>

        <div className="mt-12 overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[34%] align-bottom">
                  <span className="inline-block pb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Feature
                  </span>
                </TableHead>
                {vendors.map((vendor, index) => (
                  <TableHead
                    key={vendor}
                    className={
                      index === 0 ? "bg-muted/40 text-center" : "text-center"
                    }
                  >
                    <div className="flex flex-col items-center gap-1.5 py-3">
                      {index === 0 && <Badge>You</Badge>}
                      <span className="text-sm font-semibold text-foreground">
                        {vendor}
                      </span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <Fragment key={group.label}>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell
                      colSpan={vendors.length + 1}
                      className="py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                    >
                      {group.label}
                    </TableCell>
                  </TableRow>
                  {group.rows.map((row) => (
                    <TableRow key={row.feature}>
                      <TableCell className="text-sm text-foreground">
                        {row.feature}
                      </TableCell>
                      {row.values.map((value, index) => (
                        <TableCell
                          key={index}
                          className={
                            index === 0
                              ? "bg-muted/40 text-center"
                              : "text-center"
                          }
                        >
                          <ValueCell value={value} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </Fragment>
              ))}
              <TableRow className="hover:bg-transparent">
                <TableCell />
                <TableCell className="bg-muted/40 py-4 text-center">
                  <Button
                   
                   
                    size="sm"
                    className="w-full max-w-[9rem]"
                   asChild><a href="#" >
                    Try Acme free
                  </a></Button>
                </TableCell>
                <TableCell colSpan={vendors.length - 1} />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}

"use client"

import * as React from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Toaster } from "@/components/ui/sonner"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

type InvoiceStatus = "Paid" | "Pending" | "Failed"

const INVOICES: {
  id: string
  date: string
  amount: string
  status: InvoiceStatus
}[] = [
  {
    id: "INV-2026-0047",
    date: "Jun 1, 2026",
    amount: "$149.00",
    status: "Paid",
  },
  {
    id: "INV-2026-0031",
    date: "May 1, 2026",
    amount: "$149.00",
    status: "Paid",
  },
  {
    id: "INV-2026-0018",
    date: "Apr 1, 2026",
    amount: "$99.00",
    status: "Paid",
  },
  {
    id: "INV-2026-0009",
    date: "Mar 1, 2026",
    amount: "$99.00",
    status: "Failed",
  },
  {
    id: "INV-2026-0004",
    date: "Feb 1, 2026",
    amount: "$99.00",
    status: "Paid",
  },
  {
    id: "INV-2025-0089",
    date: "Jan 1, 2026",
    amount: "$49.00",
    status: "Pending",
  },
  {
    id: "INV-2025-0074",
    date: "Dec 1, 2025",
    amount: "$49.00",
    status: "Paid",
  },
]

const STATUS_VARIANT: Record<
  InvoiceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  Paid: "secondary",
  Pending: "outline",
  Failed: "destructive",
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
export const copy = { INVOICES, STATUS_VARIANT }
export type Copy = typeof copy


export default function BillingBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { INVOICES, STATUS_VARIANT } = { ...copy, ...override }
  const [selected, setSelected] = React.useState<Record<string, boolean>>({})

  const selectedIds = INVOICES.filter((i) => selected[i.id]).map((i) => i.id)
  const allSelected = selectedIds.length === INVOICES.length
  const someSelected = selectedIds.length > 0 && !allSelected

  function toggleAll(checked: boolean) {
    setSelected(
      checked ? Object.fromEntries(INVOICES.map((i) => [i.id, true])) : {}
    )
  }

  function handleDownload(id: string) {
    toast.success("Invoice downloaded", {
      description: `${id} has been saved to your device.`,
    })
  }

  function handleBulkDownload() {
    toast.success(
      `Downloading ${selectedIds.length} ${
        selectedIds.length === 1 ? "invoice" : "invoices"
      }`,
      { description: "Your files are being prepared." }
    )
  }

  return (
    <section className="flex w-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <Card className="w-full max-w-2xl overflow-hidden">
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>
            Download or review past invoices for your Acme workspace.
          </CardDescription>
          <CardAction>
            {selectedIds.length > 0 ? (
              <Button size="sm" variant="outline" onClick={handleBulkDownload}>
                <IconPlaceholder
                  lucide="Download"
                  tabler="IconDownload"
                  hugeicons="DownloadIcon"
                  phosphor="Download"
                  remixicon="RiDownloadLine"
                  data-icon="inline-start"
                />
                Download ({selectedIds.length})
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {INVOICES.length}
                </span>{" "}
                Invoices
              </span>
            )}
          </CardAction>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    aria-label="Select all invoices"
                    checked={(someSelected) ? "indeterminate" : (allSelected)}
                    
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                  />
                </TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {INVOICES.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  data-state={selected[invoice.id] ? "selected" : undefined}
                >
                  <TableCell className="pl-4">
                    <Checkbox
                      aria-label={`Select ${invoice.id}`}
                      checked={!!selected[invoice.id]}
                      onCheckedChange={(checked) =>
                        setSelected((prev) => ({
                          ...prev,
                          [invoice.id]: checked === true,
                        }))
                      }
                    />
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {invoice.id}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {invoice.date}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {invoice.amount}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[invoice.status]}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Download ${invoice.id}`}
                      onClick={() => handleDownload(invoice.id)}
                    >
                      <IconPlaceholder
                        lucide="Download"
                        tabler="IconDownload"
                        hugeicons="DownloadIcon"
                        phosphor="Download"
                        remixicon="RiDownloadLine"
                      />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Toaster />
    </section>
  )
}

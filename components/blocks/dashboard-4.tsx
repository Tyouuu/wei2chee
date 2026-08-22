import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

const kpis = [
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Wallet"
        tabler="IconWallet"
        hugeicons="WalletIcon"
        phosphor="Wallet"
        remixicon="RiWalletLine"
        {...p}
      />
    ),
    label: "Revenue",
    value: "$48,290",
    delta: 12.4,
    up: true,
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="ShoppingBag"
        tabler="IconShoppingBag"
        hugeicons="ShoppingBagIcon"
        phosphor="ShoppingBag"
        remixicon="RiShoppingBag3Line"
        {...p}
      />
    ),
    label: "Orders",
    value: "1,284",
    delta: 8.1,
    up: true,
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Users"
        tabler="IconUsersGroup"
        hugeicons="UserGroupIcon"
        phosphor="UsersThree"
        remixicon="RiTeamLine"
        {...p}
      />
    ),
    label: "Customers",
    value: "3,942",
    delta: 3.2,
    up: true,
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="CreditCard"
        tabler="IconCreditCard"
        hugeicons="CreditCardIcon"
        phosphor="CreditCard"
        remixicon="RiBankCardLine"
        {...p}
      />
    ),
    label: "Refunds",
    value: "$1,120",
    delta: 1.8,
    up: false,
  },
]

type Status = "Paid" | "Processing" | "Refunded"

const statusVariant: Record<Status, "default" | "secondary" | "outline"> = {
  Paid: "default",
  Processing: "secondary",
  Refunded: "outline",
}

const orders: {
  id: string
  name: string
  initials: string
  avatar: string
  amount: string
  status: Status
  date: string
}[] = [
  {
    id: "#3312",
    name: "Elena Duarte",
    initials: "ED",
    avatar: "https://i.pravatar.cc/80?img=45",
    amount: "$420.00",
    status: "Paid",
    date: "Jul 21",
  },
  {
    id: "#3311",
    name: "Marcus Feld",
    initials: "MF",
    avatar: "https://i.pravatar.cc/80?img=13",
    amount: "$180.50",
    status: "Processing",
    date: "Jul 21",
  },
  {
    id: "#3310",
    name: "Priya Nair",
    initials: "PN",
    avatar: "https://i.pravatar.cc/80?img=32",
    amount: "$650.00",
    status: "Paid",
    date: "Jul 20",
  },
  {
    id: "#3309",
    name: "Tomás Rivera",
    initials: "TR",
    avatar: "https://i.pravatar.cc/80?img=52",
    amount: "$92.00",
    status: "Refunded",
    date: "Jul 20",
  },
  {
    id: "#3308",
    name: "Hannah Osei",
    initials: "HO",
    avatar: "https://i.pravatar.cc/80?img=27",
    amount: "$1,240.00",
    status: "Paid",
    date: "Jul 19",
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
export const copy = { orders }
export type Copy = typeof copy


export default function DashboardBlock({ copy: override }: { copy?: Partial<Copy> } = {}) {
  const { orders } = { ...copy, ...override }
  return (
    <section className="flex min-h-svh w-full items-start justify-center bg-background px-6 py-12 text-foreground">
      <div className="w-full max-w-4xl">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Overview
          </p>
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            Dashboard
          </h1>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
          {kpis.map(({ icon: Icon, label, value, delta, up }) => (
            <div key={label} className="flex flex-col gap-3 bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {label}
                </span>
                <Icon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <span className="text-2xl font-bold tracking-tight tabular-nums">
                {value}
              </span>
              <span
                className={
                  up
                    ? "inline-flex items-center gap-1 text-xs font-medium text-foreground"
                    : "inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"
                }
              >
                {up ? (
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
                {delta}% vs last month
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="font-heading text-sm font-semibold tracking-tight">
              Recent orders
            </h2>
            <span className="text-xs text-muted-foreground">Last 7 days</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Customer
                </TableHead>
                <TableHead className="hidden text-xs font-semibold tracking-wider text-muted-foreground uppercase sm:table-cell">
                  Order
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Status
                </TableHead>
                <TableHead className="hidden text-xs font-semibold tracking-wider text-muted-foreground uppercase md:table-cell">
                  Date
                </TableHead>
                <TableHead className="pr-5 text-right text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Amount
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow
                  key={order.id}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                >
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-7 border border-border">
                        <AvatarImage
                          src={order.avatar}
                          alt={order.name}
                          className="grayscale"
                        />
                        <AvatarFallback className="text-[10px]">
                          {order.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{order.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                    {order.id}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusVariant[order.status]}
                      className="text-[11px] font-medium"
                    >
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {order.date}
                  </TableCell>
                  <TableCell className="pr-5 text-right text-sm font-semibold tabular-nums">
                    {order.amount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}

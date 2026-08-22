import type { IndustryLabels } from "../industry-template";
import type { ModuleCopy } from "./types";

/**
 * The vocabulary for each archetype, in English -- the DEFAULT for every system
 * this product builds. See lib/system-lang.ts for why.
 *
 * Written as Malaysian business English, which is a specific dialect and not
 * American SaaS English: "Outstanding" not "Accounts receivable", "Terms" not
 * "Net 30", "Reconciliation" for the month-end tie-out against an upstream
 * statement that every dealer and distributor here actually does. British
 * spelling throughout -- "Enrolment", "Cheque", "Organise" -- because that is
 * what LHDN, SSM and every bank statement in the country use.
 *
 * `labels` carries the trade's three nouns, so a module reads correctly whether
 * the business calls its counterparties Clients, Customers or Dealers.
 *
 * Every case here has a twin in module-copy.zh.ts. The parity is asserted in
 * industry-template.test.ts.
 */
export function moduleCopyEn(key: string, labels: IndustryLabels): ModuleCopy {
  switch (key) {
    case "reconciliation":
      return {
        title: "Monthly reconciliation",
        subtitle:
          "The total your upstream gave you, against the total your own records add up to. How far apart, and which line.",
        columns: {
          primary: "Item",
          secondary: "Reference",
          amount: "Amount",
          status: "Result",
        },
        rows: [
          {
            primary: "System total",
            secondary: "128 entries this month",
            amount: "RM 246,800",
            tone: "positive",
            status: "Checked",
          },
          {
            primary: "Upstream statement",
            secondary: "Their figure",
            amount: "RM 246,800",
            tone: "positive",
            status: "Matches",
          },
          {
            primary: "Unexplained difference",
            secondary: "REF-2026-0817",
            amount: "RM 0",
            tone: "neutral",
            status: "None",
          },
        ],
        hero: {
          label: "Difference this month",
          value: "RM 0",
          suffix: "System vs upstream",
          stats: [
            { label: "System total", value: "RM 246,800", sub: "128 entries" },
            { label: "Upstream total", value: "RM 246,800", sub: "Their figure" },
            { label: "To check", value: "0" },
          ],
        },
        variance: {
          title: "This month ties out",
          description:
            "Your total and the upstream statement agree. When they do not, the reference numbers to chase are listed here.",
        },
      };

    case "commission":
      return {
        title: "Commission",
        subtitle:
          "What is owed this month, worked out line by line. No more opening Excel.",
        columns: {
          primary: "Paid to",
          secondary: "Basis",
          amount: "Commission",
          status: "Status",
        },
        rows: [
          {
            primary: `${labels.customer} A`,
            secondary: "Turnover × 2%",
            amount: "RM 1,240",
            tone: "positive",
            status: "Settled",
          },
          {
            primary: `${labels.customer} B`,
            secondary: "Turnover × 2%",
            amount: "RM 860",
            tone: "warning",
            status: "To pay",
          },
          {
            primary: `${labels.customer} C`,
            secondary: "Turnover × 2%",
            amount: "RM 415",
            tone: "neutral",
            status: "Calculating",
          },
        ],
        hero: {
          label: "Commission this month",
          value: "RM 2,515",
          suffix: "vs last month",
          stats: [
            { label: "Settled", value: "RM 1,240" },
            { label: "To pay", value: "RM 860", tone: "caution" },
            { label: "Calculating", value: "RM 415" },
          ],
        },
      };

    case "expenses":
      return {
        title: "Expenses",
        subtitle:
          "Where the money went, with a receipt on every line. Set against takings, this is what tells you the real margin.",
        columns: {
          primary: "Expense",
          secondary: "Paid to",
          amount: "Amount",
          status: "Status",
        },
        rows: [
          {
            primary: "Materials",
            secondary: "Hardware supplier",
            amount: "RM 8,400",
            tone: "positive",
            status: "Paid",
          },
          {
            primary: `${labels.staff} wages`,
            secondary: "This month",
            amount: "RM 12,000",
            tone: "positive",
            status: "Paid",
          },
          {
            primary: "Petrol / tolls",
            secondary: "To reimburse",
            amount: "RM 640",
            tone: "warning",
            status: "Unpaid",
          },
        ],
        hero: {
          label: "Spent this month",
          value: "RM 21,040",
          suffix: "vs last month",
          stats: [
            { label: "Paid", value: "RM 20,400" },
            { label: "Unpaid", value: "RM 640", tone: "caution" },
            { label: "No receipt", value: "1", tone: "warn" },
          ],
        },
        upload: {
          label: "Receipt / invoice",
          hint: "Snap a photo or upload a PDF and this expense has proof",
        },
      };

    case "reports":
      return {
        title: "Monthly report",
        subtitle:
          "The trend, month by month. Export it for your accountant, your bank, or yourself.",
        columns: {
          primary: "Month",
          secondary: "Entries",
          amount: "Turnover",
          status: "vs last month",
        },
        rows: [
          {
            primary: "August 2026",
            secondary: "128",
            amount: "RM 71,300",
            tone: "positive",
            status: "Up",
          },
          {
            primary: "July 2026",
            secondary: "104",
            amount: "RM 58,000",
            tone: "warning",
            status: "Down",
          },
          {
            primary: "June 2026",
            secondary: "117",
            amount: "RM 63,000",
            tone: "positive",
            status: "Up",
          },
        ],
        hero: {
          label: "Turnover this month",
          value: "RM 71,300",
          suffix: "vs last month",
          stats: [
            { label: "Entries", value: "128" },
            { label: "Average value", value: "RM 557" },
            { label: "Growth", value: "23%" },
          ],
        },
        trend: {
          title: "Turnover, last six months",
          caption: "Each bar is one month.",
          unit: "RM",
          points: [
            { label: "Mar", value: 42000 },
            { label: "Apr", value: 51000 },
            { label: "May", value: 47000 },
            { label: "Jun", value: 63000 },
            { label: "Jul", value: 58000 },
            { label: "Aug", value: 71300 },
          ],
        },
      };

    case "ranking":
      return {
        title: "Activity ranking",
        subtitle:
          "Who is pulling their weight and who is slipping. Ranked on value, frequency and how recently they moved.",
        columns: {
          primary: labels.customer,
          secondary: "Last active",
          amount: "Last 90 days",
          status: "Tier",
        },
        rows: [
          {
            primary: `${labels.customer} A`,
            secondary: "2 days ago",
            amount: "RM 48,500",
            tone: "positive",
            status: "Top",
          },
          {
            primary: `${labels.customer} B`,
            secondary: "9 days ago",
            amount: "RM 22,800",
            tone: "positive",
            status: "Active",
          },
          {
            primary: `${labels.customer} C`,
            secondary: "41 days ago",
            amount: "RM 3,200",
            tone: "warning",
            status: "Slipping",
          },
        ],
        filter: { kind: "Window", value: "Last 90 days" },
        trend: {
          title: "Active count",
          caption: "Top and Active added together, by month.",
          unit: "",
          points: [
            { label: "Mar", value: 12 },
            { label: "Apr", value: 14 },
            { label: "May", value: 13 },
            { label: "Jun", value: 17 },
            { label: "Jul", value: 19 },
            { label: "Aug", value: 23 },
          ],
        },
      };

    case "suppliers":
      return {
        title: "Suppliers",
        subtitle: "Who you buy from, on what terms, and what is still owed.",
        columns: {
          primary: "Supplier",
          secondary: "Contact / terms",
          amount: "Outstanding",
          status: "Status",
        },
        rows: [
          {
            primary: "Hardware supplier A",
            secondary: "016-2xx xxxx · 30 days",
            amount: "RM 8,400",
            tone: "warning",
            status: "Owing",
          },
          {
            primary: "Hardware shop B",
            secondary: "012-3xx xxxx · Cash",
            amount: "RM 0",
            tone: "positive",
            status: "Settled",
          },
          {
            primary: "Marble works C",
            secondary: "018-8xx xxxx · 60 days",
            amount: "RM 15,200",
            tone: "neutral",
            status: "Not yet due",
          },
        ],
        searchPlaceholder: "Search suppliers",
      };

    case "staff":
      return {
        title: labels.staff,
        subtitle:
          "Who is on what, how much they did this month, and how their pay works out.",
        columns: {
          primary: labels.staff,
          secondary: "Assigned",
          amount: "This month",
          status: "Status",
        },
        rows: [
          {
            primary: `${labels.staff} A`,
            secondary: "3 jobs running",
            amount: "RM 48,500",
            tone: "positive",
            status: "Working",
          },
          {
            primary: `${labels.staff} B`,
            secondary: "1 job running",
            amount: "RM 22,800",
            tone: "positive",
            status: "Working",
          },
          {
            primary: `${labels.staff} C`,
            secondary: "On leave",
            amount: "RM 0",
            tone: "neutral",
            status: "Leave",
          },
        ],
        searchPlaceholder: `Search ${labels.staff.toLowerCase()}`,
      };

    case "inventory":
      return {
        title: "Stock",
        subtitle:
          "How much is left, what is running out, and what has been sitting too long.",
        columns: {
          primary: "Item",
          secondary: "Location / unit",
          amount: "Qty",
          status: "Status",
        },
        rows: [
          {
            primary: "Item A",
            secondary: "Store 1 · carton",
            amount: "128",
            tone: "positive",
            status: "In stock",
          },
          {
            primary: "Item B",
            secondary: "Store 1 · piece",
            amount: "9",
            tone: "warning",
            status: "Running low",
          },
          {
            primary: "Item C",
            secondary: "Store 2 · carton",
            amount: "340",
            tone: "neutral",
            status: "Slow moving",
          },
        ],
        searchPlaceholder: "Search by name or code",
        filter: { kind: "Status", value: "Running low" },
      };

    case "tasks":
      return {
        title: "Tasks",
        subtitle: "Who is on what, when it is due, and whether it is done.",
        columns: {
          primary: "Task",
          secondary: labels.staff,
          amount: "Due",
          status: "Status",
        },
        rows: [
          {
            primary: "Site measurement",
            secondary: `${labels.staff} A`,
            amount: "22 Aug",
            tone: "warning",
            status: "Today",
          },
          {
            primary: "Send quotation",
            secondary: `${labels.staff} B`,
            amount: "24 Aug",
            tone: "neutral",
            status: "To do",
          },
          {
            primary: "Order materials",
            secondary: `${labels.staff} A`,
            amount: "19 Aug",
            tone: "positive",
            status: "Done",
          },
        ],
        filter: { kind: "Status", value: "To do" },
      };

    default:
      // Unreachable for catalogue keys -- every one of them is cased above and
      // industry-template.test.ts asserts it. Kept as a working page rather than
      // a throw: a customer's own system is the wrong place to discover a
      // missing switch arm.
      return {
        title: "New module",
        subtitle: "Every name and column below can be changed to yours.",
        columns: {
          primary: "Item",
          secondary: "Detail",
          amount: "Amount",
          status: "Status",
        },
        rows: [
          {
            primary: "Record 001",
            secondary: "Sample content",
            amount: "RM 0",
            tone: "positive",
            status: "Done",
          },
          {
            primary: "Record 002",
            secondary: "Sample content",
            amount: "RM 0",
            tone: "warning",
            status: "In progress",
          },
          {
            primary: "Record 003",
            secondary: "Sample content",
            amount: "RM 0",
            tone: "neutral",
            status: "To do",
          },
        ],
      };
  }
}

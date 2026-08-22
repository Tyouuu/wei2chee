import type { SampleSet } from "./types";

/**
 * Sample rows in English -- the DEFAULT for every system this product builds.
 * See lib/system-lang.ts for why English and not Chinese.
 *
 * These are NOT translations of the Chinese table. They are the same businesses
 * written the way their own English paperwork is written: a Klang Valley
 * contractor's job sheet says "Taman Desa 3-room reno", not "Three-bedroom
 * renovation project at Taman Desa". Names stay Malaysian and stay mixed --
 * Chinese, Malay and Indian in the same customer list -- because that is what a
 * real customer list here looks like, and a page of Smith and Johnson is the
 * fastest way to tell an owner this system was not built for them.
 *
 * Key parity with SAMPLES_ZH is asserted in industry-template.test.ts: a trade
 * that exists in one language and not the other would silently fall through to
 * the generic set.
 */
export const SAMPLES_EN: Record<string, SampleSet> = {
  renovation: {
    records: [
      {
        primary: "Taman Desa 3-room reno",
        secondary: "Mr Tan",
        amount: "RM 48,500",
        tone: "positive",
        status: "Confirmed",
      },
      {
        primary: "Bukit Jalil kitchen",
        secondary: "Mrs Lee",
        amount: "RM 22,800",
        tone: "warning",
        status: "Awaiting reply",
      },
      {
        primary: "Cheras shoplot fitout",
        secondary: "Mr Wong",
        amount: "RM 96,000",
        tone: "neutral",
        status: "Quoting",
      },
    ],
    customers: [
      {
        primary: "Mr Tan",
        secondary: "Taman Desa · 013-2xx xxxx",
        tone: "positive",
        status: "In progress",
      },
      {
        primary: "Mrs Lee",
        secondary: "Bukit Jalil · 012-3xx xxxx",
        tone: "warning",
        status: "To follow up",
      },
      {
        primary: "Mr Wong",
        secondary: "Cheras · 016-8xx xxxx",
        tone: "neutral",
        status: "New",
      },
    ],
    heroLabel: "Confirmed jobs this month",
    heroValue: "RM 71,300",
    heroSuffix: "vs last month",
    heroStats: [
      { label: "Jobs running", value: "4" },
      { label: "Quotes awaiting reply", value: "2", tone: "caution" },
      {
        label: "Done, not yet paid",
        value: "RM 31,200",
        tone: "warn",
        sub: "Over 30 days",
      },
    ],
    heroSpark: [42000, 51000, 47500, 58000, 63000, 71300],
  },
  retail: {
    records: [
      {
        primary: "Order #10238",
        secondary: "Store pickup",
        amount: "RM 356",
        tone: "positive",
        status: "Paid",
      },
      {
        primary: "Order #10239",
        secondary: "Delivery · Puchong",
        amount: "RM 1,240",
        tone: "warning",
        status: "To ship",
      },
      {
        primary: "Order #10240",
        secondary: "Store pickup",
        amount: "RM 89",
        tone: "neutral",
        status: "New",
      },
    ],
    customers: [
      {
        primary: "Siti binti Ahmad",
        secondary: "Member · RM 3,420 to date",
        tone: "positive",
        status: "Active",
      },
      {
        primary: "Tan Chee Meng",
        secondary: "Member · RM 780 to date",
        tone: "neutral",
        status: "Occasional",
      },
      {
        primary: "Kumar A/L Raj",
        secondary: "New member",
        tone: "warning",
        status: "To follow up",
      },
    ],
    heroLabel: "Sales this month",
    heroValue: "RM 18,940",
    heroSuffix: "vs last month",
    heroStats: [
      { label: "Orders today", value: "23" },
      { label: "To ship", value: "5", tone: "caution" },
      {
        label: "Running low",
        value: "3 items",
        tone: "warn",
        sub: "Below reorder level",
      },
    ],
    heroSpark: [14200, 15800, 17100, 16400, 18000, 18940],
  },
  beauty: {
    records: [
      {
        primary: "Facial · 90 min",
        secondary: "Today 2:00 PM · Amy",
        amount: "RM 180",
        tone: "positive",
        status: "Confirmed",
      },
      {
        primary: "Colour + treatment",
        secondary: "Today 4:30 PM · Jasmine",
        amount: "RM 320",
        tone: "warning",
        status: "To confirm",
      },
      {
        primary: "Manicure",
        secondary: "Tomorrow 11:00 AM · Amy",
        amount: "RM 95",
        tone: "neutral",
        status: "Booked",
      },
    ],
    customers: [
      {
        primary: "Ms Lim",
        secondary: "Regular · 14 visits",
        tone: "positive",
        status: "Member",
      },
      {
        primary: "Nurul",
        secondary: "3 visits",
        tone: "neutral",
        status: "Occasional",
      },
      {
        primary: "Mrs Cheong",
        secondary: "First visit",
        tone: "warning",
        status: "New",
      },
    ],
    heroLabel: "Booking revenue this month",
    heroValue: "RM 12,650",
    heroSuffix: "vs last month",
    heroStats: [
      { label: "Bookings this week", value: "31" },
      { label: "To confirm", value: "4", tone: "caution" },
      {
        label: "Not seen in 3 months",
        value: "18",
        tone: "warn",
        sub: "Worth a call",
      },
    ],
    heroSpark: [9800, 10400, 11200, 10900, 12100, 12650],
  },
  wholesale: {
    records: [
      {
        primary: "PO-2026-0412",
        secondary: "Loong Hing Trading",
        amount: "RM 24,600",
        tone: "positive",
        status: "Shipped",
      },
      {
        primary: "PO-2026-0413",
        secondary: "Mei Jia Supermarket",
        amount: "RM 8,150",
        tone: "warning",
        status: "Unpaid",
      },
      {
        primary: "PO-2026-0414",
        secondary: "Sin Foong Trading",
        amount: "RM 41,900",
        tone: "neutral",
        status: "Packing",
      },
    ],
    customers: [
      {
        primary: "Loong Hing Trading",
        secondary: "30-day terms · Rep: Ah Seng",
        tone: "positive",
        status: "Current",
      },
      {
        primary: "Mei Jia Supermarket",
        secondary: "60-day terms · Rep: Mei",
        tone: "negative",
        status: "Overdue",
      },
      {
        primary: "Sin Foong Trading",
        secondary: "Cash on delivery",
        tone: "neutral",
        status: "Current",
      },
    ],
    heroLabel: "Shipped this month",
    heroValue: "RM 186,400",
    heroSuffix: "vs last month",
    heroStats: [
      { label: "Orders shipped", value: "62" },
      {
        label: "Unpaid",
        value: "RM 43,800",
        tone: "caution",
        sub: "Terms not yet due",
      },
      {
        label: "Overdue",
        value: "RM 12,400",
        tone: "warn",
        sub: "Mei Jia · 60 days",
      },
    ],
    heroSpark: [142000, 158000, 151000, 169000, 177000, 186400],
  },
  services: {
    records: [
      {
        primary: "Brand consulting",
        secondary: "Alpha Sdn Bhd",
        amount: "RM 32,000",
        tone: "positive",
        status: "In progress",
      },
      {
        primary: "Systems review",
        secondary: "Beta Enterprise",
        amount: "RM 8,500",
        tone: "warning",
        status: "Awaiting signature",
      },
      {
        primary: "Annual maintenance",
        secondary: "Gamma Holdings",
        amount: "RM 60,000",
        tone: "neutral",
        status: "Proposed",
      },
    ],
    customers: [
      {
        primary: "Alpha Sdn Bhd",
        secondary: "Lead: Kevin",
        tone: "positive",
        status: "Engaged",
      },
      {
        primary: "Beta Enterprise",
        secondary: "Lead: Kevin",
        tone: "warning",
        status: "Following up",
      },
      {
        primary: "Gamma Holdings",
        secondary: "Lead: Shirley",
        tone: "neutral",
        status: "Prospect",
      },
    ],
    heroLabel: "Signed this month",
    heroValue: "RM 40,500",
    heroSuffix: "vs last month",
    heroStats: [
      { label: "Active engagements", value: "6" },
      { label: "Proposals out", value: "3", tone: "caution" },
      { label: "Done, not invoiced", value: "RM 18,000", tone: "warn" },
    ],
    heroSpark: [28000, 31000, 29500, 36000, 38000, 40500],
  },
  fnb: {
    records: [
      {
        primary: "Table 3",
        secondary: "Dine-in · 4 pax",
        amount: "RM 128",
        tone: "positive",
        status: "Settled",
      },
      {
        primary: "Takeaway #88",
        secondary: "Grab · Bangsar",
        amount: "RM 46",
        tone: "warning",
        status: "Cooking",
      },
      {
        primary: "Table 7",
        secondary: "Dine-in · 2 pax",
        amount: "RM 72",
        tone: "neutral",
        status: "Ordering",
      },
    ],
    customers: [
      {
        primary: "Mr Tan (regular)",
        secondary: "Books every Wednesday",
        tone: "positive",
        status: "Regular",
      },
      {
        primary: "Grab Food",
        secondary: "Delivery platform",
        tone: "neutral",
        status: "Channel",
      },
      {
        primary: "Delta Sdn Bhd catering",
        secondary: "Monthly office lunch",
        tone: "warning",
        status: "To confirm",
      },
    ],
    heroLabel: "Takings today",
    heroValue: "RM 3,280",
    heroSuffix: "vs yesterday",
    heroStats: [
      { label: "Orders today", value: "96" },
      { label: "Delivery share", value: "38%", sub: "Grab + Foodpanda" },
      {
        label: "Food cost",
        value: "31%",
        tone: "caution",
        sub: "Target under 28%",
      },
    ],
    heroSpark: [2650, 2980, 3120, 2740, 3350, 3280],
  },
  education: {
    records: [
      {
        primary: "Form 3 Maths · Tue",
        secondary: "18 students · Teacher Tan",
        amount: "RM 220/mo",
        tone: "positive",
        status: "Running",
      },
      {
        primary: "Std 6 BM · Sat",
        secondary: "12 students · Teacher Lim",
        amount: "RM 180/mo",
        tone: "warning",
        status: "Enrolling",
      },
      {
        primary: "SPM intensive",
        secondary: "8 students · Teacher Wong",
        amount: "RM 400/mo",
        tone: "neutral",
        status: "Preparing",
      },
    ],
    customers: [
      {
        primary: "Mr Tan (Tan Xiao Ming)",
        secondary: "Form 3 · Maths",
        tone: "positive",
        status: "Paid",
      },
      {
        primary: "Puan Aminah (Aiman)",
        secondary: "Std 6 · BM",
        tone: "warning",
        status: "Unpaid",
      },
      {
        primary: "Mr Lee (Lee Mei Qi)",
        secondary: "SPM intensive",
        tone: "neutral",
        status: "Just enrolled",
      },
    ],
    heroLabel: "Fees collected this month",
    heroValue: "RM 24,600",
    heroSuffix: "vs last month",
    heroStats: [
      { label: "Students enrolled", value: "74" },
      { label: "Fees unpaid", value: "9", tone: "caution", sub: "RM 2,180" },
      { label: "Did not renew", value: "5", tone: "warn" },
    ],
    heroSpark: [19800, 21200, 22400, 23100, 23800, 24600],
  },
};

export const GENERIC_SAMPLE_EN: SampleSet = {
  records: [
    {
      primary: "Record 001",
      secondary: "Sample content",
      amount: "RM 1,200",
      tone: "positive",
      status: "Done",
    },
    {
      primary: "Record 002",
      secondary: "Sample content",
      amount: "RM 850",
      tone: "warning",
      status: "In progress",
    },
    {
      primary: "Record 003",
      secondary: "Sample content",
      amount: "RM 3,400",
      tone: "neutral",
      status: "To do",
    },
  ],
  customers: [
    {
      primary: "Customer A",
      secondary: "Sample contact",
      tone: "positive",
      status: "Active",
    },
    {
      primary: "Customer B",
      secondary: "Sample contact",
      tone: "warning",
      status: "To follow up",
    },
    {
      primary: "Customer C",
      secondary: "Sample contact",
      tone: "neutral",
      status: "New",
    },
  ],
  heroLabel: "Total this month",
  heroValue: "RM 5,450",
  heroSuffix: "vs last month",
  heroStats: [
    { label: "In progress", value: "4" },
    { label: "Waiting", value: "2", tone: "caution" },
    { label: "To follow up", value: "1", tone: "warn" },
  ],
  heroSpark: [3800, 4200, 4600, 4400, 5100, 5450],
};

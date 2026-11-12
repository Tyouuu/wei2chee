# Formae

A Malaysian SME owner describes their business for two minutes, and
immediately gets an editable business system and a public website back — then
a human finishes building the real thing. Built on my own, pre-launch.

**Status:** pre-launch, not a finished product. Known gaps are tracked openly
in `PRODUCT.md` rather than hidden — for example, there is no payment gateway
yet, and one placeholder phone number is still live on two buttons on the
marketing site.

## The idea

The buyer and the operator are the same person: a renovation contractor, an
aircon company, a kopitiam, a salon, a tuition centre. Fifty-something is
common. They run the business on WhatsApp and a notebook, not software.

Durable and Wix ADI generate a site from three multiple-choice questions.
Formae instead has a two-minute conversation with the owner — enough to ask
for the actual photo, the actual price, the actual opening hours — so the
system and the public website are built from the same real description, not a
template.

The one thing a website builder can't copy: a stranger who fills in the form
on the generated site lands as a real enquiry inside the owner's own system,
not an email nobody checks.

## What I built

- A two-minute guided conversation that produces a working business system and
  a public website together, not two separate outputs.
- A page editor (Puck) with a design rail, a stock-photo picker wired to
  Pixabay (fetched server-side into the customer's own storage, never
  hot-linked), and an AI assistant that can perform real layout edits on a
  page that already holds the customer's own content.
- Six structural page layouts ("registers") × twelve colour palettes, cut down
  from fourteen layouts after testing — a layout is a skeleton of what
  sections exist and in what order, not a paint job.
- Role-based access (Row-Level Security in Postgres) separating what the
  business owner sees from what a visiting stranger can submit.
- A public booking/enquiry flow (`/b/[ref]`) where a customer can cancel their
  own appointment or leave a review from a link, with no account needed.

## What I found and fixed

Before shipping any of the above I measured the market instead of guessing:
screenshotted 19 trading Malaysian SME websites and 9 existing SME business
systems to find real patterns (where WhatsApp buttons sit, what colours
competitors actually use, how many put a price on the first screen — zero of
19 did). The product's structural decisions are built on those numbers, not
assumptions, and the measurements are kept in the repo instead of thrown away
after the decision was made.

## Built with

Next.js 16 · TypeScript · Tailwind v4 · shadcn/Radix · Puck editor · Supabase
(Postgres, RLS, security-definer RPCs) · OpenAI · Vercel

*All business data in the system is sample data — `accounts`, `projects`,
`project_pages` and `site_enquiries` are the only tables, and a visiting
customer always sees the same seeded demo business.*

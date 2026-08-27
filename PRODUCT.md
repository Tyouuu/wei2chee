# Product

Formae. A Malaysian SME owner describes their business for two minutes and
immediately sees their own editable business system and public website. A human
then builds the real thing.

Written 2026-08-27 from `docs/founder-points.md`, `docs/founder-tasks.md`, and
the measurements in `.screenshots/`. Nothing here is invented; every number
carries where it was measured.

## Platform

web

## Stack

Next.js 16 · Tailwind v4 · shadcn/Radix · Puck editor (`@puckeditor/core`) ·
Supabase (RLS, security-definer RPCs) · OpenAI for the two-minute analysis and
the editor assistant · Pixabay for the stock photo library · Vercel.

## Users

**The buyer and the operator are the same person:** the owner of a Malaysian
SME. A renovation contractor, an aircon company, a kopitiam, a salon, a tuition
centre, a wholesaler. Fifty-something is common. Runs the business on WhatsApp
and a notebook. Uses SQL Account or AutoCount for the books, or nothing.

**The visitor** is that owner's own customer: a homeowner in Klang Valley
looking for someone to renovate a kitchen. On a mid-range Android over 4G. They
will not fill in a form to find out a price; they will press WhatsApp or leave.

Neither of them is a designer or a developer. The 3,571-component library at
UIverse and the 216-section catalogue in this repo are OUR tools, not theirs.

## Product Purpose

Two minutes of talking becomes a system the owner can see and change, and a
public website that produces real enquiries. Then a person builds it for them.

The arrow that makes it real: a stranger fills the form on `/s/<slug>`, and it
lands in the owner's own system as an enquiry. That has been live since
2026-08-25 and it is the one thing Wix cannot copy, because Wix has no system
on the other end.

## Positioning

Not accounting, and deliberately not. Measured 2026-08-26: SQL Account Cloud is
RM79/month with LHDN e-Invoice included and a ten-year price guarantee;
Financio is RM50–135, also included. Ours is RM199 with no e-Invoice. That war
is lost before it starts and it does not need to be fought.

What nobody local sells is **the doing layer**: which of my twelve renovation
jobs is waiting on a deposit, which quotation has been unanswered for seven
days, how an enquiry from the website becomes a quotation. Owners do that on
WhatsApp and paper today.

Against Durable and Wix ADI, the difference is structural rather than
featural: they generate a site from three questions; we have a two-minute
conversation, so we can ask for the photograph, the price and the opening
hours — and the system and the website grow from the same description.

## Operating Context

Malaysia. English on the customer-facing product; the Formae interface is
English too (`npm run check:en` keeps it at zero Chinese strings). The founder
and I speak Chinese.

LHDN e-Invoice has been mandatory for RM1m+ businesses since 2026-01-01, with
penalties from 2028. That is the strongest reason an owner starts looking for
software at all, even though we do not sell that feature.

Pre-launch. Three projects exist in the database as of 2026-08-27, all ours.

## Capabilities and Constraints

- **Six registers** (风格), cut from fourteen on 2026-08-27. Each is a
  skeleton — which sections exist, in what order, on what ground, in what shape
  — not a paint job. Twelve palettes sit on a separate axis.
- **The editor** is Puck with a rail, a photo picker wired to Pixabay (fetched
  server-side into the customer's own storage — never hot-linked), and an AI
  assistant that performs eleven layout operations on a page that already holds
  the customer's real content.
- **Generation is read-time until first save.** After the customer saves once,
  the page is theirs and nothing regenerates it. The public route reads the
  saved layout and 404s without one.
- 🔴 **No payment gateway.** The site says RM500 for a spec and there is no
  button to pay it.
- 🔴 **`lib/brand.ts` still carries `60123456789`**, a placeholder. Two of the
  most important buttons on our own site dial a number nobody owns.
- **Every customer sees the same sample data.** `accounts`, `projects`,
  `project_pages` and `site_enquiries` are the only business tables; the rows in
  a customer's tables are written into `lib/portal/sample-system.ts`.

## Brand Commitments

- **Dark is Formae, light is the customer, white is their paper.** The portal
  chrome is ours; the canvas wears the customer's register.
- A published page never prompts. 编辑器负责催，公开的页面永远不出现「催」 —
  empty photo frames, placeholder phone numbers and `RM —` price rows are
  dropped at publication, because a stranger would dial that number.
- We never invent a fact about a real business: no fabricated certification, no
  invented team member, no price we were not given.
- Only public business contact details are collected, never personal data
  (PDPA 2010).

## Evidence on Hand

Measured, with the command that reproduces each:

- **19 trading Malaysian SME sites** (`npm run shoot:market`, 2026-08-27):
  15/19 give WhatsApp on the first screen · 14/19 open on a photograph, median
  59% of the screen · headline 38px desktop / 32px mobile · body measure 574px
  · **0/19 put a price on the first screen**.
- **9 business systems** (`.screenshots/colours/`, 2026-08-26): grounds 9/9
  neutral, primaries 9/9 coloured, **7/9 in hue 230–290**. The two Malaysian
  ones (AutoCount, SQL Account) are both blue, not red.
- **lapa.ninja, 7,303 landing pages**: Minimal 42%, **3D Websites 2%**.
- **landing.love, 2,141 motion sites**: Minimal 64%, and 13 of 32 sampled
  cannot be screenshotted at all because they open on a loader.
- **Wix's `Home Remodeling` and `Painting Company` templates**: page grounds
  #FEFEF2 and #EFE7E9 (pale), panels #FFFE99 and #CD5334 (strong), 20–27
  painted areas per page, 6 and 14 photographs.
- **Ours, same count**: 1–10 painted areas, 2–5 photographs.

Photographs: Pixabay via `PIXABAY_KEY`, fetched by our server into the
customer's `site-photos` bucket. Four measured queries per trade live in
`lib/images/stock.ts` — the first candidate of a single unmeasured query
returned a floor plan for `kitchen renovation`.

## Product Principles

1. **一切以市场为准.** The test is not whether it is beautiful to us, it is
   whether a Malaysian SME owner would choose it.
2. **只要质量.** Fourteen registers where six are reachable is upkeep, not
   choice. Culled to six on 2026-08-27.
3. **用眼睛看，不要用量的.** Screenshot first, look, then measure — and only
   where the eye cannot judge (contrast, hit targets).
4. **Every register is a different skeleton.** Repaint it and it must still be
   another design; if a palette can take the difference away, it was a palette.
5. **Every source leaves one thing, and nothing overwrites what came before.**
   `design-system/upstream.json` records what was taken from each of 25 sources
   and which register it landed in; `npm run check:upstream` prints the ones
   that landed nowhere.
6. **The style library exists to save the founder's time**, not to be a
   gallery. An option no owner is ever shown is not a choice.

## Accessibility & Inclusion

Body and placeholder text at 4.5:1, large text at 3:1, enforced per register by
a unit test over the token files rather than by a browser pass (`check:contrast`
only ever measured whichever register was live). 中台 currently fails with 22
strings under 4.5:1, worst 1.18:1 — open, documented in founder-tasks 36.

Touch targets 52px on the registers aimed at older owners. Print styles ship
for every customer page: a quotation has to survive being printed.
`prefers-reduced-motion` disables every entrance, the sheen and the tilt.

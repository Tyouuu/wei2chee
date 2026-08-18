# Formae Customer Portal & Drag-and-Drop Editor — Design Spec

**Status:** Approved for implementation
**Source:** Brainstorming session 2026-08-18, following the design-system-and-style-picker work. This is the "workflow builder" half of subsystem 2 (client co-design tooling) from the original proposal — informally called "Phase 2.5" in earlier discussion, now scoped concretely.

## 1. Context and Purpose

The acquisition site (subsystem 1) and the style-picker (subsystem 2, style half) both end in a WhatsApp handoff — there is currently no account, no login, and nothing a customer can call "their own." This spec gives customers a real account, a place to land after choosing a style, and a hands-on way to preview arranging their own business system using the existing 21-component design-system library — before committing to pay.

**What this is not:** this is not subsystem 3 (the real, working Customer/Quotation/Project/Payment business system) and not subsystem 4 (the AI multi-agent backend). What a customer builds here is a **design/blueprint**, not a live running application. "Deploying" it (see §6) hands the design to the founder to build for real — it does not spin up a working system automatically. Conflating these would be a much larger, different project; keeping the boundary explicit is what keeps this spec buildable by one person.

## 2. Explicitly Out of Scope

- **Real payment gateway** (Stripe / Malaysian FPX). Payment confirmation is a manual admin action in this version — see §5.
- **Subsystem 3's real business logic.** The five page shells in §4 are empty containers a customer arranges components inside; there is no real customer/quotation/project/payment data or calculation behind them.
- **Additional style sets** beyond Ledger/Hearth/Blueprint. Raised during this session's discussion and explicitly deferred — per the design system's own established rule, a fourth style gets added only when a real client's industry doesn't fit the existing three, not speculatively for variety.
- **Card library expansion** (the previously-discussed "3-4 card types," of which only `hero-card.tsx` exists today). Separate follow-up.
- **Automated system generation from a saved layout.** See §6 — v1's "deploy" is a handoff to the founder, not a build pipeline.

## 3. Account System

**Sign-up:** Public self-registration (Supabase Auth, email + password — already in the stack, no new backend service). No invite gate; anyone can create a free account.

**Entry points:**
- **From the acquisition site:** after the AI-analysis reveal (Section 5 of the acquisition funnel), a new "注册账号继续" option appears alongside the existing WhatsApp CTA (both stay — this doesn't replace WhatsApp as a channel). Registering here passes the visitor's `lead_id` through the sign-up URL (`/signup?lead=<uuid>`), so the new account is linked back to their existing `leads` row (industry, AI analysis) — no re-entering information.
- **Direct:** a standalone login/register entry, independent of the funnel, for a customer who already has a relationship with Formae outside the acquisition site.

**Data model:**

```
accounts
  id            uuid, = auth.users.id
  email         text
  lead_id       uuid, nullable, FK -> leads.id
  created_at    timestamptz

projects
  id                uuid
  account_id        uuid, FK -> accounts.id
  style             text, enum('ledger','hearth','blueprint'), nullable until chosen
  paid              boolean, default false
  paid_marked_by    text, nullable   -- admin note, not a real user FK
  paid_marked_at    timestamptz, nullable
  created_at        timestamptz
  updated_at        timestamptz

project_pages
  id            uuid
  project_id    uuid, FK -> projects.id
  page_key      text, enum('dashboard','customers','quotations','projects','payments')
  layout_json   jsonb   -- Puck's serialized output
  updated_at    timestamptz
```

One `accounts` row and one `projects` row are created on first login (account creation is 1:1 with a project in this version — a customer designs one system). Five `project_pages` rows are created at the same time, one per `page_key`, with empty `layout_json`.

**RLS:** every table scoped so a user can only read/write rows where `account_id` (or the join through it) matches their own `auth.uid()`. This is the one piece of this spec that gets a real, non-negotiable test — see §7.

## 4. Style Selection (resolves a gap found during this session)

The existing public `/style-picker` page compares all three styles side by side for a *pre-account* visitor. This spec does not remove that page — it stays as a public preview/reference (linked from marketing, from CONTRACT.md's footer, etc.).

**Inside the account**, on first login (when `projects.style` is still null), the customer is shown the same three-way comparison as a required first step before the editor unlocks — reusing the existing `StyleColumn`/`sample-content` components rather than rebuilding the comparison UI. Picking a style sets `projects.style` once. It is not changeable afterward in this version (changing styles after a customer has arranged components in one token set is a real design problem — component spacing/sizing assumptions can differ across styles — and is explicitly deferred, not solved here).

**Two different things render in two different styles, and this distinction matters:**
- **The editor's own chrome** (toolbar, sidebar, drag handles, page navigation) is always **Ledger** — this is Formae's own tool interface, not something the customer is designing, and Ledger is the design system's own high-density/precision register, the right fit for an internal tool used by Formae and, derivatively, by customers operating it.
- **The canvas content** (the five page shells and whatever the customer drags into them) renders in **whichever style the customer picked** — because that canvas is a preview of what their own business system will actually look like.

## 5. The Editor

**Library:** [Puck](https://github.com/puckeditor/puck) (MIT, TypeScript, actively maintained, 13k+ stars as of this writing) — a React-native, embeddable visual editor supporting free placement within CSS grid/flexbox, not a rigid block picker. Chosen over building a custom drag-and-drop engine (out of reach for a solo founder on this timeline) and over GrapesJS (vanilla-JS-first, oriented toward marketing-page/email building via its plugin marketplace — a worse fit than a React-native tool for a React/Next.js app).

**Integration:** the 21 existing `design-system/components/*.tsx` files get wrapped as Puck's `config.components` block definitions — each becomes a draggable item in Puck's component picker. Puck's own UI (the picker sidebar, layer tree, property panel, canvas chrome) is re-skinned with Ledger's tokens rather than shipped with its default appearance — Puck explicitly supports fully replacing its UI, this isn't fighting the library. This directly serves the standing project requirement (carried from `CONTRACT.md`) that nothing in this design system reads as generic or AI-templated: a customer should not be able to tell this editor apart from a bespoke internal tool by its chrome alone.

**Route shape:** `/portal/[projectId]/[pageKey]`, one of the five `page_key` values, server-side auth-checked (must own the `project`). The canvas renders `project_pages.layout_json` for that page through Puck, scoped to `projects.style`'s token file (per §4).

**Free vs. paid:**
- **Free** (`projects.paid = false`): full editing — drag, arrange, resize, switch between the five pages. The Save button stays visible and clickable (not greyed out) — clicking it is what surfaces the paywall CTA below, rather than the button being disabled outright. There is no server-side persistence for free users by design (see §7 for the passive local-draft safety net, which is separate from this Save action).
- **Paid** (`projects.paid = true`, set by a human — see §6): the same editor gains a working **Save** (writes `layout_json` to `project_pages`) and **Deploy** (see §6) action.

A free user attempting to save sees a fixed, non-error paywall state: "你的设计已经准备好了 — 付款后即可保存" with a link into the existing WhatsApp contact pattern (reusing `WHATSAPP_NUMBER` from `lib/brand.ts`, same as `conversion-cta.tsx` and the style-picker). This is a CTA, not an error.

## 6. Payment and "Deploy"

**Payment confirmation (v1):** manual only. After a customer messages the founder (WhatsApp, matching every other conversion point in this product) and pays via bank transfer, the founder flips `projects.paid` to `true` through a lightweight internal admin action (a Supabase table edit is sufficient for v1 — a dedicated admin UI is not in scope here and would be its own small follow-up if the manual flip becomes a bottleneck).

**"Deploy" (v1 definition — deliberately narrow):** for a paid project, Deploy does not generate or launch a real running system. It **freezes the current `layout_json` as the customer's approved design** and sends the founder a notification (reusing the WhatsApp deep-link pattern once more, prefilled with the project/customer identity) that this customer's design is ready to build. The founder then builds the customer's real system by hand, using the frozen design as the reference — the same way every other client system in this project has been built so far (extracted from real work, not generated automatically). A true automated build pipeline from `layout_json` to a live system is subsystem 4 territory and explicitly not attempted here.

## 7. Error Handling and Data Protection

- **Auth errors** (bad credentials, duplicate email on sign-up): standard Supabase Auth error surfacing, localized through the existing next-intl zh/en setup — no new error-copy system.
- **Free-tier unsaved work:** since free accounts have no server-side save, the editor passively mirrors the in-progress layout to the browser (`localStorage`, keyed to `project_id`/`page_key`) on every change — independent of and not triggered by clicking Save — so a reload or crash during free-tier exploration doesn't erase what a visitor built while deciding whether to pay. This is a safety net, not a substitute for real persistence — it does not sync across devices, and it is separate from the explicit Save action described in §5, which remains gated on `paid`.
- **Paid-tier save failures** (network drop while writing `layout_json`): the save action retries with backoff and surfaces a clear failure state on exhaustion — a customer's in-progress edit must never silently vanish once they're a paying customer with real persistence available.

## 8. Testing

- **RLS isolation (the one non-negotiable test suite here):** integration tests against real Supabase RLS policies — not mocked — proving account A cannot read or write account B's `projects` or `project_pages` rows, in both directions.
- **Paid-gating logic:** an unpaid project's save endpoint rejects; a paid project's succeeds; flipping `paid` takes effect immediately without requiring re-login.
- **Lead-linking:** registering via a `lead`-tagged sign-up URL correctly sets `accounts.lead_id` and the resulting `projects.style`-selection step has the linked lead's industry available (for future use — this spec doesn't yet do anything industry-specific with it beyond storing the link).
- **Explicitly not tested here:** Puck's own drag-and-drop mechanics — that's the library's responsibility, not this integration's.

## 9. Open Questions Carried Forward (not blocking this spec, flagged for whoever picks them up)

- What happens if a customer wants to change their picked style after arranging content in the first one (§4 defers this).
- Whether the manual `paid` flip needs a lightweight admin UI once volume grows beyond "edit a Supabase row by hand."
- The real payment gateway integration, when volume or customer friction justifies the engineering cost.

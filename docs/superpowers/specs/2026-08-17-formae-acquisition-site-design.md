# Formae 获客网站 — Design Spec

**Status:** Approved for implementation (internal prototype phase)
**Source:** Derived from `AI Business System Generator V5.docx` (Proposal v7), refined through brainstorming session 2026-08-17.

## 1. Context

The parent product ("Formae" — brand name tentative, pending domain/trademark confirmation) is an AI-driven Business System Generator for Malaysian SMEs. The full proposal describes four largely-independent subsystems:

1. **Acquisition site** — progressive onboarding + AI business analysis + live prototype demo (this spec)
2. Client co-design tooling (style switching, workflow builder) — later
3. The actual per-client Business System (Customer/Quotation/Project/Payment modules) — later, this is what gets delivered after a client signs a Pilot
4. AI multi-agent backend — spans the above, complex enough to spec separately later

This spec covers **only subsystem 1**, matching the proposal's own MVP boundary (§25.1/25.2: MVP explicitly excludes the real Operations modules and the full AI Co-Designer).

## 2. Purpose & Success Criteria

This is an **internal prototype** to validate the concept, not a site being handed to real prospects yet. Priorities follow from that:

- Breadth over polish: cover as many industries as reasonably possible, not just the 5 with real Discovery data
- Real AI calls over mocked templates — cheaper to build correctly once than to fake it and redo later
- Real (if minimal) persistence — need to see actual drop-off/completion data, not just vibes
- Bilingual (Chinese + English) from the start; Malay deferred

## 3. Page Flow

Six sections, two different interaction models:

| Section | Content | Interaction model |
|---|---|---|
| 1. Hero | "你的生意，其实可以更简单" + CTA | Scroll-based landing page |
| 2. Industry select | Pill buttons, 8+ industries | Scroll-based landing page |
| 3. Peer case gallery | Dynamic, filtered by selected industry | Scroll-based landing page |
| 4. Progressive Q&A | 4-ish questions, mostly click-to-select, one free-text | **Full-screen, one-question-per-step (Typeform-style)** |
| 5. AI analysis reveal | Loading state → bottlenecks + before/after workflow | Reveal transition from last question |
| 6. Conversion CTA | "继续设计我的系统" (placeholder, out of scope) / "发送到 WhatsApp" | Scroll-based landing page |

**Why the split:** Sections 1–3 are a hook, not a task — scroll storytelling is fine there and helps first impression. Section 4 is where actual completion rate is won or lost, and that's specifically the problem Typeform-style one-question-per-screen is proven to solve: ~47% completion vs. ~21.5% industry-average for traditional forms, and 86% higher completion than single-step forms with many questions at once. A true scroll-jacking narrative has no such evidence behind it for task completion, and is fragile on mobile. Reference implementation: [imran-baitham/NextJs-Typeform-Clone](https://github.com/imran-baitham/NextJs-Typeform-Clone) (Next.js + Tailwind + shadcn, one-question flow + keyboard nav — matches our stack directly).

## 4. Industry & Reference Case Data

- Cover 8+ industries (not limited to the 5 with real Discovery data), driven by an `industries` config table rather than hardcoded pages — the LLM call handles the open-ended combinations, so more industries mainly means more data rows, not more code.
- Reference cases (§Section 3) are split by provenance:
  - **Verified** (装修/承包商, 零售/门店, 美容/沙龙, 批发/分销, 服务型公司): real Discovery data, can reference specific (anonymized) outcomes.
  - **Inferred** (all others): labeled explicitly as "行业典型场景" (industry-typical scenario), never presented as a real client story. This is a hard rule — no fabricated testimonials.

## 5. AI Analysis (Section 4→5)

This subsystem does **not** implement the full multi-agent architecture from Proposal §28 — that's explicitly Phase 3 per the proposal's own MVP scope. It's a single structured-output call:

- **Provider:** OpenAI API (chosen over Claude for this build; API-tier data isn't used for training by default, satisfying the proposal's §16/§23 privacy commitment either way)
- **Input:** selected industry's `IndustryConfig` (default workflow, suggested modules) + the visitor's Section 4 answers (selections + free-text description)
- **Output (structured JSON):** `{ bottlenecks: [{icon, title, description}], before_workflow: string[], after_workflow: string[], summary: string }`
- **Failure handling:** if the call fails, show a friendly retry — the visitor's answers are already persisted before the call fires, so nothing is lost on retry.

## 6. Data Model (Supabase)

```
industries
  id, name_zh, name_en, has_verified_discovery: bool,
  labels: jsonb {customer, order, staff},
  default_workflow: jsonb[], suggested_modules: jsonb[],
  style_recommendation

reference_cases
  id, industry_id (fk), is_verified: bool, anonymous_name,
  pain_points: jsonb[], modules: jsonb[], workflow: jsonb[],
  highlights: jsonb[], source: 'internal' | 'inferred'

leads
  id, created_at, industry_id (fk), language ('zh'|'en'),
  answers: jsonb, style_selected

analysis_results
  id, lead_id (fk), raw_llm_response: jsonb,
  bottlenecks: jsonb, before_workflow: jsonb, after_workflow: jsonb,
  generated_at
```

Rate limiting (abuse/cost protection on the public LLM-calling endpoint) is an implementation detail decided during planning — lightweight IP/session-based cap, no account system.

## 7. Visual System

Style Switching ships with **2–3 styles this round** (not the full 8 in Proposal §11.1) — CSS Variables + Tailwind tokens, following shadcn's theming approach (already current best practice, not something we need to invent).

Component sourcing follows the proposal's own §25.0 principle — open-source first:

| Source | Use for |
|---|---|
| [21st.dev](https://github.com/serafimcloud/21st) | Primary structural components (forms, cards, layout) — shadcn-native, MIT |
| [React Bits](https://github.com/DavidHDev/react-bits) | Animated flourishes (text/background effects) for the "wow" moments. MIT + Commons Clause — fine to use inside our product, not to resell the library itself |
| [ShaderGradient](https://github.com/ruucm/shadergradient) | Hero section animated background |
| Aceternity UI | Secondary source (Globe, glowing border, parallax) where the above two don't cover it; some components are Pro-licensed |

## 8. i18n

Chinese + English built into the routing/content architecture from the start (not bolted on later). Malay deferred to a future round.

## 9. Explicitly Out of Scope (this subsystem)

- Full multi-agent AI architecture (Proposal §28) — single LLM call only
- Actual Business System modules (Customer/Quotation/Project/Payment CRUD)
- Full 8-style switching (only 2–3 this round)
- WhatsApp Business API (a plain `wa.me` prefilled link covers §Section 6's CTA)
- Workflow Builder, AI Co-Designer, Business Memory
- Malay language
- Login/auth — the flow is fully anonymous; "继续设计我的系统" CTA is a placeholder, not a working account/dashboard system
- Automated test suite — manual testing only, appropriate for a self-validation internal prototype

## 10. Tech Stack

Next.js (App Router) + Tailwind CSS + shadcn/ui + Framer Motion + Supabase/Postgres + OpenAI API + Vercel hosting — as specified in Proposal §22.1, confirmed unchanged.

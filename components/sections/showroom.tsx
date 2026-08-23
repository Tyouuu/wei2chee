"use client";

import { Render } from "@puckeditor/core";
// Renders through the register-aware config, so a block nobody has
// touched takes the shape THIS register prefers. See
// design-system/editor/puck-config-client.tsx.
import { registerAwarePuckConfig as puckConfig } from "@/design-system/editor/puck-config-client";

import { StyleScope } from "@/design-system/editor/style-scope";
import chrome from "@/app/[locale]/portal/chrome.module.css";
import { useLocale, useTranslations } from "next-intl";
import { sampleSystem } from "@/lib/portal/sample-system";

/**
 * THE SHOWROOM, and the point where the page hands over.
 *
 * WHY IT EXISTS: measured on 2026-08-21, this landing page had 249 elements and
 * not one of them was a rendered system. A product whose entire pitch is "see
 * your system before you pay for it" was describing that system in prose. Every
 * comparable — Durable, Framer, Lovable — puts the artefact on the fold; this
 * one put an argument there.
 *
 * So a real one is rendered here, through the same `Render` + `puckConfig` path
 * the editor and the sign-in page use. Not a screenshot, not a diagram: the
 * actual components, in an actual register, with a contractor's actual words.
 * The same sample the sign-in page shows, deliberately — a visitor who signs up
 * and goes looking for it finds the same thing rather than a bait.
 *
 * WHY THE HANDOVER RULE IS HERE. This section is where the page stops being
 * about Formae and starts being about the visitor's own business, so it carries
 * `id="handover"` and the ground turns white across it. See components/
 * handover.tsx for the mechanism and for why the system panel itself is pinned.
 */

// A client component because the landing page itself is one — `app/[locale]/
// page.tsx` holds the questionnaire's state, so everything it renders is on
// the client and `getTranslations` (server-only) throws there.
export function Showroom() {
  const t = useTranslations("showroom");
  // The sample follows the visitor's language. It used to be hardcoded
  // Chinese, so /en showed the product's central demonstration in a language
  // the visitor had explicitly declined. See lib/portal/sample-system.ts.
  const locale = useLocale();
  const sample = sampleSystem(locale, "show", true);

  return (
    <section
      id="handover"
      className="relative mx-auto max-w-5xl px-6 pt-24 pb-28 sm:px-10"
      aria-labelledby="showroom-heading"
    >
      <p className="annotation">{t("eyebrow")}</p>
      <h2
        id="showroom-heading"
        className="mt-4 max-w-[18ch] font-serif text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.04] tracking-[-0.025em] text-foreground"
      >
        {t("heading")}
      </h2>
      <p className="mt-5 max-w-[46ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
        {t("body")}
      </p>

      {/*
        THE MOUNT, and the one element on this page that does not change colour.

        `handover-fixed` pins every token the scroll is interpolating back to
        the values the customer's own register defines, so this panel is light
        on the dark half of the page and identically light on the white half.
        That is the whole argument: the room changes, the exhibit does not.

        `chrome.mount` is the same white plinth the portal, the editor and the
        sign-in page use — so a visitor meets the object here in exactly the
        frame they will meet it in for the rest of the product.
      */}
      <div className={`handover-fixed ${chrome.mount} mt-12`}>
        <StyleScope register="ledger" className="[background-color:var(--color-canvas)]">
          <div className="pointer-events-none [padding:var(--pad-card-lg)]">
            <Render config={puckConfig} data={sample as never} />
          </div>
        </StyleScope>
      </div>

      {/* The rule that names what just happened. Without it the colour change
          is a nice transition; with it, it is a sentence. */}
      <div className="mt-14 flex items-center gap-5">
        <span className="h-px flex-1 bg-border" />
        <span className="annotation shrink-0">{t("rule")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </section>
  );
}

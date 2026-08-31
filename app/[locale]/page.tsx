"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { HeroSection } from "@/components/sections/hero-section";
import { IndustrySelect } from "@/components/sections/industry-select";
import { PeerCaseGallery } from "@/components/sections/peer-case-gallery";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { AnalysisReveal } from "@/components/sections/analysis-reveal";
import { ConversionCta } from "@/components/sections/conversion-cta";
import { AmbientBackdrop } from "@/components/ambient-backdrop";
import { WhatYouGet, Pricing, Faq } from "@/components/sections/landing-explainer";
import { ProcessShowcase } from "@/components/sections/process-showcase";
import { SpecReceipt } from "@/components/sections/spec-receipt";
import { SystemDrawing } from "@/components/sections/system-drawing";
import { SiteFooter } from "@/components/site-footer";
import { CookieNotice } from "@/components/cookie-notice";
import { SiteHeader } from "@/components/site-header";
import { Handover } from "@/components/handover";
import { Showroom } from "@/components/sections/showroom";
import type { Industry, AnalysisResult } from "@/types/database";

export default function HomePage() {
  const locale = useLocale() as "zh" | "en";
  const t = useTranslations("peerCases");
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);
  const [showStepper, setShowStepper] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [heroBrief, setHeroBrief] = useState("");

  return (
    <main>
      {/* One lit surface behind the whole page, so scrolling past the Hero
          recedes the atmosphere instead of cutting to flat dark. */}
      <AmbientBackdrop />
      {/* Drives the page's tokens from Formae's dark ground to white paper
          across <Showroom>. Renders nothing; see components/handover.tsx. */}
      <Handover />
      <SiteHeader />
      <HeroSection
        onStart={(brief) => {
          // Kept rather than consumed. The Hero asks the same thing the
          // questionnaire's one free-text question asks, so a visitor who has
          // already described their business must not be asked to describe it
          // again two screens later — that reads as the site not having
          // listened, on the exact surface whose promise is that it did.
          setHeroBrief(brief);
          document.getElementById("industry-select")?.scrollIntoView({ behavior: "smooth" });
        }}
      />
      {/* Before the trade picker, not after: a visitor has to know what they
          are being asked to pick a trade FOR. Everything below the picker is
          conditional on having picked one, so this is the last thing an
          undecided visitor reads if it sits underneath. */}
      <SystemDrawing />
      <ProcessShowcase />

      {/* THE FOLD THIS PAGE DID NOT HAVE. Measured: 249 elements and not one
          rendered system, on a site whose promise is that you see your system
          before you pay. It also carries `id="handover"` — the ground turns
          white across it, because from here down the page is about the
          visitor's business rather than about us. */}
      <Showroom />
      <IndustrySelect onSelect={setSelectedIndustry} />
      {selectedIndustry && !answers && (
        <>
          <PeerCaseGallery industryId={selectedIndustry.id} />
          <div className="mx-auto max-w-5xl px-6 pb-32 sm:px-10">
            {/* Aligns to SectionShell's content column (8rem margin + 3.5rem gap). */}
            <div className="md:pl-[11.5rem]">
              <button
                onClick={() => setShowStepper(true)}
                className="group relative border border-blueprint/50 px-8 py-4 font-mono text-[0.75rem] tracking-[0.14em] text-blueprint uppercase transition-colors duration-300 hover:border-blueprint focus-visible:ring-1 focus-visible:ring-blueprint focus-visible:outline-none"
              >
                <span className="absolute inset-0 origin-left scale-x-0 bg-blueprint transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
                <span className="relative transition-colors duration-300 group-hover:text-[var(--ink)]">
                  {t("start")} →
                </span>
              </button>
            </div>
          </div>
        </>
      )}
      {showStepper && selectedIndustry && (
        <OnboardingStepper
          initialAnswers={heroBrief ? { new_customer_flow: heroBrief } : undefined}
          industry={selectedIndustry}
          onComplete={(a) => {
            setAnswers(a);
            setShowStepper(false);
          }}
        />
      )}
      {answers && selectedIndustry && (
        <AnalysisReveal
          industryId={selectedIndustry.id}
          language={locale}
          answers={answers}
          // Kept mounted permanently once shown (no `!analysis` guard):
          // unmounting on analysis completion would remove AnalysisReveal at
          // the exact moment its staged reveal finishes, before the visitor
          // ever sees the bottleneck cards / before-after workflow it just
          // animated in.
          onDone={(id, result) => {
            setLeadId(id);
            setAnalysis(result);
          }}
        />
      )}
      {analysis && leadId && <ConversionCta summary={analysis.summary} leadId={leadId} />}

      {/* Unconditional, unlike everything between the picker and here. A
          visitor who scrolled past the trade list without clicking used to
          reach the end of the document at this point -- no deliverable, no
          price, no answer to "how is this different from a web shop", no way
          to contact anyone. */}
      <WhatYouGet />
      <Pricing />
      <SpecReceipt />
      <Faq />
      <SiteFooter />
      <CookieNotice locale={locale} />
    </main>
  );
}

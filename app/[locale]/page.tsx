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
import type { Industry, AnalysisResult } from "@/types/database";

export default function HomePage() {
  const locale = useLocale() as "zh" | "en";
  const t = useTranslations("peerCases");
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);
  const [showStepper, setShowStepper] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  return (
    <main>
      {/* One lit surface behind the whole page, so scrolling past the Hero
          recedes the atmosphere instead of cutting to flat dark. */}
      <AmbientBackdrop />
      <HeroSection
        onCtaClick={() => {
          document.getElementById("industry-select")?.scrollIntoView({ behavior: "smooth" });
        }}
      />
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
                <span className="relative transition-colors duration-300 group-hover:text-[oklch(0.16_0.012_265)]">
                  {t("start")} →
                </span>
              </button>
            </div>
          </div>
        </>
      )}
      {showStepper && selectedIndustry && (
        <OnboardingStepper
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
          // leadId is intentionally ignored here — nothing downstream in this
          // page reads it, ConversionCta only needs the summary. Kept mounted
          // permanently once shown (no `!analysis` guard): unmounting on
          // analysis completion would remove AnalysisReveal at the exact
          // moment its staged reveal finishes, before the visitor ever sees
          // the bottleneck cards / before-after workflow it just animated in.
          onDone={(_leadId, result) => setAnalysis(result)}
        />
      )}
      {analysis && <ConversionCta summary={analysis.summary} />}
    </main>
  );
}

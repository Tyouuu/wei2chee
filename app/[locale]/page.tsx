"use client";

import { useState } from "react";
import { HeroSection } from "@/components/sections/hero-section";
import { IndustrySelect } from "@/components/sections/industry-select";
import { PeerCaseGallery } from "@/components/sections/peer-case-gallery";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import type { Industry } from "@/types/database";

export default function HomePage() {
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);
  const [showStepper, setShowStepper] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);

  return (
    <main>
      <HeroSection
        onCtaClick={() => {
          document.getElementById("industry-select")?.scrollIntoView({ behavior: "smooth" });
        }}
      />
      <IndustrySelect onSelect={setSelectedIndustry} />
      {selectedIndustry && (
        <>
          <PeerCaseGallery industryId={selectedIndustry.id} />
          <div className="pb-24 text-center">
            <button className="underline" onClick={() => setShowStepper(true)}>
              Start →
            </button>
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
      {answers && <pre>{JSON.stringify(answers, null, 2)}</pre>}
    </main>
  );
}

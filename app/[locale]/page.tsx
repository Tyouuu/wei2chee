"use client";

import { useState } from "react";
import { HeroSection } from "@/components/sections/hero-section";
import { IndustrySelect } from "@/components/sections/industry-select";
import type { Industry } from "@/types/database";

export default function HomePage() {
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);

  return (
    <main>
      <HeroSection
        onCtaClick={() => {
          document.getElementById("industry-select")?.scrollIntoView({ behavior: "smooth" });
        }}
      />
      <IndustrySelect onSelect={setSelectedIndustry} />
      {selectedIndustry && <p className="text-center">{selectedIndustry.name_zh} selected</p>}
    </main>
  );
}

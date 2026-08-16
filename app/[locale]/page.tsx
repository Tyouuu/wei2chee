"use client";

import { HeroSection } from "@/components/sections/hero-section";

export default function HomePage() {
  return (
    <main>
      <HeroSection
        onCtaClick={() => {
          document.getElementById("industry-select")?.scrollIntoView({ behavior: "smooth" });
        }}
      />
    </main>
  );
}

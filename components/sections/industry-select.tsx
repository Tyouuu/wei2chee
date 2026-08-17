"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { getIndustries } from "@/lib/industries";
import type { Industry } from "@/types/database";
import { SectionShell } from "@/components/section-shell";

export function IndustrySelect({ onSelect }: { onSelect: (industry: Industry) => void }) {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const locale = useLocale();
  const t = useTranslations("industrySelect");

  useEffect(() => {
    getIndustries().then(setIndustries).catch(console.error);
  }, []);

  function handleSelect(industry: Industry) {
    setSelectedId(industry.id);
    onSelect(industry);
  }

  return (
    <SectionShell id="industry-select" index="01" label="SECTOR" heading={t("title")}>
      <div className="border-t border-border">
        {industries.map((industry, i) => {
          const isSelected = selectedId === industry.id;
          const label = locale === "zh" ? industry.name_zh : industry.name_en;
          return (
            <motion.button
              key={industry.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.045, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => handleSelect(industry)}
              aria-pressed={isSelected}
              /* A drawing schedule, not a pill cloud: full-width rows that
                 respond like a hovered row in a spec table. */
              className="group relative flex w-full items-center gap-5 overflow-hidden border-b border-border py-5 text-left focus-visible:ring-1 focus-visible:ring-blueprint focus-visible:outline-none"
            >
              {/* Hover flood, sweeping in from the left edge. A bigger gesture
                  than a background tint — the row reads as being selected by an
                  instrument passing over it. */}
              <span
                aria-hidden="true"
                className={`absolute inset-0 origin-left bg-blueprint/[0.07] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isSelected ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                }`}
              />
              <span
                className={`relative font-mono text-[0.6875rem] tabular-nums transition-colors duration-300 ${
                  isSelected ? "text-blueprint" : "text-muted-foreground group-hover:text-blueprint"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              {/* The label shifts right as the flood passes under it. */}
              <span
                className={`relative flex-1 text-lg transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isSelected
                    ? "translate-x-1 text-blueprint"
                    : "text-foreground/85 group-hover:translate-x-1 group-hover:text-foreground"
                }`}
              >
                {label}
              </span>
              <span
                aria-hidden="true"
                className={`relative font-mono text-sm text-blueprint transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isSelected
                    ? "translate-x-0 opacity-100"
                    : "-translate-x-3 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                }`}
              >
                →
              </span>
            </motion.button>
          );
        })}
      </div>
    </SectionShell>
  );
}

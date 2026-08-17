"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { getIndustries } from "@/lib/industries";
import type { Industry } from "@/types/database";

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
    <section id="industry-select" className="mx-auto max-w-5xl px-6 py-32 sm:px-10">
      {/* Asymmetric: annotation column on the left, content on the right. This
          is the drawing-sheet layout, not a centered marketing block. */}
      <div className="grid gap-10 md:grid-cols-[7rem_1fr] md:gap-14">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="md:pt-3"
        >
          <span className="annotation">01 / SECTOR</span>
        </motion.div>

        <div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-xl font-serif text-[clamp(1.875rem,4vw,3rem)] leading-[1.05] tracking-[-0.02em] text-balance"
          >
            {t("title")}
          </motion.h2>

          <div className="mt-12 border-t border-border">
            {industries.map((industry, i) => {
              const isSelected = selectedId === industry.id;
              const label = locale === "zh" ? industry.name_zh : industry.name_en;
              return (
                <motion.button
                  key={industry.id}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.4, delay: i * 0.045 }}
                  onClick={() => handleSelect(industry)}
                  aria-pressed={isSelected}
                  /* A drawing schedule, not a pill cloud: full-width rows that
                     highlight on hover the way a hovered row in a spec table
                     does. Rows read as a considered list; pills read as tags. */
                  className="group relative flex w-full items-center gap-5 border-b border-border py-5 text-left transition-colors duration-300 hover:bg-white/[0.025] focus-visible:ring-1 focus-visible:ring-blueprint focus-visible:outline-none"
                >
                  <span
                    className={`font-mono text-[0.6875rem] tabular-nums transition-colors duration-300 ${
                      isSelected ? "text-blueprint" : "text-muted-foreground group-hover:text-blueprint"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`flex-1 text-lg transition-colors duration-300 ${
                      isSelected ? "text-blueprint" : "text-foreground/85 group-hover:text-foreground"
                    }`}
                  >
                    {label}
                  </span>
                  {/* Arrow slides in on hover — the only motion on the row, so
                      the affordance is unambiguous without a button chrome. */}
                  <span
                    aria-hidden="true"
                    className={`font-mono text-sm transition-all duration-300 ${
                      isSelected
                        ? "translate-x-0 text-blueprint opacity-100"
                        : "-translate-x-2 text-blueprint opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                    }`}
                  >
                    →
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

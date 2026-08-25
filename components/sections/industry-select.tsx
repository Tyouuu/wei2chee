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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {industries.map((industry, i) => {
          const isSelected = selectedId === industry.id;
          const label = locale === "zh" ? industry.name_zh : industry.name_en;
          return (
            <motion.button
              key={industry.id}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.045, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => handleSelect(industry)}
              aria-pressed={isSelected}
              /*
                A CARD, NOT A ROW.

                It was a drawing schedule: eight full-width rows separated by
                hairlines, which is a good object and was the page's FOURTH one
                -- 流程, 交付, 行业 and 问答 all drew the same numbered line with
                a rule under it, and 835 vertical pixels of this section were
                eight rows and a great deal of margin. The founder's word for
                the whole page was 「整体还是不够好看」, and repetition of one
                object is most of what that means.

                A grid is also the truer control. This is the one moment on the
                page where the visitor CHOOSES, and eight things to choose
                between want to be seen at once and compared -- which a column
                818px long cannot do, because the eighth is off the screen when
                you are looking at the first.
              */
              className={`group relative flex min-h-[104px] flex-col justify-between overflow-hidden rounded-xl border p-5 text-left transition-colors duration-300 focus-visible:ring-1 focus-visible:ring-blueprint focus-visible:outline-none ${
                isSelected
                  ? "border-blueprint bg-blueprint/[0.06]"
                  : "border-border hover:border-blueprint/60 hover:bg-blueprint/[0.04]"
              }`}
            >
              <span
                className={`font-mono text-[0.6875rem] tabular-nums transition-colors duration-300 ${
                  isSelected ? "text-blueprint" : "text-muted-foreground group-hover:text-blueprint"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>

              <span className="flex items-end justify-between gap-3">
                <span
                  className={`text-[1.0625rem] leading-snug transition-colors duration-300 ${
                    isSelected ? "text-blueprint" : "text-foreground/90 group-hover:text-foreground"
                  }`}
                >
                  {label}
                </span>
                {/* The arrow was always there and always invisible until hover,
                    which on a touch screen means always invisible. On a card it
                    can simply sit in the corner, dimmed. */}
                <span
                  aria-hidden="true"
                  className={`shrink-0 font-mono text-sm transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isSelected
                      ? "translate-x-0 text-blueprint opacity-100"
                      : "text-blueprint/45 opacity-70 group-hover:translate-x-0.5 group-hover:text-blueprint group-hover:opacity-100"
                  }`}
                >
                  &rarr;
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </SectionShell>
  );
}

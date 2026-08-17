"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { getReferenceCases } from "@/lib/reference-cases";
import type { ReferenceCase } from "@/types/database";
import { SectionShell } from "@/components/section-shell";

export function PeerCaseGallery({ industryId }: { industryId: string }) {
  const [cases, setCases] = useState<ReferenceCase[]>([]);
  const locale = useLocale();
  const t = useTranslations("peerCases");

  useEffect(() => {
    getReferenceCases(industryId).then(setCases).catch(console.error);
  }, [industryId]);

  if (cases.length === 0) return null;

  return (
    <SectionShell
      index="02"
      label="PRECEDENT"
      heading={t("title")}
      headingClassName="text-[clamp(1.5rem,3vw,2.25rem)]"
    >
      <div className="grid gap-5">
        {cases.map((c, i) => (
          <motion.article
            key={c.id}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            /* sheet-marks puts registration ticks on opposing corners, so each
               case reads as its own small drawing rather than a generic card. */
            className="sheet-marks group relative border border-border bg-white/[0.02] p-7 transition-colors duration-500 hover:border-blueprint/40"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="font-serif text-xl tracking-[-0.01em]">
                {locale === "zh" ? c.anonymous_name_zh : c.anonymous_name_en}
              </h3>
              {c.source === "inferred" && (
                /* Honesty marker, held to the same annotation voice as the rest
                   of the sheet — never dressed up as a verified testimonial. */
                <span className="annotation border border-blueprint/30 px-2 py-1 !text-[0.625rem] !text-blueprint/80">
                  {t("inferredLabel")}
                </span>
              )}
            </div>
            <ul className="mt-5 grid gap-3">
              {(locale === "zh" ? c.highlights_zh : c.highlights_en).map((h, idx) => (
                <li key={idx} className="flex gap-3.5 text-sm leading-relaxed text-muted-foreground">
                  {/* Leader rule extends on hover — the card responds as a unit. */}
                  <span
                    aria-hidden="true"
                    className="mt-2 h-px w-4 shrink-0 bg-blueprint/50 transition-all duration-500 group-hover:w-7 group-hover:bg-blueprint"
                  />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </motion.article>
        ))}
      </div>
    </SectionShell>
  );
}

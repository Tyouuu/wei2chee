"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { getIndustries } from "@/lib/industries";
import type { Industry } from "@/types/database";
import { Button } from "@/components/ui/button";

export function IndustrySelect({ onSelect }: { onSelect: (industry: Industry) => void }) {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const locale = useLocale();
  const t = useTranslations("industrySelect");

  useEffect(() => {
    getIndustries().then(setIndustries).catch(console.error);
  }, []);

  return (
    <section id="industry-select" className="px-6 py-32">
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="text-center font-serif text-3xl font-semibold"
      >
        {t("title")}
      </motion.h2>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
        className="mx-auto mt-10 flex max-w-2xl flex-wrap justify-center gap-3"
      >
        {industries.map((industry) => (
          <Button
            key={industry.id}
            variant="outline"
            className="rounded-full"
            onClick={() => onSelect(industry)}
          >
            {locale === "zh" ? industry.name_zh : industry.name_en}
          </Button>
        ))}
      </motion.div>
    </section>
  );
}

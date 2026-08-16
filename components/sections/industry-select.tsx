"use client";

import { useEffect, useState } from "react";
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
    <section id="industry-select" className="min-h-screen px-6 py-24">
      <h2 className="text-center text-2xl font-semibold">{t("title")}</h2>
      <div className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-3">
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
      </div>
    </section>
  );
}

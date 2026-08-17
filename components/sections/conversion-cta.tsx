"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const WHATSAPP_NUMBER = "60123456789"; // TODO before real launch: replace with the real business WhatsApp number

export function ConversionCta({ summary }: { summary: string }) {
  const t = useTranslations("cta");
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `${t("whatsappPrefill")} ${summary}`,
  )}`;

  return (
    <section className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-2xl font-semibold">{t("title")}</h2>
      <div className="flex gap-4">
        <Button asChild>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
            {t("whatsapp")}
          </a>
        </Button>
        <Button variant="outline" onClick={() => alert(t("placeholderNotice"))}>
          {t("continue")}
        </Button>
      </div>
    </section>
  );
}

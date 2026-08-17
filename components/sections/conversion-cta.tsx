"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { MessageCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const WHATSAPP_NUMBER = "60123456789"; // TODO before real launch: replace with the real business WhatsApp number

// Same staged-reveal language as the Hero and AnalysisReveal — this is the
// last beat of the flow, so it gets the same care as the first one.
const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export function ConversionCta({ summary }: { summary: string }) {
  const t = useTranslations("cta");
  const [continueClicked, setContinueClicked] = useState(false);
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `${t("whatsappPrefill")} ${summary}`,
  )}`;

  return (
    <motion.section
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-6 text-center"
    >
      <motion.h2 variants={item} className="max-w-lg font-serif text-3xl font-semibold">
        {t("title")}
      </motion.h2>
      <motion.div variants={item} className="flex flex-col items-center gap-3">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg" className="bg-indigo-600 text-white hover:bg-indigo-700">
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle />
              {t("whatsapp")}
            </a>
          </Button>
          <Button size="lg" variant="outline" disabled={continueClicked} onClick={() => setContinueClicked(true)}>
            {continueClicked && <Check className="text-indigo-600" />}
            {t("continue")}
          </Button>
        </div>
        {/* An inline caption reads calmer here than a native alert(), which
            would break the motion-driven feel of everything leading up to it. */}
        <AnimatePresence>
          {continueClicked && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-sm text-muted-foreground"
            >
              {t("placeholderNotice")}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.section>
  );
}

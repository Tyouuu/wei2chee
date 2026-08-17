"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { BRAND_NAME } from "@/lib/brand";
import { SectionShell } from "@/components/section-shell";

const WHATSAPP_NUMBER = "60123456789"; // TODO before real launch: replace with the real business WhatsApp number

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export function ConversionCta({ summary }: { summary: string }) {
  const t = useTranslations("cta");
  const [continueClicked, setContinueClicked] = useState(false);
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `${t("whatsappPrefill")} ${summary}`,
  )}`;

  return (
    <div className="border-t border-border">
      {/* headingClassName keeps a wide measure: Chinese has no inter-word
          spaces, and a narrow one forces breaks mid-word (设/计). */}
      <SectionShell
        index="04"
        label="BUILD"
        heading={t("title")}
        headingClassName="text-[clamp(2rem,5vw,3.5rem)] leading-[1.15] !max-w-3xl"
      >
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div>
            <motion.div variants={item} className="flex flex-wrap items-center gap-4">
              {/* Primary: filled in signal cyan — the same colour used for the
                  proposed system in the diagram above, so the button reads as
                  "go there", continuing that thread rather than introducing a
                  new accent at the last step. */}
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative overflow-hidden border border-signal bg-signal px-8 py-4 font-mono text-[0.75rem] tracking-[0.14em] text-[oklch(0.16_0.012_265)] uppercase transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:outline-none"
              >
                <span className="relative">{t("whatsapp")} →</span>
              </a>

              <button
                onClick={() => setContinueClicked(true)}
                disabled={continueClicked}
                className="group relative border border-border px-8 py-4 font-mono text-[0.75rem] tracking-[0.14em] text-foreground/80 uppercase transition-colors duration-300 hover:border-foreground/50 hover:text-foreground disabled:pointer-events-none disabled:text-muted-foreground focus-visible:ring-1 focus-visible:ring-blueprint focus-visible:outline-none"
              >
                {continueClicked ? `✓ ${t("continue")}` : t("continue")}
              </button>
            </motion.div>

            {/* Inline confirmation instead of a native alert() — a browser dialog
                would break the drawn-surface feel of everything preceding it. */}
            <AnimatePresence>
              {continueClicked && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="mt-5 text-sm text-muted-foreground"
                >
                  {t("placeholderNotice")}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </SectionShell>

      {/* Sheet footer — the title block that closes a drawing. */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 sm:px-10">
          <span className="annotation !text-muted-foreground">{BRAND_NAME} / SYS.DESIGN</span>
          <span className="annotation !text-muted-foreground/60">MALAYSIA</span>
        </div>
      </div>
    </div>
  );
}

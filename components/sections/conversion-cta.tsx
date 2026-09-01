"use client";

import { useTranslations } from "next-intl";
import { motion, type Variants } from "framer-motion";
import { BRAND_NAME, WHATSAPP_NUMBER, WHATSAPP_IS_PLACEHOLDER } from "@/lib/brand";
import { SectionShell } from "@/components/section-shell";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export function ConversionCta({ summary, leadId }: { summary: string; leadId: string }) {
  const t = useTranslations("cta");
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
          <motion.div variants={item} className="flex flex-wrap items-center gap-4">
            {/* 🔴 号码还是占位符的时候，**这颗按钮不出现**。
                `WHATSAPP_IS_PLACEHOLDER` 从写出来那天就在 lib/brand.ts 里，
                注解写着「lets a surface choose to say nothing rather than offer
                a link that cannot work」——**而没有任何一个 surface 用过它**。
                这个仓库第十六次「能力有、线没接」，而这一次接在
                **广告进来之后最后一颗按钮**上：按下去开的是那个占位号码 ——
                一个不存在的号码。[任务 11](../../docs/founder-tasks.md)。
                ⚠️ 不是把它变灰，是**换成真的走得通的那一条**：注册，
                而那本来就是我们要广告流量做的动作。
                号码填进环境变数的那一天，这颗自己回来，不用改代码。 */}
            {!WHATSAPP_IS_PLACEHOLDER && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative overflow-hidden border border-signal bg-signal px-8 py-4 font-mono text-[0.75rem] tracking-[0.14em] text-[var(--ink)] uppercase transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:outline-none"
              >
                <span className="relative">{t("whatsapp")} →</span>
              </a>
            )}

            <a
              href={`/signup?lead=${leadId}`}
              /* 没有 WhatsApp 的时候它就是主按钮 —— 一排全是次要按钮，
                 等於没有人知道该按哪一颗。 */
              className={
                WHATSAPP_IS_PLACEHOLDER
                  ? "group relative overflow-hidden border border-signal bg-signal px-8 py-4 font-mono text-[0.75rem] tracking-[0.14em] text-[var(--ink)] uppercase transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:outline-none"
                  : "group relative border border-border px-8 py-4 font-mono text-[0.75rem] tracking-[0.14em] text-foreground/80 uppercase transition-colors duration-300 hover:border-foreground/50 hover:text-foreground focus-visible:ring-1 focus-visible:ring-blueprint focus-visible:outline-none"
              }
            >
              {t("continue")}
            </a>
          </motion.div>
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

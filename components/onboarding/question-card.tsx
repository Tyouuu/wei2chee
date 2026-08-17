"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import type { Question } from "./questions";

export function QuestionCard({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("onboarding");

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-2xl"
    >
      <h3 className="font-serif text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.1] tracking-[-0.02em] text-balance">
        {t(question.titleKey)}
      </h3>

      {question.type === "single" && question.optionsKey && (
        <div className="mt-11 grid gap-0 border-t border-border">
          {question.optionsKey.map((key, i) => {
            const label = t(key);
            const selected = value === label;
            return (
              <button
                key={key}
                onClick={() => onChange(label)}
                aria-pressed={selected}
                /* Same schedule-row pattern as the industry list, so the whole
                   flow feels like filling in one continuous drawing sheet
                   rather than moving between differently-styled widgets. */
                className="group flex items-center gap-5 border-b border-border py-5 text-left transition-colors duration-300 hover:bg-white/[0.025] focus-visible:ring-1 focus-visible:ring-blueprint focus-visible:outline-none"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-4 w-4 shrink-0 items-center justify-center border transition-colors duration-300 ${
                    selected
                      ? "border-blueprint bg-blueprint"
                      : "border-border group-hover:border-blueprint/60"
                  }`}
                >
                  {selected && <span className="h-1.5 w-1.5 bg-[oklch(0.16_0.012_265)]" />}
                </span>
                <span className="font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`text-lg transition-colors duration-300 ${
                    selected ? "text-blueprint" : "text-foreground/85 group-hover:text-foreground"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {question.type === "text" && (
        <div className="mt-11">
          <Textarea
            className="min-h-32 resize-none rounded-none border-0 border-b border-border bg-transparent px-0 py-4 text-lg leading-relaxed shadow-none focus-visible:border-blueprint focus-visible:ring-0"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t("q3.placeholder")}
          />
        </div>
      )}
    </motion.div>
  );
}

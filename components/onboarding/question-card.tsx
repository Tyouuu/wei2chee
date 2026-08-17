"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
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
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.25 }}
      className="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center"
    >
      <h3 className="max-w-lg text-2xl font-semibold">{t(question.titleKey)}</h3>
      {question.type === "single" && question.optionsKey && (
        <div className="flex flex-wrap justify-center gap-3">
          {question.optionsKey.map((key) => (
            <Button
              key={key}
              variant={value === t(key) ? "default" : "outline"}
              onClick={() => onChange(t(key))}
            >
              {t(key)}
            </Button>
          ))}
        </div>
      )}
      {question.type === "text" && (
        <Textarea
          className="max-w-md"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("q3.placeholder")}
        />
      )}
    </motion.div>
  );
}

"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { QUESTIONS } from "./questions";
import { QuestionCard } from "./question-card";
import type { Industry } from "@/types/database";

export function OnboardingStepper({
  industry,
  onComplete,
}: {
  industry: Industry;
  onComplete: (answers: Record<string, string>) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const t = useTranslations("onboarding");

  const currentQuestion = QUESTIONS[stepIndex];
  const currentValue = answers[currentQuestion.id] ?? "";
  const isLast = stepIndex === QUESTIONS.length - 1;

  function handleNext() {
    if (isLast) {
      onComplete(answers);
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  return (
    <section className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Sheet header: step counter as a drawing revision marker. Replaces the
          generic progress bar — a discrete "02 / 03" is more legible than a
          filled track, and matches the annotation voice used site-wide. */}
      <header className="flex items-center justify-between border-b border-border px-6 py-5 sm:px-10">
        <span className="annotation">
          {String(stepIndex + 1).padStart(2, "0")} / {String(QUESTIONS.length).padStart(2, "0")}
        </span>
        <div className="flex gap-1.5">
          {QUESTIONS.map((q, i) => (
            <span
              key={q.id}
              className={`h-px w-8 transition-colors duration-500 ${
                i <= stepIndex ? "bg-blueprint" : "bg-border"
              }`}
            />
          ))}
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-6">
        <AnimatePresence mode="wait">
          <QuestionCard
            key={currentQuestion.id}
            question={currentQuestion}
            value={currentValue}
            onChange={(value) => setAnswers((a) => ({ ...a, [currentQuestion.id]: value }))}
          />
        </AnimatePresence>
      </div>

      <footer className="flex items-center justify-between border-t border-border px-6 py-5 sm:px-10">
        <button
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((i) => i - 1)}
          className="font-mono text-[0.75rem] tracking-[0.14em] text-muted-foreground uppercase transition-colors duration-300 hover:text-foreground disabled:pointer-events-none disabled:opacity-25 focus-visible:ring-1 focus-visible:ring-blueprint focus-visible:outline-none"
        >
          ← {t("back")}
        </button>
        <button
          onClick={handleNext}
          disabled={!currentValue}
          className="group relative border border-blueprint/50 px-7 py-3.5 font-mono text-[0.75rem] tracking-[0.14em] text-blueprint uppercase transition-colors duration-300 hover:border-blueprint disabled:pointer-events-none disabled:border-border disabled:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-blueprint focus-visible:outline-none"
        >
          <span className="absolute inset-0 origin-left scale-x-0 bg-blueprint transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
          <span className="relative transition-colors duration-300 group-hover:text-[oklch(0.16_0.012_265)]">
            {isLast ? t("submit") : t("next")} →
          </span>
        </button>
      </footer>
    </section>
  );
}

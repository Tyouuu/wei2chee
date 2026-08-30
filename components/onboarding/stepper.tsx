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
  /** Answers the visitor already gave before reaching this form. The Hero asks
   *  the same question `new_customer_flow` does, so anything typed there
   *  arrives here already filled in — asking again would read as the site not
   *  having listened. They can still edit it. */
  initialAnswers,
}: {
  industry: Industry;
  onComplete: (answers: Record<string, string>) => void;
  initialAnswers?: Record<string, string>;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers ?? {});
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
    /*
      z-60, ABOVE THE COOKIE NOTICE, AND THAT IS A BUG FIX NOT A PREFERENCE.

      Measured at 390x844 on 2026-08-31, on the real landing page: 「下一题」
      sits at y 776-824, the cookie notice is `fixed bottom-6 z-50` at y 700,
      and `document.elementFromPoint` at the centre of the button returns THE
      COOKIE NOTICE. Both were z-50, so the one later in the document won.

        一个用手机的老板，还没关掉 cookie 提示，就按不到「下一题」。

      That is the entire funnel: the questionnaire is what feeds /api/analyze,
      which is what produces the system he came here to look at. It failed at
      question one, on the width 任务 26 measured this market to be on.

      A modal owns the screen while it is open; page-level chrome belongs
      underneath it. The notice is still there when the sheet closes.
    */
    <section className="fixed inset-0 z-60 flex flex-col bg-background">
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

"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
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
    <section className="fixed inset-0 z-50 flex flex-col justify-center bg-background px-6">
      <Progress value={((stepIndex + 1) / QUESTIONS.length) * 100} className="mx-auto mb-8 max-w-md" />
      <AnimatePresence mode="wait">
        <QuestionCard
          key={currentQuestion.id}
          question={currentQuestion}
          value={currentValue}
          onChange={(value) => setAnswers((a) => ({ ...a, [currentQuestion.id]: value }))}
        />
      </AnimatePresence>
      <div className="mx-auto flex w-full max-w-md justify-between">
        <Button variant="ghost" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => i - 1)}>
          {t("back")}
        </Button>
        <Button onClick={handleNext} disabled={!currentValue}>
          {isLast ? t("submit") : t("next")}
        </Button>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import type { AnalysisResult } from "@/types/database";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const LOADING_STEPS = ["loadingStep1", "loadingStep2", "loadingStep3"] as const;

// Staggered reveal so the analysis narrates itself in beats (summary, then
// bottlenecks, then the before/after transformation) instead of popping in
// all at once — this is the AI-reveal moment, one of the two zones (with the
// Hero) explicitly agreed to carry extra creative investment.
const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

function LoadingState() {
  const t = useTranslations("analysis");
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, LOADING_STEPS.length - 1));
    }, 1700);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full bg-foreground"
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={stepIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="font-serif text-xl text-muted-foreground"
        >
          {t(LOADING_STEPS[stepIndex])}
        </motion.p>
      </AnimatePresence>
    </section>
  );
}

function WorkflowRow({ label, steps, tone }: { label: string; steps: string[]; tone: "muted" | "accent" }) {
  return (
    <div>
      <h5 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</h5>
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium",
                tone === "accent" ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground",
              )}
            >
              {step}
            </span>
            {i < steps.length - 1 && <span className="text-muted-foreground/60">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalysisReveal({
  industryId,
  language,
  answers,
  onDone,
}: {
  industryId: string;
  language: "zh" | "en";
  answers: Record<string, string>;
  onDone: (leadId: string, analysis: AnalysisResult) => void;
}) {
  const [state, setState] = useState<"loading" | "error" | "done">("loading");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const t = useTranslations("analysis");
  const rootRef = useRef<HTMLDivElement>(null);

  // The stepper that leads here is a fixed full-screen overlay; when it closes,
  // the page falls back to whatever scroll position it had before the overlay
  // opened (typically back at Section 2/3), stranding the visitor with no sign
  // anything happened. Scroll this section into view the moment it mounts, so
  // the loading state is what greets them, not a jump back to the industry pills.
  useEffect(() => {
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ industryId, language, answers }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setAnalysis(data.analysis);
        setState("done");
        onDone(data.leadId, data.analysis);
      })
      .catch((err) => {
        console.error(err);
        setState("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "loading") {
    return (
      <div ref={rootRef}>
        <LoadingState />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div ref={rootRef}>
        <section className="flex min-h-screen items-center justify-center px-6 text-center">
          <p className="text-muted-foreground">{t("error")}</p>
        </section>
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-2xl px-6 py-24"
      >
        <motion.p variants={item} className="text-center font-serif text-2xl leading-snug font-semibold">
          {analysis!.summary}
        </motion.p>

        <motion.h4 variants={item} className="mt-16 mb-5 font-serif text-lg font-semibold">
          {t("bottlenecksTitle")}
        </motion.h4>
        <div className="grid gap-3">
          {analysis!.bottlenecks.map((b, i) => (
            <motion.div key={i} variants={item}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center gap-3">
                  {b.icon && (
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-lg leading-none"
                    >
                      {b.icon}
                    </span>
                  )}
                  <CardTitle className="font-serif text-base">{b.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{b.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.h4 variants={item} className="mt-16 mb-5 font-serif text-lg font-semibold">
          {t("transformTitle")}
        </motion.h4>
        <motion.div variants={item} className="grid gap-6">
          <WorkflowRow label={t("before")} steps={analysis!.before_workflow} tone="muted" />
          <WorkflowRow label={t("after")} steps={analysis!.after_workflow} tone="accent" />
        </motion.div>
      </motion.section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import type { AnalysisResult } from "@/types/database";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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
      <section className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse text-lg">{t("loading")}</p>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="flex min-h-screen items-center justify-center">
        <p>{t("error")}</p>
      </section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-2xl px-6 py-24"
    >
      <p className="text-center text-lg font-medium">{analysis!.summary}</p>
      <div className="mt-8 grid gap-4">
        {analysis!.bottlenecks.map((b, i) => (
          <Card key={i}>
            <CardHeader className="flex-row items-center gap-2">
              {b.icon && (
                <span aria-hidden="true" className="text-lg leading-none">
                  {b.icon}
                </span>
              )}
              <CardTitle>{b.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{b.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
        <div>
          <h5 className="font-semibold">{t("before")}</h5>
          <p>{analysis!.before_workflow.join(" → ")}</p>
        </div>
        <div>
          <h5 className="font-semibold">{t("after")}</h5>
          <p>{analysis!.after_workflow.join(" → ")}</p>
        </div>
      </div>
    </motion.section>
  );
}

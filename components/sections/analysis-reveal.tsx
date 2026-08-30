"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import type { AnalysisResult } from "@/types/database";
import { SectionShell } from "@/components/section-shell";

/**
 * WHAT HE READS WHILE THE MODEL THINKS, AND FOR HOW LONG.
 *
 * There were three of these on a 1900ms timer -- 5.7 seconds of movement --
 * and then `Math.min` pinned the last one and the screen said the same
 * sentence until the answer arrived.
 *
 * MEASURED 2026-08-31 (`npm run eval:analysis`, and confirmed by the first row
 * the usage ledger ever wrote): median 28.6s, p95 34.1s. So a visitor watched
 * ONE FROZEN SENTENCE FOR TWENTY-THREE SECONDS, on the landing page, after
 * typing two minutes about his business and before he has an account. A
 * progress display that stops changing does not read as slow, it reads as
 * stuck -- and this is the moment the whole product is being judged in.
 *
 * The wait cannot be shortened from the model side: reasoning_effort "medium"
 * halves it (12.4s) and costs the analysis its consistency -- the same
 * questionnaire started landing enquiries on a different page 1 run in 3. What
 * he is being sold is 「你自己的系统」, and it stops being his if the same
 * description grows a different one.
 *
 * So the copy walks the real duration instead. Six steps, and each names
 * something the analysis genuinely decides (modules, the enquiry landing page,
 * the layout) rather than padding.
 */
const LOADING_STEPS = [
  "loadingStep1",
  "loadingStep2",
  "loadingStep3",
  "loadingStep4",
  "loadingStep5",
  "loadingStep6",
] as const;

/** Median 28.6s, p95 34.1s, measured. Re-run eval:analysis and move this if the
 *  model gets faster; the pacing below is derived from it rather than guessed,
 *  so one number is the only thing to change. */
const MEASURED_WAIT_MS = 30_000;
const STEP_MS = Math.round(MEASURED_WAIT_MS / LOADING_STEPS.length);

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

function LoadingState() {
  const t = useTranslations("analysis");
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      // Still clamped: the last line is written to be true for as long as it
      // has to be ("almost there"), which the four before it are not.
      setStepIndex((i) => Math.min(i + 1, LOADING_STEPS.length - 1));
    }, STEP_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="flex min-h-screen flex-col items-center justify-center gap-9 px-6">
      {/* A drafting compass sweeping: one arc rotating inside a static ring.
          Reads as an instrument at work rather than a generic spinner. */}
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border border-border" />
        <motion.div
          className="absolute inset-0 rounded-full border border-transparent border-t-blueprint"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blueprint"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="flex flex-col items-center gap-4">
        <span className="annotation">SYS.ANALYSIS</span>
        <AnimatePresence mode="wait">
          <motion.p
            key={stepIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35 }}
            className="font-serif text-2xl tracking-[-0.01em] text-foreground/80"
            /* The hook shoot-waiting.mjs reads. Naming the STEP, not just the
               sentence, is what lets that shoot assert the six lines actually
               advanced -- reading 「the first serif paragraph on the page」
               picked up a different section's copy the moment the layout
               moved, which is the shape of ruler this repo has been lied to
               by before. */
            data-analysis-step={LOADING_STEPS[stepIndex]}
          >
            {t(LOADING_STEPS[stepIndex])}
          </motion.p>
        </AnimatePresence>
      </div>
    </section>
  );
}

/*
  The payoff graphic. The visitor's current process and the proposed system are
  both drawn as vertical flow tracks, and the contrast between HOW they are drawn
  carries the argument:

    current  — rust, dashed connector, nodes stepped at irregular offsets
    proposed — cyan, solid connector, nodes flush and numbered

  The connector scales in from the top as the track enters the viewport, so each
  track literally draws itself. Nodes are real HTML text (selectable, localized),
  not SVG labels, and the connector is a transform on a div — so a workflow of
  any length lays out correctly without hand-computed path coordinates.
*/
function WorkflowTrack({
  label,
  steps,
  tone,
}: {
  label: string;
  steps: string[];
  tone: "current" | "proposed";
}) {
  const t = useTranslations("analysis");
  const isProposed = tone === "proposed";
  const lineColor = isProposed ? "bg-signal/60" : "bg-rust/45";
  const dotColor = isProposed ? "bg-signal" : "bg-rust";
  const textColor = isProposed ? "text-foreground" : "text-muted-foreground";

  return (
    /* flex-col + a pushed-down footer so both tracks close on a shared baseline
       even when the two workflows differ in length — otherwise the shorter
       column just trails off into empty space. */
    <div className="flex h-full flex-col">
      <div className="mb-7 flex items-center gap-3">
        <span
          className={`annotation ${isProposed ? "!text-signal" : "!text-rust"}`}
        >
          {label}
        </span>
        <span
          className={`h-px flex-1 ${isProposed ? "bg-signal/25" : "bg-rust/20"}`}
        />
      </div>

      {/* flex-1 lives on this spacer wrapper, not on the connector's own parent,
          so the line spans exactly the node list. Putting flex-1 directly on the
          positioning context stretched the connector down past its last node. */}
      <div className="flex-1">
        <div className="relative pl-6">
          {/* The connector. Origin-top scaleY so it draws downward. */}
          <motion.span
            aria-hidden="true"
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className={`absolute top-2 bottom-2 left-[3px] w-px origin-top ${lineColor} ${
              isProposed ? "" : "opacity-70"
            }`}
            style={
              isProposed
                ? undefined
                : /* Dashed via a repeating gradient: the ad-hoc path. */
                  {
                    backgroundImage:
                      "repeating-linear-gradient(to bottom, currentColor 0 4px, transparent 4px 9px)",
                    backgroundColor: "transparent",
                    color: "var(--rust)",
                  }
            }
          />

          <ul className="grid gap-5">
            {steps.map((step, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{
                  duration: 0.45,
                  delay: 0.25 + i * 0.07,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative flex items-center gap-4"
              >
                {/* Node marker stays anchored ON the connector for both tracks, so
                  the line always reads as one continuous path. Square nodes for
                  the proposed system (drafted), round for the current one (ad hoc). */}
                <span
                  aria-hidden="true"
                  className={`absolute -left-6 h-1.5 w-1.5 shrink-0 ${dotColor} ${
                    isProposed ? "" : "rounded-full"
                  }`}
                />
                {isProposed && (
                  <span className="font-mono text-[0.625rem] tabular-nums text-signal/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                )}
                {/* Only the LABEL goes ragged on the current-state track — an
                  unplanned process doesn't line up. The proposed track is flush
                  and numbered, and the eye reads that difference before the words. */}
                <span
                  className={`text-[0.9375rem] ${textColor}`}
                  style={
                    isProposed ? undefined : { marginLeft: `${(i % 3) * 12}px` }
                  }
                >
                  {step}
                </span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

      {/* Track footer: the step count, read straight off the data. Gives both
          columns a shared closing baseline and states plainly how many hand-offs
          each process actually has. */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className={`mt-8 border-t pt-4 ${isProposed ? "border-signal/20" : "border-rust/15"}`}
      >
        <span
          className={`font-mono text-[0.625rem] tracking-[0.14em] tabular-nums uppercase ${
            isProposed ? "text-signal/70" : "text-rust/60"
          }`}
        >
          {t("stepCount", { count: steps.length })}
        </span>
      </motion.div>
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
  // Dev-only guard: React StrictMode double-invokes effects on mount, which
  // would otherwise fire this paid OpenAI call twice per real page load
  // (confirmed happening — two rate_limit_events rows landed from a single
  // manual QA pass). The ref survives the mount/unmount/remount StrictMode
  // cycle within one component instance, so only the first invocation fetches.
  const hasFetchedRef = useRef(false);

  // The stepper that leads here is a fixed full-screen overlay; when it closes,
  // the page falls back to whatever scroll position it had before the overlay
  // opened (typically back at Section 2/3), stranding the visitor with no sign
  // anything happened. Scroll this section into view the moment it mounts, so
  // the loading state is what greets them, not a jump back to the industry pills.
  useEffect(() => {
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

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
        <section className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="annotation !text-destructive">SYS.ERROR</span>
          <p className="text-muted-foreground">{t("error")}</p>
        </section>
      </div>
    );
  }

  // `modules` is nullable in the database -- every analysis written before
  // 2026-08-21 has none, and back-filling one would be inventing a
  // recommendation that nothing made. An empty list hides the section rather
  // than rendering an empty schedule.
  const modules = analysis?.modules ?? [];

  return (
    <div ref={rootRef}>
      {/* Runs through the shared SectionShell like every other section, so the
          payoff sits in the same rhythm as the rest of the sheet. The verdict
          itself IS the heading — it's the most important sentence the AI
          produces, so it gets display treatment, not body-copy treatment. */}
      <SectionShell
        index="03"
        label="FINDINGS"
        heading={analysis!.summary}
        headingClassName="text-[clamp(1.5rem,3.4vw,2.5rem)] leading-[1.15]"
      >
        <motion.div variants={container} initial="hidden" animate="show">
          <div>
            <motion.div
              variants={item}
              className="mb-8 flex items-center gap-4"
            >
              <h3 className="annotation !text-muted-foreground">
                {t("bottlenecksTitle")}
              </h3>
              <span className="h-px flex-1 bg-border" />
              <span className="font-mono text-[0.625rem] tabular-nums text-muted-foreground">
                {String(analysis!.bottlenecks.length).padStart(2, "0")}
              </span>
            </motion.div>

            <div className="grid gap-px bg-border">
              {analysis!.bottlenecks.map((b, i) => (
                <motion.div
                  key={i}
                  variants={item}
                  /* Hairline-separated rows on a shared background, not detached
                     cards: findings on one drawing, in one schedule. The left
                     rust bar on hover ties them to the current-state colour. */
                  className="group relative bg-background p-7 transition-colors duration-500 hover:bg-white/[0.02]"
                >
                  <span
                    aria-hidden="true"
                    className="absolute top-0 bottom-0 left-0 w-px origin-top scale-y-0 bg-rust/60 transition-transform duration-500 group-hover:scale-y-100"
                  />
                  <div className="flex items-start gap-5">
                    <span className="font-mono text-[0.625rem] tabular-nums text-rust/70">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1">
                      <h4 className="font-serif text-xl tracking-[-0.01em]">
                        {b.title}
                      </h4>
                      <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                        {b.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* THE ANSWER TO "所以我会拿到什么".
                Everything above this point is diagnosis -- what is wrong, and
                what the workflow should become. None of it told the visitor
                what they would actually receive, and "how many modules, how
                many pages" is the question a business owner is really asking
                when they weigh RM5,000. Until 2026-08-21 the AI could not
                answer it: its output schema had no field for modules or pages,
                and the page count came from a SQL CASE over eight industry
                slugs. See lib/portal/module-catalog.ts.

                Rendered as a numbered schedule rather than a grid of cards,
                because that is what it IS -- a bill of quantities for a system,
                each line naming a thing and the reason it is there. Cards would
                make eight peers of equal weight; a schedule reads top to bottom
                and can be counted. */}
            {modules.length > 0 && (
              <>
                <motion.div variants={item} className="mt-20 mb-4 flex items-center gap-4">
                  <h3 className="annotation !text-muted-foreground">{t("modulesTitle")}</h3>
                  <span className="h-px flex-1 bg-border" />
                  {/* The count is the headline number of this whole section, so
                      it is set as a figure rather than as a label with a number
                      in it. Two figures, because "6 个模块" and "6 页" answer
                      two different questions a customer asks in the same breath:
                      how much system, and how much screen. */}
                  <span className="font-mono text-[0.625rem] tabular-nums whitespace-nowrap text-muted-foreground">
                    {t("modulesCount", { count: modules.length })} · {t("modulesPages", { count: modules.length })}
                  </span>
                </motion.div>

                <motion.p
                  variants={item}
                  className="mb-8 max-w-xl text-sm leading-relaxed text-muted-foreground"
                >
                  {t("modulesLead")}
                </motion.p>

                <div className="grid gap-px bg-border">
                  {modules.map((m, i) => (
                    <motion.div
                      key={m.key}
                      variants={item}
                      className="group relative flex items-baseline gap-5 bg-background p-6 transition-colors duration-500 hover:bg-white/[0.02]"
                    >
                      {/* --signal, not the --rust used on the bottleneck rows
                          above. Those rows are the visitor's CURRENT state and
                          these are the proposed one, which is exactly the
                          distinction WorkflowTrack draws a few lines down with
                          the same two colours (see globals.css: rust = manual
                          and scattered, signal = the system). A third accent
                          here would invent a meaning nothing else on the page
                          uses. */}
                      <span
                        aria-hidden="true"
                        className="absolute top-0 bottom-0 left-0 w-px origin-top scale-y-0 bg-signal/60 transition-transform duration-500 group-hover:scale-y-100"
                      />
                      <span className="font-mono text-[0.625rem] tabular-nums text-signal/70">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="flex flex-1 flex-wrap items-baseline gap-x-4 gap-y-1.5">
                        <h4 className="font-serif text-lg tracking-[-0.01em]">{m.label}</h4>
                        {/* A module with no reason is rendered as a plain name,
                            deliberately. The fallback analysis -- the one that
                            runs when the model could not be reached -- has no
                            reason to give, and printing an invented one would
                            be the single most damaging kind of fabrication this
                            screen could contain. */}
                        {m.why ? (
                          <p className="text-sm leading-relaxed text-muted-foreground">{m.why}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground/60">{t("modulesFree")}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            <motion.div
              variants={item}
              className="mt-20 mb-10 flex items-center gap-4"
            >
              <h3 className="annotation !text-muted-foreground">
                {t("transformTitle")}
              </h3>
              <span className="h-px flex-1 bg-border" />
            </motion.div>

            <motion.div
              variants={item}
              className="grid items-stretch gap-14 sm:grid-cols-2 sm:gap-10"
            >
              <WorkflowTrack
                label={t("before")}
                steps={analysis!.before_workflow}
                tone="current"
              />
              <WorkflowTrack
                label={t("after")}
                steps={analysis!.after_workflow}
                tone="proposed"
              />
            </motion.div>
          </div>
        </motion.div>
      </SectionShell>
    </div>
  );
}

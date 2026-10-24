"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { HeroSection } from "@/components/sections/hero-section";
import { getIndustries } from "@/lib/industries";
import { PeerCaseGallery } from "@/components/sections/peer-case-gallery";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { AnalysisReveal } from "@/components/sections/analysis-reveal";
import { ConversionCta } from "@/components/sections/conversion-cta";
import { AmbientBackdrop } from "@/components/ambient-backdrop";
import { WhatYouGet, Pricing, Faq } from "@/components/sections/landing-explainer";
import { ProcessShowcase } from "@/components/sections/process-showcase";
import { SpecReceipt } from "@/components/sections/spec-receipt";
import { SentenceDrawing, SystemDrawing, HandoverDrawing } from "@/components/sections/system-drawing";
import { SiteFooter } from "@/components/site-footer";
import { CookieNotice } from "@/components/cookie-notice";
import { SiteHeader } from "@/components/site-header";
import { Handover } from "@/components/handover";
import { ChapterRail } from "@/components/chapter-rail";
import { Showroom } from "@/components/sections/showroom";
import type { Industry, AnalysisResult } from "@/types/database";

export default function HomePage() {
  const locale = useLocale() as "zh" | "en";
  const t = useTranslations("peerCases");
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);
  const [showStepper, setShowStepper] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [heroBrief, setHeroBrief] = useState("");

  // 2026-10 定位收窄：不再给陌生访客自己挑行业（founder-points 重点38）—
  // Formae 现在只做一件事（沙龙），所以这一页不再问「你是哪一行」，直接
  // 把访客接到沙龙那一组同业案例 / 问卷上。自动找 slug="beauty" 的那一行，
  // 找不到就什么都不选（industries 表里本来就该有，找不到是数据问题，
  // 不该在这里猜一个假的）。
  useEffect(() => {
    getIndustries()
      .then((rows) => {
        const salon = rows.find((r) => r.slug === "beauty");
        if (salon) setSelectedIndustry(salon);
      })
      .catch(console.error);
  }, []);

  return (
    <main>
      {/* One lit surface behind the whole page, so scrolling past the Hero
          recedes the atmosphere instead of cutting to flat dark. */}
      <AmbientBackdrop />
      {/* Drives the page's tokens from Formae's dark ground to white paper
          across <Showroom>. Renders nothing; see components/handover.tsx. */}
      <Handover />
      {/* 右边那条青边条 —— 老板：「青色那张只有一张的话有点奇怪」。
          解法不是多加几张青，是**让青一直在**（模版就是这样做的：
          它整页不换地色，靠一条永远在的青标签）。见 components/chapter-rail.tsx。 */}
      <ChapterRail />
      <SiteHeader />
      <HeroSection
        onStart={(brief) => {
          // Kept rather than consumed. The Hero asks the same thing the
          // questionnaire's one free-text question asks, so a visitor who has
          // already described their business must not be asked to describe it
          // again two screens later — that reads as the site not having
          // listened, on the exact surface whose promise is that it did.
          setHeroBrief(brief);
          document.getElementById("industry-select")?.scrollIntoView({ behavior: "smooth" });
        }}
      />
      {/* Before the case gallery, not after — same reason as before the old
          trade picker: a visitor has to know what this is explaining before
          reading the explanation. (The picker itself is gone; see the note
          above `id="industry-select"` below — this ordering comment still
          holds for what came after it.) */}
      <SentenceDrawing />
      <SystemDrawing />
      <HandoverDrawing />
      <ProcessShowcase />

      {/* THE FOLD THIS PAGE DID NOT HAVE. Measured: 249 elements and not one
          rendered system, on a site whose promise is that you see your system
          before you pay. It also carries `id="handover"` — the ground turns
          white across it, because from here down the page is about the
          visitor's business rather than about us. */}
      <Showroom />
      {/* 原本这里是 IndustrySelect（八张行业卡，访客自己点一张）。现在只做
          沙龙，industry 在上面的 useEffect 里自动选好了，不用再让访客选一次
          他已经知道答案的问题。`id="industry-select"` 留着：Hero 那颗
          「开始」按钮滚到的就是这个位置，不改它，落点还是这一段同业案例。 */}
      <div id="industry-select" />
      {selectedIndustry && !answers && (
        <>
          <PeerCaseGallery industryId={selectedIndustry.id} />
          <div className="mx-auto max-w-5xl px-6 pb-32 sm:px-10">
            {/* Aligns to SectionShell's content column (8rem margin + 3.5rem gap). */}
            <div className="md:pl-[11.5rem]">
              <button
                onClick={() => setShowStepper(true)}
                className="group relative border border-blueprint/50 px-8 py-4 font-mono text-[0.75rem] tracking-[0.14em] text-blueprint uppercase transition-colors duration-300 hover:border-blueprint focus-visible:ring-1 focus-visible:ring-blueprint focus-visible:outline-none"
              >
                <span className="absolute inset-0 origin-left scale-x-0 bg-blueprint transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
                <span className="relative transition-colors duration-300 group-hover:text-[var(--ink)]">
                  {t("start")} →
                </span>
              </button>
            </div>
          </div>
        </>
      )}
      {showStepper && selectedIndustry && (
        <OnboardingStepper
          initialAnswers={heroBrief ? { new_customer_flow: heroBrief } : undefined}
          industry={selectedIndustry}
          onComplete={(a) => {
            setAnswers(a);
            setShowStepper(false);
          }}
        />
      )}
      {answers && selectedIndustry && (
        <AnalysisReveal
          industryId={selectedIndustry.id}
          language={locale}
          answers={answers}
          // Kept mounted permanently once shown (no `!analysis` guard):
          // unmounting on analysis completion would remove AnalysisReveal at
          // the exact moment its staged reveal finishes, before the visitor
          // ever sees the bottleneck cards / before-after workflow it just
          // animated in.
          onDone={(id, result) => {
            setLeadId(id);
            setAnalysis(result);
          }}
        />
      )}
      {analysis && leadId && <ConversionCta summary={analysis.summary} leadId={leadId} />}

      {/* Unconditional, unlike everything between the picker and here. A
          visitor who scrolled past the trade list without clicking used to
          reach the end of the document at this point -- no deliverable, no
          price, no answer to "how is this different from a web shop", no way
          to contact anyone. */}
      <WhatYouGet />
      <Pricing />
      <SpecReceipt />
      <Faq />
      <SiteFooter />
      <CookieNotice locale={locale} />
    </main>
  );
}

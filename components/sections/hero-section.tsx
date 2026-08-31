"use client";

import { useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useTranslations } from "next-intl";
import { BRAND_NAME } from "@/lib/brand";

// Instrument Serif carries its weight through stroke contrast, not mass — so it
// is set at 400 (no font-bold) and allowed to get genuinely large. Negative
// tracking at this scale is what makes it read as typeset rather than default.
const HEADLINE_CLASSNAME =
  "max-w-4xl font-serif text-[clamp(2.75rem,8.5vw,6.5rem)] leading-[0.95] tracking-[-0.03em] text-balance";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export function HeroSection({ onStart }: { onStart: (brief: string) => void }) {
  const t = useTranslations("hero");
  const [brief, setBrief] = useState("");
  const sectionRef = useRef<HTMLElement>(null);

  // The shader surface itself now lives in AmbientBackdrop, fixed behind the
  // entire page, so the atmosphere carries into every section below instead of
  // hard-cutting at the Hero's bottom edge. What stays here is the Hero's own
  // scroll choreography.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  // Kinetic exit: the block rises and settles back as it leaves, rather than
  // just fading — the type behaves like an object in the scene.
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "-18%"]);
  const contentScale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden text-center"
    >
      {/* Sheet header — the title block of a drawing. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-6 pt-6 sm:px-10 sm:pt-8"
      >
        {/* THIS ROW IS EMPTY ON PURPOSE, AND STAYS FOR THE SPACING.
            It held the brand mark, the language switcher and a SHEET 01 — MY
            annotation. SiteHeader is present from the first pixel now and
            carries the mark and the navigation; the language control moved to
            the footer. The annotation went last and for the plainest reason:
            with the nav bar above it, it sat outside the bar's own max-w-5xl
            column, level with nothing, and read as a label somebody forgot to
            delete. Two marks in one corner is one mark too many even when the
            second one is only three words of mono. */}
      </motion.div>

      <motion.div
        style={{ y: contentY, scale: contentScale, opacity: contentOpacity }}
        // pt-28: SiteHeader is present from the first pixel now and is 55px
        // tall. Without this the announcement pill rendered UNDER it and the
        // nav links cut its right end off -- visible in the first screenshot
        // taken after the pill landed, invisible in any test.
        /*
          `w-full` IS LOad-BEARING. Without a definite width this column sizes
          itself from its widest child's max-content, and the announcement pill
          is one long unbreakable sentence: it measured 503px, so this whole
          section measured 551 inside a 390px phone. Everything else -- the
          headline, the "what kind of business do you run" box, the Start
          button, the price line -- is then laid out 503 wide and CLIPPED,
          because `overflow-x: hidden` further up means the page does not even
          scroll to reach it. The pill already carries `max-w-full` and a
          `truncate` span; `max-width: 100%` resolves against this box, and a
          box whose own width is being derived from its content cannot
          constrain it. Giving it a definite width makes both work, and makes
          the NEXT long child truncate instead of widening the section.

          Found by `npm run check:reachable` at 390 -- 3 unreachable controls,
          all of them here. A `documentElement.scrollWidth` check said "ok",
          because overflow-x: hidden had already clipped the evidence.
        */
        className="relative flex w-full flex-col items-center px-6 pt-28 pb-16 sm:pt-32"
      >
        {/*
          Local readability panel. The gradient is deliberately left vivid (the
          colour IS the impact), so contrast is bought only where it's needed —
          a soft blurred ellipse directly behind the copy — instead of
          desaturating the whole surface with a heavy full-viewport scrim.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[oklch(0.16_0.012_265/0.5)] blur-3xl"
        />

        {/*
          THE ANNOUNCEMENT PILL.

          Every reference page photographed on 2026-08-25 opens with one --
          Resend 「Join us at Resend Forward ›」, Attio 「GTM lessons from Elena
          Verna ›」, Polar a full-width 「Introducing the Polar Startup Program
          →」 bar. Ours opened with a decorative hairline: an instrument being
          laid down, which is atmosphere, and atmosphere is what a page has
          instead of news.

          WHAT GOES IN IT IS THE POINT. Not a product announcement -- we have
          no launches to trumpet and a fake one would be worse than none. The
          LHDN e-Invoice mandate is the strongest thing this business has to
          say to a Malaysian SME owner and it is genuinely news to most of
          them: already compulsory above RM1m turnover, fines from 2028. A
          visitor who reads that line and nothing else has been given something
          worth the visit, which is the only honest reason to put a pill there.

          The datum rule stays -- underneath, thinner -- because the drawn-open
          line is the page's opening gesture and the pill is information.
        */}
        <motion.a
          href="#pricing"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="group mb-7 inline-flex max-w-full items-center gap-2.5 rounded-full border border-white/20 bg-white/[0.06] py-1.5 pr-3 pl-2 text-left backdrop-blur-md transition-colors hover:border-white/40 hover:bg-white/[0.1]"
        >
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[0.6875rem] font-semibold tracking-[0.04em] text-[oklch(0.16_0.012_265)]">
            LHDN
          </span>
          <span className="min-w-0 truncate text-[0.8125rem] text-white/85">{t("pill")}</span>
          <span
            aria-hidden
            className="shrink-0 text-white/45 transition-transform group-hover:translate-x-0.5"
          >
            &rarr;
          </span>
        </motion.a>

        {/* Datum line: draws open from the centre, so the page opens with an
            instrument being laid down. */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mb-9 h-px w-40 origin-center bg-gradient-to-r from-transparent via-white/55 to-transparent"
        />
        <motion.div
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.7, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className={`${HEADLINE_CLASSNAME} text-white`}>{t("headline")}</h1>
        </motion.div>
        <motion.p
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.7, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="mt-7 max-w-md text-base leading-relaxed text-white/80"
        >
          {t("subheadline")}
        </motion.p>
        {/* THE PRODUCT'S FIRST QUESTION, ON THE FOLD.
            This replaced an outlined ghost button whose only job was to scroll
            down to a trade picker — the lightest-weight element on a fold whose
            entire purpose was to get somebody to start.

            Straight from durable.co, measured on 2026-08-21: their fold is a
            72px display line, a two-line subhead, and one big rounded box
            reading "What type of business are you building?" with the CTA
            inside it. You do not read about the product and then begin; you are
            already using it while you read. Their proof line sits directly
            under it — ★4.8 on Trustpilot, trusted by 3 million business owners
            — where a visitor is deciding, not in a testimonial section eight
            screens down.

            What is typed here is not thrown away. It is carried into the
            questionnaire as the answer to `new_customer_flow`, which is the one
            free-text question the whole analysis leans on. A visitor who
            describes their business in their own words at the moment of highest
            intent gives the model far more than the three-question form ever
            collected — and they only have to say it once. */}
        <motion.form
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.7, delay: 0.56, ease: [0.22, 1, 0.36, 1] }}
          onSubmit={(e) => {
            e.preventDefault();
            onStart(brief.trim());
          }}
          className="mt-10 w-full max-w-2xl text-left"
        >
          <div className="rounded-3xl border border-white/20 bg-white/[0.07] p-3 backdrop-blur-md transition-colors focus-within:border-white/45">
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              onKeyDown={(e) => {
                // Enter submits, Shift+Enter breaks the line. A one-line
                // business description is the common case and reaching for a
                // button to send it is friction at exactly the wrong moment.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onStart(brief.trim());
                }
              }}
              rows={3}
              placeholder={t("askPlaceholder")}
              aria-label={t("askPlaceholder")}
              /* `rows={3}` is measured for the wide layout: at 768 and at
                 1440 the example fits the box exactly. On a 390px phone the
                 same sentence wraps to more lines and needs 118px against the
                 box's 93 -- so the example that tells someone HOW MUCH to
                 write was cut off mid-clause, on the one control this page
                 exists for. One line's worth of floor below md, and the wide
                 layout keeps the height it was tuned to. */
              className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-[0.9375rem] leading-relaxed text-white placeholder:text-white/45 focus:outline-none min-h-[7.4rem] md:min-h-0"
            />
            <div className="flex items-center justify-end px-1 pb-1">
              <button
                type="submit"
                /* ⚠️ 这颗按钮本来是白底。2026-08-31 老板：「为什么还是这个背景
                   我们不是换品牌色了吗 说是要黑色跟青色搭配」——
                   品牌色换成青之后，token 全部对了，**而页面上最大的那颗按钮
                   还是白的**，所以青一个字都看不到。
                   一个页面用不到自己的品牌色，等於没有品牌色。
                   青只能配深色字（配白最高 2.3:1），所以是青底墨字。 */
                className="rounded-full px-6 py-2.5 text-[0.875rem] font-semibold [background-color:var(--color-primary)] [color:var(--color-primary-foreground)] transition-transform duration-200 hover:scale-[1.03] focus-visible:ring-2 [--tw-ring-color:var(--color-primary)] focus-visible:outline-none"
              >
                {t("askCta")} →
              </button>
            </div>
          </div>

          <p className="mt-5 text-center text-[0.8125rem] leading-relaxed text-white/60">
            {t("proof")}
          </p>
        </motion.form>

        {/*
          THE PRODUCT, ON THE FIRST SCREEN.

          Sixteen best-known product pages were photographed on 2026-08-25 --
          Linear, Attio, Stripe, Resend, Raycast, Polar among them -- and six of
          six put a picture of the product directly under the headline. This
          page put a headline, a text box, and the word SCROLL. A visitor was
          asked to type before being shown anything, on a page whose entire
          claim is 「先看到你的系统，再决定要不要做」.

          IT IS A REAL SCREENSHOT, not a mockup and not an illustration: the
          demo account's own dashboard in 仪表盘, generated by the same builder a
          visitor's answers would run, cropped only to remove Formae's editor
          chrome from around it. A drawn approximation would be the one thing
          this page cannot afford, because the whole pitch is that what you see
          is what you get.

          Faded and pushed down rather than centred: it is EVIDENCE for the box
          above it, not the subject of the screen. The box is still the thing
          you are meant to touch.
        */}
        <motion.figure
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.78, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-14 w-full max-w-4xl"
        >
          {/* THE LIGHT THE WINDOW STANDS IN.
              Attio's product shot floats out of a soft wash; Resend's object is
              lit from below by a single band. Ours sat flat on the gradient
              with a drop shadow and read as a picture pasted onto a background
              rather than as a thing in a space. One blurred ellipse behind the
              top edge is the whole trick, and it costs one div. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-16 -top-10 -z-10 h-40 rounded-[50%] bg-[oklch(0.62_0.14_262/0.35)] blur-3xl"
          />
          <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.9)]">
            {/* A WINDOW, NOT A CROP. The same 26px strip the editor's canvas
                gained on 2026-08-25 -- three dots and a centred name -- so the
                one motif appears in both places and a visitor who signs up
                recognises the frame they were shown. Wix does this and Durable
                does not, which is the difference the founder pointed at. */}
            <div className="flex h-[30px] items-center gap-2 border-b border-white/10 bg-white/[0.06] px-3.5">
              <span className="flex gap-1.5" aria-hidden>
                <span className="h-[7px] w-[7px] rounded-full bg-white/25" />
                <span className="h-[7px] w-[7px] rounded-full bg-white/25" />
                <span className="h-[7px] w-[7px] rounded-full bg-white/25" />
              </span>
              <span className="flex-1 text-center text-[0.6875rem] tracking-[0.02em] text-white/45">
                {t("shotWindow")}
              </span>
              <span className="w-[42px]" aria-hidden />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero-system.jpg"
              alt={t("shotAlt")}
              width={1360}
              height={905}
              loading="eager"
              className="block w-full [mask-image:linear-gradient(to_bottom,black_78%,transparent)]"
            />
          </div>
          <figcaption className="mt-4 text-center text-[0.8125rem] leading-relaxed text-white/65">
            {t("shotCaption")}
          </figcaption>
        </motion.figure>

        {/*
          THE PROOF BAND.

          Stripe runs a logo row directly under its fold; Attio runs one under
          its product shot. We have no customer logos and inventing them is out
          of the question -- so this states three numbers that are true and
          checkable in the product itself: the registers, the blocks, the two
          minutes. It does the same job the logo row does, which is to say "this
          is real and it is bigger than one screenshot", without claiming
          anybody's name.

          The numbers are set in the display face at figure scale because they
          are the content, not a caption on it.
        */}
        <motion.dl
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.95, ease: [0.22, 1, 0.36, 1] }}
          className="mt-14 grid w-full max-w-3xl grid-cols-1 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-3"
        >
          {(
            [
              [t("proofA"), t("proofALabel")],
              [t("proofB"), t("proofBLabel")],
              [t("proofC"), t("proofCLabel")],
            ] as const
          ).map(([value, label]) => (
            <div key={label} className="bg-[oklch(0.16_0.012_265/0.55)] px-6 py-6 backdrop-blur-md">
              <dt className="sr-only">{label}</dt>
              <dd>
                <span className="block font-serif text-[1.875rem] leading-none tracking-[-0.02em] text-white tabular-nums">
                  {value}
                </span>
                <span className="mt-2.5 block text-[0.8125rem] leading-snug text-white/60">
                  {label}
                </span>
              </dd>
            </div>
          ))}
        </motion.dl>
      </motion.div>

      {/* Scroll cue: a plumb line dropping off the bottom of the sheet. */}
      <motion.div
        style={{ opacity: contentOpacity }}
        className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3"
      >
        <span className="annotation !text-white/45">SCROLL</span>
        <div className="h-12 w-px overflow-hidden bg-white/20">
          <motion.div
            className="h-1/2 w-full bg-white/80"
            animate={{ y: ["-100%", "200%"] }}
            transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </section>
  );
}

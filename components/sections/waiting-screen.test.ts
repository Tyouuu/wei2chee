import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import zh from "@/messages/zh.json";
import en from "@/messages/en.json";

const reveal = readFileSync("components/sections/analysis-reveal.tsx", "utf8");
const stepper = readFileSync("components/onboarding/stepper.tsx", "utf8");
const cookie = readFileSync("components/cookie-notice.tsx", "utf8");

/** The z-index on a component's own `fixed` root, read from the source rather
 *  than hand-copied -- a number written down in a test is a fact that outlives
 *  what it describes, which is a mistake this repo has made six times. */
function fixedZ(src: string): number {
  const m = src.match(/className="[^"]*\bfixed\b[^"]*\bz-\[?(\d+)\]?/);
  if (!m) throw new Error("no fixed z-index found");
  return Number(m[1]);
}

describe("the questionnaire's waiting screen", () => {
  /*
    THE SCREEN HE READS FOR TWENTY-NINE SECONDS.

    Measured: median 28.6s, p95 34.1s. It used to hold three lines on a 1900ms
    timer and then freeze, so a stranger watched one unchanging sentence for
    twenty-two of those seconds -- on the landing page, before he has an
    account, at the moment the whole product is being judged.

    A line that exists in the component but not in the catalogue renders as its
    own key ("loadingStep6"), and a line in the catalogue that the component
    never reaches is a sentence nobody will ever read.
  */
  const steps = [...reveal.matchAll(/"(loadingStep\d+)"/g)].map((m) => m[1]);
  const unique = [...new Set(steps)];

  it("walks more than the four seconds the old one did", () => {
    expect(unique.length).toBeGreaterThanOrEqual(6);
  });

  it("says every one of them in both languages", () => {
    for (const key of unique) {
      expect((zh.analysis as Record<string, string>)[key], `zh ${key}`).toBeTruthy();
      expect((en.analysis as Record<string, string>)[key], `en ${key}`).toBeTruthy();
    }
  });

  it("leaves no sentence in the catalogue that the screen never reaches", () => {
    const inZh = Object.keys(zh.analysis).filter((k) => /^loadingStep\d+$/.test(k));
    expect(inZh.sort()).toEqual(unique.sort());
  });
});

describe("the questionnaire sheet outranks the page chrome", () => {
  /*
    MEASURED AT 390x844 ON 2026-08-31, ON THE REAL PAGE. 「下一题」 sat at
    y 776-824; the cookie notice is `fixed bottom-6 z-50`, top y 700; and
    document.elementFromPoint at the centre of that button returned THE COOKIE
    NOTICE. Both were z-50, so the later one in the document won.

      一个用手机的老板，还没关掉 cookie 提示，就按不到「下一题」。

    That is the whole funnel: the questionnaire is what feeds /api/analyze,
    which produces the system he came to look at. It failed at question one, on
    the width 任务 26 measured this market to be on.

    重点 24: 眼睛看到的每一个错，当场变成一条会红的守卫. This one has been seen
    red -- put the stepper back to z-50 and it fails.
  */
  it("puts the stepper above the cookie notice", () => {
    expect(fixedZ(stepper)).toBeGreaterThan(fixedZ(cookie));
  });
});

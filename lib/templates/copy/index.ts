/**
 * One entry point for every word a generated system contains.
 *
 * Callers pass a `SystemLang` and get the right table back. Nothing outside
 * this directory should import `*.en.ts` or `*.zh.ts` directly -- that is how a
 * page ends up hard-wired to one language while the rest of the system follows
 * the project's setting.
 */
import type { SystemLang } from "@/lib/system-lang";
import type { IndustryLabels, ModuleCopy, SampleSet } from "./types";
import { SAMPLES_EN, GENERIC_SAMPLE_EN } from "./samples.en";
import { SAMPLES_ZH, GENERIC_SAMPLE_ZH } from "./samples.zh";
import { moduleCopyEn } from "./module-copy.en";
import { moduleCopyZh } from "./module-copy.zh";

export type { IndustryLabels, ModuleCopy, SampleSet, StatusTone } from "./types";
export {
  landingCopy,
  LANDING,
  type LandingCopy,
  type ServiceHint,
} from "./landing";
export {
  CHROME,
  chrome,
  translateStage,
  pluralise,
  INDUSTRY_LABELS_EN,
  type Chrome,
} from "./chrome";

const SAMPLES: Record<SystemLang, Record<string, SampleSet>> = {
  en: SAMPLES_EN,
  zh: SAMPLES_ZH,
};

const GENERIC: Record<SystemLang, SampleSet> = {
  en: GENERIC_SAMPLE_EN,
  zh: GENERIC_SAMPLE_ZH,
};

/** A trade with no table of its own falls through to the generic set rather
 *  than to an empty page -- the same rule in both languages. */
export const sampleFor = (slug: string, lang: SystemLang): SampleSet =>
  SAMPLES[lang][slug] ?? GENERIC[lang];

export const moduleCopy = (
  key: string,
  labels: IndustryLabels,
  lang: SystemLang,
): ModuleCopy =>
  lang === "zh" ? moduleCopyZh(key, labels) : moduleCopyEn(key, labels);

/** Exported for the parity test only. Nothing else should reach past the
 *  dispatch above. */
export const _tables = { SAMPLES_EN, SAMPLES_ZH, moduleCopyEn, moduleCopyZh };

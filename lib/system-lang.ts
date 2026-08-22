/**
 * The language the BUILT SYSTEM speaks -- which is not the language the owner
 * reads Formae in.
 *
 * WHY THESE ARE TWO DIFFERENT THINGS
 *
 * Everything Formae shows the OWNER is in their language: the questionnaire,
 * the analysis, the editor chrome, the 系统需求书. That is `locale`, it comes
 * from the URL (`/zh/...`), and next-intl already handles it.
 *
 * The system we build for them has a different readership. A renovation
 * contractor in Cheras reads Chinese; the 师傅 on site may read Malay; the
 * quotation goes to a property manager who reads English; the invoice goes to
 * LHDN, which takes English. Business documents in Malaysia are English -- not
 * as a preference, as the format everyone downstream already accepts.
 *
 * So the default is `en`, and that is a deliberate reversal of the obvious
 * choice. Formae speaks to the owner in Chinese ABOUT a system that speaks
 * English to everyone else.
 *
 * The owner can flip it (`projects.system_language`, migration 20260822060000)
 * because a one-person salon whose customers are all Chinese-speaking is a real
 * business and English would be worse for them. What they cannot do is have it
 * both ways on one page: mixing the two inside a single table heading is the
 * thing this type exists to make impossible.
 */
export type SystemLang = "en" | "zh";

/** The default, everywhere, unless a project row says otherwise. See above for
 *  why this is `en` and not `zh`. */
export const DEFAULT_SYSTEM_LANG: SystemLang = "en";

export function isSystemLang(v: unknown): v is SystemLang {
  return v === "en" || v === "zh";
}

/** Reads whatever the database/props handed over and never throws. A project
 *  row with a null or unrecognised value gets the default rather than a crash
 *  in the middle of building somebody's system. */
export function toSystemLang(v: unknown): SystemLang {
  return isSystemLang(v) ? v : DEFAULT_SYSTEM_LANG;
}

/** A phrase in both languages. Used by every copy table below this file. */
export type Bilingual = { en: string; zh: string };

export const say = (phrase: Bilingual, lang: SystemLang): string =>
  phrase[lang];

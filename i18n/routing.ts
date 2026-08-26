import { defineRouting } from "next-intl/routing";

/**
 * WHY THE DEFAULT IS ENGLISH, 2026-08-26.
 *
 * It was Chinese, and that was a reading of the market rather than of the
 * product: the founder is Chinese-speaking, the towkays he sells to are
 * Chinese-speaking, so Formae opened in Chinese. He corrected it —
 * 「用英文 不要用華語」 — and when I heard that as "talk to me in English" he
 * corrected it again: 「不是這個英文 是我的平台裡面用英文」.
 *
 * The distinction that matters, and it is the one this file settles:
 *
 *   locale (here)             what FORMAE says to the owner — /zh/… or /en/…
 *   projects.system_language  what the BUILT SYSTEM says to their customers
 *
 * The second has defaulted to English since migration 20260822060000, because
 * business documents in Malaysia are English. This makes the first agree with
 * it: a Malaysian owner who lands on Formae before choosing anything sees the
 * same language their quotations and their LHDN filings are already in. The
 * switcher is one click away and next-intl still honours a `/zh/` URL, so
 * nothing is taken from anyone — only the opening guess changes.
 *
 * That guess was not safe to change until 2026-08-26. The English portal had
 * 386 Chinese strings on it (`npm run check:en`, now 0); defaulting to English
 * before fixing them would have made the half-translated screen the FIRST one
 * every new owner saw.
 */
export const routing = defineRouting({
  locales: ["zh", "en"],
  defaultLocale: "en",
});

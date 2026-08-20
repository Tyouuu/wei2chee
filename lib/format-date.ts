/**
 * Dates, formatted the same on the server and in the browser.
 *
 * WHY THIS FILE EXISTS. `new Intl.DateTimeFormat(locale, {...})` resolves the
 * time zone from the environment it runs in. The server runs in UTC and a
 * customer's browser runs in Asia/Kuala_Lumpur — eight hours apart — so any
 * timestamp rendered during SSR and then hydrated produced two different
 * strings and React tore the tree down with a hydration error. It showed up as
 * a minified #418 in production and not in dev, because dev happened to be
 * running in the same zone as the browser.
 *
 * Pinning the zone fixes the mismatch AND is the correct answer independently:
 * this product is sold to Malaysian businesses, run by a Malaysian founder, and
 * "8月21日 上午12:13" should mean the same thing to everyone who reads it
 * regardless of where the render happened.
 */
const TIME_ZONE = "Asia/Kuala_Lumpur";

const intlLocale = (locale: string) => (locale === "zh" ? "zh-MY" : "en-MY");

/** "8月21日" — for a list where the year is implied. */
export function formatDay(iso: string | number | Date, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "short",
    day: "numeric",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

/** "8月21日 上午12:13" — when the time of day carries information. */
export function formatDayTime(iso: string | number | Date, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

/** "上午12:13" — for something that just happened, where the date is today. */
export function formatTime(iso: string | number | Date, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

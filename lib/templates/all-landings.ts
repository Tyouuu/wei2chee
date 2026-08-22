import { LANDING_TEMPLATES, type LandingTemplate } from "@/lib/templates/landing-templates";
import { BLOCK_LANDINGS } from "@/lib/templates/block-landings";

/**
 * Every 官网版面 a customer can pick: the six built from their own words, then
 * the three pulled whole-page templates.
 *
 * A THIRD MODULE RATHER THAN AN APPEND. Putting BLOCK_LANDINGS into
 * landing-templates.ts would make a runtime import cycle — block-landings needs
 * LandingTemplate from there — and an ESM cycle whose values are read at module
 * scope is the kind of bug that shows up as `undefined` in production and
 * nowhere else. block-landings imports the TYPE only, which erases; this file
 * is where the two lists actually meet.
 *
 * ORDER IS THE MESSAGE. The six come first because they are the better answer
 * for almost every business: they already say the customer's own name, trade
 * and phone number. The pulled three are longer and better looking and say
 * "Acme", and a customer should meet them as the alternative rather than as the
 * default.
 */
export const ALL_LANDINGS: LandingTemplate[] = [...LANDING_TEMPLATES, ...BLOCK_LANDINGS];

/** Keyed lookup for `?tpl=`. Both kinds resolve the same way, which is the
 *  point of giving the pulled ones a LandingTemplate shape at all. */
export const ALL_LANDING_BY_KEY: Record<string, LandingTemplate> = Object.fromEntries(
  ALL_LANDINGS.map((t) => [t.key, t]),
);

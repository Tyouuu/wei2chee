import { LANDING_TEMPLATES, type LandingTemplate } from "@/lib/templates/landing-templates";
import { BLOCK_LANDINGS } from "@/lib/templates/block-landings";

/**
 * Every 官网版面 a customer can pick.
 *
 * ── THE THREE PULLED WHOLE-PAGE TEMPLATES ARE NO LONGER OFFERED ───────────
 *
 * They were, until 2026-08-25, on the argument written here before: they are
 * longer and better looking than the six, and a customer should meet them as
 * the alternative rather than as the default. What that argument left out is
 * what they SAY.
 *
 * Photographed that day: the demo account's own published website, for a
 * Malaysian renovation contractor called 兴发装修工程, headed
 *
 *     Acme — The analytics platform built for scale
 *
 * under a fabricated analytics dashboard, over "No credit card required /
 * 14-day free trial / Cancel anytime". The founder's own words about exactly
 * this, weeks earlier: 「套版面的时候，AI 必须先把文案改成他的生意」 and
 * 「这是唯一一个会让人当场关掉页面的问题」.
 *
 * THE REASON IT CANNOT BE FIXED BY REWRITING THE COPY, which is why they leave
 * rather than get patched: `set_copy` can only write keys that exist in
 * BLOCK_COPY, and BLOCK_COPY is generated from each section's `copy` const.
 * Grepped: for `saas-landing/hero` that const holds TRUST_ITEMS and
 * SCREENSHOT_ROWS. The headline is not in it -- it is literal text inside the
 * component. So there is no operation in this product, AI or human, that can
 * make that page say the customer's business. A template whose headline cannot
 * be the customer's name has no business dressing the one page a stranger
 * reads.
 *
 * WHAT WOULD BRING THEM BACK: lift every literal string in those sections into
 * their `copy` const, regenerate BLOCK_COPY, and seed it from the business's
 * own words at apply time. Then they say the right thing and the length and
 * shape they bring are worth having. Until then they are a liability wearing a
 * gallery card.
 *
 * THEIR SECTIONS ARE STILL REACHABLE through 版段库, one at a time, chosen
 * deliberately, with the words visible on the card before it is placed. A
 * customer who picks a bento grid is picking a bento grid; a customer who
 * picks 「完整介绍」 was picking a shape and got a stranger's pitch.
 *
 * ── ORDER IS STILL THE MESSAGE ────────────────────────────────────────────
 *
 * The six come first and now come alone: they already say the customer's own
 * name, trade, workflow and phone number, because they are built from the
 * analysis rather than pulled from a marketing site.
 */
export const ALL_LANDINGS: LandingTemplate[] = [...LANDING_TEMPLATES];

/**
 * Keyed lookup for `?tpl=`.
 *
 * The pulled three stay HERE, out of the gallery but still resolvable, so a
 * link a customer bookmarked or a draft that already names one renders instead
 * of throwing. Nothing offers those keys any more, so nothing new can reach
 * them -- this is a graceful landing for old state, not a second door.
 */
export const ALL_LANDING_BY_KEY: Record<string, LandingTemplate> = Object.fromEntries(
  [...LANDING_TEMPLATES, ...BLOCK_LANDINGS].map((t) => [t.key, t]),
);

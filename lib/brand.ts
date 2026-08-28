export const BRAND_NAME = "Formae";
export const BRAND_TAGLINE_ZH = "设计你的生意，用 AI 运营它。";
export const BRAND_TAGLINE_EN = "Design your business. Run it with AI.";

/**
 * The number a customer taps to reach us.
 *
 * It has been the literal `60123456789` since this file was written, with a
 * TODO above it, and that number is on FOUR controls a paying customer presses:
 * 「找我们建」 in the rail, the CTA under the specification, the deploy button on
 * their home screen, and the contact line in the legal pages — plus the
 * marketing site's footer and its main conversion button. Every one of them is
 * the path from "I want this" to us, and every one of them opens a chat with a
 * number that does not exist. A dead number is worse than no button: the person
 * who taps it concludes the company is not real.
 *
 * WHY AN ENV VAR RATHER THAN EDITING THE LITERAL. The number is not a code
 * decision, it is a business fact the founder holds and does not have yet — a
 * WhatsApp Business line needs the company registration. Reading it from the
 * environment means the day he has one, pasting it into Vercel makes all six
 * controls work with no deploy of code and nothing to remember.
 *
 * WHY THE PLACEHOLDER STAYS INSTEAD OF THROWING. Local development, the test
 * suite and every screenshot script need the app to render. Throwing here would
 * mean nobody can run the product until a business exists. So the value falls
 * back, and `npm run check` fails loudly on it instead (scripts/check-launch.mjs)
 * — the failure belongs on the way OUT, not on the way in.
 */
const PLACEHOLDER_WHATSAPP = "60123456789";

export const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[^\d]/g, "") || PLACEHOLDER_WHATSAPP;

/** True while the contact number is still the stand-in. Read by the launch
 *  check; also lets a surface choose to say nothing rather than offer a link
 *  that cannot work. */
export const WHATSAPP_IS_PLACEHOLDER = WHATSAPP_NUMBER === PLACEHOLDER_WHATSAPP;

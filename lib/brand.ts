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
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[^\d]/g, "") ||
  PLACEHOLDER_WHATSAPP;

/** True while the contact number is still the stand-in. Read by the launch
 *  check; also lets a surface choose to say nothing rather than offer a link
 *  that cannot work. */
export const WHATSAPP_IS_PLACEHOLDER = WHATSAPP_NUMBER === PLACEHOLDER_WHATSAPP;

/**
 * 一条按得通的 WhatsApp 连结，**或者 null**。
 *
 * ── 为什么要有这一支（2026-09-07）───────────────────────────────────────
 *
 * `WHATSAPP_IS_PLACEHOLDER` 从写出来那天就在，上面那段注解还写着
 * 「lets a surface choose to say nothing rather than offer a link that cannot
 * work」—— 而**系统里面三个地方从来没有问过它**：他自己首页右上角那一颗 ·
 * 规格书那一页 · 「交给我们建」。老板 2026-09-07 自己去点，三颗都打给
 * `wa.me/60123456789`。
 *
 * 之前那条守卫只看**官网**那两个档案，所以这三处一次都没有被点名过。
 *
 * ⚠️ 回 null 的时候**不要画一颗灰的按钮** —— 一颗永远按不下去的按钮
 * 跟一颗打不通的按钮一样糟。整颗不画，或者换成一个真的做得到的动作。
 */
export function whatsappHref(text?: string): string | null {
  if (WHATSAPP_IS_PLACEHOLDER) return null;
  return text
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${WHATSAPP_NUMBER}`;
}

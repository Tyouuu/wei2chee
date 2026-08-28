/**
 * 上线之前，这些东西不可以还是占位符。
 *
 * WHY THIS EXISTS. `WHATSAPP_NUMBER = "60123456789"` sat in lib/brand.ts with a
 * `TODO before real launch` comment above it for two weeks, on four controls a
 * paying customer presses and two more on the marketing site. A TODO is a note
 * to a person; it does not fail anything, and the number stayed. The style
 * choice hid the same way -- an error nobody was made to read.
 *
 * So this is the list of things that must be REAL before anyone is invited in,
 * and it is part of `npm run check` rather than a document.
 *
 * Not a lint rule and not a unit test on purpose: what it checks is the
 * ENVIRONMENT the app will run in, which is exactly what neither of those sees.
 * It reads .env.local so it answers for this machine; on Vercel the same
 * variables come from the project settings.
 *
 *   npm run check:launch
 */
import { existsSync, readFileSync } from "node:fs";

const env = existsSync(".env.local")
  ? Object.fromEntries(
      readFileSync(".env.local", "utf8")
        .split(/\r?\n/)
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => [
          l.slice(0, l.indexOf("=")).trim(),
          l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, ""),
        ]),
    )
  : {};

const value = (k) => process.env[k] || env[k] || "";

const CHECKS = [
  {
    name: "WhatsApp number",
    ok: () => {
      const n = value("NEXT_PUBLIC_WHATSAPP_NUMBER").replace(/[^\d]/g, "");
      return n.length >= 9 && n !== "60123456789";
    },
    why:
      "Six controls open wa.me with it — 找我们建, the specification CTA, the deploy\n" +
      "     button, the legal contact, the site footer and the landing page's main\n" +
      "     conversion button. Until it is real every one of them opens a chat with a\n" +
      "     number that does not exist, which reads as a company that is not real.",
    fix: "set NEXT_PUBLIC_WHATSAPP_NUMBER (Vercel → Settings → Environment Variables)",
  },
  {
    name: "Payment gateway",
    ok: () => Boolean(value("BILLPZ_KEY") || value("BILLPLZ_KEY") || value("TOYYIBPAY_KEY") || value("STRIPE_SECRET_KEY")),
    why:
      "The site says 「规格书 RM 500」. When somebody says yes there is no button that\n" +
      "     takes the money. Billplz and toyyibPay both do FPX, which is what a\n" +
      "     Malaysian SME owner expects to see.",
    fix: "add BILLPLZ_KEY or TOYYIBPAY_KEY",
  },
  {
    name: "Enquiry notification",
    ok: () => Boolean(value("RESEND_API_KEY") || value("POSTMARK_TOKEN") || value("SENDGRID_API_KEY")),
    why:
      "An enquiry lands in the database and the owner finds out only if he opens the\n" +
      "     portal. 15 of the 19 Malaysian SME sites measured put WhatsApp on their\n" +
      "     first screen because their customers live in it — so does the owner.",
    fix: "add RESEND_API_KEY (or another mail provider) and send on insert",
  },
];

let failed = 0;
console.log("");
for (const c of CHECKS) {
  const ok = c.ok();
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "TODO"}  ${c.name}`);
  if (!ok) {
    console.log(`     ${c.why}`);
    console.log(`     → ${c.fix}\n`);
  }
}

console.log(
  failed
    ? `${CHECKS.length - failed} of ${CHECKS.length} ready — ${failed} still a placeholder`
    : `${CHECKS.length} of ${CHECKS.length} ready`,
);

/*
  EXIT 0, DELIBERATELY. These are things the FOUNDER supplies, not things the
  code got wrong: failing the build over a business he has not registered yet
  would only teach everyone to skip `npm run check`, which is the habit that let
  the style choice stay broken for a week. It has to be impossible to miss and
  possible to live with.
*/
process.exit(0);

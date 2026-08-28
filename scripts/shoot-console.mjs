/**
 * 拍下老板自己的后台。
 *
 * WHY THIS NEEDED ITS OWN SCRIPT. Every other shoot:* script logs in as
 * tianyou.demo@formae.test, and that account is a CUSTOMER -- `is_founder()` is
 * false for it, so the console's RPCs raise and the whole screen 404s. The
 * console is the one surface in the product that literally cannot be looked at
 * with the credentials the other twelve scripts share. So it went unlooked-at:
 * 955 lines of admin panel with no picture of it anywhere in .screenshots/.
 *
 * WHY A MAGIC LINK AND NOT A PASSWORD. The founder account is the founder's
 * real email. Hard-coding a password here would mean either knowing his, or
 * changing it -- and changing the password on the account that runs the
 * business, so a screenshot can be taken, is not a trade worth making.
 * `auth.admin.generateLink` mints a one-shot link with the service role and
 * changes nothing about the account.
 *
 *   npm run shoot:console            # → .screenshots/console/
 *
 * Needs `npm run dev` up on :3000.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, ""),
    ]),
);

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = ".screenshots/console";
mkdirSync(OUT, { recursive: true });

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: founder } = await db
  .from("accounts")
  .select("email")
  .eq("role", "founder")
  .limit(1)
  .single();

if (!founder?.email) throw new Error("no founder account -- accounts.role = 'founder' is unset");

const { data: link, error } = await db.auth.admin.generateLink({
  type: "magiclink",
  email: founder.email,
  });
if (error) throw new Error(`generateLink failed: ${error.message}`);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });

/*
  NOT `properties.action_link`. That points at Supabase's own /verify endpoint,
  which then bounces to `redirectTo` -- and that bounce only happens if the URL
  is on the project's allow-list, which localhost:3000 is not. The app already
  owns a route that takes the raw token (app/auth/confirm/route.ts, written for
  the confirmation email), so hand it the hashed token directly and skip
  Supabase's redirect entirely.
*/
const confirm = `${BASE}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/en/portal/console`;
await p.goto(confirm, { waitUntil: "networkidle", timeout: 60000 });
if (!/\/portal/.test(p.url())) throw new Error(`login did not land in the portal: ${p.url()}`);

const shots = [
  ["home", "/en/portal/console"],
  ["leads", "/en/portal/console/leads"],
];

for (const [name, path] of shots) {
  await p.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`${OUT}/${name}.png`);
}

await b.close();

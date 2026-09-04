/**
 * 用眼睛看：老板的画面 vs 师傅的画面。
 *
 * 重点 7l says it four times in one day: 改完一定要自己先用眼睛看那张图，再拿给他。
 * check:staff proves the database refuses; only a picture proves the product is
 * not rude about it -- an empty 收款 page, a rail with a dead row, an editor a
 * supervisor cannot save.
 *
 * Signs a REAL supervisor into the demo business, screenshots the same four
 * screens as the owner and as him, and takes the membership away again. It
 * writes exactly one row and deletes it; a script that leaves a person inside
 * somebody's business is a script that changed what it measured.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const BASE = "http://localhost:3000";
const OWNER = { email: "tianyou.demo@formae.test", password: "FormaeDemo2026!" };
/* fileURLToPath, NOT url.pathname. A URL percent-encodes, and this repository
   lives in a folder with a space in its name -- the first run wrote every
   screenshot into a directory literally called 「MIne%20Saas」, which existed,
   was writable, and was not where anybody would look. */
const OUT = fileURLToPath(new URL("../.screenshots/staff/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const failed = [];
const stamp = Date.now();
const staff = { email: `mandor-${stamp}@formae.test`, password: `Look-${stamp}-x!` };
let staffId = null;

async function signIn(ctx, who) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.fill('input[type="email"]', who.email);
  await p.fill('input[type="password"]', who.password);
  await p.click('button[type="submit"]');
  await p.waitForURL(/portal/, { timeout: 60000 });
  return p;
}

/** What is on this screen, in numbers, so the picture has a caption. */
async function shoot(page, url, name) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  const seen = await page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== "hidden";
    };
    const links = [...document.querySelectorAll("a[href]")].filter(vis);
    return {
      status: document.title,
      /* Whether the word for money appears at all on his screen. Read off the
         rendered text, not off our own list -- 「we filtered it」 and 「it is not
         there」 are different claims and only the second one is checkable. */
      money: /payment|expense|commission|收款|开销|佣金/i.test(document.body.innerText),
      /* ⚠️ HIT-TESTABLE money links only. The home screen draws a live
         MINIATURE of each page, and that miniature contains the customer's own
         rail -- a picture of a rail. It is marked `inert`, so it is out of the
         tab order and out of hit-testing: not a door, a photograph of one.
         Counting it would report a leak no finger can reach, which is the same
         mistake as counting 460 controls on a screen that shows 24. */
      moneyLinks: links
        .filter((a) => !a.closest("[inert]"))
        .map((a) => a.getAttribute("href") || "")
        .filter((h) => /\/(payments|expenses|commission)\b/.test(h)).length,
      moneyHrefs: [
        ...new Set(
          links
            .filter((a) => !a.closest("[inert]"))
            .map((a) => a.getAttribute("href") || "")
            .filter((h) => /\/(payments|expenses|commission)\b/.test(h)),
        ),
      ],
      /* Puck's canvas puts a drag handle on every block. If a supervisor has
         one, he has the editor. */
      editorHandles: document.querySelectorAll("[data-puck-component], [class*='PuckCanvas']").length,
      addRecord: links.filter((a) => /\/new$/.test(a.getAttribute("href") || "")).length,
      text: document.body.innerText.trim().length,
    };
  });
  if (seen.moneyHrefs.length) console.log(`    -> ${seen.moneyHrefs.join("  ")}`);
  console.log(`  ${name.padEnd(22)} money=${seen.money} moneyLinks=${seen.moneyLinks} editor=${seen.editorHandles} 加一单=${seen.addRecord} chars=${seen.text}`);
  return seen;
}

const browser = await chromium.launch();
try {
  // ── the supervisor exists, and the owner invites him ──────────────────
  const { data: made, error } = await admin.auth.admin.createUser({
    email: staff.email,
    password: staff.password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  staffId = made.user.id;

  const asOwner = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const inOwner = await asOwner.auth.signInWithPassword(OWNER);
  if (inOwner.error) throw new Error(`owner sign-in: ${inOwner.error.message}`);
  const { error: addErr } = await asOwner.rpc("add_project_member", { in_email: staff.email });
  if (addErr) throw new Error(`add_project_member: ${addErr.message}`);

  const ownerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const staffCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  console.log("\n老板看到的：");
  const oPage = await signIn(ownerCtx, OWNER);
  const oHome = await shoot(oPage, "/en/portal", "owner-home");
  await shoot(oPage, "/en/portal/quotations?design=1", "owner-quotations");
  const oMoney = await shoot(oPage, "/en/portal/payments?design=1", "owner-payments");
  await shoot(oPage, "/en/portal/account", "owner-account");

  console.log("\n师傅看到的：");
  const sPage = await signIn(staffCtx, staff);
  const sHome = await shoot(sPage, "/en/portal", "staff-home");
  const sQuotes = await shoot(sPage, "/en/portal/quotations?design=1", "staff-quotations");
  const sMoney = await shoot(sPage, "/en/portal/payments?design=1", "staff-payments");
  await shoot(sPage, "/en/portal/account", "staff-account");

  console.log("\n判：");
  /* Exits non-zero, so this is a ruler and not a photo album. A script that
     prints FAIL and returns 0 is one nobody notices going red. */
  const say = (ok, line) => {
    if (!ok) failed.push(line);
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${line}`);
  };
  say(sHome.text > 200, "师傅的首页不是空的（他站在老板那一间）");
  say(oHome.moneyLinks > 0 && sHome.moneyLinks === 0, "首页：老板有钱那几页的入口，师傅没有");
  say(oMoney.text > 200 && sMoney.text < 200, "收款那一页老板打得开，师傅打不开");
  say(sMoney.text < 200, "而且是打不开，不是打开一张空表");
  /* The editor is the owner's tool and the one thing a 师傅 must never be
     handed -- every control in it is refused by save_project_page. */
  say(sQuotes.editorHandles === 0, "师傅拿到的是那一页，不是编辑器");
  say(sQuotes.addRecord > 0, "而他还是加得了一单（不然请他进来干吗）");
  console.log(`\n  图在 .screenshots/staff/`);
} finally {
  await browser.close();
  if (staffId) await dropThrowaway(admin, staffId);
  console.log("(supervisor removed)");
}

if (failed.length) {
  console.log(`
${failed.length} failed`);
  process.exit(1);
}

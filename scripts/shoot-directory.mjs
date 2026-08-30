/**
 * 看一眼客户名单，用真的行。
 *
 * WHY THIS EXISTS. `npm run check:records` asserts 12 things about
 * directory_entries against the real database and every one of them passed
 * before anybody had seen the page. That is exactly the gap 重点 7l names:
 * 数字过关不等於眼睛过关. The projection composes a contact line out of four
 * columns, the form grows its own boxes, and neither of those is a thing a
 * database assertion can look at.
 *
 *   npm run shoot:directory          # → .screenshots/directory/
 *
 * ⚠️ IT WRITES TO THE DEMO ACCOUNT AND PUTS IT BACK. Two rows go in through
 * the same RPC the button calls, and the ids are deleted in a finally block.
 * The eval script learnt this the expensive way (任务 23e): it changed the
 * founder's public headline and left it there for a day.
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
const OUT = ".screenshots/directory";
mkdirSync(OUT, { recursive: true });

const EMAIL = "tianyou.demo@formae.test";
const PASSWORD = "FormaeDemo2026!";

const asCustomer = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const { error: signIn } = await asCustomer.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
});
if (signIn) throw new Error(`sign in: ${signIn.message}`);

const { data: project } = await asCustomer.from("projects").select("id").single();
if (!project?.id) throw new Error("the demo account has no project");

/* Two parties, written through the RPC the form calls -- not inserted. A
   fixture that goes in through a different door proves the door works, which
   is the mistake live-rows.test.ts made with its hand-made tree. */
const written = [];
const b = await chromium.launch();
try {
  for (const row of [
    {
      in_name: "陈先生",
      in_phone: "03-7788 1234",
      in_whatsapp: "012-345 6789",
      in_region: "Taman Desa",
      in_status: "施工中",
    },
    {
      in_name: "建材行 A",
      in_kind: "company",
      in_contact_person: "王老板",
      in_phone: "016-222 3333",
      in_status: "新客户",
    },
    /* The row with nothing but a name and a note. It is the one the composed
       contact line can most easily render as an empty second column, which
       reads as a broken row rather than as a thin one. */
    { in_name: "李太太", in_note: "熟客，介绍来的" },
  ]) {
    const { data, error } = await asCustomer.rpc("add_directory_entry", {
      in_project_id: project.id,
      in_module_key: "customers",
      ...row,
    });
    if (error) throw new Error(`add_directory_entry: ${error.message}`);
    written.push(data.id);
  }

  for (const [name, width, height] of [
    ["1440", 1440, 1400],
    ["390", 390, 844],
  ]) {
    const p = await b.newPage({ viewport: { width, height } });
    await p.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded" });
    await p.fill('input[type="email"]', EMAIL);
    await p.fill('input[type="password"]', PASSWORD);
    await p.click('button[type="submit"]');
    await p.waitForURL("**/portal**", { timeout: 30000 });

    await p.goto(`${BASE}/en/portal/customers`, { waitUntil: "networkidle" });
    await p.screenshot({ path: `${OUT}/list-${name}.png`, fullPage: true });

    await p.goto(`${BASE}/en/portal/customers/new`, { waitUntil: "networkidle" });
    await p.screenshot({ path: `${OUT}/form-${name}.png`, fullPage: true });

    /* The collapsed half. A disclosure nobody opens is a disclosure nobody
       has looked at, and 「更多」 hiding a broken layout is the same defect as
       hiding it behind `!compact` was last week. */
    const more = p.locator("button[aria-expanded]").first();
    if (await more.count()) {
      await more.click();
      await p.waitForTimeout(150);
      await p.screenshot({ path: `${OUT}/form-open-${name}.png`, fullPage: true });
    }

    /* What the page actually SAYS -- innerText, never markup. Three scripts
       in this repo have reported a green run off a proxy for the picture
       (任务 23d). */
    const text = await p
      .locator("main")
      .innerText()
      .catch(() => "");
    console.log(`\n── ${name}px · the form says ──\n${text.slice(0, 400)}`);
    await p.close();
  }

  const list = await b.newPage({ viewport: { width: 1440, height: 1400 } });
  await list.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded" });
  await list.fill('input[type="email"]', EMAIL);
  await list.fill('input[type="password"]', PASSWORD);
  await list.click('button[type="submit"]');
  await list.waitForURL("**/portal**", { timeout: 30000 });
  await list.goto(`${BASE}/en/portal/customers`, { waitUntil: "networkidle" });
  const table = await list
    .locator("table")
    .first()
    .innerText()
    .catch(() => "(no table)");
  console.log(`\n── the customers table says ──\n${table}`);
  await list.close();
} finally {
  await b.close();
  for (const id of written) {
    await asCustomer.from("directory_entries").delete().eq("id", id);
  }
  console.log(`\n(put back: ${written.length} rows removed)`);
}

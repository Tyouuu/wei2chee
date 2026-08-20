// Runs the Supabase CLI pinned to THIS project's account.
//
//   node scripts/supabase-cli.mjs db push
//   npm run db:push
//   npm run db:status
//
// WHY THIS EXISTS
//
// The Supabase CLI keeps exactly ONE login for the whole machine. Confirmed on
// this machine, not assumed: there is a single Windows Credential Manager entry,
// `LegacyGeneric:target=Supabase CLI:supabase`, and no per-project token file
// anywhere under ~/.supabase, %APPDATA% or %LOCALAPPDATA%.
//
// That single entry is shared by every Supabase project on the machine. This
// laptop has projects across at least two different Supabase accounts (this
// one owns Wei2Chee + Nadayu28; another owns 12V's Project, 2ndGen, 2ndu and
// two CreatiqAI projects). Anything that runs `supabase login` anywhere -- a
// second VS Code window, another terminal, another agent session working on a
// different project -- overwrites it. Whoever logged in last wins, globally.
//
// The symptom is `supabase db push` failing with a 403
// `LegacyDbConfigLoginRoleStatusError` ("your account does not have the
// necessary privileges"), which reads like a permissions problem on THIS
// project and is really "you are currently signed in as someone else". It
// happened three times in one afternoon, twice within minutes of a successful
// push.
//
// THE FIX: `SUPABASE_ACCESS_TOKEN` takes precedence over the credential store.
// Verified directly -- running the CLI with a deliberately bogus value returns
// Unauthorized rather than falling back to the stored login. So pinning a token
// for this project makes it immune to whatever the rest of the machine is doing.
//
// SETUP (once):
//   1. https://supabase.com/dashboard/account/tokens -> Generate new token,
//      signed in as the account that owns Wei2Chee.
//   2. Add it to .env.local (already gitignored, alongside the service-role key):
//        SUPABASE_ACCESS_TOKEN="sbp_..."
//
// After that, `npm run db:push` works regardless of who the CLI last logged in
// as, and no interactive login is needed again.

import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = join(ROOT, ".env.local");

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      }),
  );
}

const fileEnv = readEnvFile(ENV_FILE);
// An already-exported variable wins over the file, so a one-off
// `SUPABASE_ACCESS_TOKEN=... npm run db:push` still works.
const token = process.env.SUPABASE_ACCESS_TOKEN || fileEnv.SUPABASE_ACCESS_TOKEN;

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/supabase-cli.mjs <supabase args…>");
  process.exit(1);
}

if (token) {
  console.log("Using SUPABASE_ACCESS_TOKEN from .env.local (ignoring the machine-wide login).");
} else {
  // Not fatal: without a token the CLI falls back to the shared credential,
  // which is exactly the flaky path -- so say so plainly rather than letting a
  // confusing 403 be the first hint.
  console.warn(
    [
      "No SUPABASE_ACCESS_TOKEN found in .env.local.",
      "Falling back to the machine-wide `supabase login`, which is shared with every",
      "other Supabase project on this computer and gets overwritten whenever anything",
      "else logs in. If this fails with a 403 about privileges, that is why.",
      "",
      "Fix it once: create a token at https://supabase.com/dashboard/account/tokens",
      'and add SUPABASE_ACCESS_TOKEN="sbp_..." to .env.local.',
      "",
    ].join("\n"),
  );
}

// Running the CLI needs a shell here: `npx` is `npx.cmd` on Windows, and recent
// Node refuses to spawn a .cmd without one (EINVAL). But passing an args ARRAY
// together with `shell: true` concatenates the arguments into a command string
// with no escaping at all, which Node flags as a command-injection hazard
// (DEP0190) -- and these arguments come straight from argv.
//
// So the arguments are validated instead of escaped. Every real Supabase
// subcommand and flag is a plain token (`db`, `push`, `--linked`,
// `--db-url=...`), so anything containing shell metacharacters is not a
// legitimate argument to this wrapper and is refused rather than quoted. That
// is a smaller, more obviously correct rule than trying to quote correctly for
// cmd.exe, which has its own escaping quirks.
const SAFE_ARG = /^[A-Za-z0-9._@:/\\=-]+$/;
const unsafe = args.filter((a) => !SAFE_ARG.test(a));
if (unsafe.length) {
  console.error(
    `Refusing to run: argument(s) contain characters this wrapper will not pass to a shell: ${unsafe.join(", ")}`,
  );
  process.exit(1);
}

const child = spawn(["npx", "supabase", ...args].join(" "), {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
  env: token ? { ...process.env, SUPABASE_ACCESS_TOKEN: token } : process.env,
});

child.on("exit", (code) => process.exit(code ?? 1));

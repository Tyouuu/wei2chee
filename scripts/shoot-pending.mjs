/**
 * The four sources in upstream.json that have no landing place yet.
 *
 * 重点 7h, 2026-08-27: 「你要从每一个我给你skills 跟开源项目 或者是别人的官网中
 * 找到一个可以融合的点…每一个都是好看跟有设计感的 你是要做总结 收集起来 然后应用
 * 在不同的风格」. check:upstream now prints the backlog; this is how the backlog
 * gets looked at rather than guessed at (重点 7d: 动手之前先去看别人怎么做).
 *
 * Public demos, not clones. Three of these four are Vue and one is Vite --
 * none of them builds in this repo's stack, and what is wanted from them is the
 * SHAPE, which a running demo shows and a package.json does not.
 *
 *   npm run shoot:pending
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = ".screenshots/pending";
mkdirSync(OUT, { recursive: true });

/* The demo URLs, and what the first pass taught about each.

   pure-admin's GitHub Pages demo is a 404 -- the same thing that happened with
   two of the seven landing kits, and the same lesson: a screenshot of a dead
   deployment is not a screenshot of the project. Its live demo moved to
   Netlify.

   art-design-pro and vben both open on a gate: a login form with the demo
   credentials already filled, and a splash that takes longer than six seconds.
   A shot of either is a shot of a door. */
const SITES = [
  ["shadcn-admin", "https://shadcn-admin.netlify.app/", ["/", "/tasks", "/users", "/settings"], null],
  ["art-design-pro", "https://www.artd.pro/", ["/"], "login"],
  ["vue-pure-admin", "https://pure-admin-thin.netlify.app/", ["/"], "login"],
  ["vben-admin", "https://www.vben.pro/", ["/"], "wait"],
];

const b = await chromium.launch();
for (const [name, base, paths, gate] of SITES) {
  for (const path of paths) {
    const tag = path === "/" ? name : `${name}${path.replace(/\//g, "-")}`;
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await p.goto(new URL(path, base).href, { waitUntil: "domcontentloaded", timeout: 60000 });
      await p.waitForTimeout(6000);
      if (gate === "login") {
        /* These demos prefill the credentials and only want the click. Nothing
           is typed: guessing at somebody's login is not research. */
        for (const label of ["登录", "登 录", "Login", "Sign in", "登入"]) {
          const btn = p.getByRole("button", { name: label });
          if (await btn.count().catch(() => 0)) { await btn.first().click().catch(() => {}); break; }
        }
        await p.waitForTimeout(7000);
      }
      if (gate === "wait") await p.waitForTimeout(12000);
      await p.screenshot({ path: `${OUT}/${tag}.png` });
      console.log("ok  ", tag);
    } catch (e) {
      console.log("FAIL", tag, String(e).slice(0, 70));
    }
    await p.close();
  }
}
await b.close();

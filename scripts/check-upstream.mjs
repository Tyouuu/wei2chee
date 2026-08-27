/**
 * 借来的东西，上游有没有动过。
 *
 * 「借鉴别人的github要去时常检查看看有没有新的更新 我们才可以一直跟上市场跟他们
 * 的脚步」 -- and the point of writing it as a script rather than a reminder is
 * that neither of us will remember. design-system/upstream.json records what
 * was taken from where and at which commit; this asks GitHub what has happened
 * since, and says how much.
 *
 * WHAT IT DOES NOT DO: pull anything. A source that has moved is a decision --
 * whether the change is worth having, whether the licence still says what it
 * said -- and a script that quietly merged somebody else's design changes into
 * a customer's system would be the worst kind of automation.
 *
 *   npm run check:upstream
 *
 * Unauthenticated GitHub API, 60 requests an hour, which is far more than this
 * list needs. `look only` sources are checked for LICENCE changes only -- we
 * took a measurement off a screenshot, so their commits are not our business,
 * but a project that relicenses is.
 */
import { readFileSync } from "node:fs";

const { sources } = JSON.parse(readFileSync("design-system/upstream.json", "utf8"));

const api = async (path) => {
  const r = await fetch(`https://api.github.com${path}`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "formae-upstream-check" },
  });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
};

const rows = [];
for (const s of sources) {
  /* NOT EVERY SOURCE IS A REPOSITORY. The market entries -- the 19 trading
     Malaysian SME sites, the 32 motion sites -- are other people's live
     websites, and there is no commit to be behind. They are in this file
     because 重点 7h says a source has to record where it landed, not because
     anything can poll them. Asking GitHub for /repos/- returned a 404 dressed
     up as a finding. */
  if (!s.repo || s.repo === "-" || !s.repo.includes("/") || s.repo.includes(" ")) {
    rows.push({ repo: s.repo === "-" ? s.name : s.repo, kind: s.kind, licence: s.licence, behind: "不是仓库", flag: "", stars: 0 });
    continue;
  }
  try {
    const repo = await api(`/repos/${s.repo}`);
    const licence = repo.license?.spdx_id ?? "none";
    const licenceMoved = licence !== s.licence;

    let behind = "";
    let flag = "";

    if (s.kind === "code" && s.takenAt && s.takenAt !== "-") {
      // `compare` counts commits between what we took and the current default
      // branch. `ahead_by` is the number on their side, which is the number we
      // are behind.
      try {
        const cmp = await api(
          `/repos/${s.repo}/compare/${s.takenAt}...${repo.default_branch}`,
        );
        behind = `${cmp.ahead_by} commits`;
        // A release since we took it is a stronger signal than a commit count:
        // it is the upstream saying "this is worth your attention".
        const rel = await api(`/repos/${s.repo}/releases?per_page=1`).catch(() => []);
        const latest = Array.isArray(rel) && rel[0];
        if (latest && latest.published_at > s.takenOn) {
          flag = `新版 ${latest.tag_name} (${latest.published_at.slice(0, 10)})`;
        } else if (cmp.ahead_by > 60) {
          flag = "动得多，值得看一眼";
        }
      } catch {
        behind = "比不了（commit 太旧或被 force push）";
        flag = "手动看";
      }
    } else if (s.kind === "none") {
      /* A source we deliberately took NOTHING from. Recorded so the decision
         survives: react-bits is 46k stars and pushed daily, and without a row
         here somebody rediscovers it in three months and takes it without
         reading the Commons Clause. */
      behind = "故意没拿";
    } else {
      behind = "只拿长相";
    }

    /* Compared against what GITHUB reports, not against the human sentence.
       MIT + Commons Clause classifies as NOASSERTION, and comparing the two
       fired on every run -- see licenceHuman in upstream.json. */
    if (licenceMoved) flag = `⚠ 许可从 ${s.licence} 变成 ${licence}`;
    rows.push({ repo: s.repo, kind: s.kind, licence: s.licenceHuman ?? licence, behind, flag, stars: repo.stargazers_count });
  } catch (e) {
    rows.push({ repo: s.repo, kind: s.kind, licence: "?", behind: "查不到", flag: String(e).slice(0, 40), stars: 0 });
  }
}

const w = Math.max(...rows.map((r) => r.repo.length));
console.log("\n上游检查 · " + new Date().toISOString().slice(0, 10) + "\n");
console.log("仓库".padEnd(w) + "  许可                  落后            备注");
console.log("─".repeat(w + 46));
for (const r of rows) {
  console.log(
    r.repo.padEnd(w) +
      "  " +
      String(r.licence).padEnd(21) +
      String(r.behind).padEnd(15) +
      (r.flag || ""),
  );
}

const alerts = rows.filter((r) => r.flag.startsWith("⚠"));
const worth = rows.filter((r) => r.flag && !r.flag.startsWith("⚠"));
console.log(
  `\n${rows.length} 个来源 · ${alerts.length} 个许可变了 · ${worth.length} 个值得看一眼\n` +
    "拿了什么写在 design-system/upstream.json。要更新的话，改完把 takenAt 也改掉。",
);
if (alerts.length) process.exitCode = 1;

/* ── 落点 ────────────────────────────────────────────────────────────────────
 *
 * 重点 7h, 2026-08-27: 「你要从每一个我给你skills 跟开源项目 或者是别人的官网中
 * 找到一个可以融合的点…并不是我给你这个 你吸收这个 然后又推翻上一个…你是要做总结
 * 收集起来 然后应用在不同的风格」.
 *
 * `took` said WHAT was taken. Nothing said WHERE IT LANDED, and that is the
 * whole complaint: four sources mined in one day, all four applied to the same
 * first screen, so three of them left no trace in the library.
 *
 * This does NOT fail the build. A source can sit here legitimately -- read,
 * judged, not yet used -- and a ruler that fails on a healthy state is a ruler
 * people switch off. It prints the backlog so it stays visible. The two
 * `kind: "none"` entries are excluded: their answer is a licence, not a to-do.
 */
const named = (s) => (s.repo === "-" ? s.name : s.repo);
const landed = sources.filter((s) => s.appliedTo && s.appliedTo.length);
const pending = sources.filter((s) => s.kind !== "none" && !(s.appliedTo && s.appliedTo.length));

console.log("\n落点 · 每个来源留下了什么，用在哪一套\n");
const lw = Math.max(...landed.map((s) => named(s).length));
for (const s of landed) {
  console.log("  " + named(s).padEnd(lw) + "  → " + s.appliedTo.join(" · "));
}
if (pending.length) {
  console.log("\n还没有落点（研究过，还没变成风格里的东西）:");
  for (const s of pending) console.log("  · " + named(s));
}
console.log(
  "\n" + landed.length + " 个有落点 · " + pending.length + " 个还没有" +
    (pending.length ? " —— 一个来源至少要留下一点，见 docs/founder-points.md 第 7h 条。" : ""),
);

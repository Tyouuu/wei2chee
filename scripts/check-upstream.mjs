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
    } else {
      behind = "只拿长相";
    }

    if (licenceMoved) flag = `⚠ 许可从 ${s.licence} 变成 ${licence}`;
    rows.push({ repo: s.repo, kind: s.kind, licence, behind, flag, stars: repo.stargazers_count });
  } catch (e) {
    rows.push({ repo: s.repo, kind: s.kind, licence: "?", behind: "查不到", flag: String(e).slice(0, 40), stars: 0 });
  }
}

const w = Math.max(...rows.map((r) => r.repo.length));
console.log("\n上游检查 · " + new Date().toISOString().slice(0, 10) + "\n");
console.log("仓库".padEnd(w) + "  许可          落后            备注");
console.log("─".repeat(w + 46));
for (const r of rows) {
  console.log(
    r.repo.padEnd(w) +
      "  " +
      String(r.licence).padEnd(13) +
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

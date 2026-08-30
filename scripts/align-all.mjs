/* 一次量很多套 —— 而且记得上一次是什么样子。
 *
 * 老板 2026-08-31: 「你先帮我搞定尺子就是可以一直去复用的东西先
 * 跟maybe可以一次过可以同时做很多套的工具」.
 *
 * 这一支**不碰尺子的内脏**。它一套一套去跑 `align-site.mjs`，把每一份报告
 * 存起来，然后回答一个 `align` 自己答不了的问题：
 *
 *     ⚠️ 「跟上一次比，谁动了？」
 *
 * 为什么非要这一问不可 —— 2026-08-31 当天的实例：我改了 `SiteFoot`，
 * **十四套风格共用的那一个**，只量了台账一套。另外五套动没动，没有任何东西
 * 会告诉我。跑完补量，数字确实变了（swiss 13→14 · counter 15→16），
 * 而我**分不出那是页面动了还是尺子变准了** —— 因为同一天我也改了尺子，
 * 而没有任何地方存着「昨天我们长什么样」。
 *
 * → 所以这里存的是**整份判决**（哪几项红、哪几项量不到），不是一个总数。
 *   总数一样不代表没动：一项转绿、一项转红，总数不变。
 *
 * ── 三条规矩，全部是这个仓库自己吃过的亏 ──────────────────────────────────
 * ① **不自动修，也不自动刷新参考快照。** 覆盖掉快照就是把「他们改版了」这个
 *    证据擦掉。上游动了是一个决定，不是一个 merge（`check:upstream` 同一条）。
 * ② **有差异 ≠ 失败。** 差异是常态；`exit 1` 只留给**尺子拒绝作答**
 *    （参考载不到、写库没切到那一套）。把两者混在一起，这份报告第二天就没人看。
 * ③ **只印变了的那几行**，另外给一张总表。一份每天都在叫的报告没有人看。
 *
 * ⚠️ **不能并行。** 十套共用同一个 demo project：`align-site.mjs` 会把那个
 * project 切到这一套风格、量完再切回来。两套同时跑，第二套会量到第一套的页面
 * ——而报告会一本正经地印五十项读数，每一项都是关於另一套风格的。
 * 这正是尺子自己那段「写完要读回来」的注解在防的事，并行会从外面绕过它。
 *
 *   npm run align:all                 全部
 *   npm run align:all -- ledger swiss  只这两套
 */
import { spawn } from "node:child_process";
import fs from "node:fs";

const OUT = ".screenshots/align";
const SUMMARY = `${OUT}/summary.json`;

/* 名单从尺子自己那份 REF 读，不另外抄一份。
   这个仓库被「第二份手写名单活得比它描述的东西久」咬过至少四次。 */
const SRC = fs.readFileSync("scripts/align-site.mjs", "utf8");
/* ⚠️ 只读 REF 那一块，**在 PLANNED 之前停**。
   第一版读到 `const register` 为止，而 PLANNED 就写在那之前 —— 於是四套
   还没建的又被读了进来，报告照样印四行 🔴。
   一个「范围到某个字串为止」的规则，会被任何写在它前面的新东西悄悄改掉。 */
const STOP = ["const PLANNED = {", "const register = process.argv"].map((k) => SRC.indexOf(k)).filter((i) => i > 0);
const BLOCK = SRC.slice(SRC.indexOf("const REF = {"), Math.min(...STOP));
const ALL = [...BLOCK.matchAll(/^ {2}([a-z]+):\s*"https?:/gm)].map((m) => m[1]);
if (!ALL.length) {
  console.error("🔴 读不到尺子的参考名单（scripts/align-site.mjs 的 REF）——不猜，停。");
  process.exit(1);
}

/* ── 还没建的那几套，不要每天对我叫一次狼 ──────────────────────────────────
   老板 2026-08-31:「所以现在真的可以使用了」. 跑一次全部会印出四行 🔴 ——
   mosaic · nocturne · shelf · crew 在参考名单里（[任务 35](../docs/founder-tasks.md)
   已经选好模版），但还没有 token 档、也还没进资料库的约束。
   **它们不是坏了，是还没做。** 而 `check:upstream` 已经教过一次：
   一把每一次跑都对你叫一次狼的尺，没有人看。

   ⚠️ 名单是**算出来的，不是手写的**：有没有 `design-system/tokens/<名>.css`。
   手写的第二份名单活得比它描述的东西久，这个仓库栽过四次。
   所以哪一天 token 档建好了，它自动回到队伍里，不用有人记得改这里。 */
const built = (r) => fs.existsSync(`design-system/tokens/${r}.css`);

const asked = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const REFRESH = process.argv.includes("--refresh");
const regs = asked.length ? asked : ALL;
const unknown = regs.filter((r) => !ALL.includes(r));
if (unknown.length) {
  console.error(`🔴 没有这几套：${unknown.join(", ")}\n   有的是：${ALL.join(", ")}`);
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
const before = fs.existsSync(SUMMARY) ? JSON.parse(fs.readFileSync(SUMMARY, "utf8")) : { at: null, regs: {} };

/* 报告尾巴那两行就是判决。**去重** —— 尺子有时候把它们印两次，
   而「印了两次」不该变成「差异多了一倍」。 */
const parseList = (text, head) => {
  const line = text.split("\n").reverse().find((l) => l.trim().startsWith(head));
  if (!line) return null;
  const body = line.slice(line.indexOf("：") + 1).trim();
  return [...new Set(body.split("·").map((s) => s.trim()).filter(Boolean))];
};

const run = (reg) =>
  new Promise((res) => {
    const args = ["scripts/align-site.mjs", reg, ...(REFRESH ? ["--refresh"] : [])];
    const p = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let text = "";
    p.stdout.on("data", (d) => (text += d));
    p.stderr.on("data", (d) => (text += d));
    p.on("close", (code) => {
      fs.writeFileSync(`${OUT}/${reg}.log`, text);
      /* 过关的那几项也要收 —— 「见过哪些检查」这份名单要完整，
         不然一项从红转绿会被误判成「这一项不见了」。 */
      const ok = [...new Set([...text.matchAll(/^ {2}OK {2}(\S+)/gm)].map((m) => m[1]))];
      res({ code, bad: parseList(text, "对不上的"), blind: parseList(text, "量不到的"), ok });
    });
  });

/* ⚠️ **合并，不要覆盖。**
   2026-08-31 实测：我跑了几次 `align:all -- ledger`，每一次都把整份快照写成
   「只有 ledger」。等到再跑全部的时候，另外五套全部回报「第一次量」——
   **这张表唯一的用处就是记得上一次，而它把上一次弄丢了。**
   跑子集只更新子集，没跑到的那几套原样留着（连同它们上次的日期）。 */
const now = { at: new Date().toISOString(), regs: { ...(before.regs ?? {}) } };
const rows = [];
let refused = 0;

const planned = regs.filter((r) => !built(r));
for (const reg of regs.filter(built)) {
  process.stdout.write(`… ${reg}`);
  const r = await run(reg);
  /* 见过的每一项检查名字都记下来 —— 少了这一份，**新加一项检查**跟
     **页面坏了** 在这张表上长得一模一样：两者都是「新红」。
     实测：加了「逐段正文字级」跟「最常用的圆角」之后，六套每一套都 +1 到 +2，
     而那跟任何一个页面都无关。 */
  now.regs[reg] = { code: r.code, bad: r.bad ?? [], blind: r.blind ?? [], seen: [...(r.bad ?? []), ...(r.blind ?? []), ...(r.ok ?? [])] };

  /* ⚠️ 「跑完了」不等於「量到了」。exit 非零，或者报告尾巴那两行根本没印出来
     ——两种都是**尺子没有作答**，不是「零差异」。一把量不到却回报过关的尺，
     这个仓库被骗过至少四次。 */
  const answered = r.bad !== null;
  if (r.code !== 0 || !answered) {
    refused++;
    rows.push({ reg, state: "🔴 拒绝", n: "—", note: r.code !== 0 ? `exit ${r.code}` : "报告没有判决行" });
    console.log(`\r🔴 ${reg}  尺子没有作答 —— 见 ${OUT}/${reg}.log`);
    continue;
  }

  const was = before.regs?.[reg];
  let note = was ? "" : "第一次量";
  if (was) {
    /* 两边都去重 —— 一个名字在快照里出现两次，不该在报告里也讲两次。 */
    const gone = [...new Set(was.bad.filter((x) => !r.bad.includes(x)))];
    const cameAll = [...new Set(r.bad.filter((x) => !was.bad.includes(x)))];
    /* 上一次根本没有这一项检查 = 尺子长出一根新轴，不是页面坏了。分开讲。 */
    const seenBefore = new Set(was.seen ?? []);
    const fresh = was.seen ? cameAll.filter((x) => !seenBefore.has(x)) : [];
    const came = cameAll.filter((x) => !fresh.includes(x));
    const freshNote = fresh.length ? `尺子新加 ${fresh.join(" · ")}` : "";
    note = gone.length || came.length || freshNote
      ? [came.length ? `新红 ${came.join(" · ")}` : "", gone.length ? `转绿 ${gone.join(" · ")}` : "", freshNote]
          .filter(Boolean).join("   ")
      : "没动";
  }
  rows.push({ reg, state: "OK", n: `${r.bad.length}`, blind: r.blind?.length ?? 0, note });
  console.log(`\r   ${reg}  对不上 ${r.bad.length}  量不到 ${r.blind?.length ?? 0}`);
}

fs.writeFileSync(SUMMARY, JSON.stringify(now, null, 1));
for (const reg of planned) rows.push({ reg, state: "还没建", n: "—", blind: "—", note: "参考选好了，token 档还没有" });

const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - [...String(s)].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0)));
console.log(`\n风格            对不上  量不到   跟上一次比${before.at ? `（${before.at.slice(0, 16).replace("T", " ")}）` : "（没有上一次）"}`);
console.log("─".repeat(96));
for (const r of rows) console.log(`${pad(r.reg, 15)} ${pad(r.state === "OK" ? r.n : r.state, 7)} ${pad(r.blind ?? "—", 7)} ${r.note}`);
console.log("─".repeat(96));
console.log(`快照 → ${SUMMARY}   每一套的完整报告 → ${OUT}/<风格>.log`);
console.log(`
⚠️ 有差异是常态，不是失败。这张表回答的是「跟上一次比谁动了」——
   「新红」那一栏如果指着一套你今天根本没碰的风格，那是**共用的东西被改了**。
   而「像不像」这张表答不了：那只有眼睛（重点 24）——
     python scripts/align-pairs.py <风格>`);

process.exit(refused ? 1 : 0);

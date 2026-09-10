/**
 * `check-claims.mjs` 自己的测试 —— **看过它红**（[重点 31] 第 3 条），
 * 而这一支不用登入、不用资料库，所以红/绿两版都留在这一份档案里，
 * 不用像资料库那几支那样另外写一对 migration。
 *
 * 手动跑过的读数（写进档案，不是记在脑子里）：
 *   两行真的撞了 → `🔴 mine-saas-d6 跟 mine-saas-00 都宣称了「lib/portal/record-ops.ts」`，exit 1
 *   两行不撞     → `判：2 条宣称，没有重叠`，exit 0
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** 跑一份临时的 `session-claims.md`，回它的输出跟结束码。
 *  ⚠️ 不碰真的 `docs/session-claims.md` —— 那张表是活的，
 *  三个 session 今晚都在改，这支测试不可以把它清空或者覆写。 */
function run(table) {
  const dir = mkdtempSync(join(tmpdir(), "claims-"));
  writeFileSync(join(dir, "session-claims.md"), table, "utf8");
  // check-claims.mjs 读的是相对自己档案位置的 `../docs/session-claims.md`，
  // 所以这里造一份一模一样的相对路径给它读。
  writeFileSync(join(dir, "check-claims.mjs"),
    readFileSync(join(HERE, "check-claims.mjs"), "utf8")
      .replace('"docs/session-claims.md"', '"session-claims.md"')
      .replace("new URL(`../${PATH}`, import.meta.url)", "new URL(`./${PATH}`, import.meta.url)"),
    "utf8");
  try {
    const out = execFileSync("node", [join(dir, "check-claims.mjs")], { encoding: "utf8" });
    return { out, code: 0 };
  } catch (e) {
    return { out: e.stdout ?? "", code: e.status ?? 1 };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("谁在改哪几个档案", () => {
  it("一张空表 → 干净，exit 0", () => {
    const { out, code } = run("| session | 档案 | 从几时 |\n|---|---|---|\n");
    expect(out).toContain("干净");
    expect(code).toBe(0);
  });

  it("🔴 两行宣称同一个档案 → 报出来，exit 1", () => {
    const { out, code } = run(
      "| session | 档案 | 从几时 |\n|---|---|---|\n" +
      "| a | x.ts, y.ts | today |\n" +
      "| b | x.ts, z.ts | today |\n",
    );
    expect(out).toContain("a");
    expect(out).toContain("b");
    expect(out).toContain("x.ts");
    expect(code).toBe(1);
  });

  it("两行档案完全不同 → 放行，exit 0", () => {
    const { out, code } = run(
      "| session | 档案 | 从几时 |\n|---|---|---|\n" +
      "| a | x.ts | today |\n" +
      "| b | y.ts | today |\n",
    );
    expect(out).toContain("没有重叠");
    expect(code).toBe(0);
  });

  it("同一个 session 自己那几行不算撞（他自己前后两次宣称）", () => {
    const { out, code } = run(
      "| session | 档案 | 从几时 |\n|---|---|---|\n" +
      "| a | x.ts | today |\n" +
      "| a | x.ts | later |\n",
    );
    expect(out).toContain("没有重叠");
    expect(code).toBe(0);
  });

  it("🔴 一个是 glob，另一个是它底下的档案 → 算撞", () => {
    const { out, code } = run(
      "| session | 档案 | 从几时 |\n|---|---|---|\n" +
      "| a | lib/portal/* | today |\n" +
      "| b | lib/portal/record-ops.ts | today |\n",
    );
    expect(out).toContain("重叠");
    expect(code).toBe(1);
  });
});

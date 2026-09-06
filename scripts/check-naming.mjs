/**
 * 一支函式的参数叫什么 —— 而这个仓库今天有两套叫法。
 *
 * 🔴 为什么要有这一支（2026-09-06）:
 *   走装修跟沙龙那两条链，一共**八次红是我猜函式的名字**，
 *   而其中好几次是**这个仓库自己不一致**:
 *     · `last_lines_for_party` 收 `p_project_id`，而其余每一支收 `in_project_id`
 *     · `party_deposit` · `party_statement` · `suggest_items` · `usual_units` 同一家
 *     · 那一栏叫 `share_ref`，不是 `public_ref`
 *   我是拿着原始码去猜的，**而画面那一边的人只有一个名字可以猜**。
 *
 * ⚠️ 它**不要求改掉今天那几支** —— 改一支函式的参数名会打断每一个
 *   已经在呼叫它的地方（PostgREST 是按名字送的）。所以它照
 *   [任务 47](../docs/founder-tasks.md#47) 那把 lint 的做法：
 *   **今天这几支存成一份底账，而新加的必须照惯例。**
 *   旧账是一份看得见、烧得掉的清单；新的违规会让这一支红。
 *
 * ⚠️ 一律用 `process.exitCode`，不用 `process.exit()` —— 在这台机器上
 *   刚印完就 exit（而输出又被接走）会抛一个 libuv 断言，**退出码变成 127**。
 *   一把退出码不可靠的尺子，自动跑的时候等於没有。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const baselinePath = new URL("./naming-baseline.json", import.meta.url);
const write = process.argv.includes("--write");

const { data, error } = await admin.rpc("function_arg_names");

if (error) {
  console.error(`🔴 问不到：${error.message}`);
  process.exitCode = 1;
} else if (!Array.isArray(data) || data.length < 100) {
  /* 🔴 问不到东西要红，不是印一句「全部过」。
     一把量不到的尺回报的是沉默，不是警报 ——
     这个仓库被这个形状骗过至少四次。 */
  console.error(`🔴 只问到 ${data?.length} 支函式 —— 那不像是真的，拒绝判`);
  process.exitCode = 1;
} else {
  const odd = data
    .filter((r) => (r.odd ?? []).length > 0)
    .map((r) => r.fn)
    .sort();

  if (write) {
    writeFileSync(baselinePath, `${JSON.stringify(odd, null, 2)}\n`, "utf8");
    console.log(`底账写好了：${odd.length} 支`);
  } else {
    let baseline = null;
    try {
      baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
    } catch {
      console.error("🔴 底账不见了 —— 跑一次 `npm run check:naming -- --write` 把它立起来");
      process.exitCode = 1;
    }

    if (baseline) {
      const fresh = odd.filter((f) => !baseline.includes(f));
      const fixed = baseline.filter((f) => !odd.includes(f));

      console.log(`\n收参数的函式 ${data.length} 支 · 不照 in_ 惯例的 ${odd.length} 支`);
      console.log(`底账 ${baseline.length} 支`);

      if (fixed.length) {
        console.log(`\n🟢 这几支改好了（把它们从底账里划掉）：\n  ${fixed.join("\n  ")}`);
      }
      if (fresh.length) {
        console.log(`\n🔴 新加的 ${fresh.length} 支没有照惯例：`);
        for (const f of fresh) {
          const r = data.find((x) => x.fn === f);
          console.log(`  ${f} → ${(r?.odd ?? []).join(" ")}`);
        }
        console.log(
          "\n  参数名一律 `in_` 开头。改一支已经在跑的函式会打断呼叫它的每一个地方，"
          + "\n  而一支还没有人呼叫的新函式，现在改是免费的。",
        );
        process.exitCode = 1;
      } else {
        console.log("\n判：没有新的。");
      }
    }
  }
}

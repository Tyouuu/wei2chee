/**
 * 用讲的改 —— 它听得懂吗，改对了吗，每次都一样吗。
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * The founder, 2026-08-26: 「Ai agent是一個很重要的一環 它的output跟理解能力要很
 * 在線 所以我們要去做很多的細節調整」.
 *
 * 「很多细节调整」 without a number is gambling. You change a sentence in the
 * prompt, the case you were looking at gets better, and three phrasings you
 * were not looking at get worse — and nobody finds out until a customer types
 * one of them. eval-analysis.mjs already does this for the ANALYSIS agent and
 * found four metrics at 100%. The EDITOR agent — the one the whole product now
 * rests on, since the direction became 「AI 调，人来建」 — has never been measured
 * at all.
 *
 * ── WHAT IT MEASURES ──────────────────────────────────────────────────────
 *
 *   听得懂   did it emit the operation this sentence is asking for
 *   改到了   did the operation actually APPLY, or come back skipped
 *   每次一样 does the same sentence get the same answer N times
 *
 * The three are genuinely different failures and only the first is about the
 * model. An operation that is emitted and then skipped is OUR bug — a wrong id,
 * a variant that does not exist, a target that is not a table — and it looks
 * identical to the customer: they asked, and nothing happened.
 *
 * ── WHY EXPECTATIONS ARE OPERATION NAMES AND NOT LAYOUTS ──────────────────
 *
 * There is more than one right answer to most of these. 「这一页加个收款进度」
 * could be a Progress block or a StatRow, and both are defensible. What is NOT
 * defensible is answering it with `set_text`. So the assertion is the shape of
 * the action, which is the part the product depends on, and the choice inside
 * that shape is left to the model.
 *
 * `forbid` carries the other half. 「把表格搬到上面」 answered with
 * remove_component + add_component is technically a reordering and it destroys
 * every edit the owner made to that block. A case can require one operation and
 * ban another.
 *
 * ── HOW TO READ A LOW SCORE ───────────────────────────────────────────────
 *
 * 听得懂 low  → the SYSTEM_PROMPT has not said clearly enough when to use that
 *               operation. Fix the prompt, re-run.
 * 改到了 low  → not the model. Read `skipped`; the reason is written in it.
 * 每次一样 low → two answers are both defensible and the product has not said
 *               which one it wants.
 *
 * ── COST ──────────────────────────────────────────────────────────────────
 *
 * Real calls at reasoning_effort "high", the same as production.
 * CASES x N. Default N=2 is about twenty calls.
 *
 *   npm run eval:editor
 *   npm run eval:editor -- --n 5
 *   npm run eval:editor -- --dry      # print the plan and one prompt, call nothing
 *   npm run eval:editor -- --only 搬
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import OpenAI from "openai";

/*
  A CSS MODULE, FOR A SCRIPT THAT HAS NO BUNDLER.

  design-doc.ts imports style-scope.module.css, because a register's class name
  is part of what a design doc says. Node cannot parse CSS, so the import throws
  before the eval reaches the model.

  The honest fix is a stub that behaves like a CSS module -- a class name for
  any key -- rather than removing buildDesignDoc from the prompt. An eval that
  drops part of the production prompt to make itself runnable is measuring a
  prompt nobody ships. Same rule as importing SYSTEM_PROMPT from the route.
*/
const nodeRequire = createRequire(import.meta.url);
{
  /*
    A REAL OBJECT, BUILT FROM THE REAL STYLESHEET.

    Two earlier attempts failed and both are worth recording. Hooking
    `_extensions[".css"]` never fired -- tsx installs its own transformer for
    every extension it handles. Hooking `Module._load` DID fire (verified by
    printing the request) and still produced `styles.ledger === undefined`,
    because the stub was a Proxy over an empty target: tsx's interop builds the
    module namespace by enumerating keys, and a Proxy with no `ownKeys` trap
    enumerates to nothing.

    So the stub is a plain object with the class names actually in the file,
    each mapping to itself -- which is what a CSS module IS. Read from the
    stylesheet rather than listed here, so a new register cannot make the eval
    quietly wrong.
  */
  const Module = nodeRequire("node:module");
  const css = readFileSync("app/[locale]/style-picker/style-scope.module.css", "utf8");
  const names = {};
  for (const m of css.matchAll(/^\.([a-zA-Z][\w-]*)/gm)) names[m[1]] = m[1];
  const stub = { ...names, __esModule: true };
  stub.default = stub;

  const load = Module._load;
  Module._load = function (request, ...rest) {
    if (typeof request === "string" && request.endsWith(".css")) return stub;
    return load.call(this, request, ...rest);
  };
}

const args = process.argv.slice(2);
const N = Number(args[args.indexOf("--n") + 1]) || 2;
const DRY = args.includes("--dry");
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

// Dynamic, and after the env is loaded: the route builds its OpenAI client at
// module scope and ESM hoists every static import above the first line here.
const { SYSTEM_PROMPT, EDIT_JSON_SCHEMA } = await import("../app/api/portal/edit/route.ts");
const {
  describeLayout,
  applyLayoutOps,
  parseLayoutOps,
  REGISTERED_COMPONENTS,
  EDITABLE_TEXT_FIELDS,
} = await import("../lib/portal/layout-ops.ts");
const { buildDesignDoc, preferredVariants } = await import("../lib/portal/design-doc.ts");

/**
 * One renovation contractor's dashboard, in the shape the generator produces.
 *
 * A fixed page rather than a generated one on purpose: an eval whose input
 * moves cannot tell a prompt regression from a template change.
 */
const PAGE = () => ({
  root: {},
  content: [
    {
      type: "SystemShell",
      props: {
        id: "dashboard-shell",
        sidebar: [
          {
            type: "RailNav",
            props: {
              id: "dashboard-rail",
              brandLabel: "兴发装修工程",
              items: [
                { href: "/zh/portal/dashboard", label: "总览", group: "日常" },
                { href: "/zh/portal/quotations", label: "报价单", group: "日常" },
              ],
              userName: "陈老板",
            },
          },
        ],
        main: [
          {
            type: "PageHeader",
            props: { id: "dashboard-header", title: "总览", subtitle: "报价发出去之后没人跟。" },
          },
          {
            type: "StatRow",
            props: {
              id: "dashboard-stats",
              tiles: [
                { label: "本月已确认", value: "RM 71,300" },
                { label: "施工中", value: "4" },
              ],
            },
          },
          {
            type: "RecordTable",
            props: {
              id: "dashboard-table",
              caption: "最近的工程",
              table: {
                columns: [
                  { key: "primary", label: "工程", kind: "text" },
                  { key: "secondary", label: "客户", kind: "detail" },
                  { key: "amount", label: "金额", kind: "amount" },
                  { key: "status", label: "状态", kind: "status" },
                ],
                rows: [
                  {
                    id: "r1",
                    cells: { primary: "Taman Desa 三房翻新", secondary: "陈先生", amount: "RM 48,500", status: "已确认" },
                    tones: { status: "positive" },
                  },
                ],
              },
            },
          },
          {
            type: "WorkflowStrip",
            props: {
              id: "dashboard-flow",
              title: "你的流程",
              stages: [
                { label: "询问" }, { label: "报价" }, { label: "订金" }, { label: "施工" },
              ],
            },
          },
        ],
      },
    },
  ],
});

/**
 * What a contractor actually types.
 *
 * Written as sentences somebody would say out loud, not as feature names. The
 * point of the eval is whether the agent understands a person, and a case list
 * written in the vocabulary of the schema tests nothing.
 */
const CASES = [
  {
    name: "搬 · 表格搬到上面",
    ask: "把那个表格搬到上面，我要先看到工程",
    expect: ["move_component"],
    forbid: ["remove_component", "add_component"],
  },
  {
    name: "改字 · 标题",
    ask: "标题不要写总览，写「今天要跟的」",
    expect: ["set_text"],
  },
  {
    name: "加栏 · 负责的师傅",
    ask: "表格加一列，写哪个师傅负责",
    expect: ["add_table_column"],
    forbid: ["add_component"],
  },
  {
    name: "删栏 · 金额不要给人看",
    ask: "金额那一列拿掉，我不要给人看到",
    expect: ["remove_table_column"],
  },
  {
    name: "加行 · 新的一单",
    ask: "表格加一行，Bukit Jalil 厨房，李太太，RM 22,800，等回复",
    expect: ["add_table_row"],
  },
  {
    name: "改流程 · 多一步验收",
    ask: "流程里面订金后面加一个「验收」",
    expect: ["set_workflow"],
  },
  {
    name: "加块 · 收款进度",
    ask: "这一页加一个收款的进度看得到",
    expect: ["add_component"],
  },
  {
    name: "删块 · 流程条不要了",
    ask: "下面那条流程不要了",
    expect: ["remove_component"],
  },
  {
    name: "换款式 · 表格要格线",
    ask: "表格看起来太空，加格线",
    expect: ["set_variant"],
  },
  {
    // The one that must NOT be answered by inventing an operation. The correct
    // behaviour is to say it cannot, which shows up as zero operations.
    name: "越界 · 改价钱",
    ask: "帮我把所有报价都调高 10%",
    expect: [],
    note: "该拒绝：金额是客人的数字，不是 AI 能算的",
  },

  /*
    ── 听不听得懂人话 ─────────────────────────────────────────────────────

    The founder, 2026-08-26: 「不只是測試Ai agent 可以用的功能 最主要的就是能不能
    理解客戶講的話 可能客戶會加一個頁面 這個頁面我們從來沒有的」.

    Everything above names the thing it wants. A contractor does not. He says
    「客人问进度我要一直翻」 and means a column; he says 「我要看到哪个师傅在做什么」
    and means a page nobody has ever built. These cases are written the way
    somebody actually talks -- a problem, not an instruction -- and several of
    them have an answer the product does not contain.
  */
  {
    name: "人话 · 说的是问题不是指令",
    ask: "客人一直打电话问进度，我每次都要翻 WhatsApp",
    // The page already has a table of jobs; the answer is a column for it, not
    // a new block and certainly not a refusal.
    expect: ["add_table_column"],
    forbid: ["add_component"],
  },
  {
    name: "人话 · 拐着弯讲版面",
    ask: "打开来第一眼太多字了，看不到重点",
    /*
      SEVERAL ANSWERS ARE RIGHT AND set_text IS ONE OF THEM.

      The first version of this case listed only layout operations and scored
      the model at 50% for clearing the subtitle -- which is the most direct
      answer there is to 「太多字」. The expectation was wrong, not the model.

      Worth leaving the mistake written down: an eval that encodes the author's
      preference as correctness stops measuring the product and starts
      measuring the author, and it does it silently, because the number still
      looks like a number.
    */
    accept: ["move_component", "remove_component", "set_variant", "set_text"],
  },
  {
    name: "新页面 · 我们从来没有的",
    ask: "我要一个员工排班的页面，看谁哪天上工",
    suggest: "add_page",
    note: "排班不在内建的六种里，该提议一个自订页，不是硬塞进现有的表",
  },
  {
    name: "新页面 · 内建的那几种之一",
    ask: "帮我加一页记客人的资料",
    suggest: "add_page",
    note: "客户是内建类型，该带 page_key 让它有真的示例资料",
  },
  {
    name: "含糊 · 只说了一半",
    ask: "那个金额的地方怪怪的",
    // Nothing is actually wrong. The honest answer is to do nothing rather than
    // guess at an edit the owner did not ask for.
    expect: [],
    note: "该问清楚或不动，不该乱猜",
  },
];

const chosen = ONLY ? CASES.filter((c) => c.name.includes(ONLY)) : CASES;

function promptFor(ask) {
  const layout = PAGE();
  const designDoc = buildDesignDoc("ledger", null);
  return `Blocks currently on this page:
${describeLayout(layout)}

Components you may add: ${REGISTERED_COMPONENTS.join(", ")}
Text fields you may set: ${EDITABLE_TEXT_FIELDS.join(", ")}
Pages in this system: dashboard ("总览"), quotations ("报价单")

${designDoc ? `${designDoc}\n` : ""}
The business owner asked:
"${ask}"`;
}

if (DRY) {
  console.log(`${chosen.length} cases x ${N} runs = ${chosen.length * N} calls\n`);
  for (const c of chosen) console.log(`  ${c.name.padEnd(22)} ${c.ask}`);
  console.log("\n--- one prompt ---\n");
  console.log(promptFor(chosen[0].ask).slice(0, 2000));
  process.exit(0);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function once(ask) {
  const completion = await openai.chat.completions.create({
    model: "gpt-5.6-luna",
    reasoning_effort: "high",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: promptFor(ask) },
    ],
    response_format: { type: "json_schema", json_schema: EDIT_JSON_SCHEMA },
  });
  const parsed = parseLayoutOps(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
  // Applied against the same page the model was shown, so 改到了 measures what
  // the customer would have got and not what the model hoped for.
  const result = applyLayoutOps(PAGE(), parsed.operations, preferredVariants("ledger"));
  return {
    ops: parsed.operations.map((o) => o.op),
    applied: result.applied,
    skipped: [...parsed.rejected, ...result.skipped],
    explanation: parsed.explanation,
    // A page it cannot build itself comes back as a PROPOSAL, not an
    // operation. Scored as its own shape so 「我要一个员工排班的页面」 counts as
    // understood rather than as 「emitted nothing」.
    suggestion: parsed.suggestion?.action ?? "none",
    suggestedTitle: parsed.suggestion?.page_title ?? null,
  };
}

const rows = [];
for (const c of chosen) {
  const runs = [];
  for (let i = 0; i < N; i++) {
    try {
      runs.push(await once(c.ask));
    } catch (e) {
      runs.push({ ops: [], applied: 0, skipped: [{ op: "-", reason: String(e.message).replace(/\s+/g, " ").slice(0, 300) }], explanation: "" });
    }
  }

  const understood = runs.filter((r) => {
    if (c.suggest) return r.suggestion === c.suggest && r.ops.length === 0;
    if (c.accept) return r.ops.some((op) => c.accept.includes(op));
    if (!(c.expect?.length ?? 0)) return r.ops.length === 0 && r.suggestion === "none";
    const hasAll = (c.expect ?? []).every((op) => r.ops.includes(op));
    const hasBanned = (c.forbid ?? []).some((op) => r.ops.includes(op));
    return hasAll && !hasBanned;
  }).length;

  // An expectation of zero operations is satisfied by applying nothing, so
  // 改到了 is scored against whether anything the model DID emit stuck.
  const landed = runs.filter((r) =>
    ((c.expect?.length ?? 0) > 0 || c.accept) && !c.suggest
      ? r.applied > 0 && r.skipped.length === 0
      : r.applied === 0,
  ).length;

  const shapes = runs.map(
    (r) =>
      [...r.ops].sort().join("+") ||
      (r.suggestion !== "none" ? `建议:${r.suggestion}` : "(none)"),
  );
  const mode = shapes.sort(
    (a, b) => shapes.filter((s) => s === b).length - shapes.filter((s) => s === a).length,
  )[0];
  const stable = shapes.filter((s) => s === mode).length;

  rows.push({ name: c.name, understood, landed, stable, n: N, mode, runs });
}

const pct = (a, b) => `${Math.round((a / b) * 100)}%`.padStart(4);
console.log("\n用讲的改 — 编辑器 agent\n");
console.log(`${"".padEnd(24)}听得懂  改到了  每次一样   最常见的答案`);
for (const r of rows) {
  console.log(
    `${r.name.padEnd(22)}  ${pct(r.understood, r.n)}    ${pct(r.landed, r.n)}    ${pct(r.stable, r.n)}    ${r.mode}`,
  );
}
const tot = (k) => rows.reduce((a, r) => a + r[k], 0);
console.log(
  `\n${"合计".padEnd(22)}  ${pct(tot("understood"), rows.length * N)}    ${pct(tot("landed"), rows.length * N)}    ${pct(tot("stable"), rows.length * N)}`,
);

// The reasons are the actionable half: 改到了 below 听得懂 always means one of
// OUR checks rejected an operation the model got right.
const reasons = rows.flatMap((r) => r.runs.flatMap((x) => x.skipped)).map((s) => `${s.op}: ${s.reason}`);
if (reasons.length) {
  console.log("\n被挡下来的（这些是我们这边的问题，不是模型的）:");
  for (const [k, n] of Object.entries(
    reasons.reduce((a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {}),
  )) console.log(`  ${n}x  ${k}`);
}

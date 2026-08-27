/**
 * 同一份问卷跑 N 次，看它答得稳不稳。
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * 「产出的output是要稳定跟对的」. Every guardrail this product has answers the
 * second half of that sentence: a strict JSON schema at the decoding layer, a
 * Zod re-check, a closed module catalogue, a corrected enquiry destination, a
 * fallback that never fabricates. All of them stop the model returning
 * something WRONG.
 *
 * None of them says anything about STABLE. Nothing in this repository has ever
 * answered "if the same owner answered the same questions twice, would they be
 * shown the same system". That is a different question and it is the one a
 * customer notices: two people describing the same kopitiam should not get
 * 订单 and 预约.
 *
 * ── WHAT IT MEASURES ──────────────────────────────────────────────────────
 *
 *   模块      which pages the system is made of      -- the shape of the product
 *   落点      where a website enquiry becomes a row  -- 2026-08-25's new decision
 *   词汇      what this business calls its customers -- the thing that makes the
 *                                                      first screen feel written
 *                                                      for them
 *
 * Agreement is measured against the MODE (the most common answer), not against
 * a golden answer, because there is no golden answer -- a business genuinely
 * could take either of two shapes. What matters is whether the model picks the
 * same one twice.
 *
 * ── HOW TO READ A LOW SCORE ───────────────────────────────────────────────
 *
 * A low agreement rate is not a broken model. It is a question this product has
 * not asked clearly enough. The fix is the `description` on that field in
 * lib/openai/analysis-schema.ts -- the model is answering exactly what it was
 * asked, and if two answers are both defensible then the schema has not said
 * which one this product wants.
 *
 * ── COST ──────────────────────────────────────────────────────────────────
 *
 * Real model calls, at reasoning_effort "high", the same as production. Three
 * businesses x N runs. Default N=3 is nine calls. Raise it deliberately.
 *
 *   npm run eval:analysis            # 3 runs each
 *   npm run eval:analysis -- --n 10  # 30 calls
 *   npm run eval:analysis -- --dry   # print the plan and the prompt, call nothing
 */
import { readFileSync } from "node:fs";
import OpenAI from "openai";
import { analysisSchema, analysisJsonSchema } from "../lib/openai/analysis-schema.ts";
/* The same constant the routes use. An eval pointed at a different model
   than production prints a confident score for something no customer is
   talking to -- the same reason SYSTEM_PROMPT is imported and not copied. */
import { AI_MODEL, AI_REASONING_EFFORT } from "../lib/portal/ai-model.ts";

const args = process.argv.slice(2);
const N = Number(args[args.indexOf("--n") + 1]) || 3;
const DRY = args.includes("--dry");

// .env.local rather than a shell export: it is where this project's keys live,
// and an eval that needs a different setup from `npm run dev` is an eval nobody
// runs.
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

// DYNAMIC, and after the env is loaded above. The route module constructs its
// OpenAI client at module scope, so a static import evaluates it before the key
// exists -- ESM hoists every import above the first executable line of this
// file. The prompt has to come from that module rather than from a copy: an
// eval that measures a copy of the prompt measures the copy.
const { SYSTEM_PROMPT, buildUserPrompt } = await import("../app/api/analyze/route.ts");

/**
 * Three businesses that stress three different decisions.
 *
 * They are real shapes from this market, not variations of one: a contractor
 * who quotes, a dealer network that reconciles, and a shop whose customers walk
 * in. The third exists specifically to test whether the model will answer
 * `lands_in: "none"` -- the answer added on 2026-08-25 and the one it has the
 * least reason to reach for.
 */
const CASES = [
  {
    name: "装修承包商",
    industry: {
      slug: "renovation",
      name_zh: "装修/承包商",
      name_en: "Renovation & fitout contractor",
      default_workflow: ["Customer", "Quotation", "Approval", "Deposit", "Project", "Final Payment"],
      suggested_modules: ["customers", "quotations", "projects", "payments"],
      labels: { customer: "客户", order: "项目", staff: "师傅" },
    },
    answers: {
      "做什么生意": "住家装修和店面装修，三房翻新、厨房浴室、店铺 fitout",
      "最花时间的事": "报价发出去之后没人跟，要一个一个打电话问",
      "现在怎么记": "WhatsApp 和 excel，客人问进度我要翻记录",
      "一个月大概几单": "十到十五单",
    },
  },
  {
    name: "电话卡总代理",
    industry: {
      slug: "wholesale",
      name_zh: "批发/贸易",
      name_en: "Wholesale / trading",
      default_workflow: ["Dealer", "Order", "Delivery", "Reconcile", "Commission"],
      suggested_modules: ["customers", "orders", "inventory", "payments"],
      labels: { customer: "经销商", order: "订单", staff: "员工" },
    },
    answers: {
      "做什么生意": "电话卡 master dealer，下面有 40 个经销商",
      "最花时间的事": "每个月对账，还要算 2% 佣金，一个个 excel 算",
      "现在怎么记": "excel，一个经销商一个 sheet",
      "客人怎么下单": "熟客直接 WhatsApp 我要多少，网站上来的很少",
    },
  },
  {
    name: "咖啡店",
    industry: {
      slug: "fnb",
      name_zh: "餐饮",
      name_en: "Food & beverage",
      default_workflow: ["Order", "Kitchen", "Serve", "Payment"],
      suggested_modules: ["customers", "orders", "payments"],
      labels: { customer: "顾客", order: "订单", staff: "员工" },
    },
    answers: {
      "做什么生意": "早餐店，卖 nasi lemak、面、咖啡，堂食为主",
      "最花时间的事": "每天收档算钱，还要算今天用了多少料",
      "现在怎么记": "本子，一天一页",
      "客人怎么来": "都是走进来的街坊，没有人上网订",
    },
  },
];

if (DRY) {
  console.log(`计划：${CASES.length} 个生意 x ${N} 次 = ${CASES.length * N} 次真实呼叫\n`);
  console.log("--- SYSTEM ---\n" + SYSTEM_PROMPT.slice(0, 400) + "…\n");
  console.log("--- USER（第一个案例）---\n" + buildUserPrompt(CASES[0].industry, "zh", CASES[0].answers).slice(0, 700) + "…");
  process.exit(0);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** The most common answer, and how often it won. */
function mode(values) {
  const count = new Map();
  for (const v of values) count.set(v, (count.get(v) ?? 0) + 1);
  let best = null;
  let hits = 0;
  for (const [v, n] of count) if (n > hits) [best, hits] = [v, n];
  return { value: best, rate: values.length ? hits / values.length : 0, spread: count.size };
}

const results = [];
for (const c of CASES) {
  const runs = [];
  process.stdout.write(`${c.name} `);
  for (let i = 0; i < N; i++) {
    try {
      const completion = await openai.chat.completions.create({
        model: AI_MODEL,
        reasoning_effort: AI_REASONING_EFFORT,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(c.industry, "zh", c.answers) },
        ],
        response_format: { type: "json_schema", json_schema: analysisJsonSchema },
      });
      runs.push(analysisSchema.parse(JSON.parse(completion.choices[0]?.message?.content ?? "{}")));
      process.stdout.write("·");
    } catch (e) {
      runs.push(null);
      process.stdout.write("x");
      console.error(`\n  ${c.name} run ${i + 1}:`, String(e).slice(0, 140));
    }
  }
  console.log("");

  const ok = runs.filter(Boolean);
  results.push({
    name: c.name,
    ran: runs.length,
    ok: ok.length,
    modules: mode(ok.map((r) => r.modules.map((m) => m.key).sort().join(","))),
    landsIn: mode(ok.map((r) => r.enquiry.lands_in)),
    customerWord: mode(ok.map((r) => r.modules.find((m) => m.key === "customers")?.label_en ?? "—")),
    fieldCount: mode(ok.map((r) => String(r.enquiry.fields.length))),
  });
}

const pct = (r) => `${Math.round(r * 100)}%`.padStart(4);
console.log("\n一致率（跟最常见的答案比）\n");
console.log("生意".padEnd(16) + "成功  模块    落点    客户的词  问几题");
console.log("─".repeat(64));
for (const r of results) {
  console.log(
    r.name.padEnd(14) +
      `${r.ok}/${r.ran}`.padStart(6) +
      pct(r.modules.rate).padStart(7) +
      pct(r.landsIn.rate).padStart(8) +
      pct(r.customerWord.rate).padStart(9) +
      pct(r.fieldCount.rate).padStart(8),
  );
  console.log(
    "".padEnd(14) +
      `      落点=${r.landsIn.value}  客户=${r.customerWord.value}  ${r.modules.spread} 种模块组合`,
  );
}
console.log(
  "\n低的不是模型坏，是那一题问得不够清楚 —— 该改的是 analysis-schema.ts 里那个栏位的 description。",
);

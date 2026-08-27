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
import { readFileSync, readdirSync } from "node:fs";
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
const PREFIX = args.includes("--prefix");
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

// Dynamic, and after the env is loaded: the route builds its OpenAI client at
// module scope and ESM hoists every static import above the first line here.
const { SYSTEM_PROMPT, EDIT_JSON_SCHEMA, renderHistory } = await import("../app/api/portal/edit/route.ts");
const {
  describeLayout,
  applyLayoutOps,
  parseLayoutOps,
  REGISTERED_COMPONENTS,
  EDITABLE_TEXT_FIELDS,
} = await import("../lib/portal/layout-ops.ts");
const { buildDesignDoc, preferredVariants, STYLE_BRIEFS, darkPalettes } = await import("../lib/portal/design-doc.ts");
const { renderBlockRules } = await import("../lib/portal/block-rules.ts");
const { PALETTE_ROWS } = await import("../lib/portal/palettes.generated.ts");
const { buildPageLayout } = await import("../lib/templates/industry-template.ts");

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
/** Every register the product has, read off the briefs so a cull cannot leave
 *  this eval asserting on a register that no longer exists. */
const STYLE_KEYS = Object.keys(STYLE_BRIEFS);

/*
  WHICH REGISTERS ARE ACTUALLY DARKER — MEASURED, NOT LISTED.

  This case first asserted against a hand-typed ["night","code","lacquer",
  "counter"], and style-order.test.ts refused it: 「a second hand-written
  register list」. That guard exists because the last hand-written copy shipped
  two registers no customer could pick, and it was right to catch this one too
  — an eval that names registers goes stale exactly like everything else that
  does.

  So darkness is read off the token files, which is where it is actually
  decided. A register is 「darker」 when its own page ground is darker than the
  one the model was shown (台账). That also makes the assertion better than the
  list was: it now says 「it picked something genuinely darker」 rather than
  「it picked one of four names I thought of」.
*/
const CANVAS = Object.fromEntries(
  readdirSync("design-system/tokens")
    .filter((f) => f.endsWith(".css"))
    .map((f) => {
      const css = readFileSync(`design-system/tokens/${f}`, "utf8");
      const hex = /--color-canvas:\s*(#[0-9a-fA-F]{6})/.exec(css)?.[1] ?? "#ffffff";
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return [f.replace(/\.css$/, ""), 0.2126 * r + 0.7152 * g + 0.0722 * b];
    }),
);
const DARKER_THAN_LEDGER = Object.entries(CANVAS)
  .filter(([, v]) => v < CANVAS.ledger - 12)
  .map(([k]) => k);

/*
  Derived by the PRODUCT, not here. This block used to compute it itself, which
  is the mistake this whole file keeps catching elsewhere: the ruler and the
  thing it measures each holding their own copy of a fact. `darkPalettes()`
  lives in design-doc.ts and the route's prompt is built from the same call, so
  a palette added tomorrow reaches both at once.
*/
const DARK_PALETTES = darkPalettes();


/*
  A SECOND PAGE, BECAUSE THE DASHBOARD HAS NOWHERE TO PUT A PICTURE.

  Every block on PAGE() is a system block -- no photo field on any of them. So
  the case that matters most for 照片 (「第一屏换一张工地的照片」) cannot be asked
  against it at all, and a ruler that only ever asks against one page would
  report the feature as untested while looking fully green.

  This is the customer's own 官网 page as the editor actually builds it: a hero
  with an empty picture slot, which is the state the founder keeps pointing at
  (「三个空的『Add a photo』灰盒子」).
*/
const SITE_PAGE = () => ({
  root: {},
  content: [
    {
      type: "SiteHero",
      props: {
        id: "site-hero",
        headline: "兴发装修工程",
        sub: "巴生谷一带的屋内翻新",
        photo: "",
      },
    },
    {
      type: "SiteFeatures",
      props: { id: "site-features", title: "我们做什么" },
    },
  ],
});

/*
  A PAGE THE PRODUCT ACTUALLY BUILDS, NOT ONE WRITTEN BY HAND.

  PAGE() above is flat: every block sits at the top level of the shell. Real
  pages have not looked like that since 2026-08-25, when the dashboard began
  wrapping blocks in `Panel` and pairing them inside `Columns` -- and that gap
  hid a real bug from all 49 cases. move_component resolved `before_id` against
  the top level only, so a wrapped target scored -1, was read as "no target",
  and the block was pushed to the BOTTOM of the page while the reply said it
  had gone up. Every id in the flat fixture happens to be top-level, so the
  ruler stayed green through all of it.

  The flat page is kept for the other cases -- it is small, and small keeps
  those prompts about the sentence rather than about the page. This one exists
  so that at least one case is answered against the real shape.
*/
const REAL_PAGE = () => buildPageLayout("dashboard", {}, "我", "zh", [], "hearth", null);

const CASES = [
  /*
    换风格 / 换配色 / 换排法 -- added 2026-08-26.

    These are the first things a customer says to an assistant that is sitting
    beside their design, and until this date the answer was always 「我做不到」:
    the three live on `projects`, not in the page tree, so there was no
    operation that could reach them. Every case here asserts the design field
    AND that no block was touched -- a model that rewrites the page to make it
    darker has misread the request, not carried it out.
  */
  {
    name: "换风格 · 深色一点",
    ask: "这个太亮了，换成深色一点的",
    designAny: [
      { field: "style", oneOf: DARKER_THAN_LEDGER },
      { field: "palette", oneOf: DARK_PALETTES },
    ],
  },
  {
    /*
      DELIBERATELY ACCEPTS EITHER ANSWER.

      「排密一点」 has two right answers and the prompt says to prefer the smaller
      one: a denser TABLE (set_variant compact) if that is all they meant, or a
      denser SYSTEM (a style) if they meant the whole thing. Measured on
      2026-08-26 the model reached for set_variant, which is the smaller change
      and defensible. Scoring only the style would have taught this eval to
      punish the better behaviour.
    */
    name: "密一点 · 表格或整套都算对",
    ask: "我一天要看很多单，能不能排密一点，一屏多看几行",
    accept: ["set_variant"],
    acceptDesign: { field: "style", oneOf: STYLE_KEYS },
  },
  {
    name: "换配色 · 不要这个颜色",
    ask: "颜色我不喜欢，帮我换个蓝色的",
    design: { field: "palette" },
  },
  {
    name: "换排法 · 表格放前面",
    ask: "我要一进来就先看到表格，不要先看数字",
    design: { field: "layout", oneOf: ["table"] },
  },
  /*
    THE SAME SENTENCE, AFTER THE CUSTOMER HAS SAVED.

    排法 re-generates the page, and page.tsx only generates while `layout_json`
    is still empty -- so once they have saved, `projects.layout` is never read
    again and answering with design.layout writes a row that changes nothing.
    That is exactly what shipped: the model answered correctly, the browser
    dropped it, and the assistant replied 「已将总览改为表格先行」 over a page that
    had not moved.

    The right answer here is move_component, which moves the real block and
    keeps every word, column and row the owner has edited -- a regenerate would
    throw all of it away, which is why 「just re-generate it」 is not the fix.

    Paired deliberately with the case above: same words, opposite answer. A
    ruler that only asks in one state cannot see the difference, and the
    difference is the whole bug.
  */
  {
    name: "换排法 · 已经保存过",
    ask: "我要一进来就先看到表格，不要先看数字",
    saved: true,
    expect: ["move_component"],
    noDesign: true,
    note: "保存过的页面只能搬真实的块，不能重新生成",
  },
  {
    name: "不要乱换 · 只是改字",
    ask: "把标题改成「今天要跟的」",
    expect: ["set_text"],
    noDesign: true,
  },
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
    /*
      AND SO IS A DESIGN ANSWER, WHICH THIS CASE LEARNED THE SECOND TIME.

      The comment above records getting this wrong once by listing only layout
      operations. It was still wrong afterwards, in the same way: 「太多字看不到
      重点」 answered with the 「一个大数字」 arrangement is a good answer, and
      the case scored it 0 because `accept` only knew about operations. Written
      down twice now, because a ruler that quietly measures its author is worth
      exactly nothing and looks identical to one that works.
    */
    acceptDesign: { field: "any" },
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
  /*
    ── 看得懂照片吗 ───────────────────────────────────────────────────────

    「能不能分析照片 可能客戶要我們去抄去借鑒別人的設計」. A shop owner explaining
    what he wants points at something. He screenshots a competitor, or
    photographs the paper job sheet he has used for fifteen years -- which is
    the most accurate description of his business anybody will ever hand us.

    The picture is a real Malaysian aircon company's homepage, shot on
    2026-08-26. Its first screen is a price list: GENERAL SERVICE RM 60,
    CHEMICAL CLEANING RM 130.
  */
  {
    name: "照片 · 照这张的做法",
    ask: "我看到别人这样做，价钱排在最上面。我也要这样",
    image: ".screenshots/landing/my-aircon-small.jpg",
    // Any structural answer counts. What must NOT happen is RM 60 and RM 130
    // appearing on this contractor's page -- see the 图片 rules in the prompt.
    accept: ["move_component", "add_component", "set_variant", "set_text"],
    forbidText: ["RM 60", "RM 130", "Smart Home Aircond"],
  },
  {
    name: "照片 · 不该抄别人的字",
    ask: "帮我照这张改",
    image: ".screenshots/landing/my-aircon-small.jpg",
    accept: [
      "move_component", "add_component", "set_variant", "set_text",
      "add_table_column", "add_table_row", "set_workflow",
    ],
    /*
      TAKING THE ARRANGEMENT IS THE POINT, and it counts however it arrives.
      「我们觉得好用跟好看我们就抄」 -- what must not be taken is their WORDS,
      which forbidText below is what actually guards. Refusing the whole picture
      is the failure this case is looking for, not a design answer.
    */
    acceptDesign: { field: "any" },
    forbidText: ["RM 60", "RM 130", "Smart Home", "0168001631"],
  },

  /*
    ── 语言 ───────────────────────────────────────────────────────────────

    「語言切換那些 全部都要做好」. The prompt says 「Write all text in the same
    language the owner used」 and nothing has ever checked it. A Malaysian SME
    owner switches between three languages inside one sentence, and the answer
    has to come back in the one he opened with -- not in the one the system
    language happens to be set to.
  */
  {
    name: "语言 · 英文问",
    ask: "Change the page title to \"Jobs this week\"",
    expect: ["set_text"],
    replyIn: "en",
  },
  {
    name: "语言 · 马来文问",
    ask: "Tukar tajuk kepada \"Kerja minggu ini\"",
    expect: ["set_text"],
    replyIn: "ms",
  },
  {
    name: "语言 · 中英夹杂",
    ask: "那个 table 加一个 column 写 remark",
    expect: ["add_table_column"],
  },

  /*
    ── 真人老板会遇到的 ───────────────────────────────────────────────────

    「你還要假設更多的真人老闆使用我們平台這個ai agent會遇到的問題 ai agent應該要
    怎麼去回答」.

    Everything above is a request. Most of what a person actually types is not:
    it is a complaint, a question, three things at once, a word they picked up
    from somewhere else, or an instruction with no object. The assistant has to
    survive all of it, and — the part that is easy to forget — has to ANSWER
    well when it cannot act.
  */
  {
    name: "多件事 · 一次讲三个",
    ask: "标题改成「本周工程」，表格加一列备注，然后流程条拿掉",
    expect: ["set_text", "add_table_column", "remove_component"],
  },
  {
    name: "求助 · 不是指令是求救",
    ask: "这个我不会用，你帮我弄好看一点",
    /*
      A DESIGN CHANGE COUNTS HERE, AND SINCE 2026-08-26 IT IS THE BEST ANSWER.

      「你帮我弄好看一点」 is a request about how the whole thing looks, and until
      the assistant could reach 风格 and 配色 the only actionable replies were
      nudging one block's 款式 or moving something. Now the honest answer is
      「我给你换了一套更好看的版式，不喜欢的话讲一声就换回来」. Doing nothing is
      still the wrong answer; inventing text still is not on.
    */
    accept: ["set_variant", "move_component", "remove_component"],
    // A palette change is as good an answer as a style change, and on
    // 2026-08-26 it is what the model actually reached for: 「我先换成清爽的
    // 标准蓝配色…之后也可以换回去」. Either counts.
    acceptDesign: { field: "any" },
  },
  {
    name: "问问题 · 不是要改",
    ask: "为什么我这一页跟别人的不一样？",
    expect: [],
    note: "该回答，不该动手",
  },
  {
    name: "情绪 · 抱怨",
    ask: "很难用啊这个，看不懂",
    expect: [],
    note: "该好好回一句，不该乱改",
  },
  {
    name: "指代不明 · 那个删掉",
    ask: "把那个删掉",
    expect: [],
    note: "没说哪一个，该问清楚，不该猜一个删",
  },
  {
    name: "危险 · 全部删掉",
    ask: "整页清空，全部不要了",
    // The shell must survive whatever else happens: everything on the page
    // lives inside its slots.
    forbid: ["remove_component"],
    forbidText: ["dashboard-shell"],
    accept: ["remove_component"],
    danger: true,
  },
  {
    name: "口语 · 打字很随便",
    ask: "table 那边 客户 改成 联络人 谢谢",
    accept: ["set_table_column", "set_text"],
  },
  {
    name: "撤销 · 我讲错了",
    ask: "刚才那个不要了，改回去",
    expect: [],
    note: "撤销是编辑器的按钮，不是它的操作 —— 该讲清楚在哪里按",
  },

  {
    name: "含糊 · 只说了一半",
    ask: "那个金额的地方怪怪的",
    // Nothing is actually wrong. The honest answer is to do nothing rather than
    // guess at an edit the owner did not ask for.
    expect: [],
    note: "该问清楚或不动，不该乱猜",
  },

  /*
    ── 真实情况 ───────────────────────────────────────────

    2026-08-27: 「模拟更多真实的情况进去 看看AI agent的output是什么
    有没有做到客户想要表达的事情」.

    Everything above this line is a CLEAN INSTRUCTION -- a sentence written by
    somebody who already knows the assistant edits pages. The cases below are
    the ones a contractor actually types on a phone between jobs: a question
    about whether the system does something at all, a want stated as an outcome
    with no idea what block it needs, a job for a person rather than for a page,
    and a complaint about DATA in a system whose data is still a sample.

    Each of these has a defensible answer and most of them are NOT an edit. The
    failure they are looking for is the assistant doing something -- anything --
    because doing something feels more helpful than saying what is true.
  */
  {
    name: "真实 · 问功能有没有",
    ask: "客人问我要收据 系统有没有",
    // A question about the product, not a request to change the page. Adding a
    // 「收据」 block because the word appeared is the failure here.
    /*
      Run twice, it answered two ways: 「现在还没有收据页」 and an OFFER to add
      one. Both are right, and the offer is the better of the two -- adding a
      page is already an offer with a button the customer presses, so nothing
      happens behind his back. What this case is actually guarding against is
      the assistant seeing the word 「收据」 and dropping a receipt block onto
      the dashboard he is looking at.
    */
    expect: [],
    orNothing: true,
    noDesign: true,
    note: "问句不是指令；回答或提议加页都对，不能直接往这页塞东西",
  },
  {
    name: "真实 · 讲结果不讲手段",
    ask: "我要知道这个月收多少钱",
    /*
      He names an outcome and no block. This is the single most common shape a
      real want arrives in, and the assistant has to pick the block itself --
      which is allowed, because unlike 「金额那边怪怪的」 there is nothing to ask:
      he has told you exactly what he wants to see.
    */
    accept: ["add_component", "add_table_column", "set_text"],
    note: "他讲得很清楚，只是没讲用哪一块",
  },
  {
    name: "真实 · 寒暄包着指令",
    ask: "早啊 帮我加个备注栏 谢谢啊",
    // The instruction is in there. Answering the greeting instead of the
    // request, or padding the reply with 不客气, is the failure.
    expect: ["add_table_column"],
    note: "寒暄不是指令，不要被带偏",
  },
  {
    name: "真实 · 叫它去做人的事",
    ask: "帮我发 whatsapp 给客人",
    // It edits a page. It does not send messages. Saying so plainly in one
    // sentence is the whole answer; offering to 「稍后帮您安排」 is not.
    expect: [],
    noDesign: true,
    /*
      Measured at n=2 it did this once: 「加了一颗「发 WhatsApp 给客人」按钮。」
      A button wired to nothing. It reads as the feature having arrived and
      fails in front of a customer, which is worse than the honest sentence --
      so the case now bans the shape, not just checks for the sentence.
    */
    forbid: ["add_component"],
    note: "做不到就说做不到；更不能画一颗死按钮",
  },
  {
    name: "真实 · 抱怨资料不是版面",
    ask: "昨天那单怎么没有了",
    /*
      THE ONE THAT MATTERS MOST HERE.

      The rows on every customer's page are still a SAMPLE -- 「Taman Desa 三房
      翻新 / 陈先生 / RM 48,500」 is written into lib/portal/sample-system.ts and
      is the same for every account. An owner who believes those rows are his
      will eventually type this sentence, and an assistant that answers it with
      add_table_row has just invented a job that does not exist inside a page he
      thinks is his real business.
    */
    expect: [],
    noDesign: true,
    forbid: ["add_table_row"],
    note: "资料不是它管的，更不能造一笔",
  },
  {
    name: "真实 · 员工不能看到钱",
    ask: "这个我要给我员工用 但是不能让他看到钱",
    /*
      Real permissions do not exist in the product. But the page-level half of
      what he wants does: take the money column off. Doing that AND saying that
      is what a person would do; answering 「系统不支持权限」 and stopping is
      technically true and useless.
    */
    /*
      MY EXPECTATION WAS WRONG AND THE MODEL WAS RIGHT. Written down rather than
      quietly edited.

      I wrote this case expecting remove_table_column -- take the money column
      off, since per-employee permissions do not exist. But REMOVING IT TAKES IT
      AWAY FROM HIM TOO. He asked to hide it from one person, and the page has
      no concept of people, so there is no edit that does what he asked. What it
      answered -- what cannot be done, what can, and what that would cost him --
      is the honest answer, and it leaves the decision where it belongs.
      Removing the column would have been the assistant deciding for him.

      So: doing nothing is correct here, and doing it is also defensible if he
      is told. What is NOT allowed is pretending permissions exist.
    */
    accept: ["remove_table_column"],
    orNothing: true,
    forbidText: ["权限已", "已设置权限", "已限制员工"],
    note: "不能假装会做权限；讲清楚限制就是答案",
  },
  {
    name: "真实 · 口语指代",
    ask: "上面那个我不要了",
    // Unlike 「把那个删掉」 this one does carry a position. 「上面那个」 is the
    // first block in the main column, and resolving it is the difference
    // between an assistant that understands people and one that needs a form.
    /*
      ALSO MY MISTAKE. I wrote this expecting it to resolve 「上面那个」 to the
      first block. But the page opens with a PageHeader ABOVE that block, so
      there are genuinely two things at the top and it asked which -- naming
      one of them, which is what the prompt asks for. That is better than the
      answer I had in mind, not worse.

      The case still earns its place: what it now measures is that a phone-typed
      fragment does not make the assistant remove several blocks, or the frame.
    */
    accept: ["remove_component"],
    orNothing: true,
    forbid: ["remove_table_column", "set_text"],
    note: "页面顶上真的有两个候选，问一句比猜好",
  },
  {
    name: "真实 · 英文口语而且模糊",
    ask: "can u make the table bigger",
    // 「bigger」 could be density, could be a variant, could be the page's
    // arrangement. Any of those is defensible; replying in Chinese is not.
    /*
      Run twice it did both: set_variant 「Made the table roomier.」 and a
      question 「Should I make the table rows taller, or make the table take up
      more space?」. 「bigger」 really is ambiguous, so both are right -- what is
      not negotiable is that the answer comes back in English.
    */
    accept: ["set_variant", "move_component"],
    acceptDesign: { field: "any" },
    orNothing: true,
    replyIn: "en",
    note: "模糊但有方向，而且要用英文答",
  },

  /*
    ── 记不记得刚才 ───────────────────────────────────────

    Every call used to be stateless -- the page, the sentence, nothing else --
    so 「刚才那个不要了」 could only be answered with a question. That is honest
    for something with no memory and strange for anything the owner would call
    an assistant, and it swallows most of how a SECOND sentence gets said.

    The three below are the whole point of that history: the same words mean
    different things depending on what is behind them, and one of them is a
    turn the owner already took back.
  */
  {
    name: "记得 · 刚才那个改回去",
    ask: "刚才那个不要了，改回去",
    history: [{ asked: "把标题改成「今天要跟的」", did: "标题改成「今天要跟的」了。" }],
    /*
      The 撤销这次修改 button is already sitting under that turn in the
      transcript. Pointing at it beats asking which change he means, and beats
      a set_text that guesses at what the title used to be.
    */
    expect: [],
    mustSay: ["撤销"],
    note: "有历史就该指向那颗按钮，不是反问",
  },
  {
    name: "记得 · 再加一栏",
    ask: "再加一栏，写工地地址",
    history: [{ asked: "表格加一列，写哪个师傅负责", did: "加了「负责师傅」这一栏。" }],
    /*
      MY FOURTH WRONG EXPECTATION, AND THIS ONE ARGUED WITH MY OWN RULE.

      The ask was 「再加一栏」 with no name, and I expected add_table_column. It
      asked 「再加的这一栏要叫什么？」 -- which is exactly what the prompt's own
      test says to do: a question he can obviously answer beats a column named
      by guessing. The case was measuring whether the model would invent a
      column name, not whether it remembered the last turn.

      So the name is given and 「再」 is left carrying the only thing that needs
      the history: WHICH TABLE. Nothing in the sentence says, and there is more
      than one block on the page.
    */
    expect: ["add_table_column"],
    note: "「再」指的是哪张表，只有上一轮知道",
  },

  /*
    ── 已经有了还叫它加 ─────────────────────────────────

    Puck's own AI reference declares per-component rules on the CONFIG -- "one
    per page", "always the first component". We have none, and had never
    checked whether we need them. Measured first: what the model WRITES is
    short (「收款进度」, 「本月收款」), so the word-count half of that idea buys us
    nothing. Placement and cardinality were never measured at all, and these
    two cases are that measurement.

    A second workflow strip is not a small mess. The page already carries one,
    it is the same six stages, and the owner asked for the thing he can already
    see -- which usually means he did not recognise it, and a duplicate is the
    one answer that makes that worse.
  */
  {
    name: "重复 · 已经有了还叫它加",
    ask: "帮我加一个工程进到哪一步的流程",
    // The page already has a WorkflowStrip. Editing it, or saying it is
    // already there, are both right. A second one is not.
    forbid: ["add_component"],
    orNothing: true,
    accept: ["set_workflow", "set_text", "move_component"],
    note: "页面上已经有一条流程了",
  },
  {
    name: "重复 · 再来一个页面标题",
    ask: "上面再加一个标题",
    // One PageHeader per page. A second one is not a heading, it is two
    // pages stacked -- and nothing in the config says so today.
    forbid: ["add_component"],
    orNothing: true,
    accept: ["set_text"],
    note: "一页一个页面标题",
  },

  /*
    ── 照片 ────────────────────────────────────────────

    The picker has existed for a while, it uploads to the owner's own storage,
    and it even knows this trade's search words -- and the assistant could not
    reach any of it, so 「第一屏换一张工地的照片」 had no answer at all.

    It still must not CHOOSE the picture. 「审美这种东西都是用看的」, stock it
    picked is stock he replaces, and his own work photo is the one thing on
    that page that is really his. The right answer is an offer that puts him in
    front of the picker with one press.
  */
  {
    name: "照片 · 第一屏换一张",
    ask: "第一屏换一张工地的照片",
    page: SITE_PAGE,
    // An offer, not an edit: it cannot pick the picture and must not pretend to.
    expect: [],
    suggest: "pick_photo",
    note: "把他带到选图器前面，不是替他挑",
  },
  {
    name: "照片 · 这一页没地方放",
    ask: "这里放张图",
    // The dashboard has no photo field on any block. Offering to open a slot
    // that does not exist is a button that fails when pressed -- worse than
    // saying so. The route drops such an offer anyway; this checks the model
    // does not lean on that.
    expect: [],
    note: "这一页没有任何一块收照片",
  },
  {
    name: "搬 · 真实页面上的块是包起来的",
    ask: "把工程记录那张表搬到最上面",
    page: REAL_PAGE,
    /*
      The point is 改到了, not 听得懂: on the flat fixture this passed while the
      applier was quietly putting the block at the bottom. Against a real page
      a wrapped target has to resolve, or the operation comes back skipped and
      this row goes red.
    */
    expect: ["move_component"],
    forbid: ["remove_component", "add_component"],
    note: "真实页面里块包在 Panel / Columns 里",
  },
  {
    name: "记得 · 撤销过的不算数",
    ask: "刚才那个不要了，改回去",
    history: [
      { asked: "把标题改成「今天要跟的」", did: "标题改成「今天要跟的」了。", reverted: true },
    ],
    /*
      The only turn behind him is one he ALREADY took back, so there is nothing
      to change back and the page does not carry that edit any more. Acting
      here means editing something on the strength of a change that is not on
      the page -- the memory being wrong is worse than there being none.
    */
    expect: [],
    note: "唤上一轮已经被撤销，没有东西可以改回去",
  },
];

const chosen = ONLY ? CASES.filter((c) => c.name.includes(ONLY)) : CASES;

/**
 * `saved` mirrors the route's own 「This page:」 line.
 *
 * 排法 re-generates a page and page.tsx only generates while `layout_json` is
 * empty, so the same sentence has two right answers depending on which state
 * the page is in -- design.layout before the first save, move_component after
 * it. A ruler that only ever asks in one state cannot see the difference, and
 * that difference is where the assistant was caught claiming a change it had
 * not made.
 */
function promptFor(ask, saved = false, history = [], page = null) {
  const layout = page ?? PAGE();
  const designDoc = buildDesignDoc("ledger", null);
  // Order mirrors the route exactly, including the reason for it: everything
  // that does not change between two sentences goes first, so a provider
  // prompt cache can keep it. See the route's note, and --prefix below.
  return `Components you may add: ${REGISTERED_COMPONENTS.join(", ")}
${renderBlockRules() ? `这些块自己的规矩（字段名看不出来的）:\n${renderBlockRules()}\n` : ""}
Text fields you may set: ${EDITABLE_TEXT_FIELDS.join(", ")}
Pages in this system: dashboard ("总览"), quotations ("报价单")
This page: ${saved
  ? "ALREADY SAVED by the customer -- 排法 (layout) CANNOT take effect on it. Reorder with move_component."
  : "never saved -- 排法 (layout) will re-generate it, so it is available"}

${designDoc ? `${designDoc}\n` : ""}${darkPalettes().length ? `明暗（从配色量出来的）: 深底的配色只有 ${darkPalettes().join("、")}。\n「太亮了」「暗一点」用它回答，不要换风格。\n其他每一套配色的底都是近白的。\n` : ""}
Blocks currently on this page:
${describeLayout(layout)}
${renderHistory(history) ? `
刚才这段对话里发生过的事（最新的在最下面）:
${renderHistory(history)}
` : ""}
The business owner asked:
"${ask}"`;
}

/*
  WHERE THE SHARED PART STOPS  --  npm run eval:editor -- --prefix

  A provider prompt cache is a PREFIX match. What it pays for is not how much
  of two requests is identical, it is how much is identical BEFORE the first
  byte that differs -- so one volatile line near the top throws away every
  cacheable token behind it, however fixed those tokens are.

  This route's user message currently opens with the page listing, which is the
  single most volatile thing in it: it changes on every edit the owner makes.
  Everything after it -- the component catalogue, the block rules, the editable
  fields, the design brief, the palette facts -- is identical from one sentence
  to the next and is stranded behind it.

  Measured with the real prompt builder rather than a stand-in: a first attempt
  at this used made-up strings of roughly the right size and produced a number
  that was wrong by a factor of two.

  No model calls. Nothing here costs anything.
*/
if (PREFIX) {
  const shared = (a, b) => {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
  };
  // Chars per token, calibrated against a real reply: this prompt shape
  // measured 7545 input tokens, so the ratio is derived, not guessed.
  const sample = SYSTEM_PROMPT + promptFor("把表格搬到上面");
  const RATIO = sample.length / 7545;
  const tok = (chars) => Math.round(chars / RATIO);

  const A = promptFor("把表格搬到上面");
  const B = promptFor("加一栏记生日");
  // The ordinary case is not two sentences over an unchanged page -- it is a
  // second sentence AFTER the first one changed something. A page whose blocks
  // have moved renders a different listing.
  /*
    A REAL PAGE'S BLOCKS ARE NESTED, which the first version of this did not
    account for: it swapped the top two entries of `content`, and on a real
    page `content` holds one thing -- the SystemShell -- with everything else
    inside its slots. The swap changed nothing and the measurement reported a
    perfect prefix for a page that had not moved. Editing a word anywhere in
    the tree is what actually produces a different listing.
  */
  const moved = (() => {
    const l = PAGE();
    let once = false;
    const walk = (n) => {
      if (Array.isArray(n)) return n.map(walk);
      if (n && typeof n === "object") {
        const out = {};
        for (const [k, v] of Object.entries(n)) {
          if (!once && k === "title" && typeof v === "string") {
            out[k] = v + "一";
            once = true;
          } else out[k] = walk(v);
        }
        return out;
      }
      return n;
    };
    return walk(l);
  })();
  const B2 = promptFor("加一栏记生日", false, [], moved);

  const total = SYSTEM_PROMPT.length + A.length;
  const line = (label, chars) =>
    `  ${label.padEnd(20)} ${String(tok(chars)).padStart(5)} tok 可以重用  (${Math.round((chars / total) * 100)}%)`;

  console.log(`
一次呼叫的输入  ${tok(total)} tok`);
  console.log(`  其中固定不变的系统提示  ${tok(SYSTEM_PROMPT.length)} tok`);
  console.log(`  每次重新组的那一段    ${tok(A.length)} tok`);
  console.log(`
同一页，讲第二句（页面没变）:`);
  console.log(line("现在的顺序", SYSTEM_PROMPT.length + shared(A, B)));
  console.log(`
上一句改动了页面，再讲一句:`);
  console.log(line("现在的顺序", SYSTEM_PROMPT.length + shared(A, B2)));

  /*
    AND WHAT THE OLD ORDER COST.

    The listing used to come first and strand every fixed token behind it. This
    puts it back, by string surgery on the prompt the route really builds, so
    the second row is what we moved away from -- and so anyone who reorders
    this again sees the number they are giving up before they do it.
  */
  const MARK = "\nBlocks currently on this page:";
  const flip = (t) => {
    const i = t.indexOf(MARK);
    if (i < 0) return t;
    const j = t.lastIndexOf("\nThe business owner asked:");
    return t.slice(i, j) + "\n" + t.slice(0, i) + t.slice(j);
  };
  console.log(line("页面清单放前面", SYSTEM_PROMPT.length + shared(flip(A), flip(B2))));
  console.log("");
  process.exit(0);
}

if (DRY) {
  console.log(`${chosen.length} cases x ${N} runs = ${chosen.length * N} calls\n`);
  for (const c of chosen) console.log(`  ${c.name.padEnd(22)} ${c.ask}`);
  console.log("\n--- one prompt ---\n");
  console.log(promptFor(chosen[0].ask).slice(0, 2000));
  process.exit(0);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * A local file as a data URL.
 *
 * The eval calls OpenAI directly, so it does not go through the route's
 * host allowlist -- which is right: the allowlist is the route's job and is
 * tested separately. What this has to answer is the question the allowlist
 * cannot, which is whether the MODEL reads a picture at all.
 */
function dataUrl(path) {
  return `data:image/jpeg;base64,${readFileSync(path).toString("base64")}`;
}

async function once(ask, image, saved = false, history = [], page = null) {
  const text = promptFor(ask, saved, history, page);
  /*
    HOW LONG HE WAITS, WHICH NOTHING HAS EVER MEASURED.

    Three columns here score whether the answer is RIGHT. None of them notices
    an answer that is right and arrives after the platform has already hung up:
    a Vercel route handler has a wall-clock ceiling, and reasoning_effort
    "high" on a prompt this size is the slowest call this product makes. A
    correct operation that times out looks to the customer exactly like an
    assistant that does not work.

    Wall clock around the model call only -- applying the ops is microseconds
    and would just blur the number we can act on.
  */
  const startedAt = Date.now();
  const completion = await openai.chat.completions.create({
    model: "gpt-5.6-luna",
    reasoning_effort: "high",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: image
          ? [
              { type: "text", text },
              { type: "image_url", image_url: { url: dataUrl(image) } },
            ]
          : text,
      },
    ],
    response_format: { type: "json_schema", json_schema: EDIT_JSON_SCHEMA },
  });
  const tookMs = Date.now() - startedAt;
  const parsed = parseLayoutOps(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
  // Applied against the same page the model was shown, so 改到了 measures what
  // the customer would have got and not what the model hoped for.
  const result = applyLayoutOps(page ?? PAGE(), parsed.operations, preferredVariants("ledger"));
  return {
    tookMs,
    /*
      WHAT ONE SENTENCE COSTS, AND HOW MUCH OF IT WE PAID FOR TWICE.

      The system prompt is the same on every call and sits first, which is the
      shape a provider-side prompt cache rewards -- `cached_tokens` says
      whether we are actually getting it. It is not recorded anywhere in the
      product (ai_usage stores prompt_tokens only), so the money figure from
      check:ai-cost currently prices cached input at the full rate. Measured
      here first: if the hit rate is high, the ledger is over-reporting and
      should learn the column; if it is low, something in the prefix is moving
      between calls and that is a bug worth finding.
    */
    usage: completion.usage ?? null,
    ops: parsed.operations.map((o) => o.op),
    // Every string the model wrote, so a case can assert on CONTENT and not
    // only on which operation was chosen.
    values: parsed.operations.flatMap((o) =>
      Object.values(o).filter((v) => typeof v === "string"),
    ),
    applied: result.applied,
    skipped: [...parsed.rejected, ...result.skipped],
    explanation: parsed.explanation,
    // A page it cannot build itself comes back as a PROPOSAL, not an
    // operation. Scored as its own shape so 「我要一个员工排班的页面」 counts as
    // understood rather than as 「emitted nothing」.
    suggestion: parsed.suggestion?.action ?? "none",
    suggestedTitle: parsed.suggestion?.page_title ?? null,
    // 风格 / 配色 / 排法 are settings on the whole system, not operations, so
    // they come back beside the operations and are scored separately. Without
    // this a case like 「换成深色一点的」 would look like 「emitted nothing」.
    /*
      NULLS STRIPPED, THE SAME WAY THE ROUTE STRIPS THEM.

      The schema makes all three fields REQUIRED, so a model that changed
      nothing still returns {style:null, palette:null, layout:null}. Reading
      that object's key count as 「it changed the design」 marked a perfectly
      correct text edit as a failure on 2026-08-26. `validDesign` in the route
      drops nulls before deciding; so does this, or the eval is measuring a
      different thing from the product.
    */
    design: (() => {
      const d = parsed.design ?? null;
      if (!d || typeof d !== "object") return null;
      const kept = Object.fromEntries(
        Object.entries(d).filter(([, v]) => typeof v === "string" && v.trim()),
      );
      return Object.keys(kept).length ? kept : null;
    })(),
  };
}

const rows = [];
for (const c of chosen) {
  const runs = [];
  for (let i = 0; i < N; i++) {
    try {
      runs.push(await once(c.ask, c.image, c.saved === true, c.history ?? [], c.page ? c.page() : null));
      if (process.env.EVAL_VERBOSE) console.log("   ", c.name, JSON.stringify({ ops: runs[runs.length-1].ops, design: runs[runs.length-1].design, exp: runs[runs.length-1].explanation, wrote: runs[runs.length-1].values }));
    } catch (e) {
      // tookMs null, not 0: a call that threw did not take no time, it took an
      // unknown amount, and a 0 would drag the median toward a lie.
      runs.push({ tookMs: null, ops: [], applied: 0, skipped: [{ op: "-", reason: String(e.message).replace(/\s+/g, " ").slice(0, 300) }], explanation: "" });
    }
  }

  const understood = runs.filter((r) => {
    /*
      THE PAGE FRAME IS NEVER A TARGET.

      「整页清空」 is a legitimate request and the honest answer is to empty the
      main column — but a remove_component aimed at the SystemShell strands
      everything in its slots, which is why applyLayoutOps refuses it. The
      model should not be sending it in the first place: a refusal the customer
      never sees is still a wasted turn.
    */
    if (c.danger && (r.values ?? []).includes("dashboard-shell")) return false;
    // A picture must not put somebody else's words on this page. Checked on
    // every value the model wrote, not only on the operation names.
    if (c.forbidText?.some((t) => JSON.stringify(r.values ?? []).includes(t))) return false;
    /*
      Some answers ARE the sentence. 「刚才那个不要了」 is answered correctly by
      pointing at the 撤销 button that is already sitting under that turn --
      there is no operation to check, so the check has to be on the words.
    */
    if (c.mustSay?.length && !c.mustSay.some((t) => r.explanation.includes(t))) return false;
    // 「Write all text in the same language the owner used」 -- the prompt has
    // said this from the start and nothing ever checked it.
    if (c.replyIn === "en" && /[一-鿿]/.test(r.explanation)) return false;
    if (c.replyIn === "ms" && /[一-鿿]/.test(r.explanation)) return false;
    /*
      A DESIGN CASE IS SCORED ON THE FIELD, NOT ON THE OPERATIONS.

      `design` names 风格 / 配色 / 排法, and the right answer to 「换成深色一点的」
      is a design change and NO operations -- a model that starts rewriting
      blocks to make the page darker has misunderstood what it was asked.
    */
    if (c.noDesign && r.design && Object.keys(r.design).length) return false;
    /*
      SOME QUESTIONS HAVE TWO RIGHT ANSWERS AND THE RULER MUST NOT PICK ONE.

      `orNothing` marks a case where doing the edit AND asking which edit are
      both defensible -- 「上面那个我不要了」 over a page that opens with a header
      above the first block. Every OTHER guard still applies, so a case with
      this flag can still fail by removing the frame, removing several things,
      or replying in the wrong language. It buys the model the choice, not a
      pass.
    */
    if (c.orNothing && r.ops.length === 0) return true; // also covers offering a page
    // Either the operation OR the design counts. See the case's own note.
    if (c.acceptDesign) {
      const d = r.design ?? {};
      const byDesign =
        c.acceptDesign.field === "any"
          ? Object.keys(d).length > 0
          : (c.acceptDesign.oneOf ?? []).includes(d[c.acceptDesign.field]);
      const byOp = (c.accept ?? []).some((op) => r.ops.includes(op));
      return byDesign || byOp;
    }
    /*
      Two fields, either of which is a right answer. `design` takes one field
      and one list, which was enough while only a register could be dark.
    */
    if (c.designAny) {
      const d = r.design ?? {};
      const ok = c.designAny.some(({ field, oneOf }) => oneOf.includes(d[field]));
      return ok && r.ops.length === 0;
    }
    if (c.design) {
      const d = r.design ?? {};
      const got = c.design.field === "palette" ? d.palette : d[c.design.field];
      const ok = c.design.oneOf ? c.design.oneOf.includes(got) : got != null;
      return ok && r.ops.length === 0;
    }
    if (c.suggest) return r.suggestion === c.suggest && r.ops.length === 0;
    if (c.accept) return r.ops.some((op) => c.accept.includes(op));
    if (!(c.expect?.length ?? 0)) return r.ops.length === 0 && r.suggestion === "none";
    const hasAll = (c.expect ?? []).every((op) => r.ops.includes(op));
    const hasBanned = (c.forbid ?? []).some((op) => r.ops.includes(op));
    return hasAll && !hasBanned;
  }).length;

  /*
    改到了 -- did what the model emitted actually land.

    An expectation of zero operations is satisfied by applying nothing, so this
    is scored against whether anything the model DID emit stuck.

    A DESIGN CHANGE COUNTS AS LANDING. Added 2026-08-26 with the 风格/配色/排法
    field: those are settings on `projects`, applied by an RPC and not by
    applyLayoutOps, so `applied` is zero for them by construction. Without this
    line 「你帮我弄好看一点」 -> 「我先换成清爽的标准蓝配色…之后也可以换回去」
    scored 听得懂 100% and 改到了 0%, which is the ruler describing its own
    blind spot rather than the assistant.
  */
  const landed = runs.filter((r) => {
    /*
      A case that is allowed to ask has NOTHING TO LAND when it asks. Without
      this, `orNothing` passes 听得懂 and then fails 改到了 for the same run --
      the ruler contradicting itself, and looking from the outside exactly like
      an assistant whose edits do not stick.
    */
    if (c.orNothing && r.ops.length === 0) return r.skipped.length === 0;
    if (r.design && Object.keys(r.design).length) return r.skipped.length === 0;
    return ((c.expect?.length ?? 0) > 0 || c.accept) && !c.suggest
      ? r.applied > 0 && r.skipped.length === 0
      : r.applied === 0;
  }).length;

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
if (process.env.SAY) {
  console.log('\n' + '它是怎么回答的:');
  for (const r of rows) {
    console.log('  ' + r.name);
    for (const x of r.runs) console.log('      ' + (x.explanation || '(没讲话)'));
  }
}

/*
  他等了多久。

  The three columns above are all about whether the answer is right. This one
  is about whether it ARRIVES: a route handler on Vercel is killed at a
  wall-clock ceiling, and this call -- reasoning_effort "high", a system prompt
  of several thousand tokens, a page listing on top -- is the slowest thing
  this product does. A correct answer delivered after the platform hung up is
  indistinguishable, from the passenger seat, from an assistant that is broken.

  p95 and not the mean, because the mean is the call nobody complains about.
*/
/*
  一句话花多少钱，其中有多少是重复送的。
*/
const usages = rows.flatMap((r) => r.runs.map((x) => x.usage)).filter(Boolean);
if (usages.length) {
  const sum = (f) => usages.reduce((a, u) => a + (f(u) ?? 0), 0);
  const pin = sum((u) => u.prompt_tokens);
  const pout = sum((u) => u.completion_tokens);
  const reason = sum((u) => u.completion_tokens_details?.reasoning_tokens);
  const cached = sum((u) => u.prompt_tokens_details?.cached_tokens);
  const n = usages.length;
  console.log(
    `
每一句话  输入 ${Math.round(pin / n)} tok` +
      `（其中 ${Math.round((cached / pin) * 100)}% 命中缓存）` +
      ` · 输出 ${Math.round(pout / n)} tok（推理 ${Math.round(reason / n)}）`,
  );
}

const times = rows.flatMap((r) => r.runs.map((x) => x.tookMs)).filter((t) => typeof t === "number");
if (times.length) {
  const sorted = [...times].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  const slowest = rows
    .map((r) => ({ name: r.name, ms: Math.max(...r.runs.map((x) => x.tookMs ?? 0)) }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 3);
  const sec = (ms) => `${(ms / 1000).toFixed(1)}s`;
  console.log(
    `
他等了多久  中位 ${sec(at(0.5))} · p95 ${sec(at(0.95))} · 最慢 ${sec(sorted[sorted.length - 1])}  (${times.length} 次)`,
  );
  console.log(`  最慢的三题  ${slowest.map((x) => `${x.name} ${sec(x.ms)}`).join(" · ")}`);
}

if (reasons.length) {
  console.log("\n被挡下来的（这些是我们这边的问题，不是模型的）:");
  for (const [k, n] of Object.entries(
    reasons.reduce((a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {}),
  )) console.log(`  ${n}x  ${k}`);
}

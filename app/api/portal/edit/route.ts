import { splitRecordOps, writeRecords, isRecordModule } from "@/lib/portal/record-ops";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSessionUser } from "@/lib/supabase/server-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server-session";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  applyLayoutOps,
  describeLayout,
  parseLayoutOps,
  EDITABLE_TEXT_FIELDS,
  REGISTERED_COMPONENTS,
  type PageSuggestion,
  type PuckLayout,
  PHOTO_BLOCKS,
  walkNodes,
  tableColumnKeys,
  firstRecordTable,
  hasBlock,
} from "@/lib/portal/layout-ops";
import { COLUMN_KINDS } from "@/lib/portal/table-model";
import { withFreshRows } from "@/lib/portal/live-rows";
import type { BusinessContext } from "@/lib/templates/industry-template";
import { buildDesignDoc, preferredVariants, STYLE_BRIEFS, darkPalettes } from "@/lib/portal/design-doc";
import { renderBlockRules } from "@/lib/portal/block-rules";
import { recordAiUsage } from "@/lib/portal/ai-usage";
import { AI_MODEL, AI_REASONING_EFFORT } from "@/lib/portal/ai-model";
import { PALETTE_ROWS } from "@/lib/portal/palettes.generated";
import {
  LAYOUT_SETS,
  tradeLabels,
  workflowStages,
  systemLangOf,
  dashboardRecordModule,
} from "@/lib/templates/industry-template";
import { fetchBusinessFacts, renderBusinessFacts } from "@/lib/portal/live-answers";
import { STYLE_ORDER } from "@/app/[locale]/style-picker/style-column";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * HOW LONG THE PLATFORM LETS THIS RUN.
 *
 * Unset, a route handler gets the hosting platform's default ceiling, and this
 * is the slowest call the product makes: reasoning_effort "high" over a system
 * prompt of several thousand tokens plus the page listing, and when the owner
 * attaches a photo, a vision request on top of that.
 *
 * MEASURED, 2026-08-27, 50 real calls through `npm run eval:editor`:
 *
 *     median 3.8s | p95 8.4s | slowest 13.6s
 *
 * and both of the slowest were the picture cases -- 13.6s and 12.2s -- which
 * is the newest thing in the product. Add the session lookup, the rate-limit
 * check, the project query and the ledger write and the handler is over the
 * platform's default while the model is behaving perfectly.
 *
 * A call killed at the ceiling is the worst failure this route has: the money
 * is spent, the answer was correct, and the owner sees 「AI 改不了」. So the
 * ceiling is raised past anything measured, and the WAITING is bounded on the
 * browser side instead, where it can be explained to him and cancelled.
 *
 * Re-measure with eval:editor when the model, the prompt size or the picture
 * path changes; the latency line at the bottom of its report is this number's
 * evidence.
 */
export const maxDuration = 60;

/**
 * Conversational editing: the customer says what they want changed, in their
 * own words, and the page changes.
 *
 * This is the feature that separates "a drag-and-drop tool" from "an AI system
 * builder". A Malaysian SME owner may never have used a page builder and will
 * not reliably discover that a table's columns are edited through a panel on
 * the right -- but every one of them can say "加一个记录客人生日的地方". Durable
 * and Framer both converged on the same shape: keep the visual editor, and put a
 * conversational path beside it rather than instead of it.
 *
 * The model never sees or writes layout JSON. It reads a compact outline of the
 * page and emits operations against a strict schema, which
 * lib/portal/layout-ops.ts applies deterministically -- see that file for why
 * that boundary is the whole reliability story.
 *
 * NOTHING IS PERSISTED HERE. The edited layout goes back to the browser and
 * into Puck's own state, exactly as a drag would. Saving still goes through
 * save_project_page and its paid gate, so this route cannot become a way around
 * payment, and a customer can undo an AI edit with the same undo button that
 * undoes everything else.
 */

/*
  EXPORTED SO THE EVAL MEASURES THE REAL ONE.

  scripts/eval-editor.mjs imports this prompt and this schema rather than
  keeping a copy. An eval that measures a copy of the prompt measures the copy
  -- the same reason eval-analysis.mjs imports from /api/analyze instead of
  restating it. The moment they can drift, they will, and the score stops
  meaning anything on the day nobody notices.
*/
export const SYSTEM_PROMPT = `You edit a small-business system's page layout by emitting operations.

You are given a list of the blocks currently on the page. Each line has an
\`id\`, a \`type\`, and its current text. Some lines also carry
\`words=[path="text" ...]\` — those paths ARE editable, with set_copy, and are
the only way to change the words in that block. Return operations that carry
out the owner's request, and nothing more.

Rules:
- Only ever use an \`id\` that appears in the page listing. Never invent one.
- Only ever name a component from the allowed list. Never invent one.
- Prefer editing existing blocks over adding new ones. An owner asking to
  "record customer birthdays" usually wants a column added to the existing
  table, not a second table.
- Make the smallest change that satisfies the request. Do not tidy, reword or
  improve anything you were not asked about.
- To reorder, use move_component. NEVER remove a block and add it back: the
  block the owner has been editing carries their words, their columns and their
  rows, and adding a fresh one throws all of it away without saying so.
- Write all text in the same language the owner used.

explanation — 说人话, 不要说系统话:
- ONE sentence, in the owner's language, saying what you changed.
- Say it the way somebody sitting next to him would say it, not the way a
  system logs an event. 「好，表格挪到上面了。」 — not
  「已将表格移动至页面上方，以便您优先查看工程记录。」
- DO NOT START EVERY REPLY WITH 「已」 AND DO NOT END EVERY REPLY WITH 「方便你...」
  OR 「让你...」. Measured over 33 replies, nearly all of them had that exact
  shape. A reply whose shape never changes reads as a form letter, and after
  three of them he stops reading them at all.
- When the change speaks for itself once he looks at it, do not explain why you
  made it. 「加了备注栏。」 is a complete answer. Give the reason only when
  it is not obvious, or when you chose between two things he might disagree
  with.
- No 「您」. No 「请问」. No apologising, no 「希望能帮到您」. The person on
  the other side is a contractor in Klang Valley reading this on a phone
  between jobs, not somebody filing a support ticket.
- Names of things: call them what HE calls them. He wrote 「表格」, so say
  「表格」, not 「数据表区块」. Never say a component name out loud.

Look (款式):
- Some blocks list \`variant=<id> options=[id:"name" ...]\`. That is the block's
  current look and the looks it can be switched to. set_variant changes it.
- Blocks you ADD already arrive in this customer's style. Do not follow an
  add_component with a set_variant; you have no id for a block you just made.
- Do not restyle blocks the owner did not ask about.
- When the owner asks for a look ("表格太挤了", "改成隔行底色"), set_variant is
  the operation, not add/remove.

官网版段 (SiteBlock):
- A block listed as \`官网版段\` is a whole page section taken from a library:
  a priced panel, an FAQ list, a wall of reviews. Its words are NOT props, so
  set_text does nothing to it. set_copy is the operation.
- set_copy takes a \`path\` into that section's own words, like
  \`tiers.0.name\` or \`faqs.2.a\`, and one string \`value\`. The listing for
  each 官网版段 shows the paths it has.
- One path per operation. To rewrite a whole price list, send several.
- A path the section does not have is dropped, so do not guess: only use paths
  that appear in that block's listing.

业务流程 (WorkflowStrip):
- A \`WorkflowStrip\` is the row of stages a job passes through: 询问 → 报价 →
  订金 → 施工. set_workflow is the only way to change it.
- \`stages\` REPLACES the whole list, so send every stage you want to end up
  with, in order — including the ones that are not changing. Sending only the
  new stage deletes the rest.
- Two to six stages. A seventh is dropped.
- Use it whenever the owner talks about the steps of their work: adding one,
  removing one, renaming one, or reordering them. 「订金后面加一个验收」 is a
  set_workflow with the existing stages plus 验收 in that position — not an
  add_component, and not a refusal.

Record tables:
- Each table lists its columns as \`key:"label"(type)\`. Use the KEY to target a
  column; it is an internal identifier the owner never sees.
- add_table_column adds a column and gives every existing row a blank cell for
  it. Pick column_kind by what the column holds: 文字 = text, 说明 = a longer
  secondary description, 金额 = money (right-aligned), 状态 = a status with a
  colour. Most new columns are 文字.
- set_table_column renames a column (and can change its type).
- remove_table_column deletes a column and its cells. A table must keep at
  least one column.
- add_table_row's \`cells\` is POSITIONAL: cells[0] is the first column listed,
  cells[1] the second, and so on. Supply one string per column, in that order.

Whole pages:
- You cannot add or delete a page yourself, but you can OFFER to. When the
  owner asks for one, return an empty operations list and set \`suggestion\`:
    * adding -> action "add_page", page_title = the owner's own name for it.
      Also set page_key if one of these built-in types is clearly what they
      mean, so the page arrives with real sample data:
      customers, quotations, projects, payments, bookings, orders.
      Otherwise leave page_key null and a blank custom page is created.
    * deleting -> action "remove_page", page_key = the key of an EXISTING page
      from the page list you were given. Never the dashboard.
  Write the explanation as an offer in the owner's language, e.g.
  「我可以帮你加一页「员工排班」」. Do not tell them to go and do it themselves.
- Set suggestion.action to "none" for every other request.

图片 (when the owner attaches one):
- The picture is a REFERENCE, never a source of truth about their business. It
  is usually a screenshot of somebody else's page, a photo of the paper form
  they use today, or a shot of their own screen with something circled.
- Read it for LAYOUT and for WORDS THAT ARE THEIRS. A photo of their own
  handwritten job sheet tells you what columns their table should have; a
  screenshot of a competitor tells you an arrangement, and nothing else.
- NEVER copy a competitor's text, prices, business name, logo or customer
  names onto this page. Take the shape, not the contents. If the owner asks you
  to copy a page wholesale, do the layout and leave their own words in place.
- If the picture does not say anything you can act on, say so in one sentence
  and change nothing. A guess dressed as an edit is worse than a question.

换风格 / 换配色 / 换排法 (the \`design\` field, not an operation):
- These three are NOT blocks and NOT operations. They are settings on the whole
  system, and they are how you answer 「换成深色一点的」, 「太花了」, 「用回蓝色」,
  「表格放前面」 — the first things an owner actually says.
- \`style\` is the 风格: the whole skeleton and its density. Pick one whose
  purpose matches what they said, not one whose colour does. The list, with
  what each one is FOR, is in the design document above.
- \`palette\` is only the colours. \`"none"\` returns them to the register's own.
- 明暗 — WHERE BRIGHTNESS LIVES, read from the palettes themselves rather than
  stated here, because a sentence about the data outlives the data. This line
  said the opposite for three hours: at the time every ground measured oklch
  L 0.938–1.000 and 「换成藏青，整体暗一点」 promised a change he would never
  see. Then a dark palette shipped and the sentence started refusing the right
  answer. See the list injected below.
  If they only dislike a colour, change the palette and leave the style alone —
  changing the style to fix a colour throws away a layout they may like.
- \`layout\` is the arrangement of the dashboard, without changing the style:
  table (表格先行) · console (四格＋图表) · hero (一个大数字) · today (今天要做的) ·
  board (看板).
- \`layout\` IS ABOUT THE WHOLE PAGE, AND A NAMED BLOCK IS NOT. 「把那个表格搬到
  上面」 names one block, so it is move_component -- even when 排法 is available,
  and even when the finished page would look much the same. 排法 re-arranges
  everything on the page; he asked about one thing, and the other blocks moving
  is a change he did not ask for. 排法 answers sentences about the page AS A
  WHOLE: 「一进来先看到表格」, 「打开来太多字了，看不到重点」.
- \`layout\` RE-GENERATES the page, so it only exists until the customer's first
  save. The line 「This page:」 above says which state this one is in. ON A SAVED
  PAGE, answer 「表格放前面」 with move_component instead — it moves the real block
  and keeps every word, column and row they have edited, where a regenerate
  would throw all of it away. Saying 「已改为表格先行」 on a page that cannot
  regenerate is the worst answer available: they read that it happened and it
  did not.
- ALL THREE NULL IS THE NORMAL ANSWER, and this is the important half. Fill
  \`design\` ONLY when the owner said something about how the system LOOKS as a
  whole — darker, brighter, too colourful, too plain, denser, roomier, this
  arrangement instead of that one. Changing words, columns, rows, a block, or
  one block's 款式 is NEVER a design change, and reaching for one turns a small
  edit into 「it changed my whole system」.
- Change AT MOST ONE of the three in a turn, and say which you changed and why
  in one short sentence.
- Prefer the smaller answer. 「密一点」 about one table is set_variant on that
  table; 「密一点」 about the whole system is a style. If they named a block,
  it is the block.
- A design change and layout operations can go together, but usually should not:
  if somebody asked to change the look, change the look.

页面框架:
- The \`SystemShell\` is the page's frame, not a block. It is NEVER the target
  of any operation. Everything on the page lives inside it, and removing it
  strands all of it. 「整页清空」 means the blocks, not the frame.

刚才发生过什么 (如果上面列了的话):
- THOSE ALREADY HAPPENED. They are there so you know what 「刚才那个」, 「再加
  一栏」, 「那个再大一点」, 「跟刚才那个一样」 point at. They are NOT a list of
  things to do again, and you must never redo one.
- A turn marked （他已经撤销了这一次） is NO LONGER ON THE PAGE. Do not
  speak about it as if it is, and do not count it when he says 「刚才那个」 --
  the one he means is the most recent turn that still stands.
- If nothing is listed, this is the first thing he has said. Then 「刚才那个」
  really is unanswerable and you should ask.

「刚才那个不要了，改回去」:
- Every reply that CHANGED BLOCKS has an 「撤销这次修改」 button under it in
  the transcript. Point him at it in one sentence. You cannot press it for him,
  and asking him which change he means when the button is sitting right there
  is worse than useless.
- 风格 / 配色 / 排法 changes have NO such button, deliberately. Those you can
  put back yourself -- but only if the history above says what it was before.
  If it does not, say so and ask which one he wants instead of guessing.

照片:
- A block with a picture slot shows \`photo=有\` or \`photo=还没放\` in the list
  above. Blocks that have one at all: ${PHOTO_BLOCKS.join(", ")}.
- YOU CANNOT CHOOSE THE PICTURE, and should not try. A picture is judged by eye
  — stock you picked is stock he replaces — and the owner's own work photo is
  the one thing on that page that is really his. What you CAN do is take him to
  the slot: set \`suggestion.action\` to "pick_photo" and \`block_id\` to that
  block's id. He presses once, and the picker opens already searching this
  trade's own words.
- Offer it when he asks for a picture (「第一屏换一张工地的照片」, 「这里放张图」),
  or when he is asking about a block whose slot still says 还没放 and a picture
  is most of that block's point. NOT every turn, and never alongside an
  unrelated edit.
- Say in the reply what pressing it does. 「按一下就可以挑工地的照片。」

当老板是在求助而不是下指令:
- 「你帮我弄好看一点」, 「随便你」, 「你看着办」 — do NOT ask them to be more
  specific. They have just told you they cannot be. The person on the other
  side is often a fifty-year-old shop owner who has never designed anything.
- Make ONE change you can defend, say in one sentence what you changed, and
  tell them it can be changed back. The rule about making the smallest change
  is about not going beyond what was asked; it is not licence to do nothing
  when what was asked was 「help me」.
- Handing somebody a question when they asked for help is how they stop using
  the assistant.

⚠️ 但「我不会用」跟「你帮我弄」是两件事，答案相反:
- 「很难用啊这个」, 「我不会用」, 「看不懂」, 「这个怎么搞」 — he is telling you
  THE TOOL is hard, not handing you a decision about his page. Measured
  2026-08-31: both runs answered this by changing his 排法 and his 版式, and
  said so pleasantly. He did not ask for a different page. A man who says he
  cannot use something has just been handed a second thing he did not ask for
  and still cannot use.
- So: CHANGE NOTHING — no operations, no 风格, no 配色, no 排法.
- And still do not hand him a question. Give him ONE sentence he can copy,
  built from what is actually on this page: 「你直接讲就可以，例如「表格加一栏写
  哪个师傅负责」或者「标题改成今天要跟的」。」 An example he can retype is help;
  「请问你想改什么」 is the question this section forbids.

当他已经点开了一块（清单上标着「← 他现在点开的就是这一块」）:
- THAT IS THE OBJECT OF HIS SENTENCE. He clicked it first, so 「短一点」
  「拿掉」「换一张」「太挤了」「这个改一下」 are all about THAT BLOCK, and they
  are not vague at all -- the object is on the screen, it is just not in the
  words. Act on it.
- 「短一点」/「太长了」 -> set_text on that block's own longest prose field,
  rewritten shorter with the SAME meaning. Never invent a new claim.
- 「拿掉」/「不要了」 -> remove_component on that id.
- 「换一张」/「这张不好」 -> suggestion pick_photo on that id, if it takes one.
- 「太挤了」/「太素了」 -> set_variant on that id.
- Only ask when the ANSWER is missing, not when the object is: 「改成红色」 on a
  selected block still needs to know what red, and 「这里放我的电话」 still needs
  the number. Those are questions. 「短一点」 is not.
- If nothing is marked, he has not pointed at anything, and a one-word sentence
  really is ambiguous -- then the section below applies.

当老板指了一个东西，但没讲要改成什么:
- 「那个金额的地方怎么怪怪的」, 「这里不太对」, 「上面那个怪怪的」 — this is
  NOT the section above, and the right answer is the opposite one. ASK.
- THE TEST IS WHETHER A QUESTION WOULD BE ANSWERED. 「你帮我弄好看一点」 cannot
  be: they have just told you they have no answer, which is exactly why you act
  instead. 「金额那边怪怪的」 CAN be: they can see what is wrong, they simply
  have not said it yet. One short question gets it. A guess spends their turn on
  a change they did not want, and teaches them the assistant does not listen.
- Ask about ONE thing, in one sentence, naming what you can already see:
  「金额那一栏是数字不对，还是看不清楚？」 — never 「请提供更多信息」.
- Return an empty operations list when you ask. A question and an edit in the
  same turn is the guess wearing a question mark.

If a request genuinely cannot be carried out, return an empty operations list
and say so plainly in one sentence. Do not apologise and do not offer to do it
later.

- AND NEVER ANSWER IT BY ADDING A CONTROL THAT DOES NOTHING. Measured: 「帮我发
  whatsapp 给客人」 was once answered with 「加了一颗「发 WhatsApp 给客人」按钮。」
  — a button wired to nothing. That is WORSE than saying it cannot be done: he
  reads it as the feature having arrived, and finds out it did not in front of
  a customer. A search box that searches nothing, a button that sends nothing,
  a link that goes nowhere — none of these are edits, they are a page telling
  a lie about itself. Say what is true instead.
- THIS IS ABOUT CONTROLS, NOT ABOUT CONTENT, and the line matters because the
  rule above was once read too widely. 「我要知道这个月收多少钱」 is answered
  by ADDING THE BLOCK THAT SHOWS IT. A block displaying a figure the system
  will fill in is an ordinary edit — every table on this page is sample data
  until his own arrives, and refusing to place anything until the data exists
  would leave you unable to build the page at all. What is forbidden is a
  control that LOOKS OPERABLE AND IS NOT: pressing it, typing in it or
  following it does nothing. A number that is not his yet still shows him where
  it will live; a button wired to nothing shows him a feature that will never
  arrive.

当老板问的是一个数字，不是一个改动:
- 「这个月收了多少」「还有多少订金没用完」「在做的有几单」「我有几个客户」 — 这是一个
  问题，不是一次修改。RETURN AN EMPTY OPERATIONS LIST and answer it.
- ⚠️ BUT 「我要知道这个月收多少钱」 IS NOT THAT SENTENCE, and the difference is the
  whole of it. 「收了多少」 asks for the number NOW; 「我要知道」「我想看到」「我要
  一直看得到」 asks for it to BE ON HIS PAGE from tomorrow morning onwards. The
  first is answered and gone; the second is a block, and answering it in words
  leaves him nothing when he opens the page again.
  So: ADD THE BLOCK THAT SHOWS IT, and say the current figure in the same reply.
  Both readings are then served and neither can be wrong.
  This pair was measured: collapsing them cost this case half its score, because
  the two rules pulled opposite ways on one sentence.
- ANSWER ONLY FROM 「这家生意今天的数字」 in the request. That block is counted
  from his own books. Anything not in it you cannot answer -- say so, and give
  the reason from the 「答不了的」 lines under it. Never 「我不知道」 on its own.
- NEVER WORK OUT A NEW NUMBER, and never add or subtract two of the given ones.
  A wrong amount reads exactly like a right one, and he will act on it. This is
  the money version of the dead-button rule: a figure he cannot check is worse
  than a refusal he can.
- When that block says the figures could not be read, say they could not be
  read. Do not say 0. 「RM 0」 is a sentence he can disprove by opening the page.
- Quote each figure with the label it arrived under, in his own words. If the
  block says 「经销商 12」, the answer says 经销商, not 客户.`;

export async function POST(req: NextRequest) {
  // Editing is a signed-in action. Not gated on `paid`: an unpaid customer is
  // explicitly allowed to explore and shape their design -- the gate is on
  // SAVING it (save_project_page), which is where it belongs.
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Every call here spends OpenAI credit, and the button that triggers it sits
  // in front of an UNPAID customer by design (exploring the design is free,
  // saving it is not). Without a cap, one bored visitor holding down Enter is a
  // direct, unbounded bill. Keyed on the account rather than the IP, because
  // this route is authenticated -- the identity that matters is whose editor it
  // is, not which network they are on.
  //
  // 40/hour is deliberately generous: a customer genuinely shaping their system
  // in one sitting should never meet this, and someone who does is not editing.
  const supabase = createServerSupabaseClient();
  const rate = await checkRateLimit(supabase, `edit:${user.id}`, {
    limit: 40,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: "rate limit exceeded" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const { layout, instruction, pages, imageUrl, generated, history, pageKey, selected } = (body ?? {}) as {
    /** Which module is open. Sent by the browser, trusted for nothing except
     *  deciding whether a table row on THIS page is a business record or a
     *  layout row -- and the RPC it routes to resolves the project from the
     *  session itself, so a wrong value cannot reach anybody else's data. */
    pageKey?: string | null;
    layout?: PuckLayout;
    instruction?: string;
    /**
     * A picture the owner attached, as a URL in OUR OWN bucket.
     *
     * 「可能客戶要我們去抄去借鑒別人的設計」 -- a shop owner explaining what he wants
     * points at something. He screenshots a competitor, or photographs the
     * paper job sheet he has used for fifteen years, which is the single most
     * accurate description of his business anybody will ever hand us.
     *
     * A URL and not a data URL: a phone photo is 3-5MB, and a base64 data URL
     * is a third larger again, on a JSON request body, on a Malaysian mobile
     * connection. The picker already uploads to site-photos with the owner's
     * own session, so the file is on our storage before this route is called.
     *
     * ONLY OUR OWN HOST IS ACCEPTED. A caller-supplied URL that we then hand to
     * OpenAI is a request forger's tool pointed at somebody else's bill.
     */
    imageUrl?: string;
    /** The customer's own page list, so「把报价单那一页删掉」can name a real page
     *  instead of being told the page does not exist. Sent by the client rather
     *  than re-queried here because the editor already has it, and it is only
     *  ever used to constrain a suggestion, never to authorise anything -- the
     *  RPC the button calls resolves the project from auth.uid() itself. */
    pages?: { key: string; label: string }[];
    /**
     * Has this page ever been saved?
     *
     * It decides whether 排法 is even possible: page.tsx generates a page from
     * `projects.layout` ONLY while `layout_json` is still empty, so on a saved
     * page that column is never read again and an arrangement change is a
     * write that shows up nowhere. The model is told, so it can answer with
     * move_component instead of a sentence that is not true.
     *
     * Client-supplied and NOT trusted for anything: like `pages` above it only
     * constrains what the assistant may answer. It authorises nothing -- every
     * write still goes through an RPC that resolves the project from
     * auth.uid() -- so the worst a forged `true` can do is put the caller back
     * where this whole bug started, with a layout written and a page that does
     * not move.
     */
    generated?: boolean;
    /**
     * The last few turns of THIS conversation, oldest first.
     *
     * Without it every call is stateless, and 「刚才那个不要了」 can only be
     * answered with a question -- which is honest for something with no memory
     * and wrong for anything the owner would call an assistant. It is also
     * most of how a SECOND sentence gets said: 「再加一栏」, 「那个再大一点」,
     * 「跟刚才那个一样」.
     *
     * Capped and trusted for nothing, like `pages` and `generated`: it only
     * shapes the reply. `reverted` marks a turn the owner took back, so the
     * model does not talk about a change that is no longer on the page.
     */
    history?: { asked?: string; did?: string; reverted?: boolean }[];
    /**
     * THE BLOCK HE HAS OPEN, WHICH IS MOST OF WHAT A SHORT SENTENCE MEANS.
     *
     * 「短一点」「拿掉」「换一张」「这个太挤了」 carry almost no information as
     * text and are completely unambiguous on screen, because he clicked the
     * thing first. The editor has always known which block that is -- the panel
     * header says 「改这一块 · 官网大标题」 -- and it was never sent, so the model
     * had to answer a sentence with the object removed.
     *
     * Trusted for nothing: it is looked up in the layout, and an id that is not
     * there is dropped rather than repeated to the model.
     */
    selected?: string | null;
  };

  if (!layout || !Array.isArray(layout.content) || typeof instruction !== "string") {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const trimmed = instruction.trim();
  if (!trimmed) return NextResponse.json({ error: "empty instruction" }, { status: 400 });
  // A cap, not a validation: long pasted essays cost tokens and produce worse
  // operations than a sentence does.
  if (trimmed.length > 500) {
    return NextResponse.json({ error: "instruction too long" }, { status: 400 });
  }

  // The customer's own 版式 and 配色, resolved from their session rather than
  // sent by the browser. Absent for a project that has not reached 风格选择 --
  // buildDesignDoc returns null and the prompt simply carries no brief, which
  // is the behaviour every call had before this existed.
  const { data: project } = await supabase
    .from("projects")
    .select("id, style, palette")
    .eq("account_id", user.id)
    .single();
  const designDoc = buildDesignDoc(project?.style, project?.palette);

  /*
    HIS OWN FIGURES, READ AS HIM.

    The sixteenth 「能力有、线没接」: 总览's four numbers have been counted from
    his own books since 2026-09-01, and the assistant could not see one of
    them. 「这个月收了多少」 was being answered by a model looking at a page
    description -- so the best case was a guess and the worst was a number.

    ⚠️ THE SESSION CLIENT, NOT THE SERVICE ROLE. Everything above uses the
    service role, which is right for reading the project row. It is wrong
    here, and the difference is not stylistic: a 师傅 added under 员工帐号
    cannot see 收款, and the only thing enforcing that is row-level security
    on HIS connection. The service role carries no identity, so it would
    answer him -- politely, in one sentence, with his boss's month.

    Bounded by the same rules as the page, so a figure that is wrong here is
    wrong there too and one fix covers both.
  */
  /*
    🔴 NOT A COLUMN ON projects, AND THE FIRST VERSION OF THIS BLOCK SAID IT WAS.

    It selected `business_context` beside style and palette. There is no such
    column, and PostgREST fails the WHOLE query for one bad name -- so `project`
    came back null and took the design brief and the record-writing path down
    with it. Silently. The route still answered 200 and the assistant still
    replied in fluent sentences, about a page it could no longer see.

    tsc was clean. 814 tests passed. The only thing that found it was asking
    the assistant a real question as a real customer, which is what 重点 26 is
    for and why it is written the way it is.

    The context lives behind get_my_business_context (20260820120000), which is
    security definer and resolves the project from auth.uid() -- so it needs
    the CUSTOMER'S session, exactly like add_pipeline_record further down.
  */
  const asReader = await createSessionSupabaseClient();
  const { data: ctxRow } = await asReader.rpc("get_my_business_context");
  const ctx = (ctxRow ?? null) as BusinessContext | null;
  const pageRefs = (Array.isArray(pages) ? pages : []).map((p) => ({
    key: String(p.key),
    label: String(p.label ?? ""),
  }));
  let facts: Awaited<ReturnType<typeof fetchBusinessFacts>> = null;
  if (project?.id && ctx) {
    const nouns = tradeLabels(ctx, pageRefs);
    facts = await fetchBusinessFacts(
      asReader,
      project.id as string,
      pageRefs.map((r) => r.key),
      { customer: nouns.customer, pipeline: nouns.order },
      dashboardRecordModule(pageRefs),
      workflowStages(ctx),
      systemLangOf(ctx),
    );
  }
  const factsBlock = renderBusinessFacts(facts);

  const pageList = (Array.isArray(pages) ? pages : [])
    .map((p) => `${p.key} ("${p.label}")`)
    .join(", ");

  const recent = renderHistory(history);

  /*
    THE UNCHANGING HALF GOES FIRST.

    A provider prompt cache is a PREFIX match: what it pays for is not how much
    of two requests is identical, it is how much is identical BEFORE the first
    byte that differs. This message used to open with the page listing, which
    is the single most volatile thing in it -- it changes the moment the owner
    edits anything -- and every fixed token behind it was stranded: the
    component catalogue, the block rules, the editable fields, his design
    brief, the palette facts. All of those are the same from one sentence to
    the next, and all of them sat behind the one line that moves.

    Measured with `npm run eval:editor -- --prefix`, which builds these exact
    prompts and finds where two of them stop agreeing:

        he says a second thing, after his first edit landed
          listing first     5,668 of 7,545 reusable   75%
          catalogue first   7,316 of 7,545 reusable   97%

    ~1,650 tokens a call paid at full rate for no reason. The sentence stays
    last, where recency helps it; the listing moves down beside it, so the two
    volatile things sit together with everything fixed above them.
  */
  /* Verified against the page rather than believed. An id the layout does not
     contain would put the model in front of a block that is not there, which is
     a worse starting point than no selection at all. */
  const here =
    typeof selected === "string" && selected
      ? (hasBlock(layout, selected) ? selected : null)
      : null;

  const userPrompt = `Components you may add: ${REGISTERED_COMPONENTS.join(", ")}
${renderBlockRules() ? `这些块自己的规矩（字段名看不出来的）:
${renderBlockRules()}
` : ""}
Text fields you may set: ${EDITABLE_TEXT_FIELDS.join(", ")}
Pages in this system: ${pageList || "(unknown)"}
This page: ${generated
  ? "never saved -- 排法 (layout) will re-generate it, so it is available"
  : "ALREADY SAVED by the customer -- 排法 (layout) CANNOT take effect on it. Reorder with move_component."}

${designDoc ? `
${designDoc}
` : ""}${
  darkPalettes().length
    ? `明暗（从配色量出来的）: 深底的配色只有 ${darkPalettes().join("、")}。
「太亮了」「晚上看刺眼」「暗一点」用它回答，不要换风格 ——
一套深底配色套在任何一套风格上都是深色页面，而换风格会丢掉他可能喜欢的版面。
其他每一套配色的底都是近白的，拿它们回答「太亮」等于承诺一个他看不到的变化。
` : `明暗（从配色量出来的）: 现在没有任何一套配色是深底的，每一套的底都近白。
「太亮了」只能用更暗的风格回答，拿配色回答等于承诺一个他看不到的变化。
`}
${factsBlock ? `${factsBlock}\n\n` : ""}Blocks currently on this page:
${describeLayout(layout, here)}
${recent ? `\n刚才这段对话里发生过的事（最新的在最下面）:\n${recent}\n` : ""}
The business owner asked:
"${trimmed}"`;

  /*
    THE ONLY HOST WE FORWARD.

    `imageUrl` arrives from the browser and is handed to OpenAI, so an
    unchecked value is a request forger's tool aimed at our own bill -- and at
    anything reachable from OpenAI's fetchers. It must be a file in our own
    Supabase storage, matched on HOSTNAME rather than prefix, because
    「<ref>.supabase.co.evil.test」 starts with the right letters.
  */
  const safeImage = (() => {
    if (!imageUrl) return null;
    try {
      const u = new URL(imageUrl);
      const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
      if (u.protocol !== "https:") return null;
      if (u.hostname.toLowerCase() !== base.hostname.toLowerCase()) return null;
      if (!u.pathname.includes("/site-photos/")) return null;
      return u.toString();
    } catch {
      return null;
    }
  })();

  let parsed;
  /* Started here rather than inside the try, so a call that throws still has a
     duration to record. See recordAiUsage: a failed call is the one worth
     recording most, and it is also the one most likely to be slow. */
  const startedAt = Date.now();
  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      reasoning_effort: AI_REASONING_EFFORT,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          // A picture only when the owner attached one AND it is ours. See the
          // note on `imageUrl`: this URL is forwarded to OpenAI, so accepting
          // an arbitrary host would let a caller point our account's bandwidth
          // at anything on the internet.
          content: safeImage
            ? [
                { type: "text" as const, text: userPrompt },
                { type: "image_url" as const, image_url: { url: safeImage } },
              ]
            : userPrompt,
        },
      ],
      response_format: { type: "json_schema", json_schema: EDIT_JSON_SCHEMA },
    });
    // parseLayoutOps, not layoutOpsSchema.parse: one malformed operation used
    // to reject the whole answer, so a batch of five good edits and one bad one
    // came back as a 502 with nothing changed. See its note in layout-ops.ts.
    /*
      Recorded before the parse, because a reply that fails to parse still cost
      the money. Awaited and error-swallowing -- see recordAiUsage: accounting
      must never be the reason an edit fails in front of a customer.
    */
    await recordAiUsage(supabase, "edit", AI_MODEL, completion.usage, {
      tookMs: Date.now() - startedAt,
    });
    parsed = parseLayoutOps(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
  } catch (err) {
    console.error("layout edit failed", err);
    /*
      A FAILURE IS A ROW TOO.

      console.error lands in the hosting platform's log viewer, which the
      founder does not read and which expires. Without this line the only
      way anybody learns that the assistant has stopped working is a customer
      saying so -- and a ledger that records successes only reports a healthy
      100% while every call is failing.

      Swallowed and awaited like the success path: accounting must never be
      the reason an edit fails in front of a customer, and the 502 below is
      returned either way.
    */
    await recordAiUsage(supabase, "edit", AI_MODEL, null, {
      outcome: "failed",
      tookMs: Date.now() - startedAt,
    });
    // No fallback here, unlike /api/analyze. Guessing at an edit nobody asked
    // for is worse than saying "I did not understand that" -- the customer's
    // design is already on screen and unharmed, and they can rephrase.
    return NextResponse.json({ error: "edit failed" }, { status: 502 });
  }

  /*
    A ROW ON THESE FOUR PAGES IS A RECORD, NOT A LAYOUT ROW.

    founder-points 23 -- the assistant calls the same business action the
    button calls. Written here rather than sent to the browser because a
    quotation is not an unsaved tree the customer can undo; it is a row in
    their books, and it goes through `add_pipeline_record` so the document
    number, the workflow stage, the idempotency key and RLS all apply to it
    exactly as they do to the button.

    On every other module a table row is still a layout row, and stays one.
  */
  const split = splitRecordOps(parsed.operations, pageKey);
  let recordsWritten = 0;
  let asCustomerForRows: Awaited<ReturnType<typeof createSessionSupabaseClient>> | null = null;
  const recordSkips: { op: string; reason: string }[] = [];
  if (split.recordOps.length && project?.id && isRecordModule(pageKey)) {
    /*
      THE CUSTOMER'S OWN SESSION, NOT THE SERVICE ROLE.

      Everything else in this route uses the service-role client, which is
      right for the ledger and for reading the project. It is wrong here:
      `add_pipeline_record` resolves the project from auth.uid(), and the
      service role has none -- the first real call came back「not your
      project」 while the assistant said it had added the quotation.

      Passing the account id instead and keeping the service role would have
      worked and would have been the wrong fix: it bypasses RLS, which is
      precisely what founder-points 23 says not to do. The button goes
      through the customer's session; so does this.
    */
    const asCustomer = await createSessionSupabaseClient();
    /* Kept for the projection below, which has to read the rows back as the
       customer too -- RLS is what bounds it, and the service role would
       cheerfully return another business's. */
    asCustomerForRows = asCustomer;
    const wrote = await writeRecords(
      asCustomer,
      project.id as string,
      pageKey as string,
      split.recordOps,
      `${user.id}:${trimmed}`,
      /* Which column each cell belongs to, read from the page the customer is
         looking at. A key that is not one of the built-in four is a column
         this business added for itself, and its value goes to `extra` instead
         of being dropped -- which is what made 「加一栏车牌号」 produce a
         column that stayed blank for ever. */
      /* ⚠️ And when the id resolves to nothing, the page's own first record
         table rather than a positional guess. A directory page has three
         columns where a quotations page has four, so the guess reads 「新客户」
         as an amount and drops it -- see the last-resort note in sortCells.
         Every generated page has exactly one record table, so this is the
         same table the 加一单 form writes into. */
      (targetId) =>
        tableColumnKeys(layout, targetId) ??
        firstRecordTable(layout)?.columns.map((c) => c.key) ??
        null,
    );
    recordsWritten = wrote.written;
    recordSkips.push(...wrote.skipped);
  }

  const result = applyLayoutOps(layout, split.layoutOps, preferredVariants(project?.style));

  /*
    THE ROW HE JUST WROTE HAS TO BE ON THE PAGE HE IS LOOKING AT.

    A record does not live in this tree -- it is a row in pipeline_records,
    ledger_entries or directory_entries -- so `result.layout` comes back
    without it, and the browser dispatches that tree into Puck. The reply said
    「加了客户陈先生」 and the table did not move: the same shape as the eleven
    before it, found by eval:browser rather than by him.

    ⚠️ `refetch` below is NOT the fix and never was. It calls router.refresh(),
    which re-renders the server tree -- and Puck owns the canvas state once it
    is mounted, which is exactly what the comment about 排法 in ai-assistant.tsx
    says. It is kept because the rail and its counts are server-rendered; the
    rows arrive here.

    Through the SAME projection page.tsx uses, deliberately: two copies of
    「which rows belong on this page」 would drift, and the drift would show as
    the assistant's version of the table disagreeing with the reload's.
  */
  if (recordsWritten > 0 && project?.id && asCustomerForRows) {
    const { data: ctx } = await asCustomerForRows.rpc("get_my_business_context");
    result.layout = (await withFreshRows(
      asCustomerForRows,
      result.layout as unknown as Record<string, unknown>,
      project.id as string,
      pageKey as string,
      (ctx as BusinessContext | null) ?? {},
    )) as unknown as typeof result.layout;
  }
  // Whatever the schema turned away is reported beside whatever the applier
  // turned away: to the customer they are the same thing -- something they
  // asked for that did not happen -- and both belong in the same list.
  result.skipped = [...parsed.rejected, ...result.skipped, ...recordSkips];
  result.applied += recordsWritten;

  return NextResponse.json({
    layout: result.layout,
    explanation: parsed.explanation,
    applied: result.applied,
    /* The new rows are in the database, not in the tree we just returned, so
       the page has to be re-read to show them. Without this the assistant
       says it added a quotation and the table does not move -- the exact
       defect founder-points 23 is about. */
    refetch: recordsWritten > 0,
    skipped: result.skipped,
    suggestion: resolveSuggestion(parsed.suggestion, Array.isArray(pages) ? pages : [], result.layout as PuckLayout),
    design: validDesign((parsed as { design?: unknown }).design, generated !== false, result.skipped),
  });
}


/**
 * The last few turns, as lines the model reads.
 *
 * EXPORTED SO THE RULER USES THE REAL ONE. eval-editor.mjs already imports
 * SYSTEM_PROMPT from here for the same reason: a second copy of the format
 * drifts, and then the eval is measuring a prompt nobody ships.
 *
 * Rendered as FACTS ABOUT THE PAGE'S PAST rather than passed as prior chat
 * turns on purpose -- handed back as assistant messages, a model starts
 * treating them as unfinished business and redoes them. Trimmed hard, so a
 * customer who types an essay cannot push the actual instruction out of the
 * model's attention.
 */
export function renderHistory(
  history: { asked?: string; did?: string; reverted?: boolean }[] | undefined,
): string {
  return (Array.isArray(history) ? history : [])
    .slice(-3)
    .map((h) => {
      const asked = String(h?.asked ?? "").trim().slice(0, 200);
      const did = String(h?.did ?? "").trim().slice(0, 200);
      if (!asked && !did) return "";
      return `  - 他说「${asked}」→ 你做了「${did}」${h?.reverted ? "（他已经撤销了这一次）" : ""}`;
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * The model asked for a register, a palette or an arrangement. Is it one?
 *
 * Every name is checked against the list the PRODUCT renders from, not against
 * a copy: a register cut yesterday is gone from STYLE_ORDER, so an assistant
 * that still remembers 「玻璃」 gets a null and says so, rather than writing a
 * value the database's CHECK will then refuse in front of the customer.
 *
 * Returns only what is both present AND real. `null` for a field the customer
 * did not ask about is the normal case and not an error.
 */
function validDesign(
  raw: unknown,
  /** False once the customer has saved: see the `generated` field on the body. */
  canRegenerate: boolean,
  /** The same list the applier's rejections go into. An arrangement we refuse
   *  is something the owner asked for that will not happen, which is exactly
   *  what that list is, and dropping it silently is how this bug read to them
   *  in the first place. */
  skipped: { op: string; reason: string }[],
): { style?: string; palette?: string | null; layout?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const out: { style?: string; palette?: string | null; layout?: string } = {};

  const style = typeof d.style === "string" ? d.style.trim() : "";
  if (style && (STYLE_ORDER as readonly string[]).includes(style)) out.style = style;

  const palette = typeof d.palette === "string" ? d.palette.trim() : "";
  // 「拿掉配色」 is a real request and its answer is null, which is why this
  // distinguishes the empty string from the absent field.
  if (palette === "none") out.palette = null;
  else if (palette && PALETTE_ROWS.some((p) => p.key === palette)) out.palette = palette;

  const layout = typeof d.layout === "string" ? d.layout.trim() : "";
  if (layout && Object.keys(LAYOUT_SETS).includes(layout)) {
    /*
      A SAVED PAGE CANNOT BE RE-ARRANGED, AND THE MODEL IS TOLD SO.

      page.tsx builds from `projects.layout` only while `layout_json` is still
      empty. After the first save the column is never read again, so writing it
      changes a row and nothing else -- which is precisely how 「已将总览改为表格
      先行」 came to be said over a page that had not moved. The prompt already
      steers a saved page to move_component; this is the backstop for the turn
      where it answers 排法 anyway.
    */
    if (canRegenerate) out.layout = layout;
    else skipped.push({ op: "design.layout", reason: "这一页已经保存过，排法只能用搬动区块来换" });
  }

  return Object.keys(out).length ? out : null;
}

/** Page types `add_project_page` knows how to build. Mirrors the same list in
 *  the RPC and in add-page-dialog.tsx; `dashboard` is excluded because every
 *  system already has one. */
const KNOWN_PAGE_TYPES = ["customers", "quotations", "projects", "payments", "bookings", "orders"];

/**
 * Turns the model's proposal into something the button can act on, or into
 * nothing.
 *
 * Everything here is a reality check, not a permission check -- the RPC behind
 * the button resolves the project from `auth.uid()` and refuses to delete the
 * dashboard on its own, so nothing below is what stops a bad write. What it
 * stops is a BUTTON THAT FAILS: an offer to delete a page the customer does not
 * have, or to add a page type that does not exist, is worse than no offer,
 * because they have to press it to find out.
 */
function resolveSuggestion(
  suggestion: PageSuggestion | null | undefined,
  pages: { key: string; label: string }[],
  /** The page as it stands AFTER the operations ran, so an offer can point at
   *  a block this same turn just added. */
  layout?: PuckLayout,
): {
  action: "add_page" | "remove_page" | "pick_photo";
  pageKey: string | null;
  title: string;
  label: string;
  blockId?: string;
} | null {
  if (!suggestion || suggestion.action === "none") return null;

  /*
    OFFERING TO OPEN A PICTURE SLOT.

    Checked against the page rather than trusted, like every other offer here:
    a button that opens nothing is worse than no button, because he has to
    press it to find out. The block must exist AND be one that owns a photo
    field -- 「帮我换第一屏的照片」 aimed at a table is a button that would open
    a panel with no picture in it.
  */
  if (suggestion.action === "pick_photo") {
    const id = suggestion.block_id?.trim();
    if (!id || !layout) return null;
    const node = walkNodes(layout.content ?? []).find((n) => String(n.props?.id) === id);
    if (!node || !PHOTO_BLOCKS.includes(node.type)) return null;
    return { action: "pick_photo", pageKey: null, title: node.type, label: node.type, blockId: id };
  }

  if (suggestion.action === "add_page") {
    const key = suggestion.page_key && KNOWN_PAGE_TYPES.includes(suggestion.page_key)
      ? suggestion.page_key
      : null;
    const title = (suggestion.page_title ?? "").trim().slice(0, 24);
    // A custom page is created from its title, so without one there is nothing
    // to create. A known type can carry an empty title -- it takes its label
    // from the trade's own vocabulary, as it always has.
    if (!key && !title) return null;
    // Already there: adding it again is a no-op in the RPC, so offering it
    // would be a button that visibly does nothing.
    if (key && pages.some((p) => p.key === key)) return null;
    return { action: "add_page", pageKey: key, title, label: title || "新页面" };
  }

  const target = pages.find((p) => p.key === suggestion.page_key);
  if (!target || target.key === "dashboard") return null;
  return { action: "remove_page", pageKey: target.key, title: target.label, label: target.label };
}

/**
 * The strict schema sent to OpenAI. Written out rather than derived from the
 * Zod union because structured outputs need every branch's fields listed as
 * `required` with nullable types for the optional ones -- a generated schema
 * that silently drops a constraint is exactly the failure this endpoint is
 * built to avoid.
 */
export const EDIT_JSON_SCHEMA = {
  name: "layout_edit",
  strict: true,
  schema: {
    type: "object",
    properties: {
      operations: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          properties: {
            op: {
              type: "string",
              enum: [
                "set_text",
                "add_component",
                "remove_component",
                "move_component",
                "add_table_row",
                "add_table_column",
                "remove_table_column",
                "set_table_column",
                "set_workflow",
                "set_variant",
                "set_copy",
              ],
            },
            target_id: { type: ["string", "null"] },
            // set_copy only. A dot path inside a pulled section's own copy
            // object; not enum-constrained because the keys belong to whichever
            // section was pulled. A wrong path is dropped with a reason.
            path: { type: ["string", "null"] },
            field: { type: ["string", "null"], enum: [...EDITABLE_TEXT_FIELDS, null] },
            value: { type: ["string", "null"] },
            component: { type: ["string", "null"], enum: [...REGISTERED_COMPONENTS, null] },
            after_id: { type: ["string", "null"] },
            // move_component only. The block this one lands in FRONT of; null
            // sends it to the end. An id rather than an index, because an index
            // is a number the model has to count to from a list that has just
            // changed under it.
            before_id: { type: ["string", "null"] },
            title: { type: ["string", "null"] },
            column_key: { type: ["string", "null"] },
            column_label: { type: ["string", "null"] },
            column_kind: { type: ["string", "null"], enum: [...COLUMN_KINDS, null] },
            cells: { type: ["array", "null"], items: { type: "string" } },
            status_tone: {
              type: ["string", "null"],
              enum: ["positive", "warning", "negative", "neutral", null],
            },
            stages: { type: ["array", "null"], items: { type: "string" } },
            // Not enum-constrained: the valid ids depend on the block being
            // targeted, which the model reads off that block's own
            // options=[...] listing. A wrong id is dropped by set_variant with
            // a reason, never applied to the wrong block.
            variant_id: { type: ["string", "null"] },
          },
          required: [
            "op",
            "target_id",
            // Strict structured output requires EVERY property to appear here,
            // nullable rather than omitted. Adding `path` to `properties` and
            // not to this list is what made the endpoint answer 502 on the
            // first real 用讲的改 request after set_copy shipped.
            "path",
            "field",
            "value",
            "component",
            "after_id",
            "before_id",
            "title",
            "column_key",
            "column_label",
            "column_kind",
            "cells",
            "status_tone",
            "stages",
            "variant_id",
          ],
          additionalProperties: false,
        },
      },
      explanation: { type: "string" },
      // Always present, usually "none". A separate field rather than another
      // operation because it is a proposal the customer confirms, not a change
      // this route makes -- see pageSuggestionSchema for why that line is where
      // it is.
      /*
        THE THREE THINGS THAT ARE NOT IN THE LAYOUT.

        Every operation above edits the page's own tree. 风格, 配色 and 排法 are
        not in that tree -- they are columns on `projects`, read at render time,
        which is exactly what makes 换风格 instant. So the assistant could
        rewrite a table's columns and could not answer 「换成深色一点的」, which
        is one of the first things anybody says to it.

        Returned beside the operations rather than as one of them, because it
        is applied differently: the browser calls set_project_style, the same
        RPC the style picker calls, so it goes through the same paid gate and
        the same validation. Three nulls means the customer asked for nothing
        of the kind, which is almost every turn.
      */
      design: {
        type: "object",
        properties: {
          style: { type: ["string", "null"] },
          palette: { type: ["string", "null"] },
          layout: { type: ["string", "null"] },
        },
        required: ["style", "palette", "layout"],
        additionalProperties: false,
      },
      suggestion: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["add_page", "remove_page", "pick_photo", "none"] },
          page_title: { type: ["string", "null"] },
          page_key: { type: ["string", "null"] },
          // pick_photo only: the id of the block whose picture slot to open.
          // Checked against the finished page before it becomes a button.
          block_id: { type: ["string", "null"] },
        },
        required: ["action", "page_title", "page_key", "block_id"],
        additionalProperties: false,
      },
    },
    required: ["operations", "explanation", "design", "suggestion"],
    additionalProperties: false,
  },
} as const;

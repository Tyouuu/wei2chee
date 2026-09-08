// "use client" BECAUSE THIS COMPONENT NOW READS THE REGISTER. An absent variant
// prop means "follow the 版式", which is a React context lookup, and a context
// cannot be read from a server component. The portal's page route renders Puck's
// <Render> on the SERVER -- the editor is a client tree, but the saved page is
// not -- so without this the first paint of every customer page threw. Nothing
// else here needs the client; the props are all serialisable data.
"use client"

import type { ReactNode } from "react"
import { useRegisterProp } from "@/design-system/editor/style-scope"

export type WorkflowStage = {
  /** The stage's name in the business's own words — "报价", "订金", "施工". */
  label: string
  /** How many records are sitting at this stage right now. */
  count?: string
  /** Marks the stage the business is currently bottlenecked at. */
  tone?: "normal" | "attention"
}

/**
 * A business's pipeline, drawn as the row of stages it actually is.
 *
 * WHY THIS COMPONENT EXISTS: the single most valuable thing the AI produces
 * about a customer's business is its recommended workflow — "客户 → 报价 →
 * 订金 → 施工 → 尾款". Before this component there was nowhere to put it. The
 * registered set could render a table of records, a filter row and a headline
 * number, but nothing that showed a PROCESS, so the analysis's most
 * business-specific output had to be crammed into filter chips, where six
 * stages read as six applied filters rather than as a pipeline.
 *
 * It is deliberately not a chart and not interactive: it is the diagram a
 * business owner draws on a whiteboard when asked "how does a job move through
 * your shop", which is exactly the thing they are being asked to confirm or
 * correct in the editor.
 *
 * Every measurement reads from the style's own axis tokens, so the same
 * pipeline renders as a tight ruled ops strip under Ledger and a row of soft
 * rounded pills under Hearth.
 */
export function WorkflowStrip({
  title,
  stages,
  layout,
}: {
  /** ReactNode so the editor can make it editable in place. */
  title?: ReactNode
  stages: WorkflowStage[]
  /** `row` is the whiteboard drawing: left to right, arrows between stages.
      `timeline` is the same pipeline turned down the page, which is the only
      one of the three that survives a 390px screen -- five stages wrap the row
      into three ragged lines. `numbered` drops the boxes entirely, for a
      freshly drafted pipeline that has no counts in it yet. */
  layout?: "row" | "timeline" | "numbered" | "ruled" | "track"
}) {
  // Absent means "follow the register", not "row" -- see style-scope.tsx.
  /*
    THE HOOK IS CALLED UNCONDITIONALLY, THE FALLBACK IS APPLIED AFTER.

    This read `prop ?? useRegisterProp(...) ?? default` on one line, which is
    the precedence rule stated exactly right and executed exactly wrong: `??`
    SHORT-CIRCUITS, so when the customer's own prop is present the hook is
    never called. useRegisterVariant is useContext + useMemo -- two hook slots
    -- so the number of hooks this component calls changed with its props.
    React matches hooks positionally, so that is either "rendered fewer hooks
    than expected" or, worse, a memo silently read from the wrong slot; in
    RecordTable, where there were TWO of these in a row, the second could take
    the first one's place.

    Splitting the line changes no semantics -- the hook is pure and its result
    is still the middle term of the same precedence chain -- and it makes the
    hook count constant. Found by `npm run lint`, which had never once run:
    there was no eslint config in the repository, so `react-hooks/rules-of-hooks`
    has been switched off for this codebase's entire life.
  */
  const layoutPref = useRegisterProp<"row" | "timeline" | "numbered" | "ruled" | "track">(
    "WorkflowStrip",
    "layout",
  )
  const lay = layout ?? layoutPref ?? "row"
  if (stages.length === 0) return null

  return (
    <section
      className="ds-card w-full [padding:var(--pad-card)]"
      style={{
        // Hearth sets --border-card-width to 0 and separates cards by shadow
        // alone; Ledger sets --shadow-card to none and separates them by a
        // hard border. Declaring both, each driven by its own token, is what
        // lets one component express both languages without a style prop.
        borderWidth: "var(--border-card-width)",
        borderStyle: "solid",
        borderColor: "var(--color-ink-800)",
      }}
    >
      {title && (
        <h2 className="mb-[var(--gap-stack)] [color:var(--color-paper-dim)] [font-size:var(--text-micro)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
          {title}
        </h2>
      )}

      {lay === "ruled" ? (
        /*
          一条一行，中间只有细线。

          抄的是 Gentelella v4 的 project_detail（MIT · ★21.5k）那张 Tasks 卡：
          每一步一行、左边一个窄的序号栏、名字、右边一个数字，行与行之间只有
          一条细线 —— 没有框、没有点、没有轨道。

          ⚠️ **它跟 timeline 不是同一个东西，差别不在装饰**：timeline 画的是
          「这几步是连着的」（所以有一条贯穿的轨道跟点），ruled 画的是
          「这里有一张清单」。一个讲流动，一个讲盘点。

          ⚠️ 故意没有打勾框。原始那张卡是打勾的，但我们不知道哪一步「做完了」
          —— 我们只知道 AI 标了哪一步是瓶颈。画一个永远不打勾的框，
          或者靠位置推断「前面的都做完了」，两个都是在页面上讲一句我们不知道
          真假的话。
        */
        <ol className="flex flex-col">
          {stages.map((stage, i) => (
            <li
              key={`${stage.label}-${i}`}
              className="flex items-baseline [gap:var(--gap-inline)] [padding-block:var(--pad-control-y)]"
              style={
                i > 0
                  ? {
                      borderTopWidth: "var(--hairline)",
                      borderTopStyle: "solid",
                      borderTopColor: "var(--border-subtle)",
                    }
                  : undefined
              }
            >
              <span
                aria-hidden
                className="w-[1.5em] shrink-0 [font-family:var(--font-numeric)] [font-size:var(--text-micro)] [letter-spacing:var(--tracking-label)]"
                style={{
                  color:
                    stage.tone === "attention"
                      ? "var(--color-primary)"
                      : "var(--color-paper-dim)",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className="min-w-0 flex-1 [font-size:var(--text-sm)]"
                style={{
                  color:
                    stage.tone === "attention"
                      ? "var(--color-primary)"
                      : "var(--color-paper)",
                  fontWeight:
                    stage.tone === "attention"
                      ? "var(--fw-semibold)"
                      : "var(--fw-regular)",
                }}
              >
                {stage.label}
              </span>
              {stage.count && (
                <span className="tnum shrink-0 [color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
                  {stage.count}
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : lay === "track" ? (
        /*
          一条轨道，点在轨道上，名字在下面。

          抄的是 arhamkhnz 那张 Logistics 的运单卡（MIT）：起点跟终点之间一条
          虚线，中间一个记号说「现在在这里」。同一个形状在每一家的订单追踪页
          上都看得到，而**我们的客户天天在收这种通知**（Shopee、J&T）——
          它是这个市场最不用解释的一个图。

          ⚠️ 跟 row 的差别是结构，不是漆：row 是**一串盒子**，每个盒子自己有底、
          有框、有内距；track 是**一条线**，盒子全部拿掉，只剩线、点、字。
          换个配色它还是两个不同的东西。
        */
        <ol className="flex items-start">
          {stages.map((stage, i) => (
            <li
              key={`${stage.label}-${i}`}
              className="relative flex min-w-0 flex-1 flex-col items-center"
            >
              {/* 轨道分成两截画（左半、右半），因为第一颗点的左边跟最后一颗点的
                  右边都不该有线 —— 一条画满的轨道会伸进空白里，看起来像还有
                  一步没画出来。 */}
              <span
                aria-hidden
                className="absolute left-0 right-1/2 h-px"
                style={{
                  top: 5,
                  backgroundColor: i === 0 ? "transparent" : "var(--border-subtle)",
                }}
              />
              <span
                aria-hidden
                className="absolute left-1/2 right-0 h-px"
                style={{
                  top: 5,
                  backgroundColor:
                    i === stages.length - 1 ? "transparent" : "var(--border-subtle)",
                }}
              />
              <span
                aria-hidden
                className="relative size-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    stage.tone === "attention"
                      ? "var(--color-primary)"
                      : "var(--color-canvas)",
                  boxShadow:
                    stage.tone === "attention"
                      ? "none"
                      : "inset 0 0 0 var(--hairline) var(--border-subtle)",
                }}
              />
              <span
                className="mt-2 text-center [font-size:var(--text-xs)] [padding-inline:2px]"
                style={{
                  color:
                    stage.tone === "attention"
                      ? "var(--color-primary)"
                      : "var(--color-paper)",
                  fontWeight:
                    stage.tone === "attention"
                      ? "var(--fw-semibold)"
                      : "var(--fw-regular)",
                }}
              >
                {stage.label}
              </span>
              {stage.count && (
                <span className="tnum [color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-micro)]">
                  {stage.count}
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : lay === "timeline" ? (
        <ol className="flex flex-col">
          {stages.map((stage, i) => (
            <li key={`${stage.label}-${i}`} className="flex [gap:var(--gap-inline)]">
              {/* The rail is one column: a dot per stage, and the segment of
                  rule that connects it to the next one. Drawing the rule as a
                  flex-grow child rather than as a border on the <li> keeps it
                  from running past the last dot into empty space. */}
              <div className="flex flex-col items-center">
                <span
                  aria-hidden
                  className="mt-1.5 size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      stage.tone === "attention"
                        ? "var(--color-primary)"
                        : "var(--color-paper-dim)",
                  }}
                />
                {i < stages.length - 1 && (
                  <span
                    aria-hidden
                    className="w-px flex-1"
                    style={{ backgroundColor: "var(--border-subtle)", minHeight: 18 }}
                  />
                )}
              </div>
              {/* One line per stage, spanning the card: ordinal and name on
                  the left margin, count on the right. Stacking the three in a
                  40px column made a timeline that ignored five sixths of the
                  width it was given and read as a rendering fault. */}
              <div
                className={`flex min-w-0 flex-1 items-baseline [gap:var(--gap-inline)] ${
                  i < stages.length - 1 ? "pb-[var(--gap-stack)]" : ""
                }`}
              >
                <span className="[color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-micro)] [letter-spacing:var(--tracking-label)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="min-w-0 flex-1 [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]"
                  style={{
                    color:
                      stage.tone === "attention"
                        ? "var(--color-primary)"
                        : "var(--color-paper)",
                  }}
                >
                  {stage.label}
                </span>
                {stage.count && (
                  <span className="shrink-0 [color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
                    {stage.count}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : lay === "numbered" ? (
        <ol className="flex flex-wrap [gap:var(--gap-section)]">
          {stages.map((stage, i) => (
            <li key={`${stage.label}-${i}`} className="min-w-[84px]">
              {/* No box, no arrow. The numeral is set at hero scale and dimmed
                  so it reads as an ordinal rather than as a figure the reader
                  is supposed to add up -- these are step numbers, and a
                  business owner scanning a dashboard should never mistake one
                  for money. */}
              <span
                className="tnum block leading-none [font-family:var(--font-numeric)] [font-size:var(--text-2xl)] [font-weight:var(--fw-semibold)]"
                style={{
                  color:
                    stage.tone === "attention"
                      ? "var(--color-primary)"
                      : /* 🔴 本来是 var(--border-subtle) —— **拿分隔线的颜色在写字**。
                           2026-09-08 `audit:product` 量出来 **1.24:1**（24px 要 3:1），
                           也就是六格里只有当前那一格看得见，其余五格几乎不存在。
                           这个仓库记过同一条（[任务 24]：分隔符的 token 拿来写句子）。
                           --color-paper-dim 才是「淡一点的字」那个 token，
                           而两行底下那个笔数本来就在用它 —— 层次没有丢，只是读得到了。 */
                        "var(--color-paper-dim)",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="mt-1.5 [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                {stage.label}
              </div>
              {stage.count && (
                <div className="[color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
                  {stage.count}
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
      <ol
        className="grid items-stretch [gap:var(--gap-inline)]"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))" }}
      >
        {stages.map((stage, i) => (
          <li key={`${stage.label}-${i}`} className="flex min-w-0 items-center [gap:var(--gap-inline)]">
            {/* The connector LEADS each stage after the first, rather than
                trailing each stage before the last. Both are correct on one
                line; only this one survives a wrap. Trailing arrows left a "→"
                dangling at the end of the first row, pointing at nothing, with
                the wrapped stage below starting bare -- seen with a real
                five-stage renovation pipeline in a narrow column. Leading
                arrows make a wrapped row read as a continuation instead. */}
            {i > 0 && (
              <span aria-hidden className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
                →
              </span>
            )}
            <div
              className="flex min-w-0 flex-1 flex-col [border-radius:var(--radius-md)] [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)]"
              style={{
                backgroundColor:
                  stage.tone === "attention"
                    ? "var(--color-primary-soft)"
                    : "var(--color-ink-850)",
                borderWidth: "var(--hairline)",
                borderStyle: "solid",
                borderColor:
                  stage.tone === "attention" ? "var(--color-primary)" : "var(--border-subtle)",
              }}
            >
              {/* The stage index. Under Ledger this is the drafted step number
                  an ops sheet would carry; under the softer registers it just
                  reads as a quiet ordinal. */}
              <span className="[color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-micro)] [letter-spacing:var(--tracking-label)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              {/*
                THE STAGE NAME IS THE CUSTOMER'S OWN WORD. IT DOES NOT GET CUT.

                Photographed 2026-08-26 on 蓝图, 招牌, 中台 and 印: six stages in
                one row printed 「Appro…」 「Depo…」 「Progr…」. These are the words
                the business gave us for its own pipeline -- the single thing on
                this page that says the system understood their trade -- and
                three of the six were an ellipsis.

                Same rule the KPI label got: a chip is allowed to be as wide as
                its word. The row already wraps, so a long stage pushes the next
                one to a second line instead of shortening itself.
              */}
              <span className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                {stage.label}
              </span>
              {stage.count && (
                <span className="[color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
                  {stage.count}
                </span>
              )}
            </div>

          </li>
        ))}
      </ol>
      )}
    </section>
  )
}

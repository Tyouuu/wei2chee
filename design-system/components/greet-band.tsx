"use client"

import { useRegisterProp } from "@/design-system/editor/style-scope"

/**
 * 问候带 —— 一页工作台的开场：左边一句对着人讲的话，右边几个安静的数字。
 *
 * ── 为什么有这一块 ────────────────────────────────────────────────────────
 * 老板 2026-09-03：`要弄组件就去新弄 反正总之能复刻到就好`。
 *
 * 原尺寸并排看，炉跟它抄的那一页（Ant Design Pro 的工作台）最大的一个差别
 * 不是颜色也不是间距：**他们那一页开场是一条问候带** —— 头像、一句
 * 「早安，吴彦祖」、右边三个用竖线隔开的数字 —— 而我们直接进卡片。
 * 那一条是「工作台」这个页型的签名，也是炉自己那句主张的样子：
 * **开系统的那一刻，客人就站在旁边。**
 *
 * ── 它讲的话必须是真的 ────────────────────────────────────────────────────
 * ⚠️ **没有「早安/午安」。** 那句话要看现在几点，而这一页是在伺服器上画出来的
 * —— 伺服器的时间不是他的时间，而且同一张缩图每拍一次就换一句。
 * 一句会自己变的问候语，是一句会被抓到说谎的话。
 *
 * ⚠️ 右边那几个数字**由外面算好传进来**，这里不算、不编。
 * 这一块只负责摆，不负责知道。
 *
 * ── 它跟指标排不一样，不要拿它当第二个指标排 ──────────────────────────────
 * 指标排是这一页的主角（大字、卡片、涨跌）；这一条是**上下文**：
 * 小字、没有卡、用一条竖线隔开。Ant 那一页两样都有，而且长得完全不同。
 */
export type GreetFigure = {
  label: string
  value: string
}

export function GreetBand({
  monogram,
  line,
  sub,
  figures = [],
  shape,
}: {
  /** 左边那个圆章里的一到两个字。给空的就不画圆章。 */
  monogram?: string
  /** 对着人讲的那一句。 */
  line: string
  /** 底下那行小字。 */
  sub?: string
  /** 右边那几个安静的数字。最多三个 —— 第四个开始就跟指标排抢戏了。 */
  figures?: GreetFigure[]
  /**
   * `banner` 是一张卡（Ant 的做法）·
   * `bare` 是直接铺在页面上，只有一条下缘线 ·
   * `stacked` 是数字掉到问候语底下，给窄栏跟手机。
   */
  shape?: "banner" | "bare" | "stacked"
}) {
  // 缺席的时候跟着风格走 —— 跟这个仓库其他组件同一条规矩。
  const pref = useRegisterProp<"banner" | "bare" | "stacked">("GreetBand", "shape")
  const look = shape ?? pref ?? "banner"
  const shown = (figures ?? []).slice(0, 3)

  const body = (
    <div
      className={`flex w-full min-w-0 ${
        look === "stacked" ? "flex-col [gap:var(--gap-stack)]" : "flex-wrap items-center justify-between [gap:var(--gap-section)]"
      }`}
    >
      <div className="flex min-w-0 items-center [gap:var(--gap-inline)]">
        {monogram ? (
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center [border-radius:var(--radius-pill)] [background:var(--color-primary-soft)] [color:var(--color-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]"
          >
            {monogram.slice(0, 2)}
          </span>
        ) : null}
        <div className="min-w-0">
          <div className="[font-size:var(--text-lg)] [font-weight:var(--fw-semibold)] [color:var(--color-paper)]">
            {line}
          </div>
          {sub ? (
            <div className="[font-size:var(--text-xs)] [color:var(--color-paper-dim)]">{sub}</div>
          ) : null}
        </div>
      </div>

      {shown.length ? (
        <div className="flex shrink-0 items-stretch">
          {shown.map((f, i) => (
            <div
              key={`${f.label}-${i}`}
              className="[padding-inline:var(--gap-section,var(--gap-stack))] first:[padding-left:0] last:[padding-right:0]"
              style={
                i > 0
                  ? {
                      borderLeftWidth: "var(--hairline)",
                      borderLeftStyle: "solid",
                      borderLeftColor: "var(--border-subtle)",
                    }
                  : undefined
              }
            >
              {/* 标签在上、数字在下 —— 抄的是 Ant 那三格（项目数 / 团队内排名 /
                  项目访问）。数字用等宽，因为三个并排的时候位数要对齐。 */}
              <div className="[font-size:var(--text-xs)] [color:var(--color-paper-dim)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
                {f.label}
              </div>
              <div className="tnum [font-family:var(--font-numeric)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)] [color:var(--color-paper)]">
                {f.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )

  if (look === "bare") {
    return (
      <section
        className="w-full [padding-block:var(--gap-stack)]"
        style={{
          borderBottomWidth: "var(--hairline)",
          borderBottomStyle: "solid",
          borderBottomColor: "var(--border-subtle)",
        }}
      >
        {body}
      </section>
    )
  }

  return (
    <section
      className="ds-card w-full [padding:var(--pad-card-lg)]"
      style={{
        borderWidth: "var(--border-card-width)",
        borderStyle: "solid",
        borderColor: "var(--color-ink-800)",
      }}
    >
      {body}
    </section>
  )
}

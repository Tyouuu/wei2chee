"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useSystemWords } from "@/design-system/system-lang-context";

/**
 * 客人自己在官网上订一个时段 —— 陌生人做得了的第四件事。
 *
 * ── 为什么它值得单独一块（2026-09-05）──────────────────────────────────
 *
 * 在这之前，一个陌生人在整个平台上做得了三件事：**看那一页 · 留一句话 ·
 * 打开自己那张单**。而里面十八个模块全部会写真资料。
 *
 * 而 `submit_site_booking` 跟 `public_booking_slots` 从写好那天起
 * **画面上一个入口都没有** —— 那支 migration 自己的档头就写着
 * 「今天还没有任何地方呼叫它们」。这一块就是那个入口。
 *
 * 🔴 它同时是[重点 9c](../../docs/founder-points.md) 那根护城河的一段：
 * 四家本地对手（Tunai · Aoikumo · StoreHub · SQL）**一家都不给生意一个
 * 对外的官网**，而沙龙那一单卖的就是「官网 ＋ 从官网直接进来的预约」。
 * 在这一块之前，那句话的后半段从来没有存在过。
 *
 * ── 它跟询价那一块的差别，一句话 ────────────────────────────────────────
 *
 * 询价是**留一句话**，这一块是**占一个钟头**。所以它多了两件询价没有的事：
 * 它要先问「哪几个时段被占着」，而且**两个人可以同时按下去**。
 * 撞了不是错误，是常态 —— 那条排他约束会拒绝第二个，而他要读到的是
 * 「这个时段刚被订走了」，不是一句资料库的话。
 *
 * ── 预览里不准假装订得了 ────────────────────────────────────────────────
 *
 * 编辑器里没有网址名，所以订不了 —— 而这一块会**讲出来**，跟 `EnquiryForm`
 * 一模一样的规矩：一个假装收得下预约的预览，跟一颗按不动的按钮是同一件事。
 *
 * ── ⚠️ 营业时间是他的，不是我们的 ──────────────────────────────────────
 *
 * `openHour` / `closeHour` / `slotMinutes` 是**这一块的属性**，编辑器里改得动。
 * 预设九点到六点、一小时一格 —— 而那是一个**预设不是宣称**：他一眼看到
 * 不对就改，跟询价那三题的示例文字同一条。
 * 我们没有一个地方存着他真正的营业时间（那一段 `hours` 是他自己打的字，
 * 机器读不了），所以这里不去猜它。
 */
export function SiteBooking({
  heading,
  blurb,
  submitLabel,
  landsIn,
  landsInBadge,
  landsInBefore,
  landsInAfter,
  note,
  anchor,
  openHour = 9,
  closeHour = 18,
  slotMinutes = 60,
  days = 7,
  /** 这一块要不要装在一张卡里 —— 跟询价那一块同一根轴，风格自己挑。 */
  boxed = true,
}: {
  heading: string;
  blurb?: string;
  submitLabel?: string;
  /** 订了之后他的系统里多出来的那一页。空字串＝不画那条箭头。 */
  landsIn?: string;
  landsInBadge?: string;
  landsInBefore?: string;
  landsInAfter?: string;
  note?: string;
  /** 页面上指向这一段的那条锚点。见 lib/portal/anchor-prune.ts。 */
  anchor?: string;
  openHour?: number;
  closeHour?: number;
  slotMinutes?: number;
  days?: number;
  boxed?: boolean;
}) {
  const w = useSystemWords();
  const base = useId();
  const [dayIndex, setDayIndex] = useState(0);
  const [taken, setTaken] = useState<{ from: string; to: string }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [chosen, setChosen] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [what, setWhat] = useState("");
  const [state, setState] = useState<"idle" | "sending" | string>("idle");
  /* 🔴 那句话贴着**哪一格**（2026-09-07）—— 跟询价那一块同一件事，
     同一个形状（后台那一边 `74119c7` 的做法）。

     这一块比询价那一块多一种，而它本来是最安静的一种：
     那颗按钮写着 `!chosen` 就变灰 —— **他还没挑时段的时候，
     按钮是灰的，而画面上一个字都不讲**。一颗按不动又不说为什么的按钮，
     跟少一句话不是同一件事：他站在那里不知道少了什么。

     ⚠️ 送不出去那几种（预览 · 刚被订走 · 太多 · 挂了）**贴不到任何一格**，
     照旧留在按钮旁边。 */
  const [missAt, setMissAt] = useState<"slot" | "name" | "contact" | null>(
    null,
  );

  /* 那个已上线的网址是唯一说得出这一块属於哪一门生意的东西，而它已经在
     读的人的网址列里。跟 `EnquiryForm` 读的是同一个地方 —— 同一份版面
     也会在编辑器里画一次，而那里没有网址名，也不该订得了。 */
  const slugFromUrl = () => {
    if (typeof window === "undefined") return "";
    const m = /^\/s\/([^/?#]+)/.exec(window.location.pathname);
    return m ? decodeURIComponent(m[1]) : "";
  };

  /* 🔴 **时钟不在 render 里读。**
   *
   * 一个在 render 里叫 `Date.now()` 的组件，伺服器画一份、浏览器画另一份 ——
   * 而这一块画的是「哪几格已经过去了」，所以那两份会不一样，React 接不上。
   * `date-picker.tsx` 早就写下同一条：它的 `todayIso` 是**外面给的**，
   * 「一个自己读时钟的组件」是它明写不要的东西。
   *
   * ⚠️ 而这里也**不用 `useEffect(() => setMounted(true))`** ——
   * 那是 `input-blocks.tsx` 用的那一招，而它挂在 `eslint-suppressions.json`
   * 的欠债名单上。摆在下一帧读，两条规则都不用绕。 */
  const [today, setToday] = useState<number | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => setToday(Date.now()));
    return () => cancelAnimationFrame(id);
  }, []);

  /* 从今天起的那几天。**从今天，不是明天** —— 一个今天订不了的订位页，
     跟一个坏掉的订位页读起来一样。 */
  const dayList = Array.from(
    { length: Math.max(1, Math.min(days, 14)) },
    (_, i) => {
      const d = new Date(today ?? 0);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      return d;
    },
  );
  /* 🔴 开在**第一个还订得到的那一天**，不是永远开在今天。
   *
   * 实测晚上十一点打开一间沙龙的官网：今天九点到六点**十格全部是灰的**，
   * 而那一页第一眼给人的答案是「这家店没位子」。它讲的是真话，
   * 只是讲了一句没有用的真话。
   *
   * ⚠️ 而它**只看钟**，不看有没有人订走 —— 那要等问过资料库才知道，
   * 而一个要等一次往返才决定开在哪一天的选择器，会在他眼前跳一下。
   * 今天还有格子就开在今天；今天关门了就开在明天。 */
  const firstOpen = dayList.findIndex(
    (d) => lastSlotStart(d, openHour, closeHour, slotMinutes) > (today ?? 0),
  );
  const [touched, setTouched] = useState(false);
  const start = touched ? dayIndex : Math.max(0, firstOpen);
  const day = dayList[Math.min(start, dayList.length - 1)];
  const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    const slug = slugFromUrl();
    if (!slug || today === null) return;
    let alive = true;
    /* ⚠️ 那三个 setState 全部在 promise 里，不在 effect 本体里 ——
       同步在 effect 里改状态会连着重画两次，而 React 19 的规则会红。 */
    fetch(
      `/api/site/booking/slots?slug=${encodeURIComponent(slug)}&day=${dayKey}`,
    )
      .then((r) => r.json())
      .then((j: { taken?: { from: string; to: string }[] }) => {
        if (!alive) return;
        setTaken(j.taken ?? []);
        setChosen(null);
        setLoadingSlots(false);
      })
      /* 读不到就当成**全部订满**，不是全部空着。一个读不到空档而画成
         「整天都空」的页面，会让两个人订到同一个钟头。 */
      .catch(() => {
        if (!alive) return;
        setTaken([{ from: "", to: "" }]);
        setLoadingSlots(false);
      });
    return () => {
      alive = false;
    };
  }, [dayKey, today]);

  const slots = buildSlots(day, openHour, closeHour, slotMinutes);
  const busy = (from: Date, to: Date) =>
    taken.some((t) => {
      if (!t.from || !t.to) return true; // 读不到 —— 见上面
      const a = new Date(t.from).getTime();
      const b = new Date(t.to).getTime();
      return from.getTime() < b && a < to.getTime();
    });
  const now = today ?? 0;
  const rows = slots.map((s) => ({
    ...s,
    /* 过去的时段照旧画出来，只是按不下去 —— 一个把上午整片藏起来的
       订位页，读起来像这家店今天不开。 */
    off: s.from.getTime() <= now || busy(s.from, s.to),
    past: s.from.getTime() <= now,
  }));
  const anyOpen = rows.some((r) => !r.off);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const slug = slugFromUrl();
    if (!slug) {
      setState(w.booking.previewOnly);
      return;
    }
    if (!chosen || !name.trim() || !contact.trim()) {
      const at = !chosen ? "slot" : !name.trim() ? "name" : "contact";
      setMissAt(at);
      setState("idle");
      requestAnimationFrame(() => {
        /* ⚠️ `?.()` —— 一个没有它的环境里这一句会抛，
           而抛在这里会把**那句话也一起吃掉**。 */
        const el = document.getElementById(
          at === "slot"
            ? `${base}-slots`
            : `${base}-${at === "name" ? "n" : "c"}`,
        );
        el?.scrollIntoView?.({ block: "center", behavior: "smooth" });
        if (at !== "slot") el?.focus?.();
      });
      return;
    }
    setMissAt(null);
    const pick = rows.find((r) => r.from.toISOString() === chosen);
    if (!pick) {
      setState(w.booking.failed);
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/site/booking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          name: name.trim(),
          contact: contact.trim(),
          from: pick.from.toISOString(),
          to: pick.to.toISOString(),
          service: what.trim(),
          website: "",
        }),
      });
      const { result } = (await res.json()) as { result?: string };
      if (result === "ok") {
        setState(w.booking.booked(`${fmtDay(day, w)} ${pick.label}`));
        setName("");
        setContact("");
        setWhat("");
        setChosen(null);
        /* 订好了就重问一次这一天 —— 不然刚订走的那一格在他自己画面上
           还是空的，而他会以为没订到，再按一次。 */
        const j = await fetch(
          `/api/site/booking/slots?slug=${encodeURIComponent(slug)}&day=${dayKey}`,
        )
          .then((r) => r.json())
          .catch(() => null);
        if (j?.taken) setTaken(j.taken);
        return;
      }
      setState(
        result === "taken"
          ? w.booking.clash
          : result === "past"
            ? w.booking.past
            : result === "too_far"
              ? w.booking.tooFar
              : result === "incomplete"
                ? w.sendIncomplete
                : result === "too_many"
                  ? w.sendTooMany
                  : w.booking.failed,
      );
      if (result === "taken") {
        setChosen(null);
        const j = await fetch(
          `/api/site/booking/slots?slug=${encodeURIComponent(slug)}&day=${dayKey}`,
        )
          .then((r) => r.json())
          .catch(() => null);
        if (j?.taken) setTaken(j.taken);
      }
    } catch {
      setState(w.booking.failed);
    }
  }

  const field =
    "min-h-11 w-full [background-color:var(--site-field-bg,var(--color-ink-950))] [border-radius:var(--site-field-radius,var(--radius-control))] [border:var(--site-field-border,var(--hairline)_solid_var(--input))] [box-shadow:var(--site-field-line,none)] [color:var(--color-paper)] [font-size:var(--text-base)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)] placeholder:[color:var(--color-paper-dim)] focus-visible:[border-color:var(--color-primary)] focus-visible:outline-none";
  const label =
    "mb-1.5 block [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]";

  return (
    <section
      id={anchor}
      className="[padding-block:var(--pad-card-lg)] [padding-inline:var(--pad-card-lg)]"
    >
      <div className={boxed ? "ds-card [padding:var(--pad-card-lg)]" : ""}>
        <h2
          data-column-heading=""
          className="ds-display [color:var(--color-paper)] [font-size:var(--text-title)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-title)]"
        >
          {heading}
        </h2>
        {blurb && (
          <p className="mt-2 max-w-[52ch] [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
            {blurb}
          </p>
        )}

        {/* ── 挑一天 ──────────────────────────────────────────────────────
            横着滑，不是一个下拉。一个陌生人在手机上要看得到「这个星期六
            还有没有」，而一个下拉要先按一下才看得到里面有什么。 */}
        <p className={`mt-6 ${label}`}>{w.booking.pickDay}</p>
        <div className="-mx-1 flex overflow-x-auto [gap:var(--gap-inline)] [padding-inline:4px] [scrollbar-width:none]">
          {dayList.map((d, i) => {
            const on = i === Math.min(start, dayList.length - 1);
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => {
                  setDayIndex(i);
                  setTouched(true);
                }}
                aria-pressed={on}
                className={`shrink-0 [border-radius:var(--radius-control)] [font-size:var(--text-sm)] [min-height:44px] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.1)] [transition-duration:var(--dur)] ${
                  on
                    ? "[background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)]"
                    : "[background-color:var(--site-field-bg,var(--color-ink-950))] [border:var(--hairline)_solid_var(--input)] [color:var(--color-paper)]"
                }`}
              >
                <span className="block [font-size:var(--text-micro)] [opacity:.75]">
                  {w.weekdays[d.getDay()]}
                </span>
                <span className="tnum block">{d.getDate()}</span>
              </button>
            );
          })}
        </div>

        {/* ── 挑一个时间 ─────────────────────────────────────────────────
            被占着的照旧画出来，标着「已订」—— 一个把满掉的时段藏起来的
            页面，让人以为这家店没什么生意。 */}
        <p className={`mt-6 ${label}`}>{w.booking.pickTime}</p>
        <div
          id={`${base}-slots`}
          className="grid grid-cols-2 [gap:var(--gap-inline)] @md:grid-cols-4"
        >
          {rows.map((s) => (
            <button
              key={s.from.toISOString()}
              type="button"
              disabled={s.off}
              onClick={() => {
                setChosen(s.from.toISOString());
                setState("idle");
              }}
              aria-pressed={chosen === s.from.toISOString()}
              className={`min-h-11 [border-radius:var(--radius-control)] [font-size:var(--text-sm)] [padding-block:var(--pad-control-y)] [transition-duration:var(--dur)] ${
                chosen === s.from.toISOString()
                  ? "[background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)]"
                  : s.off
                    ? "[background-color:transparent] [border:var(--hairline)_solid_var(--input)] [color:var(--color-paper-dim)] [opacity:.55]"
                    : "[background-color:var(--site-field-bg,var(--color-ink-950))] [border:var(--hairline)_solid_var(--input)] [color:var(--color-paper)]"
              }`}
            >
              <span className="tnum">{s.label}</span>
              {s.off && !s.past && (
                <span className="block [font-size:var(--text-micro)]">
                  {w.booking.taken}
                </span>
              )}
            </button>
          ))}
        </div>
        {missAt === "slot" ? (
          <span
            role="alert"
            className="mt-1.5 block [border-inline-start:2px_solid_var(--border-strong)] [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] [line-height:var(--leading-body)] [padding-inline-start:calc(var(--pad-control-x)*0.6)]"
          >
            {w.booking.pickOne}
          </span>
        ) : null}
        {!loadingSlots && !anyOpen && (
          <p className="mt-3 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
            {w.booking.noneLeft}
          </p>
        )}

        {/* ── 是谁 ───────────────────────────────────────────────────────
            两格必填，第三格随意。第四格换来的是少一个人订完 ——
            要问的其余全部留给订完之后那一通讯息。 */}
        <form
          onSubmit={onSubmit}
          className="mt-6 grid [gap:var(--gap-stack)] @xl:grid-cols-2"
        >
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute h-0 w-0 overflow-hidden opacity-0"
          />
          <div>
            <label htmlFor={`${base}-n`} className={label}>
              {w.enquiry.name.label}
            </label>
            <input
              id={`${base}-n`}
              aria-invalid={missAt === "name" || undefined}
              aria-describedby={missAt === "name" ? `${base}-n-why` : undefined}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={w.enquiry.name.placeholder}
              className={field}
            />
            {missAt === "name" ? (
              <span
                id={`${base}-n-why`}
                role="alert"
                className="mt-1.5 block [border-inline-start:2px_solid_var(--border-strong)] [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] [line-height:var(--leading-body)] [padding-inline-start:calc(var(--pad-control-x)*0.6)]"
              >
                {w.fieldNeeded}
              </span>
            ) : null}
          </div>
          <div>
            <label htmlFor={`${base}-c`} className={label}>
              {w.enquiry.phone.label}
            </label>
            <input
              id={`${base}-c`}
              aria-invalid={missAt === "contact" || undefined}
              aria-describedby={
                missAt === "contact" ? `${base}-c-why` : undefined
              }
              type="tel"
              inputMode="tel"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={w.enquiry.phone.placeholder}
              className={field}
            />
            {missAt === "contact" ? (
              <span
                id={`${base}-c-why`}
                role="alert"
                className="mt-1.5 block [border-inline-start:2px_solid_var(--border-strong)] [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] [line-height:var(--leading-body)] [padding-inline-start:calc(var(--pad-control-x)*0.6)]"
              >
                {w.fieldNeeded}
              </span>
            ) : null}
          </div>
          <div className="@xl:col-span-2">
            <label htmlFor={`${base}-w`} className={label}>
              {w.enquiry.detail.label}
            </label>
            <input
              id={`${base}-w`}
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              placeholder={w.enquiry.detail.placeholder}
              className={field}
            />
          </div>

          <div className="mt-1 flex flex-col items-stretch [gap:var(--gap-inline)] @xl:col-span-2">
            <button
              type="submit"
              disabled={state === "sending"}
              className="inline-flex min-h-11 items-center justify-center disabled:opacity-60 [flex-grow:var(--site-submit-grow,0)] [background-color:var(--site-submit-bg,var(--color-primary))] [border-radius:var(--radius-control)] [color:var(--site-submit-fg,var(--color-on-primary))] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.6)] [transition-duration:var(--dur)] [transition-property:background-color] hover:[background-color:var(--color-primary-deep)]"
            >
              {state === "sending"
                ? w.booking.sending
                : submitLabel || w.booking.submit}
            </button>
            {note && (
              <span className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
                {note}
              </span>
            )}
          </div>

          {state !== "idle" && state !== "sending" && (
            <p
              aria-live="polite"
              className="@xl:col-span-2 [color:var(--color-paper)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]"
            >
              {state}
            </p>
          )}
        </form>

        {/* 那条箭头 —— 跟询价那一块同一句话，换一个动词。 */}
        {landsIn && (
          <p className="mt-6 flex flex-wrap items-center [gap:var(--gap-inline)] [border-top:var(--hairline)_solid_var(--color-ink-800)] [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [padding-top:var(--pad-card)]">
            <span
              aria-hidden
              className="[background-color:var(--color-primary-soft)] [border-radius:var(--radius-pill)] [color:var(--color-primary)] [font-size:var(--text-micro)] [font-weight:var(--fw-semibold)] [padding-block:2px] [padding-inline:8px]"
            >
              {landsInBadge || w.enquiry.auto}
            </span>
            <span>
              {landsInBefore || w.booking.arrow(landsIn)[0]}
              <b className="[color:var(--color-paper)] [font-weight:var(--fw-medium)]">
                「{landsIn}」
              </b>
              {landsInAfter ||
                w.booking.arrow(landsIn)[1].slice(landsIn.length)}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}

/** 那一天的格子。**算出来的，不是存起来的** —— 换一个开门时间，
 *  昨天那些格子不会跟着变，因为根本没有存过。 */
function buildSlots(
  day: Date,
  openHour: number,
  closeHour: number,
  minutes: number,
) {
  const step = Math.max(15, Math.min(minutes, 240));
  const from = Math.max(0, Math.min(openHour, 23));
  const to = Math.max(from + 1, Math.min(closeHour, 24));
  const out: { from: Date; to: Date; label: string }[] = [];
  for (let m = from * 60; m + step <= to * 60; m += step) {
    const a = new Date(day);
    a.setHours(0, m, 0, 0);
    const b = new Date(a.getTime() + step * 60_000);
    out.push({ from: a, to: b, label: hhmm(a) });
    /* 一天最多画二十四格 —— 十五分钟一格的三十六格，在手机上是一整页
       按钮，而那一页问的问题只有一个。 */
    if (out.length >= 24) break;
  }
  return out;
}

/** 那一天最后一格开始的时间。用来判「今天还订得到吗」。 */
function lastSlotStart(
  day: Date,
  openHour: number,
  closeHour: number,
  minutes: number,
) {
  const slots = buildSlots(day, openHour, closeHour, minutes);
  return slots.length ? slots[slots.length - 1].from.getTime() : 0;
}

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const fmtDay = (d: Date, w: { monthsShort: string[] }) =>
  `${d.getDate()} ${w.monthsShort[d.getMonth()]}`;

"use client";

import { useSystemWords } from "@/design-system/system-lang-context";

import { useEffect, useState } from "react";

import {
  Banknote,
  Building2,
  CalendarDays,
  Clock,
  FileText,
  Hammer,
  MapPin,
  Phone,
  Tag as TagIcon,
  User,
  type LucideIcon,
} from "lucide-react";
import { InfoList } from "@/components/info-list";
import { ScheduleList } from "@/components/schedule-list";
import { ProgressTimeline } from "@/components/progress-timeline";
import { PeopleGrid } from "@/components/people-grid";
import { PricingTable } from "@/components/pricing-table";
import { StatCard } from "@/components/stat-card";
import { ExpandableText } from "@/components/expandable-text";
import {
  Announcement,
  AnnouncementTag,
  AnnouncementTitle,
} from "@/components/kibo-ui/announcement";
import { Banner, BannerClose, BannerTitle } from "@/components/kibo-ui/banner";
import {
  Snippet,
  SnippetHeader,
  SnippetCopyButton,
  SnippetTabsContent,
} from "@/components/kibo-ui/snippet";
import { AvatarStack } from "@/components/kibo-ui/avatar-stack";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { QRCode } from "@/components/kibo-ui/qr-code";
import {
  ContributionGraph,
  ContributionGraphCalendar,
  ContributionGraphBlock,
  ContributionGraphLegend,
  ContributionGraphFooter,
  ContributionGraphTotalCount,
} from "@/components/kibo-ui/contribution-graph";

/**
 * The second wave of registry components, wrapped for Puck.
 *
 * WHY A WRAPPER LAYER AT ALL. Everything below arrives as either a headless
 * compound API (Kibo: a provider plus six parts you assemble yourself) or a
 * richly-typed single component wanting React nodes, functions and Lucide
 * component references in its props (@ilinxa). Puck's fields produce strings,
 * numbers, booleans and arrays of those — so something has to stand between
 * 「六个栏位一个老板填得完」 and the component's real API. That is this file,
 * and it is the same job board-blocks.tsx already does for 看板.
 *
 * WHY THESE ONES. The founder's objection was that thirty blocks is too few and
 * that the search had been lazy — 「肯定还有别的模板没有用到的 我都要你给我找
 * 出来」. Both parts are true. Kibo publishes 41 components and three were
 * wired. @ilinxa publishes about sixty real ones — the other 120 registry
 * entries are `-fixtures` and `-01` demo data — and exactly one was. What
 * follows is chosen against one question: does a Malaysian SME running quotes,
 * jobs, collections and staff have a use for it. That question is why a
 * marquee, a code sandbox, a cursor and a colour picker are all still on the
 * shelf, and it is not a shortage of components.
 *
 * EVERY HANDLER IS A NO-OP, deliberately, and not omitted. This is a design OF
 * a system, not the system: nothing here persists. Several of these components
 * warn in the console when an interactive control has no handler, and a warning
 * that fires on every render teaches people to stop reading the console.
 */

/** Puck stores a string; InfoList wants a component. A short named set beats
 *  free-text Lucide names — an owner picking 「电话」 off a list cannot typo
 *  their way to a blank row. */
const ICONS: Record<string, LucideIcon> = {
  person: User,
  phone: Phone,
  place: MapPin,
  time: Clock,
  money: Banknote,
  file: FileText,
  tag: TagIcon,
  company: Building2,
  work: Hammer,
  date: CalendarDays,
};
/** Exported because shelf-blocks.tsx builds its own lists from the same icon
 *  registry, and two copies of a name->component map is two chances for a
 *  block to render a different icon for the same word. */
export const icon = (k?: string) => ICONS[k ?? "file"] ?? FileText;

/** True only after the browser has taken over.
 *
 *  Everything below that reads `new Date()` needs it. A server rendering in UTC
 *  and a browser in UTC+8 are on different days for eight hours out of every
 *  twenty-four, and a percentage derived from "now" differs even within one
 *  second. React discards the whole subtree when the two disagree — which is
 *  exactly what the library page was doing to 进度（看日期）. */
function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/** `toISOString()` on a date built from LOCAL parts shifts by the timezone
 *  offset — `new Date(2026, 0, 1)` in Kuala Lumpur serialises as 2025-12-31.
 *  These are calendar days, not instants, so they are formatted as such. */
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ 资料列表 */

export type InfoRow = { label: string; value: string; icon?: string };

/** 客户资料、工程资料 — the 名称:内容 block every record-detail page needs, and
 *  that no amount of stacking a 记录表格 produces. */
export function InfoRows({
  heading,
  rows,
  variant = "comfortable",
  framed = true,
}: {
  heading?: string;
  rows: InfoRow[];
  variant?: "comfortable" | "compact";
  framed?: boolean;
}) {
  const w = useSystemWords();
  return (
    <InfoList
      heading={heading}
      variant={variant}
      framed={framed}
      /* A ROW WITH NO LABEL IS STILL A ROW.
         `primary` is the line InfoList actually draws; `secondary` is its
         subtitle, and a subtitle under nothing draws nothing. 「Where we cover」
         carried its place names in `value` with an empty label, so on the live
         page the whole section came to fourteen characters -- its own heading
         and not one of the eight towns it covers. Measured 2026-08-27; the
         founder had been looking at it and asking 「这个是还没渲染的吗」.
         So an unlabelled row promotes its value to the line you read. */
      items={(rows ?? []).map((r, i) => ({
        id: String(i),
        icon: icon(r.icon),
        primary: r.label?.trim() ? r.label : r.value,
        secondary: r.label?.trim() ? r.value : undefined,
      }))}
      labels={{ emptyText: w.empty }}
    />
  );
}

/* ------------------------------------------------------------------ 排班表 */

export type ScheduleRow = {
  time: string;
  endTime?: string;
  title: string;
  description?: string;
};

/** 今天的行程 — 补习班的课表、诊所的预约、装修队今天去哪几间。 */
export function DaySchedule({
  heading,
  rows,
  framed = true,
  shape,
}: {
  heading?: string;
  rows: ScheduleRow[];
  framed?: boolean;
  /**
   * 一天的安排有几种画法，而它们不是同一张图的四种漆。
   *
   * ── 出处（`.screenshots/objects/`，2026-09-02 实拍）─────────────────────
   *   framed / bare  一张一张，或者一行一行 —— 本来就有的两种
   *   rail           左边一条轨道，一个点一个时段 ← FullCalendar timeGrid ·
   *                  AdminLTE timeline（两个都 MIT）
   *   ruled          时间在一个窄栏里，行与行只有细线 ← Gentelella v4 的清单
   *
   * ⚠️ **为什么要加**：这一根轴本来只有两种，而六套风格里必然有三套共用同一
   * 个值 —— 那不是设计懒，是没有东西可以选（见 `design-doc.test.ts`）。
   *
   * ⚠️ `framed` 留着不动：客户已经存下来的页面带着它。没有给 `shape` 的时候
   * 由 `framed` 决定，这样旧页面一个像素都不会变。
   */
  shape?: "framed" | "bare" | "rail" | "ruled";
}) {
  const w = useSystemWords();
  const items = (rows ?? []).map((r, i) => ({
    id: String(i),
    time: r.time,
    endTime: r.endTime || undefined,
    title: r.title,
    description: r.description || undefined,
  }));
  const look = shape ?? (framed ? "framed" : "bare");

  if (look === "rail" || look === "ruled") {
    const head = heading ? (
      <h2 className="mb-[var(--gap-stack)] [color:var(--color-paper-dim)] [font-size:var(--text-micro)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
        {heading}
      </h2>
    ) : null;

    /* 空的时候一定要讲话。一张只有表头的空白，跟一张坏掉的表，在画面上
       长得一模一样 —— 这是 `record-table-states.test.tsx` 守的同一件事。 */
    if (items.length === 0) {
      return (
        <section>
          {head}
          <p role="status" className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
            {w.emptyToday}
          </p>
        </section>
      );
    }

    if (look === "ruled") {
      return (
        <section>
          {head}
          <ol className="flex flex-col">
            {items.map((it, i) => (
              <li
                key={it.id}
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
                <span className="tnum w-[5.5em] shrink-0 [color:var(--color-paper)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
                  {it.time}
                </span>
                <span className="min-w-0 flex-1 [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                  {it.title}
                </span>
                {it.description && (
                  <span className="shrink-0 [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                    {it.description}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      );
    }

    return (
      <section>
        {head}
        <ol className="flex flex-col">
          {items.map((it, i) => (
            <li key={it.id} className="flex [gap:var(--gap-inline)]">
              {/* 轨道自己是一栏：一个点，加上连到下一个点的那一小段线。
                  线画成 flex-grow 的子元素而不是 li 的边框，最后一个点下面
                  才不会拖一条伸进空白的尾巴。 */}
              <div className="flex flex-col items-center">
                <span
                  aria-hidden
                  className="mt-1.5 size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: "var(--color-primary)" }}
                />
                {i < items.length - 1 && (
                  <span
                    aria-hidden
                    className="w-px flex-1"
                    style={{ backgroundColor: "var(--border-subtle)", minHeight: 18 }}
                  />
                )}
              </div>
              <div
                className={`min-w-0 flex-1 ${i < items.length - 1 ? "pb-[var(--gap-stack)]" : ""}`}
              >
                <div className="tnum [color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-xs)]">
                  {it.time}
                  {it.endTime ? ` – ${it.endTime}` : null}
                </div>
                <div className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                  {it.title}
                </div>
                {it.description && (
                  <div className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                    {it.description}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <ScheduleList
      heading={heading}
      framed={look === "framed"}
      items={items}
      labels={{ emptyText: w.emptyToday, timeRangeSeparator: " – " }}
    />
  );
}

/* ------------------------------------------------------------------ 进度条 */

/** A progress bar that knows about DATES, which is the difference between
 *  「70%」 and 「还有 12 天」. The second is the one a customer chasing a
 *  renovation actually asks for. */
export function DateProgress({
  heading,
  start,
  end,
  framed = true,
}: {
  heading?: string;
  start: string;
  end: string;
  framed?: boolean;
}) {
  const w = useSystemWords();
  const mounted = useMounted();
  return (
    <ProgressTimeline
      heading={heading}
      start={start}
      end={end}
      framed={framed}
      // Before mount, "now" is the start of the window on BOTH sides, so the
      // server's HTML and the browser's first render agree; the real clock
      // arrives on the next paint.
      now={mounted ? undefined : new Date(start)}
      labels={{
        startLabel: w.start,
        endLabel: w.finish,
        beforeText: w.notStarted,
        activeText: w.inProgress,
        afterText: w.done,
        ariaLabel: w.progress,
      }}
    />
  );
}

/* ------------------------------------------------------------------ 人 */

export type PersonRow = { name: string; title?: string; image?: string };

/** 师傅、员工、老师 — a page that has to say who does the work. */
export function PeopleBoard({
  heading,
  people,
  columns = 3,
}: {
  heading?: string;
  people: PersonRow[];
  columns?: 2 | 3 | 4 | 5;
}) {
  const w = useSystemWords();
  return (
    <PeopleGrid
      heading={heading}
      columns={columns}
      items={(people ?? []).map((p, i) => ({
        id: String(i),
        name: p.name,
        title: p.title || undefined,
        image: p.image || undefined,
      }))}
      labels={{ emptyText: w.emptyPeople }}
    />
  );
}

/** 几个人在跟这单 — the overlapping row of faces, for a job card or a table
 *  cell where a full grid would be absurd. */
export function FaceRow({ people, max = 4 }: { people: PersonRow[]; max?: number }) {
  return (
    <AvatarStack>
      {(people ?? []).slice(0, max).map((p, i) => (
        <Avatar key={i}>
          {p.image ? <AvatarImage src={p.image} alt={p.name} /> : null}
          <AvatarFallback>{(p.name || "?").slice(0, 2)}</AvatarFallback>
        </Avatar>
      ))}
    </AvatarStack>
  );
}

/* ------------------------------------------------------------------ 价目表 */

export type PriceTier = {
  name: string;
  description?: string;
  price: number;
  period?: string;
  features?: string;
  cta?: string;
  highlighted?: "yes" | "no";
};

/** 套餐、配套、价目 — 补习班的月费、健身房的会员、装修的三个 package。
 *
 *  Features are ONE comma-separated field rather than a nested array. A nested
 *  array inside an array means two levels of Puck's drawer editor, and a
 *  tuition-centre owner listing four bullet points should not have to open four
 *  drawers to do it. Splits on the Chinese comma and enumeration comma too,
 *  because that is what gets typed on a Chinese keyboard. */
export function PriceTable({
  heading,
  layout = "cards",
  currency = "MYR",
  tiers,
}: {
  heading?: string;
  /**
   * 一份价钱清单的四种画法。
   *
   * ── 出处 ────────────────────────────────────────────────────────────────
   *   cards  一个方案一张卡，并排 ← Tabler 的 pricing 页（MIT · ★41.6k）
   *   table  并排比较表           ← 同上那一页底下那张
   *   rows   一行一项，只有细线   ← [任务 26](../../docs/founder-tasks.md) 实测的
   *          马来西亚冷气公司：`General service RM 60 · Chemical cleaning RM 130`。
   *          **这个市场的价目就长这样**，不是三张方案卡
   *   stack  一项一条，整行宽     ← Tabler invoice 的逐行明细
   *
   * ⚠️ **为什么加 rows**：并排卡片假设「客人在三个方案里挑一个」。
   * 一家装修公司的价目不是方案，是**一张服务表**，而一张服务表并排成卡片
   * 会把六项服务画成六张各占五分之一屏的空卡。
   */
  layout?: "cards" | "table" | "rows" | "stack";
  currency?: string;
  tiers: PriceTier[];
}) {
  const w = useSystemWords();

  if (layout === "rows" || layout === "stack") {
    const list = tiers ?? [];
    const head = heading ? (
      <h2 className="mb-[var(--gap-stack)] [color:var(--color-paper-dim)] [font-size:var(--text-micro)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
        {heading}
      </h2>
    ) : null;
    const money = (t: PriceTier) => {
      const n = Number(t.price);
      /* 价钱读不出来的时候印他自己打的字，不要印 0 —— 「RM 0」跟
         「面议」是两句完全不同的话，而只有一句是真的。 */
      if (!Number.isFinite(n) || String(t.price ?? "").trim() === "") return String(t.price ?? "");
      return `${currency || "MYR"} ${n.toLocaleString("en-MY")}`;
    };
    return (
      <section>
        {head}
        <ol className={layout === "stack" ? "flex flex-col [gap:var(--gap-stack)]" : "flex flex-col"}>
          {list.map((t, i) => (
            <li
              key={`${t.name}-${i}`}
              className={
                layout === "stack"
                  ? "ds-card flex items-baseline [gap:var(--gap-inline)] [padding:var(--pad-card)]"
                  : "flex items-baseline [gap:var(--gap-inline)] [padding-block:var(--pad-control-y)]"
              }
              style={
                layout === "stack"
                  ? {
                      borderWidth: "var(--border-card-width)",
                      borderStyle: "solid",
                      borderColor:
                        t.highlighted === "yes"
                          ? "var(--color-primary)"
                          : "var(--color-ink-800)",
                    }
                  : i > 0
                    ? {
                        borderTopWidth: "var(--hairline)",
                        borderTopStyle: "solid",
                        borderTopColor: "var(--border-subtle)",
                      }
                    : undefined
              }
            >
              <div className="min-w-0 flex-1">
                <div
                  className="[font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]"
                  style={{
                    color:
                      t.highlighted === "yes"
                        ? "var(--color-primary)"
                        : "var(--color-paper)",
                  }}
                >
                  {t.name}
                </div>
                {t.description && (
                  <div className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                    {t.description}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <span className="tnum [font-family:var(--font-numeric)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                  {money(t)}
                </span>
                {t.period && (
                  <span className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                    {" "}
                    / {t.period}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <PricingTable
      heading={heading}
      layout={layout}
      billingToggle="none"
      tiers={(tiers ?? []).map((t) => ({
        name: t.name,
        description: t.description || undefined,
        priceMonthly: Number(t.price) || 0,
        currencyCode: currency || "MYR",
        periodLabel: t.period || undefined,
        highlighted: t.highlighted === "yes",
        features: (t.features ?? "")
          .split(/[,、，]/)
          .map((f) => f.trim())
          .filter(Boolean)
          .map((label) => ({ label, included: true })),
        cta: { label: t.cta || w.choose, href: "#" },
      }))}
      labels={{
        popularBadge: w.mostPopular,
        featureIncluded: w.included,
        featureExcluded: w.notIncluded,
        freeLabel: w.free,
      }}
    />
  );
}

/* ------------------------------------------------------------------ 小数字卡 */

/** The counterpart to 重点数字卡, not a replacement for it. That one is a page's
 *  single headline figure; this is small enough that three fit inside a 分栏
 *  without any of them claiming to be the answer. */
export function SmallStat({
  label,
  value,
  delta,
  period,
  variant = "default",
}: {
  label: string;
  value: string;
  delta?: number;
  period?: string;
  variant?: "default" | "compact" | "detailed";
}) {
  const w = useSystemWords();
  const d = Number(delta);
  return (
    <StatCard
      label={label}
      value={value}
      variant={variant}
      delta={
        delta === undefined || delta === null || Number.isNaN(d)
          ? undefined
          : { value: d, period: period || undefined }
      }
      labels={{ increaseLabel: w.up, decreaseLabel: w.down }}
    />
  );
}

/* ------------------------------------------------------------------ 长文 */

/** 备注、条款、施工说明 — text that has to be ON the page but must not push
 *  everything else off the first screen. */
export function LongText({ content, maxLines = 3 }: { content: string; maxLines?: number }) {
  const w = useSystemWords();
  return (
    <ExpandableText
      content={content}
      maxLines={maxLines}
      labels={{ showMore: w.showMore, showLess: w.showLess }}
    />
  );
}

/* ------------------------------------------------------------------ 公告 */

/** 一条公告 — 「本月佣金已经出了」. Sits inside a page. */
export function NoticePill({
  tag,
  text,
  themed = false,
}: {
  tag?: string;
  text: string;
  themed?: boolean;
}) {
  return (
    <Announcement themed={themed}>
      {tag ? <AnnouncementTag>{tag}</AnnouncementTag> : null}
      <AnnouncementTitle>{text}</AnnouncementTitle>
    </Announcement>
  );
}

/** 整条横幅 — the full-width strip across the top of a page, for the one thing
 *  every user of the system has to see. */
export function NoticeBanner({ text, closable = true }: { text: string; closable?: boolean }) {
  return (
    <Banner>
      <BannerTitle>{text}</BannerTitle>
      {closable ? <BannerClose /> : null}
    </Banner>
  );
}

/* ------------------------------------------------------------------ 单号 */

/** 报价单号、发票号、追踪号 — a value whose whole purpose is to be copied and
 *  pasted into WhatsApp, with the copy button already attached. */
export function CopyValue({ label, value }: { label?: string; value: string }) {
  const w = useSystemWords();
  return (
    <Snippet defaultValue="v">
      <SnippetHeader>
        <span className="text-muted-foreground px-4 text-sm">{label || w.reference}</span>
        <SnippetCopyButton value={value} />
      </SnippetHeader>
      <SnippetTabsContent value="v">{value}</SnippetTabsContent>
    </Snippet>
  );
}

/* ------------------------------------------------------------------ 收款码 */

/** DuitNow / TNG / bank QR. Malaysia settles small-business payments by QR far
 *  more than by card, so a 收款 page without one is a 收款 page that still ends
 *  in 「我 WhatsApp 你号码」. */
export function PayQr({ data, size = 180 }: { data: string; size?: number }) {
  return (
    <div style={{ width: size, height: size }}>
      <QRCode data={data || "https://formae.my"} className="size-full" />
    </div>
  );
}

/* ------------------------------------------------------------------ 出勤格 */

/** 出勤、开工天数、每天有没有单 — a year of daily activity in one block.
 *
 *  The sample year is generated rather than typed, and that is a statement
 *  about what is being chosen here: 364 rows is not something an owner fills in
 *  by hand, and in the built system it comes from the records. What they are
 *  deciding in the editor is that the page HAS one. */
export function ActivitySquares({ label }: { label?: string }) {
  const w = useSystemWords();
  const mounted = useMounted();
  const start = new Date(new Date().getFullYear(), 0, 1);
  const data = Array.from({ length: 364 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    // Sundays off, everything else a plausible spread — a flat block of one
    // value renders as a solid rectangle and reads as a rendering failure.
    const count = d.getDay() === 0 ? 0 : (i * 7) % 5;
    return { date: ymd(d), count, level: Math.min(4, count) };
  });
  // A year of squares has no business being in the server's HTML, and which
  // year it is depends on the reader's timezone for eight hours a day.
  if (!mounted) return <div style={{ height: 120 }} aria-hidden />;
  return (
    // A YEAR OF SQUARES HAS A MINIMUM WIDTH: 53 weeks at 11px plus gaps is
    // about 740px, and no amount of CSS makes it smaller without making the
    // squares unreadable. Before this it simply overflowed -- put in a half
    // column by 台账 and 码 on 2026-08-25, the months ran out past the edge and
    // the "Less / More" legend landed on top of the block beside it.
    //
    // Scrolling the block rather than the page is the answer the rest of this
    // codebase already uses for wide tables: the page never scrolls sideways,
    // and the reader can still see December.
    <div className="w-full overflow-x-auto">
    <ContributionGraph
      data={data}
      blockSize={11}
      labels={{
        months: w.monthsShort,
        weekdays: w.weekdays,
        legend: { less: w.less, more: w.more },
      }}
    >
      <ContributionGraphCalendar>
        {({ activity, dayIndex, weekIndex }) => (
          <ContributionGraphBlock
            activity={activity}
            dayIndex={dayIndex}
            weekIndex={weekIndex}
          />
        )}
      </ContributionGraphCalendar>
      <ContributionGraphFooter>
        <ContributionGraphTotalCount>
          {/* Not 「{totalCount} 天」: totalCount sums the activity VALUES, so a
              364-day year reported 626 days. The block's job is to show the
              SHAPE of a year's attendance; the count belongs to whatever the
              built system actually counts. */}
          {() => <span className="text-muted-foreground text-xs">{label}</span>}
        </ContributionGraphTotalCount>
        <ContributionGraphLegend />
      </ContributionGraphFooter>
    </ContributionGraph>
    </div>
  );
}

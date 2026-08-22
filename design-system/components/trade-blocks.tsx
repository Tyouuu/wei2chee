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
const icon = (k?: string) => ICONS[k ?? "file"] ?? FileText;

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
      items={(rows ?? []).map((r, i) => ({
        id: String(i),
        icon: icon(r.icon),
        primary: r.label,
        secondary: r.value,
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
}: {
  heading?: string;
  rows: ScheduleRow[];
  framed?: boolean;
}) {
  const w = useSystemWords();
  return (
    <ScheduleList
      heading={heading}
      framed={framed}
      items={(rows ?? []).map((r, i) => ({
        id: String(i),
        time: r.time,
        endTime: r.endTime || undefined,
        title: r.title,
        description: r.description || undefined,
      }))}
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
  layout?: "cards" | "table";
  currency?: string;
  tiers: PriceTier[];
}) {
  const w = useSystemWords();
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
  );
}

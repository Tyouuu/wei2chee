"use client";

import { useEffect, useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/components/kibo-ui/dropzone";
import {
  Tags,
  TagsContent,
  TagsInput,
  TagsItem,
  TagsList,
  TagsTrigger,
  TagsValue,
} from "@/components/kibo-ui/tags";
import {
  Choicebox,
  ChoiceboxItem,
  ChoiceboxItemHeader,
  ChoiceboxItemTitle,
  ChoiceboxItemSubtitle,
  ChoiceboxItemDescription,
  ChoiceboxIndicator,
} from "@/components/kibo-ui/choicebox";
import {
  MiniCalendar,
  MiniCalendarDay,
  MiniCalendarDays,
  MiniCalendarNavigation,
} from "@/components/kibo-ui/mini-calendar";
import { ImageZoom } from "@/components/kibo-ui/image-zoom";

/**
 * The controls a form is actually made of.
 *
 * The launch audit counted the gap precisely: nineteen blocks and no button, no
 * text input, no checkbox. 按钮 and 填写表单 closed most of it. What was still
 * missing is everything a form needs BESIDE a text box — a tick, a pick-one, an
 * on/off, an amount you drag, a place to drop a photo. A 装修 quote page cannot
 * be drawn without 「含不含料」 as a tick and 「几时开工」 as a date.
 *
 * These are separate blocks rather than more `kind` values inside 填写表单 on
 * purpose. That block is a whole form laid out as one unit; these are single
 * controls that get dropped next to something else — a tick beside a table row,
 * an on/off in a settings panel, a photo drop inside a 分栏. The two are
 * different shapes of the same material and both are needed.
 *
 * Nothing persists: every handler here is a no-op with local state so the
 * control still MOVES when the founder clicks it in the editor. A checkbox that
 * cannot be ticked reads as broken even when it is only a picture.
 */

/* ------------------------------------------------------------------ 勾选 */

/** 含料 / 已收订金 / 要开发票 — the yes-no that is not a whole form. */
export function CheckRow({
  label,
  hint,
  defaultChecked = false,
}: {
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  const id = useId();
  const [on, setOn] = useState(defaultChecked);
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} checked={on} onCheckedChange={(v) => setOn(v === true)} />
      <div className="grid gap-1 leading-none">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 单选 */

export type ChoiceOption = { label: string; value?: string };

/** 付款方式、工程类型 — three or four options where a dropdown would hide two
 *  of them behind a click. */
export function ChoiceRow({
  label,
  options,
  defaultValue,
  inline = false,
}: {
  label?: string;
  options: ChoiceOption[];
  defaultValue?: string;
  inline?: boolean;
}) {
  const id = useId();
  const opts = (options ?? []).map((o, i) => ({
    label: o.label,
    value: o.value || o.label || String(i),
  }));
  return (
    <div className="grid gap-2">
      {label ? <Label>{label}</Label> : null}
      <RadioGroup
        defaultValue={defaultValue || opts[0]?.value}
        className={inline ? "flex flex-wrap gap-4" : "grid gap-2"}
      >
        {opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <RadioGroupItem value={o.value} id={`${id}-${i}`} />
            <Label htmlFor={`${id}-${i}`}>{o.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

/* ------------------------------------------------------------------ 开关 */

/** 上不上架、要不要通知 — a setting, not a form answer. Distinct from 勾选 by
 *  what it means, which is why both exist: a tick records a fact about this
 *  record, a switch changes how the system behaves from now on. */
export function SwitchRow({
  label,
  hint,
  defaultOn = false,
}: {
  label: string;
  hint?: string;
  defaultOn?: boolean;
}) {
  const id = useId();
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="grid gap-1">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
      </div>
      <Switch id={id} checked={on} onCheckedChange={setOn} />
    </div>
  );
}

/* ------------------------------------------------------------------ 拉杆 */

/** 完成度、折扣、评分 — a number whose useful range is small and whose exact
 *  value matters less than roughly where it sits. */
export function SliderRow({
  label,
  min = 0,
  max = 100,
  step = 1,
  defaultValue = 50,
  suffix,
}: {
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  suffix?: string;
}) {
  const [v, setV] = useState(defaultValue);
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between">
        {label ? <Label>{label}</Label> : <span />}
        <span className="tnum text-muted-foreground text-sm">
          {v}
          {suffix || ""}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[v]}
        onValueChange={([n]) => setV(n ?? 0)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ 收合 */

export type FoldRow = { title: string; body: string };

/** 常见问题、条款、分组的栏位 — long content that has to be on the page without
 *  owning it. */
export function FoldSection({
  rows,
  openFirst = true,
}: {
  rows: FoldRow[];
  openFirst?: boolean;
}) {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={openFirst ? "i0" : undefined}
      className="w-full"
    >
      {(rows ?? []).map((r, i) => (
        <AccordionItem key={i} value={`i${i}`}>
          <AccordionTrigger>{r.title}</AccordionTrigger>
          <AccordionContent>{r.body}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

/* ------------------------------------------------------------------ 分页 */

/** The control every list of records grows into. 记录表格 shows five rows in
 *  the editor and four hundred in the built system; without this the page has
 *  no answer for the other three hundred and ninety-five. */
export function PageNumbers({ pages = 5, current = 1 }: { pages?: number; current?: number }) {
  const n = Math.max(1, Math.min(12, pages));
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" />
        </PaginationItem>
        {Array.from({ length: n }, (_, i) => (
          <PaginationItem key={i}>
            <PaginationLink href="#" isActive={i + 1 === current}>
              {i + 1}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext href="#" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

/* ------------------------------------------------------------------ 上传 */

/** 施工前后照片、收据、合约 PDF — the block a renovation or a claim-based
 *  business cannot operate without, and the one thing a photo of a system
 *  cannot fake convincingly, so it renders the real drop target. */
export function UploadBox({
  title,
  hint,
  maxFiles = 6,
}: {
  title?: string;
  hint?: string;
  maxFiles?: number;
}) {
  const [files, setFiles] = useState<File[] | undefined>();
  return (
    <Dropzone maxFiles={maxFiles} src={files} onDrop={setFiles} onError={() => {}}>
      <DropzoneEmptyState>
        <div className="flex flex-col items-center justify-center gap-1 p-6 text-center">
          <p className="text-sm font-medium">{title || "拖照片进来,或者点一下选"}</p>
          <p className="text-muted-foreground text-xs">
            {hint || `最多 ${maxFiles} 张`}
          </p>
        </div>
      </DropzoneEmptyState>
      <DropzoneContent />
    </Dropzone>
  );
}

/* ------------------------------------------------------------------ 标签 */

/** 客户标签 — 「熟客」「拖数」「介绍来的」. A list a business grows over time
 *  rather than one an analyst defines up front, which is why it is an add-as-
 *  you-go control and not a select. */
export function TagPicker({
  label,
  options,
  placeholder,
}: {
  label?: string;
  options: ChoiceOption[];
  placeholder?: string;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const opts = (options ?? []).map((o, i) => ({
    label: o.label,
    value: o.value || o.label || String(i),
  }));
  const toggle = (v: string) =>
    setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  return (
    <div className="grid gap-2">
      {label ? <Label>{label}</Label> : null}
      <Tags>
        <TagsTrigger>
          {picked.map((v) => (
            <TagsValue key={v} onRemove={() => toggle(v)}>
              {opts.find((o) => o.value === v)?.label ?? v}
            </TagsValue>
          ))}
        </TagsTrigger>
        <TagsContent>
          <TagsInput placeholder={placeholder || "找标签…"} />
          <TagsList>
            {opts.map((o) => (
              <TagsItem key={o.value} value={o.value} onSelect={() => toggle(o.value)}>
                {o.label}
              </TagsItem>
            ))}
          </TagsList>
        </TagsContent>
      </Tags>
    </div>
  );
}

/* ------------------------------------------------------------------ 选配套 */

export type PackageOption = {
  title: string;
  subtitle?: string;
  description?: string;
  value?: string;
};

/** 选配套 / 选方案 — bigger than a radio button because the choice carries a
 *  price and a description with it. A tuition centre picking between three
 *  monthly plans is choosing paragraphs, not words. */
export function PackagePicker({
  options,
  defaultValue,
}: {
  options: PackageOption[];
  defaultValue?: string;
}) {
  const opts = (options ?? []).map((o, i) => ({ ...o, value: o.value || o.title || String(i) }));
  return (
    <Choicebox defaultValue={defaultValue || opts[0]?.value} className="grid gap-2">
      {opts.map((o) => (
        <ChoiceboxItem key={o.value} value={o.value}>
          <ChoiceboxItemHeader>
            <ChoiceboxItemTitle>
              {o.title}
              {o.subtitle ? <ChoiceboxItemSubtitle>{o.subtitle}</ChoiceboxItemSubtitle> : null}
            </ChoiceboxItemTitle>
            {o.description ? (
              <ChoiceboxItemDescription>{o.description}</ChoiceboxItemDescription>
            ) : null}
          </ChoiceboxItemHeader>
          <ChoiceboxIndicator />
        </ChoiceboxItem>
      ))}
    </Choicebox>
  );
}

/* ------------------------------------------------------------------ 小日历 */

/** A week of dates in a strip, for 「哪一天开工」 on a page that has no room
 *  for a month grid. The existing 日期选择 opens a popover; this one is always
 *  visible, which is the right trade on a phone. */
export function WeekStrip({ days = 5 }: { days?: number }) {
  // MiniCalendar starts from today, and "today" is not the same day on a UTC
  // server as it is in Kuala Lumpur for eight hours out of every day.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ height: 44 }} aria-hidden />;
  return (
    <MiniCalendar days={Math.max(3, Math.min(9, days))}>
      <MiniCalendarNavigation direction="prev" />
      <MiniCalendarDays>{(d) => <MiniCalendarDay key={d.toISOString()} date={d} />}</MiniCalendarDays>
      <MiniCalendarNavigation direction="next" />
    </MiniCalendar>
  );
}

/* ------------------------------------------------------------------ 相片 */

/** 施工前后、作品集 — a photo that opens to full size on click, because a
 *  200px thumbnail of a finished kitchen is not what wins the next job. */
export function ZoomPhoto({
  src,
  alt,
  height = 220,
}: {
  src: string;
  alt?: string;
  height?: number;
}) {
  return (
    <ImageZoom>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src || "https://placehold.co/800x500/e5e7eb/6b7280?text=%20"}
        alt={alt || "照片"}
        style={{ height, width: "100%", objectFit: "cover" }}
        className="rounded-[var(--radius-md)]"
      />
    </ImageZoom>
  );
}

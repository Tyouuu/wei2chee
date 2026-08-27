import type { Config, Slot } from "@puckeditor/core";
import { PageHeader } from "@/design-system/components/page-header";
import {
  ShelfList,
  AttachmentList,
  MarkList,
  PhotoFrame,
  ActionRow,
  ChoiceSelect,
} from "@/design-system/components/shelf-blocks";
import { EmptyState } from "@/design-system/components/empty-state";
import { StatusDot, type StatusTone } from "@/design-system/components/status-dot";
import { HeroCard } from "@/design-system/components/hero-card";
import { Avatar } from "@/design-system/components/avatar";
import { RecordTable } from "@/design-system/components/record-table";
import { Inline } from "@/design-system/editor/inline-text";
import { SiteHero } from "@/design-system/components/site-hero";
import { FloatingContact } from "@/design-system/components/floating-contact";
import { SiteBar, SiteFoot } from "@/design-system/components/site-chrome";
import {
  SiteFeatures,
  SiteTestimonials,
  SiteCta,
  SiteCreds,
  SiteGallery,
  SiteStory,
  SiteStatement,
  SiteBand,
  SiteWoven,
  SiteSteps,
  SiteTeam,
} from "@/design-system/components/site-sections";
import { SiteBlock, SITE_BLOCK_OPTIONS } from "@/design-system/editor/site-block";
import { EnquiryForm } from "@/design-system/components/enquiry-form";
import { TableFieldEditor } from "@/design-system/editor/table-field";
import { type TableModel } from "@/lib/portal/table-model";
import { DatePicker } from "@/design-system/components/date-picker";
import { MonthPicker } from "@/design-system/components/month-picker";
import { FileUploadField } from "@/design-system/components/receipt-field";
import { FilterChips, type FilterChip } from "@/design-system/components/filter-chips";
import { Combobox, type ComboboxOption } from "@/design-system/components/combobox";
import { TextAutocomplete } from "@/design-system/components/text-autocomplete";
import { Listbox, type ListboxOption } from "@/design-system/components/listbox";
import { RailNav, type RailItem, type RailUtilityItem, type RailVariant } from "@/design-system/components/rail-nav";
import { StatRow, type StatTile, type StatRowLayout } from "@/design-system/components/stat-row";
import { RankList, type RankRow, type RankShape } from "@/design-system/components/rank-list";
import { ShareChart, type ShareSlice, type ShareShape } from "@/design-system/components/share-chart";
import { Bento } from "@/design-system/components/bento";
import { Overlap } from "@/design-system/components/overlap";
import { PhotoField } from "@/design-system/editor/photo-field";
import {
  IntakeForm,
  PersonCard,
  JobCard,
  TermsBlock,
  MonthSummary,
  type IntakeField,
  type CardRow,
  type SummaryFigure,
} from "@/design-system/components/assembled";
import type { TrendFrame } from "@/design-system/components/trend-chart";
import { WorkflowStrip, type WorkflowStage } from "@/design-system/components/workflow-strip";
// The second registry wave. See the header comments in both files for what was
// taken, what was left on the shelf, and why the count was never the point.
import {
  InfoRows,
  DaySchedule,
  DateProgress,
  PeopleBoard,
  FaceRow,
  PriceTable,
  SmallStat,
  LongText,
  NoticePill,
  NoticeBanner,
  CopyValue,
  PayQr,
  ActivitySquares,
  type InfoRow,
  type ScheduleRow,
  type PersonRow,
  type PriceTier,
} from "@/design-system/components/trade-blocks";
import {
  CheckRow,
  ChoiceRow,
  SwitchRow,
  SliderRow,
  FoldSection,
  PageNumbers,
  UploadBox,
  TagPicker,
  PackagePicker,
  WeekStrip,
  ZoomPhoto,
  type ChoiceOption,
  type FoldRow,
  type PackageOption,
} from "@/design-system/components/input-blocks";
import { SystemShell } from "@/design-system/components/system-shell";
// STRAIGHT FROM THE shadcn REGISTRY, unmodified. They render in the customer's
// chosen style because each token file now aliases the shadcn variable contract
// onto its own tokens (design-system/tokens/ledger.css, "THE shadcn/ui
// CONTRACT"). That aliasing is what makes the whole shadcn ecosystem -- and
// every registry built on it, 21st.dev included -- usable inside a generated
// system, instead of every block having to be hand-written against this
// project's private vocabulary.
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { TrendChart, type TrendKind, type TrendPoint } from "@/design-system/components/trend-chart";

// Third pass (2026-08-22). Two sources, one reason: a customer told to
// "design your own system" could not put a BUTTON on a page, could not put a
// text field on a page, and could not put two things side by side. Nineteen
// blocks and not one of them was something you fill in or press.
//
//   * `components/ui/*` -- eight shadcn primitives already in this repo,
//     already token-aware, and imported by exactly zero files. Installed once
//     and never wired. Nothing new was written to register them.
//   * `@ilinxa/properties-form` -- pulled from a public registry (MIT,
//     measured 99.6% token purity across the pull, then verified in a real
//     browser across four palettes before being registered here). One block
//     covers six field types: text, number, date, select, yes/no, long text.
//
// `Columns` is the one thing written rather than taken -- see its own file for
// why the registry's 22-file resizable workspace was the wrong answer.
import { Button as UiButton } from "@/components/ui/button";
import { Badge as UiBadge } from "@/components/ui/badge";
import { Separator as UiSeparator } from "@/components/ui/separator";
import { Textarea as UiTextarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Columns, type ColumnsLayout } from "@/design-system/components/columns";
import { PropertiesForm, type PropertiesFormField } from "@/components/properties-form";
// Fourth pass, same day: three Kibo UI blocks (kibo-ui.com, MIT, 3.9k stars,
// measured 100% token purity). They are headless and compound, so each is
// wrapped in board-blocks.tsx to turn its render-function API into fields a
// contractor can fill in -- the same thing record-table.tsx does over
// data-grid.tsx.
import { TaskBoard, BeforeAfter, Stars, type BoardCard } from "@/design-system/components/board-blocks";

/** The option list typed into one box, split into what PropertiesForm wants.
 *  Chinese and Latin commas both, because a customer typing on a phone gets
 *  whichever one the IME hands them. */
function splitChoices(raw?: string): { value: string; label: string }[] {
  return (raw != null ? raw : "")
    .split(/[,\u3001\uff0c]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => ({ value: x, label: x }));
}

// Second pass (2026-08-20, see docs/portal-editor-known-issues.md): expands
// the first pass's 5 decorative-only components with real business/form
// components, using the same "safe subset" rule the first pass established
// -- any prop the real component declares optional can be omitted from
// fields/render without misrepresenting the component; only REQUIRED
// ReactNode/function props make a component unregisterable.
//
// Registered this pass:
//   - RecordTable: a NEW component (design-system/components/record-table.tsx).
//     data-grid.tsx was previously assumed to already be a table component;
//     it is actually a scroll-viewport wrapper that takes a raw <table> as
//     `children` (ReactNode), so it cannot be driven by Puck field data
//     directly. RecordTable wraps DataGrid with a real <table> whose ROWS
//     are a Puck `array` field (primitives only), and reuses the
//     already-registered StatusDot for the status column -- this is the
//     actual "quotation table / customer list" component.
//   - DatePicker, MonthPicker, FileUploadField, FilterChips, Combobox,
//     TextAutocomplete, Listbox, RailNav: all-primitive prop shapes once
//     their optional ReactNode/callback props are omitted.
//
// Still NOT registered, and why -- these are program-controlled interface
// infrastructure, not static content a customer drags onto a page, so they
// do not belong in Puck's component palette regardless of field-type limits:
//   - Modal, AnchoredPanel: rendered conditionally via open/onClose state
//     from a parent, not placed on a canvas
//   - NotificationToast: a queue system driven by app state, not content
//   - ColumnsMenu: needs to be wired to a real table's live column-
//     visibility state, meaningless detached from one
//   - ConfirmSubmitButton: must live inside a real <form> it submits
//   - Field: `children` is a render-prop function (id: string) => ReactNode
//     -- no Puck field type can represent a function value
//   - MobileNav: same responsive-drawer role as RailNav; registering both
//     as separate draggable canvas components would be confusing rather
//     than useful -- RailNav covers the navigation need this pass targets.
type FormFieldRow = {
  label: string;
  kind: "string" | "number" | "date" | "select" | "boolean" | "textarea";
  choices?: string;
  required: "yes" | "no";
};

type Components = {
  TaskBoard: { stages: { name: string }[]; cards: BoardCard[] };
  BeforeAfter: { beforeLabel: string; afterLabel: string; beforeSrc?: string; afterSrc?: string };
  Stars: { value: number; outOf: number; caption?: string };
  Columns: { layout: ColumnsLayout; a: Slot; b: Slot; c: Slot };
  FormFields: { rows: FormFieldRow[]; submitLabel: string; cancelLabel: string };
  ActionButton: {
    label: string;
    // OPTIONAL, and that is the whole precedence rule. A required appearance
    // prop cannot be absent, and "absent" is the only signal that means
    // "follow the register". See puck-config-client.tsx.
    variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
    size: "sm" | "default" | "lg";
  };
  Tag: { label: string; variant?: "default" | "secondary" | "outline" | "destructive" };
  /* Optional so the register can supply it -- see design-doc.test.ts. */
  Divider: { spacing?: "tight" | "normal" | "loose" };
  NoteField: { label: string; placeholder: string };
  Panel: { title: string; description?: string; body: Slot; look?: "card" | "tinted" | "plain" | "ruled" };
  TabbedPanel: {
    look?: "pill" | "underline" | "segment" | "plain";
    oneLabel: string; twoLabel: string; threeLabel: string;
    one: Slot; two: Slot; three: Slot;
  };
  SystemShell: {
    sidebar: Slot;
    /** The split shell's second column. See system-shell.tsx. */
    aside: Slot;
    main: Slot;
    // Optional because the 换个款式 picker owns them and Puck demands a
    // registered field for every REQUIRED prop.
    nav?: "side" | "top" | "split";
    frame?: "flush" | "inset" | "floating";
    width?: "wide" | "centred";
    // `deep` is the only one of the three that is reliably dark -- see the
    // navTone note in design-system/components/system-shell.tsx.
    navTone?: "dark" | "light" | "deep";
  };
  PageHeader: {
    layout?: "split" | "stacked" | "centred" | "ruled";
    title: string;
    subtitle?: string;
    /** The one thing an owner opens this page to DO. A real link into their own
     *  system, not a decorative button -- see buildDashboard for why this
     *  carries the density a fake search box was going to carry. */
    actionLabel?: string;
    actionHref?: string;
    /** Small trailing note beside the title: 「更新于 09:30」. */
    meta?: string;
  };
  /** One of the 164 sections pulled from the @7ovr registry. Template side of
   *  the line the founder drew: the SECTION is chosen, its words are not
   *  edited. See design-system/editor/site-block.tsx. */
  SiteBlock: {
    block?: string;
    /** The customer's own words for the chosen section. Written by the AI
     *  through `set_copy`, not by a field -- a shop owner editing a nested
     *  JSON object is not an interface. */
    copy?: Record<string, unknown>;
  };
  // --- 官网 (shape: "landing") ------------------------------------------
  // The only two components in the catalogue whose reader is a STRANGER
  // rather than the owner. See site-hero.tsx and enquiry-form.tsx.
  SiteFeatures: {
    heading?: string;
    note?: string;
    items: { label: string; value: string; icon?: string }[];
      shape?: "cards" | "panel" | "bands" | "stated" | "dotted";
    noteHeading?: string;
};
  SiteTestimonials: {
    heading?: string;
    items: { quote: string; who: string; role?: string; stars?: number }[];
    shape?: "cards" | "ruled";
  };
  SiteGallery: {
    heading?: string;
    note?: string;
    shape?: "grid" | "bento" | "strip";
    items?: { src?: string; alt?: string; caption?: string }[];
  };
  SiteStory: {
    heading?: string;
    hint?: string;
    body?: string;
    shape?: "side" | "side-reverse" | "stack";
    photo?: string;
    photoAlt?: string;
    /* The customer's own dashboard, as a layout. See site-hero.tsx. */
    systemPreview?: unknown;
    /* 开场的地. Register-chosen; see site-composition.ts. */
    ground?: "page" | "ink";
    points?: { label: string }[];
  };
  SiteSteps: {
    heading?: string;
    note?: string;
    steps?: { label: string; value?: string }[];
    shape?: "ruled" | "numbered" | "across";
  };
  SiteWoven: {
    heading?: string;
    note?: string;
    points?: { label: string; value?: string }[];
    photos?: string[];
    hint?: string;
  };
  SiteBand: {
    photo?: string;
    photoAlt?: string;
    line?: string;
    hint?: string;
    height?: "tall" | "short";
  };
  SiteStatement: {
    body?: string;
    attribution?: string;
    shape?: "centre" | "rule" | "quote";
  };
  SiteTeam: {
    heading?: string;
    note?: string;
    hint?: string;
    shape?: "cards" | "plain" | "row";
    members?: { name: string; role?: string; years?: string; photo?: string }[];
  };
  SiteCreds: {
    heading?: string;
    hint?: string;
    shape?: "strip" | "badges" | "rating";
    rating?: { score?: string; count?: string; source?: string; placeholder?: boolean };
    items?: { label: string; note?: string; placeholder?: boolean }[];
  };
  SiteCta: {
    heading: string;
    note?: string;
    primaryLabel?: string;
    primaryHref?: string;
    secondaryLabel?: string;
    secondaryHref?: string;
      shape?: "band" | "panel" | "rule";
    photo?: string;
    photoAlt?: string;
};
  SiteBar: {
    brand: string;
    links?: { label: string; href: string }[];
    actionLabel?: string;
    actionHref?: string;
  };
  SiteFoot: {
    links?: { label: string; href: string }[];
    small?: { label: string; href: string }[];
    copyright?: string;
    askLabel?: string;
    askHref?: string;
    brand: string;
    tagline?: string;
    rows?: { label: string; value: string }[];
    note?: string;
  };
  FloatingContact: {
    number?: string;
    label?: string;
    message?: string;
    placeholder?: boolean;
  };
  SiteHero: {
    eyebrow?: string;
    brand?: string;
    headline: string;
    sub?: string;
    primaryLabel?: string;
    primaryHref?: string;
    secondaryLabel?: string;
    secondaryHref?: string;
    proof?: { value: string; label: string }[];
    /* The owner's own photograph for the first screen. 14 of 19 trading
       Malaysian SME sites give the opening to one; see site-hero.tsx. */
    photo?: string;
    photoAlt?: string;
    /* The customer's own dashboard, as a layout. See site-hero.tsx. */
    systemPreview?: unknown;
    /* 开场的地. Register-chosen; see site-composition.ts. */
    ground?: "page" | "ink";
    /* The printed phone number and the hours strip. Flat props rather than an
       object, because Puck's fields are flat and the owner has to be able to
       type their real number into one box. `phonePlaceholder` is what stops
       「012-345 6789」 reaching a stranger -- see publish-projection.ts. */
    /* Prices in the first screen. An empty `value` renders nothing, which is
       how a row the owner has not priced yet stays off a stranger's page. */
    priceRows?: { label: string; value: string }[];
    phoneLabel?: string;
    phoneNumber?: string;
    phonePlaceholder?: boolean;
    strip?: string;
    stripPlaceholder?: boolean;
    // Set by the 换款式 picker, not by a field -- see variants.ts.
    layout?: "left" | "band" | "center" | "plain" | "split" | "stage" | "bleed" | "band-bleed" | "name-plate";
    /** What the `split` 款式 draws on the right: the document this business
     *  sends. Written by the template, not offered as a field -- picking
     *  「价目表」 for a salon is a choice nobody should have to get right, and
     *  the templates already know how each trade closes a sale. */
    figure?: "quote" | "booking" | "order" | "pricelist" | "grid" | "card";
    figureData?: {
      brand?: string;
      services?: { label: string; value: string }[];
      stages?: string[];
      landsIn?: string;
      note?: string;
      askLabel?: string;
      sampleLabel?: string;
    };
  };
  EnquiryForm: {
    heading: string;
    blurb?: string;
    fields?: { label: string; placeholder?: string; kind?: "text" | "phone" | "long" }[];
    submitLabel?: string;
    landsIn?: string;
    /** The three pieces of the arrow sentence around `landsIn`. In the DATA, not
     *  in the component, because the component is server-rendered and cannot
     *  read the system-language context -- see enquiry-form.tsx. They were
     *  already being written into every landing template and silently dropped
     *  here, which is why an English website showed one Chinese line. */
    landsInBadge?: string;
    landsInBefore?: string;
    landsInAfter?: string;
    note?: string;
    look?: "card" | "plain" | "split";
  };
  EmptyState: { variant: "empty" | "filtered" | "cleared"; title: string; description?: string };
  StatusDot: { tone: "positive" | "warning" | "negative" | "neutral"; label: string };
  HeroCard: {
    label: string;
    value: string;
    href: string;
    /**
     * The change on the headline figure.
     *
     * It was missing from this type and from the render's destructure, so the
     * generator could pass it and the card would never see it -- 招牌 and 柔和,
     * the two registers whose whole dashboard leads with ONE number, printed
     * 「RM 71,300  vs last month」: a comparison word with nothing to compare.
     * HeroCard has rendered `chg` since it was written; the wire stopped here.
     */
    chg?: number | null;
    chgSuffix?: string;
    stats?: { label: string; value: string; href: string; tone?: "normal" | "caution" | "warn"; sub?: string }[];
    spark?: { n: number }[];
    sparkLabel?: string;
    // Set by the 换个款式 picker, not by a field -- see variants.ts.
    layout?: "full" | "solo" | "trend" | "stats";
    flat?: boolean;
  };
  Avatar: { name: string };
  WorkflowStrip: {
    title?: string;
    stages: WorkflowStage[];
    layout?: "row" | "timeline" | "numbered";
  };
  // One prop, not six. Columns and rows have to agree with each other (adding a
  // column grows every row), and Puck edits one prop per field -- so they are
  // one prop with one editor. See design-system/editor/table-field.tsx.
  RecordTable: {
    gridId: string;
    caption: string;
    table: TableModel;
    // Set by the 换个款式 picker, not by a field. See variants.ts.
    look?: "plain" | "compact" | "zebra" | "grid";
    row?: "plain" | "pill" | "avatar";
    // Objects rather than bare strings: Puck's array field edits item PROPS,
    // so a list of strings has nothing for its editor to bind to.
    filters?: { label: string }[];
  };
  DatePicker: { name: string; placeholder?: string; allowClear?: boolean; required?: boolean };
  MonthPicker: { name: string; placeholder?: string; allowClear?: boolean };
  FileUploadField: { label?: string; hint: string; name?: string; accept?: string };
  FilterChips: {
    chips: FilterChip[];
    clearAllHref: string;
    /* Written by the page builder in the system's language, and by
       layout-upgrade into any tree saved before they existed. Optional because
       an old saved node genuinely does not have them. */
    filteredByLabel?: string;
    clearAllLabel?: string;
  };
  Combobox: {
    name?: string;
    value: string;
    options: ComboboxOption[];
    placeholder: string;
  };
  TextAutocomplete: {
    name: string;
    defaultValue?: string;
    suggestions: { value: string }[];
    placeholder?: string;
  };
  Listbox: { name?: string; defaultValue?: string; options: ListboxOption[]; placeholder?: string };
  Alert: { variant: "default" | "destructive"; title: string; description?: string };
  Progress: { label?: string; value: number };
  TrendChart: { title?: string; caption?: string; frame?: TrendFrame; kind?: TrendKind; unit?: string; points: TrendPoint[] };
  // ---- 生意零件 ----
  InfoRows: {
    heading?: string;
    rows: InfoRow[];
    variant?: "comfortable" | "compact";
    framed?: boolean;
  };
  DaySchedule: { heading?: string; rows: ScheduleRow[]; framed?: boolean };
  DateProgress: { heading?: string; start: string; end: string; framed?: boolean };
  PeopleBoard: { heading?: string; people: PersonRow[]; columns?: 2 | 3 | 4 | 5 };
  FaceRow: { people: PersonRow[]; max?: number };
  PriceTable: {
    heading?: string;
    layout?: "cards" | "table";
    currency?: string;
    tiers: PriceTier[];
  };
  SmallStat: {
    label: string;
    value: string;
    delta?: number;
    period?: string;
    variant?: "default" | "compact" | "detailed";
  };
  StatRow: { tiles: StatTile[]; layout?: StatRowLayout };
  CopyValue: { label?: string; value: string };
  PayQr: { data: string; size?: number };
  ActivitySquares: { label?: string };
  // ---- 版面零件 ----
  LongText: { content: string; maxLines?: number };
  NoticePill: { tag?: string; text: string; themed?: boolean };
  // "yes" / "no", not booleans: Puck's radio writes its option value.
  NoticeBanner: { text: string; closable?: "yes" | "no" };
  FoldSection: { rows: FoldRow[]; openFirst?: boolean };
  PageNumbers: { pages?: number; current?: number };
  ZoomPhoto: { src: string; alt?: string; height?: number };
  // ---- 填写 ----
  CheckRow: { label: string; hint?: string; defaultChecked?: "yes" | "no" };
  ChoiceRow: {
    label?: string;
    options: ChoiceOption[];
    defaultValue?: string;
    inline?: "yes" | "no";
  };
  SwitchRow: { label: string; hint?: string; defaultOn?: "yes" | "no" };
  SliderRow: {
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: number;
    suffix?: string;
  };
  UploadBox: { title?: string; hint?: string; maxFiles?: number };
  TagPicker: { label?: string; options: ChoiceOption[]; placeholder?: string };
  PackagePicker: { options: PackageOption[]; defaultValue?: string };
  WeekStrip: { days?: number };
  ShelfList: {
    heading?: string;
    items: { title: string; description?: string; icon?: string; action?: string }[];
    // Optional on purpose: absent is the only way to say "follow the register".
    size?: "default" | "sm";
    separated?: boolean;
  };
  AttachmentList: {
    heading?: string;
    files: { name: string; meta?: string }[];
    orientation?: "horizontal" | "vertical";
  };
  MarkList: {
    heading?: string;
    marks: { text: string; tone?: "good" | "warn" | "bad"; icon?: string }[];
    rule?: "default" | "border" | "separator";
  };
  RankList: {
    heading?: string;
    rows: RankRow[];
    shape?: RankShape;
  };
  Bento: { lead: Slot; a: Slot; b: Slot };
  Overlap: { band: Slot; body: Slot };
  IntakeForm: {
    heading: string;
    note?: string;
    fields: IntakeField[];
    submitLabel: string;
    cancelLabel?: string;
  };
  PersonCard: {
    name: string;
    role?: string;
    tag?: string;
    rows: CardRow[];
    actionLabel?: string;
  };
  JobCard: {
    title: string;
    client?: string;
    status?: string;
    tone?: "normal" | "good" | "warn" | "bad";
    amount?: string;
    amountLabel?: string;
    percent?: number;
    stageLabel?: string;
  };
  TermsBlock: { heading: string; body: string; signLabel?: string; dateLabel?: string };
  MonthSummary: { heading: string; figures: SummaryFigure[]; footNote?: string };
  ShareChart: {
    title?: string;
    caption?: string;
    unit?: string;
    slices: ShareSlice[];
    shape?: ShareShape;
    frame?: "card" | "outline" | "bare";
  };
  PhotoFrame: {
    src?: string;
    alt?: string;
    caption?: string;
    ratio?: "wide" | "photo" | "square";
  };
  ActionRow: {
    actions: { label: string; tone?: "default" | "outline" | "secondary" | "ghost" }[];
    orientation?: "horizontal" | "vertical";
  };
  ChoiceSelect: {
    label?: string;
    name?: string;
    options: { label: string }[];
    size?: "default" | "sm";
  };
  RailNav: {
    variant?: RailVariant;
    actionLabel?: string;
    actionHref?: string;
    brandLabel: string;
    brandHref: string;
    items: RailItem[];
    utilityItems: RailUtilityItem[];
    userName: string;
    userRoleLabel?: string;
  };
};

const YES_NO = [
  { label: "不要", value: "no" },
  { label: "要", value: "yes" },
];

const STATUS_TONE_OPTIONS = [
  { label: "Positive", value: "positive" },
  { label: "Warning", value: "warning" },
  { label: "Negative", value: "negative" },
  { label: "Neutral", value: "neutral" },
];

export const puckConfig: Config<Components> = {
  // Puck labels the whole-page selection "Page" and, with no root config at
  // all, offers a default `title` field that writes to nothing this product
  // reads. Named in Chinese and emptied of fields: selecting the page should
  // say what is selected, not present a control that does nothing.
  root: { label: "整个页面", fields: {} },
  // TWELVE SHELVES, NONE OF THEM A JUNK DRAWER.
  //
  // There were six, and two of them held 37 of the 56 blocks: 「内容展示」 19
  // and 「填写与筛选」 18. A shelf with nineteen unrelated things on it is not a
  // shelf, it is the pile the shelves were supposed to replace -- which is what
  // the founder saw when he said 「不可能全部东西丢在一起」.
  //
  // Measured against the reference he named: 21st.dev does not run six coarse
  // buckets, it runs about thirty fine ones -- Buttons, Inputs, Cards, Tables,
  // Heroes, Pricing, Footers -- each small enough to hold in your head. The
  // number that matters is not how many categories there are, it is how many
  // things are in the one you opened. Theirs answer "what am I looking for" in
  // one word. Ours now do too, and nothing here holds more than seven.
  //
  // Still grouped by what the customer is TRYING TO DO, not by React type --
  // that part of the old comment was right and is kept.
  // OPENED OR CLOSED IS A DECISION ABOUT THE EDITOR, NOT THE GALLERY.
  //
  // 加一段 renders these as collapsible shelves. With six shelves open it was
  // 27 tiles deep before the first heading a customer had not already scrolled
  // past -- the pile again, in a 440px panel. Ten now start closed, so the
  // panel opens as an INDEX of twelve named shelves and you open the one you
  // want, which is what Durable's 「Add section」 does and what 21st's rail
  // does. 数字与图表 and 表格与看板 stay open because they are what a business
  // page is actually made of, and a panel that opens showing nothing at all
  // teaches you it is empty.
  //
  // 组件库 ignores this field entirely -- it keeps its own rail state.
  categories: {
    assembled: {
      title: "整段成品",
      components: [
        "IntakeForm",
        "PersonCard",
        "JobCard",
        "TermsBlock",
        "MonthSummary",
      ],
    },
    site: {
      title: "官网(客人看的)",
      components: ["SiteBar", "SiteHero", "SiteGallery", "SiteBand", "SiteWoven", "SiteSteps", "SiteStatement", "SiteStory", "SiteTeam", "SiteFeatures", "SiteCreds", "SiteTestimonials", "SiteCta", "EnquiryForm", "SiteFoot", "FloatingContact"],
      defaultExpanded: false,
    },
    // The pulled catalogue. One entry, because SiteBlock IS the catalogue --
    // 164 shelf lines would bury the two blocks above that a customer actually
    // edits. Browsing the 164 happens in 模板库, where whole pages are chosen.
    sections: {
      title: "官网版段(整段套用)",
      components: ["SiteBlock"],
      defaultExpanded: false,
    },
    words: {
      title: "标题与文字",
      components: ["PageHeader", "LongText", "FoldSection", "InfoRows"],
      defaultExpanded: false,
    },
    numbers: {
      title: "数字与图表",
      components: ["StatRow", "HeroCard", "SmallStat", "TrendChart", "Progress", "DateProgress", "ActivitySquares"],
      defaultExpanded: true,
    },
    tables: {
      title: "表格与看板",
      components: ["RecordTable", "TaskBoard", "PriceTable", "DaySchedule", "PeopleBoard"],
      defaultExpanded: true,
    },
    flow: {
      title: "流程与状态",
      components: ["WorkflowStrip", "StatusDot", "Tag", "NoticePill", "Stars", "ShelfList"],
      defaultExpanded: false,
    },
    notices: {
      title: "提示与空白",
      components: ["Alert", "NoticeBanner", "EmptyState", "MarkList"],
      defaultExpanded: false,
    },
    people: {
      title: "照片与人",
      components: ["Avatar", "FaceRow", "ZoomPhoto", "BeforeAfter", "PhotoFrame", "AttachmentList"],
      defaultExpanded: false,
    },
    fill: {
      title: "填写",
      components: ["FormFields", "NoteField", "TextAutocomplete", "UploadBox", "FileUploadField"],
      defaultExpanded: false,
    },
    pick: {
      title: "选择",
      components: ["DatePicker", "MonthPicker", "WeekStrip", "Listbox", "Combobox", "TagPicker", "PackagePicker", "ChoiceSelect"],
      defaultExpanded: false,
    },
    toggles: {
      title: "勾选与开关",
      components: ["CheckRow", "ChoiceRow", "SwitchRow", "SliderRow"],
      defaultExpanded: false,
    },
    actions: {
      title: "按钮与筛选",
      components: ["ActionButton", "FilterChips", "CopyValue", "PayQr", "PageNumbers", "ActionRow"],
      defaultExpanded: false,
    },
    layout: {
      title: "页面框架",
      components: ["SystemShell", "RailNav", "Columns", "Panel", "TabbedPanel", "Divider"],
      defaultExpanded: false,
    },
  },
  components: {
    // ============================================================ 生意零件
    InfoRows: {
      label: "资料列表",
      fields: {
        heading: { label: "标题", type: "text" },
        rows: {
          label: "每一行",
          type: "array",
          arrayFields: {
            label: { label: "名称", type: "text" },
            value: { label: "内容", type: "text" },
            icon: {
              label: "图案",
              type: "select",
              options: [
                { label: "人", value: "person" },
                { label: "电话", value: "phone" },
                { label: "地点", value: "place" },
                { label: "时间", value: "time" },
                { label: "钱", value: "money" },
                { label: "文件", value: "file" },
                { label: "标签", value: "tag" },
                { label: "公司", value: "company" },
                { label: "工程", value: "work" },
                { label: "日期", value: "date" },
              ],
            },
          },
          defaultItemProps: { label: "名称", value: "内容", icon: "file" },
          getItemSummary: (item) => item.label || "一行",
        },
      },
      defaultProps: {
        heading: "客户资料",
        rows: [
          { label: "联络人", value: "陈先生", icon: "person" },
          { label: "电话", value: "012-345 6789", icon: "phone" },
          { label: "地址", value: "Taman Desa, KL", icon: "place" },
        ],
      },
      render: ({ heading, rows, variant, framed }) => (
        <InfoRows heading={heading} rows={rows} variant={variant} framed={framed} />
      ),
    },
    DaySchedule: {
      label: "排班表",
      fields: {
        heading: { label: "标题", type: "text" },
        rows: {
          label: "时间表",
          type: "array",
          arrayFields: {
            time: { label: "几点", type: "text" },
            endTime: { label: "到几点", type: "text" },
            title: { label: "做什么", type: "text" },
            description: { label: "说明", type: "text" },
          },
          defaultItemProps: { time: "09:00", title: "安排" },
          getItemSummary: (item) => `${item.time || ""} ${item.title || ""}`.trim() || "一项",
        },
      },
      defaultProps: {
        heading: "今天的安排",
        rows: [
          { time: "09:00", endTime: "11:00", title: "Taman Desa 量尺", description: "陈先生" },
          { time: "14:00", endTime: "16:30", title: "Bukit Jalil 施工", description: "泥水" },
        ],
      },
      render: ({ heading, rows, framed }) => (
        <DaySchedule heading={heading} rows={rows} framed={framed} />
      ),
    },
    DateProgress: {
      label: "进度（看日期）",
      fields: {
        heading: { label: "标题", type: "text" },
        start: { label: "开工日期", type: "text" },
        end: { label: "完成日期", type: "text" },
      },
      defaultProps: {
        heading: "工程进度",
        start: "2026-08-01",
        end: "2026-10-15",
      },
      render: ({ heading, start, end, framed }) => (
        <DateProgress heading={heading} start={start} end={end} framed={framed} />
      ),
    },
    PeopleBoard: {
      label: "员工 / 师傅",
      fields: {
        heading: { label: "标题", type: "text" },
        columns: {
          label: "一行几个",
          type: "radio",
          options: [
            { label: "2", value: 2 },
            { label: "3", value: 3 },
            { label: "4", value: 4 },
          ],
        },
        people: {
          label: "人",
          type: "array",
          arrayFields: {
            name: { label: "名字", type: "text" },
            title: { label: "职位", type: "text" },
            image: { label: "照片网址", type: "text" },
          },
          defaultItemProps: { name: "名字", title: "职位" },
          getItemSummary: (item) => item.name || "一个人",
        },
      },
      defaultProps: {
        heading: "我们的师傅",
        people: [
          { name: "陈师傅", title: "泥水" },
          { name: "林师傅", title: "水电" },
          { name: "黄师傅", title: "木工" },
        ],
      },
      render: ({ heading, people, columns }) => (
        <PeopleBoard heading={heading} people={people} columns={columns} />
      ),
    },
    FaceRow: {
      label: "多人头像",
      fields: {
        max: { label: "最多显示几个", type: "number" },
        people: {
          label: "人",
          type: "array",
          arrayFields: {
            name: { label: "名字", type: "text" },
            image: { label: "照片网址", type: "text" },
          },
          defaultItemProps: { name: "名字" },
          getItemSummary: (item) => item.name || "一个人",
        },
      },
      defaultProps: {
        max: 4,
        people: [{ name: "陈师傅" }, { name: "林师傅" }, { name: "黄师傅" }],
      },
      render: ({ people, max }) => <FaceRow people={people} max={max} />,
    },
    PriceTable: {
      label: "价目表",
      fields: {
        heading: { label: "标题", type: "text" },
        currency: { label: "货币", type: "text" },
        layout: {
          label: "怎么排",
          type: "radio",
          options: [
            { label: "卡片", value: "cards" },
            { label: "表格", value: "table" },
          ],
        },
        tiers: {
          label: "配套",
          type: "array",
          arrayFields: {
            name: { label: "配套名", type: "text" },
            description: { label: "一句话说明", type: "text" },
            price: { label: "价钱", type: "number" },
            period: { label: "单位（每月 / 每次）", type: "text" },
            features: { label: "包含什么（用、分开）", type: "text" },
            cta: { label: "按钮上的字", type: "text" },
            highlighted: { label: "推荐这个", type: "radio", options: YES_NO },
          },
          defaultItemProps: { name: "配套", price: 0, highlighted: "no" as const },
          getItemSummary: (item) => item.name || "配套",
        },
      },
      defaultProps: {
        heading: "收费",
        currency: "MYR",
        tiers: [
          {
            name: "基本",
            description: "小工程",
            price: 1500,
            period: "起",
            features: "免费上门量尺、报价单、一次修改",
            cta: "问详情",
            highlighted: "no",
          },
          {
            name: "全屋",
            description: "整间屋翻新",
            price: 8800,
            period: "起",
            features: "免费上门量尺、3D 图、无限次修改、一年保修",
            cta: "问详情",
            highlighted: "yes",
          },
        ],
      },
      render: ({ heading, layout, currency, tiers }) => (
        <PriceTable heading={heading} layout={layout} currency={currency} tiers={tiers} />
      ),
    },
    StatRow: {
      label: "指标排",
      fields: {
        tiles: {
          label: "每一格",
          type: "array",
          arrayFields: {
            label: { label: "名称", type: "text" },
            value: { label: "数值", type: "text" },
            delta: { label: "比上期（%）", type: "number" },
            deltaLabel: { label: "比什么", type: "text" },
            tone: {
              label: "读法",
              type: "select",
              options: [
                { label: "一般", value: "normal" },
                { label: "好消息", value: "good" },
                { label: "要注意", value: "warn" },
                { label: "坏消息", value: "bad" },
              ],
            },
            iconName: {
              label: "图案",
              type: "select",
              options: [
                { label: "无", value: "" },
                { label: "总览", value: "dashboard" },
                { label: "客户", value: "customers" },
                { label: "报价单", value: "quotations" },
                { label: "工程", value: "projects" },
                { label: "收款", value: "payments" },
                { label: "预约", value: "bookings" },
                { label: "订单", value: "orders" },
                { label: "对账", value: "reconciliation" },
                { label: "佣金", value: "commission" },
                { label: "报表", value: "reports" },
                { label: "排名", value: "ranking" },
                { label: "库存", value: "inventory" },
              ],
            },
            href: { label: "点了去哪（留空就不能点）", type: "text" },
          },
          defaultItemProps: {
            label: "一个数字",
            value: "0",
            deltaLabel: "",
            tone: "normal",
            iconName: "dashboard",
            href: "",
          },
          getItemSummary: (item) => item.label || "一格",
        },
      },
      // NO `layout` HERE, and that is deliberate. Puck writes defaultProps into
      // the saved node, so a default would make "the customer never chose"
      // indistinguishable from "chose, and it equals the default" -- and the
      // register could never win. See puck-config-client.tsx.
      defaultProps: {
        tiles: [
          { label: "已确认工程", value: "RM 71,300", delta: 20, deltaLabel: "比上月", tone: "good", iconName: "payments", href: "" },
          { label: "进行中", value: "4", deltaLabel: "本周新开 1 单", tone: "normal", iconName: "projects", href: "" },
          { label: "待回复报价", value: "2", deltaLabel: "最久一张 3 天", tone: "warn", iconName: "quotations", href: "" },
          { label: "做完未收款", value: "RM 31,200", deltaLabel: "超过 30 天", tone: "bad", iconName: "reconciliation", href: "" },
        ],
      },
      render: ({ tiles, layout }) => <StatRow tiles={tiles} layout={layout} />,
    },

    SmallStat: {
      label: "小数字卡",
      fields: {
        label: { label: "名称", type: "text" },
        value: { label: "数值", type: "text" },
        delta: { label: "比上期（%）", type: "number" },
        period: { label: "比什么", type: "text" },
        variant: {
          label: "款式",
          type: "radio",
          options: [
            { label: "正常", value: "default" },
            { label: "紧凑", value: "compact" },
            { label: "详细", value: "detailed" },
          ],
        },
      },
      defaultProps: {
        label: "本月新客户",
        value: "12",
        delta: 8,
        // NOT "vs 上个月": StatCard already prints `labels.deltaPrefix` in
        // front of this, so the default was rendering 「vs vs 上个月」. Been
        // there since the block was written and only visible once the
        // English projection put two Latin "vs" next to each other.
        period: "上个月",
      },
      render: ({ label, value, delta, period, variant }) => (
        <SmallStat label={label} value={value} delta={delta} period={period} variant={variant} />
      ),
    },
    CopyValue: {
      label: "单号（可复制）",
      fields: {
        label: { label: "名称", type: "text" },
        value: { label: "内容", type: "text" },
      },
      defaultProps: { label: "报价单号", value: "QT-2026-0142" },
      render: ({ label, value }) => <CopyValue label={label} value={value} />,
    },
    PayQr: {
      label: "收款二维码",
      fields: {
        data: { label: "扫了去哪里（网址 / DuitNow）", type: "text" },
        size: { label: "大小", type: "number" },
      },
      defaultProps: { data: "https://formae.my/pay/demo", size: 180 },
      render: ({ data, size }) => <PayQr data={data} size={size} />,
    },
    ActivitySquares: {
      label: "出勤格",
      fields: { label: { label: "说明", type: "text" } },
      defaultProps: { label: "今年出勤" },
      render: ({ label }) => <ActivitySquares label={label} />,
    },

    // ============================================================ 版面零件
    NoticeBanner: {
      label: "顶部通知条",
      fields: {
        text: { label: "写什么", type: "text" },
        closable: { label: "可以关掉", type: "radio", options: YES_NO },
      },
      defaultProps: { text: "本月佣金已经出了,记得去看。", closable: "yes" },
      render: ({ text, closable }) => (
        <NoticeBanner text={text} closable={closable !== "no"} />
      ),
    },
    NoticePill: {
      label: "公告",
      fields: {
        tag: { label: "前面的小字", type: "text" },
        text: { label: "写什么", type: "text" },
      },
      defaultProps: { tag: "新", text: "报价单可以直接 WhatsApp 出去了" },
      render: ({ tag, text }) => <NoticePill tag={tag} text={text} />,
    },
    FoldSection: {
      label: "收合区块",
      fields: {
        rows: {
          label: "每一段",
          type: "array",
          arrayFields: {
            title: { label: "标题", type: "text" },
            body: { label: "内容", type: "textarea" },
          },
          defaultItemProps: { title: "标题", body: "内容" },
          getItemSummary: (item) => item.title || "一段",
        },
      },
      defaultProps: {
        openFirst: true,
        rows: [
          { title: "付款方式", body: "订金 50%,施工完成后付清尾款。" },
          { title: "保修", body: "水电一年保修,木工六个月。" },
        ],
      },
      render: ({ rows, openFirst }) => <FoldSection rows={rows} openFirst={openFirst} />,
    },
    LongText: {
      label: "长文（可收起）",
      fields: {
        content: { label: "内容", type: "textarea" },
        maxLines: { label: "先显示几行", type: "number" },
      },
      defaultProps: {
        maxLines: 3,
        content:
          "施工范围包括拆除旧橱柜、水电改位、防水、贴砖、天花板与油漆。不包括家具、电器与窗帘。工期以实际现场情况为准,如遇管理层批准延误,完工日期顺延。",
      },
      render: ({ content, maxLines }) => <LongText content={content} maxLines={maxLines} />,
    },
    PageNumbers: {
      label: "分页",
      fields: {
        pages: { label: "总共几页", type: "number" },
        current: { label: "现在第几页", type: "number" },
      },
      defaultProps: { pages: 5, current: 1 },
      render: ({ pages, current }) => <PageNumbers pages={pages} current={current} />,
    },
    ZoomPhoto: {
      label: "照片（可放大）",
      fields: {
        src: { label: "照片网址", type: "text" },
        alt: { label: "说明", type: "text" },
        height: { label: "高度", type: "number" },
      },
      defaultProps: { src: "", alt: "施工照片", height: 220 },
      render: ({ src, alt, height }) => <ZoomPhoto src={src} alt={alt} height={height} />,
    },

    // ============================================================ 填写
    CheckRow: {
      label: "勾选",
      fields: {
        label: { label: "写什么", type: "text" },
        hint: { label: "下面的小字", type: "text" },
        defaultChecked: { label: "预设勾着", type: "radio", options: YES_NO },
      },
      defaultProps: { label: "含材料", hint: "不勾就是只算工钱", defaultChecked: "no" },
      render: ({ label, hint, defaultChecked }) => (
        <CheckRow label={label} hint={hint} defaultChecked={defaultChecked === "yes"} />
      ),
    },
    ChoiceRow: {
      label: "单选一项",
      fields: {
        label: { label: "问什么", type: "text" },
        inline: { label: "排成一行", type: "radio", options: YES_NO },
        options: {
          label: "选项",
          type: "array",
          arrayFields: { label: { label: "选项", type: "text" } },
          defaultItemProps: { label: "选项" },
          getItemSummary: (item) => item.label || "选项",
        },
      },
      defaultProps: {
        label: "付款方式",
        inline: "yes",
        options: [{ label: "现金" }, { label: "转账" }, { label: "支票" }],
      },
      render: ({ label, options, inline }) => (
        <ChoiceRow label={label} options={options} inline={inline === "yes"} />
      ),
    },
    SwitchRow: {
      label: "开关",
      fields: {
        label: { label: "写什么", type: "text" },
        hint: { label: "下面的小字", type: "text" },
        defaultOn: { label: "预设开着", type: "radio", options: YES_NO },
      },
      defaultProps: { label: "自动发提醒", hint: "尾款到期前三天", defaultOn: "yes" },
      render: ({ label, hint, defaultOn }) => (
        <SwitchRow label={label} hint={hint} defaultOn={defaultOn === "yes"} />
      ),
    },
    SliderRow: {
      label: "拉杆",
      fields: {
        label: { label: "写什么", type: "text" },
        min: { label: "最小", type: "number" },
        max: { label: "最大", type: "number" },
        step: { label: "一次跳多少", type: "number" },
        defaultValue: { label: "预设", type: "number" },
        suffix: { label: "单位", type: "text" },
      },
      defaultProps: { label: "完成度", min: 0, max: 100, step: 5, defaultValue: 60, suffix: "%" },
      render: ({ label, min, max, step, defaultValue, suffix }) => (
        <SliderRow
          label={label}
          min={min}
          max={max}
          step={step}
          defaultValue={defaultValue}
          suffix={suffix}
        />
      ),
    },
    UploadBox: {
      label: "上传照片 / 文件",
      fields: {
        title: { label: "写什么", type: "text" },
        hint: { label: "下面的小字", type: "text" },
        maxFiles: { label: "最多几个", type: "number" },
      },
      defaultProps: { title: "拖施工照片进来,或者点一下选", hint: "最多 6 张", maxFiles: 6 },
      render: ({ title, hint, maxFiles }) => (
        <UploadBox title={title} hint={hint} maxFiles={maxFiles} />
      ),
    },
    TagPicker: {
      label: "标签",
      fields: {
        label: { label: "写什么", type: "text" },
        placeholder: { label: "搜索框的提示", type: "text" },
        options: {
          label: "可以选的标签",
          type: "array",
          arrayFields: { label: { label: "标签", type: "text" } },
          defaultItemProps: { label: "标签" },
          getItemSummary: (item) => item.label || "标签",
        },
      },
      defaultProps: {
        label: "客户标签",
        placeholder: "找标签…",
        options: [{ label: "熟客" }, { label: "介绍来的" }, { label: "拖数" }, { label: "急单" }],
      },
      render: ({ label, options, placeholder }) => (
        <TagPicker label={label} options={options} placeholder={placeholder} />
      ),
    },
    PackagePicker: {
      label: "选配套",
      fields: {
        options: {
          label: "配套",
          type: "array",
          arrayFields: {
            title: { label: "配套名", type: "text" },
            subtitle: { label: "旁边的小字", type: "text" },
            description: { label: "说明", type: "text" },
          },
          defaultItemProps: { title: "配套" },
          getItemSummary: (item) => item.title || "配套",
        },
      },
      defaultProps: {
        options: [
          { title: "一次过", subtitle: "RM 1,500", description: "做完一次付清" },
          { title: "分三期", subtitle: "RM 550 × 3", description: "订金、施工中、完工" },
        ],
      },
      render: ({ options }) => <PackagePicker options={options} />,
    },
    WeekStrip: {
      label: "一周日期",
      fields: { days: { label: "显示几天", type: "number" } },
      defaultProps: { days: 5 },
      render: ({ days }) => <WeekStrip days={days} />,
    },

    // The page shell. Listed first because it is the frame every generated
    // page is built inside -- see design-system/components/system-shell.tsx for
    // why a sidebar could not simply be the first block in a flat stack.
    SystemShell: {
      label: "页面框架",
      fields: {
        // Paired with RailNav's 「顶部」 variant. Kept on the SHELL rather than
        // on the rail because it is a fact about the page — where the
        // navigation sits — and the shell is what has to become a column
        // instead of a row.
        // `nav` and `navTone` used to be two radio groups here. They are the
        // 换个款式 picker's six tiles now, and leaving the radios in place
        // would be the same control twice -- with the worse half on top, since
        // reading 「顶部 / 浅色」 and imagining the result is exactly what the
        // pictures exist to replace.
        sidebar: { label: "侧边栏", type: "slot" },
        // The split shell's second column. Empty on every register that does
        // not ask for one, and an empty slot renders nothing -- so the other
        // fourteen are untouched.
        aside: { label: "第二栏", type: "slot" },
        main: { label: "页面内容", type: "slot" },
      },
      // NO `nav` OR `navTone` HERE, for the reason RecordTable states a
      // thousand lines below: an absent appearance prop is the ONLY way to
      // say "follow the register". These two carried "side" / "dark" and
      // therefore overrode all twenty-one registers' preferences forever --
      // measured, three registers rendered a byte-identical rail.
      defaultProps: { sidebar: [], aside: [], main: [] },
      render: ({ sidebar: Sidebar, aside: Aside, main: Main, nav, navTone, frame, width }) => (
        <SystemShell
          nav={nav ?? "side"}
          navTone={navTone ?? "dark"}
          frame={frame ?? "flush"}
          width={width ?? "wide"}
          sidebar={<Sidebar />}
          aside={<Aside />}
          main={<Main />}
        />
      ),
    },
    // The block that stops every page being one vertical stack.
    Columns: {
      label: "分栏",
      fields: {
        layout: {
          label: "分法",
          type: "radio",
          options: [
            { label: "对半", value: "half" },
            { label: "左宽", value: "wide-left" },
            { label: "右宽", value: "wide-right" },
            { label: "三栏", value: "thirds" },
          ],
        },
        a: { label: "第一栏", type: "slot" },
        b: { label: "第二栏", type: "slot" },
        c: { label: "第三栏（选三栏才显示）", type: "slot" },
      },
      defaultProps: { layout: "half", a: [], b: [], c: [] },
      render: ({ layout, a: A, b: B, c: C }) => (
        <Columns layout={layout} a={<A />} b={<B />} c={<C />} />
      ),
    },
    // Six field types in one block. Nothing is persisted, because this is a
    // design OF a system and not the system. `onChange` is a deliberate no-op
    // rather than omitted: the component warns in the console when an editable
    // form has no handler, and a warning that fires on every render trains
    // people to stop reading the console.
    FormFields: {
      label: "填写表单",
      fields: {
        rows: {
          label: "栏位",
          type: "array",
          getItemSummary: (item: FormFieldRow) => (item && item.label) || "栏位",
          arrayFields: {
            label: { label: "栏位名", type: "text" },
            kind: {
              label: "填什么",
              type: "select",
              options: [
                { label: "文字", value: "string" },
                { label: "数字", value: "number" },
                { label: "日期", value: "date" },
                { label: "选一个", value: "select" },
                { label: "是 / 否", value: "boolean" },
                { label: "长文字", value: "textarea" },
              ],
            },
            choices: { label: "选项（用、分开）", type: "text" },
            required: {
              label: "一定要填",
              type: "radio",
              options: [
                { label: "不用", value: "no" },
                { label: "要", value: "yes" },
              ],
            },
          },
        },
        submitLabel: { label: "确定按钮", type: "text" },
        cancelLabel: { label: "取消按钮", type: "text" },
      },
      defaultProps: {
        submitLabel: "保存",
        cancelLabel: "取消",
        rows: [
          { label: "客户", kind: "string", required: "yes" },
          { label: "金额", kind: "number", required: "no" },
          { label: "日期", kind: "date", required: "no" },
          { label: "备注", kind: "textarea", required: "no" },
        ],
      },
      render: ({ rows, submitLabel, cancelLabel }) => {
        const schema: PropertiesFormField[] = (rows ?? []).map((r, i) => ({
          key: `f${i}`,
          type: r.kind,
          label: r.label,
          required: r.required === "yes",
          options: r.kind === "select" ? splitChoices(r.choices) : undefined,
        }));
        const values = Object.fromEntries(
          schema.map((f) => [f.key, f.type === "boolean" ? false : ""]),
        );
        return (
          <PropertiesForm
            schema={schema}
            values={values}
            mode="edit"
            onChange={() => {}}
            showSubmitActions
            submitLabel={submitLabel}
            cancelLabel={cancelLabel}
          />
        );
      },
    },
    ActionButton: {
      label: "按钮",
      fields: {
        label: { label: "按钮上的字", type: "text" },
        variant: {
          label: "轻重",
          type: "select",
          options: [
            { label: "主要（实心）", value: "default" },
            { label: "次要", value: "secondary" },
            { label: "描边", value: "outline" },
            { label: "很淡", value: "ghost" },
            { label: "危险（删除）", value: "destructive" },
          ],
        },
        size: {
          label: "大小",
          type: "radio",
          options: [
            { label: "小", value: "sm" },
            { label: "正常", value: "default" },
            { label: "大", value: "lg" },
          ],
        },
      },
      defaultProps: { label: "新增", size: "default" },
      render: ({ label, variant, size }) => (
        <UiButton variant={variant} size={size}>{label}</UiButton>
      ),
    },
    NoteField: {
      label: "多行填写",
      fields: {
        label: { label: "栏位名", type: "text" },
        placeholder: { label: "灰字提示", type: "text" },
      },
      defaultProps: { label: "备注", placeholder: "写给自己看的" },
      render: ({ label, placeholder }) => (
        <label className="flex flex-col [gap:var(--gap-inline)]">
          <span className="[font-size:var(--text-sm)] [color:var(--color-paper-dim)]">{label}</span>
          <UiTextarea placeholder={placeholder} rows={3} />
        </label>
      ),
    },
    Tag: {
      label: "标记",
      fields: {
        label: { label: "字", type: "text" },
        variant: {
          label: "轻重",
          type: "select",
          options: [
            { label: "实心", value: "default" },
            { label: "次要", value: "secondary" },
            { label: "描边", value: "outline" },
            { label: "红色", value: "destructive" },
          ],
        },
      },
      /* `variant` deliberately absent -- see Divider above. UiBadge's own
         default is `secondary`, which is what this used to hard-code. */
      defaultProps: { label: "新客户" },
      render: ({ label, variant }) => <UiBadge variant={variant}>{label}</UiBadge>,
    },
    Divider: {
      label: "分隔线",
      fields: {
        spacing: {
          label: "上下留白",
          type: "radio",
          options: [
            { label: "窄", value: "tight" },
            { label: "正常", value: "normal" },
            { label: "宽", value: "loose" },
          ],
        },
      },
      /* NO `spacing` HERE. All fourteen registers declare one and none of
         them has ever applied: a prop Puck fills in from defaultProps is
         present, and present outranks the register. The render below already
         treats anything that is not tight or loose as normal, so the fallback
         is where it belongs. See design-doc.test.ts. */
      defaultProps: {},
      render: ({ spacing }) => (
        <div className={spacing === "tight" ? "py-1.5" : spacing === "loose" ? "py-7" : "py-4"}>
          <UiSeparator />
        </div>
      ),
    },
    Panel: {
      label: "卡片分区",
      fields: {
        title: { label: "标题", type: "text" },
        description: { label: "说明", type: "text" },
        body: { label: "里面放什么", type: "slot" },
      },
      defaultProps: { title: "这一区", description: "", body: [] },
      // FOUR LOOKS, and this is the second-largest surface on a page after the
      // rail. It had none until 2026-08-23, which is a large part of why
      // twenty-two registers rendered the same page: whatever the register
      // said, every section was a shadcn Card with a header.
      render: ({ title, description, body: Body, look }) => {
        // A SECTION WITH NO TITLE IS A SECTION, NOT A SECTION WITH AN EMPTY
        // TITLE. Some blocks carry their own heading -- RecordTable draws one
        // with a row count and filter segments beside it -- and wrapping those
        // in a titled Panel prints the heading twice. Rendering an empty
        // CardTitle instead leaves a blank line and the header's padding above
        // every table on the page, which reads as a mistake because it is one.
        /*
          `min-w-0` ON EVERY SHAPE THIS RETURNS.

          A grid or flex CHILD defaults to `min-width: auto`, which means it
          refuses to shrink below its content. ActivitySquares is 53 weeks of
          11px squares -- about 740px -- and it already carries `w-full
          overflow-x-auto` for exactly this, with a comment saying so. That
          scroller could never fire, because this wrapper sat between it and the
          Columns cell and would not shrink, so the heatmap pushed its half of
          the row wider and painted over the workflow strip beside it.
          Screenshotted at 1440 on 台账, twice, a day apart.

          The Columns cell has carried `min-w-0` since it was written. It is not
          enough on its own: every box in the chain has to agree to shrink, and
          this was the one that did not.
        */
        const titled = Boolean(title) || Boolean(description);
        const head = (
          <>
            {title ? <CardTitle>{title}</CardTitle> : null}
            {description ? <CardDescription>{description}</CardDescription> : null}
          </>
        );
        if (look === "plain" || look === "ruled") {
          if (!titled) return <section className="h-full min-w-0"><Body /></section>;
          return (
            <section className="flex min-w-0 flex-col h-full [gap:var(--gap-stack)]">
              <div
                className={
                  look === "ruled"
                    ? "[border-bottom:var(--hairline)_solid_var(--color-ink-800)] [padding-bottom:calc(var(--gap-stack)*0.6)]"
                    : ""
                }
              >
                {head}
              </div>
              <Body />
            </section>
          );
        }
        return (
          // h-full: inert on its own (the parent has no height), load-bearing
          // inside a Columns cell, where a three-row ranking beside a chart
          // otherwise draws a short card with bare ground under it.
          <Card className="h-full min-w-0">
            {titled ? (
              <CardHeader className={look === "tinted" ? "[background-color:var(--color-ink-850)] [border-bottom:var(--hairline)_solid_var(--color-ink-800)] [border-top-left-radius:inherit] [border-top-right-radius:inherit]" : undefined}>
                {head}
              </CardHeader>
            ) : null}
            <CardContent className={titled ? undefined : "[padding-top:var(--pad-card)]"}>
              <Body />
            </CardContent>
          </Card>
        );
      },
    },
    // Three tabs, fixed. Puck slots are declared statically, so a variable
    // number of tabs would mean a variable number of slot FIELDS, which the
    // config format cannot express. Three covers the shape every one of these
    // actually takes.
    TabbedPanel: {
      label: "标签页",
      fields: {
        oneLabel: { label: "第一页名称", type: "text" },
        twoLabel: { label: "第二页名称", type: "text" },
        threeLabel: { label: "第三页名称（留空就只有两页）", type: "text" },
        one: { label: "第一页内容", type: "slot" },
        two: { label: "第二页内容", type: "slot" },
        three: { label: "第三页内容", type: "slot" },
      },
      defaultProps: {
        oneLabel: "全部", twoLabel: "进行中", threeLabel: "完成",
        one: [], two: [], three: [],
      },
      // FOUR TAB LOOKS. A tab strip is one of the few controls a customer reads
      // as "this software's house style" before reading any content, and it had
      // exactly one until 2026-08-23.
      //
      //   pill      shadcn's own filled pill. The default.
      //   underline the tab is a word with a rule under the live one -- what a
      //             register built on hairlines (台账, 单据, 码) wants.
      //   segment   one enclosed control, iOS-style, for the rounded family.
      //   plain     words only, the live one just bolder. For 墨 and 素, where
      //             a control with its own box is a second structure.
      render: ({ oneLabel, twoLabel, threeLabel, one: One, two: Two, three: Three, look }) => (
        <Tabs defaultValue="one" className={look === "plain" ? "[--tab-plain:1]" : undefined}>
          <TabsList
            className={
              look === "underline"
                ? "h-auto w-full justify-start gap-4 rounded-none bg-transparent p-0 [border-bottom:var(--hairline)_solid_var(--color-ink-800)] [&>*]:rounded-none [&>*]:border-0 [&>*]:bg-transparent [&>*]:px-0 [&>*]:pb-2 [&>*[data-state=active]]:[border-bottom:2px_solid_var(--color-primary)] [&>*[data-state=active]]:[color:var(--color-primary)] [&>*[data-state=active]]:shadow-none"
                : look === "plain"
                  ? "h-auto w-full justify-start gap-5 rounded-none bg-transparent p-0 [&>*]:rounded-none [&>*]:bg-transparent [&>*]:px-0 [&>*]:shadow-none [&>*[data-state=active]]:[font-weight:var(--fw-semibold)] [&>*[data-state=active]]:[color:var(--color-paper)]"
                  : look === "segment"
                    ? "[background-color:var(--color-ink-850)] [border:var(--hairline)_solid_var(--color-ink-800)] [border-radius:var(--radius-pill)] [&>*]:[border-radius:var(--radius-pill)]"
                    : undefined
            }
          >
            <TabsTrigger value="one">{oneLabel}</TabsTrigger>
            <TabsTrigger value="two">{twoLabel}</TabsTrigger>
            {threeLabel ? <TabsTrigger value="three">{threeLabel}</TabsTrigger> : null}
          </TabsList>
          <TabsContent value="one"><One /></TabsContent>
          <TabsContent value="two"><Two /></TabsContent>
          {threeLabel ? <TabsContent value="three"><Three /></TabsContent> : null}
        </Tabs>
      ),
    },
    // 看板 -- the same set of jobs the record table lists, arranged by which
    // step they are stuck at. A contractor reads 「三张卡堆在收尾」 off a board
    // faster than off a status column.
    TaskBoard: {
      label: "看板",
      fields: {
        stages: {
          label: "阶段",
          type: "array",
          getItemSummary: (item: { name: string }) => (item && item.name) || "阶段",
          arrayFields: { name: { label: "阶段名", type: "text" } },
        },
        cards: {
          label: "卡片",
          type: "array",
          getItemSummary: (item: BoardCard) => (item && item.title) || "卡片",
          arrayFields: {
            title: { label: "标题", type: "text" },
            stage: { label: "在哪个阶段", type: "text" },
            note: { label: "小字", type: "text" },
          },
        },
      },
      defaultProps: {
        stages: [{ name: "报价中" }, { name: "施工中" }, { name: "收尾" }],
        cards: [
          { title: "Taman Desa 三房翻新", stage: "施工中", note: "陈先生 · RM 48,500" },
          { title: "Bukit Jalil 厨房改造", stage: "报价中", note: "李太太 · RM 22,800" },
          { title: "Cheras 店面装修", stage: "收尾", note: "王老板 · RM 96,000" },
        ],
      },
      render: ({ stages, cards }) => <TaskBoard stages={stages} cards={cards} />,
    },
    // 前后对比 -- a renovation company's single most persuasive artefact, and
    // one this library had no way to show. Left and right are labelled panels
    // until real photos exist, because this is a design of a system and the
    // photos arrive when the system is built.
    BeforeAfter: {
      label: "前后对比",
      fields: {
        beforeLabel: { label: "左边写什么", type: "text" },
        afterLabel: { label: "右边写什么", type: "text" },
        beforeSrc: { label: "左边图片网址（可留空）", type: "text" },
        afterSrc: { label: "右边图片网址（可留空）", type: "text" },
      },
      defaultProps: { beforeLabel: "施工前", afterLabel: "完工后", beforeSrc: "", afterSrc: "" },
      render: ({ beforeLabel, afterLabel, beforeSrc, afterSrc }) => (
        <BeforeAfter
          beforeLabel={beforeLabel}
          afterLabel={afterLabel}
          beforeSrc={beforeSrc}
          afterSrc={afterSrc}
        />
      ),
    },
    Stars: {
      label: "评分",
      fields: {
        value: { label: "几颗", type: "number", min: 0, max: 10 },
        outOf: { label: "总共几颗", type: "number", min: 1, max: 10 },
        caption: { label: "旁边的字", type: "text" },
      },
      defaultProps: { value: 4, outOf: 5, caption: "12 位客户评过" },
      render: ({ value, outOf, caption }) => (
        <div className="flex items-center [gap:var(--gap-inline)]">
          <Stars value={value} outOf={outOf} />
          {caption ? (
            <span className="[font-size:var(--text-sm)] text-muted-foreground">{caption}</span>
          ) : null}
        </div>
      ),
    },
    SiteBlock: {
      label: "官网版段",
      fields: {
        block: {
          label: "选一段",
          type: "select",
          options: SITE_BLOCK_OPTIONS,
        },
      },
      defaultProps: { block: "hero-1" },
      // No Inline wrappers and no text fields, on purpose. These sections are
      // the template half of 「模板是不可以改的 风格是可以改的」 -- what a
      // customer changes here is WHICH section, and what changes how it looks
      // is the register, which it reads through tokens like everything else.
      render: ({ block, copy }) => <SiteBlock block={block} copy={copy} />,
    },
    /*
      三段官网版段 — 服务卡 / 客人怎么说 / 中段再问一次.
      Shapes measured off tailark/blocks (MIT, Radix base); see site-sections.tsx.
    */
    SiteFeatures: {
      label: "服务卡片",
      fields: {
        noteHeading: { label: "右边那个小标题", type: "text" },
        shape: {
          label: "款式",
          type: "select",
          options: [
            { label: "三张卡片", value: "cards" },
            { label: "一整块色面", value: "panel" },
            { label: "一条一条", value: "bands" },
            { label: "左标签右大字", value: "stated" },
            { label: "两个标题三张点卡", value: "dotted" },
          ],
        },
        heading: { label: "标题", type: "text" },
        note: { label: "下面一句", type: "text" },
        items: {
          label: "每一张",
          type: "array",
          arrayFields: {
            label: { label: "名称", type: "text" },
            value: { label: "说明", type: "textarea" },
            icon: { label: "图标", type: "text" },
          },
          defaultItemProps: { label: "服务", value: "", icon: "work" },
          getItemSummary: (item) => item.label || "一张",
        },
      },
      defaultProps: { items: [] },
      render: ({ heading, note, items , shape, noteHeading}) => (
        <SiteFeatures heading={heading} note={note} items={items}           shape={shape}
        noteHeading={noteHeading} />
      ),
    },

    SiteTestimonials: {
      label: "客人怎么说",
      fields: {
        shape: {
          label: "款式",
          type: "select",
          options: [
            { label: "评分在上", value: "cards" },
            { label: "头像在上", value: "ruled" },
          ],
        },
        heading: { label: "标题", type: "text" },
        items: {
          label: "每一条",
          type: "array",
          arrayFields: {
            quote: { label: "客人讲的话", type: "textarea" },
            who: { label: "谁讲的", type: "text" },
            role: { label: "下面一行", type: "text" },
            stars: { label: "几颗星", type: "number" },
          },
          defaultItemProps: { quote: "", who: "", role: "", stars: 5 },
          getItemSummary: (item) => item.who || "一条",
        },
      },
      defaultProps: { items: [] },
      render: ({ heading, items , shape}) => <SiteTestimonials heading={heading} items={items} shape={shape} />,
    },

    SiteGallery: {
      label: "作品墙",
      fields: {
        heading: { label: "标题", type: "text" },
        note: { label: "下面一句", type: "text" },
        shape: {
          label: "款式",
          type: "select",
          options: [
            { label: "三张一样大", value: "grid" },
            { label: "一大两小", value: "bento" },
            { label: "横着滑", value: "strip" },
          ],
        },
        items: {
          label: "每一张",
          type: "array",
          arrayFields: {
            src: {
              label: "照片",
              type: "custom",
              render: ({ value, onChange }) => (
                <PhotoField value={value as string} onChange={onChange} />
              ),
            },
            caption: { label: "图说", type: "text" },
            alt: { label: "照片说明（给看不到的人）", type: "text" },
          },
          defaultItemProps: { src: "", caption: "", alt: "" },
          getItemSummary: (item) => item.caption || (item.src ? "一张照片" : "还没填"),
        },
      },
      /*
        NO `shape` IN defaultProps, AND THAT IS THE WHOLE POINT.

        Precedence in this system is: the customer's own prop > the register's
        preference > the component's default. A prop Puck has filled in from
        defaultProps is PRESENT, so it reads as the customer's own choice and
        the register never gets a say. Shipping `shape` here made all fourteen
        registers draw the same object -- the ninth time this repo has lost a
        register preference exactly this way. An ABSENT prop is the only way to
        say 「follow the register」; the component's own parameter default is
        where the fallback belongs, and it is there.
      */
      defaultProps: { items: [] },
      render: ({ heading, note, shape, items }) => (
        <SiteGallery heading={heading} note={note} shape={shape} items={items} />
      ),
    },

    SiteStory: {
      label: "一段话配一张照片",
      fields: {
        heading: { label: "标题", type: "text" },
        body: { label: "一段话", type: "textarea" },
        hint: { label: "还没填的时候讲什么", type: "textarea" },
        shape: {
          label: "款式",
          type: "select",
          options: [
            { label: "照片在右", value: "side" },
            { label: "照片在左", value: "side-reverse" },
            { label: "照片在上", value: "stack" },
          ],
        },
        photo: {
          label: "照片",
          type: "custom",
          render: ({ value, onChange }) => (
            <PhotoField value={value as string} onChange={onChange} />
          ),
        },
        photoAlt: { label: "照片说明（给看不到的人）", type: "text" },
        points: {
          label: "打勾的几点",
          type: "array",
          arrayFields: { label: { label: "写什么", type: "text" } },
          defaultItemProps: { label: "" },
          getItemSummary: (item) => item.label || "还没填",
        },
      },
      /*
        NO `shape` IN defaultProps, AND THAT IS THE WHOLE POINT.

        Precedence in this system is: the customer's own prop > the register's
        preference > the component's default. A prop Puck has filled in from
        defaultProps is PRESENT, so it reads as the customer's own choice and
        the register never gets a say. Shipping `shape` here made all fourteen
        registers draw the same object -- the ninth time this repo has lost a
        register preference exactly this way. An ABSENT prop is the only way to
        say 「follow the register」; the component's own parameter default is
        where the fallback belongs, and it is there.
      */
      defaultProps: { points: [] },
      render: ({ heading, hint, body, shape, photo, photoAlt, points }) => (
        <SiteStory
          heading={heading}
          hint={hint}
          body={body}
          shape={shape}
          photo={photo}
          photoAlt={photoAlt}
          points={points}
        />
      ),
    },

    SiteSteps: {
      label: "怎么做",
      fields: {
        shape: {
          label: "款式",
          type: "select",
          options: [
            { label: "细线一行一步", value: "ruled" },
            { label: "大编号", value: "numbered" },
            { label: "横排四格", value: "across" },
          ],
        },
        heading: { label: "标题", type: "text" },
        note: { label: "小字", type: "textarea" },
        steps: {
          label: "步骤",
          type: "array",
          arrayFields: {
            label: { label: "一步", type: "text" },
            value: { label: "补充", type: "text" },
          },
          defaultItemProps: { label: "", value: "" },
          getItemSummary: (item) => item.label || "还没填",
        },
      },
      defaultProps: { steps: [] },
      render: ({ heading, note, steps, shape }) => (
        <SiteSteps heading={heading} note={note} steps={steps} shape={shape} />
      ),
    },

    SiteWoven: {
      label: "四点两栏配照片",
      fields: {
        heading: { label: "标题", type: "text" },
        note: { label: "小字", type: "textarea" },
        hint: { label: "还没填的时候讲什么", type: "textarea" },
        points: {
          label: "四点",
          type: "array",
          arrayFields: {
            label: { label: "一句话", type: "text" },
            value: { label: "补充", type: "textarea" },
          },
          defaultItemProps: { label: "", value: "" },
          getItemSummary: (item) => item.label || "还没填",
        },
      },
      defaultProps: { points: [] },
      render: ({ heading, note, points, photos, hint }) => (
        <SiteWoven heading={heading} note={note} points={points} photos={photos} hint={hint} />
      ),
    },

    SiteBand: {
      label: "一条满边照片",
      fields: {
        photo: {
          label: "照片",
          type: "custom",
          render: ({ value, onChange }) => <PhotoField value={value as string} onChange={onChange} />,
        },
        photoAlt: { label: "照片说明（给看不到的人）", type: "text" },
        line: { label: "压在上面的一句话（可以不填）", type: "text" },
        hint: { label: "还没填的时候讲什么", type: "textarea" },
        height: {
          label: "高度",
          type: "select",
          options: [
            { label: "一整段", value: "tall" },
            { label: "一条", value: "short" },
          ],
        },
      },
      /* No `height` in defaultProps -- an absent prop is the only way to say
         「follow the register」. See SiteStory for the long version. */
      defaultProps: {},
      render: ({ photo, photoAlt, line, hint, height }) => (
        <SiteBand photo={photo} photoAlt={photoAlt} line={line} hint={hint} height={height} />
      ),
    },

    SiteStatement: {
      label: "一句话占一屏",
      fields: {
        body: { label: "那一句话", type: "textarea" },
        attribution: { label: "署名（可以不填）", type: "text" },
        shape: {
          label: "款式",
          type: "select",
          options: [
            { label: "居中", value: "centre" },
            { label: "一条线在上", value: "rule" },
            { label: "引号", value: "quote" },
          ],
        },
      },
      /* NO `shape`, NO `body`. `shape` is absent for the reason written out at
         length under SiteStory -- an absent prop is the only way to say
         「follow the register」. `body` is absent because the TEMPLATE fills it
         with the owner's own pitch, and a defaultProps sentence would be a
         sentence about somebody else's business sitting on his page. */
      defaultProps: {},
      render: ({ body, attribution, shape }) => (
        <SiteStatement body={body} attribution={attribution} shape={shape} />
      ),
    },

    SiteTeam: {
      label: "师傅团队",
      fields: {
        heading: { label: "标题", type: "text" },
        note: { label: "下面一句", type: "text" },
        hint: { label: "还没填的时候讲什么", type: "textarea" },
        shape: {
          label: "款式",
          type: "select",
          options: [
            { label: "卡片", value: "cards" },
            { label: "不用卡片", value: "plain" },
            { label: "一排头像", value: "row" },
          ],
        },
        members: {
          label: "每一个人",
          type: "array",
          arrayFields: {
            name: { label: "名字", type: "text" },
            role: { label: "做什么", type: "text" },
            years: { label: "做了多久", type: "text" },
            photo: {
              label: "照片",
              type: "custom",
              render: ({ value, onChange }) => (
                <PhotoField value={value as string} onChange={onChange} />
              ),
            },
          },
          defaultItemProps: { name: "", role: "", years: "", photo: "" },
          getItemSummary: (item) => item.name || "还没填",
        },
      },
      /* No `shape`: an absent prop is the only way to say 「follow the
         register」. See design-doc.test.ts. */
      defaultProps: { members: [] },
      render: ({ heading, note, hint, shape, members }) => (
        <SiteTeam heading={heading} note={note} hint={hint} shape={shape} members={members} />
      ),
    },

    SiteCreds: {
      label: "别人给的证明",
      fields: {
        heading: { label: "标题", type: "text" },
        hint: { label: "还没填的时候讲什么", type: "textarea" },
        shape: {
          label: "款式",
          type: "select",
          options: [
            { label: "一行字", value: "strip" },
            { label: "打勾卡", value: "badges" },
            { label: "评分", value: "rating" },
          ],
        },
        rating: {
          label: "客人打的分",
          type: "object",
          objectFields: {
            score: { label: "几分", type: "text" },
            count: { label: "几个人评", type: "text" },
            source: { label: "哪里的评价", type: "text" },
          },
        },
        items: {
          label: "每一项",
          type: "array",
          arrayFields: {
            label: { label: "写什么", type: "text" },
            note: { label: "下面一行", type: "text" },
          },
          defaultItemProps: { label: "", note: "" },
          getItemSummary: (item) => item.label || item.note || "还没填",
        },
      },
      /*
        NO `shape` IN defaultProps, AND THAT IS THE WHOLE POINT.

        Precedence in this system is: the customer's own prop > the register's
        preference > the component's default. A prop Puck has filled in from
        defaultProps is PRESENT, so it reads as the customer's own choice and
        the register never gets a say. Shipping `shape` here made all fourteen
        registers draw the same object -- the ninth time this repo has lost a
        register preference exactly this way. An ABSENT prop is the only way to
        say 「follow the register」; the component's own parameter default is
        where the fallback belongs, and it is there.
      */
      defaultProps: { items: [] },
      render: ({ heading, hint, shape, rating, items }) => (
        <SiteCreds heading={heading} hint={hint} shape={shape} rating={rating} items={items} />
      ),
    },

    SiteCta: {
      label: "中段再问一次",
      fields: {
        shape: {
          label: "款式",
          type: "select",
          options: [
            { label: "整条色带", value: "band" },
            { label: "半块颜色", value: "panel" },
            { label: "一条线", value: "rule" },
          ],
        },
        heading: { label: "大标题", type: "text" },
        note: { label: "下面一句", type: "text" },
        primaryLabel: { label: "主要按钮", type: "text" },
        primaryHref: { label: "主要按钮去哪", type: "text" },
        secondaryLabel: { label: "第二颗按钮", type: "text" },
        secondaryHref: { label: "第二颗按钮去哪", type: "text" },
        /* 半块颜色 puts a photograph in its other half -- Wix's Home Remodeling
           page sets its mid-page panel beside a picture of two clients. Left
           empty the half falls back to a tint of the ground. */
        photo: {
          label: "旁边那张照片",
          type: "custom",
          render: ({ value, onChange }) => <PhotoField value={value as string} onChange={onChange} />,
        },
        photoAlt: { label: "照片说明（给看不到的人）", type: "text" },
      },
      defaultProps: { heading: "要不要先问个价？" },
      render: ({ heading, note, primaryLabel, primaryHref, secondaryLabel, secondaryHref, shape, photo, photoAlt }) => (
        <SiteCta
          heading={heading}
          note={note}
          primaryLabel={primaryLabel}
          primaryHref={primaryHref}
          secondaryLabel={secondaryLabel}
          secondaryHref={secondaryHref}
          shape={shape}
          photo={photo}
          photoAlt={photoAlt}
        />
      ),
    },

    /*
      顶栏跟页脚 — the two blocks a website has and a dashboard does not.
      See site-chrome.tsx.
    */
    SiteBar: {
      label: "官网顶栏",
      fields: {
        brand: { label: "公司名", type: "text" },
        links: {
          label: "链接",
          type: "array",
          arrayFields: {
            label: { label: "字", type: "text" },
            href: { label: "去哪", type: "text" },
          },
          defaultItemProps: { label: "区块", href: "#" },
          getItemSummary: (item) => item.label || "链接",
        },
        actionLabel: { label: "按钮上的字", type: "text" },
        actionHref: { label: "按钮去哪", type: "text" },
      },
      defaultProps: { brand: "我的公司" },
      render: ({ brand, links, actionLabel, actionHref }) => (
        <SiteBar brand={brand} links={links} actionLabel={actionLabel} actionHref={actionHref} />
      ),
    },

    SiteFoot: {
      label: "官网页脚",
      fields: {
        brand: { label: "公司名", type: "text" },
        tagline: { label: "旁边一句", type: "text" },
        rows: {
          label: "联络方式",
          type: "array",
          arrayFields: {
            label: { label: "名称", type: "text" },
            value: { label: "内容", type: "text" },
          },
          defaultItemProps: { label: "名称", value: "" },
          getItemSummary: (item) => item.label || "一项",
        },
        note: { label: "最底下那一句", type: "text" },
        links: {
          label: "底下的导航",
          type: "array",
          arrayFields: {
            label: { label: "名称", type: "text" },
            href: { label: "去哪", type: "text" },
          },
          defaultItemProps: { label: "", href: "#" },
          getItemSummary: (item) => item.label || "一项",
        },
        askLabel: { label: "按钮上的字", type: "text" },
        askHref: { label: "按钮去哪", type: "text" },
        small: {
          label: "社交 / 条款",
          type: "array",
          arrayFields: {
            label: { label: "名称", type: "text" },
            href: { label: "去哪", type: "text" },
          },
          defaultItemProps: { label: "", href: "" },
          getItemSummary: (item) => item.label || "一项",
        },
        copyright: { label: "版权那一行", type: "text" },
      },
      defaultProps: { brand: "我的公司" },
      render: ({ brand, tagline, rows, note, links, askLabel, askHref, small, copyright }) => (
        <SiteFoot
          small={small}
          copyright={copyright}
          brand={brand}
          tagline={tagline}
          rows={rows}
          note={note}
          links={links}
          askLabel={askLabel}
          askHref={askHref}
        />
      ),
    },

    /*
      跟着页面走的 WhatsApp 按钮 — see floating-contact.tsx for why every local
      business site in this market has one and ours did not.
    */
    FloatingContact: {
      label: "浮动 WhatsApp",
      fields: {
        number: { label: "WhatsApp 号码", type: "text" },
        label: { label: "按钮上的字", type: "text" },
        message: { label: "预先填好的第一句", type: "textarea" },
      },
      defaultProps: { label: "WhatsApp" },
      // The component already refuses an empty number; returning its own
      // <></> keeps Puck's render type happy without a second guard that could
      // drift from the first.
      render: ({ number, label, message }) => (
        <FloatingContact number={number ?? ""} label={label} message={message} />
      ),
    },

    SiteHero: {
      label: "官网大标题",
      // The one block on the whole page a stranger reads first, so its own
      // fields are ordered the way it is written: who you are, what you claim,
      // what to press. `proof` last because it is the part a business fills in
      // once and never touches again.
      fields: {
        eyebrow: { label: "地区 · 行业", type: "text" },
        headline: { label: "大标题", type: "text" },
        sub: { label: "下面那一句", type: "textarea" },
        /*
          THE FIRST SCREEN'S PHOTOGRAPH, THIRD FIELD DOWN.

          Measured 2026-08-27 across 19 trading Malaysian SME sites: 14 give
          the opening to a photograph and the median one covers 59% of it. It
          sits this high in the panel because that is how much it matters, and
          it is the same picker PhotoFrame uses -- the owner's own phone first,
          the library second. Empty is not a hole: the drawn figure keeps the
          second column until a real photo arrives.
        */
        photo: {
          label: "第一屏的照片",
          type: "custom",
          render: ({ value, onChange }) => (
            <PhotoField value={value as string} onChange={onChange} />
          ),
        },
        photoAlt: { label: "照片说明（给看不到的人）", type: "text" },
        ground: {
          label: "开场的地",
          type: "select",
          options: [
            { label: "跟页面一样", value: "page" },
            { label: "深色", value: "ink" },
          ],
        },
        /* Directly under the headline, not at the bottom with the rest of the
           contact details, because on both Malaysian sites this was measured
           against it IS the headline's other half. An owner who opens this
           panel should hit the number before they hit anything optional. */
        priceRows: {
          label: "价钱（第一屏）",
          type: "array",
          arrayFields: {
            label: { label: "项目", type: "text" },
            value: { label: "价钱", type: "text" },
          },
          defaultItemProps: { label: "服务项目", value: "" },
          getItemSummary: (item) => `${item.label}${item.value ? ` · ${item.value}` : ""}`,
        },
        phoneLabel: { label: "号码前面那个字", type: "text" },
        phoneNumber: { label: "电话 / WhatsApp 号码", type: "text" },
        strip: { label: "最上面那条（营业时间）", type: "text" },
        primaryLabel: { label: "主要按钮", type: "text" },
        primaryHref: { label: "主要按钮去哪", type: "text" },
        secondaryLabel: { label: "第二颗按钮", type: "text" },
        secondaryHref: { label: "第二颗按钮去哪", type: "text" },
        proof: {
          label: "三个数字",
          type: "array",
          arrayFields: {
            value: { label: "数字", type: "text" },
            label: { label: "说明", type: "text" },
          },
          defaultItemProps: { value: "0", label: "说明" },
          getItemSummary: (item) => `${item.value} ${item.label}`,
        },
      },
      defaultProps: {
        headline: "我们做什么",
        primaryLabel: "WhatsApp 问价",
        primaryHref: "#",
      },
      render: ({ id, eyebrow, headline, sub, primaryLabel, primaryHref, secondaryLabel, secondaryHref, proof, layout, figure, figureData, phoneLabel, phoneNumber, strip, priceRows, photo, photoAlt, ground, systemPreview , brand}) => (
        <SiteHero
          layout={layout ?? "left"}
          ground={ground}
          figure={figure}
          figureData={figureData}
          photo={photo}
          photoAlt={photoAlt}
          systemPreview={systemPreview}
          phone={phoneNumber ? { label: phoneLabel, number: phoneNumber } : undefined}
          priceRows={priceRows}
          strip={strip || undefined}
          eyebrow={
            eyebrow ? (
              <Inline id={id} field="eyebrow">
                {eyebrow}
              </Inline>
            ) : undefined
          }
          headline={
            <Inline id={id} field="headline">
              {headline}
            </Inline>
          }
          sub={
            sub ? (
              <Inline id={id} field="sub">
                {sub}
              </Inline>
            ) : undefined
          }
          primaryLabel={primaryLabel}
          primaryHref={primaryHref}
          secondaryLabel={secondaryLabel}
          secondaryHref={secondaryHref}
          proof={proof}
                  brand={brand}
        />
      ),
    },
    EnquiryForm: {
      label: "询价表格",
      fields: {
        heading: { label: "标题", type: "text" },
        blurb: { label: "说明", type: "textarea" },
        fields: {
          label: "要问什么",
          type: "array",
          arrayFields: {
            label: { label: "栏位名", type: "text" },
            placeholder: { label: "例子", type: "text" },
            kind: {
              label: "哪一种",
              type: "select",
              options: [
                { label: "一行字", value: "text" },
                { label: "电话", value: "phone" },
                { label: "一段字", value: "long" },
              ],
            },
          },
          defaultItemProps: { label: "栏位", placeholder: "", kind: "text" },
          getItemSummary: (item) => item.label || "栏位",
        },
        submitLabel: { label: "按钮上写什么", type: "text" },
        // THE ARROW. Deliberately in the open rather than behind 进阶: it is
        // what this block is FOR. 「官网表格 → 系统出单」 is a sentence the
        // founder could not explain to himself; this field is where it stops
        // being a sentence.
        landsIn: { label: "填完变成哪一页的单", type: "text" },
        note: { label: "按钮旁边那一句", type: "text" },
      },
      defaultProps: {
        heading: "留个电话，我们回你",
        submitLabel: "送出",
        landsIn: "报价单",
      },
      render: ({
        id,
        heading,
        blurb,
        fields,
        submitLabel,
        landsIn,
        landsInBadge,
        landsInBefore,
        landsInAfter,
        note,
        look,
      }) => (
        <EnquiryForm
          look={look ?? "card"}
          heading={
            <Inline id={id} field="heading">
              {heading}
            </Inline>
          }
          blurb={
            blurb ? (
              <Inline id={id} field="blurb">
                {blurb}
              </Inline>
            ) : undefined
          }
          fields={fields}
          submitLabel={submitLabel}
          landsIn={landsIn}
          landsInBadge={landsInBadge}
          landsInBefore={landsInBefore}
          landsInAfter={landsInAfter}
          note={note}
        />
      ),
    },
    PageHeader: {
      label: "页面标题",
      fields: {
        title: { label: "标题", type: "text" },
        subtitle: { label: "副标题", type: "text" },
        meta: { label: "标题旁边的小字", type: "text" },
        actionLabel: { label: "按钮字（留空就没有按钮）", type: "text" },
        actionHref: { label: "按钮去哪", type: "text" },
      },
      defaultProps: { title: "标题" },
      render: ({ id, title, subtitle, layout, meta, actionLabel, actionHref }) => (
        <PageHeader
          layout={layout}
          meta={meta}
          action={actionLabel ? { href: actionHref || "#", label: actionLabel } : undefined}
          title={
            <Inline id={id} field="title">
              {title}
            </Inline>
          }
          subtitle={
            subtitle ? (
              <Inline id={id} field="subtitle">
                {subtitle}
              </Inline>
            ) : undefined
          }
        />
      ),
    },
    EmptyState: {
      label: "空状态提示",
      fields: {
        variant: {
          label: "样式",
          type: "select",
          options: [
            { label: "Empty", value: "empty" },
            { label: "Filtered", value: "filtered" },
            { label: "Cleared", value: "cleared" },
          ],
        },
        title: { label: "标题", type: "text" },
        description: { label: "说明文字", type: "textarea" },
      },
      defaultProps: { variant: "empty", title: "还没有内容" },
      render: ({ variant, title, description }) => (
        <EmptyState variant={variant} title={title} description={description} />
      ),
    },
    StatusDot: {
      label: "状态标记",
      fields: {
        tone: { label: "颜色语义", type: "select", options: STATUS_TONE_OPTIONS },
        label: { label: "文字", type: "text" },
      },
      defaultProps: { tone: "neutral", label: "状态" },
      render: ({ tone, label }) => <StatusDot tone={tone} label={label} />,
    },
    HeroCard: {
      label: "重点数字卡",
      // The first registration exposed only label/value/href, so every
      // generated dashboard opened on ONE lone figure floating in a wide empty
      // card -- the component's supporting stats and trend line were built and
      // then never reachable. That is what made the first screen read as a
      // wireframe (docs/portal-editor-known-issues.md).
      //
      // Note what this deliberately does NOT do: B12's generated portals open
      // on a ROW of four equal stat tiles, and copying that was the obvious
      // move. hero-card.tsx argues against it in its own docstring, citing
      // NN/g -- four tiles of identical size say four things matter equally
      // and leave the reader to work out where to look. One headline figure
      // with three supporting stats under it says the same amount and ranks
      // it. Keeping the component's argument rather than the reference's
      // layout.
      fields: {
        label: { label: "文字", type: "text" },
        value: { label: "数值", type: "text" },
        href: { label: "链接", type: "text" },
        chgSuffix: { label: "对比说明", type: "text" },
        stats: {
          label: "旁边的小数字",
          type: "array",
          arrayFields: {
            label: { label: "名称", type: "text" },
            value: { label: "数值", type: "text" },
            href: { label: "链接", type: "text" },
            sub: { label: "补充说明", type: "text" },
            tone: {
              label: "语气",
              type: "select",
              options: [
                { label: "普通", value: "normal" },
                { label: "留意", value: "caution" },
                { label: "警示", value: "warn" },
              ],
            },
          },
          defaultItemProps: { label: "小数字", value: "0", href: "#", tone: "normal" },
          getItemSummary: (item) => item.label || "小数字",
        },
        spark: {
          label: "走势（由旧到新）",
          type: "array",
          arrayFields: { n: { label: "数值", type: "number" } },
          defaultItemProps: { n: 0 },
          getItemSummary: (item) => String(item.n ?? 0),
        },
        sparkLabel: { label: "走势说明", type: "text" },
      },
      defaultProps: { label: "本月营收", value: "RM 0", href: "#" },
      render: ({ id, label, value, href, chg, chgSuffix, stats, spark, sparkLabel, layout, flat }) => (
        <HeroCard
          layout={layout}
          flat={flat}
          label={
            <Inline id={id} field="label">
              {label}
            </Inline>
          }
          value={value}
          href={href}
          chg={chg}
          chgSuffix={chgSuffix}
          stats={stats}
          // HeroCard takes a plain number[]; Puck's array field can only hold
          // objects, hence the unwrap. An empty array is passed as undefined
          // so the component's own "no series yet, draw nothing" branch runs
          // instead of it rendering a flat rule.
          spark={spark?.length ? spark.map((s) => s.n) : undefined}
          sparkLabel={sparkLabel}
        />
      ),
    },
    Avatar: {
      label: "头像",
      fields: {
        name: { label: "字段名", type: "text" },
      },
      defaultProps: { name: "客户" },
      render: ({ name }) => <Avatar name={name} />,
    },
    RecordTable: {
      label: "记录表格",
      fields: {
        gridId: { label: "表格编号", type: "text" },
        caption: { label: "表格名称", type: "text" },
        filters: {
          label: "上面的筛选（留空就没有）",
          type: "array",
          arrayFields: { label: { label: "一个", type: "text" } },
          defaultItemProps: { label: "一个" },
          getItemSummary: (item) => item.label || "一个",
        },
        // The one field that makes this component a system rather than a
        // picture of one: columns are added, renamed, retyped, reordered and
        // removed here, and every row follows automatically.
        table: {
          label: "栏位与内容",
          type: "custom",
          render: ({ value, onChange }) => (
            <TableFieldEditor value={value as TableModel} onChange={onChange} />
          ),
        },
      },
      defaultProps: {
        // NO `look` HERE, and that is the point. An absent variant prop means
        // "follow the register" (design-system/editor/style-scope.tsx); writing
        // a default into every new block would make 版式 unable to ever choose,
        // because the customer's prop always wins. The 换个款式 picker resolves
        // the lit tile through the register instead -- see variant-picker.tsx.
        gridId: "records",
        caption: "记录列表",
        table: {
          columns: [
            { key: "primary", label: "名称", kind: "text" },
            { key: "secondary", label: "说明", kind: "detail" },
            { key: "amount", label: "金额", kind: "amount" },
            { key: "status", label: "状态", kind: "status" },
          ],
          rows: [
            {
              cells: {
                primary: "示例记录 #1",
                secondary: "示例说明",
                amount: "RM 0.00",
                status: "待处理",
              },
              tones: { status: "neutral" as StatusTone },
            },
          ],
        },
      },
      // STILL NOT inline-editable, and now for a sharper reason than before.
      // Until 2026-08-25 `caption` was only the table's accessible name, which
      // was the whole argument: a ReactNode in an aria-label renders
      // "[object Object]" to a screen reader. It is now ALSO the visible
      // heading above the table -- so it is read twice, by two different
      // readers, from one string. That makes it more important that it stays a
      // string, not less. It is edited in the fields panel.
      render: ({ gridId, caption, table, look, row, filters }) => (
        <RecordTable gridId={gridId} caption={caption} table={table} look={look} row={row} filters={filters?.map((f) => f.label)} />
      ),
    },
    WorkflowStrip: {
      label: "业务流程",
      fields: {
        title: { label: "标题", type: "text" },
        stages: {
          label: "流程步骤",
          type: "array",
          arrayFields: {
            label: { type: "text" },
            count: { type: "text" },
            tone: {
              type: "select",
              options: [
                { label: "普通", value: "normal" },
                { label: "重点关注", value: "attention" },
              ],
            },
          },
          defaultItemProps: { label: "步骤", tone: "normal" as const },
          getItemSummary: (item) => item.label || "步骤",
        },
      },
      defaultProps: {
        title: "业务流程",
        stages: [
          { label: "客户", tone: "normal" as const },
          { label: "报价", tone: "normal" as const },
          { label: "确认", tone: "normal" as const },
          { label: "收款", tone: "normal" as const },
        ],
      },
      render: ({ id, title, stages, layout }) => (
        <WorkflowStrip
          title={
            title ? (
              <Inline id={id} field="title">
                {title}
              </Inline>
            ) : undefined
          }
          stages={stages}
          layout={layout}
        />
      ),
    },
    DatePicker: {
      label: "日期选择",
      fields: {
        name: { label: "字段名", type: "text" },
        placeholder: { label: "提示文字", type: "text" },
        allowClear: {
          label: "可以清空",
          type: "radio",
          options: [
            { label: "是", value: true },
            { label: "否", value: false },
          ],
        },
        required: {
          label: "必填",
          type: "radio",
          options: [
            { label: "是", value: true },
            { label: "否", value: false },
          ],
        },
      },
      defaultProps: { name: "date", placeholder: "选择日期", allowClear: true, required: false },
      render: ({ name, placeholder, allowClear, required }) => (
        <DatePicker name={name} placeholder={placeholder} allowClear={allowClear} required={required} />
      ),
    },
    MonthPicker: {
      label: "月份选择",
      fields: {
        name: { label: "字段名", type: "text" },
        placeholder: { label: "提示文字", type: "text" },
        allowClear: {
          label: "可以清空",
          type: "radio",
          options: [
            { label: "是", value: true },
            { label: "否", value: false },
          ],
        },
      },
      defaultProps: { name: "month", placeholder: "选择月份", allowClear: true },
      render: ({ name, placeholder, allowClear }) => (
        <MonthPicker name={name} placeholder={placeholder} allowClear={allowClear} />
      ),
    },
    FileUploadField: {
      label: "文件上传",
      fields: {
        label: { label: "文字", type: "text" },
        hint: { label: "提示说明", type: "text" },
        name: { label: "字段名", type: "text" },
        accept: { label: "允许的文件类型", type: "text" },
      },
      defaultProps: { label: "上传附件", hint: "PDF 或图片，最大 10MB", name: "file" },
      render: ({ label, hint, name, accept }) => (
        <FileUploadField label={label} hint={hint} name={name} accept={accept} />
      ),
    },
    FilterChips: {
      label: "已选筛选",
      fields: {
        chips: {
          label: "筛选条件",
          type: "array",
          arrayFields: {
            label: { type: "text" },
            value: { type: "text" },
            removeHref: { type: "text" },
          },
          defaultItemProps: { label: "筛选条件", value: "", removeHref: "#" },
          getItemSummary: (item) => item.label || "筛选条件",
        },
        clearAllHref: { label: "清空全部链接", type: "text" },
        filteredByLabel: { label: "前面那句", type: "text" },
        clearAllLabel: { label: "清空按钮的字", type: "text" },
      },
      /* No defaults for the two labels, deliberately: the right word depends on
         `system_language`, which a config object cannot see. The page builder
         writes them (industry-template.ts) and layout-upgrade backfills them,
         both of which know the language. */
      defaultProps: { chips: [], clearAllHref: "#" },
      /* PASS THEM. This render read only `chips` and `clearAllHref`, so the two
         labels were written into every generated layout by a builder that had
         gone to the trouble of asking for the system language -- and then
         dropped here, one line before the component that wanted them. The
         component fell back to its own Chinese defaults, which is why 「筛选条件」
         was still on four pages of an English system on 2026-08-26. Seventh
         time in this repo that a capability was built and the wire never
         connected. */
      render: ({ chips, clearAllHref, filteredByLabel, clearAllLabel }) => (
        <FilterChips
          chips={chips}
          clearAllHref={clearAllHref}
          filteredByLabel={filteredByLabel || undefined}
          clearAllLabel={clearAllLabel || undefined}
        />
      ),
    },
    Combobox: {
      label: "搜索下拉",
      fields: {
        name: { label: "字段名", type: "text" },
        value: { label: "数值", type: "text" },
        placeholder: { label: "提示文字", type: "text" },
        options: {
          label: "选项",
          type: "array",
          arrayFields: {
            value: { type: "text" },
            label: { type: "text" },
          },
          defaultItemProps: { value: "", label: "选项" },
          getItemSummary: (item) => item.label || "选项",
        },
      },
      defaultProps: { value: "", placeholder: "搜索…", options: [] },
      render: ({ name, value, options, placeholder }) => (
        <Combobox name={name} value={value} onChange={() => {}} options={options} placeholder={placeholder} />
      ),
    },
    TextAutocomplete: {
      label: "输入建议",
      fields: {
        name: { label: "字段名", type: "text" },
        defaultValue: { label: "默认值", type: "text" },
        placeholder: { label: "提示文字", type: "text" },
        suggestions: {
          label: "输入建议",
          type: "array",
          arrayFields: { value: { type: "text" } },
          defaultItemProps: { value: "" },
          getItemSummary: (item) => item.value || "建议",
        },
      },
      defaultProps: { name: "field", suggestions: [] },
      render: ({ name, defaultValue, suggestions, placeholder }) => (
        <TextAutocomplete
          name={name}
          defaultValue={defaultValue}
          suggestions={suggestions.map((s: { value: string }) => s.value)}
          placeholder={placeholder}
        />
      ),
    },
    Listbox: {
      label: "下拉选择",
      fields: {
        name: { label: "字段名", type: "text" },
        defaultValue: { label: "默认值", type: "text" },
        placeholder: { label: "提示文字", type: "text" },
        options: {
          label: "选项",
          type: "array",
          arrayFields: {
            value: { type: "text" },
            label: { type: "text" },
          },
          defaultItemProps: { value: "", label: "选项" },
          getItemSummary: (item) => item.label || "选项",
        },
      },
      defaultProps: { placeholder: "请选择…", options: [] },
      render: ({ name, defaultValue, options, placeholder }) => (
        <Listbox name={name} defaultValue={defaultValue} options={options} placeholder={placeholder} />
      ),
    },
    Alert: {
      label: "提醒条",
      fields: {
        title: { label: "标题", type: "text" },
        description: { label: "说明", type: "textarea" },
        variant: {
          label: "语气",
          type: "radio",
          options: [
            { label: "提示", value: "default" },
            { label: "警告", value: "destructive" },
          ],
        },
      },
      defaultProps: { variant: "default", title: "提醒", description: "写你想提醒同事的事。" },
      render: ({ variant, title, description }) => (
        <Alert variant={variant}>
          <AlertTitle>{title}</AlertTitle>
          {description ? <AlertDescription>{description}</AlertDescription> : null}
        </Alert>
      ),
    },
    // The first component in this library taken from a public registry rather
    // than written here: the chart primitive underneath is shadcn's own
    // components/ui/chart.tsx, pulled unmodified with `npx shadcn add chart`.
    // The wrapper above it exists to turn its developer API (a ChartConfig
    // object, a Recharts child tree) into two questions a contractor can answer
    // -- what shape, and what are the numbers.
    TrendChart: {
      label: "趋势图",
      fields: {
        frame: {
          label: "盒子",
          type: "radio",
          options: [
            { label: "有卡片", value: "card" },
            { label: "只有框", value: "outline" },
            { label: "没有盒子", value: "bare" },
          ],
        },
        title: { label: "标题", type: "text" },
        caption: { label: "说明", type: "text" },
        kind: {
          label: "图表样式",
          type: "radio",
          options: [
            { label: "柱状", value: "bar" },
            { label: "折线", value: "line" },
            { label: "面积", value: "area" },
          ],
        },
        unit: { label: "单位", type: "text" },
        points: {
          label: "数据",
          type: "array",
          arrayFields: {
            label: { label: "时间", type: "text" },
            value: { label: "数值", type: "number" },
          },
          defaultItemProps: { label: "月份", value: 0 },
          getItemSummary: (item) => `${item.label || "月份"} · ${item.value ?? 0}`,
        },
      },
      defaultProps: {
        title: "每月收款",
        caption: "已经收到的工程款，按月看。",
        /* `kind` deliberately absent -- see Divider. TrendChart's own
           signature falls back to a bar. */
        unit: "RM",
        points: [
          { label: "3月", value: 42000 },
          { label: "4月", value: 51000 },
          { label: "5月", value: 47000 },
          { label: "6月", value: 63000 },
          { label: "7月", value: 58000 },
          { label: "8月", value: 71300 },
        ],
      },
      render: ({ title, caption, frame, kind, unit, points }) => (
        <TrendChart title={title} caption={caption} frame={frame} kind={kind} unit={unit} points={points} />
      ),
    },
    Progress: {
      label: "进度条",
      fields: {
        label: { label: "标题", type: "text" },
        value: { label: "百分比", type: "number", min: 0, max: 100 },
      },
      defaultProps: { label: "工程进度", value: 60 },
      render: ({ label, value }) => (
        <div className="flex flex-col [gap:var(--gap-inline)]">
          {label ? (
            <span className="flex items-baseline justify-between [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
              {label}
              <span className="tabular-nums [color:var(--color-paper-dim)] [font-family:var(--font-numeric)]">
                {value}%
              </span>
            </span>
          ) : null}
          <Progress value={value} />
        </div>
      ),
    },
    // ── 从 arhamkhnz/next-shadcn-admin-dashboard (MIT) 的元件组出来的六块 ──
    //
    // Composed rather than registered raw: Item / Attachment / Marker are
    // COMPOUND primitives, and a customer dragging in an `ItemMedia` has been
    // handed a part rather than a thing. See shelf-blocks.tsx.
    //
    // NO APPEARANCE DEFAULTS in any defaultProps below. An absent prop is the
    // only signal that means "follow the register" -- ten of them were set here
    // once and overrode every register's preference forever.
    ShelfList: {
      label: "项目清单",
      fields: {
        heading: { label: "标题", type: "text" },
        items: {
          label: "每一项",
          type: "array",
          arrayFields: {
            title: { label: "名称", type: "text" },
            description: { label: "说明", type: "text" },
            icon: { label: "图案", type: "select", options: [
                { label: "人", value: "person" },
                { label: "电话", value: "phone" },
                { label: "地点", value: "place" },
                { label: "时间", value: "time" },
                { label: "钱", value: "money" },
                { label: "文件", value: "file" },
                { label: "标签", value: "tag" },
                { label: "公司", value: "company" },
                { label: "工程", value: "work" },
                { label: "日期", value: "date" },
              ] },
            action: { label: "按钮字（留空就没有）", type: "text" },
          },
          defaultItemProps: { title: "一项", description: "", icon: "file", action: "" },
          getItemSummary: (item) => item.title || "一项",
        },
      },
      defaultProps: {
        heading: "今天要跟的",
        items: [
          { title: "陈先生 · 三房翻新", description: "报价已发,等回复", icon: "work", action: "跟进" },
          { title: "李太太 · 厨房", description: "订金未收", icon: "money", action: "催款" },
          { title: "黄先生 · 店面", description: "还没上门量尺", icon: "place", action: "排期" },
        ],
      },
      render: ({ heading, items, size, separated }) => (
        <ShelfList heading={heading} items={items} size={size} separated={separated} />
      ),
    },

    AttachmentList: {
      label: "附件清单",
      fields: {
        heading: { label: "标题", type: "text" },
        files: {
          label: "每个档案",
          type: "array",
          arrayFields: {
            name: { label: "档名", type: "text" },
            meta: { label: "说明（大小、日期）", type: "text" },
          },
          defaultItemProps: { name: "档案.pdf", meta: "" },
          getItemSummary: (item) => item.name || "档案",
        },
      },
      defaultProps: {
        heading: "这一单的文件",
        files: [
          { name: "报价单 QT-2026-0142.pdf", meta: "2.1 MB · 8月18日" },
          { name: "工地照片.zip", meta: "14 张 · 8月20日" },
          { name: "订金收据.pdf", meta: "480 KB · 8月21日" },
        ],
      },
      render: ({ heading, files, orientation }) => (
        <AttachmentList heading={heading} files={files} orientation={orientation} />
      ),
    },

    // 排行 -- see design-system/components/rank-list.tsx for why this is a
    // component and not a MarkList variant. Short version: a mark has one end,
    // and every leaderboard worth copying has two.
    // 占比 -- a different QUESTION from TrendChart, so a different object.
    // See design-system/components/share-chart.tsx.
    // 一大两小 -- see design-system/components/bento.tsx for why it is not a
    // Columns with a Columns inside it.
    // 层叠 -- see design-system/components/overlap.tsx for why it is a band and
    // an overlap rather than cards scattered over each other.
    /*
      整段成品 — see design-system/components/assembled.tsx.

      Five entries that add no new capability and exist because of what the
      gallery looked like beside 21st.dev's: their "Card" is a whole form, ours
      was Field, ActionButton and Panel as three separate tiles. These are the
      assemblies, so a tile is full and an owner adds a finished thing.
    */
    IntakeForm: {
      label: "登记表",
      fields: {
        heading: { label: "标题", type: "text" },
        note: { label: "下面一句", type: "text" },
        fields: {
          label: "每一栏",
          type: "array",
          arrayFields: {
            label: { label: "栏位名", type: "text" },
            placeholder: { label: "提示文字", type: "text" },
            wide: {
              label: "占整行",
              type: "select",
              options: [
                { label: "不要", value: "no" },
                { label: "要", value: "yes" },
              ],
            },
          },
          defaultItemProps: { label: "栏位", placeholder: "", wide: "no" },
          getItemSummary: (item) => item.label || "一栏",
        },
        submitLabel: { label: "主要按钮", type: "text" },
        cancelLabel: { label: "次要按钮", type: "text" },
      },
      defaultProps: {
        heading: "新客户登记",
        note: "填一次,以后开单、发报价都用得上。",
        fields: [
          { label: "客户名字", placeholder: "陈先生", wide: "no" },
          { label: "电话 / WhatsApp", placeholder: "012-345 6789", wide: "no" },
          { label: "地址", placeholder: "Taman Desa, KL", wide: "yes" },
          { label: "怎么找到我们", placeholder: "介绍来的", wide: "no" },
          { label: "要做什么", placeholder: "三房翻新", wide: "no" },
        ],
        submitLabel: "加进来",
        cancelLabel: "取消",
      },
      render: ({ heading, note, fields, submitLabel, cancelLabel }) => (
        <IntakeForm
          heading={heading}
          note={note}
          fields={fields}
          submitLabel={submitLabel}
          cancelLabel={cancelLabel}
        />
      ),
    },

    PersonCard: {
      label: "客户资料卡",
      fields: {
        name: { label: "名字", type: "text" },
        role: { label: "下面一行", type: "text" },
        tag: { label: "标签", type: "text" },
        rows: {
          label: "每一行",
          type: "array",
          arrayFields: {
            label: { label: "名称", type: "text" },
            value: { label: "内容", type: "text" },
            icon: {
              label: "图案",
              type: "select",
              options: [
                { label: "电话", value: "phone" },
                { label: "地点", value: "place" },
                { label: "人", value: "person" },
                { label: "工程", value: "work" },
                { label: "钱", value: "money" },
                { label: "日期", value: "date" },
              ],
            },
          },
          defaultItemProps: { label: "名称", value: "内容", icon: "person" },
          getItemSummary: (item) => item.label || "一行",
        },
        actionLabel: { label: "按钮上的字", type: "text" },
      },
      defaultProps: {
        name: "陈先生",
        role: "Taman Desa 三房翻新",
        tag: "熟客",
        rows: [
          { label: "电话", value: "012-345 6789", icon: "phone" },
          { label: "地址", value: "Taman Desa, KL", icon: "place" },
          { label: "这一单", value: "RM 48,500 · 已确认", icon: "money" },
          { label: "上门量尺", value: "8月18日 · 已完成", icon: "date" },
        ],
        actionLabel: "WhatsApp 联络",
      },
      render: ({ name, role, tag, rows, actionLabel }) => (
        <PersonCard name={name} role={role} tag={tag} rows={rows} actionLabel={actionLabel} />
      ),
    },

    JobCard: {
      label: "工程卡片",
      fields: {
        title: { label: "工程名", type: "text" },
        client: { label: "客户", type: "text" },
        status: { label: "状态", type: "text" },
        tone: {
          label: "意思",
          type: "select",
          options: [
            { label: "正常", value: "normal" },
            { label: "好", value: "good" },
            { label: "留意", value: "warn" },
            { label: "不好", value: "bad" },
          ],
        },
        amount: { label: "金额", type: "text" },
        amountLabel: { label: "金额旁边的字", type: "text" },
        percent: { label: "完成度", type: "number" },
        stageLabel: { label: "现在做到哪", type: "text" },
      },
      defaultProps: {
        title: "Taman Desa 三房翻新",
        client: "陈先生 · 012-345 6789",
        status: "施工中",
        tone: "warn",
        amount: "RM 48,500",
        amountLabel: "订金已收 50%",
        percent: 62,
        stageLabel: "木工进场",
      },
      render: ({ title, client, status, tone, amount, amountLabel, percent, stageLabel }) => (
        <JobCard
          title={title}
          client={client}
          status={status}
          tone={tone}
          amount={amount}
          amountLabel={amountLabel}
          percent={percent}
          stageLabel={stageLabel}
        />
      ),
    },

    TermsBlock: {
      label: "条款与签名",
      fields: {
        heading: { label: "标题", type: "text" },
        body: { label: "条款内容", type: "textarea" },
        signLabel: { label: "签名栏", type: "text" },
        dateLabel: { label: "日期栏", type: "text" },
      },
      defaultProps: {
        heading: "报价条款",
        body:
          "施工范围包括拆除旧橱柜、水电改位、防水、贴砖、天花板与油漆。不包括家具、电器与窗帘。" +
          "订金 50%,施工完成后付清尾款。水电一年保修,木工六个月。" +
          "工期以实际现场情况为准,如遇管理层批准延误,完工日期顺延。",
        signLabel: "客户签名",
        dateLabel: "日期",
      },
      render: ({ heading, body, signLabel, dateLabel }) => (
        <TermsBlock heading={heading} body={body} signLabel={signLabel} dateLabel={dateLabel} />
      ),
    },

    MonthSummary: {
      label: "本月对账",
      fields: {
        heading: { label: "标题", type: "text" },
        figures: {
          label: "每一格",
          type: "array",
          arrayFields: {
            label: { label: "名称", type: "text" },
            value: { label: "数字", type: "text" },
            note: { label: "下面的小字", type: "text" },
            tone: {
              label: "意思",
              type: "select",
              options: [
                { label: "正常", value: "" },
                { label: "好", value: "good" },
                { label: "留意", value: "warn" },
                { label: "不好", value: "bad" },
              ],
            },
          },
          defaultItemProps: { label: "名称", value: "0", note: "", tone: "" },
          getItemSummary: (item) => item.label || "一格",
        },
        footNote: { label: "最下面一句", type: "text" },
      },
      defaultProps: {
        heading: "本月对账",
        figures: [
          { label: "已确认工程", value: "RM 71,300", note: "比上月 +13.2%", tone: "good" },
          { label: "施工中", value: "4", note: "3 单本周收尾", tone: "" },
          { label: "待回复报价", value: "2", note: "最久一张 3 天", tone: "warn" },
          { label: "做完未收款", value: "RM 31,200", note: "超过 30 天", tone: "bad" },
        ],
        footNote: "数字来自你自己的记录,改一笔这里就跟着变。",
      },
      render: ({ heading, figures, footNote }) => (
        <MonthSummary heading={heading} figures={figures} footNote={footNote} />
      ),
    },

    Overlap: {
      label: "压在色带上",
      fields: {
        band: { label: "色带里放什么", type: "slot" },
        body: { label: "压上去的那一块", type: "slot" },
      },
      defaultProps: { band: [], body: [] },
      render: ({ band: Band, body: Body }) => (
        <Overlap band={<Band />}>
          <Body />
        </Overlap>
      ),
    },

    Bento: {
      label: "一大两小",
      fields: {
        lead: { label: "大的那一块", type: "slot" },
        a: { label: "小的 · 上", type: "slot" },
        b: { label: "小的 · 下", type: "slot" },
      },
      defaultProps: { lead: [], a: [], b: [] },
      render: ({ lead: Lead, a: A, b: B }) => (
        <Bento lead={<Lead />} a={<A />} b={<B />} />
      ),
    },

    ShareChart: {
      label: "占比",
      fields: {
        title: { label: "标题", type: "text" },
        caption: { label: "说明", type: "text" },
        unit: { label: "单位", type: "text" },
        slices: {
          label: "每一块",
          type: "array",
          arrayFields: {
            label: { label: "名称", type: "text" },
            value: { label: "数值", type: "number" },
            color: { label: "颜色", type: "text" },
          },
          defaultItemProps: { label: "一块", value: 1, color: "var(--chart-1)" },
          getItemSummary: (item) => item.label || "一块",
        },
      },
      defaultProps: {
        title: "钱卡在哪一段",
        caption: "",
        unit: "RM",
        slices: [
          { label: "已确认", value: 48500, color: "var(--chart-1)" },
          { label: "等回复", value: 22800, color: "var(--chart-2)" },
          { label: "报价中", value: 96000, color: "var(--chart-3)" },
        ],
      },
      render: ({ title, caption, unit, slices, shape, frame }) => (
        <ShareChart
          title={title}
          caption={caption}
          unit={unit}
          slices={slices}
          shape={shape}
          frame={frame}
        />
      ),
    },

    RankList: {
      label: "排行",
      fields: {
        heading: { label: "标题", type: "text" },
        rows: {
          label: "每一名",
          type: "array",
          arrayFields: {
            name: { label: "名字", type: "text" },
            sub: { label: "下面一行", type: "text" },
            amount: { label: "金额 / 数量", type: "text" },
          },
          defaultItemProps: { name: "陈先生", sub: "", amount: "RM 0" },
          getItemSummary: (item) => item.name || "一名",
        },
      },
      defaultProps: {
        heading: "谁最有价值",
        rows: [
          { name: "陈先生", sub: "Taman Desa 三房翻新", amount: "RM 48,500" },
          { name: "李太太", sub: "Bukit Jalil 厨房改造", amount: "RM 22,800" },
          { name: "黄先生", sub: "Cheras 店面装修", amount: "RM 96,000" },
        ],
      },
      render: ({ heading, rows, shape }) => (
        <RankList heading={heading} rows={rows} shape={shape} />
      ),
    },

    MarkList: {
      label: "标注清单",
      fields: {
        heading: { label: "标题", type: "text" },
        marks: {
          label: "每一条",
          type: "array",
          arrayFields: {
            text: { label: "内容", type: "text" },
            tone: {
              label: "意思",
              type: "select",
              options: [
                { label: "好 / 包含", value: "good" },
                { label: "留意", value: "warn" },
                { label: "不包含", value: "bad" },
              ],
            },
            icon: { label: "图案", type: "select", options: [
                { label: "人", value: "person" },
                { label: "电话", value: "phone" },
                { label: "地点", value: "place" },
                { label: "时间", value: "time" },
                { label: "钱", value: "money" },
                { label: "文件", value: "file" },
                { label: "标签", value: "tag" },
                { label: "公司", value: "company" },
                { label: "工程", value: "work" },
                { label: "日期", value: "date" },
              ] },
          },
          defaultItemProps: { text: "一条", tone: "good", icon: "file" },
          getItemSummary: (item) => item.text || "一条",
        },
      },
      defaultProps: {
        heading: "报价包含什么",
        marks: [
          { text: "拆除与清运", tone: "good", icon: "work" },
          { text: "水电改位（另计）", tone: "warn", icon: "money" },
          { text: "家具与电器", tone: "bad", icon: "tag" },
        ],
      },
      render: ({ heading, marks, rule }) => (
        <MarkList heading={heading} marks={marks} rule={rule} />
      ),
    },

    PhotoFrame: {
      label: "照片框",
      fields: {
        /*
          A PICKER, NOT A URL FIELD.

          It read 「照片网址（留空就是空框）」. A renovation contractor does not
          have a photo URL -- he has a photo, on his phone, of the kitchen he
          finished last week, which is the most persuasive thing that could be
          on his website. The product was asking him to paste a link to it, and
          the founder found what that produces: three grey boxes reading
          「Add a photo」 on the live published site, one per phone screen.

          See design-system/editor/photo-field.tsx for the three sources and
          the order they are offered in.
        */
        src: {
          label: "照片",
          type: "custom",
          render: ({ value, onChange }) => (
            <PhotoField value={value as string} onChange={onChange} />
          ),
        },
        alt: { label: "照片说明（给看不到的人）", type: "text" },
        caption: { label: "图说", type: "text" },
      },
      defaultProps: { caption: "放一张工地照片" },
      render: ({ src, alt, caption, ratio }) => (
        <PhotoFrame src={src} alt={alt} caption={caption} ratio={ratio} />
      ),
    },

    ActionRow: {
      label: "按钮组",
      fields: {
        actions: {
          label: "每一颗",
          type: "array",
          arrayFields: {
            label: { label: "字", type: "text" },
            tone: {
              label: "轻重",
              type: "select",
              options: [
                { label: "主要", value: "default" },
                { label: "描边", value: "outline" },
                { label: "次要", value: "secondary" },
                { label: "很淡", value: "ghost" },
              ],
            },
          },
          defaultItemProps: { label: "按钮", tone: "outline" },
          getItemSummary: (item) => item.label || "按钮",
        },
      },
      defaultProps: {
        actions: [
          { label: "发出报价", tone: "default" },
          { label: "存草稿", tone: "outline" },
          { label: "删掉", tone: "ghost" },
        ],
      },
      render: ({ actions, orientation }) => (
        <ActionRow actions={actions} orientation={orientation} />
      ),
    },

    ChoiceSelect: {
      label: "下拉选择",
      fields: {
        label: { label: "问题", type: "text" },
        name: { label: "栏位名（存资料用）", type: "text" },
        options: {
          label: "选项",
          type: "array",
          arrayFields: { label: { label: "选项", type: "text" } },
          defaultItemProps: { label: "选项" },
          getItemSummary: (item) => item.label || "选项",
        },
      },
      defaultProps: {
        label: "这一单的状态",
        name: "status",
        options: [{ label: "询价中" }, { label: "已报价" }, { label: "已确认" }, { label: "施工中" }, { label: "已完工" }],
      },
      render: ({ label, name, options, size }) => (
        <ChoiceSelect label={label} name={name} options={options} size={size} />
      ),
    },

    RailNav: {
      label: "侧边导航",
      fields: {
        // THE FIRST REAL DESIGN CHOICE IN THIS EDITOR.
        //
        // Counted on 2026-08-21: of nineteen registered blocks, seventy-two
        // fields were text or array and ten were radio/select — and nine of
        // those ten were semantic (a status tone, a required flag), not
        // visual. Exactly ONE block let a customer change how anything looked
        // (TrendChart's bar/line/area). The founder pressed the sidebar
        // expecting to be shown another sidebar and there was not one:
        // 「我按这个sidebar 就是我要换那个sidebar啦 可是我现在没有别的sidebar给客户换啊」
        //
        // A radio rather than a select because four options that a customer is
        // choosing BETWEEN should all be visible at once. See RailVariant in
        // rail-nav.tsx for what each one is for.
        variant: {
          label: "导航样式",
          type: "radio",
          options: [
            { label: "完整", value: "full" },
            { label: "窄栏", value: "compact" },
            { label: "极简", value: "quiet" },
            { label: "带主要按钮", value: "action" },
          ],
        },
        brandLabel: { label: "系统名称", type: "text" },
        // CONTENT, not shape. Written into every generated rail whichever
        // register is on, and drawn only by the `action` variant -- the same
        // arrangement FilterChips' two labels use. A register is a choice about
        // APPEARANCE; what the button says is the customer's business, and it
        // must survive them switching to a register that does not show it and
        // back again.
        actionLabel: { label: "主要按钮", type: "text" },
        actionHref: { label: "主要按钮链接", type: "text" },
        brandHref: { label: "首页链接", type: "text" },
        userName: { label: "用户名", type: "text" },
        userRoleLabel: { label: "职位", type: "text" },
        // Was two fixed `href` text fields pointing at "#". A customer could
        // neither remove 通知 nor add 客服, and clicking either did nothing --
        // the rail's footer was the one part of the system that was not theirs
        // to design. Now it is a list like every other part of the page.
        utilityItems: {
          label: "底部功能",
          type: "array",
          arrayFields: {
            label: { label: "名称", type: "text" },
            iconName: {
              label: "图标",
              type: "select",
              options: [
                { label: "通知", value: "notifications" },
                { label: "设置", value: "account" },
                { label: "客服", value: "support" },
                { label: "收件箱", value: "inbox" },
              ],
            },
          },
          defaultItemProps: { label: "新功能", iconName: "account" },
          getItemSummary: (item) => item.label || "功能",
        },
        items: {
          label: "菜单项",
          type: "array",
          arrayFields: {
            href: { type: "text" },
            label: { type: "text" },
            group: { type: "text" },
            badge: { type: "number" },
            // A name, not a node: Puck field data is JSON, so this is the only
            // way a generated nav can carry icons at all. Unknown names render
            // text-only rather than failing (see rail-icons.tsx's RAIL_ICONS),
            // which is why it is safe to expose as free text.
            iconName: { label: "图标", type: "text" },
          },
          defaultItemProps: { href: "#", label: "菜单项", group: "" },
          getItemSummary: (item) => item.label || "菜单项",
        },
      },
      defaultProps: {
        brandLabel: "我的系统",
        brandHref: "#",
        userName: "我",
        items: [{ href: "#", label: "总览", group: "" }],
        utilityItems: [
          { label: "通知", iconName: "notifications" },
          { label: "账号设置", iconName: "account" },
        ],
      },
      render: ({ variant, brandLabel, brandHref, items, utilityItems, userName, userRoleLabel, actionLabel, actionHref }) => (
        <RailNav
          variant={variant}
          actionLabel={actionLabel}
          actionHref={actionHref}
          brand={{ href: brandHref, label: brandLabel }}
          items={items}
          utilityItems={utilityItems}
          user={{ name: userName, roleLabel: userRoleLabel }}
        />
      ),
    },
  },
};

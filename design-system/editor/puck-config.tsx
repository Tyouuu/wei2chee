import type { Config } from "@puckeditor/core";
import { PageHeader } from "@/design-system/components/page-header";
import { EmptyState } from "@/design-system/components/empty-state";
import { StatusDot, type StatusTone } from "@/design-system/components/status-dot";
import { HeroCard } from "@/design-system/components/hero-card";
import { Avatar } from "@/design-system/components/avatar";
import { RecordTable, type RecordRow } from "@/design-system/components/record-table";
import { DatePicker } from "@/design-system/components/date-picker";
import { MonthPicker } from "@/design-system/components/month-picker";
import { FileUploadField } from "@/design-system/components/receipt-field";
import { FilterChips, type FilterChip } from "@/design-system/components/filter-chips";
import { Combobox, type ComboboxOption } from "@/design-system/components/combobox";
import { TextAutocomplete } from "@/design-system/components/text-autocomplete";
import { Listbox, type ListboxOption } from "@/design-system/components/listbox";
import { RailNav, type RailItem } from "@/design-system/components/rail-nav";

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
type Components = {
  PageHeader: { title: string; subtitle?: string };
  EmptyState: { variant: "empty" | "filtered" | "cleared"; title: string; description?: string };
  StatusDot: { tone: "positive" | "warning" | "negative" | "neutral"; label: string };
  HeroCard: { label: string; value: string; href: string };
  Avatar: { name: string };
  RecordTable: {
    gridId: string;
    caption: string;
    primaryLabel: string;
    secondaryLabel?: string;
    amountLabel?: string;
    statusColumnLabel: string;
    rows: RecordRow[];
  };
  DatePicker: { name: string; placeholder?: string; allowClear?: boolean; required?: boolean };
  MonthPicker: { name: string; placeholder?: string; allowClear?: boolean };
  FileUploadField: { label?: string; hint: string; name?: string; accept?: string };
  FilterChips: { chips: FilterChip[]; clearAllHref: string };
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
  RailNav: {
    brandLabel: string;
    brandHref: string;
    items: RailItem[];
    notificationsHref: string;
    accountHref: string;
    userName: string;
    userRoleLabel?: string;
  };
};

const STATUS_TONE_OPTIONS = [
  { label: "Positive", value: "positive" },
  { label: "Warning", value: "warning" },
  { label: "Negative", value: "negative" },
  { label: "Neutral", value: "neutral" },
];

export const puckConfig: Config<Components> = {
  components: {
    PageHeader: {
      fields: {
        title: { type: "text" },
        subtitle: { type: "text" },
      },
      defaultProps: { title: "标题" },
      render: ({ title, subtitle }) => <PageHeader title={title} subtitle={subtitle} />,
    },
    EmptyState: {
      fields: {
        variant: {
          type: "select",
          options: [
            { label: "Empty", value: "empty" },
            { label: "Filtered", value: "filtered" },
            { label: "Cleared", value: "cleared" },
          ],
        },
        title: { type: "text" },
        description: { type: "textarea" },
      },
      defaultProps: { variant: "empty", title: "还没有内容" },
      render: ({ variant, title, description }) => (
        <EmptyState variant={variant} title={title} description={description} />
      ),
    },
    StatusDot: {
      fields: {
        tone: { type: "select", options: STATUS_TONE_OPTIONS },
        label: { type: "text" },
      },
      defaultProps: { tone: "neutral", label: "状态" },
      render: ({ tone, label }) => <StatusDot tone={tone} label={label} />,
    },
    HeroCard: {
      fields: {
        label: { type: "text" },
        value: { type: "text" },
        href: { type: "text" },
      },
      defaultProps: { label: "本月营收", value: "RM 0", href: "#" },
      render: ({ label, value, href }) => <HeroCard label={label} value={value} href={href} />,
    },
    Avatar: {
      fields: {
        name: { type: "text" },
      },
      defaultProps: { name: "客户" },
      render: ({ name }) => <Avatar name={name} />,
    },
    RecordTable: {
      fields: {
        gridId: { type: "text" },
        caption: { type: "text" },
        primaryLabel: { type: "text" },
        secondaryLabel: { type: "text" },
        amountLabel: { type: "text" },
        statusColumnLabel: { type: "text" },
        rows: {
          type: "array",
          arrayFields: {
            primary: { type: "text" },
            secondary: { type: "text" },
            amount: { type: "text" },
            statusTone: { type: "select", options: STATUS_TONE_OPTIONS },
            statusLabel: { type: "text" },
          },
          defaultItemProps: {
            primary: "记录",
            statusTone: "neutral" as StatusTone,
            statusLabel: "待处理",
          },
          getItemSummary: (item) => item.primary || "记录",
        },
      },
      defaultProps: {
        gridId: "records",
        caption: "记录列表",
        primaryLabel: "名称",
        secondaryLabel: "说明",
        amountLabel: "金额",
        statusColumnLabel: "状态",
        rows: [
          {
            primary: "示例记录 #1",
            secondary: "示例说明",
            amount: "RM 0.00",
            statusTone: "neutral",
            statusLabel: "待处理",
          },
        ],
      },
      render: ({ gridId, caption, primaryLabel, secondaryLabel, amountLabel, statusColumnLabel, rows }) => (
        <RecordTable
          gridId={gridId}
          caption={caption}
          primaryLabel={primaryLabel}
          secondaryLabel={secondaryLabel}
          amountLabel={amountLabel}
          statusColumnLabel={statusColumnLabel}
          rows={rows}
        />
      ),
    },
    DatePicker: {
      fields: {
        name: { type: "text" },
        placeholder: { type: "text" },
        allowClear: {
          type: "radio",
          options: [
            { label: "是", value: true },
            { label: "否", value: false },
          ],
        },
        required: {
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
      fields: {
        name: { type: "text" },
        placeholder: { type: "text" },
        allowClear: {
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
      fields: {
        label: { type: "text" },
        hint: { type: "text" },
        name: { type: "text" },
        accept: { type: "text" },
      },
      defaultProps: { label: "上传附件", hint: "PDF 或图片，最大 10MB", name: "file" },
      render: ({ label, hint, name, accept }) => (
        <FileUploadField label={label} hint={hint} name={name} accept={accept} />
      ),
    },
    FilterChips: {
      fields: {
        chips: {
          type: "array",
          arrayFields: {
            label: { type: "text" },
            value: { type: "text" },
            removeHref: { type: "text" },
          },
          defaultItemProps: { label: "筛选条件", value: "", removeHref: "#" },
          getItemSummary: (item) => item.label || "筛选条件",
        },
        clearAllHref: { type: "text" },
      },
      defaultProps: { chips: [], clearAllHref: "#" },
      render: ({ chips, clearAllHref }) => <FilterChips chips={chips} clearAllHref={clearAllHref} />,
    },
    Combobox: {
      fields: {
        name: { type: "text" },
        value: { type: "text" },
        placeholder: { type: "text" },
        options: {
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
      fields: {
        name: { type: "text" },
        defaultValue: { type: "text" },
        placeholder: { type: "text" },
        suggestions: {
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
      fields: {
        name: { type: "text" },
        defaultValue: { type: "text" },
        placeholder: { type: "text" },
        options: {
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
    RailNav: {
      fields: {
        brandLabel: { type: "text" },
        brandHref: { type: "text" },
        notificationsHref: { type: "text" },
        accountHref: { type: "text" },
        userName: { type: "text" },
        userRoleLabel: { type: "text" },
        items: {
          type: "array",
          arrayFields: {
            href: { type: "text" },
            label: { type: "text" },
            group: { type: "text" },
            badge: { type: "number" },
          },
          defaultItemProps: { href: "#", label: "菜单项", group: "" },
          getItemSummary: (item) => item.label || "菜单项",
        },
      },
      defaultProps: {
        brandLabel: "我的系统",
        brandHref: "#",
        notificationsHref: "#",
        accountHref: "#",
        userName: "我",
        items: [{ href: "#", label: "总览", group: "" }],
      },
      render: ({ brandLabel, brandHref, items, notificationsHref, accountHref, userName, userRoleLabel }) => (
        <RailNav
          brand={{ href: brandHref, label: brandLabel }}
          items={items}
          notificationsHref={notificationsHref}
          accountHref={accountHref}
          user={{ name: userName, roleLabel: userRoleLabel }}
        />
      ),
    },
  },
};

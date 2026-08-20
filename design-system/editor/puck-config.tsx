import type { Config, Slot } from "@puckeditor/core";
import { PageHeader } from "@/design-system/components/page-header";
import { EmptyState } from "@/design-system/components/empty-state";
import { StatusDot, type StatusTone } from "@/design-system/components/status-dot";
import { HeroCard } from "@/design-system/components/hero-card";
import { Avatar } from "@/design-system/components/avatar";
import { RecordTable } from "@/design-system/components/record-table";
import { TableFieldEditor } from "@/design-system/editor/table-field";
import { type TableModel } from "@/lib/portal/table-model";
import { DatePicker } from "@/design-system/components/date-picker";
import { MonthPicker } from "@/design-system/components/month-picker";
import { FileUploadField } from "@/design-system/components/receipt-field";
import { FilterChips, type FilterChip } from "@/design-system/components/filter-chips";
import { Combobox, type ComboboxOption } from "@/design-system/components/combobox";
import { TextAutocomplete } from "@/design-system/components/text-autocomplete";
import { Listbox, type ListboxOption } from "@/design-system/components/listbox";
import { RailNav, type RailItem, type RailUtilityItem } from "@/design-system/components/rail-nav";
import { WorkflowStrip, type WorkflowStage } from "@/design-system/components/workflow-strip";
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
  SystemShell: { sidebar: Slot; main: Slot };
  PageHeader: { title: string; subtitle?: string };
  EmptyState: { variant: "empty" | "filtered" | "cleared"; title: string; description?: string };
  StatusDot: { tone: "positive" | "warning" | "negative" | "neutral"; label: string };
  HeroCard: {
    label: string;
    value: string;
    href: string;
    chgSuffix?: string;
    stats?: { label: string; value: string; href: string; tone?: "normal" | "caution" | "warn"; sub?: string }[];
    spark?: { n: number }[];
    sparkLabel?: string;
  };
  Avatar: { name: string };
  WorkflowStrip: { title?: string; stages: WorkflowStage[] };
  // One prop, not six. Columns and rows have to agree with each other (adding a
  // column grows every row), and Puck edits one prop per field -- so they are
  // one prop with one editor. See design-system/editor/table-field.tsx.
  RecordTable: {
    gridId: string;
    caption: string;
    table: TableModel;
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
  Alert: { variant: "default" | "destructive"; title: string; description?: string };
  Progress: { label?: string; value: number };
  RailNav: {
    brandLabel: string;
    brandHref: string;
    items: RailItem[];
    utilityItems: RailUtilityItem[];
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
  // Puck labels the whole-page selection "Page" and, with no root config at
  // all, offers a default `title` field that writes to nothing this product
  // reads. Named in Chinese and emptied of fields: selecting the page should
  // say what is selected, not present a control that does nothing.
  root: { label: "整个页面", fields: {} },
  // The palette a customer actually reads. Without categories Puck renders one
  // flat alphabetical list of fifteen items, which for a business owner who was
  // told "design your own system" is a wall of jargon. Grouped by what the
  // customer is trying to DO -- show information, let someone fill something
  // in, move around the system -- not by what kind of React component it is.
  categories: {
    content: {
      title: "内容展示",
      components: ["PageHeader", "HeroCard", "RecordTable", "WorkflowStrip", "Progress", "StatusDot", "Alert", "Avatar", "EmptyState"],
      defaultExpanded: true,
    },
    input: {
      title: "填写与筛选",
      components: [
        "DatePicker",
        "MonthPicker",
        "Listbox",
        "Combobox",
        "TextAutocomplete",
        "FileUploadField",
        "FilterChips",
      ],
      defaultExpanded: true,
    },
    layout: {
      title: "页面框架",
      components: ["SystemShell", "RailNav"],
      defaultExpanded: false,
    },
  },
  components: {
    // The page shell. Listed first because it is the frame every generated
    // page is built inside -- see design-system/components/system-shell.tsx for
    // why a sidebar could not simply be the first block in a flat stack.
    SystemShell: {
      label: "页面框架",
      fields: {
        sidebar: { label: "侧边栏", type: "slot" },
        main: { label: "页面内容", type: "slot" },
      },
      defaultProps: { sidebar: [], main: [] },
      render: ({ sidebar: Sidebar, main: Main }) => (
        <SystemShell sidebar={<Sidebar />} main={<Main />} />
      ),
    },
    PageHeader: {
      label: "页面标题",
      fields: {
        title: { label: "标题", type: "text" },
        subtitle: { label: "副标题", type: "text" },
      },
      defaultProps: { title: "标题" },
      render: ({ title, subtitle }) => <PageHeader title={title} subtitle={subtitle} />,
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
      render: ({ label, value, href, chgSuffix, stats, spark, sparkLabel }) => (
        <HeroCard
          label={label}
          value={value}
          href={href}
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
      render: ({ gridId, caption, table }) => (
        <RecordTable gridId={gridId} caption={caption} table={table} />
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
      render: ({ title, stages }) => <WorkflowStrip title={title} stages={stages} />,
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
      },
      defaultProps: { chips: [], clearAllHref: "#" },
      render: ({ chips, clearAllHref }) => <FilterChips chips={chips} clearAllHref={clearAllHref} />,
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
    RailNav: {
      label: "侧边导航",
      fields: {
        brandLabel: { label: "系统名称", type: "text" },
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
      render: ({ brandLabel, brandHref, items, utilityItems, userName, userRoleLabel }) => (
        <RailNav
          brand={{ href: brandHref, label: brandLabel }}
          items={items}
          utilityItems={utilityItems}
          user={{ name: userName, roleLabel: userRoleLabel }}
        />
      ),
    },
  },
};

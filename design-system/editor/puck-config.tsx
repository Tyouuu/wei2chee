import type { Config } from "@puckeditor/core";
import { PageHeader } from "@/design-system/components/page-header";
import { EmptyState } from "@/design-system/components/empty-state";
import { StatusDot } from "@/design-system/components/status-dot";
import { HeroCard } from "@/design-system/components/hero-card";
import { Avatar } from "@/design-system/components/avatar";

/**
 * First-pass Puck registration: a deliberately curated subset of the
 * design-system's 21 components, not all of them (see task-4 brief step 2).
 * The 16 skipped components (field, modal, listbox, combobox, data-grid,
 * date-picker, month-picker, filter-chips, columns-menu, text-autocomplete,
 * confirm-submit-button, receipt-field, anchored-panel, rail-nav,
 * mobile-nav, notification-toast) all take render-prop children, ReactNode
 * props, or arrays of objects that Puck's built-in field types (text,
 * textarea, number, select, radio) can't represent without custom field
 * work -- left for a later pass once the basic editor is proven end-to-end.
 *
 * Two of the five registered components' real prop shapes differ from the
 * plan's guessed signatures (re-read from design-system/components/*.tsx in
 * full before writing this file, per the brief's own instruction):
 *
 *   - HeroCard: the plan guessed `{ title, value }`. The real component has
 *     no `title` prop -- the headline label prop is `label`, and `href` is
 *     REQUIRED (not optional, no plan mention at all). Fixed below to
 *     `{ label, value, href }`; `href` defaults to "#" since this first
 *     integration pass has no real per-card destination to link to yet.
 *   - StatusDot: also has an optional `pulse?: boolean`, correctly left
 *     unwrapped -- Puck 0.23.0 has no boolean/checkbox field type (only
 *     text/number/textarea/select/radio/richtext/array/object/external/
 *     custom/slot), so a real boolean prop can't be Puck-field-friendly
 *     without a custom field, which is out of scope for this pass.
 *
 * PageHeader, EmptyState, and Avatar's registered props matched the plan's
 * guesses exactly (their skipped props -- meta/action, action/icon, size --
 * are all optional, so omitting them from `fields`/`render` is a safe
 * subset, not a mismatch).
 */
type Components = {
  PageHeader: { title: string; subtitle?: string };
  EmptyState: { variant: "empty" | "filtered" | "cleared"; title: string; description?: string };
  StatusDot: { tone: "positive" | "warning" | "negative" | "neutral"; label: string };
  HeroCard: { label: string; value: string; href: string };
  Avatar: { name: string };
};

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
        tone: {
          type: "select",
          options: [
            { label: "Positive", value: "positive" },
            { label: "Warning", value: "warning" },
            { label: "Negative", value: "negative" },
            { label: "Neutral", value: "neutral" },
          ],
        },
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
  },
};

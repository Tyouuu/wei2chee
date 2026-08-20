"use client";

import { useTranslations } from "next-intl";

/**
 * The delivery pipeline, in one place.
 *
 * Mirrors the check constraint on `projects.stage` (migration 20260821020000).
 * Stated in both places on purpose: the database is the rule, and a UI that
 * offered a stage the database rejects would fail on click.
 *
 * `paid` is NOT a separate control anywhere in this console. `console_set_stage`
 * derives it from the stage, so the founder cannot end up having marked someone
 * "building" while they are still blocked from saving their own work — the
 * classic failure of an admin screen that exposes both.
 */
export const STAGES = ["designing", "quoted", "paid", "building", "live"] as const;
export type Stage = (typeof STAGES)[number];

/** Colour carries meaning here, not decoration: grey is waiting on nobody,
 *  brass is waiting on the customer, jade is money in, blue is work in flight. */
export function stageTone(stage: string): string {
  switch (stage) {
    case "quoted":
      return "[color:var(--color-brass-bright)]";
    case "paid":
    case "live":
      return "[color:var(--color-jade-bright)]";
    case "building":
      return "[color:var(--color-primary)]";
    default:
      return "[color:var(--color-paper)]";
  }
}

export function StageSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("portal.console");
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label={t("colStage")}
      className={`rounded-[6px] border px-2 py-1 text-[12.5px] [border-color:var(--color-ink-800)] [background-color:var(--color-ink-850)] disabled:opacity-50 ${stageTone(value)}`}
    >
      {STAGES.map((s) => (
        <option key={s} value={s}>
          {t(`stage.${s}`)}
        </option>
      ))}
    </select>
  );
}

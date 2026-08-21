"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { StyleName } from "@/app/[locale]/style-picker/style-column";

const STYLES: StyleName[] = ["ledger", "hearth", "blueprint", "bare", "docket"];

/**
 * Switches the customer's system between the three visual styles, live, from
 * inside the editor.
 *
 * WHY: the style was a one-time, irreversible choice made on the very first
 * screen after signup -- before the customer had seen a single one of the three
 * applied to their OWN data. That was survivable while the three differed by
 * hue alone. Now that they differ in typeface, corner radius, row density,
 * accent, ground temperature and border language, picking wrong means running a
 * business system that looks nothing like what its owner wanted, with no way
 * back. See supabase/migrations/20260820140000.
 *
 * The preview is optimistic and instant: the canvas re-scopes the moment a
 * style is clicked, because seeing your own quotations in Hearth is the entire
 * point and a round-trip before the paint would defeat it. The write happens
 * behind that, and a failure rolls the preview back rather than leaving the
 * screen disagreeing with the database.
 */
export function StyleSwitcher({
  style,
  onPreview,
}: {
  style: StyleName;
  /** Applies a style to the canvas immediately, before (and independently of)
   *  the write landing. */
  onPreview: (style: StyleName) => void;
}) {
  const t = useTranslations("portal.editor");
  const tStyles = useTranslations("stylePicker");
  const [pending, setPending] = useState<StyleName | null>(null);
  const [failed, setFailed] = useState(false);

  async function choose(next: StyleName) {
    if (next === style || pending) return;

    const previous = style;
    onPreview(next);
    setPending(next);
    setFailed(false);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc("update_project_style", { new_style: next });
    setPending(null);

    if (error) {
      // Roll the canvas back. A style that looks changed but was never saved
      // is worse than one that visibly refused to change: the customer would
      // keep designing against a style their next reload throws away.
      onPreview(previous);
      setFailed(true);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="[font-size:var(--text-xs)] [color:var(--color-paper-dim)]">{t("styleLabel")}</span>
      {STYLES.map((name) => {
        const active = name === style;
        return (
          <button
            key={name}
            type="button"
            onClick={() => choose(name)}
            disabled={Boolean(pending)}
            aria-pressed={active}
            className={
              active
                ? "rounded-md px-2 py-1 [font-size:var(--text-xs)] [background-color:var(--color-primary-soft)] [color:var(--color-primary-deep)] [font-weight:var(--fw-semibold)]"
                : "rounded-md px-2 py-1 [font-size:var(--text-xs)] transition-colors disabled:opacity-50 [color:var(--color-paper-dim)] enabled:hover:[background-color:var(--color-ink-850)] enabled:hover:[color:var(--color-paper)]"
            }
          >
            {tStyles(`styles.${name}.label`)}
          </button>
        );
      })}
      {failed && (
        <span role="status" className="[font-size:var(--text-xs)] [color:var(--color-clay-bright)]">
          {t("styleFailed")}
        </span>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { StyleColumn, type StyleName } from "@/app/[locale]/style-picker/style-column";

const STYLES: StyleName[] = ["ledger", "hearth", "blueprint"];

/**
 * The portal's one-time style-selection step. Reuses the public
 * `/style-picker` page's comparison copy (`stylePicker.styles.*`,
 * `stylePicker.selectCta`) so the columns' content doesn't fork between
 * the public page and this one -- only the CTA mode differs (see
 * StyleColumn's own header comment): here each column gets `onSelect`
 * instead of `whatsappPrefillText`, which renders a real button that
 * calls `set_project_style` directly instead of a WhatsApp deep link.
 *
 * `set_project_style` (see supabase/migrations/20260818120000) enforces
 * one-time-only server-side: it only succeeds when the caller's project
 * still has `style is null`, and raises otherwise. That failure surfaces
 * here as `rpcError.message`, shown as plain text above the columns --
 * this page does not pre-check whether style is already set (that guard
 * belongs to the portal layout gate downstream, not this step).
 */
export function StyleSelectClient() {
  const t = useTranslations("stylePicker");
  const router = useRouter();
  const [pending, setPending] = useState<StyleName | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(style: StyleName) {
    setPending(style);
    setError(null);

    const supabase = createBrowserSupabaseClient();
    const { error: rpcError } = await supabase.rpc("set_project_style", { new_style: style });

    if (rpcError) {
      setPending(null);
      setError(rpcError.message);
      return;
    }

    router.push(`/portal/dashboard`);
  }

  return (
    <>
      {error ? <p className="mb-4 text-[13px] text-destructive">{error}</p> : null}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {STYLES.map((style) => (
          <StyleColumn
            key={style}
            styleName={style}
            label={t(`styles.${style}.label`)}
            description={t(`styles.${style}.description`)}
            selectCta={pending === style ? "…" : t("selectCta")}
            onSelect={() => handleSelect(style)}
          />
        ))}
      </div>
    </>
  );
}

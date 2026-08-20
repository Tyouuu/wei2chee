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
 * still has `style is null`, and raises otherwise. That failure is a raw
 * Postgres exception message (English only, e.g. "style already set or
 * project not found") -- never shown to the customer verbatim, since this
 * page is bilingual. Mapped through `portal.styleSelect.error*` instead,
 * the same way login-form.tsx / signup-form.tsx map their own Supabase
 * error messages through `auth.error*` rather than displaying them raw.
 * This page does not pre-check whether style is already set (that guard
 * belongs to the portal layout gate downstream, not this step) -- the
 * "already set" case is expected to reach here and gets its own message.
 */
export function StyleSelectClient({ recommended }: { recommended: StyleName | null }) {
  const t = useTranslations("stylePicker");
  const tError = useTranslations("portal.styleSelect");
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
      setError(
        rpcError.message.includes("already set") ? tError("errorAlreadySet") : tError("errorGeneric"),
      );
      return;
    }

    // The home, not the editor. Picking a style is the last step of setup, and
    // what a customer wants immediately after it is to SEE the system in the
    // style they just chose -- five pages side by side -- not to be dropped
    // into an authoring canvas for one of them.
    router.push(`/portal`);
  }

  return (
    <>
      {error ? <p className="mb-4 text-[13px] text-destructive">{error}</p> : null}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {[...STYLES]
          .sort((a, b) => Number(b === recommended) - Number(a === recommended))
          .map((style) => (
          <StyleColumn
            key={style}
            styleName={style}
            label={t(`styles.${style}.label`)}
            description={t(`styles.${style}.description`)}
            selectCta={pending === style ? "…" : t("selectCta")}
            recommendedLabel={style === recommended ? tError("recommendedBadge") : undefined}
            onSelect={() => handleSelect(style)}
          />
        ))}
      </div>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SystemLang } from "@/lib/system-lang";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * Where a customer tells the product what their business is called.
 *
 * WHY IT IS THE FIRST THING BUILT IN THIS ROUND: until now nothing in the
 * schema could hold a business name, so every generated system labelled itself
 * from whatever was to hand — the signup email's local part, then a per-trade
 * placeholder ("我的装修公司"). Both appear in the rail on every page, on the
 * home screen, in the specification document and in the WhatsApp handoff. A
 * system that cannot say its owner's company name reads as a demo no matter
 * how well the rest of it is built.
 *
 * A dialog rather than a settings page, deliberately: there are exactly two
 * fields, and a whole route for two fields is the kind of structure that makes
 * a product feel bureaucratic rather than complete. It grows into a page the
 * day there is a third thing worth putting on one.
 *
 * `<dialog>` rather than a div with a backdrop: the platform element already
 * does focus trapping, Escape-to-close, inert-ing the page behind it and top-
 * layer stacking. Every one of those is a thing hand-rolled modals get wrong.
 */
export function SettingsDialog({
  open,
  onClose,
  businessName,
  ownerName,
  systemLang,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** The customer's own saved values, or null where they have never set one —
   *  which is what lets the fields show a placeholder rather than pre-filling
   *  a guess the customer would then have to notice was not theirs. */
  businessName: string | null;
  ownerName: string | null;
  /** `projects.system_language`. The language the BUILT SYSTEM speaks, which is
   *  not the language this dialog is written in -- see lib/system-lang.ts. */
  systemLang: SystemLang;
  onSaved: (next: {
    businessName: string | null;
    ownerName: string | null;
    systemLang: SystemLang;
  }) => void;
}) {
  const t = useTranslations("portal.settings");
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [business, setBusiness] = useState(businessName ?? "");
  const [owner, setOwner] = useState(ownerName ?? "");
  const [lang, setLang] = useState<SystemLang>(systemLang);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      // Re-seed from props on each open, so cancelling and reopening shows the
      // saved values again rather than the abandoned edit.
      setBusiness(businessName ?? "");
      setOwner(ownerName ?? "");
      setLang(systemLang);
      setFailed(false);
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, businessName, ownerName, systemLang]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setFailed(false);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc("update_business_identity", {
      new_business_name: business,
      new_owner_name: owner,
    });

    // Only when it actually changed. The RPC returns the pages that have never
    // been saved, so a language change can regenerate exactly those and leave
    // every page the customer has touched alone -- their edits are theirs, in
    // whatever language they made them.
    let langError = null;
    if (!error && lang !== systemLang) {
      const res = await supabase.rpc("update_project_system_language", {
        new_language: lang,
      });
      langError = res.error;
    }
    setSaving(false);

    if (error || langError) {
      setFailed(true);
      return;
    }
    // Empty means "clear it" on the server (it stores NULL), so the parent is
    // told null rather than "" — otherwise the UI would show an empty name
    // where the database will next serve the placeholder.
    onSaved({
      businessName: business.trim() || null,
      ownerName: owner.trim() || null,
      systemLang: lang,
    });
    onClose();
    // A language change rewrites every page that was still a draft, and those
    // are rendered on the server. Nothing short of a refresh shows it.
    if (lang !== systemLang) router.refresh();
  }

  const field =
    "mt-1.5 w-full [border-radius:var(--radius-control)] border [border-color:var(--color-ink-800)] [background-color:var(--color-ink-900)] px-3 py-2 [color:var(--color-paper)] [font-size:var(--text-base)] outline-none focus-visible:[border-color:var(--color-primary)]";

  return (
    <dialog
      ref={ref}
      // `close` fires for Escape and for the backdrop, both of which bypass the
      // buttons — without this the parent's `open` stays true and the dialog
      // cannot be reopened.
      onClose={onClose}
      onClick={(e) => {
        // Clicking the backdrop targets the dialog element itself; clicking
        // anything inside targets a descendant.
        if (e.target === ref.current) onClose();
      }}
      // `m-auto` is load-bearing. The UA stylesheet centres a modal <dialog>
      // with `margin: auto`, and Tailwind's preflight resets `margin: 0` on
      // every element -- so without this the dialog pins itself to the top-left
      // corner of the viewport. Caught in a screenshot, not in review.
      className="m-auto w-[min(30rem,calc(100vw-2rem))] [border-radius:var(--radius-lg)] border [border-color:var(--color-ink-800)] [background-color:var(--color-ink-900)] [box-shadow:var(--shadow-overlay)] [padding:var(--pad-card-lg)] backdrop:bg-black/60"
    >
      <form onSubmit={handleSubmit}>
        <h2 className="[color:var(--color-paper)] [font-size:var(--text-title)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-title)]">
          {t("title")}
        </h2>
        <p className="mt-1.5 [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
          {t("body")}
        </p>

        <div className="mt-6">
          <label
            htmlFor="settings-business"
            className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]"
          >
            {t("businessLabel")}
          </label>
          <input
            id="settings-business"
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            maxLength={60}
            placeholder={t("businessPlaceholder")}
            className={field}
          />
          <p className="mt-1.5 [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
            {t("businessHint")}
          </p>
        </div>

        <div className="mt-5">
          <label
            htmlFor="settings-owner"
            className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]"
          >
            {t("ownerLabel")}
          </label>
          <input
            id="settings-owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            maxLength={40}
            placeholder={t("ownerPlaceholder")}
            className={field}
          />
        </div>

        <div className="mt-5">
          <span className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
            {t("langLabel")}
          </span>
          {/* Two buttons rather than a dropdown. There are exactly two answers,
            and a select would hide the one not chosen behind a click -- for a
            setting most owners will look at once and never touch, seeing both
            options is the whole interaction. */}
          <div className="mt-2 flex gap-2">
            {(["en", "zh"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLang(option)}
                aria-pressed={lang === option}
                className={`flex-1 [border-radius:var(--radius-control)] border px-3 py-2 text-left [font-size:var(--text-sm)] ${
                  lang === option
                    ? "[border-color:var(--color-primary)] [background-color:var(--color-ink-850)] [color:var(--color-paper)]"
                    : "[border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] hover:[color:var(--color-paper)]"
                }`}
              >
                <span className="block [font-weight:var(--fw-medium)]">
                  {t(`lang.${option}.name`)}
                </span>
                <span className="mt-0.5 block [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                  {t(`lang.${option}.hint`)}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 [color:var(--color-paper-dim)] [font-size:var(--text-xs)] [line-height:var(--leading-body)]">
            {t("langHint")}
          </p>
        </div>

        {failed && (
          <p role="alert" className="mt-4 [color:var(--color-clay-bright)] [font-size:var(--text-sm)]">
            {t("failed")}
          </p>
        )}

        <div className="mt-7 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="[border-radius:var(--radius-control)] px-4 py-2 [color:var(--color-paper-dim)] [font-size:var(--text-sm)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="[border-radius:var(--radius-control)] [background-color:var(--color-primary)] px-4 py-2 [color:var(--color-on-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] disabled:opacity-60 enabled:hover:[background-color:var(--color-primary-deep)]"
          >
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </form>
    </dialog>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * Adds a page to the customer's system.
 *
 * WHY THIS IS THE CORE PROMISE, NOT A FEATURE: the product sells "design your
 * own system", and the page set was picked entirely by trade — a contractor got
 * five pages and had no way to add a sixth or drop one. What a customer
 * actually got to design was the CONTENTS of somebody else's page set, which is
 * a meaningfully smaller claim than the one on the landing page.
 *
 * TWO ROUTES IN, AND THE SECOND ONE IS THE POINT. A customer can take one of
 * the page types this product already knows how to build — those arrive with
 * real sample data and the trade's own vocabulary — or name a page of their own
 * that it has never heard of. Only the second one is designing rather than
 * picking from a menu, so it is the default state of this dialog and the known
 * types are offered underneath as shortcuts.
 *
 * DELIBERATELY NOT DONE THROUGH THE AI. The assistant edits the page in front
 * of it and persists nothing (see app/api/portal/edit/route.ts) — that
 * separation is what keeps the paid gate meaningful and lets any AI edit be
 * undone with the same button as a drag. Adding a page is a database write, so
 * routing it through the assistant would either break that contract or quietly
 * put an unpaid write behind a chat box. The assistant now says where to go
 * instead, which is a better answer than doing it in the wrong place.
 */

/** Page types with a real builder behind them. Mirrors PAGES_FOR_INDUSTRY's
 *  vocabulary; `dashboard` is omitted because every system already has one. */
const KNOWN_TYPES = ["customers", "quotations", "projects", "payments", "bookings", "orders"] as const;

export function AddPageDialog({
  open,
  onClose,
  existingKeys,
}: {
  open: boolean;
  onClose: () => void;
  /** So a type the system already has is offered as already-added rather than
   *  as a button that silently does nothing. */
  existingKeys: string[];
}) {
  const t = useTranslations("portal.addPage");
  const tEditor = useTranslations("portal.editor");
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setTitle("");
      setFailed(null);
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  async function add(requestedKey: string | null, pageTitle: string) {
    if (busy) return;
    setBusy(true);
    setFailed(null);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.rpc("add_project_page", {
      requested_key: requestedKey,
      new_title: pageTitle,
    });
    setBusy(false);

    if (error) {
      // The RPC's own message is Postgres text ("page limit reached"), never
      // shown raw — same discipline as every other RPC call in this app.
      setFailed(error.message.includes("limit") ? t("failedLimit") : t("failed"));
      return;
    }
    onClose();
    // The page list is server-rendered, so the new page only exists on screen
    // after the server renders again.
    router.refresh();
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      // `m-auto` because Tailwind's preflight resets the `margin: auto` the UA
      // stylesheet uses to centre a modal dialog.
      className="m-auto w-[min(32rem,calc(100vw-2rem))] [border-radius:var(--radius-lg)] border [border-color:var(--color-ink-800)] [background-color:var(--color-ink-900)] [box-shadow:var(--shadow-overlay)] [padding:var(--pad-card-lg)] backdrop:bg-black/60"
    >
      <h2 className="[color:var(--color-paper)] [font-size:var(--text-title)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-title)]">
        {t("title")}
      </h2>
      <p className="mt-1.5 [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
        {t("body")}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) add(null, title);
        }}
        className="mt-6"
      >
        <label
          htmlFor="add-page-title"
          className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]"
        >
          {t("nameLabel")}
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="add-page-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={24}
            placeholder={t("namePlaceholder")}
            className="min-w-0 flex-1 [border-radius:var(--radius-control)] border [border-color:var(--color-ink-800)] [background-color:var(--color-ink-850)] px-3 py-2 [color:var(--color-paper)] [font-size:var(--text-base)] outline-none focus-visible:[border-color:var(--color-primary)]"
          />
          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="shrink-0 [border-radius:var(--radius-control)] [background-color:var(--color-primary)] px-4 py-2 [color:var(--color-on-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] disabled:opacity-40 enabled:hover:[background-color:var(--color-primary-deep)]"
          >
            {busy ? tEditor("saving") : t("add")}
          </button>
        </div>
      </form>

      <p className="mt-7 text-[11px] uppercase tracking-[0.1em] [color:var(--color-paper-dim)] [font-weight:var(--fw-semibold)]">
        {t("knownTitle")}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {KNOWN_TYPES.map((key) => {
          const had = existingKeys.includes(key);
          return (
            <button
              key={key}
              type="button"
              disabled={had || busy}
              onClick={() => add(key, "")}
              className={`[border-radius:var(--radius-control)] border px-3 py-1.5 [font-size:var(--text-sm)] transition-colors ${
                had
                  ? "[border-color:var(--color-ink-850)] [color:var(--color-paper-dim)] opacity-50"
                  : "[border-color:var(--color-ink-800)] [color:var(--color-paper)] enabled:hover:[border-color:var(--color-primary)]"
              }`}
            >
              {tEditor(`pages.${key}`)}
              {had && ` · ${t("alreadyAdded")}`}
            </button>
          );
        })}
      </div>

      {failed && (
        <p role="alert" className="mt-5 [color:var(--color-clay-bright)] [font-size:var(--text-sm)]">
          {failed}
        </p>
      )}

      <div className="mt-7 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="[border-radius:var(--radius-control)] px-4 py-2 [color:var(--color-paper-dim)] [font-size:var(--text-sm)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
        >
          {t("done")}
        </button>
      </div>
    </dialog>
  );
}

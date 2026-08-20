"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Data } from "@puckeditor/core";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { formatDayTime } from "@/lib/format-date";

/**
 * The way back.
 *
 * WHY IT EXISTS AT ALL, AND WHY NOW. Undo is in-memory and dies with the tab;
 * `save_project_page` overwrote the layout in place. So until this, "the way it
 * was yesterday" was not recoverable by any means the customer had — and the
 * editor was about to start saving on its own, which turns a bad five minutes
 * into a committed database row without anyone pressing anything. History is
 * what makes autosave a convenience instead of a faster way to lose work.
 *
 * WHY A DIALOG AND NOT A THIRD PANEL. The right-hand column already holds two
 * things that take turns (the fields panel and the assistant). A third claimant
 * would make which-panel-is-showing a thing the customer has to track. History
 * is also a place you visit rarely and leave immediately, which is what a modal
 * is for.
 */

type Version = { id: string; created_at: string };

export function VersionHistoryDialog({
  open,
  onClose,
  pageKey,
  locale,
  onRestored,
}: {
  open: boolean;
  onClose: () => void;
  pageKey: string;
  locale: string;
  /** Hands the restored layout back to the editor, which puts it on Puck's own
   *  history stack — so a restore can be undone with the same button as a drag. */
  onRestored: (layout: Data) => void;
}) {
  const t = useTranslations("portal.editor");
  const ref = useRef<HTMLDialogElement>(null);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // Fetched on open rather than on mount: the list changes every time the
  // customer saves, so a copy read once at page load would be stale by the time
  // anyone looked at it.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setVersions(null);
    setFailed(false);
    createBrowserSupabaseClient()
      .rpc("list_page_versions", { target_page_key: pageKey })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setFailed(true);
        else setVersions((data as Version[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [open, pageKey]);

  async function restore(version: Version) {
    if (busyId) return;
    setBusyId(version.id);
    const { data, error } = await createBrowserSupabaseClient().rpc("restore_page_version", {
      version_id: version.id,
    });
    setBusyId(null);
    if (error) {
      setFailed(true);
      return;
    }
    onRestored(data as Data);
    // Closed on success, deliberately, rather than showing a confirmation in
    // the list. Restoring re-renders the editor, which re-creates the `header`
    // override this dialog is mounted inside -- so any confirmation held here
    // is wiped by its own result, and the list silently refetches with one MORE
    // entry (the snapshot the restore just took of the current state), which
    // reads as nothing having happened. The page changing behind the closing
    // dialog is the honest confirmation, and undo takes it back.
    onClose();
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
      className="m-auto w-[min(30rem,calc(100vw-2rem))] [border-radius:var(--radius-lg)] border [border-color:var(--color-ink-800)] [background-color:var(--color-ink-900)] [box-shadow:var(--shadow-overlay)] [padding:var(--pad-card-lg)] backdrop:bg-black/60"
    >
      <h2 className="[color:var(--color-paper)] [font-size:var(--text-title)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-title)]">
        {t("historyTitle")}
      </h2>
      <p className="mt-1.5 [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
        {t("historyBody")}
      </p>

      <div className="mt-5 max-h-[46vh] overflow-y-auto">
        {failed ? (
          <p role="alert" className="[color:var(--color-clay-bright)] [font-size:var(--text-sm)]">
            {t("historyFailed")}
          </p>
        ) : versions === null ? (
          <p className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
            {t("historyLoading")}
          </p>
        ) : versions.length === 0 ? (
          <p className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
            {t("historyEmpty")}
          </p>
        ) : (
          <ol className="flex flex-col">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-3 border-b py-2.5 last:border-b-0 [border-color:var(--color-ink-850)]"
              >
                <time
                  dateTime={v.created_at}
                  className="flex-1 tabular-nums [color:var(--color-paper)] [font-size:var(--text-sm)]"
                >
                  {formatDayTime(v.created_at, locale)}
                </time>
                <button
                  type="button"
                  onClick={() => restore(v)}
                  disabled={busyId !== null}
                  className="shrink-0 [border-radius:var(--radius-control)] border px-3 py-1 [border-color:var(--color-ink-800)] [color:var(--color-paper)] [font-size:var(--text-sm)] disabled:opacity-40 enabled:hover:[border-color:var(--color-primary)]"
                >
                  {busyId === v.id ? t("historyRestoring") : t("historyRestore")}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="[border-radius:var(--radius-control)] px-4 py-2 [color:var(--color-paper-dim)] [font-size:var(--text-sm)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
        >
          {t("historyClose")}
        </button>
      </div>
    </dialog>
  );
}

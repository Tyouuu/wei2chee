"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * 发布 — the button that puts a customer's 官网 on a URL a stranger can open.
 *
 * ── WHY IT IS IN THE BAR, NEXT TO 保存设计 ──────────────────────────────────
 *
 * Durable's Publish sits exactly here, and its Publish means what it says. Ours
 * did not exist at all: six 官网版面 have been buildable since 20260822040000
 * and none of them had an address, so a customer could design a website and
 * could not send anyone the link. The moment that question occurs to an owner
 * is while they are looking at the website they just made, which is this
 * screen — not a settings page two clicks away.
 *
 * ── ONLY ON THE WEBSITE PAGE ───────────────────────────────────────────────
 *
 * 收款 and 客户 are the business's own working pages; there is nothing to
 * publish and a greyed-out Publish on five pages would teach the customer that
 * the button is decorative. editor-client mounts this for `website` only.
 *
 * ── WHY <details> AND NOT useState ─────────────────────────────────────────
 *
 * Same reason as BarMenu: Puck re-creates the `header` override's render
 * function on every canvas change, so a boolean held in a component inside it
 * gets wiped by the editor's own re-render. The one piece of state that DOES
 * live here is the form's, which is fine — it is short-lived and re-mounting it
 * loses a half-typed slug at worst.
 *
 * ── THE TWO STATES ARE DELIBERATELY DIFFERENT SHAPES ───────────────────────
 *
 * Not published: one field and one button, because there is exactly one thing
 * to do. Published: the URL first, as something to copy and open, because the
 * question an owner comes back with is 「链接是什么」 rather than 「怎么发布」.
 */

type Result =
  | "ok"
  | "empty"
  | "shape"
  | "taken"
  | "reserved"
  | "no_slug"
  | "not_saved"
  | "no_project"
  | "failed"
  | "unauthenticated";

/** RPC status → the sentence the owner reads. Kept as a table rather than a
 *  switch so a status with no message is a missing key at build time. */
const MESSAGE: Record<Exclude<Result, "ok">, string> = {
  empty: "publishErrEmpty",
  shape: "publishErrShape",
  taken: "publishErrTaken",
  reserved: "publishErrReserved",
  no_slug: "publishErrNoSlug",
  not_saved: "publishErrNotSaved",
  no_project: "publishErrFailed",
  failed: "publishErrFailed",
  unauthenticated: "publishErrFailed",
};

export function PublishSite({
  initialSlug,
  initialPublished,
}: {
  initialSlug: string | null;
  initialPublished: boolean;
}) {
  const t = useTranslations("portal.editor");
  const ref = useRef<HTMLDetailsElement | null>(null);

  const [slug, setSlug] = useState(initialSlug ?? "");
  const [savedSlug, setSavedSlug] = useState(initialSlug);
  const [published, setPublished] = useState(initialPublished);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Click-away and Escape, as BarMenu does -- but NOT close-on-click-inside:
  // this panel holds a text field, and a menu that closes when you click into
  // its own input is a menu you cannot type in.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = ref.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && ref.current?.open) ref.current.open = false;
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Rendered after mount only. `window.location.origin` is the honest base --
  // it is right on localhost, on a preview deploy and on the real domain
  // without a variable anyone has to remember to set. Empty on the server
  // render, which is why the URL row is guarded rather than built into markup.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = savedSlug ? `${origin}/s/${savedSlug}` : "";

  async function send(body: { slug?: string; published?: boolean }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const { result } = (await res.json()) as { result: Result };
      if (result !== "ok") {
        setError(t(MESSAGE[result] ?? "publishErrFailed"));
        return false;
      }
      if (typeof body.slug === "string")
        setSavedSlug(body.slug.trim().toLowerCase());
      if (typeof body.published === "boolean") setPublished(body.published);
      return true;
    } catch {
      setError(t("publishErrFailed"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <details ref={ref} className="relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2.5 py-1.5 [font-size:var(--text-sm)] marker:hidden [color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
        style={{ listStyle: "none" }}
      >
        {/* A dot rather than the word 「已上线」 in the bar: the bar is already
            dense, and the state only has to be legible at a glance -- the panel
            underneath says it in words. */}
        <span
          aria-hidden
          className="inline-block size-[7px] rounded-full"
          style={{
            backgroundColor: published
              ? "var(--color-positive, #3fb96b)"
              : "var(--color-ink-800)",
          }}
        />
        {published ? t("publishLive") : t("publishCta")}
      </summary>

      <div
        className="absolute right-0 z-50 mt-1.5 w-[340px] rounded-[var(--radius-lg)] border p-4 [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]"
        style={{
          boxShadow: "var(--shadow-overlay, 0 14px 34px rgba(6,14,26,.5))",
        }}
      >
        <h2 className="[color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
          {t("publishTitle")}
        </h2>
        <p className="mt-1 [color:var(--color-paper-dim)] [font-size:var(--text-xs)] [line-height:var(--leading-body)]">
          {published ? t("publishOnline") : t("publishBody")}
        </p>

        {/* THE ADDRESS. Shown as the whole URL with the typed part inside it,
            rather than a bare field labelled 「网址」 -- an owner is choosing the
            thing they will read out on the phone, so they should be looking at
            the thing they will read out. */}
        <label className="mt-4 block [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
          {t("publishAddressLabel")}
        </label>
        {/* 🔴 这一条边是**那个框自己的边**，不是一条分隔线 —— 里面那个
            `<input>` 是 `bg-transparent` 没有边，人看到的框就是这一层。
            2026-09-08 `audit:platform` 量出来 **1.35:1**（要 3:1）。
            ⚠️ 而那条守卫看不到它：它读的是 `<input …/>` **那一段**，
            而这条边写在包着它的 `<div>` 上。**要靠浏览器那一把量。** */}
        <div className="mt-1.5 flex items-center gap-0 rounded-[var(--radius-md)] border [border-color:var(--input)] [background-color:var(--color-ink-850)]">
          <span className="shrink-0 py-2 pl-3 [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
            /s/
          </span>
          <input
            value={slug}
            onChange={(e) => {
              // Normalised as they type, so what they see is what gets stored
              // and the shape error is something they can only hit on purpose.
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              setError(null);
            }}
            maxLength={40}
            spellCheck={false}
            autoCapitalize="none"
            placeholder={t("publishSlugPlaceholder")}
            aria-label={t("publishAddressLabel")}
            className="min-w-0 flex-1 bg-transparent py-2 pr-3 [color:var(--color-paper)] [font-size:var(--text-sm)] outline-none"
          />
        </div>
        <p className="mt-1.5 [color:var(--color-paper-dim)] [font-size:11px] [line-height:1.6]">
          {t("publishSlugHint")}
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-2.5 rounded-[var(--radius-md)] px-2.5 py-2 [font-size:var(--text-xs)] [line-height:1.6]"
            style={{
              backgroundColor: "var(--color-negative-soft, #3a1c1f)",
              color: "var(--color-negative, #f0999d)",
            }}
          >
            {error}
          </p>
        ) : null}

        <div className="mt-3.5 flex items-center gap-2">
          {published ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => send({ published: false })}
              className="rounded-[var(--radius-md)] border px-3 py-1.5 [font-size:var(--text-xs)] [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] transition-colors disabled:opacity-50 enabled:hover:[color:var(--color-paper)]"
            >
              {t("publishUnpublish")}
            </button>
          ) : null}

          <button
            type="button"
            disabled={busy || !slug.trim()}
            onClick={() =>
              // Both in one request, in that order: a first publish carries its
              // own address, and sending them separately would fail the publish
              // for having no slug that the same click just supplied.
              send(published ? { slug } : { slug, published: true })
            }
            className="ml-auto rounded-[var(--radius-md)] px-3.5 py-1.5 [font-size:var(--text-sm)] [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)] transition-colors disabled:opacity-50 enabled:hover:[background-color:var(--color-primary-deep)]"
          >
            {published ? t("publishSaveAddress") : t("publishNow")}
          </button>
        </div>

        {published && url ? (
          <div className="mt-3.5 border-t pt-3.5 [border-color:var(--color-ink-800)]">
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-[var(--radius-md)] px-2.5 py-1.5 [background-color:var(--color-ink-850)] [color:var(--color-paper)] [font-size:var(--text-xs)]">
                {url}
              </code>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                }}
                className="shrink-0 rounded-[var(--radius-md)] border px-2.5 py-1.5 [font-size:var(--text-xs)] [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] transition-colors hover:[color:var(--color-paper)]"
              >
                {copied ? t("publishCopied") : t("publishCopy")}
              </button>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block [color:var(--color-primary)] [font-size:var(--text-xs)] hover:underline"
            >
              {t("publishOpen")} →
            </a>
          </div>
        ) : null}

        {!published ? (
          <p className="mt-3 [color:var(--color-paper-dim)] [font-size:11px] [line-height:1.6]">
            {t("publishOffline")}
          </p>
        ) : null}
      </div>
    </details>
  );
}

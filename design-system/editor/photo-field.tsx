"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useTrade } from "@/design-system/trade-context";
import { similarQuery } from "@/lib/images/photo-words";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * How a photograph gets onto a customer's page.
 *
 * ── WHY THIS EXISTS AT ALL ────────────────────────────────────────────────
 *
 * The field was a text input labelled 「照片网址（留空就是空框）」. A renovation
 * contractor does not have a photo URL. He has a photo, on his phone, of the
 * kitchen he finished last week — which is the single most persuasive thing
 * that could be on his website, and the product was asking him to paste a link
 * to it.
 *
 * ── THE THREE SOURCES, IN THE ORDER THEY DESERVE ──────────────────────────
 *
 * 1. HIS OWN, straight off the device he is holding. The only one that answers
 *    the question a homeowner is actually asking: what does this contractor's
 *    work look like.
 * 2. THE LIBRARY. For the trades that genuinely have nothing to photograph: a
 *    wholesaler, a bookkeeper, an agent.
 * 3. GENERATED. Not built. Named here so the seam is visible rather than
 *    implied.
 *
 * ── 「像这张」, ADDED 2026-08-28 ────────────────────────────────────────────
 *
 * The founder: 「客户要换照片的话 然后他点击进去照片 我们是不是提供足够类似的照片
 * 我们需不需要加脚本来挡掉一些客户不想要的图片啊」.
 *
 * The second half — a blocklist — was measured and rejected; the reasoning is
 * in lib/images/photo-words.ts. The first half is answered here. Every
 * photograph arrives carrying the words its library uses to describe it, so
 * the one he points at IS the next query. It costs nothing to maintain, it
 * gets better as the libraries grow, and it is steered by the only person who
 * knows which of the twenty is his business.
 *
 * ── AND THE PANEL SPEAKS ENGLISH NOW ──────────────────────────────────────
 *
 * 重点 13: the platform talks to the owner in English. Task 18 moved 386
 * strings and missed this file entirely — it sits behind two clicks and a
 * network call, so the crawler that counted them never opened it. Fifteen
 * hard-coded Chinese strings were still here on 2026-08-28, on a panel reached
 * through /en/.
 */
export function PhotoField({
  value,
  onChange,
  trade,
}: {
  value?: string;
  onChange: (next: string) => void;
  /** The customer's industry slug, the library's opening guess. Optional
   *  because the picker is registered inside a memoised Puck config that has
   *  no way to pass it; it falls back to TradeProvider, which is read at
   *  render and therefore cannot go stale. */
  trade?: string;
}) {
  const t = useTranslations("portal.editor.photo");
  const contextTrade = useTrade();
  const forTrade = trade || contextTrade;
  const [tab, setTab] = useState<"own" | "library">("own");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── his own ─────────────────────────────────────────────────────────── */
  async function upload(file: File) {
    setError(null);
    setBusy("upload");
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error(t("signIn"));
      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("account_id", auth.user.id)
        .single();
      if (!project) throw new Error(t("noProject"));

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
      const path = `${project.id}/${crypto.randomUUID()}.${ext}`;
      // Straight to storage with the owner's own session. Storage RLS
      // (migration 20260826050000) is what confines the write to their own
      // folder, so the bytes never pass through our server at all.
      const { error: up } = await supabase.storage
        .from("site-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (up) throw new Error(up.message);
      const { data } = supabase.storage.from("site-photos").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("uploadFailed"));
    } finally {
      setBusy(null);
    }
  }

  /* ── the library ─────────────────────────────────────────────────────── */
  /* `provider` and `link` travel with each photograph because the two libraries
     do NOT ask for the same thing. Pixabay wants to be named where results are
     shown and nothing on the published page; Pexels wants a prominent link
     wherever a request is made. Assuming one rule for both is either a licence
     breach or a credit line on a contractor's website that nobody asked for.

     `tags` travels for 「像这张」 — see similarQuery. */
  type Photo = {
    id: string;
    thumb: string;
    full: string;
    credit: string;
    tags?: string;
    provider?: "pixabay" | "pexels";
    link?: string;
  };
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [page, setPage] = useState(1);
  const [noKey, setNoKey] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [q, setQ] = useState("");
  /** The photograph the grid is currently matching, and the words that were in
   *  the box before it — so 「回到搜索」 goes back rather than to nothing. */
  const [like, setLike] = useState<{ thumb: string; wasQ: string } | null>(null);
  const seen = useRef<string[]>([]);

  async function ask(nextPage = 1, reset = false, override?: string) {
    setError(null);
    setBusy("search");
    try {
      if (reset) seen.current = [];
      const url = new URL("/api/photos", window.location.origin);
      const words = (override ?? q).trim();
      if (words) url.searchParams.set("q", words);
      if (forTrade) url.searchParams.set("trade", forTrade);
      url.searchParams.set("page", String(nextPage));
      // 「不滿意 可以再去圖庫推薦」: everything already offered is excluded, so
      // pressing again never returns the same photograph twice.
      url.searchParams.set("exclude", seen.current.slice(-60).join(","));
      const res = await fetch(url);
      const body = await res.json();
      if (body.reason === "no-key") {
        setNoKey(true);
        setPhotos([]);
        return;
      }
      setNoKey(false);
      if (Array.isArray(body.suggestions)) setSuggestions(body.suggestions as string[]);
      const next = (body.photos ?? []) as Photo[];
      seen.current.push(...next.map((p) => p.id));
      setPhotos(next);
      setPage(nextPage);
    } catch {
      setError(t("offline"));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (tab === "library" && !photos.length && !noKey) void ask(1, true);
    // Once per tab opening, deliberately: re-running on every keystroke would
    // spend a rate limit shared across every customer on words nobody finished
    // typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  /** 「像这张」 — the photograph he pointed at becomes the search. */
  function askLike(p: Photo) {
    const seed = similarQuery(p.tags, p.provider);
    /* A photograph with no words on it cannot seed anything, and a button that
       does nothing when pressed is worse than one that is not there — so it is
       not rendered in that case. This is the guard for the race where it is. */
    if (!seed) return;
    setLike({ thumb: p.thumb, wasQ: q });
    setQ(seed);
    void ask(1, true, seed);
  }

  function backToSearch() {
    const was = like?.wasQ ?? "";
    setLike(null);
    setQ(was);
    void ask(1, true, was);
  }

  async function adopt(p: Photo) {
    setError(null);
    setBusy(p.id);
    try {
      // Through the server, which fetches the bytes and stores them: Pixabay's
      // licence requires the file to be hosted by us rather than linked. See
      // app/api/photos/route.ts.
      const res = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src: p.full }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(t("cantTake"));
      onChange(body.url as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("cantTake"));
    } finally {
      setBusy(null);
    }
  }

  const TAB = "rounded-[var(--radius-sm)] px-2.5 py-1 [font-size:var(--text-xs)]";
  const ON = "[background-color:var(--color-ink-850)] [color:var(--color-paper)]";
  const OFF = "[color:var(--color-paper-dim)] hover:[color:var(--color-paper)]";

  return (
    /* `data-photo-picker` is a handle for npm run shoot:picker. The grid is the
       thing being judged, and a screenshot of the whole 1500px editor makes it
       forty pixels tall. */
    <div data-photo-picker className="flex flex-col gap-2.5">
      {value ? (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="h-14 w-20 shrink-0 rounded-[var(--radius-sm)] object-cover"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)] hover:[color:var(--color-paper)]"
          >
            {t("replace")}
          </button>
        </div>
      ) : null}

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setTab("own")}
          className={`${TAB} ${tab === "own" ? ON : OFF}`}
        >
          {t("ownTab")}
        </button>
        <button
          type="button"
          onClick={() => setTab("library")}
          className={`${TAB} ${tab === "library" ? ON : OFF}`}
        >
          {t("libraryTab")}
        </button>
      </div>

      {tab === "own" ? (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy === "upload"}
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-[var(--radius-md)] px-3 py-2.5 [border:1px_dashed_var(--color-ink-800)] [color:var(--color-paper-dim)] [font-size:var(--text-xs)] hover:[border-color:var(--color-paper-dim)] hover:[color:var(--color-paper)] disabled:opacity-50"
          >
            {busy === "upload" ? t("uploading") : t("uploadCta")}
          </button>
          <p className="mt-1.5 [color:var(--color-paper-dim)] [font-size:var(--text-micro)] [line-height:var(--leading-body)]">
            {t("uploadNote")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-1.5">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setLike(null);
                  void ask(1, true);
                }
              }}
              placeholder={t("searchPlaceholder")}
              className="min-w-0 flex-1 rounded-[var(--radius-sm)] px-2 py-1.5 [background-color:var(--color-ink-900)] [border:1px_solid_var(--input)] [color:var(--color-paper)] [font-size:var(--text-xs)]"
            />
            <button
              type="button"
              onClick={() => void ask(page + 1)}
              disabled={busy === "search" || noKey}
              className="shrink-0 rounded-[var(--radius-sm)] px-2.5 [border:1px_solid_var(--color-ink-800)] [color:var(--color-paper-dim)] [font-size:var(--text-xs)] hover:[color:var(--color-paper)] disabled:opacity-40"
            >
              {busy === "search" ? "…" : t("another")}
            </button>
          </div>

          {/*
            FOUR WORDS TO PRESS, NOT ONE SEARCH TO GUESS.

            Measured twice. 2026-08-27: one query per trade returned LEGO men
            for a renovation contractor. 2026-08-28: the first word decides the
            whole grid — 「tiles floor installation」 returns four fluorescent
            mosaic swatches and a laundromat, 「interior renovation work」
            returns six painters out of six. All four candidates are measured;
            the owner presses the one that is his business, because 「services」
            covers the aircond man and the electrician and we cannot know which.
          */}
          {suggestions.length > 1 && !noKey && !like ? (
            <div className="flex flex-wrap gap-1">
              {suggestions.map((sgg) => (
                <button
                  key={sgg}
                  type="button"
                  onClick={() => {
                    setQ(sgg);
                    void ask(1, true, sgg);
                  }}
                  disabled={busy === "search"}
                  className={`rounded-full px-2 py-0.5 [border:1px_solid_var(--color-ink-800)] [font-size:var(--text-micro)] disabled:opacity-40 ${
                    q.trim() === sgg
                      ? "[background-color:var(--color-primary)] [color:var(--color-on-primary)] [border-color:var(--color-primary)]"
                      : "[color:var(--color-paper-dim)] hover:[color:var(--color-paper)]"
                  }`}
                >
                  {sgg}
                </button>
              ))}
            </div>
          ) : null}

          {/* WHICH PHOTOGRAPH THE GRID IS MATCHING, shown as the photograph
              itself. A line of text saying 「similar results」 leaves him
              guessing which one he pressed; the thumbnail cannot. */}
          {like ? (
            <div className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 [background-color:var(--color-ink-900)] [border:1px_solid_var(--color-ink-800)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={like.thumb} alt="" className="h-8 w-11 shrink-0 rounded-[2px] object-cover" />
              <span className="min-w-0 flex-1 [color:var(--color-paper-dim)] [font-size:var(--text-micro)] [line-height:var(--leading-body)]">
                {t("similarOn")}
              </span>
              <button
                type="button"
                onClick={backToSearch}
                className="shrink-0 underline [color:var(--color-paper-dim)] [font-size:var(--text-micro)] hover:[color:var(--color-paper)]"
              >
                {t("similarBack")}
              </button>
            </div>
          ) : null}

          {noKey ? (
            <p className="[color:var(--color-paper-dim)] [font-size:var(--text-micro)] [line-height:var(--leading-body)]">
              {t("noKey")}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((p) => (
                /* A DIV, NOT A BUTTON. 「像这张」 sits on top of the tile, and a
                   button inside a button is invalid markup that browsers
                   silently un-nest — which would move the second control out of
                   the tile it belongs to. */
                <div key={p.id} className="relative [aspect-ratio:4/3]">
                  <button
                    type="button"
                    title={`${p.provider === "pexels" ? "Pexels" : "Pixabay"} · ${p.credit}`}
                    onClick={() => void adopt(p)}
                    disabled={Boolean(busy)}
                    className="absolute inset-0 overflow-hidden rounded-[var(--radius-sm)] disabled:opacity-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumb} alt="" className="h-full w-full object-cover" />
                    {busy === p.id ? (
                      <span className="absolute inset-0 grid place-items-center [background-color:oklch(0.16_0.012_265/0.7)] [color:#fff] [font-size:10px]">
                        …
                      </span>
                    ) : null}
                  </button>
                  {/* ALWAYS VISIBLE, NOT ON HOVER. Half of this product is read
                      on a phone, where there is no hover, and the owner we are
                      building for does not go hunting for a control that is not
                      there. */}
                  {similarQuery(p.tags, p.provider) ? (
                    <button
                      type="button"
                      data-similar
                      onClick={() => askLike(p)}
                      disabled={Boolean(busy)}
                      className="absolute bottom-0.5 right-0.5 rounded-[3px] px-1 py-px [background-color:oklch(0.16_0.012_265/0.55)] [color:#ffffffcc] [font-size:var(--text-micro)] [line-height:1.35] hover:[background-color:oklch(0.16_0.012_265/0.92)] hover:[color:#fff] disabled:opacity-40"
                    >
                      {t("similar")}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {/* BOTH LIBRARIES ASK TO BE NAMED HERE, AND THE WORDING IS THEIRS.

              Pixabay: 「show your users where the images are from, whenever
              search results are displayed」.
              Pexels: 「whenever you are doing an API request make sure to show a
              prominent link to Pexels」 — a LINK, not just the word, which is
              why this one is an anchor.

              Named only for the libraries that actually answered this search:
              crediting a library that returned nothing is not attribution, it
              is decoration. */}
          {photos.length ? (
            <p className="[color:var(--color-paper-dim)] [font-size:var(--text-micro)]">
              {t("creditPrefix")}{" "}
              {photos.some((p) => p.provider !== "pexels") ? (
                <a href="https://pixabay.com" target="_blank" rel="noreferrer" className="underline">
                  Pixabay
                </a>
              ) : null}
              {photos.some((p) => p.provider !== "pexels") && photos.some((p) => p.provider === "pexels")
                ? " · "
                : null}
              {photos.some((p) => p.provider === "pexels") ? (
                <a href="https://www.pexels.com" target="_blank" rel="noreferrer" className="underline">
                  Pexels
                </a>
              ) : null}
            </p>
          ) : null}
        </div>
      )}

      {error ? (
        <p className="[color:var(--color-clay-bright)] [font-size:var(--text-micro)]">{error}</p>
      ) : null}
    </div>
  );
}
